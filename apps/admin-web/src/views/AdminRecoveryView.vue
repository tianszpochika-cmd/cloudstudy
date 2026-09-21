<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { adminT } from '../platform/admin-i18n'
import '../platform/i18n-batch-b'
import { AdminApiError } from '../api/client'
import {
  approveRecovery,
  executeRecovery,
  listUnfinishedSagas,
  rejectRecovery,
  requestRecovery,
  type RecoveryView,
} from '../api/recovery'
import { useAdminStore } from '../stores/admin'

type ViewState = 'loading' | 'ready' | 'empty' | 'permission' | 'error'

const session = useAdminStore()
const state = ref<ViewState>('loading')
const lastError = ref<string | null>(null)
const current = ref<RecoveryView | null>(null)
const sagas = ref<string[]>([])
const subjectType = ref('TICKET')
const subjectId = ref('')
const action = ref('REOPEN')
const reason = ref('')
const busy = ref(false)

function text(value: unknown, fallback = '—'): string { return typeof value === 'string' && value.trim() ? value : fallback }
function stateFrom(error: unknown): ViewState { return error instanceof AdminApiError && error.status === 403 ? 'permission' : 'error' }

async function load(): Promise<void> {
  if (!session.can('admin.recovery.read')) { state.value = 'permission'; lastError.value = adminT('recoveryView.noReadPermission'); return }
  state.value = 'loading'; lastError.value = null
  try {
    sagas.value = await listUnfinishedSagas()
    state.value = current.value || sagas.value.length ? 'ready' : 'empty'
  } catch (error) { state.value = stateFrom(error); lastError.value = error instanceof Error ? error.message : adminT('recoveryView.loadFailed') }
}

async function request(): Promise<void> {
  if (!session.can('admin.recovery.request')) { state.value = 'permission'; lastError.value = adminT('recoveryView.noRequestPermission'); return }
  if (!subjectId.value.trim() || busy.value) { ElMessage.error(adminT('recoveryView.subjectRequired')); return }
  busy.value = true; lastError.value = null
  try {
    current.value = await requestRecovery({ subjectType: subjectType.value.trim(), subjectId: subjectId.value.trim(), action: action.value.trim(), reason: reason.value.trim() })
    ElMessage.success(adminT('recoveryView.requestSubmitted'))
    await load()
  } catch (error) { state.value = stateFrom(error); lastError.value = error instanceof Error ? error.message : adminT('recoveryView.requestFailed') } finally { busy.value = false }
}

async function decide(kind: 'approve' | 'reject' | 'execute'): Promise<void> {
  const id = current.value?.recoveryId
  if (!id || busy.value) return
  if (!session.can('admin.recovery.command')) { state.value = 'permission'; lastError.value = adminT('recoveryView.noCommandPermission'); return }
  try { await ElMessageBox.confirm(kind === 'approve' ? adminT('recoveryView.confirmApproveBody') : kind === 'reject' ? adminT('recoveryView.confirmRejectBody') : adminT('recoveryView.confirmExecuteBody'), adminT('recoveryView.confirmTitle'), { type: 'warning', confirmButtonText: adminT('recoveryView.confirmOk'), cancelButtonText: adminT('recoveryView.confirmCancel') }) }
  catch { return }
  busy.value = true; lastError.value = null
  try {
    current.value = kind === 'approve' ? await approveRecovery(id) : kind === 'reject' ? await rejectRecovery(id, reason.value.trim()) : await executeRecovery(id)
    ElMessage.success(adminT('recoveryView.commandSubmitted'))
    await load()
  } catch (error) { state.value = stateFrom(error); lastError.value = error instanceof Error ? error.message : adminT('recoveryView.commandFailed') } finally { busy.value = false }
}

onMounted(() => { void load() })
</script>

<template>
  <div class="view-stack">
    <div class="view-intro">
      <div><span class="admin-header__eyebrow">OPS · RECOVERY</span><h2>{{ adminT('recoveryView.heading') }}</h2><p>{{ adminT('recoveryView.intro') }}</p></div>
    </div>
    <div v-if="state === 'loading'">{{ adminT('recoveryView.loading') }}</div>
    <div v-else-if="state === 'permission'" role="alert">{{ adminT('recoveryView.permissionDenied', { error: lastError }) }}</div>
    <div v-else-if="state === 'error'" role="alert">{{ lastError ?? adminT('recoveryView.recoveryUnavailable') }}</div>
    <template v-else>
      <el-card shadow="never">
        <template #header><span>{{ adminT('recoveryView.requestTitle') }}</span></template>
        <el-form label-position="top">
          <el-row :gutter="16">
            <el-col :xs="24" :md="6"><el-form-item :label="adminT('recoveryView.fieldSubjectType')"><el-input v-model="subjectType" /></el-form-item></el-col>
            <el-col :xs="24" :md="6"><el-form-item :label="adminT('recoveryView.fieldSubjectId')"><el-input v-model="subjectId" :placeholder="adminT('recoveryView.fieldSubjectIdPlaceholder')" /></el-form-item></el-col>
            <el-col :xs="24" :md="6"><el-form-item :label="adminT('recoveryView.fieldAction')"><el-input v-model="action" /></el-form-item></el-col>
            <el-col :xs="24" :md="6"><el-form-item :label="adminT('recoveryView.fieldReason')"><el-input v-model="reason" /></el-form-item></el-col>
          </el-row>
          <el-button type="primary" :loading="busy" @click="request">{{ adminT('recoveryView.submitRequest') }}</el-button>
        </el-form>
      </el-card>
      <el-card shadow="never">
        <template #header><span>{{ adminT('recoveryView.currentTitle') }}</span></template>
        <p v-if="!current">{{ adminT('recoveryView.currentEmpty') }}</p>
        <dl v-else>
          <div><dt>{{ adminT('recoveryView.rowId') }}</dt><dd>{{ current.recoveryId }}</dd></div>
          <div><dt>{{ adminT('recoveryView.rowStatus') }}</dt><dd>{{ text(current.status) }}</dd></div>
          <div><dt>{{ adminT('recoveryView.rowRequester') }}</dt><dd>{{ text(current.requestedBy) }}</dd></div>
          <div><dt>{{ adminT('recoveryView.rowApprover') }}</dt><dd>{{ text(current.approvedBy) }}</dd></div>
        </dl>
        <el-space v-if="current">
          <el-button type="success" plain :loading="busy" @click="decide('approve')">{{ adminT('recoveryView.approveAsSecond') }}</el-button>
          <el-button type="danger" plain :loading="busy" @click="decide('reject')">{{ adminT('recoveryView.reject') }}</el-button>
          <el-button type="warning" plain :loading="busy" @click="decide('execute')">{{ adminT('recoveryView.execute') }}</el-button>
        </el-space>
      </el-card>
      <el-card shadow="never">
        <template #header><span>{{ adminT('recoveryView.sagasTitle') }}</span></template>
        <p v-if="!sagas.length" class="muted">{{ adminT('recoveryView.sagasEmpty') }}</p>
        <ul v-else><li v-for="id in sagas" :key="id">{{ id }}</li></ul>
      </el-card>
    </template>
  </div>
</template>
