<script setup lang="ts">
import { ui } from "../platform/experience";
import AdminPageIntro from "../components/AdminPageIntro.vue";
import { computed, onMounted, ref } from "vue";
import {
  listPhonemes,
  listPhoneticPairs,
  phoneticsPack,
  type PhonemeRow,
  type MinimalPairRow,
} from "../api/phonetics";
import {
  itemLifecycle,
  itemReview,
  listItems,
  upsertItem,
  type ContentItemRow,
} from "../api/content-items";
import {
  decisionLabel,
  explainContentError,
  isOwnSubmission,
  isRejection,
  isVersionConflict,
} from "../platform/content-review";
import { ElMessage, ElMessageBox } from "element-plus";
import { useAdminStore } from "../stores/admin";

type ViewState = "loading" | "ready" | "empty" | "permission" | "error";

const session = useAdminStore();
const language = ref("");
const phonemes = ref<PhonemeRow[]>([]);
const pairs = ref<MinimalPairRow[]>([]);
const state = ref<ViewState>("loading");
const lastError = ref<string | null>(null);

const canRead = computed(() => session.can("admin.content.read"));
const canWrite = computed(() => session.can("admin.content.write"));
const canPublish = computed(() => session.can("admin.content.publish"));

// ---- Maintenance (content-ops capability 6): PHONEME / MINIMAL_PAIR rows on the item lifecycle.
type PhoneticKind = "PHONEME" | "MINIMAL_PAIR";
const maintained = ref<ContentItemRow[]>([]);
const maintainError = ref<string | null>(null);
const editorVisible = ref(false);
const editorBusy = ref(false);
const editorBase = ref<ContentItemRow | null>(null);
const form = ref({
  kind: "PHONEME" as PhoneticKind,
  symbol: "",
  group: "",
  exampleWord: "",
  description: "",
  leftWord: "",
  rightWord: "",
});
const pack = computed(() => phoneticsPack(language.value));

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "草稿",
  IN_REVIEW: "审核中",
  APPROVED: "已通过",
  PUBLISHED: "已发布",
  ARCHIVED: "已归档",
};

function rowSummary(row: ContentItemRow): string {
  const f = row.fields;
  return row.kind === "PHONEME"
    ? `${String(f.symbol ?? "")} · ${String(f.group ?? "")}${f.exampleWord ? ` · ${String(f.exampleWord)}` : ""}`
    : `${String(f.leftWord ?? "")} ↔ ${String(f.rightWord ?? "")}`;
}

function trailText(row: ContentItemRow): string {
  const trail = row.reviewTrail;
  if (row.availability === "IN_REVIEW" && trail.submittedBy) return `待审 · 提交人 ${trail.submittedBy}`;
  if (isRejection(trail))
    return `${decisionLabel(trail.lastDecision)}（${trail.lastReviewer ?? ""}）：${trail.lastNote ?? ""}`;
  return decisionLabel(trail.lastDecision);
}

function ownSubmission(row: ContentItemRow): boolean {
  return isOwnSubmission(row.reviewTrail, session.principal?.subject);
}

async function loadMaintained(): Promise<void> {
  maintainError.value = null;
  try {
    maintained.value = (await listItems({ packCode: pack.value, limit: 100 })).rows;
  } catch (error) {
    maintained.value = [];
    maintainError.value = explainContentError(error, "维护列表读取失败。");
  }
}

function openEditor(row?: ContentItemRow): void {
  editorBase.value = row ?? null;
  const f = row?.fields ?? {};
  form.value = {
    kind: (row?.kind as PhoneticKind) ?? "PHONEME",
    symbol: String(f.symbol ?? ""),
    group: String(f.group ?? ""),
    exampleWord: String(f.exampleWord ?? ""),
    description: String(f.description ?? ""),
    leftWord: String(f.leftWord ?? ""),
    rightWord: String(f.rightWord ?? ""),
  };
  editorVisible.value = true;
}

