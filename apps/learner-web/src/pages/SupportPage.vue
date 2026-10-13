<script setup lang="ts">
import ExperienceHeader from '../components/ExperienceHeader.vue'
import { onMounted, ref } from 'vue'
import {
  getSupportTicket,
  listSupportTickets,
  readClosureBoard,
  type SupportTicket,
} from '../api/support'
import { supportNotice, ticketNotice, type ClosureBoard } from '../domain/it7-closure'
import StatePanel from '../components/StatePanel.vue'
import { userFacingError } from '../platform/user-facing-error'

type ViewState = 'loading' | 'ready' | 'empty' | 'permission' | 'recovery' | 'error'

const state = ref<ViewState>('loading')
const lastError = ref<string | null>(null)
const tickets = ref<SupportTicket[]>([])
const selected = ref<SupportTicket | null>(null)
const closure = ref<ClosureBoard | null>(null)
const categoryNames: Record<string, string> = {
  CONTENT_CORRECTION: '内容有误', ACCOUNT_ACCESS: '账号登录', BILLING: '订单与权益',
  LEARNING_DATA: '学习记录', PRIVACY_REQUEST: '隐私与数据', TECHNICAL: '使用问题',
}
const stateNames: Record<string, string> = {
  OPEN: '已提交', ACKNOWLEDGED: '已受理', IN_PROGRESS: '处理中',
  WAITING_CUSTOMER: '等待补充信息', RESOLVED: '已解决', CLOSED: '已关闭',
}
function dueDate(value: string | null): string {
  if (!value) return '待确认'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '待确认' : new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date)
}

function stateFrom(error: unknown): ViewState {
  const status = (error as { status?: number })?.status
  if (status === 403) return 'permission'
  if (status === 409) return 'recovery'
  return 'error'
}

async function load(): Promise<void> {
  state.value = 'loading'
  lastError.value = null
  try {
    tickets.value = await listSupportTickets()
    state.value = tickets.value.length ? 'ready' : 'empty'
  } catch (error) {
    tickets.value = []
    selected.value = null
    state.value = stateFrom(error)
    lastError.value = error instanceof Error ? error.message : '客服工单暂时不可用。'
  }
}

async function open(ticketId: string): Promise<void> {
  lastError.value = null
  try {
    selected.value = await getSupportTicket(ticketId)
  } catch (error) {
    state.value = stateFrom(error)
    lastError.value = error instanceof Error ? error.message : '工单读取未完成。'
  }
}

onMounted(() => {
  void load()
  void readClosureBoard().then((board) => { closure.value = board }).catch(() => { closure.value = null })
})
</script>

<template>
  <main class="page-stack v2-page v2-page--support">
    <ExperienceHeader page="Support" icon="help" />
    <div class="v2-support-body"><div class="v2-support-main">
    <section class="info-card it7-closure v2-support-card" aria-label="客服提交状态">
      <div class="yx-section-heading"><div><h3>提交问题</h3></div></div>
      <p>{{ ticketNotice(closure) }}</p>
      <p v-if="supportNotice(closure)">{{ supportNotice(closure) }}</p>
    </section>
    <StatePanel
      v-if="state === 'loading' || state === 'permission' || state === 'error' || state === 'recovery'"
      :state="state === 'recovery' ? 'error' : state"
      title="客服与帮助"
      :description="state === 'permission' ? '当前账号暂时不能查看工单。' : state === 'recovery' ? '请刷新后重试。' : userFacingError(lastError, '暂时无法读取工单，请稍后重试。')"
      :action-label="state === 'error' || state === 'recovery' ? '重试' : ''"
      @action="load"
    />
    <template v-if="state === 'ready' || state === 'empty' || tickets.length">
      <section class="info-card v2-support-card" aria-label="我的工单">
        <div class="yx-section-heading"><div><h3>我的工单</h3></div><span class="yx-fact-tag">{{ tickets.length }} 张</span></div>
        <p v-if="!tickets.length" class="yx-fact-tag">暂无可见工单。</p>
        <ul v-else class="yx-ticket-list">
          <li v-for="ticket in tickets" :key="ticket.ticketId">
            <button type="button" @click="open(ticket.ticketId)">
              <strong>工单 {{ ticket.ticketId }}</strong>
              <span class="yx-pill" :class="ticket.state === 'OPEN' ? 'yx-pill--warning' : ticket.state === 'CLOSED' ? 'yx-pill--muted' : ''">{{ stateNames[ticket.state] ?? '处理中' }}</span>
              <small>{{ categoryNames[ticket.categoryCode] ?? '历史分类' }}</small>
            </button>
          </li>
        </ul>
      </section>
      <section v-if="selected" class="info-card v2-support-card" aria-label="工单详情">
        <div class="yx-section-heading"><div><h3>工单详情</h3></div></div>
        <dl class="yx-stats yx-stats--kv">
          <div><dt>引用</dt><dd>{{ selected.ticketId }}</dd></div>
          <div><dt>分类</dt><dd>{{ categoryNames[selected.categoryCode] ?? '历史分类' }}</dd></div>
          <div><dt>状态</dt><dd>{{ stateNames[selected.state] ?? '处理中' }}</dd></div>
          <div><dt>预计处理时间</dt><dd>{{ dueDate(selected.slaDueAt) }}</dd></div>
        </dl>
        <p v-if="selected.state === 'RESOLVED' || selected.state === 'CLOSED'">确认与重开暂不可用。</p>
      </section>
      <div class="actions v2-support-actions">
        <button class="button" type="button" @click="load">刷新</button>
      </div>
    </template>
    </div><aside class="v2-support-rail" aria-label="工单提示"><h2>工单提示</h2><ol><li>提交状态与支持编号可在本页查看。</li><li>打开工单可查看分类、状态与预计处理时间。</li><li>列表打不开可点刷新重试。</li></ol></aside></div>
  </main>
</template>

<style scoped>
.yx-form { display: grid; gap: 14px; }
.yx-form .field { display: grid; gap: 8px; font-size: 13px; font-weight: 600; color: var(--yx-color-text-secondary); }
.yx-form input, .yx-form select, .yx-form textarea {
  padding: 12px;
  border: 1px solid var(--yx-color-border);
  border-radius: 10px;
  background: var(--yx-color-surface-card);
  color: var(--yx-color-text-primary);
  font: inherit;
  font-weight: 400;
}
.yx-ticket-list { display: grid; gap: 10px; margin: 0; padding: 0; list-style: none; }
.yx-ticket-list button {
  display: grid;
  gap: 6px;
  width: 100%;
  padding: 14px 16px;
  border: 1px solid var(--yx-color-border);
  border-radius: 12px;
  background: var(--yx-color-surface-card);
  color: inherit;
  text-align: left;
  cursor: pointer;
}
.yx-ticket-list button:hover { border-color: var(--yx-color-brand-primary); }
.yx-ticket-list .yx-pill { justify-self: start; }
.yx-ticket-list small { color: var(--yx-color-text-secondary); font-size: 12px; }
.yx-stats--kv { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
.yx-stats--kv dd { font-size: 14px !important; word-break: break-all; }
.actions { display: flex; gap: 12px; }
@media (max-width: 640px) { .yx-stats--kv { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; } }
</style>
