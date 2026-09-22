<script setup lang="ts">
import { useEditorGuard } from "../platform/editor-guard";
import { ui } from "../platform/experience";
import AdminPageIntro from "../components/AdminPageIntro.vue";
import { computed, onMounted, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  listLexemes,
  upsertLexeme,
  lexemeLifecycle,
  lexemeReview,
  upsertPronunciation,
  qcPronunciation,
  LEXEME_PACK,
  type LexemeFields,
  type LexemeRow,
} from "../api/lexeme";
import { useAdminStore } from "../stores/admin";
import SchedulePanel from "../components/SchedulePanel.vue";
import AudioPreview from "../components/AudioPreview.vue";

type ViewState = "loading" | "ready" | "empty" | "permission" | "error";

const session = useAdminStore();
const rows = ref<LexemeRow[]>([]);
const state = ref<ViewState>("loading");
const lastError = ref<string | null>(null);
const nextCursor = ref<string | null>(null);
const loadingMore = ref(false);

const q = ref("");
const cefr = ref("");
const availability = ref("");
const packCode = ref(LEXEME_PACK);
const language = ref("");

const canRead = computed(() => session.can("admin.content.read"));
const canWrite = computed(() => session.can("admin.content.write"));
const canPublish = computed(() => session.can("admin.content.publish"));

const dialogVisible = ref(false);
const editing = ref<LexemeRow | null>(null);
const form = ref<LexemeFields>({ headword: "" });
const formBusy = ref(false);
const closeEditor = useEditorGuard(
  dialogVisible,
  () => JSON.stringify(form.value),
  formBusy,
);

const pronVisible = ref(false);
const pronTarget = ref<LexemeRow | null>(null);
const pronForm = ref({
  accent: "US",
  ipa: "",
  audioAssetId: "",
  sourceType: "HUMAN",
});
const pronBusy = ref(false);

const diffVisible = ref(false);
const diffTarget = ref<LexemeRow | null>(null);

interface DiffLine {
  path: string;
  before: string;
  after: string;
}
const diffLines = ref<DiffLine[]>([]);

function stringify(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value || "—";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function buildDiff(
  before: unknown,
  after: unknown,
  prefix: string,
  out: DiffLine[],
): void {
  if (JSON.stringify(before) === JSON.stringify(after)) return;
  if (
    typeof before === "object" &&
    before !== null &&
    !Array.isArray(before) &&
    typeof after === "object" &&
    after !== null &&
    !Array.isArray(after)
  ) {
    const keys = new Set([
      ...Object.keys(before as object),
      ...Object.keys(after as object),
    ]);
    keys.forEach((key) => {
      buildDiff(
        (before as Record<string, unknown>)[key],
        (after as Record<string, unknown>)[key],
        prefix ? `${prefix}.${key}` : key,
        out,
      );
    });
    return;
  }
  out.push({
    path: prefix || "(root)",
    before: stringify(before),
    after: stringify(after),
  });
}

function openDiff(row: LexemeRow): void {
  diffTarget.value = row;
  const lines: DiffLine[] = [];
  if (!row.publishedFields) {
    lines.push({
      path: "(snapshot)",
      before: "从未发布",
      after: "当前草稿即首版",
    });
  } else {
    buildDiff(row.publishedFields, row.fields, "", lines);
    if (!lines.length)
      lines.push({ path: "(equal)", before: "与已发布一致", after: "无差异" });
  }
  diffLines.value = lines.slice(0, 200);
  diffVisible.value = true;
}

const scheduleTargets = computed(() => [
  { type: "PACK" as const, ref: LEXEME_PACK, label: `词包 ${LEXEME_PACK}` },
  ...rows.value
    .filter((row) => row.availability === "APPROVED")
    .slice(0, 50)
    .map((row) => ({
      type: "LEXEME" as const,
      ref: row.lexemeId,
      label: `单词 ${row.headword}`,
    })),
]);

const CEFRS = ["", "A1", "A2", "B1", "B2", "C1", "C2"];
const STATES = ["", "DRAFT", "IN_REVIEW", "APPROVED", "PUBLISHED", "ARCHIVED"];
const LANGUAGES = ["", "en-US", "fr-FR", "de-DE"];
const PACKS = ["VOCAB-PHASE1", "VOCAB-FR-PHASE1", "VOCAB-DE-PHASE1"];
const POS_OPTIONS = [
  "NOUN",
  "VERB",
  "ADJ",
  "ADV",
  "PRON",
  "PREP",
  "CONJ",
  "INTERJ",
  "PHRASE",
  "ARTICLE",
  "PRONOUN",
  "DETERMINER",
  "PREPOSITION",
  "CONJUNCTION",
  "INTERJECTION",
  "NUMERAL",
  "PARTICLE",
];
const GENDERS = ["", "MASCULINE", "FEMININE", "NEUTER"];
const NUMBERS = ["", "SINGULAR", "PLURAL"];
const CASES = [
  "",
  "NOMINATIVE",
  "ACCUSATIVE",
  "DATIVE",
  "GENITIVE",
  "INSTRUMENTAL",
  "PREPOSITIONAL",
];

const tagsText = computed({
  get: () => (form.value.tags ?? []).join(","),
  set: (value: string) => {
    form.value.tags = value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 20);
  },
});

