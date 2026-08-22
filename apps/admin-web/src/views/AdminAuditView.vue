<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { exportAuditReport, searchAuditLogs } from '../api/b5'
import { recordList, toAudit, type AuditEntry } from '../domain/b5'

const rows = ref<AuditEntry[]>([])
const loading = ref(false)
async function load(): Promise<void> { loading.value = true; try { rows.value = recordList(await searchAuditLogs()).map(toAudit) } catch (error) { ElMessage.error(error instanceof Error ? error.message : '审计读取失败') } finally { loading.value = false } }
async function exportReport(): Promise<void> { try { await exportAuditReport(); ElMessage.success('已创建脱敏审计导出任务') } catch (error) { ElMessage.error(error instanceof Error ? error.message : '审计导出失败') } }
onMounted(() => { void load() })
</script>

<template>
  <div class="view-stack"><div class="view-intro"><div><span class="admin-header__eyebrow">B5 · AUDIT</span><h2>可搜索、可导出、可证明删除。</h2><p>审计记录 append-only，导出默认脱敏；保留策略和删除证明由后续合规运行任务接管。</p></div><el-space><el-button :loading="loading" @click="load">刷新</el-button><el-button type="primary" @click="exportReport">创建脱敏导出</el-button></el-space></div><el-alert title="安全边界" type="info" :closable="false" show-icon>页面不展示支付回调原文、签名载荷、原始客服内容或用户联系方式；仅展示 hash / 引用 / 结果码。</el-alert><el-card shadow="never"><el-table :data="rows" stripe><el-table-column prop="occurredAt" label="时间" width="190" /><el-table-column prop="actionCode" label="动作" width="230" /><el-table-column prop="resourceType" label="资源" width="180" /><el-table-column prop="resourceRef" label="引用" min-width="200" /><el-table-column prop="resultCode" label="结果" width="130" /><el-table-column label="脱敏" width="80"><template #default="scope"><el-tag type="success" size="small">{{ scope.row.redacted ? '是' : '否' }}</el-tag></template></el-table-column></el-table><el-empty v-if="!rows.length" description="暂无审计记录" /></el-card></div>
</template>
