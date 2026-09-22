<script setup lang="ts">
import { useListView } from "../platform/list-view";
import { ui } from "../platform/experience";
import AdminPageIntro from "../components/AdminPageIntro.vue";
import { computed, onMounted, ref, watch } from "vue";
import { useAdminStore } from "../stores/admin";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  executeB13Command,
  listB13AdminOrders,
  listB13Metrics,
  listB13SupportTickets,
  prepareB13Command,
} from "../api/b13";
import { recordList, text } from "../domain/b5";

type Row = Record<string, unknown>;
const session = useAdminStore();
const canReadTickets = computed(() => session.can("admin.support.read"));
const canReadMetrics = computed(() => session.can("admin.dashboard.read"));
const ticketError = ref("");
const metricError = ref("");
const ticketBusy = ref(false);
const orders = ref<Row[]>([]);
const tickets = ref<Row[]>([]);
const metrics = ref<Row[]>([]);
const { query, page, pageSize, filtered, visible } = useListView(orders, [
  "orderRef",
  "state",
  "createdAt",
]);
const loading = ref(false);
const errorMessage = ref("");
const refundForm = ref<HTMLElement | null>(null);
const refundOrderRef = ref("");
const refundReason = ref("USER_REQUEST");
const refundChallenge = ref<{
  token: string;
  decisionId: string;
  resourceRef: string;
} | null>(null);
const refundBusy = ref(false);
watch([refundOrderRef, refundReason], () => {
  refundChallenge.value = null;
});

function rows(value: unknown): Row[] {
  if (Array.isArray(value))
    return value.filter(
      (item): item is Row => typeof item === "object" && item !== null,
    );
  return recordList(value);
}

function unwrapRows(value: unknown): Row[] {
  const source =
    value && typeof value === "object" && "data" in value
      ? (value as { data?: unknown }).data
      : value;
  return rows(source);
}

function money(row: Row): string {
  const amount =
    typeof row.amountMinor === "number"
      ? row.amountMinor
      : typeof row.value === "number"
        ? row.value
        : null;
  if (amount === null || !Number.isFinite(amount)) return "—";
  const currency = text(row.currency, "CNY");
  return `${currency} ${(amount / 100).toFixed(2)}`;
}

async function load(): Promise<void> {
  loading.value = true;
  errorMessage.value = "";
  ticketError.value = "";
  metricError.value = "";
  const results = await Promise.allSettled([
    listB13AdminOrders(),
    canReadTickets.value ? listB13SupportTickets() : Promise.resolve(null),
    canReadMetrics.value ? listB13Metrics() : Promise.resolve(null),
  ]);
  const [orderResult, ticketResult, metricResult] = results;
  if (orderResult.status === "fulfilled")
    orders.value = unwrapRows(orderResult.value);
  else {
    orders.value = [];
    errorMessage.value =
      orderResult.reason instanceof Error
        ? orderResult.reason.message
        : "订单读取失败，请重试。";
  }
  if (ticketResult.status === "fulfilled")
    tickets.value = unwrapRows(ticketResult.value);
  else {
    tickets.value = [];
    ticketError.value = "工单暂时不可用，可刷新重试。";
  }
  if (metricResult.status === "fulfilled")
    metrics.value = unwrapRows(metricResult.value);
  else {
    metrics.value = [];
    metricError.value = "指标暂时不可用，可刷新重试。";
  }
  loading.value = false;
}

async function resolveTicket(ticket: Row): Promise<void> {
  if (
    ticketBusy.value ||
    !session.can("admin.support.command") ||
    ["RESOLVED", "CLOSED"].includes(text(ticket.state))
  )
    return;
  const ticketId = text(ticket.ticketId);
  if (!ticketId) return;
  try {
    await ElMessageBox.confirm("确认将该工单提交为已解决？", "确认处理工单", {
      confirmButtonText: "确认",
      cancelButtonText: "取消",
      type: "warning",
    });
  } catch {
    return;
  }
  ticketBusy.value = true;
  try {
    await executeB13Command({
      aggregateType: "SUPPORT",
      aggregateRef: ticketId,
      actionCode: "SUPPORT_RESOLVE",
      reasonCode: "ADMIN_SUPPORT",
    });
    ElMessage.success("工单命令已提交，等待服务端状态更新。");
    await load();
  } catch (error) {
    ElMessage.error(
      error instanceof Error ? error.message : "工单命令提交失败。",
    );
  } finally {
    ticketBusy.value = false;
  }
}

const REFUND_REASONS = [
  "USER_REQUEST",
  "DUPLICATE_CHARGE",
  "SERVICE_ISSUE",
  "ADMIN_REVIEW",
] as const;

function refundBody(): Record<string, unknown> {
  return {
    aggregateType: "COMMERCE",
    aggregateRef: refundOrderRef.value.trim(),
    actionCode: "COMMERCE_REFUND",
    reasonCode: refundReason.value,
  };
}