const meaningCnText = computed({
  get: () => {
    const senses = form.value.senses ?? [];
    return senses.length && typeof senses[0]?.meaningCn === "string"
      ? senses[0].meaningCn
      : "";
  },
  set: (value: string) => {
    const senses = [...(form.value.senses ?? [])];
    const first = { ...(senses[0] ?? { pos: "NOUN", meaningCn: "" }) };
    first.meaningCn = value;
    senses[0] = first;
    form.value.senses = senses;
  },
});

const meaningLocalText = computed({
  get: () => {
    const senses = form.value.senses ?? [];
    return senses.length && typeof senses[0]?.meaningLocal === "string"
      ? senses[0].meaningLocal
      : "";
  },
  set: (value: string) => {
    const senses = [...(form.value.senses ?? [])];
    const first = { ...(senses[0] ?? { pos: "NOUN", meaningCn: "" }) };
    first.meaningLocal = value;
    senses[0] = first;
    form.value.senses = senses;
  },
});

const verbGroupText = computed({
  get: () => form.value.conjugation?.verbGroup ?? "",
  set: (value: string) => {
    if (!value.trim() && !form.value.conjugation?.irregular) {
      form.value.conjugation = undefined;
      return;
    }
    form.value.conjugation = { ...form.value.conjugation, verbGroup: value };
  },
});

const stateTag = (value: string): "success" | "warning" | "danger" | "info" => {
  if (value === "PUBLISHED" || value === "APPROVED") return "success";
  if (value === "ARCHIVED") return "info";
  if (value === "IN_REVIEW") return "warning";
  return "info";
};

function pronSummary(row: LexemeRow): string {
  const clean = row.pronunciations.filter(
    (item) => item.qcStatus === "CLEAN",
  ).length;
  return `${row.pronunciations.length} 个 · ${clean} 已质检`;
}

async function load(reset = true): Promise<void> {
  if (!canRead.value) {
    state.value = "permission";
    lastError.value = "当前会话没有内容读取权限。";
    return;
  }
  state.value = reset ? "loading" : state.value;
  lastError.value = null;
  try {
    const page = await listLexemes({
      q: q.value,
      cefr: cefr.value || undefined,
      availability: availability.value || undefined,
      packCode: packCode.value || undefined,
      language: language.value || undefined,
      limit: 50,
    });
    rows.value = page.rows;
    nextCursor.value = page.nextCursor;
    state.value = page.rows.length ? "ready" : "empty";
  } catch (error) {
    state.value = "error";
    lastError.value =
      error instanceof Error ? error.message : "单词列表读取失败。";
  }
}

async function loadMore(): Promise<void> {
  if (!nextCursor.value || loadingMore.value) return;
  loadingMore.value = true;
  try {
    const page = await listLexemes({
      q: q.value,
      cefr: cefr.value || undefined,
      availability: availability.value || undefined,
      packCode: packCode.value || undefined,
      language: language.value || undefined,
      limit: 50,
      cursor: nextCursor.value,
    });
    rows.value = [...rows.value, ...page.rows];
    nextCursor.value = page.nextCursor;
    if (rows.value.length) state.value = "ready";
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "加载更多失败。");
  } finally {
    loadingMore.value = false;
  }
}

