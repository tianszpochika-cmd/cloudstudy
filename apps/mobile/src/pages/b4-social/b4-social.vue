<script setup lang="ts">
import AppIcon from '../../components/AppIcon.vue'
import MobilePageHeader from '../../components/MobilePageHeader.vue'
import { useMobileExperience } from '../../platform/experience'
const { experienceStyle, experienceMotion } = useMobileExperience()

import { onShow } from '@dcloudio/uni-app'
import { onMounted, onUnmounted, ref, computed } from 'vue'
import B4StatusPanel from '../../components/b4/B4StatusPanel.vue'
import { formatSeconds, interactionLabel, type B4InteractionCode, type B4PerformanceLevel } from '../../domain/b4'
import { ensureMobilePageAccess } from '../../auth/navigation'
import { useB4Store } from '../../stores/b4'
import B12SocialExtensions from '../../components/b12/B12SocialExtensions.vue'
import { b10ThemeMode } from '../../platform/b10-foundation'

const b4 = useB4Store()
const themeClass = computed(() => `b10-theme--${b10ThemeMode.value}`)
const interactionCode = ref<B4InteractionCode>('CHEER_UP')
const focusMinutes = ref<25 | 45>(25)
const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | undefined
const focusSeconds = computed(() => {
  const focus = b4.activeFocus
  if (!focus) return 0
  const serverSeconds = focus.serverDurationSeconds
  if (focus.status !== 'RUNNING' || !focus.startedAt) return serverSeconds
  const start = Date.parse(focus.startedAt)
  return Number.isFinite(start) ? Math.max(serverSeconds, Math.floor((now.value - start) / 1000)) : serverSeconds
})
const noticeTypeLabels: Record<string, string> = { REVIEW_DUE: '复习提醒', LEARNING_PLAN: '学习计划', ROOM_INTERACTIONS: '自习室互动', FOCUS_REMINDERS: '专注提醒', SYSTEM: '系统消息' }
const roomTemplateLabels: Record<string, string> = { FOCUS: '专注房', STUDY: '自习房' }
const roomChatModeLabels: Record<string, string> = { PRESET_ONLY: '仅预设互动', DISABLED: '不开放聊天' }
function roomTemplateLabel(value: string): string { return roomTemplateLabels[value] ?? '学习房间' }
function roomChatModeLabel(value: string): string { return roomChatModeLabels[value] ?? '预设互动' }
function noticeMeta(item: { category: string | null; createdAt: string | null }): string {
  const category = noticeTypeLabels[item.category ?? ''] ?? '通知'
  const time = item.createdAt ? Date.parse(item.createdAt) : NaN
  if (!Number.isFinite(time)) return category
  return `${category} · ${new Intl.DateTimeFormat(undefined, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(time)}`
}

onShow(async () => {
  if (!await ensureMobilePageAccess('/pages/b4-social/b4-social')) return
  b4.restore()
  if (!b4.rooms.length) void b4.loadWorld()
})
onMounted(() => { timer = setInterval(() => { now.value = Date.now() }, 1000) })
onUnmounted(() => { if (timer) clearInterval(timer) })

function selectPerformance(level: B4PerformanceLevel): void { b4.setPerformance(level) }
function send(roomId: string): void { void b4.sendInteraction(roomId, interactionCode.value) }
</script>

