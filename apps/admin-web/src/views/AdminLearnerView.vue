<script setup lang="ts">
import AdminRecordDetails from "../components/AdminRecordDetails.vue";
import { ui } from "../platform/experience";
import AdminPageIntro from "../components/AdminPageIntro.vue";
import { computed, ref, watch } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  searchLearners,
  getLearnerProfile,
  getLearnerPlans,
  getLearnerSrs,
  getLearnerAssessments,
  setLearnerGoal,
  updateLearnerPreferences,
  resetSrsItem,
  type LearnerSubject,
} from "../api/learner-360";
import { useAdminStore } from "../stores/admin";

type Row = Record<string, unknown>;
type ViewState = "idle" | "loading" | "ready" | "permission" | "error";

const session = useAdminStore();
const q = ref("");
const subjects = ref<LearnerSubject[]>([]);
const nextCursor = ref<string | null>(null);
const hasMore = ref(false);
const current = ref<string>("");
const loadedSubject = ref("");
const state = ref<ViewState>("idle");
const lastError = ref<string | null>(null);
const activeTab = ref("profile");

const profile = ref<Row>({});
const plans = ref<Row>({});
const srs = ref<Row>({});
const assessments = ref<Row>({});

const canRead = computed(() => session.can("admin.learner.read"));
const canWrite = computed(() => session.can("admin.learner.write"));
const canReadLearning = computed(() => session.can("admin.learning.read"));
const canWriteLearning = computed(() => session.can("admin.learning.write"));
const canReadAssessment = computed(() => session.can("admin.assessment.read"));

function defaultGoalForm() { return {
  goalType: "WORKPLACE",
  dailyMinutes: 30,
  targetDate: "",
  startingLevel: "A1",
  examName: "",
  language: "",
} }
function defaultPrefForm() { return {
  uiLocale: "zh-CN",
  contentLocale: "en-US",
  themeMode: "SYSTEM",
  timezone: "Asia/Shanghai",
  reducedMotion: false,
} }
const goalForm = ref(defaultGoalForm());
const prefForm = ref(defaultPrefForm());
const busy = ref(false);
let detailRequest = 0;
let listRequest = 0;

function clearDetail(): void {
  current.value = "";
  loadedSubject.value = "";
  profile.value = {};
  plans.value = {};
  srs.value = {};
  assessments.value = {};
  goalForm.value = defaultGoalForm();
  prefForm.value = defaultPrefForm();
}

function selectedSubject(): string | null {
  return state.value === "ready" && current.value && current.value === loadedSubject.value
    && session.isAuthenticated && canRead.value ? current.value : null;
}

watch(
  [() => session.sessionId, () => session.principal?.subject, () => session.permissions.join("\u0000")],
  () => {
    detailRequest += 1;
    listRequest += 1;
    clearDetail();
    subjects.value = [];
    nextCursor.value = null;
    hasMore.value = false;
    state.value = canRead.value ? "idle" : "permission";
  },
);
watch(q, () => {
  listRequest += 1;
  subjects.value = [];
  nextCursor.value = null;
  hasMore.value = false;
  if (!current.value && state.value === "loading") state.value = "idle";
}, { flush: "sync" });

function profileVersion(): number {
  const inner = profile.value.profile as Row | undefined;
  return typeof inner?.version === "number" ? inner.version : 0;
}

async function search(): Promise<void> {
  const request = ++listRequest;
  detailRequest += 1;
  clearDetail();
  subjects.value = [];
  nextCursor.value = null;
  hasMore.value = false;
  if (!canRead.value) {
    state.value = "permission";
    return;
  }
  const actor = session.principal?.subject;
  const sessionId = session.sessionId;
  const query = q.value;
  state.value = "loading";
  try {
    // Contract-aligned envelope: data is the subject array, cursor state lives in meta.
    const page = await searchLearners(query);
    if (request !== listRequest || q.value !== query || session.principal?.subject !== actor
      || session.sessionId !== sessionId || !session.isAuthenticated || !canRead.value) return;
    subjects.value = page.subjects;
    nextCursor.value = page.nextCursor;
    hasMore.value = page.hasMore;
    state.value = "idle";
    if (!subjects.value.length) ElMessage.info(ui("paging.noResults"));
  } catch (error) {
    if (request !== listRequest || q.value !== query || session.principal?.subject !== actor
      || session.sessionId !== sessionId || !session.isAuthenticated || !canRead.value) return;
    state.value = "error";
    lastError.value = error instanceof Error ? error.message : "检索失败。";
  }
}

