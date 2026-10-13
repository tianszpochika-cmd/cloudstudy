<script setup lang="ts">
import ExperienceHeader from '../components/ExperienceHeader.vue'
import { computed, onMounted, onUnmounted, ref } from "vue";
import {
  createRecording,
  createRoleplaySession,
  createShadowingSession,
  deleteRecording,
  listMinimalPairs,
  listListeningMaterials,
  submitRoleplayTurn,
  updateShadowingProgress,
} from "../api/b3";
import type {
  ListeningMaterial,
  MinimalPair,
  Phoneme,
  RoleplaySession,
  ShadowingSession,
} from "../domain/b3";
import {
  createMemoryB3RecordingVault,
  decryptB3Recording,
  encryptB3Recording,
} from "../platform/b3-recording-vault";
import { useB3Store } from "../stores/b3";

const store = useB3Store();
const vault = createMemoryB3RecordingVault();
const recording = ref<MediaRecorder | null>(null);
const chunks = ref<Blob[]>([]);
const isRecording = ref(false);
const recordingId = ref<string | null>(null);
const recordingDurationMs = ref(0);
const startedAt = ref(0);
const selectedPhoneme = ref<Phoneme | null>(null);
const minimalPairs = ref<MinimalPair[]>([]);
const activeAudio = ref<HTMLAudioElement | null>(null);
const shadowing = ref<ShadowingSession | null>(null);
const roleplay = ref<RoleplaySession | null>(null);
const permissionState = ref<
  "unknown" | "prompt" | "granted" | "denied" | "unsupported"
>("unknown");
const demoAudioUrl = ref<string | null>(null);
const demoAudioMessage = ref("正在检查示范音频资源…");
const currentRoleplayTurn = computed(
  () => roleplay.value?.turns[roleplay.value.turnIndex] ?? null,
);
const message = ref("跟读后可回放并自评。录音仅在当前页面保留。");

onMounted(async () => {
  await store.loadPhonetics();
  selectedPhoneme.value = store.phonemes[0] ?? null;
  try {
    minimalPairs.value = await listMinimalPairs();
  } catch {
    minimalPairs.value = [];
  }
  await loadDemoAudio();
});
onUnmounted(() => {
  if (recording.value?.state === "recording") recording.value.stop();
  activeAudio.value?.pause();
  void vault.clear();
  store.dispose();
});
function selectPhoneme(item: Phoneme): void {
  selectedPhoneme.value = item;
}
async function start(): Promise<void> {
  if (
    typeof navigator === "undefined" ||
    !navigator.mediaDevices?.getUserMedia ||
    typeof MediaRecorder === "undefined"
  ) {
    permissionState.value = "unsupported";
    message.value = "当前浏览器不支持录音；仍可继续音标、口型和文本跟读。";
    return;
  }
  permissionState.value = "prompt";
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    permissionState.value = "granted";
    chunks.value = [];
    startedAt.value = Date.now();
    recording.value = new MediaRecorder(stream);
    recording.value.ondataavailable = (event) => {
      if (event.data.size) chunks.value.push(event.data);
    };
    recording.value.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      recordingDurationMs.value = Math.max(500, Date.now() - startedAt.value);
      isRecording.value = false;
      message.value = `已生成本地录音片段（${Math.round(chunks.value.reduce((total, item) => total + item.size, 0) / 1024)}KB，${recordingDurationMs.value}ms），等待 AES-GCM 加密后登记。`;
    };
    recording.value.start();
    isRecording.value = true;
    message.value = "正在录音，完成后点击停止。";
  } catch {
    permissionState.value = "denied";
    message.value = "麦克风权限未开启，辨音和口型学习仍可继续。";
  }
}

