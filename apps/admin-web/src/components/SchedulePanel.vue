<script setup lang="ts">
import { onMounted, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  getPackDetail,
  readScheduledTasks,
  schedulePublish,
  cancelSchedule,
  type ScheduledTask,
} from "../api/content-items";
import { useAdminStore } from "../stores/admin";

const props = defineProps<{
  packCode: string;
  targets: Array<{
    type: "PACK" | "LEXEME" | "ITEM";
    ref: string;
    label: string;
  }>;
}>();

const session = useAdminStore();
const tasks = ref<ScheduledTask[]>([]);
const loading = ref(false);
const targetRef = ref("");
const runAtLocal = ref("");
const reason = ref("SCHEDULED_PUBLISH");
const cohort = ref("");
const busy = ref(false);
const errorMessage = ref("");

const canPublish = () => session.can("admin.content.publish");

async function load(): Promise<void> {
  loading.value = true;
  errorMessage.value = "";
  try {
    tasks.value = readScheduledTasks(await getPackDetail(props.packCode));
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : "排期列表读取失败。";
  } finally {
    loading.value = false;
  }
}

function toIso(local: string): string {
  const date = new Date(local);
  if (Number.isNaN(date.getTime())) throw new Error("排期时间格式不正确。");
  if (date.getTime() <= Date.now()) throw new Error("请选择未来的发布时间。");
  return date.toISOString();
}

async function create(): Promise<void> {
  if (busy.value || !canPublish()) return;
  const target = props.targets.find((t) => t.ref === targetRef.value);
  if (!target) {
    ElMessage.error("请选择排期对象。");
    return;
  }
  if (!runAtLocal.value) {
    ElMessage.error("请填写排期时间。");
    return;
  }
  busy.value = true;
  try {
    await schedulePublish({
      packCode: props.packCode,
      targetType: target.type,
      targetRef: target.ref,
      runAt: toIso(runAtLocal.value),
      reasonCode: reason.value.trim() || "SCHEDULED_PUBLISH",
      cohort: cohort.value.trim() || undefined,
    });
    ElMessage.success("排期已创建，到期自动执行并复核版本。");
    await load();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "排期创建失败。");
  } finally {
    busy.value = false;
  }
}

async function cancel(task: ScheduledTask): Promise<void> {
  if (busy.value || !canPublish()) return;
  try {
    await ElMessageBox.confirm(
      `确认取消 ${task.targetRef} 的排期？`,
      "取消排期",
      { type: "warning", confirmButtonText: "确认", cancelButtonText: "返回" },
    );
  } catch {
    return;
  }
  try {
    busy.value = true;
    await cancelSchedule(props.packCode, task.taskId);
    ElMessage.success("排期已取消。");
    await load();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "取消失败。");
  }
}

onMounted(() => {
  void load();
});
</script>

<template>
  <el-card shadow="never" class="schedule-panel">
    <template #header>
      <div class="card-header">
        <span>定时排期</span
        ><el-button size="small" :loading="loading" @click="load()"
          >刷新</el-button
        >
      </div>
    </template>
    <el-skeleton v-if="loading" :rows="3" animated /><el-alert
      v-else-if="errorMessage"
      :title="errorMessage"
      type="error"
      :closable="false"
      show-icon
    /><el-table v-else-if="tasks.length" :data="tasks" size="small">
      <el-table-column prop="targetRef" label="对象" min-width="150" />
      <el-table-column prop="targetType" label="类型" width="90" />
      <el-table-column prop="runAt" label="执行时间" min-width="170" />
      <el-table-column prop="status" label="状态" width="120" />
      <el-table-column prop="cohort" label="灰度群" width="110" />
      <el-table-column prop="failureCode" label="失败原因" min-width="140" />
      <el-table-column label="动作" width="110" fixed="right">
        <template #default="scope">
          <el-button
            v-if="scope.row.status === 'SCHEDULED'"
            size="small"
            link
            :disabled="!canPublish() || busy"
            @click="cancel(scope.row)"
            >取消</el-button
          >
        </template>
      </el-table-column>
    </el-table>
    <el-empty v-else description="暂无排期任务" />
    <el-divider>新建排期</el-divider>
    <p v-if="!targets.length" class="hint">
      当前没有可排期的对象。请先完成内容审核，再回来设置发布时间。
    </p>
    <el-space wrap>
      <el-select
        v-model="targetRef"
        aria-label="排期对象"
        placeholder="选择对象"
        style="width: 220px"
      >
        <el-option
          v-for="t in targets"
          :key="t.ref"
          :label="t.label"
          :value="t.ref"
        />
      </el-select>
      <el-input
        v-model="runAtLocal"
        aria-label="发布时间（当前设备时区）"
        type="datetime-local"
        style="width: 220px"
      />
      <el-select
        v-model="reason"
        aria-label="排期原因"
        placeholder="排期原因"
        filterable
        allow-create
        style="width: 180px"
        ><el-option label="按计划发布" value="SCHEDULED_PUBLISH"
      /></el-select>
      <el-input
        v-model="cohort"
        aria-label="灰度群"
        placeholder="灰度群(可选)"
        style="width: 150px"
      />
      <el-button
        type="primary"
        :loading="busy"
        :disabled="!canPublish() || !targets.length"
        @click="create()"
        >创建排期</el-button
      >
    </el-space>
    <p class="hint">
      执行时复核版本：若对象版本已变化，任务失败而不发布错误版本。
    </p>
  </el-card>
</template>

<style scoped>
.hint {
  color: var(--admin-muted);
  font-size: 12px;
  margin-top: 8px;
}
</style>
