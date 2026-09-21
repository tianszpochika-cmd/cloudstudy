<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
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
} from '../api/learner-360'
import { useAdminStore } from '../stores/admin'
import { adminT } from '../platform/admin-i18n'
import '../platform/i18n-batch-a'

type Row = Record<string, unknown>
type ViewState = 'idle' | 'loading' | 'ready' | 'permission' | 'error'

const session = useAdminStore()
const q = ref('')
const subjects = ref<LearnerSubject[]>([])
const nextCursor = ref<string | null>(null)
const hasMore = ref(false)
const current = ref<string>('')
const state = ref<ViewState>('idle')
const lastError = ref<string | null>(null)
const activeTab = ref('profile')

const profile = ref<Row>({})
const plans = ref<Row>({})
const srs = ref<Row>({})
const assessments = ref<Row>({})

const canRead = computed(() => session.can('admin.content.read'))

const goalForm = ref({ goalType: 'WORKPLACE', dailyMinutes: 30, targetDate: '', startingLevel: 'A1', examName: '', language: '' })
const prefForm = ref({ uiLocale: 'zh-CN', contentLocale: 'en-US', themeMode: 'SYSTEM', timezone: 'Asia/Shanghai', reducedMotion: false })
const busy = ref(false)

function profileVersion(): number {
  const inner = profile.value.profile as Row | undefined
  return typeof inner?.version === 'number' ? inner.version : 0
}

async function search(): Promise<void> {
  if (!canRead.value) { state.value = 'permission'; return }
  state.value = 'loading'
  try {
    const page = await searchLearners(q.value)
    subjects.value = page.subjects
    nextCursor.value = page.nextCursor
    hasMore.value = page.hasMore
    state.value = 'idle'
    if (!subjects.value.length) ElMessage.info(adminT('learnerView.notFound'))
  } catch (error) {
    state.value = 'error'
    lastError.value = error instanceof Error ? error.message : adminT('learnerView.searchFailed')
  }
}

async function loadMore(): Promise<void> {
  if (!nextCursor.value || state.value === 'loading') return
  state.value = 'loading'
  try {
    const page = await searchLearners(q.value, 50, nextCursor.value)
    subjects.value = [...subjects.value, ...page.subjects]
    nextCursor.value = page.nextCursor
    hasMore.value = page.hasMore
    state.value = 'idle'
  } catch (error) {
    state.value = 'error'
    lastError.value = error instanceof Error ? error.message : adminT('learnerView.searchFailed')
  }
}

async function open(subjectId: string): Promise<void> {
  current.value = subjectId
  state.value = 'loading'
  lastError.value = null
  try {
    const [p, pl, s, a] = await Promise.all([
      getLearnerProfile(subjectId),
      getLearnerPlans(subjectId),
      getLearnerSrs(subjectId),
      getLearnerAssessments(subjectId),
    ])
    profile.value = p
    plans.value = pl
    srs.value = s
    assessments.value = a
    const goal = (p.profile as Row | undefined)?.goal as Row | undefined
    if (goal) {
      goalForm.value.goalType = typeof goal.type === 'string' ? goal.type : 'WORKPLACE'
      goalForm.value.dailyMinutes = typeof goal.dailyMinutes === 'number' ? goal.dailyMinutes : 30
      const fields = goal.fields as Row | undefined
      goalForm.value.examName = typeof fields?.examName === 'string' ? fields.examName : ''
      goalForm.value.language = typeof fields?.language === 'string' ? fields.language : ''
    }
    const prefs = (p.profile as Row | undefined)?.preferences as Row | undefined
    if (prefs) {
      if (typeof prefs.uiLocale === 'string') prefForm.value.uiLocale = prefs.uiLocale
      if (typeof prefs.contentLocale === 'string') prefForm.value.contentLocale = prefs.contentLocale
      if (typeof prefs.themeMode === 'string') prefForm.value.themeMode = prefs.themeMode
      if (typeof prefs.timezone === 'string') prefForm.value.timezone = prefs.timezone
    }
    state.value = 'ready'
  } catch (error) {
    state.value = 'error'
    lastError.value = error instanceof Error ? error.message : adminT('learnerView.profileFailed')
  }
}

async function saveGoal(): Promise<void> {
  if (!current.value) return
  busy.value = true
  try {
    await setLearnerGoal(current.value, { ...goalForm.value, expectedVersion: profileVersion() })
    ElMessage.success(adminT('learnerView.goalSaved'))
    await open(current.value)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : adminT('learnerView.goalFailed'))
  } finally {
    busy.value = false
  }
}

async function savePreferences(): Promise<void> {
  if (!current.value) return
  busy.value = true
  try {
    await updateLearnerPreferences(current.value, { ...prefForm.value, expectedVersion: profileVersion() })
    ElMessage.success(adminT('learnerView.prefSaved'))
    await open(current.value)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : adminT('learnerView.prefFailed'))
  } finally {
    busy.value = false
  }
}

async function resetItem(itemId: string): Promise<void> {
  try {
    await ElMessageBox.confirm(adminT('learnerView.resetConfirm', { itemId }), adminT('learnerView.resetTitle'), { type: 'warning', confirmButtonText: adminT('learnerView.confirmOk'), cancelButtonText: adminT('learnerView.cancel') })
  } catch { return }
  try {
    await resetSrsItem(current.value, itemId)
    ElMessage.success(adminT('learnerView.resetDone'))
    await open(current.value)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : adminT('learnerView.resetFailed'))
  }
}

function dueItems(): Row[] {
  const due = srs.value.due
  return Array.isArray(due) ? (due.filter((x): x is Row => typeof x === 'object' && x !== null)) : []
}
</script>

