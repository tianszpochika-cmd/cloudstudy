<script setup lang="ts">
import {
  decisionLabel,
  explainContentError,
  isOwnSubmission,
  isRejection,
  isVersionConflict,
} from "../platform/content-review";
import { useEditorGuard } from "../platform/editor-guard";
import { ui } from "../platform/experience";
import AdminPageIntro from "../components/AdminPageIntro.vue";
import { computed, onMounted, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  listItems,
  upsertItem,
  itemLifecycle,
  itemReview,
  importBatch,
  type BatchEntry,
  type ContentItemRow,
  type ItemKind,
} from "../api/content-items";
import { LEXEME_PACK } from "../api/lexeme";
import { useAdminStore } from "../stores/admin";
import SchedulePanel from "../components/SchedulePanel.vue";

type ViewState = "loading" | "ready" | "empty" | "permission" | "error";

const session = useAdminStore();
const rows = ref<ContentItemRow[]>([]);
const state = ref<ViewState>("loading");
const lastError = ref<string | null>(null);
const nextCursor = ref<string | null>(null);
const loadingMore = ref(false);

const kind = ref("");
const q = ref("");
const availability = ref("");

const canRead = computed(() => session.can("admin.content.read"));
const canWrite = computed(() => session.can("admin.content.write"));
const canPublish = computed(() => session.can("admin.content.publish"));

const dialogVisible = ref(false);
const editing = ref<ContentItemRow | null>(null);
const formKind = ref<ItemKind>("QUESTION");
const formStem = ref("");
const formFieldsText = ref("{}");
const formBusy = ref(false);
const closeEditor = useEditorGuard(
  dialogVisible,
  () => JSON.stringify([formKind.value, formStem.value, formFieldsText.value]),
  formBusy,
);

const batchVisible = ref(false);
const batchText = ref("");
const batchBusy = ref(false);
const batchResult = ref<Record<string, unknown> | null>(null);

const KINDS: Array<{ label: string; value: string }> = [
  { label: "全部", value: "" },
  { label: "题目", value: "QUESTION" },
  { label: "例句", value: "EXAMPLE" },
  { label: "语法点", value: "GRAMMAR_POINT" },
  { label: "段落", value: "PASSAGE" },
  { label: "练习", value: "EXERCISE" },
  { label: "听写", value: "DICTATION" },
  { label: "跟读", value: "SHADOWING" },
];

const scheduleTargets = computed(() =>
  rows.value
    .filter((row) => row.availability === "APPROVED")
    .slice(0, 50)
    .map((row) => ({
      type: "ITEM" as const,
      ref: row.itemId,
      label: `${row.kind} ${row.stem.slice(0, 24) || row.itemId}`,
    })),
);

async function load(reset = true): Promise<void> {
  if (!reset && (!nextCursor.value || loadingMore.value)) return;
  if (!reset) loadingMore.value = true;
  if (!canRead.value) {
    state.value = "permission";
    lastError.value = "当前会话没有内容读取权限。";
    return;
  }
  if (reset) state.value = "loading";
  lastError.value = null;
  try {
    const page = await listItems({
      kind: kind.value || undefined,
      q: q.value,
      availability: availability.value || undefined,
      limit: 50,
      cursor: reset ? undefined : (nextCursor.value ?? undefined),
    });
    rows.value = reset ? page.rows : [...rows.value, ...page.rows];
    nextCursor.value = page.nextCursor;
    state.value = rows.value.length ? "ready" : "empty";
  } catch (error) {
    state.value = "error";
    lastError.value =
      error instanceof Error ? error.message : "条目列表读取失败。";
  } finally {
    loadingMore.value = false;
  }
}

function openCreate(): void {
  editing.value = null;
  formKind.value = "QUESTION";
  formStem.value = "";
  formFieldsText.value = "{}";
  dialogVisible.value = true;
}

function openEdit(row: ContentItemRow): void {
  editing.value = row;
  formKind.value = row.kind;
  formStem.value = row.stem;
  formFieldsText.value = JSON.stringify(row.fields, null, 2);
  dialogVisible.value = true;
}

