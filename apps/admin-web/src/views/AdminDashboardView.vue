<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { adminT } from '../platform/admin-i18n'
import '../platform/i18n-batch-b'
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
    ElMessage.warning(error instanceof Error ? error.message : adminT('dashboardView.metricsUnavailable'))
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
        <h2>{{ adminT('dashboardView.heading') }}</h2>
        <p>{{ adminT('dashboardView.intro') }}</p>
      </div>
      <el-button :loading="loading" @click="load">{{ adminT('dashboardView.refresh') }}</el-button>
    </div>
    <el-row :gutter="16">
      <el-col :span="8"><el-card shadow="never" class="metric-card"><span>{{ adminT('dashboardView.statEntries') }}</span><strong>{{ Array.isArray(metrics.rows) ? metrics.rows.length : (metrics.unavailable ? '—' : Object.keys(metrics).length) }}</strong><small>{{ adminT('dashboardView.statEntriesNote') }}</small></el-card></el-col>
      <el-col :span="8"><el-card shadow="never" class="metric-card"><span>{{ adminT('dashboardView.statSource') }}</span><strong>B13</strong><small>Gateway → analytics-service</small></el-card></el-col>
      <el-col :span="8"><el-card shadow="never" class="metric-card"><span>{{ adminT('dashboardView.statFlag') }}</span><strong>{{ adminT('dashboardView.statFlagValue') }}</strong><small>{{ adminT('dashboardView.statFlagNote') }}</small></el-card></el-col>
    </el-row>
    <el-alert v-if="metrics.unavailable" :title="adminT('dashboardView.unavailableTitle')" :description="adminT('dashboardView.unavailableDesc')" type="warning" :closable="false" show-icon />
    <el-card v-else shadow="never">
      <template #header><div class="card-header"><span>{{ adminT('dashboardView.projectionTitle') }}</span><el-tag type="success">B13 canonical</el-tag></div></template>
      <el-table v-if="metricRows.length" :data="metricRows" stripe>
        <el-table-column prop="metricId" :label="adminT('dashboardView.colMetric')" min-width="220" />
        <el-table-column prop="metricVersion" :label="adminT('dashboardView.colCaliber')" width="150" />
        <el-table-column prop="state" :label="adminT('dashboardView.colState')" width="140" />
        <el-table-column prop="totalValue" :label="adminT('dashboardView.colValue')" width="140" />
        <el-table-column prop="periodStart" :label="adminT('dashboardView.colDate')" min-width="160" />
      </el-table>
      <el-empty v-else :description="adminT('dashboardView.projectionEmpty')" />
    </el-card>
  </div>
</template>
