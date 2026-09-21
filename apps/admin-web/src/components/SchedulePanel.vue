<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  getPackDetail,
  readScheduledTasks,
  schedulePublish,
  cancelSchedule,
  type ScheduledTask,
} from '../api/content-items'
import { useAdminStore } from '../stores/admin'
import { adminT } from '../platform/admin-i18n'

const props = defineProps<{
  packCode: string
  targets: Array<{ type: 'PACK' | 'LEXEME' | 'ITEM'; ref: string; label: string }>
}>()

const session = useAdminStore()
const tasks = ref<ScheduledTask[]>([])
const loading = ref(false)
const targetRef = ref('')
const runAtLocal = ref('')
const reason = ref('SCHEDULED_PUBLISH')
const cohort = ref('')
const busy = ref(false)

const canPublish = () => session.can('admin.content.publish')

async function load(): Promise<void> {
  loading.value = true
  try {
    tasks.value = readScheduledTasks(await getPackDetail(props.packCode))
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : adminT('schedule.listLoadFailed'))
  } finally {
    loading.value = false
  }
}

function toIso(local: string): string {
  const date = new Date(local)
  if (Number.isNaN(date.getTime())) throw new Error(adminT('schedule.invalidTimeFormat'))
  return date.toISOString()
}

async function create(): Promise<void> {
  const target = props.targets.find((t) => t.ref === targetRef.value)
  if (!target) { ElMessage.error(adminT('schedule.selectTarget')); return }
  if (!runAtLocal.value) { ElMessage.error(adminT('schedule.fillTime')); return }
  busy.value = true
  try {
    await schedulePublish({
      packCode: props.packCode,
      targetType: target.type,
      targetRef: target.ref,
      runAt: toIso(runAtLocal.value),
      reasonCode: reason.value.trim() || 'SCHEDULED_PUBLISH',
      cohort: cohort.value.trim() || undefined,
    })
    ElMessage.success(adminT('schedule.createSuccess'))
    await load()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : adminT('schedule.createFailed'))
  } finally {
    busy.value = false
  }
}

async function cancel(task: ScheduledTask): Promise<void> {
  try {
    await ElMessageBox.confirm(adminT('schedule.confirmCancelMessage', { targetRef: task.targetRef }), adminT('schedule.confirmCancelTitle'), { type: 'warning', confirmButtonText: adminT('schedule.confirmButtonText'), cancelButtonText: adminT('schedule.cancelButtonText') })
  } catch { return }
  try {
    await cancelSchedule(props.packCode, task.taskId)
    ElMessage.success(adminT('schedule.cancelSuccess'))
    await load()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : adminT('schedule.cancelFailed'))
  }
}

onMounted(() => { void load() })
</script>

<template>
  <el-card shadow="never" class="schedule-panel">
    <template #header>
      <div class="card-header"><span>{{ adminT('schedule.panelTitle') }}</span><el-button size="small" :loading="loading" @click="load()">{{ adminT('schedule.refresh') }}</el-button></div>
    </template>
    <el-table v-if="tasks.length" :data="tasks" size="small">
      <el-table-column prop="targetRef" :label="adminT('schedule.colTarget')" min-width="150" />
      <el-table-column prop="targetType" :label="adminT('schedule.colType')" width="90" />
      <el-table-column prop="runAt" :label="adminT('schedule.colRunAt')" min-width="170" />
      <el-table-column prop="status" :label="adminT('schedule.colStatus')" width="120" />
      <el-table-column prop="cohort" :label="adminT('schedule.colCohort')" width="110" />
      <el-table-column prop="failureCode" :label="adminT('schedule.colFailureReason')" min-width="140" />
      <el-table-column :label="adminT('schedule.colAction')" width="110" fixed="right">
        <template #default="scope">
          <el-button v-if="scope.row.status === 'SCHEDULED'" size="small" link :disabled="!canPublish()" @click="cancel(scope.row)">{{ adminT('schedule.cancelAction') }}</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-empty v-else :description="adminT('schedule.emptyText')" />
    <el-divider>{{ adminT('schedule.newSectionTitle') }}</el-divider>
    <el-space wrap>
      <el-select v-model="targetRef" :placeholder="adminT('schedule.selectTargetPlaceholder')" style="width: 220px">
        <el-option v-for="t in targets" :key="t.ref" :label="t.label" :value="t.ref" />
      </el-select>
      <el-input v-model="runAtLocal" type="datetime-local" style="width: 220px" />
      <el-input v-model="reason" :placeholder="adminT('schedule.reasonPlaceholder')" style="width: 180px" />
      <el-input v-model="cohort" :placeholder="adminT('schedule.cohortPlaceholder')" style="width: 150px" />
      <el-button type="primary" :loading="busy" :disabled="!canPublish()" @click="create()">{{ adminT('schedule.createAction') }}</el-button>
    </el-space>
    <p class="hint">{{ adminT('schedule.versionHint') }}</p>
  </el-card>
</template>

<style scoped>
.hint { color: #909399; font-size: 12px; margin-top: 8px; }
</style>