function openCreate(): void {
  editing.value = null;
  form.value = {
    headword: "",
    language: "en-US",
    pos: ["NOUN"],
    cefr: "A1",
    difficulty: 1,
    senses: [{ pos: "NOUN", meaningCn: "" }],
  };
  dialogVisible.value = true;
}

function openEdit(row: LexemeRow): void {
  editing.value = row;
  form.value = JSON.parse(JSON.stringify(row.fields)) as LexemeFields;
  if (!form.value.language) form.value.language = row.language || "en-US";
  dialogVisible.value = true;
}

async function save(): Promise<void> {
  if (!form.value.headword?.trim()) {
    ElMessage.error("请填写单词。");
    return;
  }
  if (formBusy.value || !canWrite.value) return;
  formBusy.value = true;
  try {
    // B4 morphology: cleared selects submit '' — drop them so the server sees
    // omitted (optional) rather than an illegal empty value.
    const payload: LexemeFields = { ...form.value };
    for (const key of ["gender", "number", "grammaticalCase"] as const) {
      if (payload[key] === "") delete payload[key];
    }
    if (
      payload.conjugation &&
      !payload.conjugation.verbGroup?.trim() &&
      !payload.conjugation.irregular
    ) {
      delete payload.conjugation;
    }
    await upsertLexeme(payload, editing.value?.lexemeId);
    ElMessage.success("单词已保存为草稿。");
    dialogVisible.value = false;
    await load();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "保存失败。");
  } finally {
    formBusy.value = false;
  }
}

async function runLifecycle(
  row: LexemeRow,
  command:
    | "LEXEME_SUBMIT_REVIEW"
    | "LEXEME_PUBLISH"
    | "LEXEME_UNPUBLISH"
    | "LEXEME_ARCHIVE",
): Promise<void> {
  const labels: Record<string, string> = {
    LEXEME_SUBMIT_REVIEW: "提交审核",
    LEXEME_PUBLISH: "发布",
    LEXEME_UNPUBLISH: "下线",
    LEXEME_ARCHIVE: "归档",
  };
  try {
    await ElMessageBox.confirm(
      `确认对「${row.headword}」执行${labels[command]}？该动作将写入服务端审计。`,
      "单词生命周期",
      { type: "warning", confirmButtonText: "确认", cancelButtonText: "取消" },
    );
  } catch {
    return;
  }
  try {
    await lexemeLifecycle(row, command);
    ElMessage.success(`${labels[command]}已提交。`);
    await load();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "命令提交失败。");
  }
}

async function runReview(
  row: LexemeRow,
  stage: "FIRST" | "FINAL",
): Promise<void> {
  try {
    await ElMessageBox.confirm(
      `以${stage === "FIRST" ? "一级" : "二级"}审核身份批准「${row.headword}」？作者不能审核自己的版本。`,
      "双审确认",
      { type: "warning", confirmButtonText: "批准", cancelButtonText: "取消" },
    );
  } catch {
    return;
  }
  if (
    !session.can(
      stage === "FIRST" ? "admin.content.review.l1" : "admin.content.review.l2",
    )
  )
    return;
  try {
    await lexemeReview(row, stage);
    ElMessage.success("审核已提交。");
    await load();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "审核提交失败。");
  }
}

function openPronunciations(row: LexemeRow): void {
  pronTarget.value = row;
  pronForm.value = {
    accent: "US",
    ipa: row.fields.phoneticUS ?? "",
    audioAssetId: "",
    sourceType: "HUMAN",
  };
  pronVisible.value = true;
}

async function addPronunciation(): Promise<void> {
  if (!pronTarget.value) return;
  if (!pronForm.value.ipa.trim() || !pronForm.value.audioAssetId.trim()) {
    ElMessage.error("请填写音标与音频资产 ID。");
    return;
  }
  pronBusy.value = true;
  try {
    await upsertPronunciation(pronTarget.value, {
      accent: pronForm.value.accent.trim() || "US",
      ipa: pronForm.value.ipa.trim(),
      audioAssetId: pronForm.value.audioAssetId.trim(),
      sourceType: pronForm.value.sourceType as "HUMAN" | "TTS",
    });
    ElMessage.success("发音已登记，等待质检。");
    await load();
    const fresh = rows.value.find(
      (row) => row.lexemeId === pronTarget.value?.lexemeId,
    );
    if (fresh) pronTarget.value = fresh;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "发音登记失败。");
  } finally {
    pronBusy.value = false;
  }
}