async function loadDemoAudio(): Promise<void> {
  try {
    const material = (await listListeningMaterials())[0] as
      | ListeningMaterial
      | undefined;
    const media = material?.mediaRef;
    if (
      media?.rightsStatus === "AUTHORIZED" &&
      media.availability !== "NOT_READY" &&
      media.signedUrl
    ) {
      demoAudioUrl.value = media.signedUrl;
      demoAudioMessage.value = "示范音频已获得短时授权。";
      return;
    }
    demoAudioMessage.value =
      media?.rightsStatus === "REVOKED"
        ? "示范音频权益已撤销；已降级为文本脚本和 2D 口型。"
        : "示范音频当前没有可播放授权地址；已降级为文本脚本和 2D 口型。";
  } catch {
    demoAudioMessage.value =
      "示范音频资源暂时不可用；已降级为文本脚本和 2D 口型。";
  }
}
async function save(): Promise<void> {
  if (!chunks.value.length || recordingDurationMs.value < 500) return;
  try {
    const blob = new Blob(chunks.value, {
      type: chunks.value[0]?.type || "audio/webm",
    });
    const encrypted = await encryptB3Recording(blob, vault.keyProvider);
    const result = await createRecording(
      "seg-1",
      recordingDurationMs.value,
      encrypted.contentHash,
    );
    await vault.put(result.recordingId, encrypted);
    recordingId.value = result.recordingId;
    chunks.value = [];
    message.value =
      "录音已用 AES-GCM-256 加密并保存在本地内存仓；服务端只登记哈希和生命周期元数据。";
    try {
      if (!shadowing.value) shadowing.value = await createShadowingSession("seg-1");
      await updateShadowingProgress(
        shadowing.value.shadowingSessionId,
        recordingDurationMs.value,
        shadowing.value.attemptCount + 1,
      );
    } catch {
      message.value = "录音已加密登记；影子跟读进度暂未同步。";
    }
  } catch (error) {
    message.value =
      error instanceof Error ? error.message : "录音保存暂不可用。";
  }
}

async function startShadowing(): Promise<void> {
  if (!selectedPhoneme.value) return;
  try {
    shadowing.value = await createShadowingSession(
      `phoneme-${selectedPhoneme.value.phonemeId}`,
    );
    message.value = "影子跟读会话已打开；完成后可保存位置和次数。";
  } catch (error) {
    message.value =
      error instanceof Error ? error.message : "影子跟读会话暂时无法建立。";
  }
}