async function loadMore(): Promise<void> {
  if (!nextCursor.value || state.value === "loading" || current.value || !canRead.value) return;
  const request = ++listRequest;
  const actor = session.principal?.subject;
  const sessionId = session.sessionId;
  const query = q.value;
  const cursor = nextCursor.value;
  state.value = "loading";
  try {
    const page = await searchLearners(query, 50, cursor);
    if (request !== listRequest || q.value !== query || session.principal?.subject !== actor
      || session.sessionId !== sessionId || !session.isAuthenticated || !canRead.value) return;
    subjects.value = [...subjects.value, ...page.subjects];
    nextCursor.value = page.nextCursor;
    hasMore.value = page.hasMore;
    state.value = "idle";
  } catch (error) {
    if (request !== listRequest || q.value !== query || session.principal?.subject !== actor
      || session.sessionId !== sessionId || !session.isAuthenticated || !canRead.value) return;
    state.value = "error";
    lastError.value = error instanceof Error ? error.message : "检索失败。";
  }
}

async function open(subjectId: string): Promise<void> {
  listRequest += 1;
  const request = ++detailRequest;
  clearDetail();
  if (!canRead.value) {
    state.value = "permission";
    return;
  }
  if (!subjectId.trim()) return;
  const actor = session.principal?.subject;
  const sessionId = session.sessionId;
  current.value = subjectId;
  state.value = "loading";
  lastError.value = null;
  try {
    const [p, pl, s, a] = await Promise.all([
      getLearnerProfile(subjectId),
      canReadLearning.value ? getLearnerPlans(subjectId) : Promise.resolve({}),
      canReadLearning.value ? getLearnerSrs(subjectId) : Promise.resolve({}),
      canReadAssessment.value ? getLearnerAssessments(subjectId) : Promise.resolve({}),
    ]);
    if (request !== detailRequest || current.value !== subjectId
      || session.principal?.subject !== actor || session.sessionId !== sessionId
      || !session.isAuthenticated || !canRead.value) return;
    profile.value = p;
    plans.value = pl;
    srs.value = s;
    assessments.value = a;
    const goal = (p.profile as Row | undefined)?.goal as Row | undefined;
    if (goal) {
      goalForm.value.goalType =
        typeof goal.type === "string" ? goal.type : "WORKPLACE";
      goalForm.value.dailyMinutes =
        typeof goal.dailyMinutes === "number" ? goal.dailyMinutes : 30;
      const fields = goal.fields as Row | undefined;
      goalForm.value.examName =
        typeof fields?.examName === "string" ? fields.examName : "";
      goalForm.value.language =
        typeof fields?.language === "string" ? fields.language : "";
    }
    const prefs = (p.profile as Row | undefined)?.preferences as
      Row | undefined;
    if (prefs) {
      if (typeof prefs.uiLocale === "string")
        prefForm.value.uiLocale = prefs.uiLocale;
      if (typeof prefs.contentLocale === "string")
        prefForm.value.contentLocale = prefs.contentLocale;
      if (typeof prefs.themeMode === "string")
        prefForm.value.themeMode = prefs.themeMode;
      if (typeof prefs.timezone === "string")
        prefForm.value.timezone = prefs.timezone;
    }
    loadedSubject.value = subjectId;
    state.value = "ready";
  } catch (error) {
    if (request !== detailRequest || current.value !== subjectId
      || session.principal?.subject !== actor || session.sessionId !== sessionId) return;
    state.value = "error";
    lastError.value =
      error instanceof Error ? error.message : "学员 360° 读取失败。";
  }
}

