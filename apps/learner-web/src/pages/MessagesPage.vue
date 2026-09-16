<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  listInboxMessages,
  listNotificationPreferences,
  markAllMessagesRead,
  markMessageRead,
  setNotificationPreference,
  type InboxMessage,
  type NotificationPreference,
} from '../api/notifications'

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
  <main class="public-page">
    <section class="login-card login-card--quiet" aria-labelledby="messages-title">
      <h1 id="messages-title">消息中心</h1>
      <p class="lead">只读服务端通知；已读回执与偏好开关实时写回，原文不出端。</p>
      <div v-if="state === 'loading'" role="status">正在读取消息…</div>
      <div v-else-if="state === 'permission'" role="alert">当前会话没有消息读取权限。</div>
      <div v-else-if="state === 'error'" role="alert">{{ lastError ?? '消息暂时不可用。' }}</div>
      <p v-if="state === 'empty'" class="muted">暂无消息，也没有可调的通知偏好。</p>
      <template v-if="messages.length || preferences.length">
        <section aria-label="站内消息">
          <h2>站内消息</h2>
          <p v-if="!messages.length" class="muted">暂无未读之外的消息。</p>
          <ul v-else>
            <li v-for="msg in messages" :key="msg.messageId">
              <strong>{{ msg.title ?? '通知' }}</strong>
              <span>{{ msg.channel ?? '' }} · {{ msg.readAt ? '已读' : '未读' }}</span>
              <p v-if="msg.safeBody" class="muted">{{ msg.safeBody }}</p>
              <button v-if="!msg.readAt" type="button" :disabled="busy" @click="read(msg.messageId)">标为已读</button>
            </li>
          </ul>
          <button v-if="messages.some((m) => !m.readAt)" type="button" :disabled="busy" @click="readAll">全部标为已读</button>
        </section>
        <section aria-label="通知偏好">
          <h2>通知偏好</h2>
          <ul>
            <li v-for="pref in preferences" :key="`${pref.notificationType}:${pref.channel}`">
              <span>{{ pref.notificationType }} · {{ pref.channel }} · {{ pref.enabled ? '开' : '关' }}</span>
              <button type="button" :disabled="busy" @click="toggle(pref)">{{ pref.enabled ? '关闭' : '打开' }}</button>
            </li>
          </ul>
        </section>
      </template>
      <div class="actions">
        <button class="button button--primary" type="button" @click="today">回今日任务</button>
      </div>
    </section>
  </main>
</template>
