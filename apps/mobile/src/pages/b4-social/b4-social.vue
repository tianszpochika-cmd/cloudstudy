<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app'
import { onMounted, onUnmounted, ref, computed } from 'vue'
import B4StatusPanel from '../../components/b4/B4StatusPanel.vue'
import { formatSeconds, interactionLabel, type B4InteractionCode, type B4PerformanceLevel } from '../../domain/b4'
import { getUniRuntime } from '../../platform/uni-runtime'
import { useSessionStore } from '../../stores/session'
import { useB4Store } from '../../stores/b4'
import B12SocialExtensions from '../../components/b12/B12SocialExtensions.vue'

const session = useSessionStore()
const b4 = useB4Store()
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

onShow(async () => {
  await session.restore()
  if (!session.isAuthenticated) { getUniRuntime().navigateTo({ url: '/pages/login/login' }); return }
  b4.restore()
  if (!b4.rooms.length) void b4.loadWorld()
})
onMounted(() => { timer = setInterval(() => { now.value = Date.now() }, 1000) })
onUnmounted(() => { if (timer) clearInterval(timer) })

function selectPerformance(level: B4PerformanceLevel): void { b4.setPerformance(level) }
function send(roomId: string): void { void b4.sendInteraction(roomId, interactionCode.value) }
</script>

<template>
  <view class="yx-page b4-social">
    <text class="yx-eyebrow">B4 · SOCIAL FOCUS</text>
    <text class="yx-title">虚拟自习室</text>
    <text class="yx-description">房间、番茄 session 和预设互动通过服务端状态机推进；离线时只保留待同步事件。</text>
    <B4StatusPanel :status="b4.status" :online="b4.online" :message="b4.lastError" :queue-count="b4.queueCount" :performance-level="b4.performanceLevel" @retry="b4.loadWorld" @sync="b4.syncOffline" @performance="selectPerformance" />
    <view class="yx-card"><view class="heading"><view><text class="kicker">STUDY ROOMS</text><text class="card-title">房间列表</text></view><text class="muted">预设互动</text></view><view v-if="b4.rooms.length" class="room-list"><view v-for="room in b4.rooms" :key="room.roomId" class="room"><view class="room-main"><text class="room-name">{{ room.name }}</text><text class="muted">{{ room.templateCode }} · {{ room.memberCount }} / {{ room.capacity }} 人 · {{ room.chatMode }}</text></view><button class="small-button secondary" type="button" @click="room.joined ? b4.leaveRoom(room.roomId) : b4.joinRoom(room.roomId)">{{ room.joined ? '离开' : '加入' }}</button><view v-if="room.joined" class="room-actions"><picker :range="[25, 45]" :value="focusMinutes === 25 ? 0 : 1" @change="focusMinutes = [25, 45][$event.detail.value] as 25 | 45"><view class="picker">{{ focusMinutes }} 分钟</view></picker><button class="small-button" type="button" @click="b4.startFocus(room.roomId, focusMinutes)">开始番茄</button><picker :range="['CHEER_UP', 'STUDY_TOGETHER', 'CONGRATS', 'TRY_AGAIN', 'TONIGHT_20_MIN']" :value="0" @change="interactionCode = ['CHEER_UP', 'STUDY_TOGETHER', 'CONGRATS', 'TRY_AGAIN', 'TONIGHT_20_MIN'][$event.detail.value] as B4InteractionCode"><view class="picker">{{ interactionLabel(interactionCode) }}</view></picker><button class="small-button secondary" type="button" @click="send(room.roomId)">发送鼓励</button></view></view></view><text v-else class="empty-copy">服务端未返回自习室列表。</text></view>
    <view class="yx-card focus-card"><view class="heading"><view><text class="kicker">POMODORO</text><text class="card-title">番茄专注</text></view><text class="state" v-if="b4.activeFocus">{{ b4.activeFocus.status }}</text></view><template v-if="b4.activeFocus"><text class="timer">{{ formatSeconds(focusSeconds) }}</text><text class="muted">本地显示计时；实际时长以服务端 session 返回为准。</text><view class="room-actions"><button v-if="b4.activeFocus.status === 'RUNNING'" class="small-button secondary" type="button" @click="b4.updateFocus('PAUSE')">暂停</button><button v-if="b4.activeFocus.status === 'PAUSED'" class="small-button secondary" type="button" @click="b4.updateFocus('RESUME')">恢复</button><button v-if="['RUNNING', 'PAUSED'].includes(b4.activeFocus.status)" class="small-button danger" type="button" @click="b4.updateFocus('COMPLETE')">完成专注</button></view></template><text v-else class="empty-copy">加入房间后，由服务端创建专注 session；未成功建立前不会开始本地伪造计时。</text></view>
    <view class="yx-card"><view class="heading"><view><text class="kicker">NOTIFICATIONS</text><text class="card-title">通知</text></view><button v-if="b4.notifications.length" class="small-button secondary" type="button" @click="b4.readAllNotifications">全部已读</button></view><view v-if="b4.notifications.length" class="notice-list"><view v-for="item in b4.notifications" :key="item.messageId" class="notice" :class="{ unread: !item.read }"><view><text class="notice-title">{{ item.title }}</text><text class="muted">{{ item.body || '服务端未提供正文。' }}</text><text class="muted">{{ item.category ?? 'SYSTEM' }} · {{ item.createdAt ?? '时间未返回' }}</text></view><button v-if="!item.read" class="small-button secondary" type="button" @click="b4.readNotification(item.messageId)">已读</button></view></view><text v-else class="empty-copy">服务端未返回通知。</text></view>
    <B12SocialExtensions />
  </view>
