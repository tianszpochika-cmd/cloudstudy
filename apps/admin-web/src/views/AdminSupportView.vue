<script setup lang="ts">
import { useListView } from "../platform/list-view";
import { ui } from "../platform/experience";
import AdminPageIntro from "../components/AdminPageIntro.vue";
import { onMounted, ref } from "vue";
import { AdminApiError } from "../api/client";
import { getB18SupportTicket, listB18SupportTickets } from "../api/b18-operations";
import { useAdminStore } from "../stores/admin";
import { adminI18n } from "../platform/v2-foundation";

type Row = Record<string, unknown>;
type ViewState =
  "loading" | "ready" | "empty" | "permission" | "recovery" | "error";

const session = useAdminStore();
const rows = ref<Row[]>([]);
const { query, page, pageSize, filtered, visible } = useListView(rows, [
  "ticketId",
  "categoryCode",
  "priority",
  "state",
  "categoryLabel",
  "priorityLabel",
  "stateLabel",
  "slaLabel",
]);
const state = ref<ViewState>("loading");
const lastError = ref<string | null>(null);
const detailOpen = ref(false);
const detailState = ref<"loading" | "ready" | "error">("loading");
const detail = ref<Row | null>(null);
let detailRequest = 0;

const categories: Record<string, string> = {
  ACCOUNT_SECURITY: "账号安全", LEARNING_SYNC: "学习同步",
  MEDIA_DEVICE: "媒体设备", ENTITLEMENT_ORDER: "订单权益",
  PRIVACY: "隐私", OTHER: "其他",
  CONTENT_CORRECTION: "内容纠错",
  ACCOUNT_ACCESS: "账号访问",
  BILLING: "账单权益",
  LEARNING_DATA: "学习数据",
  PRIVACY_REQUEST: "隐私请求",
  TECHNICAL: "设备问题",
  LEGACY_UNMAPPED: "历史分类",
};
const priorities: Record<string, string> = {
  LOW: "低", NORMAL: "普通", HIGH: "高", URGENT: "紧急",
};
const states: Record<string, string> = {
  ASSIGNED: "已接单", WAITING_USER: "待用户补充", WAITING_INTERNAL: "待内部处理",
  REOPENED: "已重开",
  OPEN: "待处理", ACKNOWLEDGED: "已受理", IN_PROGRESS: "处理中",
  WAITING_CUSTOMER: "待用户补充", RESOLVED: "已解决", CLOSED: "已关闭",
};
const slaStates: Record<string, string> = {
  ON_TRACK: "正常", AT_RISK: "临期", BREACHED: "已超时",
  PAUSED: "已暂停", RESOLVED: "已完成",
};

function label(value: unknown, values: Record<string, string>): string {
  return values[String(value)] ?? "历史值待核验";
}

function dateLabel(value: unknown): string {
  if (typeof value !== "string") return "—";
  return adminI18n.formatDate(value, {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", timeZone: "Asia/Shanghai",
  }) || "—";
}

function detailData(value: unknown): Row | null {
  const data = typeof value === "object" && value !== null && "data" in value
    ? (value as { data?: unknown }).data : value;
  return typeof data === "object" && data !== null && !Array.isArray(data)
    ? data as Row : null;
}

async function openDetail(row: Row): Promise<void> {
  const ticketId = row.ticketId;
  if (typeof ticketId !== "string" || !ticketId.trim()) return;
  const request = ++detailRequest;
  detail.value = null;
  detailState.value = "loading";
  detailOpen.value = true;
  try {
    const result = detailData(await getB18SupportTicket(ticketId));
    if (!result || result.ticketId !== ticketId) throw new Error("INVALID_SUPPORT_DETAIL");
    if (request === detailRequest && detailOpen.value) {
      detail.value = result;
      detailState.value = "ready";
    }
  } catch {
    if (request === detailRequest && detailOpen.value) detailState.value = "error";
  }
}

function unwrapRows(value: unknown): Row[] {
  const source =
    typeof value === "object" && value !== null && "data" in value
      ? (value as { data?: unknown }).data
      : value;
  if (Array.isArray(source))
    return source.filter(
      (item): item is Row => typeof item === "object" && item !== null,
    );
  if (
    typeof source === "object" &&
    source !== null &&
    Array.isArray((source as { items?: unknown }).items)
  )
    return (source as { items: unknown[] }).items.filter(
      (item): item is Row => typeof item === "object" && item !== null,
    );
  return [];
}
function stateFrom(error: unknown): ViewState {
  return error instanceof AdminApiError && error.status === 403
    ? "permission"
    : error instanceof AdminApiError && error.status === 409
      ? "recovery"
      : "error";
}