async function qc(
  row: LexemeRow,
  pronunciationId: string,
  verdict: "READY" | "CLEAN" | "FAILED",
): Promise<void> {
  try {
    await qcPronunciation(row, pronunciationId, verdict);
    ElMessage.success(`质检结论 ${verdict} 已提交。`);
    await load();
    const fresh = rows.value.find((item) => item.lexemeId === row.lexemeId);
    if (fresh) pronTarget.value = fresh;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "质检提交失败。");
  }
}

onMounted(() => {
  void load();
});
</script>

<template>
  <div class="view-stack">
    <AdminPageIntro
      ><el-space>
        <el-button @click="$router.push('/phonetics')">音标库浏览</el-button>
        <el-button type="primary" :disabled="!canWrite" @click="openCreate"
          >新建单词</el-button
        >
      </el-space></AdminPageIntro
    >

    <el-card shadow="never">
      <el-space wrap>
        <el-input
          v-model="q"
          placeholder="搜索单词"
          clearable
          style="width: 220px"
          @keyup.enter="load()"
        />
        <el-select
          v-model="cefr"
          placeholder="CEFR"
          clearable
          style="width: 130px"
        >
          <el-option
            v-for="level in CEFRS"
            :key="level"
            :label="level || '全部'"
            :value="level"
          />
        </el-select>
        <el-select
          v-model="availability"
          placeholder="状态"
          clearable
          style="width: 150px"
        >
          <el-option
            v-for="item in STATES"
            :key="item"
            :label="item || '全部'"
            :value="item"
          />
        </el-select>
        <el-select
          v-model="packCode"
          placeholder="词包"
          clearable
          style="width: 200px"
        >
          <el-option label="全部词包" value="" />
          <el-option
            v-for="pack in PACKS"
            :key="pack"
            :label="pack"
            :value="pack"
          />
        </el-select>
        <el-select
          v-model="language"
          placeholder="语言"
          clearable
          style="width: 130px"
        >
          <el-option
            v-for="lang in LANGUAGES"
            :key="lang"
            :label="lang || '全部'"
            :value="lang"
          />
        </el-select>
        <el-button :disabled="!canRead" @click="load()">查询</el-button>
        <el-button
          @click="
            q = '';
            cefr = '';
            availability = '';
            language = '';
            load();
          "
          >{{ ui("clear") }}</el-button
        >
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
      :title="lastError ?? '单词数据暂时不可用'"
      type="error"
      :closable="false"
      show-icon
    />

    <el-card shadow="never">
      <el-skeleton v-if="state === 'loading'" :rows="5" animated /><el-table
        v-else-if="rows.length && state === 'ready'"
        :data="rows"
        stripe
      >
        <el-table-column prop="headword" label="单词" min-width="140" />
        <el-table-column prop="language" label="语言" width="90" />
        <el-table-column prop="packCode" label="词包" min-width="150" />
        <el-table-column prop="cefr" label="CEFR" width="80" />
        <el-table-column label="音标 US/UK" min-width="160">
          <template #default="scope"
            >{{ scope.row.fields.phoneticUS ?? "—" }} /
            {{ scope.row.fields.phoneticUK ?? "—" }}</template
          >
        </el-table-column>
        <el-table-column label="发音" width="110">
          <template #default="scope">{{ pronSummary(scope.row) }}</template>
        </el-table-column>
        <el-table-column prop="availability" label="状态" width="120">
          <template #default="scope"
            ><el-tag :type="stateTag(scope.row.availability)" effect="plain">{{
              scope.row.availability
            }}</el-tag></template
          >
        </el-table-column>
        <el-table-column prop="stateVersion" label="版本" width="80" />
        <el-table-column label="动作" width="330" fixed="right">
          <template #default="scope">
            <el-space wrap>
              <el-button
                size="small"
                :disabled="!canWrite"
                @click="openEdit(scope.row)"
                >编辑</el-button
              >
              <el-button
                size="small"
                :disabled="!canWrite"
                @click="openPronunciations(scope.row)"
                >发音</el-button
              >
              <el-button size="small" link @click="openDiff(scope.row)"
                >对比</el-button
              >
              <el-button
                v-if="scope.row.availability === 'DRAFT'"
                size="small"
                type="primary"
                link
                :disabled="!canWrite"
                @click="runLifecycle(scope.row, 'LEXEME_SUBMIT_REVIEW')"
                >送审</el-button
              >
              <el-button
                v-if="scope.row.availability === 'IN_REVIEW'"
                size="small"
                type="primary"
                link
                :disabled="!session.can('admin.content.review.l1')"
                @click="runReview(scope.row, 'FIRST')"
                >一审</el-button
              >
              <el-button
                v-if="scope.row.availability === 'IN_REVIEW'"
                size="small"
                type="primary"
                link
                :disabled="!session.can('admin.content.review.l2')"
                @click="runReview(scope.row, 'FINAL')"
                >二审</el-button
              >
              <el-button
                v-if="scope.row.availability === 'APPROVED'"
                size="small"
                type="success"
                link
                :disabled="!canPublish"
                @click="runLifecycle(scope.row, 'LEXEME_PUBLISH')"
                >发布</el-button
              >
              <el-button
                v-if="scope.row.availability === 'PUBLISHED'"
                size="small"
                type="warning"
                link
                :disabled="!canPublish"
                @click="runLifecycle(scope.row, 'LEXEME_UNPUBLISH')"
                >下线</el-button
              >
            </el-space>
          </template>
        </el-table-column>
      </el-table>
      <el-empty
        v-else-if="state === 'empty'"
        :description="ui('empty')"
      /><el-button v-else @click="load()">{{ ui("retry") }}</el-button>
      <div v-if="nextCursor" style="margin-top: 12px; text-align: center">
        <el-button :loading="loadingMore" @click="loadMore()"
          >加载更多</el-button
        >
      </div>
    </el-card>

    <el-dialog
      v-model="dialogVisible"
      :before-close="closeEditor"
      :close-on-click-modal="false"
      :title="editing ? `编辑 ${editing.headword}` : '新建单词'"
      width="640px"
    >
      <el-form
        label-position="top"
        class="admin-editor-form"
        :disabled="formBusy"
      >
        <el-form-item label="单词">
          <el-input
            v-model="form.headword"
            :disabled="!!editing"
            placeholder="如 habit"
          />
        </el-form-item>
        <el-form-item label="语言">
          <el-select v-model="form.language" placeholder="选择">
            <el-option label="en-US（英语默认）" value="en-US" />
            <el-option label="fr-FR（法语）" value="fr-FR" />
            <el-option label="de-DE（德语）" value="de-DE" />
          </el-select>
        </el-form-item>
        <el-form-item label="词性">
          <el-select
            v-model="form.pos"
            multiple
            placeholder="选择词性"
            style="width: 100%"
          >
            <el-option
              v-for="pos in POS_OPTIONS"
              :key="pos"
              :label="pos"
              :value="pos"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="性/数/格">
          <el-space wrap>
            <el-select
              v-model="form.gender"
              placeholder="性"
              clearable
              style="width: 130px"
            >
              <el-option
                v-for="item in GENDERS"
                :key="item"
                :label="item || '—'"
                :value="item"
              />
            </el-select>
            <el-select
              v-model="form.number"
              placeholder="数"
              clearable
              style="width: 130px"
            >
              <el-option
                v-for="item in NUMBERS"
                :key="item"
                :label="item || '—'"
                :value="item"
              />
            </el-select>
            <el-select
              v-model="form.grammaticalCase"
              placeholder="格"
              clearable
              style="width: 150px"
            >
              <el-option
                v-for="item in CASES"
                :key="item"
                :label="item || '—'"
                :value="item"
              />
            </el-select>
          </el-space>
        </el-form-item>
        <el-form-item label="变位组">
          <el-input
            v-model="verbGroupText"
            placeholder="如 FR-ER（法语动词必填）"
          />
        </el-form-item>
        <el-form-item label="CEFR">
          <el-select v-model="form.cefr" placeholder="选择">
            <el-option
              v-for="level in CEFRS.slice(1)"
              :key="level"
              :label="level"
              :value="level"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="难度 1-5">
          <el-input-number v-model="form.difficulty" :min="1" :max="5" />
        </el-form-item>
        <el-form-item label="美式音标">
          <el-input v-model="form.phoneticUS" placeholder="如 ˈhæbɪt" />
        </el-form-item>
        <el-form-item label="英式音标">
          <el-input v-model="form.phoneticUK" placeholder="如 ˈhæbɪt" />
        </el-form-item>
        <el-form-item label="中文释义">
          <el-input v-model="meaningCnText" placeholder="如：习惯" />
        </el-form-item>
        <el-form-item label="本地释义">
          <el-input
            v-model="meaningLocalText"
            placeholder="如 habitude（法语等非中文语种用此位）"
          />
        </el-form-item>
        <el-form-item label="标签(逗号分隔)">
          <el-input v-model="tagsText" placeholder="如 daily-life,exam" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button :disabled="formBusy" @click="closeEditor()">取消</el-button>
        <el-button type="primary" :loading="formBusy" @click="save()"
          >保存草稿</el-button
        >
      </template>
    </el-dialog>

    <el-dialog
      v-model="pronVisible"
      :title="`发音管理 ${pronTarget?.headword ?? ''}`"
      width="720px"
    >
      <el-table
        v-if="pronTarget?.pronunciations.length"
        :data="pronTarget.pronunciations"
        size="small"
      >
        <el-table-column type="expand">
          <template #default="scope">
            <AudioPreview :asset-id="scope.row.audioAssetId" />
          </template>
        </el-table-column>
        <el-table-column prop="accent" label="口音" width="80" />
        <el-table-column prop="ipa" label="音标" min-width="120" />
        <el-table-column prop="audioAssetId" label="音频资产" min-width="160" />
        <el-table-column prop="sourceType" label="来源" width="90" />
        <el-table-column prop="qcStatus" label="质检" width="100" />
        <el-table-column label="动作" width="200" fixed="right">
          <template #default="scope">
            <el-space>
              <el-button
                size="small"
                type="success"
                link
                @click="qc(pronTarget!, scope.row.pronunciationId, 'CLEAN')"
                >通过</el-button
              >
              <el-button
                size="small"
                type="warning"
                link
                @click="qc(pronTarget!, scope.row.pronunciationId, 'FAILED')"
                >不通过</el-button
              >
            </el-space>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-else description="暂无发音，先登记" />
      <el-divider>登记发音</el-divider>
      <el-space wrap>
        <el-select
          v-model="pronForm.accent"
          filterable
          allow-create
          default-first-option
          style="width: 130px"
        >
          <el-option label="美音" value="US" /><el-option
            label="英音"
            value="UK"
          /><el-option label="慢速" value="SLOW" /><el-option
            label="法标"
            value="FR-PARIS"
          />
        </el-select>
        <el-input
          v-model="pronForm.ipa"
          placeholder="音标"
          style="width: 150px"
        />
        <el-input
          v-model="pronForm.audioAssetId"
          placeholder="音频资产 ID"
          style="width: 200px"
        />
        <el-select v-model="pronForm.sourceType" style="width: 110px">
          <el-option label="真人" value="HUMAN" /><el-option
            label="TTS"
            value="TTS"
          />
        </el-select>
        <el-button
          type="primary"
          :loading="pronBusy"
          :disabled="!canWrite"
          @click="addPronunciation()"
          >登记</el-button
        >
      </el-space>
    </el-dialog>

    <el-dialog
      v-model="diffVisible"
      :title="`版本对比 ${diffTarget?.headword ?? ''}（草稿与已发布版本）`"
      width="720px"
    >
      <el-table :data="diffLines" size="small">
        <el-table-column prop="path" label="字段" min-width="180" />
        <el-table-column
          prop="before"
          label="已发布"
          min-width="220"
          show-overflow-tooltip
        />
        <el-table-column
          prop="after"
          label="当前草稿"
          min-width="220"
          show-overflow-tooltip
        />
      </el-table>
    </el-dialog>

    <SchedulePanel :pack-code="LEXEME_PACK" :targets="scheduleTargets" />
  </div>
</template>