async function saveShadowing(): Promise<void> {
  if (!shadowing.value) {
    message.value = "请先打开影子跟读会话。";
    return;
  }
  try {
    await updateShadowingProgress(
      shadowing.value.shadowingSessionId,
      recordingDurationMs.value,
      shadowing.value.attemptCount + 1,
    );
    shadowing.value = {
      ...shadowing.value,
      positionMs: recordingDurationMs.value,
      attemptCount: shadowing.value.attemptCount + 1,
    };
    message.value = "跟读进度已保存。";
  } catch (error) {
    message.value =
      error instanceof Error ? error.message : "影子跟读进度暂未同步。";
  }
}
async function replay(): Promise<void> {
  if (!recordingId.value) return;
  const encrypted = await vault.get(recordingId.value);
  if (!encrypted) {
    message.value = "本地加密录音已过期或已清理。";
    return;
  }
  try {
    const blob = await decryptB3Recording(encrypted, vault.keyProvider);
    const url = URL.createObjectURL(blob);
    activeAudio.value?.pause();
    activeAudio.value = new Audio(url);
    activeAudio.value.onended = () => URL.revokeObjectURL(url);
    await activeAudio.value.play();
    message.value = "正在回放解密后的临时音频；页面关闭后密钥和密文都会清理。";
  } catch (error) {
    message.value =
      error instanceof Error ? error.message : "录音回放暂不可用。";
  }
}
async function remove(): Promise<void> {
  if (!recordingId.value) return;
  try {
    await deleteRecording(recordingId.value);
    await vault.delete(recordingId.value);
    activeAudio.value?.pause();
    recordingId.value = null;
    message.value = "录音已删除；本地密文已清理。";
  } catch (error) {
    message.value =
      error instanceof Error ? error.message : "录音删除暂不可用。";
  }
}
function rate(value: string): void {
  if (recordingId.value) void store.rateRecording(recordingId.value, value);
}
async function openRoleplay(): Promise<void> {
  try {
    roleplay.value = await createRoleplaySession();
    message.value = "预编角色扮演已打开；分支和回合由服务端脚本控制。";
  } catch (error) {
    message.value =
      error instanceof Error ? error.message : "角色扮演暂不可用。";
  }
}
async function advanceRoleplay(choiceCode?: string): Promise<void> {
  if (!roleplay.value || !currentRoleplayTurn.value) return;
  if (currentRoleplayTurn.value.recordingRequired && !recordingId.value) {
    message.value = "当前回合需要先完成并登记真实录音。";
    return;
  }
  try {
    const result = await submitRoleplayTurn(
      roleplay.value.roleplaySessionId,
      roleplay.value.turnIndex,
      recordingId.value ?? "",
      choiceCode,
    );
    roleplay.value = {
      ...roleplay.value,
      turnIndex: result.nextTurnIndex,
      status: result.status,
    };
    message.value =
      result.status === "COMPLETED"
        ? "角色扮演已完成，可查看并调整自评。"
        : "回合已保存，继续下一步。";
  } catch (error) {
    message.value =
      error instanceof Error ? error.message : "角色扮演回合提交失败。";
  }
}
</script>
<template>
  <section class="b3-page v2-page v2-page--b3speaking">
    <ExperienceHeader page="Speaking" icon="mic" title-id="speaking-title" />
    <p data-closed-practice role="status"><strong>跟读练习</strong><span data-coming-soon style="display:inline-block;margin-left:8px;padding:1px 8px;border-radius:999px;background:rgba(245,158,11,.16);color:#d97706;font-size:12px;font-weight:700;vertical-align:middle">即将开放</span><span data-closed-reason style="display:block;margin-top:4px;opacity:.8">跟读需要录音上传和发音评分服务，目前尚未接入，无法给出真实评分。</span></p>
    <a data-closed-back href="/today">回到可用学习</a>
    <div v-if="store.status === 'loading'" class="panel">
      正在读取 48 个音标条目…
    </div>
    <div v-else class="grid v2-b3speaking-main">
      <article class="panel">
        <div class="panel-head">
          <div>
            <p class="eyebrow">EN_48_PHASE1</p>
            <h3>{{ store.phonemes.length }} 个音标条目</h3>
          </div>
          <span class="fallback">Performance · SVG 2D</span>
        </div>
        <div class="phonemes">
          <button
            v-for="item in store.phonemes"
            :key="item.phonemeId"
            :class="{ active: selectedPhoneme?.phonemeId === item.phonemeId }"
            type="button"
            @click="selectPhoneme(item)"
          >
            <strong>{{ item.symbol }}</strong
            ><small>{{ item.group }}</small>
          </button>
        </div>
        <div v-if="minimalPairs.length" class="pairs">
          <p class="eyebrow">MINIMAL PAIRS</p>
          <span v-for="pair in minimalPairs" :key="pair.pairId"
            >{{ pair.leftWord }} ↔ {{ pair.rightWord }}</span
          >
        </div>
      </article>
      <article class="panel recorder">
        <p class="eyebrow">SHADOWING · 0.5s DELAY</p>
        <h3>Good habits help.</h3>
        <div class="mouth">
          <span
            >{{ selectedPhoneme?.symbol || "选择音标" }} · 2D mouth
            fallback</span
          ><b
            >下颌 {{ selectedPhoneme?.mouthProfile.jawOpen ?? 0 }} · 舌高
            {{ selectedPhoneme?.mouthProfile.tongueHeight ?? 0 }} · 唇圆
            {{ selectedPhoneme?.mouthProfile.lipRound ?? 0 }}</b
          ><small
            >{{ selectedPhoneme?.mouthProfile.voicing ? "声带振动" : "清音" }} ·
            {{
              selectedPhoneme?.mouthProfile.profileVersion || "mouth-v1"
            }}</small
          >
        </div>
        <div class="demo-audio" role="status" aria-live="polite">
          <p class="eyebrow">DEMO AUDIO</p>
          <audio
            v-if="demoAudioUrl"
            class="demo-audio-player"
            controls
            :src="demoAudioUrl"
            aria-label="示范音频"
          ></audio>
          <span v-else>{{ demoAudioMessage }}</span>
        </div>
        <div
          class="permission-banner"
          :class="`permission-banner--${permissionState}`"
          role="status"
        >
          <strong>MIC: {{ permissionState.toUpperCase() }}</strong>
          <span v-if="permissionState === 'denied' || permissionState === 'unsupported'">
            麦克风不可用；仍可继续音标、口型和文本跟读。
          </span>
          <span v-else>点击开始录音后才会请求麦克风权限。</span>
        </div>
        <p>{{ message }}</p>
        <div class="actions">
          <button v-if="!isRecording" type="button" @click="start">
            开始录音</button
          ><button v-else type="button" @click="recording?.stop()">
            停止录音</button
          ><button
            type="button"
            :disabled="!chunks.length || isRecording"
            @click="save"
          >
            加密并保存</button
          ><button type="button" @click="void startShadowing()">
            开始影子跟读</button
          ><button type="button" :disabled="!shadowing" @click="void saveShadowing()">
            保存跟读进度</button
          ><button v-if="recordingId" type="button" @click="replay">
            回放加密录音</button
          ><button v-if="recordingId" type="button" @click="remove">
            删除录音
          </button>
        </div>
        <div v-if="recordingId" class="saved">
          录音已保存：{{ recordingId }}
          <div class="rating">
            <button type="button" @click="rate('NEEDS_PRACTICE')">
              需要练习</button
            ><button type="button" @click="rate('BASIC')">基本可以</button
            ><button type="button" @click="rate('FLUENT')">很流畅</button>
          </div>
        </div>
        <div v-else class="rating rating--disabled" role="group" aria-label="自评">
          <span>完成真实录音并登记后可提交自评</span>
          <button type="button" disabled>需要练习</button>
          <button type="button" disabled>基本可以</button>
          <button type="button" disabled>很流畅</button>
        </div>
      </article>
    </div>
    <article class="panel roleplay-panel">
      <div class="panel-head">
        <div>
          <p class="eyebrow">ROLEPLAY · 预编脚本</p>
          <h3>咖啡店场景回合练习</h3>
        </div>
        <span class="fallback">服务端脚本校验</span>
      </div>
      <p>
        按提示完成对话，结束后可以自评。
      </p>
      <button type="button" @click="openRoleplay">
        {{ roleplay ? "重新打开咖啡店场景" : "开始角色扮演" }}
      </button>
      <div v-if="roleplay && currentRoleplayTurn" class="roleplay-turn">
        <strong
          >回合 {{ roleplay.turnIndex + 1 }} ·
          {{ currentRoleplayTurn.speaker }}</strong
        >
        <span>{{ currentRoleplayTurn.text }}</span>
        <button
          v-for="choice in currentRoleplayTurn.choiceCodes"
          :key="choice"
          type="button"
          @click="advanceRoleplay(choice)"
        >
          {{ choice }}
        </button>
        <button
          v-if="!currentRoleplayTurn.choiceCodes.length"
          type="button"
          :disabled="currentRoleplayTurn.recordingRequired && !recordingId"
          @click="advanceRoleplay()"
        >
          {{
            currentRoleplayTurn.recordingRequired
              ? "提交已登记录音并继续"
              : "继续"
          }}
        </button>
      </div>
      <p v-else-if="roleplay?.status === 'COMPLETED'" class="saved">
        已完成全部预编回合；无 AI 评分。
      </p>
      <p v-if="shadowing" class="saved">
        影子跟读已登记：{{ shadowing.shadowingSessionId }} · 延迟
        {{ shadowing.targetGapMs }}ms
      </p>
    </article>
  <aside class="v2-b3speaking-rail" aria-label="练习提示"><h2>口语练习</h2><ol><li>先听示范，再开始录音。</li><li>录完可回放，满意后再提交。</li></ol></aside>
  </section>
