<script setup lang="ts">
import AdminPageIntro from "../components/AdminPageIntro.vue";
import { onMounted, ref } from "vue";
import { useAdminStore } from "../stores/admin";
import { useB12AdminStore } from "../stores/b12";
import {
  B12_MODERATION_COMMANDS,
  B12_RECOVERY_COMMANDS,
  type B12ModerationCommand,
  type B12RecoveryCommand,
} from "../domain/b12";
import { b12T } from "../platform/b12-i18n";

const session = useAdminStore();
const store = useB12AdminStore();
const activeTab = ref<"moderation" | "recovery">("moderation");
const moderationCommands = [...B12_MODERATION_COMMANDS];
const recoveryCommands = [...B12_RECOVERY_COMMANDS];

function moderationLabel(command: B12ModerationCommand): string {
  return {
    START_REVIEW: b12T("startReview"),
    RESOLVE: b12T("resolve"),
    DISMISS: b12T("dismiss"),
    ESCALATE: b12T("escalate"),
  }[command];
}
function recoveryLabel(command: B12RecoveryCommand): string {
  return {
    RETRY: b12T("retryCommand"),
    REPLAY: b12T("requeue"),
    CANCEL: b12T("cancel"),
    MANUAL_REVIEW: b12T("markResolved"),
  }[command];
}
function runModeration(reportId: string, command: B12ModerationCommand): void {
  void store.runModerationCommand(reportId, command);
}
function runRecovery(taskId: string, command: B12RecoveryCommand): void {
  void store.runRecoveryCommand(taskId, command);
}

onMounted(async () => {
  await store.load();
  if (
    !session.can("admin.moderation.read") &&
    session.can("admin.recovery.read")
  )
    activeTab.value = "recovery";
});
</script>

<template>
  <div class="view-stack b12-admin-view">
    <AdminPageIntro
      ><el-button
        :loading="store.viewState === 'loading'"
        @click="store.load"
        >{{ b12T("refresh") }}</el-button
      ></AdminPageIntro
    >
    <el-alert
      :title="b12T('auditNotice')"
      type="info"
      :closable="false"
      show-icon
    />
    <el-alert
      v-if="store.viewState === 'permission'"
      :title="b12T('permission')"
      type="warning"
      :closable="false"
      show-icon
    />
    <el-alert
      v-else-if="store.viewState === 'recovery'"
      :title="b12T('recoveryState')"
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
    <el-alert
      v-if="store.lastSuccess"
      :title="store.lastSuccess"
      type="success"
      :closable="false"
      show-icon
    >
      <span v-if="store.lastRequestId"
        >{{ b12T("requestId") }}：{{ store.lastRequestId }}</span
      >
    </el-alert>

    <el-tabs v-model="activeTab" class="b12-tabs">
      <el-tab-pane
        v-if="session.can('admin.moderation.read')"
        name="moderation"
        :label="b12T('moderation')"
      >
        <el-card shadow="never" v-loading="store.viewState === 'loading'">
          <el-table v-if="store.reports.length" :data="store.reports" stripe>
            <el-table-column prop="reportId" label="举报编号" min-width="190" />
            <el-table-column prop="status" label="状态" width="130" />
            <el-table-column
              prop="reasonCode"
              :label="b12T('reason')"
              width="170"
            />
            <el-table-column
              prop="reviewMode"
              :label="b12T('mode')"
              width="130"
            />
            <el-table-column
              prop="targetRef"
              :label="b12T('target')"
              min-width="190"
            />
            <el-table-column
              prop="roomRef"
              :label="b12T('room')"
              min-width="160"
            />
            <el-table-column
              prop="createdAt"
              :label="b12T('created')"
              min-width="170"
            />
            <el-table-column
              v-if="session.can('admin.moderation.command')"
              :label="b12T('command')"
              min-width="280"
              fixed="right"
            >
              <template #default="scope"
                ><el-space wrap
                  ><el-button
                    v-for="command in moderationCommands"
                    :key="command"
                    size="small"
                    :loading="
                      store.busyKey ===
                      `moderation.${scope.row.reportId}.${command}`
                    "
                    @click="runModeration(scope.row.reportId, command)"
                    >{{ moderationLabel(command) }}</el-button
                  ></el-space
                ></template
              >
            </el-table-column>
          </el-table>
          <el-empty v-else :description="b12T('emptyReports')" />
        </el-card>
      </el-tab-pane>
      <el-tab-pane
        v-if="session.can('admin.recovery.read')"
        name="recovery"
        :label="b12T('recovery')"
      >
        <el-card shadow="never" v-loading="store.viewState === 'loading'">
          <el-table
            v-if="store.recoveryTasks.length"
            :data="store.recoveryTasks"
            stripe
          >
            <el-table-column prop="taskId" label="任务编号" min-width="190" />
            <el-table-column
              prop="domain"
              :label="b12T('domain')"
              width="170"
            />
            <el-table-column prop="status" label="状态" width="140" />
            <el-table-column
              prop="reasonCode"
              :label="b12T('reason')"
              min-width="170"
            />
            <el-table-column
              prop="updatedAt"
              :label="b12T('updated')"
              min-width="170"
            />
            <el-table-column :label="b12T('retryable')" width="100"
              ><template #default="scope"
                ><el-tag
                  :type="scope.row.retryable ? 'success' : 'info'"
                  effect="plain"
                  >{{ scope.row.retryable ? "是" : "否" }}</el-tag
                ></template
              ></el-table-column
            >
            <el-table-column
              v-if="session.can('admin.recovery.command')"
              :label="b12T('command')"
              min-width="300"
              fixed="right"
            >
              <template #default="scope"
                ><el-space wrap
                  ><el-button
                    v-for="command in recoveryCommands"
                    :key="command"
                    size="small"
                    :disabled="command === 'RETRY' && !scope.row.retryable"
                    :loading="
                      store.busyKey ===
                      `recovery.${scope.row.taskId}.${command}`
                    "
                    @click="runRecovery(scope.row.taskId, command)"
                    >{{ recoveryLabel(command) }}</el-button
                  ></el-space
                ></template
              >
            </el-table-column>
          </el-table>
          <el-empty v-else :description="b12T('emptyRecovery')" />
        </el-card>
      </el-tab-pane>
    </el-tabs>
    <p v-if="store.viewState === 'permission'" class="b12-admin-note">
      {{ b12T("noCommandPermission") }}
    </p>
  </div>
</template>

<style scoped>
.b12-admin-view {
  max-width: 1500px;
}
.b12-tabs {
  min-width: 0;
}
.b12-admin-note {
  margin: 0;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
}
</style>
