<script setup lang="ts">
import { useListView } from "../platform/list-view";
import { ui } from "../platform/experience";
import AdminPageIntro from "../components/AdminPageIntro.vue";
import { onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import { exportAuditReport, searchAuditLogs } from "../api/b5";
import { recordList, toAudit, type AuditEntry } from "../domain/b5";

const rows = ref<AuditEntry[]>([]);
const loading = ref(false);
const errorMessage = ref("");
const exporting = ref(false);
const { query, page, pageSize, filtered, visible } = useListView(rows, [
  "actionCode",
  "resourceType",
  "resourceRef",
  "resultCode",
]);
async function load(): Promise<void> {
  loading.value = true;
  errorMessage.value = "";
  try {
    rows.value = recordList(await searchAuditLogs()).map(toAudit);
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : ui("unavailable");
  } finally {
    loading.value = false;
  }
}
async function exportReport(): Promise<void> {
  if (exporting.value) return;
  exporting.value = true;
  try {
    await exportAuditReport();
    ElMessage.success("已创建脱敏审计导出任务");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "审计导出失败");
  } finally {
    exporting.value = false;
  }
}
onMounted(() => {
  void load();
});
</script>

<template>
  <div class="view-stack">
    <AdminPageIntro
      ><el-space
        ><el-button :loading="loading" @click="load">刷新</el-button
        ><el-button type="primary" :loading="exporting" @click="exportReport"
          >创建脱敏导出</el-button
        ></el-space
      ></AdminPageIntro
    ><el-alert title="安全边界" type="info" :closable="false" show-icon
      >页面不展示支付回调原文、签名载荷、原始客服内容或用户联系方式；仅展示 hash
      / 引用 / 结果码。</el-alert
    ><el-card shadow="never"
      ><div class="list-toolbar">
        <el-input
          v-model="query"
          clearable
          :placeholder="ui('filter')"
          :aria-label="ui('filter')"
        /><span class="list-count">{{
          ui("total", { count: rows.length })
        }}</span>
      </div>
      <el-skeleton v-if="loading" :rows="4" animated /><el-alert
        v-else-if="errorMessage"
        :title="errorMessage"
        type="error"
        :closable="false"
        show-icon /><el-table v-else-if="filtered.length" :data="visible" stripe
        ><el-table-column
          prop="occurredAt"
          label="时间"
          width="190"
        /><el-table-column
          prop="actionCode"
          label="动作"
          width="230"
        /><el-table-column
          prop="resourceType"
          label="资源"
          width="180"
        /><el-table-column
          prop="resourceRef"
          label="引用"
          min-width="200"
        /><el-table-column
          prop="resultCode"
          label="结果"
          width="130"
        /><el-table-column label="脱敏" width="80"
          ><template #default="scope"
            ><el-tag type="success" size="small">{{
              scope.row.redacted ? "是" : "否"
            }}</el-tag></template
          ></el-table-column
        ></el-table
      ><el-empty v-else :description="ui('empty')" />
      <div
        v-if="!loading && !errorMessage && filtered.length > pageSize"
        class="list-footer"
      >
        <el-pagination
          v-model:current-page="page"
          :page-size="pageSize"
          :total="filtered.length"
          layout="prev, pager, next"
        /></div
    ></el-card>
  </div>
</template>