async function saveGoal(): Promise<void> {
  const subjectId = selectedSubject();
  if (!canWrite.value || !subjectId || busy.value) return;
  const input = { ...goalForm.value, expectedVersion: profileVersion() };
  busy.value = true;
  try {
    await setLearnerGoal(subjectId, input);
    if (selectedSubject() !== subjectId) return;
    ElMessage.success("学习目标已更新。");
    await open(subjectId);
  } catch (error) {
    if (selectedSubject() === subjectId)
      ElMessage.error(error instanceof Error ? error.message : "目标更新失败。");
  } finally {
    busy.value = false;
  }
}

async function savePreferences(): Promise<void> {
  const subjectId = selectedSubject();
  if (!canWrite.value || !subjectId || busy.value) return;
  const input = { ...prefForm.value, expectedVersion: profileVersion() };
  busy.value = true;
  try {
    await updateLearnerPreferences(subjectId, input);
    if (selectedSubject() !== subjectId) return;
    ElMessage.success("学习偏好已更新。");
    await open(subjectId);
  } catch (error) {
    if (selectedSubject() === subjectId)
      ElMessage.error(error instanceof Error ? error.message : "偏好更新失败。");
  } finally {
    busy.value = false;
  }
}

async function resetItem(itemId: string): Promise<void> {
  const subjectId = selectedSubject();
  if (!canWriteLearning.value || !subjectId || !itemId || busy.value) return;
  try {
    await ElMessageBox.confirm(
      "重置此复习条目？分数与掌握度不受影响。",
      "重置复习进度",
      { type: "warning", confirmButtonText: "确认", cancelButtonText: "取消" },
    );
  } catch {
    return;
  }
  if (!canWriteLearning.value || selectedSubject() !== subjectId || busy.value) return;
  busy.value = true;
  try {
    await resetSrsItem(subjectId, itemId);
    if (selectedSubject() !== subjectId) return;
    ElMessage.success("SRS 条目已重置。");
    await open(subjectId);
  } catch (error) {
    if (selectedSubject() === subjectId)
      ElMessage.error(error instanceof Error ? error.message : "重置失败。");
  } finally {
    busy.value = false;
  }
}

function dueItems(): Row[] {
  const due = srs.value.due;
  return Array.isArray(due)
    ? due.filter((x): x is Row => typeof x === "object" && x !== null)
    : [];
}
</script>