async function saveEditor(): Promise<void> {
  if (editorBusy.value) return;
  const v = form.value;
  const fields: Record<string, unknown> =
    v.kind === "PHONEME"
      ? { symbol: v.symbol.trim(), group: v.group.trim().toUpperCase(), exampleWord: v.exampleWord.trim(), description: v.description.trim() }
      : { leftWord: v.leftWord.trim(), rightWord: v.rightWord.trim() };
  editorBusy.value = true;
  try {
    await upsertItem(
      pack.value,
      {
        itemId: editorBase.value?.itemId,
        kind: v.kind,
        stem: v.kind === "PHONEME" ? v.symbol.trim() : `${v.leftWord.trim()} / ${v.rightWord.trim()}`,
        fields,
      },
      editorBase.value?.stateVersion,
    );
    editorVisible.value = false;
    ElMessage.success(editorBase.value?.availability === "PUBLISHED" ? "已创建修订稿，审核发布后替换线上版本。" : "已保存为草稿。");
    await loadMaintained();
  } catch (error) {
    if (isVersionConflict(error)) {
      ElMessage.error("这条音标在你打开后已被他人修改，已为你重新加载，请重新编辑。");
      editorVisible.value = false;
      await loadMaintained();
    } else {
      ElMessage.error(explainContentError(error, "保存失败。"));
    }
  } finally {
    editorBusy.value = false;
  }
}

async function act(
  row: ContentItemRow,
  command: "ITEM_SUBMIT_REVIEW" | "ITEM_PUBLISH" | "ITEM_UNPUBLISH",
): Promise<void> {
  try {
    const result = await itemLifecycle(row, command);
    const projection = String((result as Record<string, unknown>).learnerProjection ?? "");
    if (projection === "PACK_NOT_PUBLISHED")
      ElMessage.warning("条目已发布，但该语言的音标包还没有正式发布版本，学员端暂不可见。");
    else ElMessage.success("已提交。");
    await Promise.all([loadMaintained(), load()]);
  } catch (error) {
    ElMessage.error(explainContentError(error, "操作失败。"));
  }
}

async function review(row: ContentItemRow, stage: "FIRST" | "FINAL", approve: boolean): Promise<void> {
  let note: string | undefined;
  if (!approve) {
    try {
      const result = await ElMessageBox.prompt("退回给作者修改，请写清楚原因。", stage === "FIRST" ? "一审退回" : "二审退回", {
        confirmButtonText: "退回",
        cancelButtonText: "取消",
        inputType: "textarea",
        inputValidator: (value: string) =>
          (value?.trim().length ?? 0) > 0 && value.trim().length <= 500 ? true : "请填写 1 到 500 字的退回原因",
      });
      note = (result as { value: string }).value.trim();
    } catch {
      return;
    }
  }
  try {
    await itemReview(row, stage, approve ? "APPROVED" : "CHANGES_REQUESTED", note);
    ElMessage.success(approve ? "审核已通过。" : "已退回。");
    await loadMaintained();
  } catch (error) {
    ElMessage.error(explainContentError(error, "审核失败。"));
  }
}

const LANGUAGES = [
  { value: "", label: "英语（默认 48 音素）" },
  { value: "fr-FR", label: "法语（37 音素）" },
];

const groupSummary = computed(() => {
  const counts = new Map<string, number>();
  phonemes.value.forEach((row) =>
    counts.set(row.group, (counts.get(row.group) ?? 0) + 1),
  );
  return [...counts.entries()]
    .map(([group, count]) => `${group} ${count}`)
    .join(" · ");
});

function mouthSummary(row: PhonemeRow): string {
  const profile = row.mouthProfile;
  if (!profile || typeof profile !== "object") return "—（可空）";
  return "mouth-v1";
}

