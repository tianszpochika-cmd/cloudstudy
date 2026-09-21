<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { adminT } from '../platform/admin-i18n'
import '../platform/i18n-batch-b'
import { AdminApiError } from '../api/client'
import { executeB18SupportCommand, listB18SupportTickets } from '../api/b18-operations'
import { useAdminStore } from '../stores/admin'

type Row = Record<string, unknown>
type ViewState = 'loading' | 'ready' | 'empty' | 'permission' | 'recovery' | 'error'

const session = useAdminStore()
const rows = ref<Row[]>([])
const state = ref<ViewState>('loading')
const lastError = ref<string | null>(null)
const busyTicket = ref<string | null>(null)

function text(value: unknown, fallback = '—'): string { return typeof value === 'string' && value.trim() ? value : fallback }
function unwrapRows(value: unknown): Row[] {
  const source = typeof value === 'object' && value !== null && 'data' in value ? (value as { data?: unknown }).data : value
  if (Array.isArray(source)) return source.filter((item): item is Row => typeof item === 'object' && item !== null)
  if (typeof source === 'object' && source !== null && Array.isArray((source as { items?: unknown }).items)) return (source as { items: unknown[] }).items.filter((item): item is Row => typeof item === 'object' && item !== null)
  return []
}
function stateFrom(error: unknown): ViewState { return error instanceof AdminApiError && error.status === 403 ? 'permission' : error instanceof AdminApiError && error.status === 409 ? 'recovery' : 'error' }

async function load(): Promise<void> {
  if (!session.can('admin.support.read')) { state.value = 'permission'; lastError.value = adminT('supportView.noReadPermission'); return }
  state.value = 'loading'; lastError.value = null
  try { rows.value = unwrapRows(await listB18SupportTickets()); state.value = rows.value.length ? 'ready' : 'empty' }
  catch (error) { state.value = stateFrom(error); lastError.value = error instanceof Error ? error.message : adminT('supportView.loadFailed') }
}

async function resolve(row: Row): Promise<void> {
  if (!session.can('admin.support.command')) { state.value = 'permission'; lastError.value = adminT('supportView.noCommandPermission'); return }
  const ticketId = text(row.ticketId, '')
  if (!ticketId || busyTicket.value) return
  try { await ElMessageBox.confirm(adminT('supportView.confirmBody'), adminT('supportView.confirmTitle'), { type: 'warning', confirmButtonText: adminT('supportView.confirmOk'), cancelButtonText: adminT('supportView.confirmCancel') }) }
  catch { return }
  busyTicket.value = ticketId; lastError.value = null
  try { await executeB18SupportCommand({ resourceRef: ticketId, action: 'SUPPORT_RESOLVE', reasonCode: 'ADMIN_SUPPORT' }); ElMessage.success(adminT('supportView.commandSubmitted')); await load() }
  catch (error) { state.value = stateFrom(error); lastError.value = error instanceof Error ? error.message : adminT('supportView.commandFailed') }
  finally { busyTicket.value = null }
}

onMounted(() => { void load() })
</script>

<template>
  <div class="view-stack b18-support">
    <div class="view-intro"><div><span class="admin-header__eyebrow">B18 · SUPPORT WORKBENCH</span><h2>{{ adminT('supportView.heading') }}</h2><p>{{ adminT('supportView.intro') }}</p></div><el-button :loading="state === 'loading'" @click="load">{{ adminT('supportView.refresh') }}</el-button></div>
    <el-alert v-if="state === 'permission'" :title="adminT('supportView.permissionTitle')" type="warning" :closable="false" show-icon />
    <el-alert v-else-if="state === 'recovery'" :title="adminT('supportView.recoveryTitle')" :description="adminT('supportView.recoveryDesc')" type="warning" :closable="false" show-icon />
    <el-alert v-else-if="state === 'error'" :title="lastError ?? adminT('supportView.dataUnavailable')" type="error" :closable="false" show-icon />
    <el-alert :title="adminT('supportView.redactionTitle')" :description="adminT('supportView.redactionDesc')" type="info" :closable="false" show-icon />
    <el-card shadow="never"><el-table v-if="rows.length" :data="rows" stripe><el-table-column prop="ticketId" :label="adminT('supportView.colTicket')" min-width="180" /><el-table-column prop="categoryCode" :label="adminT('supportView.colCategory')" width="150" /><el-table-column prop="priority" :label="adminT('supportView.colPriority')" width="110" /><el-table-column prop="state" :label="adminT('supportView.colState')" width="130" /><el-table-column prop="slaState" label="SLA" width="130" /><el-table-column prop="redactionVersion" :label="adminT('supportView.colRedaction')" width="130" /><el-table-column :label="adminT('supportView.colAction')" width="150" fixed="right"><template #default="scope"><el-button :loading="busyTicket === scope.row.ticketId" :disabled="!session.can('admin.support.command')" type="primary" link @click="resolve(scope.row)">{{ adminT('supportView.resolveTicket') }}</el-button></template></el-table-column></el-table><el-empty v-else :description="state === 'empty' ? adminT('supportView.ticketsEmpty') : adminT('supportView.waitingProjection')" /></el-card>
  </div>
</template>