<template>
  <view class="yx-page b4-social v2-social-page" :style="experienceStyle" :data-motion="experienceMotion" :class="themeClass">
    <MobilePageHeader page="b4-social" />

    <view class="v2-social-body">
      <B4StatusPanel class="v2-social-status" :status="b4.status" :online="b4.online" :message="b4.lastError" :queue-count="b4.queueCount" :performance-level="b4.performanceLevel" @retry="b4.loadWorld" @sync="b4.syncOffline" @performance="selectPerformance" />
      <view class="yx-card card v2-social-card">
        <view class="heading v2-social-head">
          <view class="v2-social-titles">
            <text class="kicker v2-social-eyebrow eyebrow"><AppIcon name="inbox" :size="14" /><text>通知</text></text>
            <text class="card-title v2-social-title v2-social-h2">通知</text>
          </view>
          <view class="notice-actions v2-social-actions row">
            <text v-if="b4.notificationStatus === 'ready'" class="muted v2-social-d d">{{ b4.notifications.filter(item => !item.read).length }} 未读</text>
            <button tabindex="0" role="button" v-if="b4.notificationStatus === 'ready' && b4.notifications.some(item => !item.read)" class="small-button secondary btn v2-social-btn v2-social-opt" type="button" @click="b4.readAllNotifications">全部已读<AppIcon name="check" :size="14" /></button>
          </view>
        </view>
        <text v-if="b4.notificationStatus === 'loading'" class="empty-copy v2-social-fb v2-social-d d" role="status">正在读取通知…</text>
        <view v-else-if="b4.notificationStatus === 'error'" class="empty-copy v2-social-fb v2-social-d d" role="alert">通知暂时无法读取。<button tabindex="0" role="button" class="small-button secondary btn v2-social-btn v2-social-opt" type="button" @click="b4.loadWorld">重试<AppIcon name="refresh" :size="14" /></button></view>
        <view v-else-if="b4.notifications.length" class="notice-list v2-social-list">
          <view v-for="item in b4.notifications" :key="item.messageId" class="notice list-row v2-social-row" :class="{ unread: !item.read }">
            <view class="v2-social-copy">
              <text class="notice-title v2-social-name v2-social-h2">{{ item.title }}</text>
              <text class="muted v2-social-d d">{{ item.body }}</text>
              <text class="muted v2-social-d d">{{ noticeMeta(item) }}</text>
            </view>
            <button tabindex="0" role="button" v-if="!item.read" class="small-button secondary btn v2-social-btn v2-social-opt" type="button" @click="b4.readNotification(item.messageId)">已读<AppIcon name="check" :size="14" /></button>
          </view>
        </view>
        <text v-else class="empty-copy v2-social-fb v2-social-d d">暂无通知。</text>
      </view>
      <view class="yx-card card v2-social-card">
        <view class="heading v2-social-head">
          <view class="v2-social-titles">
            <text class="kicker v2-social-eyebrow eyebrow"><AppIcon name="users" :size="14" /><text>自习室</text></text>
            <text class="card-title v2-social-title v2-social-h2">房间列表</text>
          </view>
          <text v-if="b4.rooms.length" class="muted v2-social-d d v2-social-count">预设互动</text>
        </view>
        <view v-if="b4.rooms.length" class="room-list v2-social-list">
          <view v-for="room in b4.rooms" :key="room.roomId" class="room list-row v2-social-row">
            <view class="room-main v2-social-copy">
              <text class="room-name v2-social-name v2-social-h2">{{ room.name }}</text>
              <text class="muted v2-social-d d">{{ roomTemplateLabel(room.templateCode) }} · {{ room.memberCount }} / {{ room.capacity }} 人 · {{ roomChatModeLabel(room.chatMode) }}</text>
            </view>
            <button tabindex="0" role="button" class="small-button secondary btn v2-social-btn v2-social-opt" type="button" @click="room.joined ? b4.leaveRoom(room.roomId) : b4.joinRoom(room.roomId)">{{ room.joined ? '离开' : '加入' }}<AppIcon name="users" :size="14" /></button>
            <view v-if="room.joined" class="room-actions v2-social-actions row">
              <picker :range="[25, 45]" :value="focusMinutes === 25 ? 0 : 1" @change="focusMinutes = [25, 45][$event.detail.value] as 25 | 45"><view class="picker v2-social-picker v2-social-opt"><AppIcon name="clock" :size="14" />{{ focusMinutes }} 分钟</view></picker>
              <button tabindex="0" role="button" class="small-button btn v2-social-btn v2-social-opt v2-social-submit" type="button" @click="b4.startFocus(room.roomId, focusMinutes)">开始番茄<AppIcon name="clock" :size="14" /></button>
              <picker :range="['CHEER_UP', 'STUDY_TOGETHER', 'CONGRATS', 'TRY_AGAIN', 'TONIGHT_20_MIN']" :value="0" @change="interactionCode = ['CHEER_UP', 'STUDY_TOGETHER', 'CONGRATS', 'TRY_AGAIN', 'TONIGHT_20_MIN'][$event.detail.value] as B4InteractionCode"><view class="picker v2-social-picker v2-social-opt"><AppIcon name="spark" :size="14" />{{ interactionLabel(interactionCode) }}</view></picker>
              <button tabindex="0" role="button" class="small-button secondary btn v2-social-btn v2-social-opt" type="button" @click="send(room.roomId)">发送鼓励<AppIcon name="spark" :size="14" /></button>
            </view>
          </view>
        </view>
        <text v-else class="empty-copy v2-social-fb v2-social-d d">暂时没有可加入的自习室。</text>
      </view>
      <view class="yx-card focus-card card v2-social-card">
        <view class="heading v2-social-head">
          <view class="v2-social-titles">
            <text class="kicker v2-social-eyebrow eyebrow"><AppIcon name="clock" :size="14" /><text>番茄专注</text></text>
            <text class="card-title v2-social-title v2-social-h2">番茄专注</text>
          </view>
          <text class="state v2-social-state v2-social-tag" v-if="b4.activeFocus">{{ b4.activeFocus.status }}</text>
        </view>
        <template v-if="b4.activeFocus">
          <text class="timer v2-social-timer">{{ formatSeconds(focusSeconds) }}</text>
          <text class="muted v2-social-d d">专注时长以服务端记录为准。</text>
          <view class="room-actions v2-social-actions row">
            <button tabindex="0" role="button" v-if="b4.activeFocus.status === 'RUNNING'" class="small-button secondary btn v2-social-btn v2-social-opt" type="button" @click="b4.updateFocus('PAUSE')">暂停<AppIcon name="clock" :size="14" /></button>
            <button tabindex="0" role="button" v-if="b4.activeFocus.status === 'PAUSED'" class="small-button secondary btn v2-social-btn v2-social-opt" type="button" @click="b4.updateFocus('RESUME')">恢复<AppIcon name="refresh" :size="14" /></button>
            <button tabindex="0" role="button" v-if="['RUNNING', 'PAUSED'].includes(b4.activeFocus.status)" class="small-button danger btn v2-social-btn v2-social-opt" type="button" @click="b4.updateFocus('COMPLETE')">完成专注<AppIcon name="check" :size="14" /></button>
          </view>
        </template>
        <text v-else class="empty-copy v2-social-fb v2-social-d d">加入房间后即可开始专注。</text>
      </view>
      <B12SocialExtensions class="v2-social-ext" />
    </view>
  </view>