async function load(): Promise<void> {
  if (!session.can("admin.support.read")) {
    state.value = "permission";
    lastError.value = "当前会话没有客服读取权限。";
    return;
  }
  state.value = "loading";
  lastError.value = null;
  try {
    rows.value = unwrapRows(await listB18SupportTickets()).map((row) => ({
      ...row,
      categoryLabel: label(row.categoryCode, categories),
      priorityLabel: label(row.priority, priorities),
      stateLabel: label(row.state, states),
      slaLabel: label(row.slaState, slaStates),
    }));
    state.value = rows.value.length ? "ready" : "empty";
  } catch (error) {
    state.value = stateFrom(error);
    lastError.value =
      error instanceof AdminApiError && error.status >= 500
        ? "客服工单暂时不可用，请刷新重试。"
        : error instanceof Error ? error.message : "客服工单读取失败。";
  }
}

onMounted(() => {
  void load();
});
</script>

<template>
  <div class="view-stack b18-support">
    <AdminPageIntro
      ><el-button :loading="state === 'loading'" @click="load"
        >刷新</el-button
      ></AdminPageIntro
    >
    <el-alert
      v-if="state === 'permission'"
      title="当前会话没有客服权限"
      type="warning"
      :closable="false"
      show-icon
    />
    <el-alert
      v-else-if="state === 'recovery'"
      title="工单状态已变化，请刷新。"
      type="warning"
      :closable="false"
      show-icon
    />
    <el-alert
      v-else-if="state === 'error'"
      :title="lastError ?? '客服数据暂时不可用'"
      type="error"
      :closable="false"
      show-icon
    />
    <el-alert
      title="历史工单仅供查看，处理功能暂不可用。"
      type="warning"
      :closable="false"
      show-icon
    />
    <el-card shadow="never"
      ><div class="list-toolbar">
        <el-input
          v-model="query"
          clearable
          :placeholder="ui('filter')"
          :aria-label="ui('filter')"
        /><span v-if="state === 'ready' || state === 'empty'" class="list-count">{{
          ui("total", { count: rows.length })
        }}</span>
      </div>
      <el-skeleton v-if="state === 'loading'" :rows="4" animated />
      <el-table v-else-if="filtered.length && state === 'ready'" :data="visible" stripe>
        <el-table-column label="工单引用" min-width="180">
          <template #default="scope">
            <el-button type="primary" link :aria-label="`查看详情 ${scope.row.ticketId}`" @click="openDetail(scope.row)">
              {{ scope.row.ticketId }}
            </el-button>
          </template>
        </el-table-column>
        <el-table-column label="记录类型" width="112">
          <template #default>历史工单</template>
        </el-table-column>
        <el-table-column label="分类" width="140">
          <template #default="scope">{{ label(scope.row.categoryCode, categories) }}</template>
        </el-table-column>
        <el-table-column label="优先级" width="100">
          <template #default="scope">{{ label(scope.row.priority, priorities) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="130">
          <template #default="scope">{{ label(scope.row.state, states) }}</template>
        </el-table-column>
        <el-table-column label="时效" width="120">
          <template #default="scope">{{ label(scope.row.slaState, slaStates) }}</template>
        </el-table-column>
      </el-table>
      <el-empty
        v-else-if="state === 'ready' || state === 'empty'"
        :description="state === 'empty' ? '暂无工单' : '没有匹配的工单'" /><el-button v-else @click="load">{{
        ui("retry")
      }}</el-button>
      <div
        v-if="state === 'ready' && filtered.length > pageSize"
        class="list-footer"
      >
        <el-pagination
          v-model:current-page="page"
          :page-size="pageSize"
          :total="filtered.length"
          layout="prev, pager, next"
        /></div
    ></el-card>
    <el-dialog v-model="detailOpen" title="工单详情" width="min(480px, calc(100vw - 32px))" @closed="detailRequest++">
      <el-skeleton v-if="detailState === 'loading'" :rows="5" animated />
      <el-alert v-else-if="detailState === 'error'" title="详情暂时不可用，请返回列表重试。" type="error" :closable="false" show-icon />
      <div v-else-if="detail" class="support-detail">
        <dl>
          <div><dt>工单引用</dt><dd>{{ detail.ticketId }}</dd></div>
          <div><dt>分类</dt><dd>{{ label(detail.categoryCode, categories) }}</dd></div>
          <div><dt>优先级</dt><dd>{{ label(detail.priority, priorities) }}</dd></div>
          <div><dt>状态</dt><dd>{{ label(detail.state, states) }}</dd></div>
          <div><dt>时效</dt><dd>{{ label(detail.slaState, slaStates) }}</dd></div>
          <div><dt>截止时间</dt><dd>{{ dateLabel(detail.slaDueAt) }}</dd></div>
        </dl>
        <p>此历史工单仅保存脱敏元数据，问题内容不可查看。</p>
      </div>
    </el-dialog>
  </div>
</template>

<style scoped>
.support-detail dl { margin: 0; }
.support-detail dl > div { display: grid; grid-template-columns: 80px minmax(0, 1fr); gap: 12px; padding: 11px 0; border-bottom: 1px solid var(--admin-line-subtle); }
.support-detail dt { color: var(--admin-muted); }
.support-detail dd { margin: 0; overflow-wrap: anywhere; }
.support-detail p { margin: 18px 0 0; color: var(--admin-muted); font-size: 13px; }
</style>
