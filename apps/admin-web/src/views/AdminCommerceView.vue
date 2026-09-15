<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
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
    errorMessage.value = error instanceof Error ? error.message : 'B13 运营数据读取失败。'
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
    ElMessage.success('工单命令已提交，等待服务端状态更新。')
    await load()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '工单命令提交失败。')
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
    if (!refundChallenge.value) throw new Error('服务端未返回确认挑战。')
    ElMessage.info('退款已进入二次确认；请核对订单后确认执行。')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '退款预检失败。')
  } finally {
    refundBusy.value = false
  }
}

async function confirmRefund(): Promise<void> {
  if (!refundChallenge.value || refundBusy.value) return
  refundBusy.value = true
  try {
    await executeB13Command(refundBody(), refundChallenge.value.token)
    ElMessage.success('退款命令已提交，等待服务端状态更新。')
    refundChallenge.value = null
    refundOrderRef.value = ''
    await load()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '退款命令提交失败。')
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
        <h2>商业事实只读聚合，运营动作走审批命令。</h2>
        <p>订单、指标和客服工单来自 Gateway 的脱敏投影；后台不直接写 commerce、analytics 或 learner 领域表。</p>
      </div>
      <el-button :loading="loading" @click="load">刷新</el-button>
    </div>

    <el-alert title="支付发布闸门：默认关闭" description="B13 当前只验证状态机、回调校验、幂等和恢复路径，不触发真实支付渠道。" type="warning" :closable="false" show-icon />
    <el-alert v-if="errorMessage" :title="errorMessage" type="error" :closable="false" show-icon />

    <el-row :gutter="16">
      <el-col :span="8"><el-card shadow="never"><span class="b13-stat-label">指标投影</span><strong class="b13-stat-value">{{ metrics.length }}</strong><small>版本化、可回算</small></el-card></el-col>
      <el-col :span="8"><el-card shadow="never"><span class="b13-stat-label">订单投影</span><strong class="b13-stat-value">{{ orders.length }}</strong><small>脱敏只读</small></el-card></el-col>
      <el-col :span="8"><el-card shadow="never"><span class="b13-stat-label">待处理工单</span><strong class="b13-stat-value">{{ tickets.length }}</strong><small>SLA 状态由服务端计算</small></el-card></el-col>
    </el-row>

    <el-card shadow="never">
      <template #header><div class="card-header"><span>订单 / 对账投影</span><el-tag type="info">B13-ADM-003</el-tag></div></template>
      <el-table :data="orders" stripe>
        <el-table-column prop="orderRef" label="订单引用" min-width="190" />
        <el-table-column prop="state" label="状态" width="150" />
        <el-table-column label="金额" width="150"><template #default="scope">{{ money(scope.row) }}</template></el-table-column>
        <el-table-column prop="redactionVersion" label="脱敏版本" width="130" />
        <el-table-column prop="createdAt" label="创建时间" min-width="190" />
      </el-table>
      <el-empty v-if="!orders.length" description="暂无订单投影；这不等同于零订单事实。" />
    </el-card>

    <el-card shadow="never">
      <template #header><div class="card-header"><span>退款操作</span><el-tag type="danger">二次确认</el-tag></div></template>
      <p class="b13-refund-note">退款走 COMMERCE_REFUND 审批命令：先预检生成确认挑战，再二次确认执行；服务端幂等，重复提交不会重复退款。</p>
      <div class="b13-refund-form">
        <el-input v-model="refundOrderRef" placeholder="订单引用（orderRef）" clearable style="max-width: 320px" />
        <el-select v-model="refundReason" style="width: 220px" aria-label="退款原因">
          <el-option v-for="reason in REFUND_REASONS" :key="reason" :label="reason" :value="reason" />
        </el-select>
        <el-button type="warning" :loading="refundBusy" :disabled="!refundOrderRef.trim()" @click="prepareRefund">预检退款</el-button>
      </div>
      <div v-if="refundChallenge" class="b13-refund-challenge" role="status">
        <span>待确认退款：{{ refundChallenge.resourceRef }} · 决策 {{ refundChallenge.decisionId || '服务端已受理' }}</span>
        <div>
          <el-button type="danger" :loading="refundBusy" @click="confirmRefund">确认执行退款</el-button>
          <el-button :disabled="refundBusy" @click="refundChallenge = null">取消</el-button>
        </div>
      </div>
    </el-card>

    <el-row :gutter="16">
      <el-col :span="12">
        <el-card shadow="never">
          <template #header><div class="card-header"><span>客服工单</span><el-tag type="warning">脱敏附件引用</el-tag></div></template>
          <el-table :data="tickets" stripe>
            <el-table-column prop="ticketId" label="工单" min-width="160" /><el-table-column prop="categoryCode" label="分类" width="120" /><el-table-column prop="priority" label="优先级" width="100" /><el-table-column prop="state" label="状态" width="110" />
            <el-table-column label="动作" width="100"><template #default="scope"><el-button link type="primary" @click="resolveTicket(scope.row)">提交解决</el-button></template></el-table-column>
          </el-table>
          <el-empty v-if="!tickets.length" description="暂无可见工单" />
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card shadow="never">
          <template #header><div class="card-header"><span>分析指标</span><el-tag type="success">不把空数据伪装成 0</el-tag></div></template>
          <el-table :data="metrics" stripe>
            <el-table-column prop="metricId" label="指标" min-width="150" /><el-table-column prop="metricVersion" label="口径" width="120" /><el-table-column prop="state" label="状态" width="110" /><el-table-column label="值" width="100"><template #default="scope">{{ scope.row.totalValue ?? scope.row.value ?? '—' }}</template></el-table-column>
          </el-table>
          <el-empty v-if="!metrics.length" description="暂无指标投影" />
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<style scoped>
.b13-ops{display:grid;gap:16px}.b13-stat-label{display:block;color:var(--ef-color-text-secondary,#667085);font-size:13px}.b13-stat-value{display:block;margin:8px 0;font-size:30px;color:var(--ef-color-text-primary,#1f2937)}.b13-ops small{color:var(--ef-color-text-secondary,#667085)}.b13-refund-note{margin:0 0 12px;color:var(--ef-color-text-secondary,#667085);font-size:13px;line-height:1.6}.b13-refund-form{display:flex;gap:12px;flex-wrap:wrap;align-items:center}.b13-refund-challenge{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-top:12px;padding:12px 14px;border:1px solid #f2c7ce;border-radius:12px;background:#fff8f9;font-size:13px}.b13-refund-challenge>div{display:flex;gap:8px}
</style>
