<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app'
import { ref } from 'vue'
import B4StatusPanel from '../../components/b4/B4StatusPanel.vue'
import { B4_PERFORMANCE_LEVELS, gameLabel, type B4GameCode, type B4PerformanceLevel } from '../../domain/b4'
import { getUniRuntime } from '../../platform/uni-runtime'
import { useSessionStore } from '../../stores/session'
import { useB4Store } from '../../stores/b4'

const session = useSessionStore()
const b4 = useB4Store()
const responseToken = ref('')
const itemCode = ref('')

onShow(async () => {
  await session.restore()
  if (!session.isAuthenticated) { getUniRuntime().navigateTo({ url: '/pages/login/login' }); return }
  b4.restore()
  if (!b4.games.length) void b4.loadWorld()
})

function selectPerformance(level: B4PerformanceLevel): void { b4.setPerformance(level) }
function start(code: B4GameCode): void { responseToken.value = ''; itemCode.value = ''; void b4.startGame(code) }
function submit(): void { void b4.submitGameEvent(responseToken.value, itemCode.value || undefined) }
</script>

<template>
  <view class="yx-page b4-games">
    <text class="yx-eyebrow">B4 · GAME LOBBY</text>
    <text class="yx-title">游戏大厅</text>
    <text class="yx-description">游戏题包、回合和最终结果均由服务端判定；Performance 档保留完整学习判定链。</text>
    <B4StatusPanel :status="b4.status" :online="b4.online" :message="b4.lastError" :queue-count="b4.queueCount" :performance-level="b4.performanceLevel" @retry="b4.loadWorld" @sync="b4.syncOffline" @performance="selectPerformance" />
    <view class="yx-card"><view class="heading"><view><text class="kicker">GAME LOBBY</text><text class="card-title">规则化学习游戏</text></view><text class="muted">{{ b4.games.length }} 个目录项</text></view><view v-if="b4.games.length" class="game-grid"><view v-for="game in b4.games" :key="game.gameCode" class="game-card" :class="{ 'game-card--disabled': !game.enabled }"><text class="game-icon">✦</text><text class="game-title">{{ gameLabel(game.gameCode) }}</text><text class="muted">{{ game.gameCode }}</text><text class="muted">发布阶段 {{ game.releasePhase }} · {{ game.enabled ? '当前可用' : '尚未开放' }}</text><text class="muted">{{ game.maxMinutes ?? '—' }} 分钟上限 · 暂停 {{ game.pauseLimitMinutes ?? '—' }} 分钟</text><button class="yx-button" type="button" :disabled="!game.enabled" @click="start(game.gameCode)">{{ game.enabled ? '创建会话' : '阶段未开放' }}</button></view></view><text v-else class="empty-copy">服务端未返回游戏目录，无法开始。</text></view>
    <view v-if="b4.activeGame" class="yx-card session-card"><view class="heading"><view><text class="kicker">GAME SESSION</text><text class="card-title">{{ gameLabel(b4.activeGame.gameCode) }}</text></view><text class="state">{{ b4.activeGame.status }}</text></view><text class="muted">{{ b4.activeGame.sessionId }} · seq {{ b4.activeGame.seq }} · 回合 {{ b4.activeGame.attemptCount }}</text><text class="warning">服务端题包返回后才能提交；客户端不会猜答案、题目或奖励。</text><view v-if="b4.activeGame.challenges.length" class="challenge-list"><text class="muted">服务端题包</text><button v-for="challenge in b4.activeGame.challenges" :key="challenge.roundNo" class="small-button secondary" type="button" @click="responseToken = challenge.challengeToken; itemCode = challenge.itemCode">第 {{ challenge.roundNo }} 轮 · {{ challenge.itemCode }}</button></view><input v-model="responseToken" class="field" placeholder="服务端 responseToken" /><input v-model="itemCode" class="field" placeholder="服务端 itemCode（必填）" /><view class="actions"><button class="small-button" type="button" :disabled="!responseToken.trim()" @click="submit">提交回合</button><button v-if="b4.activeGame.status === 'IN_PROGRESS' || b4.activeGame.status === 'READY'" class="small-button secondary" type="button" @click="b4.pauseGame">暂停</button><button v-if="b4.activeGame.status === 'PAUSED'" class="small-button secondary" type="button" @click="b4.resumeGame">恢复</button><button class="small-button secondary" type="button" @click="b4.refreshGame">刷新</button><button class="small-button danger" type="button" @click="b4.finishGame">结束并请求结果</button></view></view>
    <view v-if="b4.lastGameResult" class="yx-card result-card"><text class="card-title">{{ b4.lastGameResult.passed ? '服务端判定通过' : '服务端判定未通过' }}</text><text>正确率 {{ b4.lastGameResult.accuracyPercent }}% · 完成度 {{ b4.lastGameResult.completionPercent }}% · 得分 {{ b4.lastGameResult.serverScore }}</text><text class="muted">奖励资格：{{ b4.lastGameResult.rewardEligible ? '服务端允许' : '服务端未授予' }}</text></view>
  </view>
</template>

<style scoped lang="scss">
.b4-games{padding-bottom:56rpx}.heading{display:flex;align-items:flex-start;justify-content:space-between;gap:14rpx}.kicker{display:block;color:#596bff;font-size:21rpx;font-weight:800;letter-spacing:2rpx}.card-title{display:block;margin-top:8rpx;font-size:34rpx;font-weight:750}.muted{color:#666d80;font-size:22rpx;line-height:1.55}.game-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12rpx;margin-top:20rpx}.game-card{display:grid;gap:8rpx;padding:18rpx;border:1rpx solid #e6e8f0;border-radius:14rpx;background:#fff}.game-icon{display:flex;width:48rpx;height:48rpx;align-items:center;justify-content:center;border-radius:14rpx;color:#596bff;background:#eef0ff}.game-title{font-size:29rpx;font-weight:750}.empty-copy{display:block;padding:18rpx;border:1rpx dashed #dfe3ee;border-radius:12rpx;color:#666d80;font-size:24rpx;line-height:1.6}.session-card{display:grid;gap:14rpx}.state{padding:6rpx 10rpx;border-radius:8rpx;color:#26745f;background:#edf9f4;font-size:21rpx}.warning{padding:16rpx;border-radius:12rpx;color:#8b5a10;background:#fff8e7;font-size:22rpx;line-height:1.6}.field{height:78rpx;padding:0 18rpx;border:1rpx solid #d9dce7;border-radius:12rpx;background:#fff;font-size:24rpx}.actions{display:flex;gap:10rpx;flex-wrap:wrap}.small-button{min-height:64rpx;padding:0 18rpx;border:0;border-radius:12rpx;color:#fff;background:#596bff;font-size:22rpx;line-height:64rpx}.small-button:disabled{opacity:.45}.small-button.secondary{border:1rpx solid #d9dce7;color:#596bff;background:#fff}.small-button.danger{color:#b52d43;background:#fff0f3}.result-card{display:grid;gap:8rpx;color:#26745f;background:#edf9f4}@media(max-width:520px){.game-grid{grid-template-columns:1fr}.actions{display:grid}.small-button{width:100%}}
.game-card--disabled{background:#f7f8fc}.game-card--disabled .game-icon{color:#8a91a3;background:#eceef4}
</style>
