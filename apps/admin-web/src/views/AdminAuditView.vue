<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { adminT } from '../platform/admin-i18n'
import '../platform/i18n-batch-b'
import { exportAuditReport, searchAuditLogs } from '../api/b5'
import { recordList, toAudit, type AuditEntry } from '../domain/b5'

const rows = ref<AuditEntry[]>([])
const loading = ref(false)
async function load(): Promise<void> { loading.value = true; try { rows.value = recordList(await searchAuditLogs()).map(toAudit) } catch (error) { ElMessage.error(error instanceof Error ? error.message : adminT('auditView.loadFailed')) } finally { loading.value = false } }
async function exportReport(): Promise<void> { try { await exportAuditReport(); ElMessage.success(adminT('auditView.exportCreated')) } catch (error) { ElMessage.error(error instanceof Error ? error.message : adminT('auditView.exportFailed')) } }
onMounted(() => { void load() })
</script>

<template>
  <div class="view-stack"><div class="view-intro"><div><span class="admin-header__eyebrow">B5 · AUDIT</span><h2>{{ adminT('auditView.heading') }}</h2><p>{{ adminT('auditView.intro') }}</p></div><el-space><el-button :loading="loading" @click="load">{{ adminT('auditView.refresh') }}</el-button><el-button type="primary" @click="exportReport">{{ adminT('auditView.createExport') }}</el-button></el-space></div><el-alert :title="adminT('auditView.securityTitle')" type="info" :closable="false" show-icon>{{ adminT('auditView.securityDesc') }}</el-alert><el-card shadow="never"><el-table :data="rows" stripe><el-table-column prop="occurredAt" :label="adminT('auditView.colTime')" width="190" /><el-table-column prop="actionCode" :label="adminT('auditView.colAction')" width="230" /><el-table-column prop="resourceType" :label="adminT('auditView.colResource')" width="180" /><el-table-column prop="resourceRef" :label="adminT('auditView.colRef')" min-width="200" /><el-table-column prop="resultCode" :label="adminT('auditView.colResult')" width="130" /><el-table-column :label="adminT('auditView.colRedacted')" width="80"><template #default="scope"><el-tag type="success" size="small">{{ scope.row.redacted ? adminT('auditView.yes') : adminT('auditView.no') }}</el-tag></template></el-table-column></el-table><el-empty v-if="!rows.length" :description="adminT('auditView.recordsEmpty')" /></el-card></div>
</template>