async function load(): Promise<void> {
  if (!canRead.value) {
    state.value = "permission";
    lastError.value = "当前会话没有内容读取权限。";
    return;
  }
  state.value = "loading";
  lastError.value = null;
  try {
    const lang = language.value || undefined;
    const [phonemeRows, pairRows] = await Promise.all([
      listPhonemes(lang),
      listPhoneticPairs(lang),
    ]);
    phonemes.value = phonemeRows;
    pairs.value = pairRows;
    state.value = phonemeRows.length ? "ready" : "empty";
    void loadMaintained();
  } catch (error) {
    state.value = "error";
    lastError.value =
      error instanceof Error ? error.message : "音标库读取失败。";
  }
}

onMounted(() => {
  void load();
});
</script>

<template>
  <div class="view-stack">
    <div class="phonetics-page">
    <AdminPageIntro></AdminPageIntro>

    <el-card shadow="never">
      <el-space wrap class="phonetics-toolbar">
        <el-select
          v-model="language"
          placeholder="语言"
          style="width: 220px"
          @change="load()"
        >
          <el-option
            v-for="lang in LANGUAGES"
            :key="lang.value"
            :label="lang.label"
            :value="lang.value"
          />
        </el-select>
        <el-button :disabled="!canRead" @click="load()">刷新</el-button>
        <el-button type="primary" :disabled="!canWrite" @click="openEditor()">新建音素 / 对立对</el-button>
        <span v-if="groupSummary" class="admin-header__eyebrow">{{
          groupSummary
        }}</span>
      </el-space>
    </el-card>

    <el-alert
      v-if="state === 'permission'"
      title="当前会话没有内容读取权限"
      type="warning"
      :closable="false"
      show-icon
    />
    <el-alert
      v-else-if="state === 'error'"
      :title="lastError ?? '音标数据暂时不可用'"
      type="error"
      :closable="false"
      show-icon
    />

    <el-card shadow="never" class="phonetics-list">
      <template #header><div class="card-header"><span>音素</span><el-tag>{{ phonemes.length }} 条</el-tag></div></template>
      <el-skeleton v-if="state === 'loading'" :rows="5" animated /><el-table
        v-else-if="phonemes.length && state === 'ready'"
        :data="phonemes"
        stripe
      >
        <el-table-column prop="symbol" label="音素" width="100" />
        <el-table-column prop="group" label="分组" width="170" />
        <el-table-column prop="exampleWord" label="例词" min-width="140" />
        <el-table-column
          prop="description"
          label="说明"
          min-width="220"
          show-overflow-tooltip
        />
        <el-table-column label="口型" width="120">
          <template #default="scope">{{ mouthSummary(scope.row) }}</template>
        </el-table-column>
        <el-table-column label="学员可见" width="110">
          <template #default="scope">
            <el-tag :type="scope.row.learnerVisible ? 'success' : 'info'" size="small">{{
              scope.row.learnerVisible ? "可见" : scope.row.availability === "PUBLISHED" ? "待正式版本" : "已下线"
            }}</el-tag>
          </template>
        </el-table-column>
      </el-table>
      <el-empty
        v-else-if="state === 'empty'"
        :description="ui('empty')"
      /><el-button v-else @click="load()">{{ ui("retry") }}</el-button>
    </el-card>

    <el-card v-if="pairs.length" shadow="never" class="phonetics-pairs">
      <template #header
        ><span>最小对立对（{{ pairs.length }}）</span></template
      >
      <el-space wrap class="phonetics-pair-grid">
        <el-tag v-for="pair in pairs" :key="String(pair.pairId)" effect="plain">
          {{ String(pair.leftWord ?? "") }} ↔ {{ String(pair.rightWord ?? "") }}
        </el-tag>
      </el-space>
    </el-card>

    <el-card shadow="never" class="phonetics-maintain">
      <template #header
        ><div class="card-header"><span>音标维护（{{ pack }}）</span><el-tag>{{ maintained.length }} 条</el-tag></div></template
      >
      <el-alert v-if="maintainError" :title="maintainError" type="error" :closable="false" show-icon />
      <el-table v-else-if="maintained.length" :data="maintained" size="small">
        <el-table-column label="类型" width="110">
          <template #default="{ row }">{{ row.kind === "PHONEME" ? "音素" : "最小对立对" }}</template>
        </el-table-column>
        <el-table-column label="内容" min-width="180">
          <template #default="{ row }">{{ rowSummary(row) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            {{ STATUS_LABEL[row.availability] ?? row.availability }}
            <el-tag v-if="row.reviewTrail.revisionOfLive" size="small" type="warning">修订中</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="审核意见" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">{{ trailText(row) }}</template>
        </el-table-column>
        <el-table-column label="操作" min-width="320">
          <template #default="{ row }">
            <el-button
              v-if="row.availability !== 'IN_REVIEW' && row.availability !== 'ARCHIVED'"
              size="small" :disabled="!canWrite" @click="openEditor(row)"
              >{{ row.availability === "PUBLISHED" || row.availability === "APPROVED" ? "修订" : "编辑" }}</el-button
            >
            <el-button v-if="row.availability === 'DRAFT'" size="small" :disabled="!canWrite" @click="act(row, 'ITEM_SUBMIT_REVIEW')">送审</el-button>
            <template v-if="row.availability === 'IN_REVIEW'">
              <el-tooltip :disabled="!ownSubmission(row)" content="你是作者，不能审核自己的提交" placement="top">
                <span>
                  <el-button size="small" type="success" :disabled="ownSubmission(row)"
                    @click="review(row, row.firstReviewer ? 'FINAL' : 'FIRST', true)"
                    >{{ row.firstReviewer ? "二审通过" : "一审通过" }}</el-button
                  >
                  <el-button size="small" type="danger" :disabled="ownSubmission(row)"
                    @click="review(row, row.firstReviewer ? 'FINAL' : 'FIRST', false)">退回</el-button>
                </span>
              </el-tooltip>
            </template>
            <el-button v-if="row.availability === 'APPROVED'" size="small" type="primary" :disabled="!canPublish" @click="act(row, 'ITEM_PUBLISH')">发布</el-button>
            <el-button v-if="row.availability === 'PUBLISHED'" size="small" :disabled="!canPublish" @click="act(row, 'ITEM_UNPUBLISH')">下线</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-else description="还没有维护中的音标条目" />
    </el-card>

    <el-dialog v-model="editorVisible" :title="editorBase ? '编辑音标条目' : '新建音标条目'" width="520px">
      <el-form label-width="96px">
        <el-form-item label="类型">
          <el-radio-group v-model="form.kind" :disabled="!!editorBase">
            <el-radio-button value="PHONEME">音素</el-radio-button>
            <el-radio-button value="MINIMAL_PAIR">最小对立对</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <template v-if="form.kind === 'PHONEME'">
          <el-form-item label="音标符号" required><el-input v-model="form.symbol" maxlength="16" /></el-form-item>
          <el-form-item label="分组" required><el-input v-model="form.group" placeholder="如 MONOPHTHONG / CONSONANT" maxlength="32" /></el-form-item>
          <el-form-item label="例词"><el-input v-model="form.exampleWord" maxlength="64" /></el-form-item>
          <el-form-item label="说明"><el-input v-model="form.description" type="textarea" maxlength="500" /></el-form-item>
        </template>
        <template v-else>
          <el-form-item label="左词" required><el-input v-model="form.leftWord" maxlength="64" /></el-form-item>
          <el-form-item label="右词" required><el-input v-model="form.rightWord" maxlength="64" /></el-form-item>
        </template>
      </el-form>
      <template #footer>
        <el-button @click="editorVisible = false">取消</el-button>
        <el-button type="primary" :loading="editorBusy" @click="saveEditor()">保存草稿</el-button>
      </template>
    </el-dialog>
    </div>
  </div>
</template>
