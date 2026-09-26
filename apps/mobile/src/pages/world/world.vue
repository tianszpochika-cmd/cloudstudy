<script setup lang="ts">
import MobilePageHeader from '../../components/MobilePageHeader.vue'
import { useMobileExperience } from '../../platform/experience'
const { experienceStyle, experienceMotion } = useMobileExperience()

import { onShow } from '@dcloudio/uni-app'
import { computed } from 'vue'
import { B4_PERFORMANCE_LEVELS } from '../../domain/b4'
import B4StatusPanel from '../../components/b4/B4StatusPanel.vue'
import { getUniRuntime } from '../../platform/uni-runtime'
import { useSessionStore } from '../../stores/session'
import { useB4Store } from '../../stores/b4'
import B12RewardsCard from '../../components/b12/B12RewardsCard.vue'

const session = useSessionStore()
const b4 = useB4Store()
const mapNodes = [
  { code: 'ORIGIN', title: '起源星门', description: '首次学习事件' },
  { code: 'VOCAB_ORBIT', title: '词汇轨道', description: '词汇与复习' },
  { code: 'GRAMMAR_NEBULA', title: '语法星云', description: '阅读与 Checkpoint' },
  { code: 'LISTENING_MOON', title: '听力卫星', description: '听力完成事件' },
  { code: 'SPEAKING_STAR', title: '表达恒星', description: '写作与合格游戏' },
  { code: 'GALAXY_GATE', title: '星系之门', description: '每日目标与全局成长' },
]
const galaxyNodes = computed(() => mapNodes.map((node) => {
  const serverNode = b4.galaxy?.nodes.find((item) => item.nodeCode === node.code)
  return { ...node, hasData: Boolean(serverNode), status: serverNode?.status ?? 'UNKNOWN', progress: serverNode?.progress ?? 0, requiredProgress: serverNode?.requiredProgress ?? 0, progressPercent: serverNode?.progressPercent ?? 0 }
}))
function stateLabel(value?: string): string {
  return ({ ACTIVE: '进行中', AVAILABLE: '可用', UNLOCKED: '已解锁', COMPLETED: '已完成', LOCKED: '待解锁', AT_RISK: '即将中断', BROKEN: '已中断', FROZEN: '已保护', IN_PROGRESS: '进行中' } as Record<string, string>)[value ?? ''] ?? '待确认'
}
function questPeriod(value: string): string {
  return ({ DAILY: '每日', WEEKLY: '每周', SEASON: '赛季' } as Record<string, string>)[value] ?? '成长'
}

onShow(async () => {
  await session.restore()
  if (!session.isAuthenticated) {
    getUniRuntime().navigateTo({ url: '/pages/login/login' })
    return
  }
  b4.restore()
  void b4.loadWorld()
})

function navigate(url: string): void { getUniRuntime().navigateTo({ url }) }
function choosePerformance(level: (typeof B4_PERFORMANCE_LEVELS)[number]): void { b4.setPerformance(level) }
</script>

<template>
  <view class="yx-page b4-world" :class="`b4-world--${b4.performanceLevel}`" :style="experienceStyle" :data-motion="experienceMotion">
    <MobilePageHeader page="world" />

    <B4StatusPanel :status="b4.status" :online="b4.online" :message="b4.lastError" :queue-count="b4.queueCount" :performance-level="b4.performanceLevel" @retry="b4.loadWorld" @sync="b4.syncOffline" @performance="choosePerformance" />

    <view class="b4-metrics">
      <view class="b4-metric"><text>XP</text><text class="b4-metric__value">{{ b4.profile?.xp ?? '—' }}</text><text>{{ b4.profile ? `Lv.${b4.profile.level} · ${b4.profile.rank}` : '暂未获取成长记录' }}</text></view>
      <view class="b4-metric"><text>STAR COIN</text><text class="b4-metric__value">{{ b4.profile?.coins ?? '—' }}</text><text>可用星币</text></view>
      <view class="b4-metric"><text>连续学习</text><text class="b4-metric__value">{{ b4.streak ? `${b4.streak.currentStreak} 天` : '—' }}</text><text>{{ b4.streak ? stateLabel(b4.streak.status) : '暂无记录' }}</text></view>
    </view>

    <view class="yx-card galaxy-card">
      <view class="card-heading"><view><text class="card-kicker">GALAXY MAP</text><text class="card-title">成长世界</text></view><text class="fact-tag">成长进度</text></view>
      <text class="muted">每次练习，都为你的成长地图点亮一点星光。</text>
      <view class="galaxy-map"><view v-for="node in galaxyNodes" :key="node.code" class="galaxy-node"><view class="galaxy-node__dot">✦</view><text>{{ node.title }}</text><text class="muted">{{ node.description }}</text><text class="pending">{{ node.hasData ? `${stateLabel(node.status)} · ${node.progress}/${node.requiredProgress}（${node.progressPercent}%）` : '进度待确认' }}</text></view></view>
      <text v-if="b4.galaxy" class="muted">总成长 XP：{{ b4.galaxy.totalXp }}</text>
      <view v-if="b4.season" class="season-row"><text>{{ b4.season.title }}</text><text>{{ b4.season.points }} 赛季点 · {{ stateLabel(b4.season.status) }}</text></view>
      <text v-else class="empty-copy">当前暂无赛季活动。</text>
    </view>

    <view class="yx-card streak-card">
      <view class="card-heading"><view><text class="card-kicker">STREAK CALENDAR</text><text class="card-title">连续学习日历</text></view><text class="streak-fire">♨</text></view>
      <template v-if="b4.streak"><text class="streak-number">{{ b4.streak.currentStreak }}<text> 天</text></text><text class="muted">上次有效日：{{ b4.streak.lastValidDate ?? '暂无记录' }} · {{ b4.streak.timeZone }} · {{ stateLabel(b4.streak.status) }}</text><button v-if="['AT_RISK', 'BROKEN', 'FROZEN'].includes(b4.streak.status)" tabindex="0" role="button" class="yx-button yx-button--secondary" type="button" @click="b4.rescueStreak('CHALLENGE')">请求破冰挑战</button></template>
      <text v-else class="empty-copy">还没有连续学习记录，从今天开始积累吧。</text>
    </view>

    <view class="b4-entry-grid">
      <button tabindex="0" role="button" class="yx-button entry-button" type="button" @click="navigate('/pages/b4-games/b4-games')"><text>游戏大厅</text><text>用小挑战巩固所学</text></button>
      <button tabindex="0" role="button" class="yx-button entry-button" type="button" @click="navigate('/pages/b4-social/b4-social')"><text>虚拟自习室</text><text>专注一刻，一起进步</text></button>
      <button tabindex="0" role="button" class="yx-button entry-button" type="button" @click="navigate('/pages/b4-avatar/b4-avatar')"><text>我的形象</text><text>装扮自己的成长空间</text></button>
      <button tabindex="0" role="button" class="yx-button entry-button" type="button" @click="navigate('/pages/b4-offline/b4-offline')"><text>离线包</text><text>把学习带在身边</text></button>
    </view>

    <view class="yx-card quest-card"><view class="card-heading"><view><text class="card-kicker">成长任务</text><text class="card-title">学习挑战</text></view><text>{{ b4.quests.length ? `${b4.quests.length} 个任务` : '暂无' }}</text></view><view v-if="b4.quests.length" class="quest-list"><view v-for="quest in b4.quests" :key="quest.questId" class="quest-row"><view><text>{{ quest.title }}</text><text class="muted">{{ questPeriod(quest.period) }}</text></view><text :class="quest.completed ? 'done' : 'pending'">{{ quest.claimed ? '已领取' : quest.completed ? '待领取' : `${quest.progress}/${quest.target}` }}</text></view></view><text v-else class="empty-copy">暂无成长任务。</text></view>
    <B12RewardsCard />
  </view>
