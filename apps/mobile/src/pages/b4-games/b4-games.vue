<script setup lang="ts">
import MobilePageHeader from '../../components/MobilePageHeader.vue'
import { useMobileExperience } from '../../platform/experience'
const { experienceStyle, experienceMotion } = useMobileExperience()

import { onShow } from '@dcloudio/uni-app'
import B4StatusPanel from '../../components/b4/B4StatusPanel.vue'
import { B4_PERFORMANCE_LEVELS, gameLabel, type B4PerformanceLevel } from '../../domain/b4'
import { getUniRuntime } from '../../platform/uni-runtime'
import { useSessionStore } from '../../stores/session'
import { useB4Store } from '../../stores/b4'

const session = useSessionStore()
const b4 = useB4Store()

onShow(async () => {
  await session.restore()
  if (!session.isAuthenticated) { getUniRuntime().navigateTo({ url: '/pages/login/login' }); return }
  b4.restore()
  void b4.loadWorld()
})

function selectPerformance(level: B4PerformanceLevel): void { b4.setPerformance(level) }
function gameStatusLabel(value: string): string { return ({ READY: '准备中', IN_PROGRESS: '进行中', PAUSED: '已暂停', FINISHED: '已结束', COMPLETED: '已完成', EXPIRED: '已过期' } as Record<string, string>)[value] ?? '状态待确认' }
</script>

<template>
  <view class="yx-page b4-games" :style="experienceStyle" :data-motion="experienceMotion">
    <MobilePageHeader page="b4-games" />

    <B4StatusPanel :status="b4.status" :online="b4.online" :message="b4.lastError" :queue-count="b4.queueCount" :performance-level="b4.performanceLevel" @retry="b4.loadWorld" @sync="b4.syncOffline" @performance="selectPerformance" />
    <view class="yx-card"><view class="heading"><view><text class="kicker">学习游戏</text><text class="card-title">小游戏</text></view><text class="muted">{{ b4.games.length }} 项</text></view><view v-if="b4.games.length" class="game-grid"><view v-for="game in b4.games" :key="game.gameCode" class="game-card game-card--disabled"><text class="game-icon">✦</text><text class="game-title">{{ gameLabel(game.gameCode) }}</text><text class="muted">{{ game.enabled ? '玩法准备中' : '暂未开放' }}</text><text v-if="game.maxMinutes" class="muted">每次最多 {{ game.maxMinutes }} 分钟</text><button tabindex="0" role="button" class="yx-button" type="button" disabled>暂未开放</button></view></view><text v-else class="empty-copy">暂无可用游戏。</text></view>
    <view v-if="b4.activeGame" class="yx-card session-card"><view class="heading"><view><text class="kicker">游戏进度</text><text class="card-title">{{ gameLabel(b4.activeGame.gameCode) }}</text></view><text class="state">{{ gameStatusLabel(b4.activeGame.status) }}</text></view><text class="muted">已进行 {{ b4.activeGame.attemptCount }} 回合</text><text class="warning">当前还没有可操作的题目。</text><view class="actions"><button tabindex="0" role="button" v-if="b4.activeGame.status === 'IN_PROGRESS' || b4.activeGame.status === 'READY'" class="small-button secondary" type="button" @click="b4.pauseGame">暂停</button><button tabindex="0" role="button" v-if="b4.activeGame.status === 'PAUSED'" class="small-button secondary" type="button" @click="b4.resumeGame">恢复</button><button tabindex="0" role="button" class="small-button secondary" type="button" @click="b4.refreshGame">刷新</button><button tabindex="0" role="button" class="small-button danger" type="button" @click="b4.finishGame">结束</button></view></view>
    <view v-if="b4.lastGameResult" class="yx-card result-card"><text class="card-title">{{ b4.lastGameResult.passed ? '挑战通过' : '再练习一次' }}</text><text>正确率 {{ b4.lastGameResult.accuracyPercent }}% · 完成度 {{ b4.lastGameResult.completionPercent }}% · 得分 {{ b4.lastGameResult.serverScore }}</text><text class="muted">{{ b4.lastGameResult.rewardEligible ? '符合奖励条件' : '暂不符合奖励条件' }}</text></view>
  </view>
</template>

<style scoped lang="scss">
.b4-games{padding-bottom:56rpx}.heading{display:flex;align-items:flex-start;justify-content:space-between;gap:14rpx}.kicker{display:block;color:var(--yx-brand);font-size:21rpx;font-weight:800;letter-spacing:2rpx}.card-title{display:block;margin-top:8rpx;font-size:34rpx;font-weight:750}.muted{color:var(--yx-text-secondary);font-size:22rpx;line-height:1.55}.game-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12rpx;margin-top:20rpx}.game-card{display:grid;gap:8rpx;padding:18rpx;border:1rpx solid var(--yx-border);border-radius:14rpx;background:var(--yx-surface-card)}.game-icon{display:flex;width:48rpx;height:48rpx;align-items:center;justify-content:center;border-radius:14rpx;color:var(--yx-brand);background:var(--yx-brand-soft)}.game-title{font-size:29rpx;font-weight:750}.empty-copy{display:block;padding:18rpx;border:1rpx dashed var(--yx-border);border-radius:12rpx;color:var(--yx-text-secondary);font-size:24rpx;line-height:1.6}.session-card{display:grid;gap:14rpx}.state{padding:6rpx 10rpx;border-radius:8rpx;color:var(--yx-success);background:var(--yx-border);font-size:21rpx}.warning{padding:16rpx;border-radius:12rpx;color:var(--yx-warning);background:var(--yx-danger-soft);font-size:22rpx;line-height:1.6}.field{height:78rpx;padding:0 18rpx;border:1rpx solid var(--yx-border);border-radius:12rpx;background:var(--yx-surface-card);font-size:24rpx}.actions{display:flex;gap:10rpx;flex-wrap:wrap}.small-button{min-height:64rpx;padding:0 18rpx;border:0;border-radius:12rpx;color:var(--yx-on-brand);background:var(--yx-action);font-size:22rpx;line-height:64rpx}.small-button:disabled{opacity:.45}.small-button.secondary{border:1rpx solid var(--yx-border);color:var(--yx-brand);background:var(--yx-surface-card)}.small-button.danger{color:var(--yx-danger);background:var(--yx-danger-soft)}.result-card{display:grid;gap:8rpx;color:var(--yx-success);background:var(--yx-border)}@media(max-width:520px){.game-grid{grid-template-columns:1fr}.actions{display:grid}.small-button{width:100%}}
.game-card--disabled{background:var(--yx-surface-page)}.game-card--disabled .game-icon{color:var(--yx-text-tertiary);background:var(--yx-border)}
</style>
