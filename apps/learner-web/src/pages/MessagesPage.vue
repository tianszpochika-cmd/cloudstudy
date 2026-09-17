<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { listInboxMessages, listNotificationPreferences, markAllMessagesRead, markMessageRead, setNotificationPreference, type InboxMessage, type NotificationPreference } from '../api/notifications'
import PageHeader from '../components/PageHeader.vue'
import StatePanel from '../components/StatePanel.vue'

type ViewState = 'loading' | 'ready' | 'empty' | 'permission' | 'error'

const router = useRouter()
const state = ref<ViewState>('loading')
const lastError = ref<string | null>(null)
const messages = ref<InboxMessage[]>([])
const preferences = ref<NotificationPreference[]>([])
const busy = ref(false)

function stateFrom(error: unknown): ViewState {
  const status = (error as { status?: number })?.status
  return status === 403 ? 'permission' : 'error'
}

async function load(): Promise<void> {
  state.value = 'loading'
  lastError.value = null
  try {
    const [msgs, prefs] = await Promise.all([listInboxMessages(), listNotificationPreferences()])
    messages.value = msgs
    preferences.value = prefs
    state.value = msgs.length || prefs.length ? 'ready' : 'empty'
  } catch (error) {
    state.value = stateFrom(error)
    lastError.value = error instanceof Error ? error.message : '消息暂时不可用。'
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

async function toggle(pref: NotificationPreference): Promise<void> {
  if (busy.value) return
  busy.value = true
  try {
    await setNotificationPreference({
      notificationType: pref.notificationType,
      channel: pref.channel,
      enabled: !pref.enabled,
    })
    await load()
  } catch (error) {
    state.value = stateFrom(error)
    lastError.value = error instanceof Error ? error.message : '偏好保存未完成。'
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
  <section class="page-stack">
    <PageHeader kicker="MESSAGE CENTER" title="消息中心" description="只读服务端通知；已读回执与偏好开关实时写回，原文不出端。" />
    <StatePanel
      v-if="state !== 'ready'"
      :state="state"
      title="消息中心"
      :description="state === 'empty' ? '暂无消息，也没有可调的通知偏好。' : state === 'permission' ? '当前会话没有消息读取权限。' : (lastError ?? '消息暂时不可用。')"
      :action-label="state === 'error' ? '重试' : ''"
      @action="load"
    />
    <template v-if="messages.length || preferences.length">
      <section class="info-card" aria-label="站内消息">
        <div class="yx-section-heading"><div><p class="yx-kicker">INBOX</p><h3>站内消息</h3></div><span class="yx-fact-tag">{{ messages.filter((m) => !m.readAt).length }} 未读</span></div>
        <p v-if="!messages.length" class="yx-fact-tag">暂无未读之外的消息。</p>
        <ul v-else class="yx-msg-list">
          <li v-for="msg in messages" :key="msg.messageId" :class="{ 'yx-msg-list__unread': !msg.readAt }">
            <div><strong>{{ msg.title ?? '通知' }}</strong><span class="yx-pill" :class="msg.readAt ? 'yx-pill--muted' : 'yx-pill--warning'">{{ msg.readAt ? '已读' : '未读' }}</span></div>
            <span class="yx-fact-tag">{{ msg.channel ?? '' }}</span>
            <p v-if="msg.safeBody">{{ msg.safeBody }}</p>
            <button v-if="!msg.readAt" class="button button--ghost" type="button" :disabled="busy" @click="read(msg.messageId)">标为已读</button>
          </li>
        </ul>
        <button v-if="messages.some((m) => !m.readAt)" class="button" type="button" :disabled="busy" @click="readAll">全部标为已读</button>
      </section>
      <section class="info-card" aria-label="通知偏好">
        <div class="yx-section-heading"><div><p class="yx-kicker">PREFERENCES</p><h3>通知偏好</h3></div></div>
        <ul class="yx-pref-list">
          <li v-for="pref in preferences" :key="`${pref.notificationType}:${pref.channel}`">
            <span>{{ pref.notificationType }} · {{ pref.channel }}</span>
            <button class="button button--ghost" type="button" :disabled="busy" @click="toggle(pref)">{{ pref.enabled ? '关闭' : '打开' }}</button>
          </li>
        </ul>
      </section>
    </template>
    <div class="actions">
      <button class="button button--primary" type="button" @click="today">回今日任务</button>
    </div>
  </section>
</template>

<style scoped>
.yx-msg-list, .yx-pref-list { display: grid; gap: 10px; margin: 0 0 16px; padding: 0; list-style: none; }
.yx-msg-list li { display: grid; gap: 6px; padding: 14px 16px; border: 1px solid var(--yx-color-border); border-radius: 12px; }
.yx-msg-list__unread { border-color: var(--yx-color-warning); }
.yx-msg-list li > div { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.yx-msg-list p { margin: 0; color: var(--yx-color-text-secondary); font-size: 13px; line-height: 1.6; }
.yx-pref-list li { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 12px 0; border-top: 1px solid var(--yx-color-border); font-size: 13px; }
.actions { display: flex; gap: 12px; }
.button--ghost { border: 1px solid var(--yx-color-border); background: transparent; color: var(--yx-color-brand-primary); }
</style>
