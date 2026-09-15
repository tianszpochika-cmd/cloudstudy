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
  if (busy.value || !description.value.trim()) return
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
  <main class="public-page">
    <section class="login-card login-card--quiet" aria-labelledby="support-title">
      <h1 id="support-title">客服与帮助</h1>
      <p class="lead">工单只读投影来自客服 owner；原文不离端，分派与解决由服务端确认。</p>
      <div v-if="state === 'loading'" role="status">正在读取工单…</div>
      <div v-else-if="state === 'permission'" role="alert">当前会话没有客服权限。</div>
      <div v-else-if="state === 'recovery'" role="alert">服务端要求先恢复，请刷新后重试。</div>
      <div v-else-if="state === 'error'" role="alert">{{ lastError ?? '客服暂时不可用。' }}</div>
      <form class="login-form" novalidate @submit.prevent="create">
        <label class="field">
          <span>问题分类</span>
          <select v-model="category" :disabled="busy">
            <option v-for="item in SUPPORT_CATEGORIES" :key="item" :value="item">{{ item }}</option>
          </select>
        </label>
        <label class="field">
          <span>关联引用（可选）</span>
          <input v-model="resourceRef" type="text" placeholder="内容/订单引用" :disabled="busy">
        </label>
        <label class="field">
          <span>问题描述（仅本地，发送指纹）</span>
          <textarea v-model="description" rows="4" placeholder="描述问题，原文不出端" :disabled="busy" />
        </label>
        <button class="button button--primary" type="submit" :disabled="busy || !description.trim()">
          {{ busy ? '正在提交…' : '提交工单' }}
        </button>
      </form>
      <section aria-label="我的工单">
        <h2>我的工单</h2>
        <p v-if="!tickets.length" class="muted">暂无可见工单。</p>
        <ul v-else>
          <li v-for="ticket in tickets" :key="ticket.ticketId">
            <button type="button" @click="open(ticket.ticketId)">
              {{ ticket.ticketId }} · {{ ticket.categoryCode }} · {{ ticket.state }} · SLA {{ ticket.slaState ?? '—' }}
            </button>
          </li>
        </ul>
      </section>
      <section v-if="selected" aria-label="工单详情">
        <h2>工单详情</h2>
        <dl>
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
      <p class="micro-copy"><button class="button" type="button" @click="load">刷新</button></p>
    </section>
  </main>
</template>
