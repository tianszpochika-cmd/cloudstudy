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

type Row = Record<string, unknown>
type ViewState = 'idle' | 'loading' | 'ready' | 'permission' | 'error'

const session = useAdminStore()
const q = ref('')
const subjects = ref<LearnerSubject[]>([])
const current = ref<string>('')
const state = ref<ViewState>('idle')
const lastError = ref<string | null>(null)
const activeTab = ref('profile')

const profile = ref<Row>({})
const plans = ref<Row>({})
const srs = ref<Row>({})
const assessments = ref<Row>({})

const canRead = computed(() => session.can('admin.content.read'))

const goalForm = ref({ goalType: 'WORKPLACE', dailyMinutes: 30, targetDate: '', startingLevel: 'A1' })
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
    subjects.value = await searchLearners(q.value)
    state.value = 'idle'
    if (!subjects.value.length) ElMessage.info('未找到学员。')
  } catch (error) {
    state.value = 'error'
    lastError.value = error instanceof Error ? error.message : '检索失败。'
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
    lastError.value = error instanceof Error ? error.message : '学员 360° 读取失败。'
  }
}

async function saveGoal(): Promise<void> {
  if (!current.value) return
  busy.value = true
  try {
    await setLearnerGoal(current.value, { ...goalForm.value, expectedVersion: profileVersion() })
    ElMessage.success('学习目标已更新（含版本锁与审计）。')
    await open(current.value)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '目标更新失败。')
  } finally {
    busy.value = false
  }
}

async function savePreferences(): Promise<void> {
  if (!current.value) return
  busy.value = true
  try {
    await updateLearnerPreferences(current.value, { ...prefForm.value, expectedVersion: profileVersion() })
    ElMessage.success('偏好已更新。注意 UI 语言与内容语言相互独立。')
    await open(current.value)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '偏好更新失败。')
  } finally {
    busy.value = false
  }
}

async function resetItem(itemId: string): Promise<void> {
  try {
    await ElMessageBox.confirm(`将 SRS 条目 ${itemId} 重置为初始状态（NEW、到期即刻）？分数与掌握度不受影响。`, 'SRS 恢复', { type: 'warning', confirmButtonText: '确认', cancelButtonText: '取消' })
  } catch { return }
  try {
    await resetSrsItem(current.value, itemId)
    ElMessage.success('SRS 条目已重置。')
    await open(current.value)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '重置失败。')
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
        <h2>学员 360°：画像、计划、SRS、测评一览</h2>
        <p>跨画像/学习/测评三事实主读投影；写动作仅限目标、偏好与 SRS 重置，全部带版本锁、幂等键与审计。身份归 IAM，此处无联系方式。</p>
      </div>
    </div>

    <el-card shadow="never">
      <el-space>
        <el-input v-model="q" placeholder="按 subject 检索" clearable style="width: 260px" @keyup.enter="search()" />
        <el-button :disabled="!canRead" @click="search()">检索</el-button>
      </el-space>
      <el-table v-if="subjects.length" :data="subjects" size="small" style="margin-top: 12px" highlight-current-row @row-click="(row: LearnerSubject) => open(row.subjectId)">
        <el-table-column prop="subjectId" label="Subject" min-width="240" />
        <el-table-column prop="tenantId" label="租户" width="120" />
      </el-table>
    </el-card>

    <el-alert v-if="state === 'permission'" title="当前会话没有内容读取权限" type="warning" :closable="false" show-icon />
    <el-alert v-else-if="state === 'error'" :title="lastError ?? '读取失败'" type="error" :closable="false" show-icon />

    <el-card v-if="state === 'ready'" shadow="never">
      <template #header><span>学员 {{ current }}</span></template>
      <el-tabs v-model="activeTab">
        <el-tab-pane label="画像与目标" name="profile">
          <pre class="json">{{ JSON.stringify(profile, null, 2) }}</pre>
          <el-divider>代设目标（版本锁）</el-divider>
          <el-space wrap>
            <el-select v-model="goalForm.goalType" style="width: 160px">
              <el-option label="基础" value="FOUNDATION" /><el-option label="四六级" value="CET_4_6" />
              <el-option label="考研" value="POSTGRADUATE" /><el-option label="职场" value="WORKPLACE" />
            </el-select>
            <el-select v-model="goalForm.dailyMinutes" style="width: 120px">
              <el-option v-for="m in [5, 15, 30, 45]" :key="m" :label="`${m} 分钟`" :value="m" />
            </el-select>
            <el-button type="primary" :loading="busy" @click="saveGoal()">更新目标</el-button>
          </el-space>
          <el-divider>代改偏好</el-divider>
          <el-space wrap>
            <el-input v-model="prefForm.uiLocale" placeholder="UI 语言" style="width: 130px" />
            <el-input v-model="prefForm.contentLocale" placeholder="内容语言" style="width: 130px" />
            <el-select v-model="prefForm.themeMode" style="width: 140px">
              <el-option label="浅色" value="LIGHT" /><el-option label="深色" value="DARK" />
              <el-option label="跟随系统" value="SYSTEM" /><el-option label="高对比" value="HIGH_CONTRAST" />
            </el-select>
            <el-button type="primary" :loading="busy" @click="savePreferences()">更新偏好</el-button>
          </el-space>
        </el-tab-pane>
        <el-tab-pane label="计划" name="plans">
          <pre class="json">{{ JSON.stringify(plans, null, 2) }}</pre>
        </el-tab-pane>
        <el-tab-pane label="SRS" name="srs">
          <el-table v-if="dueItems().length" :data="dueItems()" size="small">
            <el-table-column prop="item_id" label="条目" min-width="140" />
            <el-table-column prop="stage" label="阶段" width="110" />
            <el-table-column prop="due_at" label="到期" min-width="170" />
            <el-table-column prop="review_count" label="复习次" width="90" />
            <el-table-column label="动作" width="110" fixed="right">
              <template #default="scope">
                <el-button size="small" link @click="resetItem(String(scope.row.item_id ?? ''))">重置</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-else description="无到期条目" />
        </el-tab-pane>
        <el-tab-pane label="测评" name="assessments">
          <pre class="json">{{ JSON.stringify(assessments, null, 2) }}</pre>
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<style scoped>
.json { background: #f7f8fc; border-radius: 8px; padding: 12px; max-height: 320px; overflow: auto; font-size: 12px; }
</style>
