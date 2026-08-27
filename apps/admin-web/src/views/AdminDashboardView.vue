<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { getDashboardMetrics } from '../api/b5'
import { isRecord, recordList, unwrap } from '../domain/b5'

const loading = ref(true)
const metrics = ref<Record<string, unknown>>({})
const metricRows = computed(() => Array.isArray(metrics.value.rows) ? metrics.value.rows.filter(isRecord) : [])

async function load(): Promise<void> {
  loading.value = true
  try {
    const source = unwrap(await getDashboardMetrics())
    if (isRecord(source)) metrics.value = source
    else if (Array.isArray(source)) metrics.value = { rows: source }
    else metrics.value = { rows: recordList(source) }
  } catch (error) {
    metrics.value = { unavailable: true }
    ElMessage.warning(error instanceof Error ? error.message : '运营指标暂时不可用')
  } finally {
    loading.value = false
  }
}

onMounted(() => { void load() })
</script>

<template>
  <div class="view-stack">
    <div class="view-intro">
      <div>
        <span class="admin-header__eyebrow">B5 · OPS-ANALYTICS</span>
        <h2>数据要可解释，来源要可追溯。</h2>
        <p>运营指标统一读取 B13 analytics projection；历史兼容端点不再由浏览器调用。</p>
      </div>
      <el-button :loading="loading" @click="load">刷新</el-button>
    </div>
    <el-row :gutter="16">
      <el-col :span="8"><el-card shadow="never" class="metric-card"><span>指标条目</span><strong>{{ Array.isArray(metrics.rows) ? metrics.rows.length : (metrics.unavailable ? '—' : Object.keys(metrics).length) }}</strong><small>服务端投影，不把缺失伪装成 0</small></el-card></el-col>
      <el-col :span="8"><el-card shadow="never" class="metric-card"><span>数据来源</span><strong>B13</strong><small>Gateway → analytics-service</small></el-card></el-col>
      <el-col :span="8"><el-card shadow="never" class="metric-card"><span>发布开关</span><strong>受控</strong><small>Feature Flag 由发布系统管理，页面不再调用历史接口</small></el-card></el-col>
    </el-row>
    <el-alert v-if="metrics.unavailable" title="指标投影暂时不可用" description="当前服务没有可用的持久化投影，页面保持真实的不可用状态，不显示假数据。请先完成 analytics owner 的本地持久化配置。" type="warning" :closable="false" show-icon />
    <el-card v-else shadow="never">
      <template #header><div class="card-header"><span>当前指标投影</span><el-tag type="success">B13 canonical</el-tag></div></template>
      <el-table v-if="metricRows.length" :data="metricRows" stripe>
        <el-table-column prop="metricId" label="指标" min-width="220" />
        <el-table-column prop="metricVersion" label="口径" width="150" />
        <el-table-column prop="state" label="状态" width="140" />
        <el-table-column prop="totalValue" label="值" width="140" />
        <el-table-column prop="periodStart" label="日期" min-width="160" />
      </el-table>
      <el-empty v-else description="暂无可见指标投影" />
    </el-card>
  </div>
</template>
