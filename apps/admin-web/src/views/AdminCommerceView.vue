<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { adminT } from '../platform/admin-i18n'
import '../platform/i18n-batch-b'
import { executeB13Command, listB13AdminOrders, listB13Metrics, listB13SupportTickets, prepareB13Command } from '../api/b13'
import { recordList, text, num } from '../domain/b5'

type Row = Record<string, unknown>
const orders = ref<Row[]>([])
const tickets = ref<Row[]>([])
const metrics = ref<Row[]>([])
const loading = ref(false)
const errorMessage = ref('')
const refundOrderRef = ref('')
const refundReason = ref('USER_REQUEST')
const refundChallenge = ref<{ token: string; decisionId: string; resourceRef: string } | null>(null)
const refundBusy = ref(false)

function rows(value: unknown): Row[] {
  if (Array.isArray(value)) return value.filter((item): item is Row => typeof item === 'object' && item !== null)
  return recordList(value)
}

function unwrapRows(value: unknown): Row[] {
  const source = value && typeof value === 'object' && 'data' in value
    ? (value as { data?: unknown }).data
    : value
  return rows(source)
}

function money(row: Row): string {
  const amount = num(row.amountMinor, num(row.value))
  const currency = text(row.currency, 'CNY')
  return `${currency} ${(amount / 100).toFixed(2)}`
}

async function load(): Promise<void> {
  loading.value = true
  errorMessage.value = ''
  try {
    const [orderResponse, ticketResponse, metricResponse] = await Promise.all([
      listB13AdminOrders(), listB13SupportTickets(), listB13Metrics(),
    ])
    orders.value = unwrapRows(orderResponse)
    tickets.value = unwrapRows(ticketResponse)
    metrics.value = unwrapRows(metricResponse)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : adminT('commerceView.loadFailed')
  } finally {
    loading.value = false
  }
}

async function resolveTicket(ticket: Row): Promise<void> {
  const ticketId = text(ticket.ticketId)
  if (!ticketId) return
  try {
    await executeB13Command({
      aggregateType: 'SUPPORT', aggregateRef: ticketId, actionCode: 'SUPPORT_RESOLVE', reasonCode: 'ADMIN_SUPPORT',
    })
    ElMessage.success(adminT('commerceView.ticketResolved'))
    await load()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : adminT('commerceView.ticketResolveFailed'))
  }
}

const REFUND_REASONS = ['USER_REQUEST', 'DUPLICATE_CHARGE', 'SERVICE_ISSUE', 'ADMIN_REVIEW'] as const

function refundBody(): Record<string, unknown> {
  return {
    aggregateType: 'COMMERCE',
    aggregateRef: refundOrderRef.value.trim(),
    actionCode: 'COMMERCE_REFUND',
    reasonCode: refundReason.value,
  }
}

function parseChallenge(value: unknown): { token: string; decisionId: string; resourceRef: string } | null {
  const root = value && typeof value === 'object' && 'data' in value
    ? (value as { data?: unknown }).data
    : value
  if (!root || typeof root !== 'object') return null
  const record = root as Record<string, unknown>
  const token = text(record.token)
  if (!token) return null
  return { token, decisionId: text(record.decisionId), resourceRef: text(record.resourceRef, refundOrderRef.value.trim()) }
}

async function prepareRefund(): Promise<void> {
  if (!refundOrderRef.value.trim() || refundBusy.value) return
  refundBusy.value = true
  refundChallenge.value = null
  try {
    refundChallenge.value = parseChallenge(await prepareB13Command(refundBody()))
    if (!refundChallenge.value) throw new Error(adminT('commerceView.challengeMissing'))
    ElMessage.info(adminT('commerceView.refundChallengeReady'))
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : adminT('commerceView.refundPrepareFailed'))
  } finally {
    refundBusy.value = false
  }
}

async function confirmRefund(): Promise<void> {
  if (!refundChallenge.value || refundBusy.value) return
  refundBusy.value = true
  try {
    await executeB13Command(refundBody(), refundChallenge.value.token)
    ElMessage.success(adminT('commerceView.refundSubmitted'))
    refundChallenge.value = null
    refundOrderRef.value = ''
    await load()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : adminT('commerceView.refundFailed'))
  } finally {
    refundBusy.value = false
  }
}

onMounted(() => { void load() })
</script>

