<script setup lang="ts">
import { onMounted, watch } from "vue";
import AdminPageIntro from "../components/AdminPageIntro.vue";
import { b12ModeLabel, b12ReasonLabel, b12StatusLabel, b12T } from "../platform/b12-i18n";
import { useAdminStore } from "../stores/admin";
import { B12_MODERATION_STATUSES, useB12AdminStore } from "../stores/b12";

const session = useAdminStore();
const store = useB12AdminStore();

onMounted(() => {
  void store.load();
});
watch(
  () => [session.isAuthenticated, session.principal?.subject, session.permissions.join("\u0000")] as const,
  () => { void store.load(); },
);
</script>

<template>
  <div class="view-stack b12-admin-view">
    <AdminPageIntro>
      <div class="b12-actions">
        <el-select
          :model-value="store.status"
          :aria-label="b12T('status')"
          class="b12-status-filter"
          @change="(value: string) => store.setStatus(value)"
        >
          <el-option
            v-for="status in B12_MODERATION_STATUSES"
            :key="status"
            :label="b12StatusLabel(status)"
            :value="status"
          />
        </el-select>
        <el-button v-if="session.can('admin.recovery.read')" @click="$router.push('/recovery')">
          {{ b12T("recovery") }}
        </el-button>
        <el-button :loading="store.viewState === 'loading'" @click="store.load">
          {{ b12T("refresh") }}
        </el-button>
      </div>
    </AdminPageIntro>

    <el-alert
      v-if="store.viewState === 'permission'"
      :title="store.lastError ?? b12T('permission')"
      type="warning"
      :closable="false"
      show-icon
    />
    <el-alert
      v-else-if="store.viewState === 'error'"
      :title="store.lastError ?? b12T('error')"
      type="error"
      :closable="false"
      show-icon
    />
    <el-card v-else-if="store.viewState === 'loading'" shadow="never">
      <el-skeleton :rows="4" animated />
    </el-card>
    <el-card v-else-if="store.viewState === 'empty'" shadow="never">
      <el-empty :description="b12T('emptyReports')" />
    </el-card>
    <el-card v-else-if="store.viewState === 'ready'" shadow="never" class="b12-report-card">
      <el-table :data="store.reports" stripe style="width: 100%">
        <el-table-column prop="reportId" :label="b12T('reportId')" min-width="190" />
        <el-table-column :label="b12T('status')" min-width="155">
          <template #default="scope">{{ b12StatusLabel(scope.row.status) }}</template>
        </el-table-column>
        <el-table-column :label="b12T('reason')" min-width="175">
          <template #default="scope">{{ b12ReasonLabel(scope.row.reasonCode) }}</template>
        </el-table-column>
        <el-table-column :label="b12T('mode')" min-width="170">
          <template #default="scope">{{ b12ModeLabel(scope.row.reviewMode) }}</template>
        </el-table-column>
        <el-table-column prop="targetRef" :label="b12T('target')" min-width="190" />
        <el-table-column prop="roomRef" :label="b12T('room')" min-width="160" />
        <el-table-column :label="b12T('created')" min-width="170">
          <template #default="scope">{{ scope.row.createdAt ?? '—' }}</template>
        </el-table-column>
      </el-table>
      <el-alert
        v-if="store.moreError"
        class="b12-page-error"
        :title="store.moreError"
        type="warning"
        :closable="false"
        show-icon
      />
      <div v-if="store.nextCursor" class="b12-load-more">
        <el-button :loading="store.loadingMore" @click="store.loadMore">
          {{ b12T(store.moreError ? "retryMore" : "loadMore") }}
        </el-button>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.b12-admin-view {
  max-width: 1500px;
  min-width: 0;
}
.b12-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.b12-actions :deep(.el-button + .el-button) {
  margin-left: 0;
}
.b12-status-filter {
  width: 140px;
  max-width: 100%;
}
.b12-report-card {
  min-width: 0;
  overflow: hidden;
}
.b12-page-error {
  margin-top: 12px;
}
.b12-load-more {
  display: flex;
  justify-content: center;
  padding-top: 12px;
}
</style>
