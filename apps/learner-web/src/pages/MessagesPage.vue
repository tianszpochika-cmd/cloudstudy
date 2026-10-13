<script setup lang="ts">
import ExperienceHeader from '../components/ExperienceHeader.vue'
import { onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { listInboxMessages, markAllMessagesRead, markMessageRead, type InboxMessage } from '../api/notifications'
import StatePanel from '../components/StatePanel.vue'

type ViewState = 'loading' | 'ready' | 'empty' | 'permission' | 'error'

const router = useRouter()
const state = ref<ViewState>('loading')
const lastError = ref<string | null>(null)
const messages = ref<InboxMessage[]>([])
const busy = ref(false)
const channelLabels: Record<string, string> = { IN_APP: '站内', PUSH: '推送', EMAIL: '邮件', SMS: '短信' }
function channelLabel(value: string | null): string { return channelLabels[value ?? ''] ?? '站内' }
function messageTime(value: string | null): string {
  const time = value ? Date.parse(value) : NaN
  return Number.isFinite(time) ? new Intl.DateTimeFormat(undefined, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(time) : ''
}

function stateFrom(error: unknown): ViewState {
  const status = (error as { status?: number })?.status
  return status === 403 ? 'permission' : 'error'
}

async function load(): Promise<void> {
  state.value = 'loading'
  lastError.value = null
  try {
    const msgs = await listInboxMessages()
    messages.value = msgs
    state.value = msgs.length ? 'ready' : 'empty'
  } catch (error) {
    state.value = stateFrom(error)
    lastError.value = '消息暂时不可用，请重试。'
  }
}

async function read(messageId: string): Promise<void> {
  if (busy.value) return
  busy.value = true
  try {
    await markMessageRead(messageId)
    await load()
  } catch (error) {
    state.value = stateFrom(error)
    lastError.value = error instanceof Error ? error.message : '标为已读未完成。'
  } finally {
    busy.value = false
  }
}

async function readAll(): Promise<void> {
  if (busy.value) return
  busy.value = true
  try {
    await markAllMessagesRead()
    await load()
  } catch (error) {
    state.value = stateFrom(error)
    lastError.value = error instanceof Error ? error.message : '全部已读未完成。'
  } finally {
    busy.value = false
  }
}

function today(): void {
  void router.push({ name: 'today' })
}

onMounted(() => { void load() })
</script>

<template>
  <section class="page-stack v2-page v2-page--messages">
    <ExperienceHeader page="Messages" icon="bell" />
    <div class="v2-messages-body"><div class="v2-messages-main">
    <StatePanel
      v-if="state !== 'ready'"
      :state="state"
      title="消息中心"
      :description="state === 'empty' ? '暂无消息，也没有可调的通知偏好。' : state === 'permission' ? '当前会话没有消息读取权限。' : (lastError ?? '消息暂时不可用。')"
      :action-label="state === 'error' ? '重试' : ''"
      @action="load"
    />
    <template v-if="state === 'ready'">
      <section class="info-card v2-messages-card" aria-label="站内消息">
        <div class="yx-section-heading"><div><p class="yx-kicker">站内消息<span class="v2-sr-only">INBOX</span></p><h3>站内消息</h3></div><span class="yx-fact-tag">{{ messages.filter((m) => !m.read).length }} 未读</span></div>
        <p v-if="!messages.length" class="yx-fact-tag">暂无消息。</p>
        <ul v-else class="yx-msg-list">
          <li v-for="msg in messages" :key="msg.messageId" :class="{ 'yx-msg-list__unread': !msg.read }">
            <div><strong>{{ msg.title ?? '通知' }}</strong><span class="yx-pill" :class="msg.read ? 'yx-pill--muted' : 'yx-pill--warning'">{{ msg.read ? '已读' : '未读' }}</span></div>
            <span class="yx-fact-tag">{{ channelLabel(msg.channel) }}<template v-if="messageTime(msg.createdAt)"> · {{ messageTime(msg.createdAt) }}</template></span>
            <p v-if="msg.safeBody">{{ msg.safeBody }}</p>
            <button v-if="!msg.read" class="button button--ghost" type="button" :disabled="busy" @click="read(msg.messageId)">标为已读</button>
          </li>
        </ul>
        <button v-if="messages.some((m) => !m.read)" class="button" type="button" :disabled="busy" @click="readAll">全部标为已读</button>
      </section>
    </template>
    <RouterLink class="settings-link" to="/settings/notifications">通知设置</RouterLink>
    <div class="actions">
      <button class="button button--primary" type="button" @click="today">回今日任务</button>
    </div>
    </div><aside class="v2-messages-rail" aria-label="消息提示"><h2>消息提示</h2><ol><li>未读消息可逐条标为已读，也可全部标为已读。</li><li>通知设置入口在列表下方。</li><li>消息打不开可点重试，或回今日任务继续学习。</li></ol></aside></div>
  </section>
</template>

<style scoped>
.yx-msg-list { display: grid; gap: 10px; margin: 0 0 16px; padding: 0; list-style: none; }
.yx-msg-list li { display: grid; gap: 6px; padding: 14px 16px; border: 1px solid var(--yx-color-border); border-radius: 12px; }
.yx-msg-list__unread { border-color: var(--yx-color-warning); }
.yx-msg-list li > div { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.yx-msg-list p { margin: 0; color: var(--yx-color-text-secondary); font-size: 13px; line-height: 1.6; }
.settings-link { width: fit-content; padding: 8px 0; color: var(--yx-color-brand-primary); font-size: 14px; }
.actions { display: flex; gap: 12px; }
.button--ghost { border: 1px solid var(--yx-color-border); background: transparent; color: var(--yx-color-brand-primary); }
</style>
