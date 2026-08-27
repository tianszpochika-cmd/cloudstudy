<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
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
  if (!session.can('admin.support.read')) { state.value = 'permission'; lastError.value = '当前会话没有客服读取权限。'; return }
  state.value = 'loading'; lastError.value = null
  try { rows.value = unwrapRows(await listB18SupportTickets()); state.value = rows.value.length ? 'ready' : 'empty' }
  catch (error) { state.value = stateFrom(error); lastError.value = error instanceof Error ? error.message : '客服工单读取失败。' }
}

async function resolve(row: Row): Promise<void> {
  if (!session.can('admin.support.command')) { state.value = 'permission'; lastError.value = '当前会话没有客服命令权限。'; return }
  const ticketId = text(row.ticketId, '')
  if (!ticketId || busyTicket.value) return
  try { await ElMessageBox.confirm('该动作会提交服务端审批命令，并追加脱敏审计记录。', '确认提交客服命令', { type: 'warning', confirmButtonText: '确认', cancelButtonText: '取消' }) }
  catch { return }
  busyTicket.value = ticketId; lastError.value = null
  try { await executeB18SupportCommand({ resourceRef: ticketId, action: 'SUPPORT_RESOLVE', reasonCode: 'ADMIN_SUPPORT' }); ElMessage.success('客服命令已提交。'); await load() }
  catch (error) { state.value = stateFrom(error); lastError.value = error instanceof Error ? error.message : '客服命令提交失败。' }
  finally { busyTicket.value = null }
}

onMounted(() => { void load() })
</script>

<template>
  <div class="view-stack b18-support">
    <div class="view-intro"><div><span class="admin-header__eyebrow">B18 · SUPPORT WORKBENCH</span><h2>客服工单与恢复命令</h2><p>工单只读投影来自 admin-ops；命令需要服务端权限、确认和幂等键，页面不展示原始用户隐私。</p></div><el-button :loading="state === 'loading'" @click="load">刷新</el-button></div>
    <el-alert v-if="state === 'permission'" title="当前会话没有客服权限" type="warning" :closable="false" show-icon />
    <el-alert v-else-if="state === 'recovery'" title="命令状态需要恢复" description="服务端拒绝了重复或过期命令；请刷新最新工单投影后再操作。" type="warning" :closable="false" show-icon />
    <el-alert v-else-if="state === 'error'" :title="lastError ?? '客服数据暂时不可用'" type="error" :closable="false" show-icon />
    <el-alert title="脱敏边界" description="只展示工单引用、分类、优先级和状态；联系方式、支付原文、客服原文和客户端角色字段不会进入页面。" type="info" :closable="false" show-icon />
    <el-card shadow="never"><el-table v-if="rows.length" :data="rows" stripe><el-table-column prop="ticketId" label="工单引用" min-width="180" /><el-table-column prop="categoryCode" label="分类" width="150" /><el-table-column prop="priority" label="优先级" width="110" /><el-table-column prop="state" label="状态" width="130" /><el-table-column prop="slaState" label="SLA" width="130" /><el-table-column prop="redactionVersion" label="脱敏版本" width="130" /><el-table-column label="动作" width="150" fixed="right"><template #default="scope"><el-button :loading="busyTicket === scope.row.ticketId" :disabled="!session.can('admin.support.command')" type="primary" link @click="resolve(scope.row)">提交解决</el-button></template></el-table-column></el-table><el-empty v-else :description="state === 'empty' ? '暂无可见客服工单' : '正在等待服务端投影'" /></el-card>
  </div>
</template>
