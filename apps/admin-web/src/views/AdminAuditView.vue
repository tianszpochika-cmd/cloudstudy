<script setup lang="ts">
import { useListView } from "../platform/list-view";
import { ui } from "../platform/experience";
import AdminPageIntro from "../components/AdminPageIntro.vue";
import { nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { searchAuditLogs } from "../api/b5";
import { toAudit, type AuditEntry } from "../domain/b5";
import { adminI18n } from "../platform/v2-foundation";
import { useAdminStore } from "../stores/admin";

const session = useAdminStore();
const rows = ref<AuditEntry[]>([]);
const loading = ref(false);
const loadingMore = ref(false);
const errorMessage = ref("");
const moreError = ref("");
const nextCursor = ref<string | null>(null);
const SERVER_PAGE_SIZE = 20;
let loadRequest = 0;
let filterVersion = 0;
const usedCursors = new Set<string>();
const { query, page, pageSize, filtered, visible } = useListView(rows, [
  "actionCode",
  "resourceType",
  "resourceRef",
  "resultCode",
  "auditId",
  "commandId",
  "traceId",
]);
function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value || "—"
    : new Intl.DateTimeFormat(adminI18n.locale, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
}
function accountScope(): { subject: string; accessToken: string } | null {
  const subject = session.principal?.subject?.trim();
  return session.isAuthenticated && session.can("admin.audit.read") && subject
    ? { subject, accessToken: session.accessToken }
    : null;
}
function isCurrent(request: number, scope: { subject: string; accessToken: string }): boolean {
  const current = accountScope();
  return request === loadRequest && current?.subject === scope.subject
    && current.accessToken === scope.accessToken;
}
function clearPage(): void {
  rows.value = [];
  nextCursor.value = null;
  usedCursors.clear();
  moreError.value = "";
  loadingMore.value = false;
}
async function load(): Promise<void> {
  const request = ++loadRequest;
  const scope = accountScope();
  clearPage();
  if (!scope) {
    loading.value = false;
    errorMessage.value = "当前会话没有审计读取权限。";
    return;
  }
  loading.value = true;
  errorMessage.value = "";
  try {
    const result = await searchAuditLogs(undefined, SERVER_PAGE_SIZE);
    if (!isCurrent(request, scope)) return;
    rows.value = result.items.map(toAudit);
    nextCursor.value = result.nextCursor;
  } catch (error) {
    if (!isCurrent(request, scope)) return;
    errorMessage.value =
      error instanceof Error ? error.message : ui("unavailable");
  } finally {
    if (request === loadRequest) loading.value = false;
  }
}
async function loadMore(): Promise<void> {
  const scope = accountScope();
  const cursor = nextCursor.value;
  if (!scope || !cursor || loading.value || loadingMore.value || errorMessage.value) return;
  const request = loadRequest;
  const filter = filterVersion;
  const currentPage = page.value;
  loadingMore.value = true;
  moreError.value = "";
  try {
    const result = await searchAuditLogs(cursor, SERVER_PAGE_SIZE);
    if (!isCurrent(request, scope) || filter !== filterVersion || cursor !== nextCursor.value) return;
    if (result.nextCursor && (result.nextCursor === cursor || usedCursors.has(result.nextCursor))) {
      throw new Error("审计分页游标重复，请刷新重试。");
    }
    const existing = new Set(rows.value.map((row) => row.auditId));
    rows.value = [...rows.value, ...result.items.map(toAudit).filter((row) => !existing.has(row.auditId))];
    usedCursors.add(cursor);
    nextCursor.value = result.nextCursor;
    await nextTick();
    if (isCurrent(request, scope) && filter === filterVersion) page.value = currentPage;
  } catch (error) {
    if (!isCurrent(request, scope) || filter !== filterVersion) return;
    moreError.value = error instanceof Error ? error.message : "更多审计记录暂时无法读取。";
  } finally {
    if (request === loadRequest) loadingMore.value = false;
  }
}
watch(query, () => { ++filterVersion; moreError.value = ""; }, { flush: "sync" });
watch(
  () => [session.accessToken, session.principal?.subject, session.permissions.join("\u0000")] as const,
  () => { void load(); },
  { flush: "sync" },
);
onMounted(() => {
  void load();
});
onUnmounted(() => { ++loadRequest; });
</script>

<template>
  <div class="view-stack audit-page">
    <AdminPageIntro
      ><el-space
        ><el-button :loading="loading" @click="load">刷新</el-button
        ><el-button disabled
          >导出暂不可用</el-button
        ></el-space
      ></AdminPageIntro
    ><el-alert title="脱敏记录" type="info" :closable="false" show-icon
      >仅显示审计引用与处理结果。</el-alert
    ><el-card shadow="never"
      ><div class="list-toolbar">
        <el-input
          v-model="query"
          clearable
          :placeholder="ui('filter')"
          :aria-label="ui('filter')"
        /><span class="list-count">已加载 {{ rows.length }} 条</span>
      </div>
      <el-skeleton v-if="loading" :rows="4" animated /><el-alert
        v-else-if="errorMessage"
        :title="errorMessage"
        type="error"
        :closable="false"
        show-icon />
      <template v-else-if="filtered.length">
        <el-table class="audit-desktop-table" :data="visible" stripe>
          <el-table-column label="时间" width="180">
            <template #default="scope">{{ formatTime(scope.row.occurredAt) }}</template>
          </el-table-column>
          <el-table-column prop="actionCode" label="动作" min-width="230" />
          <el-table-column prop="resourceRef" label="资源引用" min-width="200" />
          <el-table-column prop="resultCode" label="结果" width="120">
            <template #default="scope">{{ scope.row.resultCode || "—" }}</template>
          </el-table-column>
          <el-table-column prop="commandId" label="命令引用" min-width="200" />
          <el-table-column prop="traceId" label="追踪引用" min-width="200" />
          <el-table-column label="脱敏" width="80">
            <template #default="scope">
              <el-tag :type="scope.row.redacted === true ? 'success' : 'warning'" size="small">{{
                scope.row.redacted === true ? "已脱敏" : "待核验"
              }}</el-tag>
            </template>
          </el-table-column>
        </el-table>
        <div class="audit-mobile-list">
          <article v-for="entry in visible" :key="entry.auditId" class="audit-mobile-card">
            <div class="audit-mobile-card__heading">
              <strong>{{ entry.actionCode || "审计记录" }}</strong>
              <el-tag :type="entry.redacted === true ? 'success' : 'warning'" size="small">{{
                entry.redacted === true ? "已脱敏" : "待核验"
              }}</el-tag>
            </div>
            <time>{{ formatTime(entry.occurredAt) }}</time>
            <dl>
              <div><dt>资源</dt><dd>{{ entry.resourceRef || "—" }}</dd></div>
              <div v-if="entry.resultCode"><dt>结果</dt><dd>{{ entry.resultCode }}</dd></div>
              <div v-if="entry.commandId"><dt>命令</dt><dd>{{ entry.commandId }}</dd></div>
              <div v-if="entry.traceId"><dt>追踪</dt><dd>{{ entry.traceId }}</dd></div>
            </dl>
          </article>
        </div>
      </template>
      <el-empty v-else :description="ui('empty')" />
      <div
        v-if="!loading && !errorMessage && filtered.length > pageSize"
        class="list-footer"
      >
        <el-pagination
          v-model:current-page="page"
          :page-size="pageSize"
          :total="filtered.length"
          layout="prev, pager, next"
        /></div>
      <el-alert v-if="moreError" :title="moreError" type="warning" :closable="false" show-icon class="audit-more-error" />
      <div v-if="!loading && !errorMessage && nextCursor" class="audit-load-more">
        <el-button :loading="loadingMore" @click="loadMore">{{ moreError ? "重试加载" : "加载更多" }}</el-button>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.audit-mobile-list { display: none; }
.audit-load-more { display: flex; justify-content: center; padding-top: 12px; }
.audit-more-error { margin-top: 12px; }
@media (max-width: 760px) {
  .audit-page :deep(.mobile-table-hint), .audit-desktop-table { display: none; }
  .audit-mobile-list { display: grid; gap: 12px; }
  .audit-mobile-card { border: 1px solid var(--admin-line); border-radius: 14px; padding: 14px; min-width: 0; }
  .audit-mobile-card__heading { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
  .audit-mobile-card__heading strong { overflow-wrap: anywhere; font-size: 13px; }
  .audit-mobile-card time { display: block; margin-top: 7px; color: var(--admin-muted); font-size: 12px; }
  .audit-mobile-card dl { margin: 12px 0 0; display: grid; gap: 9px; }
  .audit-mobile-card dl > div { display: grid; grid-template-columns: 42px minmax(0, 1fr); gap: 8px; font-size: 12px; }
  .audit-mobile-card dt { color: var(--admin-muted); }
  .audit-mobile-card dd { margin: 0; overflow-wrap: anywhere; }
}
</style>
