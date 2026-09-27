<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import AdminPageIntro from "../components/AdminPageIntro.vue";
import { b12ModeLabel, b12ReasonLabel, b12StatusLabel, b12T } from "../platform/b12-i18n";
import { useAdminStore } from "../stores/admin";
import { B12_MODERATION_STATUSES, useB12AdminStore } from "../stores/b12";
import { RISK_CATEGORIES, RISK_COMMANDS, RISK_SEVERITIES, useRiskAdminStore } from "../stores/risk";

const session = useAdminStore();
const store = useB12AdminStore();
const risk = useRiskAdminStore();

const showFileForm = ref(false);
const fileCategory = ref<string>("ACCOUNT_SECURITY");
const fileSeverity = ref<string>("MEDIUM");
const fileTitle = ref("");
const fileSubject = ref("");
const fileNote = ref("");
const decideCaseId = ref("");
const decideCommand = ref<string>("TRIAGE");
const decideReason = ref("");
const decideRef = ref("");
const decideTarget = ref("AUDIT");

async function submitFile(): Promise<void> {
  if (!fileTitle.value.trim()) return;
  const ok = await risk.fileCase({
    category: fileCategory.value,
    severity: fileSeverity.value,
    title: fileTitle.value.trim(),
    subjectRef: fileSubject.value.trim() || undefined,
    note: fileNote.value.trim() || undefined,
  });
  if (ok) {
    showFileForm.value = false;
    fileTitle.value = "";
    fileSubject.value = "";
    fileNote.value = "";
  }
}

function openDecide(caseId: string, command: string): void {
  decideCaseId.value = caseId;
  decideCommand.value = command;
  decideReason.value = "";
  decideRef.value = "";
}

async function submitDecide(): Promise<void> {
  if (!decideCaseId.value || !decideReason.value.trim()) return;
  const input: Record<string, string> = { command: decideCommand.value, reason: decideReason.value.trim() };
  if (decideCommand.value === "ISOLATE") input.containmentRef = decideRef.value.trim();
  if (decideCommand.value === "ESCALATE") {
    input.escalationTarget = decideTarget.value;
    if (decideRef.value.trim()) input.escalationRef = decideRef.value.trim();
  }
  if (decideCommand.value === "TRIAGE" && decideRef.value.trim()) input.assigneeNote = decideRef.value.trim();
  const ok = await risk.decide(decideCaseId.value, {
    command: input.command,
    reason: input.reason,
    assigneeNote: input.assigneeNote,
    containmentRef: input.containmentRef,
    escalationTarget: input.escalationTarget,
    escalationRef: input.escalationRef,
  });
  if (ok) decideCaseId.value = "";
}

onMounted(() => {
  void store.load();
  void risk.load();
});
watch(
  () => [session.isAuthenticated, session.principal?.subject, session.permissions.join("\u0000")] as const,
  () => { void store.load(); void risk.load(); },
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

    <el-card shadow="never" class="risk-card">
      <template #header>
        <div class="risk-heading">
          <span>风险案件（并入治理页，无独立路由）</span>
          <div class="risk-actions">
            <el-button size="small" :loading="risk.busy" @click="risk.load">刷新</el-button>
            <el-button
              v-if="risk.canWrite()"
              size="small"
              :loading="risk.busy"
              @click="risk.evaluate"
            >评估规则</el-button>
            <el-button v-if="risk.canWrite()" size="small" type="primary" @click="showFileForm = !showFileForm">
              {{ showFileForm ? "收起" : "新建案件" }}
            </el-button>
          </div>
        </div>
      </template>
      <el-alert v-if="risk.viewState === 'permission'" title="当前账号没有风险案件读取权限。" type="warning" :closable="false" show-icon />
      <el-alert v-else-if="risk.viewState === 'error'" :title="risk.lastError ?? '风险队列读取失败。'" type="error" :closable="false" show-icon />
      <el-alert v-else-if="risk.viewState === 'loading'" title="风险队列读取中。" type="info" :closable="false" show-icon />
      <el-empty v-else-if="risk.viewState === 'empty'" description="暂无风险案件：队列诚实为空。" />
      <el-table v-else-if="risk.viewState === 'ready'" :data="risk.cases" stripe style="width: 100%">
        <el-table-column prop="caseId" label="案件" min-width="200" />
        <el-table-column prop="category" label="类别" min-width="130" />
        <el-table-column prop="severity" label="严重度" min-width="90" />
        <el-table-column prop="status" label="状态" min-width="110" />
        <el-table-column prop="source" label="来源" min-width="120" />
        <el-table-column prop="title" label="标题" min-width="200" />
        <el-table-column label="处置" min-width="300">
          <template #default="scope">
            <el-button
              v-for="command in RISK_COMMANDS"
              :key="command"
              size="small"
              :disabled="!risk.canWrite() || risk.busy"
              @click="openDecide(scope.row.caseId, command)"
            >{{ command }}</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-alert v-if="risk.lastNotice" :title="risk.lastNotice" type="success" :closable="false" show-icon class="risk-notice" />
      <el-alert v-if="risk.lastError && risk.viewState !== 'error'" :title="risk.lastError" type="error" :closable="false" show-icon class="risk-notice" />
      <div v-if="showFileForm" class="risk-form">
        <el-select v-model="fileCategory" placeholder="类别" style="width: 200px">
          <el-option v-for="category in RISK_CATEGORIES" :key="category" :label="category" :value="category" />
        </el-select>
        <el-select v-model="fileSeverity" placeholder="严重度" style="width: 140px">
          <el-option v-for="severity in RISK_SEVERITIES" :key="severity" :label="severity" :value="severity" />
        </el-select>
        <el-input v-model="fileTitle" placeholder="标题（必填）" style="width: 320px" />
        <el-input v-model="fileSubject" placeholder="主体引用（可选）" style="width: 220px" />
        <el-input v-model="fileNote" placeholder="备注（可选）" style="width: 220px" />
        <el-button type="primary" :loading="risk.busy" @click="submitFile">提交建档</el-button>
      </div>
      <el-dialog :model-value="!!decideCaseId" title="记录处置决定" width="480px" :close-on-click-modal="false" @close="decideCaseId = ''">
        <p>案件 {{ decideCaseId }} · {{ decideCommand }}</p>
        <el-input v-model="decideReason" type="textarea" :rows="3" placeholder="处置原因（必填）" />
        <el-input
          v-model="decideRef"
          :placeholder="decideCommand === 'ISOLATE' ? '隔离凭据引用（必填，如内容下架命令号）' : decideCommand === 'ESCALATE' ? '升级外部引用（可选）' : '附加备注（可选）'"
          style="margin-top: 12px"
        />
        <el-select v-if="decideCommand === 'ESCALATE'" v-model="decideTarget" style="margin-top: 12px; width: 200px">
          <el-option label="SUPPORT" value="SUPPORT" />
          <el-option label="AUDIT" value="AUDIT" />
        </el-select>
        <template #footer>
          <el-button @click="decideCaseId = ''">取消</el-button>
          <el-button type="primary" :loading="risk.busy" :disabled="!decideReason.trim()" @click="submitDecide">确认</el-button>
        </template>
      </el-dialog>
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
.risk-card {
  margin-top: 16px;
}
.risk-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}
.risk-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.risk-notice {
  margin-top: 12px;
}
.risk-form {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 12px;
}
</style>
