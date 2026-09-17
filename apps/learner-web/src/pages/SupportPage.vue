<script setup lang="ts">
import { onMounted, ref } from 'vue'
import {
  SUPPORT_CATEGORIES,
  createSupportTicket,
  getSupportTicket,
  listSupportTickets,
  reopenSupportTicket,
  type SupportTicket,
} from '../api/support'
import PageHeader from '../components/PageHeader.vue'
import StatePanel from '../components/StatePanel.vue'

type ViewState = 'loading' | 'ready' | 'empty' | 'permission' | 'recovery' | 'error'

const state = ref<ViewState>('loading')
const lastError = ref<string | null>(null)
const tickets = ref<SupportTicket[]>([])
const selected = ref<SupportTicket | null>(null)
const category = ref<string>('TECHNICAL')
const resourceRef = ref('')
const description = ref('')
const busy = ref(false)

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
    state.value = stateFrom(error)
    lastError.value = error instanceof Error ? error.message : '客服工单暂时不可用。'
  }
}

async function create(): Promise<void> {
  if (busy.value || !description.value.trim() || !resourceRef.value.trim()) return
  busy.value = true
  lastError.value = null
  try {
    // 指纹代原文：页面不发送联系方式与原文，附件仅引用、分派由服务端决定。
    const ticket = await createSupportTicket({
      categoryCode: category.value,
      resourceRef: resourceRef.value,
      description: description.value,
    })
    if (ticket) {
      tickets.value = [ticket, ...tickets.value]
      selected.value = ticket
      description.value = ''
      resourceRef.value = ''
      state.value = 'ready'
    }
  } catch (error) {
    state.value = stateFrom(error)
    lastError.value = error instanceof Error ? error.message : '工单创建未完成。'
  } finally {
    busy.value = false
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

async function reopen(ticketId: string): Promise<void> {
  if (busy.value) return
  busy.value = true
  try {
    const ticket = await reopenSupportTicket(ticketId)
    if (ticket) {
      selected.value = ticket
      tickets.value = tickets.value.map((item) => (item.ticketId === ticket.ticketId ? ticket : item))
    }
  } catch (error) {
    state.value = stateFrom(error)
    lastError.value = error instanceof Error ? error.message : '重开未完成。'
  } finally {
    busy.value = false
  }
}

onMounted(() => { void load() })
</script>

<template>
  <main class="page-stack">
    <PageHeader kicker="SUPPORT" title="客服与帮助" description="工单只读投影来自客服 owner；原文不离端，分派与解决由服务端确认。" />
    <StatePanel
      v-if="state === 'loading' || state === 'permission' || state === 'error' || state === 'recovery'"
      :state="state === 'recovery' ? 'error' : state"
      title="客服与帮助"
      :description="state === 'permission' ? '当前会话没有客服权限。' : state === 'recovery' ? '服务端要求先恢复，请刷新后重试。' : (lastError ?? '客服暂时不可用。')"
      :action-label="state === 'error' || state === 'recovery' ? '重试' : ''"
      @action="load"
    />
    <template v-if="state === 'ready' || state === 'empty' || tickets.length">
      <section class="info-card" aria-label="新建工单">
        <div class="yx-section-heading"><div><p class="yx-kicker">NEW TICKET</p><h3>提交工单</h3></div></div>
        <form class="yx-form" novalidate @submit.prevent="create">
          <label class="field">
            <span>问题分类</span>
            <select v-model="category" :disabled="busy">
              <option v-for="item in SUPPORT_CATEGORIES" :key="item" :value="item">{{ item }}</option>
            </select>
          </label>
          <label class="field">
            <span>关联引用（必填，服务端路由分派所需）</span>
            <input v-model="resourceRef" type="text" placeholder="内容/订单引用" :disabled="busy">
          </label>
          <label class="field">
            <span>问题描述（仅本地，发送指纹）</span>
            <textarea v-model="description" rows="4" placeholder="描述问题，原文不出端" :disabled="busy" />
          </label>
          <button class="button button--primary" type="submit" :disabled="busy || !description.trim() || !resourceRef.trim()">
            {{ busy ? '正在提交…' : '提交工单' }}
          </button>
        </form>
      </section>
      <section class="info-card" aria-label="我的工单">
        <div class="yx-section-heading"><div><p class="yx-kicker">MY TICKETS</p><h3>我的工单</h3></div><span class="yx-fact-tag">{{ tickets.length }} 张</span></div>
        <p v-if="!tickets.length" class="yx-fact-tag">暂无可见工单。</p>
        <ul v-else class="yx-ticket-list">
          <li v-for="ticket in tickets" :key="ticket.ticketId">
            <button type="button" @click="open(ticket.ticketId)">
              <strong>{{ ticket.ticketId }}</strong>
              <span class="yx-pill" :class="ticket.state === 'OPEN' ? 'yx-pill--warning' : ticket.state === 'CLOSED' ? 'yx-pill--muted' : ''">{{ ticket.state }}</span>
              <small>{{ ticket.categoryCode }} · SLA {{ ticket.slaState ?? '—' }}</small>
            </button>
          </li>
        </ul>
      </section>
      <section v-if="selected" class="info-card" aria-label="工单详情">
        <div class="yx-section-heading"><div><p class="yx-kicker">DETAIL</p><h3>工单详情</h3></div></div>
        <dl class="yx-stats yx-stats--kv">
          <div><dt>引用</dt><dd>{{ selected.ticketId }}</dd></div>
          <div><dt>分类</dt><dd>{{ selected.categoryCode }}</dd></div>
          <div><dt>状态</dt><dd>{{ selected.state }}</dd></div>
          <div><dt>优先级</dt><dd>{{ selected.priority }}</dd></div>
          <div><dt>SLA</dt><dd>{{ selected.slaState ?? '—' }} · {{ selected.slaDueAt ?? '—' }}</dd></div>
          <div><dt>脱敏版本</dt><dd>{{ selected.redactionVersion ?? '—' }}</dd></div>
        </dl>
        <button
          v-if="selected.state === 'RESOLVED' || selected.state === 'CLOSED'"
          class="button button--secondary"
          type="button"
          :disabled="busy"
          @click="reopen(selected.ticketId)"
        >
          重开工单
        </button>
      </section>
      <div class="actions">
        <button class="button" type="button" @click="load">刷新</button>
      </div>
    </template>
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
