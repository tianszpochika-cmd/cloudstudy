<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import {
  createRecording,
  createRoleplaySession,
  createShadowingSession,
  deleteRecording,
  listMinimalPairs,
  submitRoleplayTurn,
  updateShadowingProgress,
} from "../api/b3";
import type {
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
const currentRoleplayTurn = computed(
  () => roleplay.value?.turns[roleplay.value.turnIndex] ?? null,
);
const message = ref(
  "Phase 1 不提供 AI 发音评分；录音先在本地使用 AES-GCM-256 加密，再登记 SHA-256 元数据。",
);

onMounted(async () => {
  await store.loadPhonetics();
  selectedPhoneme.value = store.phonemes[0] ?? null;
  try {
    minimalPairs.value = await listMinimalPairs();
  } catch {
    minimalPairs.value = [];
  }
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
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
    message.value = "麦克风权限未开启，辨音和口型学习仍可继续。";
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
      shadowing.value = await createShadowingSession("seg-1");
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
        ? "角色扮演完成；Phase 1 只记录回合和自评，不生成 AI 分数。"
        : "回合已保存，继续下一步。";
  } catch (error) {
    message.value =
      error instanceof Error ? error.message : "角色扮演回合提交失败。";
  }
}
</script>
<template>
  <section class="b3-page">
    <div class="hero">
      <p class="eyebrow">B3 · SPEAKING SELF-PRACTICE</p>
      <h2>练节奏，不伪造分数。</h2>
      <p>
        48 音标、口型参数、影子跟读和用户自评在 Phase 1
        只提供可回放、可解释的规则边界。
      </p>
      <p class="performance-note">
        性能档位：{{ store.performanceLevel }} · 口型渲染：SVG 2D fallback
      </p>
    </div>
    <div v-if="store.status === 'loading'" class="panel">
      正在读取 48 个音标条目…
    </div>
    <div v-else class="grid">
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
        分支选项、回合顺序和需要录音的回合由服务端控制；Phase 1 不生成 AI 评分。
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
  background: linear-gradient(135deg, #20345d, #774bd2);
  color: #fff;
}
.hero h2 {
  margin: 8px 0;
  font-size: clamp(28px, 4vw, 46px);
}
.hero p:last-child {
  max-width: 620px;
  line-height: 1.7;
  color: #e8ddff;
}
.performance-note {
  margin: 12px 0 0;
  color: #d6c8ff;
  font-size: 13px;
}
.eyebrow {
  font-size: 12px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #7b83a1;
}
.hero .eyebrow {
  color: #d6c8ff;
}
.grid {
  display: grid;
  grid-template-columns: 1.1fr 0.9fr;
  gap: 20px;
}
.panel {
  padding: 24px;
  border-radius: 22px;
  background: #fff;
  box-shadow: 0 16px 40px #1f2b4b0d;
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
  background: #eee9ff;
  color: #704bb2;
  font-size: 12px;
}
.phonemes {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}
.phonemes button {
  display: grid;
  gap: 5px;
  padding: 14px;
  border: 1px solid #e5e3f1;
  border-radius: 14px;
  background: #fbfaff;
  cursor: pointer;
}
.phonemes button.active {
  border-color: #6450c7;
  background: #eee9ff;
  box-shadow: 0 0 0 2px #d8cdfb;
}
.phonemes strong {
  font-size: 28px;
  color: #4b3a83;
}
.phonemes small {
  color: #8a879a;
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
  background: #f5f0ff;
  color: #704bb2;
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
  background: linear-gradient(145deg, #f0efff, #e5f6ff);
  color: #6254a3;
}
.mouth b {
  font-size: 13px;
  color: #2b7891;
}
.mouth small {
  color: #7c7597;
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
  background: #6450c7;
  color: #fff;
  cursor: pointer;
}
.actions button:disabled {
  opacity: 0.45;
}
.actions button:nth-child(2) {
  background: #df7094;
}
.actions button:nth-child(3) {
  background: #4e9f8a;
}
.saved {
  padding: 14px;
  border-radius: 14px;
  background: #f1edff;
  color: #57418d;
  word-break: break-all;
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
  background: #6450c7;
  color: #fff;
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
  background: #f5f0ff;
  color: #4b3a83;
}
.roleplay-turn button {
  background: #fff;
  color: #5b4b99;
  border: 1px solid #d9d0fb;
}
.rating button {
  background: #fff;
  color: #5b4b99;
  border: 1px solid #d9d0fb;
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