<template>
  <div class="view-stack b13-ops">
    <div class="view-intro">
      <div>
        <span class="admin-header__eyebrow">B13 · COMMERCE / OPS / SUPPORT</span>
        <h2>{{ adminT('commerceView.heading') }}</h2>
        <p>{{ adminT('commerceView.intro') }}</p>
      </div>
      <el-button :loading="loading" @click="load">{{ adminT('commerceView.refresh') }}</el-button>
    </div>

    <el-alert :title="adminT('commerceView.payGateTitle')" :description="adminT('commerceView.payGateDesc')" type="warning" :closable="false" show-icon />
    <el-alert v-if="errorMessage" :title="errorMessage" type="error" :closable="false" show-icon />

    <el-row :gutter="16">
      <el-col :span="8"><el-card shadow="never"><span class="b13-stat-label">{{ adminT('commerceView.statMetrics') }}</span><strong class="b13-stat-value">{{ metrics.length }}</strong><small>{{ adminT('commerceView.statMetricsNote') }}</small></el-card></el-col>
      <el-col :span="8"><el-card shadow="never"><span class="b13-stat-label">{{ adminT('commerceView.statOrders') }}</span><strong class="b13-stat-value">{{ orders.length }}</strong><small>{{ adminT('commerceView.statOrdersNote') }}</small></el-card></el-col>
      <el-col :span="8"><el-card shadow="never"><span class="b13-stat-label">{{ adminT('commerceView.statTickets') }}</span><strong class="b13-stat-value">{{ tickets.length }}</strong><small>{{ adminT('commerceView.statTicketsNote') }}</small></el-card></el-col>
    </el-row>

    <el-card shadow="never">
      <template #header><div class="card-header"><span>{{ adminT('commerceView.ordersTitle') }}</span><el-tag type="info">B13-ADM-003</el-tag></div></template>
      <el-table :data="orders" stripe>
        <el-table-column prop="orderRef" :label="adminT('commerceView.colOrderRef')" min-width="190" />
        <el-table-column prop="state" :label="adminT('commerceView.colState')" width="150" />
        <el-table-column :label="adminT('commerceView.colAmount')" width="150"><template #default="scope">{{ money(scope.row) }}</template></el-table-column>
        <el-table-column prop="redactionVersion" :label="adminT('commerceView.colRedaction')" width="130" />
        <el-table-column prop="createdAt" :label="adminT('commerceView.colCreated')" min-width="190" />
      </el-table>
      <el-empty v-if="!orders.length" :description="adminT('commerceView.ordersEmpty')" />
    </el-card>

    <el-card shadow="never">
      <template #header><div class="card-header"><span>{{ adminT('commerceView.refundTitle') }}</span><el-tag type="danger">{{ adminT('commerceView.refundTwoFactor') }}</el-tag></div></template>
      <p class="b13-refund-note">{{ adminT('commerceView.refundNote') }}</p>
      <div class="b13-refund-form">
        <el-input v-model="refundOrderRef" :placeholder="adminT('commerceView.refundOrderPlaceholder')" clearable style="max-width: 320px" />
        <el-select v-model="refundReason" style="width: 220px" :aria-label="adminT('commerceView.refundReasonLabel')">
          <el-option v-for="reason in REFUND_REASONS" :key="reason" :label="reason" :value="reason" />
        </el-select>
        <el-button type="warning" :loading="refundBusy" :disabled="!refundOrderRef.trim()" @click="prepareRefund">{{ adminT('commerceView.prepareRefund') }}</el-button>
      </div>
      <div v-if="refundChallenge" class="b13-refund-challenge" role="status">
        <span>{{ adminT('commerceView.pendingRefund', { resourceRef: refundChallenge.resourceRef, decision: refundChallenge.decisionId || adminT('commerceView.challengeAcceptedFallback') }) }}</span>
        <div>
          <el-button type="danger" :loading="refundBusy" @click="confirmRefund">{{ adminT('commerceView.confirmRefund') }}</el-button>
          <el-button :disabled="refundBusy" @click="refundChallenge = null">{{ adminT('commerceView.cancel') }}</el-button>
        </div>
      </div>
    </el-card>

    <el-row :gutter="16">
      <el-col :span="12">
        <el-card shadow="never">
          <template #header><div class="card-header"><span>{{ adminT('commerceView.ticketsTitle') }}</span><el-tag type="warning">{{ adminT('commerceView.ticketsTag') }}</el-tag></div></template>
          <el-table :data="tickets" stripe>
            <el-table-column prop="ticketId" :label="adminT('commerceView.colTicket')" min-width="160" /><el-table-column prop="categoryCode" :label="adminT('commerceView.colCategory')" width="120" /><el-table-column prop="priority" :label="adminT('commerceView.colPriority')" width="100" /><el-table-column prop="state" :label="adminT('commerceView.colState')" width="110" />
            <el-table-column :label="adminT('commerceView.colAction')" width="100"><template #default="scope"><el-button link type="primary" @click="resolveTicket(scope.row)">{{ adminT('commerceView.resolveTicket') }}</el-button></template></el-table-column>
          </el-table>
          <el-empty v-if="!tickets.length" :description="adminT('commerceView.ticketsEmpty')" />
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card shadow="never">
          <template #header><div class="card-header"><span>{{ adminT('commerceView.metricsTitle') }}</span><el-tag type="success">{{ adminT('commerceView.metricsTag') }}</el-tag></div></template>
          <el-table :data="metrics" stripe>
            <el-table-column prop="metricId" :label="adminT('commerceView.colMetric')" min-width="150" /><el-table-column prop="metricVersion" :label="adminT('commerceView.colCaliber')" width="120" /><el-table-column prop="state" :label="adminT('commerceView.colState')" width="110" /><el-table-column :label="adminT('commerceView.colValue')" width="100"><template #default="scope">{{ scope.row.totalValue ?? scope.row.value ?? '—' }}</template></el-table-column>
          </el-table>
          <el-empty v-if="!metrics.length" :description="adminT('commerceView.metricsEmpty')" />
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<style scoped>
.b13-ops{display:grid;gap:16px}.b13-stat-label{display:block;color:var(--ef-color-text-secondary,#667085);font-size:13px}.b13-stat-value{display:block;margin:8px 0;font-size:30px;color:var(--ef-color-text-primary,#1f2937)}.b13-ops small{color:var(--ef-color-text-secondary,#667085)}.b13-refund-note{margin:0 0 12px;color:var(--ef-color-text-secondary,#667085);font-size:13px;line-height:1.6}.b13-refund-form{display:flex;gap:12px;flex-wrap:wrap;align-items:center}.b13-refund-challenge{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-top:12px;padding:12px 14px;border:1px solid #f2c7ce;border-radius:12px;background:#fff8f9;font-size:13px}.b13-refund-challenge>div{display:flex;gap:8px}
</style>
