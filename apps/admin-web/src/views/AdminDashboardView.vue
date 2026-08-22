<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { getDashboardMetrics, listFeatureFlags, updateFeatureFlag } from '../api/b5'
import { num, recordList, toFlag, type AdminFlag, unwrap } from '../domain/b5'

const loading = ref(true)
const metrics = ref<Record<string, unknown>>({})
const flags = ref<AdminFlag[]>([])
async function load(): Promise<void> { loading.value = true; try { const [metricResponse, flagResponse] = await Promise.all([getDashboardMetrics(), listFeatureFlags()]); const metricData = unwrap(metricResponse); metrics.value = metricData && typeof metricData === 'object' ? metricData as Record<string, unknown> : {}; flags.value = recordList(flagResponse).map(toFlag) } catch (error) { ElMessage.error(error instanceof Error ? error.message : '运营数据读取失败') } finally { loading.value = false } }
async function toggle(flag: AdminFlag): Promise<void> { try { const response = await updateFeatureFlag(flag.flagKey, { enabled: !flag.enabled, rolloutPercent: flag.rolloutPercent, ruleVersion: flag.ruleVersion, allowedPlatforms: flag.allowedPlatforms }); Object.assign(flag, toFlag((unwrap(response) ?? {}) as Record<string, unknown>)); ElMessage.success('Flag 已保存，审计记录已追加') } catch (error) { ElMessage.error(error instanceof Error ? error.message : 'Flag 保存失败') } }
onMounted(() => { void load() })
</script>

<template>
  <div class="view-stack"><div class="view-intro"><div><span class="admin-header__eyebrow">B5 · OPS-ANALYTICS</span><h2>数据要可解释，开关要可回滚。</h2><p>缺失指标显示为未完成，不把 0 当作真实业务事实；所有 Flag 默认关闭并带版本审计。</p></div><el-button :loading="loading" @click="load">刷新</el-button></div><el-row :gutter="16"><el-col :span="6"><el-card shadow="never" class="metric-card"><span>DAU</span><strong>{{ metrics.DAU ?? '—' }}</strong><small>{{ metrics.completeness ?? '待接入' }}</small></el-card></el-col><el-col :span="6"><el-card shadow="never" class="metric-card"><span>已支付订单</span><strong>{{ num((metrics.commerce as Record<string, unknown> | undefined)?.ordersPaid) }}</strong><small>服务端订单快照</small></el-card></el-col><el-col :span="6"><el-card shadow="never" class="metric-card"><span>生效权益</span><strong>{{ num((metrics.commerce as Record<string, unknown> | undefined)?.entitlementsActive) }}</strong><small>不含过期状态</small></el-card></el-col><el-col :span="6"><el-card shadow="never" class="metric-card"><span>GMV（分）</span><strong>{{ metrics.GMV_MINOR ?? '—' }}</strong><small>金额最小单位</small></el-card></el-col></el-row><el-card shadow="never"><template #header><div class="card-header"><span>Feature Flag / 发布闸门</span><el-tag type="warning">默认关闭</el-tag></div></template><el-table :data="flags" stripe><el-table-column prop="flagKey" label="Flag" min-width="240" /><el-table-column label="状态" width="110"><template #default="scope"><el-switch v-model="scope.row.enabled" @change="toggle(scope.row)" /></template></el-table-column><el-table-column prop="rolloutPercent" label="灰度 %" width="100" /><el-table-column prop="ruleVersion" label="规则版本" width="150" /><el-table-column label="平台" min-width="260"><template #default="scope"><el-tag v-for="platform in scope.row.allowedPlatforms" :key="platform" size="small" effect="plain">{{ platform }}</el-tag></template></el-table-column></el-table></el-card></div>
</template>
