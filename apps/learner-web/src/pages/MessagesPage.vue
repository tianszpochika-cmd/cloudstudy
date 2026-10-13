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
        <div class="yx-section-heading"><div><p class="yx-kicker">站内消息<span class="v2-sr-only">收件箱</span></p><h3>站内消息</h3></div><span class="yx-fact-tag">{{ messages.filter((m) => !m.read).length }} 未读</span></div>
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

<style>
/* Messages v2 页面级样式（只做样式）：对齐 webDemo 普通内容页卡片风格（主列 + 侧栏 / 卡片 / 标签）。
 * 选择器全部以 .v2-page--messages 开头；颜色只用 --v2-* tokens，不写死色值以适配暗色。 */
.v2-page--messages{background:var(--v2-bg);color:var(--v2-ink);font-family:var(--v2-font);display:grid;gap:var(--v2-space-5);align-items:start}
.v2-page--messages .v2-messages-body{display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:var(--v2-space-5);align-items:start;min-width:0}
.v2-page--messages .v2-messages-main{display:grid;gap:var(--v2-space-5);min-width:0;align-content:start}
.v2-page--messages .v2-messages-card{background:var(--v2-card);border:1px solid var(--v2-line);border-radius:var(--v2-radius-lg);box-shadow:var(--v2-shadow);padding:var(--v2-space-6);min-width:0}
.v2-page--messages .v2-messages-rail{background:var(--v2-card);border:1px solid var(--v2-line);border-radius:var(--v2-radius-lg);box-shadow:var(--v2-shadow);padding:var(--v2-space-6);min-width:0}
.v2-page--messages .v2-messages-card{display:grid;gap:var(--v2-space-4);align-content:start}
.v2-page--messages .yx-section-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:var(--v2-space-4)}
.v2-page--messages .yx-section-heading>div{display:grid;gap:var(--v2-space-1);min-width:0}
.v2-page--messages .yx-kicker{margin:0;color:var(--v2-brand);font-size:var(--v2-text-xs);font-weight:800;letter-spacing:.12em}
.v2-page--messages .v2-messages-card h3{margin:0;font-size:var(--v2-text-lg);color:var(--v2-ink);line-height:1.4}
.v2-page--messages .yx-fact-tag{display:inline-flex;align-items:center;width:fit-content;max-width:100%;padding:var(--v2-space-1) var(--v2-space-3);border-radius:var(--v2-radius-pill);background:var(--v2-soft);color:var(--v2-mut);font-size:var(--v2-text-xs);line-height:1.6}
.v2-page--messages .yx-msg-list{display:grid;gap:var(--v2-space-3);margin:0;padding:0;list-style:none}
.v2-page--messages .yx-msg-list li{display:grid;gap:var(--v2-space-2);padding:var(--v2-space-4);background:var(--v2-surface);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);min-width:0}
.v2-page--messages .yx-msg-list__unread{border-color:var(--v2-brand2)}
.v2-page--messages .yx-msg-list li>div{display:flex;align-items:center;justify-content:space-between;gap:var(--v2-space-3)}
.v2-page--messages .yx-msg-list strong{color:var(--v2-ink);font-size:var(--v2-text-sm);font-weight:700}
.v2-page--messages .yx-msg-list .yx-fact-tag{background:var(--v2-card)}
.v2-page--messages .yx-pill{display:inline-flex;align-items:center;padding:var(--v2-space-1) var(--v2-space-3);border-radius:var(--v2-radius-pill);font-size:var(--v2-text-xs);font-weight:700;border:1px solid var(--v2-line)}
.v2-page--messages .yx-pill--muted{background:var(--v2-surface);color:var(--v2-mut)}
.v2-page--messages .yx-pill--warning{background:var(--v2-warn-soft);color:var(--v2-warn)}
.v2-page--messages .yx-msg-list p{margin:0;color:var(--v2-mut);font-size:var(--v2-text-sm);line-height:1.6}
.v2-page--messages .button{min-height:40px;padding:0 var(--v2-space-4);border:1px solid var(--v2-brand);border-radius:var(--v2-radius-sm);background:var(--v2-brand);color:var(--v2-inverse);font-weight:750;cursor:pointer;justify-self:start;transition:background-color var(--v2-motion-fast)}
.v2-page--messages .button--ghost{background:var(--v2-card);color:var(--v2-brand)}
.v2-page--messages .button:hover:not(:disabled){background:var(--v2-brand2);border-color:var(--v2-brand2);color:var(--v2-inverse)}
.v2-page--messages .button:disabled{opacity:.5;cursor:not-allowed}
.v2-page--messages .settings-link{width:fit-content;color:var(--v2-brand);font-weight:700;text-decoration:none;font-size:var(--v2-text-sm)}
.v2-page--messages .settings-link:hover{color:var(--v2-brand2);text-decoration:underline}
.v2-page--messages .actions{display:flex;gap:var(--v2-space-3);flex-wrap:wrap}
.v2-page--messages .v2-messages-rail{position:sticky;top:var(--v2-space-6);display:grid;align-content:start;gap:var(--v2-space-3)}
.v2-page--messages .v2-messages-rail h2{margin:0;font-size:var(--v2-text-lg);color:var(--v2-ink)}
.v2-page--messages .v2-messages-rail ol{margin:0;padding-left:var(--v2-space-5);display:grid;gap:var(--v2-space-2);color:var(--v2-mut);font-size:var(--v2-text-sm);line-height:1.7}
.v2-page--messages .v2-sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}
.v2-page--messages button:focus-visible,.v2-page--messages a:focus-visible{outline:2px solid var(--v2-brand);outline-offset:2px}
@media(max-width:1190px){.v2-page--messages .v2-messages-body{grid-template-columns:minmax(0,1fr) 250px}}
@media(max-width:900px){.v2-page--messages .v2-messages-body{grid-template-columns:1fr}.v2-page--messages .v2-messages-rail{position:static}}
</style>