function parseChallenge(
  value: unknown,
): { token: string; decisionId: string; resourceRef: string } | null {
  const root =
    value && typeof value === "object" && "data" in value
      ? (value as { data?: unknown }).data
      : value;
  if (!root || typeof root !== "object") return null;
  const record = root as Record<string, unknown>;
  const token = text(record.token);
  if (!token) return null;
  return {
    token,
    decisionId: text(record.decisionId),
    resourceRef: text(record.resourceRef, refundOrderRef.value.trim()),
  };
}

async function prepareRefund(): Promise<void> {
  if (refundBusy.value) return;
  if (!refundOrderRef.value.trim()) {
    ElMessage.warning("请先填写或选择订单。");
    return;
  }
  refundBusy.value = true;
  refundChallenge.value = null;
  try {
    refundChallenge.value = parseChallenge(
      await prepareB13Command(refundBody()),
    );
    if (!refundChallenge.value) throw new Error("服务端未返回确认挑战。");
    ElMessage.info("退款已进入二次确认；请核对订单后确认执行。");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "退款预检失败。");
  } finally {
    refundBusy.value = false;
  }
}

async function confirmRefund(): Promise<void> {
  if (
    !refundChallenge.value ||
    refundBusy.value ||
    refundChallenge.value.resourceRef !== refundOrderRef.value.trim()
  )
    return;
  refundBusy.value = true;
  try {
    await executeB13Command(refundBody(), refundChallenge.value.token);
    ElMessage.success("退款命令已提交，等待服务端状态更新。");
    refundChallenge.value = null;
    refundOrderRef.value = "";
    await load();
  } catch (error) {
    ElMessage.error(
      error instanceof Error ? error.message : "退款命令提交失败。",
    );
  } finally {
    refundBusy.value = false;
  }
}

onMounted(() => {
  void load();
});
</script>