</template>

<style scoped lang="scss">
.b4-social{padding-bottom:56rpx}.heading{display:flex;align-items:flex-start;justify-content:space-between;gap:14rpx}.notice-actions{display:flex;align-items:center;gap:12rpx;flex-wrap:wrap;justify-content:flex-end}.kicker{display:block;color:var(--yx-brand);font-size:21rpx;font-weight:800;letter-spacing:2rpx}.card-title{display:block;margin-top:8rpx;font-size:34rpx;font-weight:750}.muted{display:block;color:var(--yx-text-secondary);font-size:22rpx;line-height:1.55}.room-list,.notice-list{display:grid;gap:12rpx;margin-top:18rpx}.room,.notice{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12rpx;padding:18rpx;border:1rpx solid var(--yx-border);border-radius:14rpx;background:var(--yx-surface-card)}.room-main,.notice>view{display:grid;gap:6rpx}.room-name,.notice-title{font-size:28rpx;font-weight:700}.room-actions{grid-column:1/-1;display:flex;align-items:center;gap:10rpx;flex-wrap:wrap;padding-top:12rpx;border-top:1rpx solid var(--yx-border)}.picker{min-height:64rpx;padding:0 16rpx;border:1rpx solid var(--yx-border);border-radius:12rpx;color:var(--yx-brand);background:var(--yx-surface-card);font-size:22rpx;line-height:64rpx}.small-button{min-height:64rpx;padding:0 18rpx;border:0;border-radius:12rpx;color:var(--yx-on-brand);background:var(--yx-action);font-size:22rpx;line-height:64rpx}.small-button.secondary{border:1rpx solid var(--yx-border);color:var(--yx-brand);background:var(--yx-surface-card)}.small-button.danger{color:var(--yx-danger);background:var(--yx-danger-soft)}.state{padding:6rpx 10rpx;border-radius:8rpx;color:var(--yx-success);background:var(--yx-border);font-size:21rpx}.timer{display:block;margin-top:12rpx;color:var(--yx-brand);font-size:72rpx;font-weight:800;font-variant-numeric:tabular-nums}.focus-card{display:grid;gap:14rpx}.empty-copy{display:block;padding:18rpx;border:1rpx dashed var(--yx-border);border-radius:12rpx;color:var(--yx-text-secondary);font-size:24rpx;line-height:1.6}.notice.unread{border-color:var(--yx-border);background:var(--yx-surface-page)}.notice-title{display:block}@media(max-width:520px){.room-actions{display:grid;grid-template-columns:1fr}.room-actions>*{width:100%}.timer{font-size:56rpx}}
/* v2 社交页换皮：对齐 mobile/styles.css 与 refine.css 中 .card/.eyebrow/.opt/.fb/.btn/.list-row，对齐 practice.vue v2-practice-* 与 today.vue v2-today-* 同样数值，仅用 var(--v2-*)。 */
.v2-social-page{box-sizing:border-box;max-width:100%;min-width:0;font-family:var(--v2-font)}
.v2-social-body{display:flex;flex-direction:column;gap:var(--v2-space-4);box-sizing:border-box;max-width:100%;min-width:0;font-family:var(--v2-font)}
.v2-social-body>*{min-width:0;max-width:100%}
.v2-social-status{display:grid;gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;font-family:var(--v2-font);overflow-wrap:anywhere}
.v2-social-ext{display:grid;gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;font-family:var(--v2-font)}
.v2-social-ext>*{min-width:0;max-width:100%}
.v2-social-card{display:grid;gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;padding:var(--v2-space-5);border:1px solid var(--v2-line);border-radius:var(--v2-radius-lg);background:var(--v2-card);box-shadow:var(--v2-shadow);font-family:var(--v2-font)}
.v2-social-card:hover{border-color:var(--v2-brand)}
.v2-social-head{display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;font-family:var(--v2-font)}
.v2-social-head>*{min-width:0;max-width:100%}
.v2-social-titles{display:grid;gap:var(--v2-space-1);box-sizing:border-box;max-width:100%;min-width:0;flex:1 1 auto;font-family:var(--v2-font)}
.v2-social-eyebrow{display:flex;align-items:center;flex-wrap:wrap;gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;margin:0 0 var(--v2-space-2);color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-xs);font-weight:700;letter-spacing:.06em;text-transform:uppercase;overflow-wrap:anywhere}
.v2-social-title{display:block;box-sizing:border-box;max-width:100%;min-width:0;margin:var(--v2-space-1) 0 0;color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-lg);font-weight:700;line-height:1.45;overflow-wrap:anywhere}
.v2-social-h2{box-sizing:border-box;max-width:100%;min-width:0;font-family:var(--v2-font);overflow-wrap:anywhere}
.v2-social-name{display:block;box-sizing:border-box;max-width:100%;min-width:0;color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-lg);font-weight:700;line-height:1.45;overflow-wrap:anywhere}
.v2-social-d{display:block;box-sizing:border-box;max-width:100%;min-width:0;color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.7;overflow-wrap:anywhere}
.v2-social-count{display:block;box-sizing:border-box;max-width:100%;min-width:0;flex:0 1 auto;color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.7;overflow-wrap:anywhere}
.v2-social-list{display:grid;gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;font-family:var(--v2-font)}
.v2-social-list>*{min-width:0;max-width:100%}
.v2-social-row{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;padding:var(--v2-space-4);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);background:var(--v2-card);font-family:var(--v2-font)}
.v2-social-row:hover{border-color:var(--v2-brand)}
.v2-social-row>*{min-width:0;max-width:100%}
.v2-social-copy{display:grid;gap:var(--v2-space-1);box-sizing:border-box;max-width:100%;min-width:0;flex:1 1 auto;font-family:var(--v2-font)}
.v2-social-actions{display:flex;flex-wrap:wrap;align-items:center;gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;font-family:var(--v2-font)}
.v2-social-actions>*{min-width:0;max-width:100%}
.v2-social-row>.v2-social-actions{flex:1 1 100%}
.v2-social-btn{box-sizing:border-box;display:flex;align-items:center;justify-content:center;width:100%;max-width:100%;min-width:0;min-height:var(--v2-space-12);padding:var(--v2-space-3) var(--v2-space-4);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);background:var(--v2-card);color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-sm);font-weight:600;line-height:1.5;white-space:nowrap;overflow-wrap:anywhere}
.v2-social-opt{box-sizing:border-box;display:flex;align-items:center;justify-content:center;width:100%;max-width:100%;min-width:0;min-height:var(--v2-space-12);padding:var(--v2-space-3) var(--v2-space-4);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);background:var(--v2-card);color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-sm);font-weight:600;line-height:1.5;white-space:nowrap;overflow-wrap:anywhere}
.v2-social-btn:hover,.v2-social-opt:hover{border-color:var(--v2-brand)}
.v2-social-btn:active,.v2-social-opt:active{transform:scale(.97)}
.v2-social-btn:focus-visible,.v2-social-opt:focus-visible{box-shadow:var(--v2-focus);outline:none}
.v2-social-btn:disabled,.v2-social-opt:disabled{background:var(--v2-surface);color:var(--v2-mut);border:1px dashed var(--v2-line);box-shadow:none}
.v2-social-picker{box-sizing:border-box;display:flex;align-items:center;justify-content:center;width:100%;max-width:100%;min-width:0;min-height:var(--v2-space-12);padding:var(--v2-space-3) var(--v2-space-4);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);background:var(--v2-card);color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-sm);font-weight:600;line-height:1.5;white-space:nowrap;overflow-wrap:anywhere}
.v2-social-picker:hover{border-color:var(--v2-brand)}
.v2-social-submit{border-color:transparent;background:var(--v2-brand);color:var(--v2-inverse);font-family:var(--v2-font);font-weight:700;white-space:nowrap}
.v2-social-submit:hover{border-color:var(--v2-brand)}
.v2-social-tag{display:inline-flex;align-items:center;justify-self:start;box-sizing:border-box;max-width:100%;min-width:0;padding:var(--v2-space-1) var(--v2-space-2);border-radius:var(--v2-radius-pill);background:var(--v2-soft);color:var(--v2-brand);font-family:var(--v2-font);font-size:var(--v2-text-xs);font-weight:700;line-height:1.5;overflow-wrap:anywhere}
.v2-social-state{display:inline-flex;align-items:center;box-sizing:border-box;max-width:100%;min-width:0;padding:var(--v2-space-1) var(--v2-space-2);border-radius:var(--v2-radius-pill);background:var(--v2-ok-soft);color:var(--v2-ok);font-family:var(--v2-font);font-size:var(--v2-text-xs);font-weight:700;line-height:1.5;overflow-wrap:anywhere}
.v2-social-timer{display:block;box-sizing:border-box;max-width:100%;min-width:0;color:var(--v2-brand);font-family:var(--v2-font);font-size:var(--v2-text-2xl);font-weight:800;font-variant-numeric:tabular-nums;line-height:1.2;overflow-wrap:anywhere}
.v2-social-fb{display:block;box-sizing:border-box;max-width:100%;min-width:0;margin-top:var(--v2-space-4);padding:var(--v2-space-3) var(--v2-space-4);border-radius:var(--v2-radius-md);background:var(--v2-surface);color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.7;overflow-wrap:anywhere}
</style>