<template>
  <div class="view-stack">
    <div class="view-intro">
      <div>
        <span class="admin-header__eyebrow">B3 · LEARNER 360</span>
        <h2>{{ adminT('learnerView.title') }}</h2>
        <p>{{ adminT('learnerView.description') }}</p>
      </div>
    </div>

    <el-card shadow="never">
      <el-space>
        <el-input v-model="q" :placeholder="adminT('learnerView.searchPlaceholder')" clearable style="width: 260px" @keyup.enter="search()" />
        <el-button :disabled="!canRead" @click="search()">{{ adminT('learnerView.search') }}</el-button>
      </el-space>
      <el-table v-if="subjects.length" :data="subjects" size="small" style="margin-top: 12px" highlight-current-row @row-click="(row: LearnerSubject) => open(row.subjectId)">
        <el-table-column prop="subjectId" label="Subject" min-width="240" />
        <el-table-column prop="tenantId" :label="adminT('learnerView.colTenant')" width="120" />
      </el-table>
      <div v-if="hasMore" style="margin-top: 12px; text-align: center">
        <el-button @click="loadMore()">{{ adminT('learnerView.loadMore') }}</el-button>
      </div>
    </el-card>

    <el-alert v-if="state === 'permission'" :title="adminT('learnerView.noReadPermission')" type="warning" :closable="false" show-icon />
    <el-alert v-else-if="state === 'error'" :title="lastError ?? adminT('learnerView.loadFailed')" type="error" :closable="false" show-icon />

    <el-card v-if="state === 'ready'" shadow="never">
      <template #header><span>{{ adminT('learnerView.subjectTitle', { subjectId: current }) }}</span></template>
      <el-tabs v-model="activeTab">
        <el-tab-pane :label="adminT('learnerView.tabProfile')" name="profile">
          <pre class="json">{{ JSON.stringify(profile, null, 2) }}</pre>
          <el-divider>{{ adminT('learnerView.goalDivider') }}</el-divider>
          <el-space wrap>
            <el-select v-model="goalForm.goalType" style="width: 200px">
              <el-option :label="adminT('learnerView.goalFoundation')" value="FOUNDATION" /><el-option :label="adminT('learnerView.goalCet')" value="CET_4_6" />
              <el-option :label="adminT('learnerView.goalPostgraduate')" value="POSTGRADUATE" /><el-option :label="adminT('learnerView.goalWorkplace')" value="WORKPLACE" />
              <el-option :label="adminT('learnerView.goalCert')" value="LANGUAGE_CERT" />
            </el-select>
            <el-input v-if="goalForm.goalType === 'LANGUAGE_CERT'" v-model="goalForm.examName" :placeholder="adminT('learnerView.examPlaceholder')" style="width: 170px" />
            <el-input v-if="goalForm.goalType === 'LANGUAGE_CERT'" v-model="goalForm.language" :placeholder="adminT('learnerView.languagePlaceholder')" style="width: 140px" />
            <el-select v-model="goalForm.dailyMinutes" style="width: 120px">
              <el-option v-for="m in [5, 15, 30, 45]" :key="m" :label="adminT('learnerView.dailyMinutes', { minutes: m })" :value="m" />
            </el-select>
            <el-button type="primary" :loading="busy" @click="saveGoal()">{{ adminT('learnerView.updateGoal') }}</el-button>
          </el-space>
          <el-divider>{{ adminT('learnerView.prefDivider') }}</el-divider>
          <el-space wrap>
            <el-input v-model="prefForm.uiLocale" :placeholder="adminT('learnerView.uiLocalePlaceholder')" style="width: 130px" />
            <el-input v-model="prefForm.contentLocale" :placeholder="adminT('learnerView.contentLocalePlaceholder')" style="width: 130px" />
            <el-select v-model="prefForm.themeMode" style="width: 140px">
              <el-option :label="adminT('learnerView.themeLight')" value="LIGHT" /><el-option :label="adminT('learnerView.themeDark')" value="DARK" />
              <el-option :label="adminT('learnerView.themeSystem')" value="SYSTEM" /><el-option :label="adminT('learnerView.themeContrast')" value="HIGH_CONTRAST" />
            </el-select>
            <el-button type="primary" :loading="busy" @click="savePreferences()">{{ adminT('learnerView.updatePref') }}</el-button>
          </el-space>
        </el-tab-pane>
        <el-tab-pane :label="adminT('learnerView.tabPlans')" name="plans">
          <pre class="json">{{ JSON.stringify(plans, null, 2) }}</pre>
        </el-tab-pane>
        <el-tab-pane :label="adminT('learnerView.tabSrs')" name="srs">
          <el-table v-if="dueItems().length" :data="dueItems()" size="small">
            <el-table-column prop="item_id" :label="adminT('learnerView.colItem')" min-width="140" />
            <el-table-column prop="stage" :label="adminT('learnerView.colStage')" width="110" />
            <el-table-column prop="due_at" :label="adminT('learnerView.colDue')" min-width="170" />
            <el-table-column prop="review_count" :label="adminT('learnerView.colReviews')" width="90" />
            <el-table-column :label="adminT('learnerView.colActions')" width="110" fixed="right">
              <template #default="scope">
                <el-button size="small" link @click="resetItem(String(scope.row.item_id ?? ''))">{{ adminT('learnerView.actionReset') }}</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-else :description="adminT('learnerView.noDue')" />
        </el-tab-pane>
        <el-tab-pane :label="adminT('learnerView.tabAssessments')" name="assessments">
          <pre class="json">{{ JSON.stringify(assessments, null, 2) }}</pre>
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<style scoped>
.json { background: #f7f8fc; border-radius: 8px; padding: 12px; max-height: 320px; overflow: auto; font-size: 12px; }
</style>