<template>
  <div class="view-stack b13-ops">
    <AdminPageIntro
      ><el-button :loading="loading" @click="load"
        >刷新</el-button
      ></AdminPageIntro
    >

    <el-alert
      title="真实支付尚未开放"
      description="当前不触发真实支付渠道，操作结果以已接入环境返回为准。"
      type="warning"
      :closable="false"
      show-icon
    />
    <el-alert
      v-if="errorMessage"
      :title="errorMessage"
      type="error"
      :closable="false"
      show-icon
    />

    <el-row :gutter="16">
      <el-col :span="8"
        ><el-card shadow="never"
          ><span class="b13-stat-label">可见指标</span
          ><strong class="b13-stat-value">{{
            loading || metricError || !canReadMetrics ? "—" : metrics.length
          }}</strong
          ><small>版本化、可回算</small></el-card
        ></el-col
      >
      <el-col :span="8"
        ><el-card shadow="never"
          ><span class="b13-stat-label">已加载订单</span
          ><strong class="b13-stat-value">{{
            loading || errorMessage ? "—" : orders.length
          }}</strong
          ><small>脱敏只读</small></el-card
        ></el-col
      >
      <el-col :span="8"
        ><el-card shadow="never"
          ><span class="b13-stat-label">已加载工单</span
          ><strong class="b13-stat-value">{{
            loading || ticketError || !canReadTickets ? "—" : tickets.length
          }}</strong
          ><small>SLA 状态由服务端计算</small></el-card
        ></el-col
      >
    </el-row>

    <el-card shadow="never">
      <template #header
        ><div class="card-header">
          <span>订单记录</span><el-tag type="info">已脱敏</el-tag>
        </div></template
      >
      <div class="list-toolbar">
        <el-input
          v-model="query"
          :placeholder="ui('filter')"
          :aria-label="ui('filter')"
          clearable
        /><span class="list-count">{{
          ui("total", { count: orders.length })
        }}</span>
      </div>
      <el-skeleton v-if="loading" :rows="4" animated /><el-table
        v-else-if="!errorMessage && filtered.length"
        :data="visible"
        stripe
      >
        <el-table-column prop="orderRef" label="订单引用" min-width="190" />
        <el-table-column prop="state" label="状态" width="150" />
        <el-table-column label="金额" width="150"
          ><template #default="scope">{{
            money(scope.row)
          }}</template></el-table-column
        >
        <el-table-column prop="redactionVersion" label="脱敏版本" width="130" />
        <el-table-column
          prop="createdAt"
          label="创建时间"
          min-width="190"
        /><el-table-column label="操作" width="110"
          ><template #default="scope"
            ><el-button
              link
              type="primary"
              :disabled="refundBusy"
              @click="
                refundOrderRef = String(scope.row.orderRef);
                refundForm?.scrollIntoView({ block: 'center' });
              "
              >申请退款</el-button
            ></template
          ></el-table-column
        >
      </el-table>
      <el-empty
        v-else-if="!errorMessage && !loading"
        :description="ui('empty')"
      />
      <div
        v-if="filtered.length > pageSize && !loading && !errorMessage"
        class="list-footer"
      >
        <el-pagination
          v-model:current-page="page"
          :page-size="pageSize"
          :total="filtered.length"
          layout="prev, pager, next"
        />
      </div>
    </el-card>

    <el-card shadow="never">
      <template #header
        ><div class="card-header">
          <span>退款操作</span><el-tag type="danger">二次确认</el-tag>
        </div></template
      >
      <p class="b13-refund-note">
        先选择订单并填写退款原因，核对确认信息后再提交。修改订单或原因后，需要重新核对。
      </p>
      <div ref="refundForm" class="b13-refund-form">
        <el-input
          v-model="refundOrderRef"
          :disabled="refundBusy"
          placeholder="填写订单编号"
          clearable
          style="max-width: 320px"
        />
        <el-select
          v-model="refundReason"
          :disabled="refundBusy"
          style="width: 220px"
          aria-label="退款原因"
        >
          <el-option
            v-for="reason in REFUND_REASONS"
            :key="reason"
            :label="reason"
            :value="reason"
          />
        </el-select>
        <el-button
          type="warning"
          :loading="refundBusy"
          :disabled="!refundOrderRef.trim()"
          @click="prepareRefund"
          >预检退款</el-button
        >
      </div>
      <div v-if="refundChallenge" class="b13-refund-challenge" role="status">
        <span
          >待确认退款：{{ refundChallenge.resourceRef }} · 决策
          {{ refundChallenge.decisionId || "服务端已受理" }}</span
        >
        <div>
          <el-button type="danger" :loading="refundBusy" @click="confirmRefund"
            >确认执行退款</el-button
          >
          <el-button :disabled="refundBusy" @click="refundChallenge = null"
            >取消</el-button
          >
        </div>
      </div>
    </el-card>

    <el-row v-if="!loading && !errorMessage" :gutter="16">
      <el-col v-if="canReadTickets" :xs="24" :md="12">
        <el-card shadow="never">
          <template #header
            ><div class="card-header">
              <span>客服工单</span><el-tag type="warning">脱敏附件引用</el-tag>
            </div></template
          >
          <el-alert
            v-if="ticketError"
            :title="ticketError"
            type="warning"
            :closable="false"
          />
          <el-table v-else :data="tickets.slice(0, 5)" stripe>
            <el-table-column
              prop="ticketId"
              label="工单"
              min-width="160"
            /><el-table-column
              prop="categoryCode"
              label="分类"
              width="120"
            /><el-table-column
              prop="priority"
              label="优先级"
              width="100"
            /><el-table-column prop="state" label="状态" width="110" />
            <el-table-column label="动作" width="100"
              ><template #default="scope"
                ><el-button
                  link
                  type="primary"
                  :disabled="
                    ticketBusy ||
                    !session.can('admin.support.command') ||
                    ['RESOLVED', 'CLOSED'].includes(String(scope.row.state))
                  "
                  @click="resolveTicket(scope.row)"
                  >提交解决</el-button
                ></template
              ></el-table-column
            >
          </el-table>
          <el-empty
            v-if="!ticketError && !tickets.length"
            description="暂无可见工单"
          />
          <router-link v-if="tickets.length" class="text-link" to="/support"
            >查看全部工单 →</router-link
          >
        </el-card>
      </el-col>
      <el-col v-if="canReadMetrics" :xs="24" :md="12">
        <el-card shadow="never">
          <template #header
            ><div class="card-header">
              <span>分析指标</span><el-tag type="success">可见数据</el-tag>
            </div></template
          >
          <el-alert
            v-if="metricError"
            :title="metricError"
            type="warning"
            :closable="false"
          />
          <el-table v-else :data="metrics" stripe>
            <el-table-column
              prop="metricId"
              label="指标"
              min-width="150"
            /><el-table-column
              prop="metricVersion"
              label="口径"
              width="120"
            /><el-table-column
              prop="state"
              label="状态"
              width="110"
            /><el-table-column label="值" width="100"
              ><template #default="scope">{{
                scope.row.totalValue ?? scope.row.value ?? "—"
              }}</template></el-table-column
            >
          </el-table>
          <el-empty
            v-if="!metricError && !metrics.length"
            description="暂无指标投影"
          />
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<style scoped>
.b13-ops {
  display: grid;
  gap: 16px;
}
.b13-stat-label {
  display: block;
  color: var(--ef-color-text-secondary, #667085);
  font-size: 13px;
}
.b13-stat-value {
  display: block;
  margin: 8px 0;
  font-size: 30px;
  color: var(--ef-color-text-primary, #1f2937);
}
.b13-ops small {
  color: var(--ef-color-text-secondary, #667085);
}
.b13-refund-note {
  margin: 0 0 12px;
  color: var(--ef-color-text-secondary, #667085);
  font-size: 13px;
  line-height: 1.6;
}
.b13-refund-form {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  align-items: center;
}
.b13-refund-challenge {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 12px;
  padding: 12px 14px;
  border: 1px solid var(--admin-line);
  border-radius: 12px;
  background: var(--admin-apricot);
  font-size: 13px;
}
.b13-refund-challenge > div {
  display: flex;
  gap: 8px;
}
</style>