function parseFields(): Record<string, unknown> {
  try {
    const value = JSON.parse(formFieldsText.value || "{}") as unknown;
    if (typeof value !== "object" || value === null || Array.isArray(value))
      throw new Error("fields 必须是 JSON 对象。");
    return value as Record<string, unknown>;
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : "fields 不是合法 JSON。",
    );
  }
}

async function save(): Promise<void> {
  if (!formStem.value.trim()) {
    ElMessage.error("请填写题干或内容。");
    return;
  }
  let fields: Record<string, unknown>;
  try {
    fields = parseFields();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "配置解析失败。");
    return;
  }
  if (formBusy.value || !canWrite.value) return;
  formBusy.value = true;
  try {
    const wasLive =
      editing.value?.availability === "PUBLISHED" ||
      editing.value?.availability === "APPROVED";
    await upsertItem(
      editing.value?.packCode ?? LEXEME_PACK,
      {
        itemId: editing.value?.itemId,
        kind: formKind.value,
        stem: formStem.value.trim(),
        fields,
      },
      editing.value?.stateVersion,
    );
    ElMessage.success(
      wasLive
        ? "已创建修订稿：需要重新送审，线上仍显示旧版，直到修订稿发布。"
        : "条目已保存为草稿。",
    );
    dialogVisible.value = false;
    await load();
  } catch (error) {
    if (isVersionConflict(error) && editing.value) {
      await resolveConflict(editing.value.itemId);
    } else {
      ElMessage.error(explainContentError(error, "保存失败。"));
    }
  } finally {
    formBusy.value = false;
  }
}

async function resolveConflict(itemId: string): Promise<void> {
  await load();
  const latest = rows.value.find((row) => row.itemId === itemId) ?? null;
  const mine = formStem.value.trim();
  try {
    await ElMessageBox.confirm(
      `这个条目在你打开后已被 ${latest?.updatedBy ?? "其他人"} 修改（当前版本 ${latest?.stateVersion ?? "?"}）。\n` +
        `最新题干：${latest?.stem ?? "（已不存在）"}\n你的题干：${mine}\n` +
        "「载入最新版本」会放弃你的修改；「保留我的修改」会以最新版本为基础，再次点保存才会覆盖。",
      "内容已被他人修改",
      {
        type: "warning",
        confirmButtonText: "载入最新版本",
        cancelButtonText: "保留我的修改",
        distinguishCancelAndClose: true,
      },
    );
    if (latest) openEdit(latest);
  } catch (action) {
    if (action === "cancel" && latest) editing.value = latest;
  }
}

function canEditRow(row: ContentItemRow): boolean {
  return row.availability !== "IN_REVIEW" && row.availability !== "ARCHIVED";
}

function ownSubmission(row: ContentItemRow): boolean {
  return isOwnSubmission(row.reviewTrail, session.principal?.subject);
}

function trailText(row: ContentItemRow): string {
  const trail = row.reviewTrail;
  if (row.availability === "IN_REVIEW" && trail.submittedBy)
    return `待审 · 提交人 ${trail.submittedBy}`;
  if (isRejection(trail))
    return `${decisionLabel(trail.lastDecision)}（${trail.lastReviewer ?? ""}）：${trail.lastNote ?? ""}`;
  return decisionLabel(trail.lastDecision);
}

async function runReject(row: ContentItemRow, stage: "FIRST" | "FINAL"): Promise<void> {
  let note = "";
  try {
    const result = await ElMessageBox.prompt(
      "退回给作者修改。请写清楚需要改什么，作者会看到这段说明。",
      stage === "FIRST" ? "一审退回" : "二审退回",
      {
        confirmButtonText: "退回",
        cancelButtonText: "取消",
        inputType: "textarea",
        inputPlaceholder: "例如：答案解析不完整；选项 C 有歧义",
        inputValidator: (value: string) =>
          (value?.trim().length ?? 0) > 0 && value.trim().length <= 500
            ? true
            : "请填写 1 到 500 字的退回原因",
      },
    );
    note = (result as { value: string }).value.trim();
  } catch {
    return;
  }
  try {
    await itemReview(row, stage, "CHANGES_REQUESTED", note);
    ElMessage.success("已退回，作者修改后可以重新送审。");
    await load();
  } catch (error) {
    ElMessage.error(explainContentError(error, "退回失败。"));
  }
}