<template>
  <div class="view-stack">
    <AdminPageIntro></AdminPageIntro>

    <el-card shadow="never" class="learner-directory">
      <template #header><div class="card-header"><span>学员目录</span><span v-if="subjects.length" class="learner-directory__count">已载入 {{ subjects.length }} 位</span></div></template>
      <el-space class="learner-toolbar">
        <el-input
          v-model="q"
          placeholder="按学员标识检索"
          clearable
          style="width: 260px"
          @keyup.enter="search()"
        />
        <el-button :disabled="!canRead" @click="search()">检索</el-button>
      </el-space>
      <el-skeleton v-if="state === 'loading'" :rows="3" animated /><el-table
        v-else-if="subjects.length"
        :data="subjects"
        size="small"
        style="margin-top: 12px"
        highlight-current-row
        @row-click="(row: LearnerSubject) => open(row.subjectId)"
      >
        <el-table-column prop="subjectId" label="学员标识" min-width="240" />
        <el-table-column
          prop="tenantId"
          label="租户"
          width="120"
        /><el-table-column label="操作" width="100"
          ><template #default="scope"
            ><el-button
              link
              type="primary"
              @click.stop="open(scope.row.subjectId)"
              >{{ ui("details") }}</el-button
            ></template
          ></el-table-column
        >
      </el-table>
      <div v-if="hasMore" style="margin-top: 12px; text-align: center">
        <el-button :disabled="state === 'loading'" @click="loadMore()">{{
          ui("paging.loadMore")
        }}</el-button>
      </div>
    </el-card>

    <el-alert
      v-if="state === 'permission'"
      title="当前会话没有学员读取权限"
      type="warning"
      :closable="false"
      show-icon
    />
    <el-alert
      v-else-if="state === 'error'"
      :title="lastError ?? '读取失败'"
      type="error"
      :closable="false"
      show-icon
    />

    <el-card v-if="state === 'ready'" shadow="never" class="learner-profile">
      <template #header
        ><span>学员 {{ current }}</span></template
      >
      <el-tabs v-model="activeTab">
        <el-tab-pane label="画像与目标" name="profile">
          <AdminRecordDetails :value="profile" />
          <el-divider>调整学习目标</el-divider>
          <el-space wrap>
            <el-select v-model="goalForm.goalType" style="width: 200px">
              <el-option label="基础" value="FOUNDATION" /><el-option
                label="英语四六级"
                value="CET_4_6"
              />
              <el-option label="考研" value="POSTGRADUATE" /><el-option
                label="职场"
                value="WORKPLACE"
              />
              <el-option label="语言证书" value="LANGUAGE_CERT" />
            </el-select>
            <el-input
              v-if="goalForm.goalType === 'LANGUAGE_CERT'"
              v-model="goalForm.examName"
              placeholder="考试名，如 DELF-B2"
              style="width: 170px"
            />
            <el-input
              v-if="goalForm.goalType === 'LANGUAGE_CERT'"
              v-model="goalForm.language"
              placeholder="语种，如 fr-FR"
              style="width: 140px"
            />
            <el-select v-model="goalForm.dailyMinutes" style="width: 120px">
              <el-option
                v-for="m in [5, 15, 30, 45]"
                :key="m"
                :label="`${m} 分钟`"
                :value="m"
              />
            </el-select>
            <el-button type="primary" :loading="busy" :disabled="!canWrite" @click="saveGoal()"
              >更新目标</el-button
            >
          </el-space>
          <el-divider>调整学习偏好</el-divider>
          <el-space wrap>
            <el-input
              v-model="prefForm.uiLocale"
              placeholder="UI 语言"
              style="width: 130px"
            />
            <el-input
              v-model="prefForm.contentLocale"
              placeholder="内容语言"
              style="width: 130px"
            />
            <el-select v-model="prefForm.themeMode" style="width: 140px">
              <el-option label="浅色" value="LIGHT" /><el-option
                label="深色"
                value="DARK"
              />
              <el-option label="跟随系统" value="SYSTEM" /><el-option
                label="高对比"
                value="HIGH_CONTRAST"
              />
            </el-select>
            <el-button type="primary" :loading="busy" :disabled="!canWrite" @click="savePreferences()"
              >更新偏好</el-button
            >
          </el-space>
        </el-tab-pane>
        <el-tab-pane label="计划" name="plans">
          <AdminRecordDetails v-if="canReadLearning" :value="plans" />
          <el-alert v-else title="需要学习记录读取权限" type="info" :closable="false" />
        </el-tab-pane>
        <el-tab-pane label="复习队列" name="srs">
          <el-alert v-if="!canReadLearning" title="需要学习记录读取权限" type="info" :closable="false" />
          <el-table v-else-if="dueItems().length" :data="dueItems()" size="small">
            <el-table-column prop="item_id" label="条目" min-width="140" />
            <el-table-column prop="stage" label="阶段" width="110" />
            <el-table-column prop="due_at" label="到期" min-width="170" />
            <el-table-column prop="review_count" label="复习次" width="90" />
            <el-table-column label="动作" width="110" fixed="right">
              <template #default="scope">
                <el-button
                  size="small"
                  link
                  :disabled="!canWriteLearning"
                  @click="resetItem(String(scope.row.item_id ?? ''))"
                  >重置</el-button
                >
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-else description="无到期条目" />
        </el-tab-pane>
        <el-tab-pane label="测评" name="assessments">
          <AdminRecordDetails v-if="canReadAssessment" :value="assessments" />
          <el-alert v-else title="需要测评记录读取权限" type="info" :closable="false" />
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<style scoped>
.json {
  background: var(--admin-soft);
  border-radius: 8px;
  padding: 12px;
  max-height: 320px;
  overflow: auto;
  font-size: 12px;
}
</style>
