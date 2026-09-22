<script setup lang="ts">
import { ui } from "../platform/experience";
import AdminPageIntro from "../components/AdminPageIntro.vue";
import { onMounted, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { AdminApiError } from "../api/client";
import {
  approveRecovery,
  executeRecovery,
  listUnfinishedSagas,
  rejectRecovery,
  requestRecovery,
  type RecoveryView,
} from "../api/recovery";
import { useAdminStore } from "../stores/admin";

type ViewState = "loading" | "ready" | "empty" | "permission" | "error";

const session = useAdminStore();
const state = ref<ViewState>("loading");
const lastError = ref<string | null>(null);
const current = ref<RecoveryView | null>(null);
const sagas = ref<string[]>([]);
const subjectType = ref("TICKET");
const subjectId = ref("");
const action = ref("REOPEN");
const reason = ref("");
const busy = ref(false);

function text(value: unknown, fallback = "—"): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}
function stateFrom(error: unknown): ViewState {
  return error instanceof AdminApiError && error.status === 403
    ? "permission"
    : "error";
}

async function load(): Promise<void> {
  if (!session.can("admin.recovery.read")) {
    state.value = "permission";
    lastError.value = "当前会话没有恢复读取权限。";
    return;
  }
  state.value = "loading";
  lastError.value = null;
  try {
    sagas.value = await listUnfinishedSagas();
    state.value = current.value || sagas.value.length ? "ready" : "empty";
  } catch (error) {
    state.value = stateFrom(error);
    lastError.value =
      error instanceof Error ? error.message : "恢复列表读取失败。";
  }
}

async function request(): Promise<void> {
  if (!session.can("admin.recovery.request")) {
    state.value = "permission";
    lastError.value = "当前会话没有恢复申请权限。";
    return;
  }
  if (
    !subjectId.value.trim() ||
    !reason.value.trim() ||
    !action.value.trim() ||
    !subjectType.value.trim() ||
    busy.value
  ) {
    ElMessage.error("请填写恢复对象、动作和原因。");
    return;
  }
  busy.value = true;
  lastError.value = null;
  try {
    current.value = await requestRecovery({
      subjectType: subjectType.value.trim(),
      subjectId: subjectId.value.trim(),
      action: action.value.trim(),
      reason: reason.value.trim(),
    });
    ElMessage.success("恢复申请已提交，审批必须换人。");
    await load();
  } catch (error) {
    state.value = stateFrom(error);
    lastError.value = error instanceof Error ? error.message : "恢复申请失败。";
  } finally {
    busy.value = false;
  }
}

async function decide(kind: "approve" | "reject" | "execute"): Promise<void> {
  const id = current.value?.recoveryId;
  if (!id || busy.value) return;
  if (!session.can("admin.recovery.command")) {
    state.value = "permission";
    lastError.value = "当前会话没有恢复命令权限。";
    return;
  }
  try {
    await ElMessageBox.confirm(
      kind === "approve"
        ? "确认以第二人身份批准？申请人自己不能批。"
        : kind === "reject"
          ? "确认驳回该恢复申请？"
          : "确认执行已批准的恢复并记录回执？",
      "恢复双人确认",
      { type: "warning", confirmButtonText: "确认", cancelButtonText: "取消" },
    );
  } catch {
    return;
  }
  busy.value = true;
  lastError.value = null;
  try {
    current.value =
      kind === "approve"
        ? await approveRecovery(id)
        : kind === "reject"
          ? await rejectRecovery(id, reason.value.trim())
          : await executeRecovery(id);
    ElMessage.success("恢复命令已提交。");
    await load();
  } catch (error) {
    state.value = stateFrom(error);
    lastError.value = error instanceof Error ? error.message : "恢复命令失败。";
  } finally {
    busy.value = false;
  }
}

onMounted(() => {
  void load();
});
</script>

<template>
  <div class="view-stack">
    <AdminPageIntro
      ><el-button :loading="state === 'loading'" @click="load">{{
        ui("refresh")
      }}</el-button></AdminPageIntro
    >
    <el-card v-if="state === 'loading'"
      ><el-skeleton :rows="4" animated
    /></el-card>
    <el-alert
      v-else-if="state === 'permission'"
      :title="lastError ?? ui('unavailable')"
      type="warning"
      :closable="false"
      show-icon
    />
    <el-alert
      v-else-if="state === 'error'"
      :title="lastError ?? ui('unavailable')"
      type="error"
      :closable="false"
      show-icon
    />
    <template v-else>
      <el-card shadow="never">
        <template #header><span>申请恢复</span></template>
        <el-form label-position="top">
          <el-row :gutter="16">
            <el-col :xs="24" :md="6"
              ><el-form-item label="对象类型"
                ><el-input v-model="subjectType" /></el-form-item
            ></el-col>
            <el-col :xs="24" :md="6"
              ><el-form-item label="对象标识"
                ><el-input
                  v-model="subjectId"
                  placeholder="工单/订单/内容引用" /></el-form-item
            ></el-col>
            <el-col :xs="24" :md="6"
              ><el-form-item label="动作"
                ><el-input v-model="action" /></el-form-item
            ></el-col>
            <el-col :xs="24" :md="6"
              ><el-form-item label="原因"
                ><el-input v-model="reason" /></el-form-item
            ></el-col>
          </el-row>
          <el-button
            type="primary"
            :loading="busy"
            :disabled="!session.can('admin.recovery.request')"
            @click="request"
            >提交恢复申请</el-button
          >
        </el-form>
      </el-card>
      <el-card shadow="never">
        <template #header><span>当前恢复</span></template>
        <p v-if="!current">暂无选中的恢复申请；提交后在此审批执行。</p>
        <dl v-else>
          <div>
            <dt>单号</dt>
            <dd>{{ current.recoveryId }}</dd>
          </div>
          <div>
            <dt>状态</dt>
            <dd>{{ text(current.status) }}</dd>
          </div>
          <div>
            <dt>申请人</dt>
            <dd>{{ text(current.requestedBy) }}</dd>
          </div>
          <div>
            <dt>批准人</dt>
            <dd>{{ text(current.approvedBy) }}</dd>
          </div>
        </dl>
        <el-space v-if="current">
          <el-button
            type="success"
            plain
            :loading="busy"
            :disabled="!session.can('admin.recovery.command')"
            @click="decide('approve')"
            >批准（换人）</el-button
          >
          <el-button
            type="danger"
            plain
            :loading="busy"
            :disabled="!session.can('admin.recovery.command')"
            @click="decide('reject')"
            >驳回</el-button
          >
          <el-button
            type="warning"
            plain
            :loading="busy"
            :disabled="!session.can('admin.recovery.command')"
            @click="decide('execute')"
            >执行</el-button
          >
        </el-space>
      </el-card>
      <el-card shadow="never">
        <template #header><span>待恢复业务流程</span></template>
        <p v-if="!sagas.length" class="muted">暂无待恢复业务流程。</p>
        <ul v-else>
          <li v-for="id in sagas" :key="id">{{ id }}</li>
        </ul>
      </el-card>
    </template>
  </div>
</template>