</template>

<style scoped lang="scss">
.b4-world{padding-bottom:56rpx}.b4-metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:16rpx;margin-top:28rpx}.b4-metric{display:grid;gap:8rpx;padding:22rpx;border:1rpx solid var(--yx-border);border-radius:16rpx;background:var(--yx-surface-card)}.b4-metric>text:first-child{color:var(--yx-brand);font-size:21rpx;font-weight:800;letter-spacing:2rpx}.b4-metric__value{font-size:40rpx;font-weight:800}.b4-metric>text:last-child{color:var(--yx-text-secondary);font-size:21rpx}.card-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:16rpx}.card-kicker{display:block;color:var(--yx-brand);font-size:21rpx;font-weight:800;letter-spacing:2rpx}.card-title{display:block;margin-top:8rpx;font-size:34rpx;font-weight:750}.fact-tag{color:var(--yx-text-secondary);font-size:22rpx}.muted{color:var(--yx-text-secondary);font-size:23rpx;line-height:1.6}.galaxy-map{display:grid;grid-template-columns:repeat(2,1fr);gap:12rpx;margin-top:18rpx;padding:16rpx;border-radius:16rpx;background:var(--yx-surface-page)}.galaxy-node{display:grid;gap:8rpx;min-height:150rpx;padding:16rpx;border:1rpx solid var(--yx-border);border-radius:14rpx;background:var(--yx-surface-card)}.galaxy-node__dot{display:flex;width:46rpx;height:46rpx;align-items:center;justify-content:center;border-radius:50%;color:var(--yx-on-brand);background:linear-gradient(135deg,var(--yx-action),var(--yx-action))}.pending{color:var(--yx-warning);font-size:21rpx}.season-row{display:flex;justify-content:space-between;gap:12rpx;margin-top:18rpx;padding:16rpx;border-radius:12rpx;color:var(--yx-brand);background:var(--yx-brand-soft);font-size:23rpx}.empty-copy{display:block;padding:18rpx;border:1rpx dashed var(--yx-border);border-radius:12rpx;color:var(--yx-text-secondary);font-size:24rpx;line-height:1.6}.streak-card{margin-top:24rpx}.streak-fire{display:flex;width:56rpx;height:56rpx;align-items:center;justify-content:center;border-radius:16rpx;color:var(--yx-on-brand);background:var(--yx-warning);font-size:28rpx}.streak-number{display:block;margin-top:12rpx;color:var(--yx-brand);font-size:72rpx;font-weight:800}.streak-number text{font-size:26rpx;font-weight:500;color:var(--yx-text-secondary)}.b4-entry-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16rpx;margin-top:24rpx}.entry-button{display:grid!important;height:150rpx!important;align-content:center;gap:8rpx;padding:20rpx!important;text-align:left}.entry-button text:first-child{font-size:30rpx}.entry-button text:last-child{color:var(--yx-brand-soft);font-size:21rpx;font-weight:400}.quest-card{margin-top:24rpx}.quest-list{display:grid;gap:10rpx;margin-top:16rpx}.quest-row{display:flex;align-items:center;justify-content:space-between;gap:12rpx;padding:16rpx;border-radius:12rpx;background:var(--yx-surface-page)}.quest-row>view{display:grid;gap:5rpx}.done{color:var(--yx-success);font-size:22rpx}.quest-row .pending{font-size:22rpx}@media(max-width:560px){.b4-metrics{gap:10rpx}.b4-metric{padding:16rpx}.b4-metric__value{font-size:30rpx}.b4-entry-grid{grid-template-columns:1fr}.season-row{display:grid}}
</style>