async function runLifecycle(
  row: ContentItemRow,
  command:
    "ITEM_SUBMIT_REVIEW" | "ITEM_PUBLISH" | "ITEM_UNPUBLISH" | "ITEM_ARCHIVE",
): Promise<void> {
  try {
    await ElMessageBox.confirm(
      `确认对条目 ${row.itemId} 执行 ${command}？`,
      "条目生命周期",
      { type: "warning", confirmButtonText: "确认", cancelButtonText: "取消" },
    );
  } catch {
    return;
  }
  try {
    await itemLifecycle(row, command);
    ElMessage.success("已提交。");
    await load();
  } catch (error) {
    ElMessage.error(explainContentError(error, "提交失败。"));
  }
}

async function runReview(
  row: ContentItemRow,
  stage: "FIRST" | "FINAL",
): Promise<void> {
  if (
    !session.can(
      stage === "FIRST" ? "admin.content.review.l1" : "admin.content.review.l2",
    )
  )
    return;
  try {
    await itemReview(row, stage);
    ElMessage.success("审核已提交。");
    await load();
  } catch (error) {
    ElMessage.error(explainContentError(error, "审核失败。"));
  }
}

function batchTemplate(): string {
  return [
    {
      kind: "QUESTION",
      stem: "Choose: I ___ a habit.",
      fields: {
        options: ["build", "builds"],
        answerIndex: 0,
        explanation: "固定搭配",
        cefr: "A2",
      },
    },
    {
      kind: "EXAMPLE",
      stem: "Build a habit.",
      fields: { translation: "养成一个习惯。" },
    },
  ]
    .map((row) => JSON.stringify(row))
    .join("\n");
}

function parseBatch(): BatchEntry[] {
  const raw = batchText.value.trim();
  if (!raw) throw new Error("请粘贴批量内容。");
  const lines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.map((line, index) => {
    let entry: unknown;
    try {
      entry = JSON.parse(line) as unknown;
    } catch {
      throw new Error(`第 ${index + 1} 行不是合法 JSON。`);
    }
    if (typeof entry !== "object" || entry === null || Array.isArray(entry))
      throw new Error(`第 ${index + 1} 行必须是对象。`);
    const row = entry as Record<string, unknown>;
    const kind =
      typeof row.kind === "string" ? row.kind.trim().toUpperCase() : "";
    if (
      ![
        "QUESTION",
        "EXAMPLE",
        "GRAMMAR_POINT",
        "PASSAGE",
        "EXERCISE",
        "DICTATION",
        "SHADOWING",
      ].includes(kind)
    ) {
      throw new Error(`第 ${index + 1} 行 kind 非法。`);
    }
    if (
      !row.fields ||
      typeof row.fields !== "object" ||
      Array.isArray(row.fields)
    )
      throw new Error(`第 ${index + 1} 行 fields 必须是对象。`);
    if (typeof row.stem !== "string" || !row.stem.trim())
      throw new Error(`第 ${index + 1} 行缺少题干。`);
    return {
      contentCode: LEXEME_PACK,
      item: {
        kind,
        stem: typeof row.stem === "string" ? row.stem : "",
        fields: (row.fields ?? {}) as Record<string, unknown>,
      },
    };
  });
}

async function runBatch(): Promise<void> {
  if (batchBusy.value || !canWrite.value) return;
  batchResult.value = null;
  let entries: BatchEntry[];
  try {
    entries = parseBatch();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "批量解析失败。");
    return;
  }
  if (!entries.length || entries.length > 100) {
    ElMessage.error("每次 1-100 行。");
    return;
  }
  batchBusy.value = true;
  try {
    batchResult.value = await importBatch(entries);
    await load();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "批量导入失败。");
  } finally {
    batchBusy.value = false;
  }
}

onMounted(() => {
  void load();
});
</script>

