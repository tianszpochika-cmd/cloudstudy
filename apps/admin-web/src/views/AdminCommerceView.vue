<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { executeB13Command, listB13AdminOrders, listB13Metrics, listB13SupportTickets } from '../api/b13'
import { recordList, text, num } from '../domain/b5'

type Row = Record<string, unknown>
const orders = ref<Row[]>([])
const tickets = ref<Row[]>([])
const metrics = ref<Row[]>([])
const loading = ref(false)
const errorMessage = ref('')

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
.b13-ops{display:grid;gap:16px}.b13-stat-label{display:block;color:var(--ef-color-text-secondary,#667085);font-size:13px}.b13-stat-value{display:block;margin:8px 0;font-size:30px;color:var(--ef-color-text-primary,#1f2937)}.b13-ops small{color:var(--ef-color-text-secondary,#667085)}
</style>