</template>
<style scoped>
.b3-page {
  display: grid;
  gap: 24px;
}
.hero {
  padding: 32px;
  border-radius: 28px;
  background: linear-gradient(135deg, var(--yx-color-text-primary), var(--yx-color-brand-primary));
  color: var(--yx-color-on-brand);
}
.hero h2 {
  margin: 8px 0;
  font-size: clamp(28px, 4vw, 46px);
}
.hero p:last-child {
  max-width: 620px;
  line-height: 1.7;
  color: var(--yx-color-brand-primary-soft);
}
.performance-note {
  margin: 12px 0 0;
  color: var(--yx-color-brand-primary-soft);
  font-size: 13px;
}
.eyebrow {
  font-size: 12px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--yx-color-text-secondary);
}
.hero .eyebrow {
  color: var(--yx-color-brand-primary-soft);
}
.grid {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
  gap: 20px;
}
.panel {
  min-width: 0;
  padding: 24px;
  border-radius: 22px;
  background:var(--yx-color-surface-card);
  box-shadow: 0 16px 40px color-mix(in srgb,var(--yx-color-text-primary) 5%, transparent);
}
.panel-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}
.panel h3 {
  margin: 5px 0 20px;
}
.fallback {
  padding: 6px 10px;
  border-radius: 99px;
  background: var(--yx-color-brand-primary-soft);
  color: var(--yx-color-brand-primary);
  font-size: 12px;
}
.phonemes {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}
.phonemes button {
  min-width: 0;
  display: grid;
  gap: 5px;
  padding: 14px;
  border: 1px solid var(--yx-color-brand-primary-soft);
  border-radius: 14px;
  background: var(--yx-color-brand-primary-soft);
  cursor: pointer;
}
.phonemes button.active {
  border-color: var(--yx-color-brand-primary);
  background: var(--yx-color-brand-primary-soft);
  box-shadow: 0 0 0 2px var(--yx-color-brand-primary-soft);
}
.phonemes strong {
  font-size: 28px;
  color: var(--yx-color-brand-primary);
}
.phonemes small {
  overflow-wrap: anywhere;
  color: var(--yx-color-text-secondary);
  font-size: 10px;
}
.pairs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 18px;
}
.pairs .eyebrow {
  width: 100%;
}
.pairs span {
  padding: 7px 10px;
  border-radius: 99px;
  background: var(--yx-color-brand-primary-soft);
  color: var(--yx-color-brand-primary);
}
.recorder {
  display: grid;
  align-content: start;
  gap: 12px;
}
.mouth {
  display: grid;
  place-items: center;
  gap: 12px;
  min-height: 160px;
  border-radius: 18px;
  background: linear-gradient(145deg, var(--yx-color-brand-primary-soft), var(--yx-color-brand-primary-soft));
  color: var(--yx-color-brand-primary);
}
.mouth b {
  font-size: 13px;
  color: var(--yx-color-success);
}
.mouth small {
  color: var(--yx-color-text-secondary);
}
.demo-audio,
.permission-banner {
  display: grid;
  gap: 8px;
  padding: 12px;
  border: 1px solid var(--yx-color-brand-primary-soft);
  border-radius: 14px;
  background: var(--yx-color-brand-primary-soft);
}
.demo-audio p {
  margin: 0;
}
.demo-audio span,
.permission-banner span {
  color: var(--yx-color-text-secondary);
  line-height: 1.5;
}
.demo-audio-player {
  width: 100%;
  max-width: 100%;
}
.permission-banner--denied,
.permission-banner--unsupported {
  border-color: var(--yx-color-danger);
}
.permission-banner--granted {
  border-color: var(--yx-color-success);
}
.actions,
.rating {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.actions button,
.rating button {
  padding: 11px 14px;
  border: 0;
  border-radius: 12px;
  background: var(--yx-color-brand-primary);
  color: var(--yx-color-on-brand);
  cursor: pointer;
}
.actions button:disabled {
  opacity: 0.45;
}
.actions button:nth-child(2) {
  background: var(--yx-color-danger);
}
.actions button:nth-child(3) {
  background: var(--yx-color-success);
}
.saved {
  padding: 14px;
  border-radius: 14px;
  background: var(--yx-color-brand-primary-soft);
  color: var(--yx-color-brand-primary);
  word-break: break-all;
}
.rating--disabled {
  display: grid;
  gap: 8px;
  color: var(--yx-color-text-secondary);
}
.rating--disabled button {
  cursor: not-allowed;
  opacity: 0.45;
}
.roleplay-panel {
  display: grid;
  gap: 12px;
}
.roleplay-panel > button,
.roleplay-turn button {
  width: fit-content;
  padding: 11px 14px;
  border: 0;
  border-radius: 12px;
  background: var(--yx-color-brand-primary);
  color: var(--yx-color-on-brand);
  cursor: pointer;
}
.roleplay-panel > button:disabled,
.roleplay-turn button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.roleplay-turn {
  display: grid;
  gap: 10px;
  padding: 16px;
  border-radius: 16px;
  background: var(--yx-color-brand-primary-soft);
  color: var(--yx-color-brand-primary);
}
.roleplay-turn button {
  background:var(--yx-color-surface-card);
  color: var(--yx-color-brand-primary);
  border: 1px solid var(--yx-color-brand-primary-soft);
}
.rating button {
  background:var(--yx-color-surface-card);
  color: var(--yx-color-brand-primary);
  border: 1px solid var(--yx-color-brand-primary-soft);
}
@media (max-width: 760px) {
  .grid {
    grid-template-columns: 1fr;
  }
  .phonemes {
    grid-template-columns: repeat(4, 1fr);
  }
  .hero {
    padding: 24px;
  }
}
</style>

<style>
/* B3Speaking v2 页面级样式（只做样式）：对齐 webDemo“专项练习会话（左主练习卡 + 右侧提示栏）”原型。
 * 选择器全部以 .v2-page--b3speaking 开头；颜色只用 --v2-* tokens，不写死色值以适配暗色。 */
.v2-page--b3speaking.v2-page{background:var(--v2-bg);color:var(--v2-ink);font-family:var(--v2-font);display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:var(--v2-space-5);align-items:start}
.v2-page--b3speaking .experience-heading{grid-column:1/-1;min-width:0}
.v2-page--b3speaking [data-closed-practice]{grid-column:1/-1;margin:0;padding:var(--v2-space-3) var(--v2-space-4);border-radius:var(--v2-radius-md);background:var(--v2-soft);color:var(--v2-mut);font-size:var(--v2-text-sm);line-height:1.6}
.v2-page--b3speaking [data-closed-back]{grid-column:1/-1;width:max-content;color:var(--v2-brand);font-size:var(--v2-text-sm);font-weight:600}
.v2-page--b3speaking .v2-b3speaking-main{grid-column:1;display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,0.9fr);gap:var(--v2-space-5);min-width:0}
.v2-page--b3speaking > .panel{grid-column:1;min-width:0}
.v2-page--b3speaking .panel,.v2-page--b3speaking .roleplay-panel,.v2-page--b3speaking .v2-b3speaking-rail{background:var(--v2-card);border:1px solid var(--v2-line);border-radius:var(--v2-radius-lg);box-shadow:var(--v2-shadow);padding:var(--v2-space-6);min-width:0}
.v2-page--b3speaking .roleplay-panel{grid-column:1;display:grid;gap:var(--v2-space-3);align-content:start}
.v2-page--b3speaking .roleplay-panel > p{margin:0;color:var(--v2-mut);font-size:var(--v2-text-sm);line-height:1.6}
.v2-page--b3speaking .roleplay-panel > button{width:max-content;max-width:100%}
.v2-page--b3speaking .v2-b3speaking-rail{grid-column:2;grid-row:4 / span 2;position:sticky;top:var(--v2-space-6);display:grid;align-content:start;gap:var(--v2-space-3)}
.v2-page--b3speaking .v2-b3speaking-rail h2{margin:0;font-size:var(--v2-text-lg);color:var(--v2-ink)}
.v2-page--b3speaking .v2-b3speaking-rail ol{margin:0;padding-left:var(--v2-space-5);color:var(--v2-mut);font-size:var(--v2-text-sm);line-height:1.7}
.v2-page--b3speaking .panel-head{display:flex;justify-content:space-between;align-items:flex-start;gap:var(--v2-space-4)}
.v2-page--b3speaking .panel h3{margin:var(--v2-space-1) 0 var(--v2-space-5);font-size:var(--v2-text-lg);color:var(--v2-ink)}
.v2-page--b3speaking .eyebrow{margin:0;color:var(--v2-brand);font-size:var(--v2-text-xs);font-weight:800;letter-spacing:.12em}
.v2-page--b3speaking .fallback{padding:var(--v2-space-1) var(--v2-space-3);border-radius:var(--v2-radius-pill);background:var(--v2-soft);color:var(--v2-brand);font-size:var(--v2-text-xs);font-weight:600;white-space:nowrap}
.v2-page--b3speaking .phonemes{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:var(--v2-space-2)}
.v2-page--b3speaking .phonemes button{display:grid;gap:var(--v2-space-1);min-width:0;padding:var(--v2-space-4);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);background:var(--v2-soft);color:var(--v2-ink);cursor:pointer}
.v2-page--b3speaking .phonemes button.active{border-color:var(--v2-brand);background:var(--v2-card);color:var(--v2-brand);box-shadow:var(--v2-shadow)}
.v2-page--b3speaking .phonemes strong{font-size:var(--v2-text-xl);color:var(--v2-brand)}
.v2-page--b3speaking .phonemes small{color:var(--v2-mut);font-size:var(--v2-text-xs);overflow-wrap:anywhere}
.v2-page--b3speaking .pairs{display:flex;flex-wrap:wrap;gap:var(--v2-space-2);margin-top:var(--v2-space-5)}
.v2-page--b3speaking .pairs .eyebrow{width:100%}
.v2-page--b3speaking .pairs span{padding:var(--v2-space-1) var(--v2-space-3);border-radius:var(--v2-radius-pill);background:var(--v2-soft);color:var(--v2-brand);font-size:var(--v2-text-xs);font-weight:600}
.v2-page--b3speaking .recorder{display:grid;align-content:start;gap:var(--v2-space-3)}
.v2-page--b3speaking .recorder h3{margin:var(--v2-space-1) 0 0;font-size:var(--v2-text-xl);color:var(--v2-ink)}
.v2-page--b3speaking .recorder > p:not(.eyebrow){margin:0;color:var(--v2-mut);font-size:var(--v2-text-sm);line-height:1.6}
.v2-page--b3speaking .mouth{display:grid;place-items:center;gap:var(--v2-space-3);min-height:160px;padding:var(--v2-space-4);border-radius:var(--v2-radius-md);background:var(--v2-grad-soft);color:var(--v2-ink);text-align:center}
.v2-page--b3speaking .mouth span{color:var(--v2-ink);font-size:var(--v2-text-sm)}
.v2-page--b3speaking .mouth b{font-size:var(--v2-text-sm);color:var(--v2-ok)}
.v2-page--b3speaking .mouth small{color:var(--v2-mut);font-size:var(--v2-text-xs)}
.v2-page--b3speaking .demo-audio,.v2-page--b3speaking .permission-banner{display:grid;gap:var(--v2-space-2);padding:var(--v2-space-3);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);background:var(--v2-surface)}
.v2-page--b3speaking .demo-audio p{margin:0}
.v2-page--b3speaking .demo-audio span,.v2-page--b3speaking .permission-banner span{color:var(--v2-mut);font-size:var(--v2-text-sm);line-height:1.5}
.v2-page--b3speaking .demo-audio-player{width:100%;max-width:100%}
.v2-page--b3speaking .permission-banner strong{color:var(--v2-ink);font-size:var(--v2-text-sm)}
.v2-page--b3speaking .permission-banner--denied,.v2-page--b3speaking .permission-banner--unsupported{border-color:var(--v2-bad)}
.v2-page--b3speaking .permission-banner--granted{border-color:var(--v2-ok)}
.v2-page--b3speaking .actions,.v2-page--b3speaking .rating{display:flex;flex-wrap:wrap;gap:var(--v2-space-2)}
.v2-page--b3speaking .actions button,.v2-page--b3speaking .rating button,.v2-page--b3speaking .roleplay-panel > button,.v2-page--b3speaking .roleplay-turn button{min-height:38px;padding:0 var(--v2-space-3);border:0;border-radius:var(--v2-radius-sm);background:var(--v2-brand);color:var(--v2-inverse);font-weight:750;cursor:pointer}
.v2-page--b3speaking .actions button:nth-child(2){background:var(--v2-bad);color:var(--v2-inverse)}
.v2-page--b3speaking .actions button:nth-child(3){background:var(--v2-ok);color:var(--v2-inverse)}
.v2-page--b3speaking .rating button,.v2-page--b3speaking .roleplay-turn button{background:var(--v2-soft);color:var(--v2-brand);border:1px solid var(--v2-line)}
.v2-page--b3speaking .actions button:disabled,.v2-page--b3speaking .rating button:disabled,.v2-page--b3speaking .roleplay-turn button:disabled{opacity:.5;cursor:not-allowed}
.v2-page--b3speaking .actions button:first-child:hover:not(:disabled),.v2-page--b3speaking .roleplay-panel > button:hover:not(:disabled){background:var(--v2-brand2)}
.v2-page--b3speaking .saved{padding:var(--v2-space-4);border-radius:var(--v2-radius-md);background:var(--v2-soft);color:var(--v2-brand);font-size:var(--v2-text-sm);line-height:1.6;overflow-wrap:anywhere}
.v2-page--b3speaking .saved .rating{margin-top:var(--v2-space-2)}
.v2-page--b3speaking .rating--disabled{display:grid;gap:var(--v2-space-2);color:var(--v2-mut);font-size:var(--v2-text-sm)}
.v2-page--b3speaking .rating--disabled button{cursor:not-allowed;opacity:.45}
.v2-page--b3speaking .roleplay-turn{display:grid;gap:var(--v2-space-3);padding:var(--v2-space-4);border-radius:var(--v2-radius-md);background:var(--v2-surface);color:var(--v2-ink)}
.v2-page--b3speaking .roleplay-turn strong{color:var(--v2-ink);font-size:var(--v2-text-sm)}
.v2-page--b3speaking .roleplay-turn span{color:var(--v2-mut);font-size:var(--v2-text-sm);line-height:1.6}
.v2-page--b3speaking .roleplay-turn button{width:max-content;max-width:100%}
.v2-page--b3speaking .progress{height:6px;border-radius:var(--v2-radius-pill);background:var(--v2-surface);overflow:hidden}
.v2-page--b3speaking .progress span{display:block;height:100%;background:var(--v2-brand)}
.v2-page--b3speaking progress{width:100%;height:6px;accent-color:var(--v2-brand)}
.v2-page--b3speaking [role="progressbar"]{height:6px;background:var(--v2-surface);border-radius:var(--v2-radius-pill);overflow:hidden}
.v2-page--b3speaking input[type="range"]{width:100%;accent-color:var(--v2-brand)}
.v2-page--b3speaking button:focus-visible,.v2-page--b3speaking a:focus-visible,.v2-page--b3speaking input:focus-visible{outline:2px solid var(--v2-brand);outline-offset:2px}
@media(max-width:1190px){.v2-page--b3speaking.v2-page{grid-template-columns:minmax(0,1fr) 250px}.v2-page--b3speaking .v2-b3speaking-main{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}}
@media(max-width:900px){.v2-page--b3speaking.v2-page{grid-template-columns:1fr}.v2-page--b3speaking .experience-heading,.v2-page--b3speaking [data-closed-practice],.v2-page--b3speaking [data-closed-back],.v2-page--b3speaking .v2-b3speaking-main,.v2-page--b3speaking > .panel,.v2-page--b3speaking .roleplay-panel{grid-column:1}.v2-page--b3speaking .v2-b3speaking-main{grid-template-columns:1fr}.v2-page--b3speaking .v2-b3speaking-rail{grid-column:1;grid-row:auto;position:static}.v2-page--b3speaking .panel-head{flex-direction:column;align-items:flex-start}}
</style>