<template>
  <div class="view-stack">
    <div class="questions-page">
    <AdminPageIntro
      ><el-space>
        <el-button @click="batchVisible = true" :disabled="!canWrite"
          >批量导入</el-button
        >
        <el-button type="primary" :disabled="!canWrite" @click="openCreate()"
          >新建条目</el-button
        >
      </el-space></AdminPageIntro
    >

    <el-card shadow="never">
      <el-space wrap class="questions-toolbar">
        <el-select
          v-model="kind"
          placeholder="类型"
          clearable
          style="width: 140px"
        >
          <el-option
            v-for="k in KINDS"
            :key="k.value"
            :label="k.label"
            :value="k.value"
          />
        </el-select>
        <el-input
          v-model="q"
          placeholder="搜索题干"
          clearable
          style="width: 220px"
          @keyup.enter="load()"
        />
        <el-select
          v-model="availability"
          placeholder="状态"
          clearable
          style="width: 150px"
          ><el-option
            v-for="s in [
              'DRAFT',
              'IN_REVIEW',
              'APPROVED',
              'PUBLISHED',
              'ARCHIVED',
            ]"
            :key="s"
            :label="s"
            :value="s" /></el-select
        ><el-button
          :loading="state === 'loading'"
          :disabled="!canRead"
          @click="load()"
          >查询</el-button
        ><el-button
          @click="
            q = '';
            kind = '';
            availability = '';
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
      :title="lastError ?? '数据暂时不可用'"
      type="error"
      :closable="false"
      show-icon
    />

    <el-card shadow="never" class="questions-list">
      <template #header><div class="card-header"><span>题目与练习</span><el-tag>{{ rows.length }} 条</el-tag></div></template>
      <el-skeleton v-if="state === 'loading'" :rows="5" animated /><el-table
        v-else-if="rows.length && state === 'ready'"
        :data="rows"
        stripe
      >
        <el-table-column prop="kind" label="类型" width="130" />
        <el-table-column
          prop="stem"
          label="题干/例句"
          min-width="220"
          show-overflow-tooltip
        />
        <el-table-column prop="availability" label="状态" width="130">
          <template #default="scope"
            >{{ scope.row.availability }}
            <el-tag
              v-if="scope.row.reviewTrail.revisionOfLive"
              type="warning"
              effect="plain"
              size="small"
              title="这是已发布条目的修订稿；学员仍看到旧版，直到修订稿重新发布"
              >修订中</el-tag
            ></template
          >
        </el-table-column>
        <el-table-column label="审核意见" min-width="200">
          <template #default="scope">
            <span
              :style="{
                color: isRejection(scope.row.reviewTrail)
                  ? 'var(--el-color-danger)'
                  : undefined,
              }"
              >{{ trailText(scope.row) || "—" }}</span
            >
          </template>
        </el-table-column>
        <el-table-column prop="stateVersion" label="版本" width="80" />
        <el-table-column label="动作" width="300" fixed="right">
          <template #default="scope">
            <el-space wrap>
              <el-button
                size="small"
                :disabled="!canWrite || !canEditRow(scope.row)"
                :title="
                  canEditRow(scope.row)
                    ? ''
                    : '审核中或已归档的条目不能编辑；审核员退回后作者才能修改'
                "
                @click="openEdit(scope.row)"
                >{{
                  scope.row.availability === "PUBLISHED" ||
                  scope.row.availability === "APPROVED"
                    ? "修订"
                    : "编辑"
                }}</el-button
              >
              <el-button
                v-if="scope.row.availability === 'DRAFT'"
                size="small"
                type="primary"
                link
                :disabled="!canWrite"
                @click="runLifecycle(scope.row, 'ITEM_SUBMIT_REVIEW')"
                >送审</el-button
              >
              <el-button
                v-if="scope.row.availability === 'IN_REVIEW'"
                size="small"
                type="primary"
                link
                :disabled="
                  !session.can('admin.content.review.l1') || ownSubmission(scope.row)
                "
                :title="
                  ownSubmission(scope.row)
                    ? '你是提交人，不能审核自己的提交，请换一位审核员'
                    : ''
                "
                @click="runReview(scope.row, 'FIRST')"
                >一审通过</el-button
              >
              <el-button
                v-if="scope.row.availability === 'IN_REVIEW'"
                size="small"
                type="danger"
                link
                :disabled="
                  !session.can('admin.content.review.l1') || ownSubmission(scope.row)
                "
                @click="runReject(scope.row, 'FIRST')"
                >一审退回</el-button
              >
              <el-button
                v-if="scope.row.availability === 'IN_REVIEW'"
                size="small"
                type="primary"
                link
                :disabled="
                  !session.can('admin.content.review.l2') || ownSubmission(scope.row)
                "
                :title="
                  ownSubmission(scope.row)
                    ? '你是提交人，不能审核自己的提交，请换一位审核员'
                    : ''
                "
                @click="runReview(scope.row, 'FINAL')"
                >二审通过</el-button
              >
              <el-button
                v-if="scope.row.availability === 'IN_REVIEW'"
                size="small"
                type="danger"
                link
                :disabled="
                  !session.can('admin.content.review.l2') || ownSubmission(scope.row)
                "
                @click="runReject(scope.row, 'FINAL')"
                >二审退回</el-button
              >
              <el-button
                v-if="scope.row.availability === 'APPROVED'"
                size="small"
                type="success"
                link
                :disabled="!canPublish"
                @click="runLifecycle(scope.row, 'ITEM_PUBLISH')"
                >发布</el-button
              >
              <el-button
                v-if="scope.row.availability === 'PUBLISHED'"
                size="small"
                type="warning"
                link
                :disabled="!canPublish"
                @click="runLifecycle(scope.row, 'ITEM_UNPUBLISH')"
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
    </el-card>

    <div v-if="nextCursor" class="list-footer">
      <span>{{ ui("total", { count: rows.length }) }}</span
      ><el-button :loading="loadingMore" @click="load(false)"
        >加载更多</el-button
      >
    </div>
    <SchedulePanel :pack-code="LEXEME_PACK" :targets="scheduleTargets" />

    <el-dialog
      v-model="dialogVisible"
      :before-close="closeEditor"
      :close-on-click-modal="false"
      :title="editing ? '编辑条目' : '新建条目'"
      width="640px"
    >
      <el-form
        label-position="top"
        class="admin-editor-form"
        :disabled="formBusy"
      >
        <el-form-item label="类型">
          <el-select v-model="formKind" :disabled="!!editing">
            <el-option label="题目" value="QUESTION" /><el-option
              label="例句"
              value="EXAMPLE"
            />
            <el-option label="语法点" value="GRAMMAR_POINT" /><el-option
              label="段落"
              value="PASSAGE"
            />
            <el-option label="练习" value="EXERCISE" />
            <el-option label="听写" value="DICTATION" /><el-option
              label="跟读"
              value="SHADOWING"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="题干">
          <el-input
            v-model="formStem"
            type="textarea"
            :rows="2"
            placeholder="题干/例句/标题"
          />
        </el-form-item>
        <el-form-item label="配置 JSON">
          <el-input
            v-model="formFieldsText"
            type="textarea"
            :rows="8"
            placeholder='{"options":[],"answerIndex":0}'
          />
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
      v-model="batchVisible"
      title="批量导入（JSONL，每行一个条目）"
      width="680px"
    >
      <el-alert
        title="每行一条 JSON，最多 100 条。重复提交会创建重复内容，请先核对导入结果。"
        type="info"
        :closable="false"
        show-icon
      />
      <el-button
        class="batch-example-button"
        @click="batchText = batchTemplate()"
        >填入格式示例</el-button
      ><el-input
        v-model="batchText"
        type="textarea"
        :rows="10"
        :placeholder="batchTemplate()"
      />
      <el-card v-if="batchResult" shadow="never" style="margin-top: 12px" class="questions-batch-result">
        <p>
          总数 {{ batchResult.total }} · 成功 {{ batchResult.accepted }} · 跳过
          {{ batchResult.skipped }} · 失败 {{ batchResult.failed }}
        </p>
      </el-card>
      <template #footer>
        <el-button @click="batchVisible = false">关闭</el-button>
        <el-button type="primary" :loading="batchBusy" @click="runBatch()"
          >提交导入</el-button
        >
      </template>
    </el-dialog>
    </div>
  </div>
</template>