</template>

<style scoped lang="scss">
.b4-social{padding-bottom:56rpx}.heading{display:flex;align-items:flex-start;justify-content:space-between;gap:14rpx}.kicker{display:block;color:#596bff;font-size:21rpx;font-weight:800;letter-spacing:2rpx}.card-title{display:block;margin-top:8rpx;font-size:34rpx;font-weight:750}.muted{display:block;color:#666d80;font-size:22rpx;line-height:1.55}.room-list,.notice-list{display:grid;gap:12rpx;margin-top:18rpx}.room,.notice{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12rpx;padding:18rpx;border:1rpx solid #eef0f5;border-radius:14rpx;background:#fff}.room-main,.notice>view{display:grid;gap:6rpx}.room-name,.notice-title{font-size:28rpx;font-weight:700}.room-actions{grid-column:1/-1;display:flex;align-items:center;gap:10rpx;flex-wrap:wrap;padding-top:12rpx;border-top:1rpx solid #eef0f5}.picker{min-height:64rpx;padding:0 16rpx;border:1rpx solid #d9dce7;border-radius:12rpx;color:#596bff;background:#fff;font-size:22rpx;line-height:64rpx}.small-button{min-height:64rpx;padding:0 18rpx;border:0;border-radius:12rpx;color:#fff;background:#596bff;font-size:22rpx;line-height:64rpx}.small-button.secondary{border:1rpx solid #d9dce7;color:#596bff;background:#fff}.small-button.danger{color:#b52d43;background:#fff0f3}.state{padding:6rpx 10rpx;border-radius:8rpx;color:#26745f;background:#edf9f4;font-size:21rpx}.timer{display:block;margin-top:12rpx;color:#596bff;font-size:72rpx;font-weight:800;font-variant-numeric:tabular-nums}.focus-card{display:grid;gap:14rpx}.empty-copy{display:block;padding:18rpx;border:1rpx dashed #dfe3ee;border-radius:12rpx;color:#666d80;font-size:24rpx;line-height:1.6}.notice.unread{border-color:#cfd4ff;background:#fafaff}.notice-title{display:block}@media(max-width:520px){.room-actions{display:grid;grid-template-columns:1fr}.room-actions>*{width:100%}.timer{font-size:56rpx}}
</style>
