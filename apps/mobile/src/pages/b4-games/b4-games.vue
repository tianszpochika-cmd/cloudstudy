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
  <view class="yx-page b4-games v2-games-page" :style="experienceStyle" :data-motion="experienceMotion">
    <MobilePageHeader page="b4-games" />

    <view class="v2-games-body">
      <B4StatusPanel :status="b4.status" :online="b4.online" :message="b4.lastError" :queue-count="b4.queueCount" :performance-level="b4.performanceLevel" @retry="b4.loadWorld" @sync="b4.syncOffline" @performance="selectPerformance" />
      <view class="yx-card card v2-games-card">
        <view class="heading v2-games-head"><view class="v2-games-titles"><text class="kicker v2-games-eyebrow">学习游戏</text><text class="card-title v2-games-title v2-games-h2">小游戏</text></view><text class="muted v2-games-d v2-games-count">{{ b4.games.length }} 项</text></view>
        <view v-if="b4.games.length" class="game-grid v2-games-list v2-games-grid">
          <view v-for="game in b4.games" :key="game.gameCode" class="game-card game-card--disabled" :class="'card v2-games-card v2-games-row'">
            <text class="game-icon v2-games-icon">✦</text>
            <text class="game-title v2-games-name v2-games-h2">{{ gameLabel(game.gameCode) }}</text>
            <text class="yx-soon-badge v2-games-tag" data-coming-soon>即将开放</text>
            <text v-if="game.maxMinutes" class="muted v2-games-d">每次最多 {{ game.maxMinutes }} 分钟</text>
            <text class="yx-soon-reason" data-closed-reason>{{ game.enabled ? '服务端已登记此玩法，但游戏关卡还在开发，暂时只能查看目录。' : '此玩法尚未上线，开放后会出现在这里。' }}</text>
          </view>
        </view>
        <text v-else class="empty-copy v2-games-fb v2-games-d">暂无可用游戏。</text>
      </view>
      <view v-if="b4.activeGame" class="yx-card session-card card v2-games-card">
        <view class="heading v2-games-head"><view class="v2-games-titles"><text class="kicker v2-games-eyebrow">游戏进度</text><text class="card-title v2-games-title v2-games-h2">{{ gameLabel(b4.activeGame.gameCode) }}</text></view><text class="state v2-games-state v2-games-tag">{{ gameStatusLabel(b4.activeGame.status) }}</text></view>
        <text class="muted v2-games-d">已进行 {{ b4.activeGame.attemptCount }} 回合</text>
        <text class="warning v2-games-fb v2-games-d">当前还没有可操作的题目。</text>
        <view class="actions v2-games-actions"><button tabindex="0" role="button" v-if="b4.activeGame.status === 'IN_PROGRESS' || b4.activeGame.status === 'READY'" class="small-button secondary btn v2-games-btn v2-games-opt" type="button" @click="b4.pauseGame">暂停</button><button tabindex="0" role="button" v-if="b4.activeGame.status === 'PAUSED'" class="small-button secondary btn v2-games-btn v2-games-opt" type="button" @click="b4.resumeGame">恢复</button><button tabindex="0" role="button" class="small-button secondary btn v2-games-btn v2-games-opt" type="button" @click="b4.refreshGame">刷新</button><button tabindex="0" role="button" class="small-button danger btn v2-games-btn v2-games-opt" type="button" @click="b4.finishGame">结束</button></view>
      </view>
      <view v-if="b4.lastGameResult" class="yx-card result-card card v2-games-card">
        <text class="card-title v2-games-title v2-games-h2">{{ b4.lastGameResult.passed ? '挑战通过' : '再练习一次' }}</text>
        <text class="v2-games-d">正确率 {{ b4.lastGameResult.accuracyPercent }}% · 完成度 {{ b4.lastGameResult.completionPercent }}% · 得分 {{ b4.lastGameResult.serverScore }}</text>
        <text class="muted v2-games-d">{{ b4.lastGameResult.rewardEligible ? '符合奖励条件' : '暂不符合奖励条件' }}</text>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.b4-games{padding-bottom:56rpx}.heading{display:flex;align-items:flex-start;justify-content:space-between;gap:14rpx}.kicker{display:block;color:var(--yx-brand);font-size:21rpx;font-weight:800;letter-spacing:2rpx}.card-title{display:block;margin-top:8rpx;font-size:34rpx;font-weight:750}.muted{color:var(--yx-text-secondary);font-size:22rpx;line-height:1.55}.game-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12rpx;margin-top:20rpx}.game-card{display:grid;gap:8rpx;padding:18rpx;border:1rpx solid var(--yx-border);border-radius:14rpx;background:var(--yx-surface-card)}.game-icon{display:flex;width:48rpx;height:48rpx;align-items:center;justify-content:center;border-radius:14rpx;color:var(--yx-brand);background:var(--yx-brand-soft)}.game-title{font-size:29rpx;font-weight:750}.empty-copy{display:block;padding:18rpx;border:1rpx dashed var(--yx-border);border-radius:12rpx;color:var(--yx-text-secondary);font-size:24rpx;line-height:1.6}.session-card{display:grid;gap:14rpx}.state{padding:6rpx 10rpx;border-radius:8rpx;color:var(--yx-success);background:var(--yx-border);font-size:21rpx}.warning{padding:16rpx;border-radius:12rpx;color:var(--yx-warning);background:var(--yx-danger-soft);font-size:22rpx;line-height:1.6}.field{height:78rpx;padding:0 18rpx;border:1rpx solid var(--yx-border);border-radius:12rpx;background:var(--yx-surface-card);font-size:24rpx}.actions{display:flex;gap:10rpx;flex-wrap:wrap}.small-button{min-height:64rpx;padding:0 18rpx;border:0;border-radius:12rpx;color:var(--yx-on-brand);background:var(--yx-action);font-size:22rpx;line-height:64rpx}.small-button:disabled{opacity:.45}.small-button.secondary{border:1rpx solid var(--yx-border);color:var(--yx-brand);background:var(--yx-surface-card)}.small-button.danger{color:var(--yx-danger);background:var(--yx-danger-soft)}.result-card{display:grid;gap:8rpx;color:var(--yx-success);background:var(--yx-border)}@media(max-width:520px){.game-grid{grid-template-columns:1fr}.actions{display:grid}.small-button{width:100%}}
.game-card--disabled{background:var(--yx-surface-page)}.game-card--disabled .game-icon{color:var(--yx-text-tertiary);background:var(--yx-border)}
/* v2 小游戏页换皮：对齐 mobile/styles.css 与 refine.css 中 .card/.eyebrow/.opt/.fb/.btn/.list-row，对齐 practice.vue v2-practice-* 与 today.vue v2-today-* 同样数值，仅用 var(--v2-*)。 */
.v2-games-page{box-sizing:border-box;max-width:100%;min-width:0;font-family:var(--v2-font)}
.v2-games-body{display:flex;flex-direction:column;gap:var(--v2-space-4);box-sizing:border-box;max-width:100%;min-width:0;font-family:var(--v2-font)}
.v2-games-body>*{min-width:0;max-width:100%}
.v2-games-card{display:grid;gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;padding:var(--v2-space-5);border:1px solid var(--v2-line);border-radius:var(--v2-radius-lg);background:var(--v2-card);box-shadow:var(--v2-shadow);font-family:var(--v2-font)}
.v2-games-card:hover{border-color:var(--v2-brand)}
.v2-games-head{display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;font-family:var(--v2-font)}
.v2-games-head>*{min-width:0;max-width:100%}
.v2-games-titles{display:grid;gap:var(--v2-space-1);box-sizing:border-box;max-width:100%;min-width:0;flex:1 1 auto;font-family:var(--v2-font)}
.v2-games-eyebrow{display:flex;align-items:center;flex-wrap:wrap;gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;margin:0 0 var(--v2-space-2);color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-xs);font-weight:700;letter-spacing:.06em;text-transform:uppercase;overflow-wrap:anywhere}
.v2-games-title{display:block;box-sizing:border-box;max-width:100%;min-width:0;margin:var(--v2-space-1) 0 0;color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-lg);font-weight:700;line-height:1.45;overflow-wrap:anywhere}
.v2-games-h2{box-sizing:border-box;max-width:100%;min-width:0;font-family:var(--v2-font);overflow-wrap:anywhere}
.v2-games-d{display:block;box-sizing:border-box;max-width:100%;min-width:0;color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.7;overflow-wrap:anywhere}
.v2-games-count{display:block;box-sizing:border-box;max-width:100%;min-width:0;flex:0 1 auto;color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.7;overflow-wrap:anywhere}
.v2-games-list{display:grid;gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;font-family:var(--v2-font)}
.v2-games-list>*{min-width:0;max-width:100%}
.v2-games-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;font-family:var(--v2-font)}
.v2-games-grid>*{min-width:0;max-width:100%}
.v2-games-row{display:grid;gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;padding:var(--v2-space-4);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);background:var(--v2-card);font-family:var(--v2-font)}
.v2-games-row:hover{border-color:var(--v2-brand)}
.v2-games-row>*{min-width:0;max-width:100%}
.v2-games-icon{display:grid;place-items:center;box-sizing:border-box;width:var(--v2-space-12);height:var(--v2-space-12);border-radius:var(--v2-radius-md);background:var(--v2-soft);color:var(--v2-brand);font-family:var(--v2-font);font-size:var(--v2-text-lg);font-weight:700;line-height:1}
.v2-games-name{display:block;box-sizing:border-box;max-width:100%;min-width:0;color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-lg);font-weight:700;line-height:1.45;overflow-wrap:anywhere}
.v2-games-tag{display:inline-flex;align-items:center;justify-self:start;box-sizing:border-box;max-width:100%;min-width:0;padding:var(--v2-space-1) var(--v2-space-2);border-radius:var(--v2-radius-pill);background:var(--v2-soft);color:var(--v2-brand);font-family:var(--v2-font);font-size:var(--v2-text-xs);font-weight:700;line-height:1.5;overflow-wrap:anywhere}
.v2-games-state{display:inline-flex;align-items:center;box-sizing:border-box;max-width:100%;min-width:0;padding:var(--v2-space-1) var(--v2-space-2);border-radius:var(--v2-radius-pill);background:var(--v2-ok-soft);color:var(--v2-ok);font-family:var(--v2-font);font-size:var(--v2-text-xs);font-weight:700;line-height:1.5;overflow-wrap:anywhere}
.v2-games-btn{box-sizing:border-box;display:flex;align-items:center;justify-content:center;width:100%;max-width:100%;min-width:0;min-height:var(--v2-space-12);padding:var(--v2-space-3) var(--v2-space-4);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);background:var(--v2-card);color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-sm);font-weight:600;line-height:1.5;white-space:nowrap;overflow-wrap:anywhere}
.v2-games-opt{box-sizing:border-box;display:flex;align-items:center;justify-content:center;width:100%;max-width:100%;min-width:0;min-height:var(--v2-space-12);padding:var(--v2-space-3) var(--v2-space-4);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);background:var(--v2-card);color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-sm);font-weight:600;line-height:1.5;white-space:nowrap;overflow-wrap:anywhere}
.v2-games-btn:hover,.v2-games-opt:hover{border-color:var(--v2-brand)}
.v2-games-btn:active,.v2-games-opt:active{transform:scale(.97)}
.v2-games-btn:focus-visible,.v2-games-opt:focus-visible{box-shadow:var(--v2-focus);outline:none}
.v2-games-btn:disabled,.v2-games-opt:disabled{background:var(--v2-surface);color:var(--v2-mut);border:1px dashed var(--v2-line);box-shadow:none}
.v2-games-actions{display:flex;flex-wrap:wrap;align-items:center;gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;font-family:var(--v2-font)}
.v2-games-actions>*{min-width:0;max-width:100%}
.v2-games-fb{display:block;box-sizing:border-box;max-width:100%;min-width:0;margin-top:var(--v2-space-4);padding:var(--v2-space-3) var(--v2-space-4);border-radius:var(--v2-radius-md);background:var(--v2-surface);color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.7;overflow-wrap:anywhere}
@media(max-width:480px){.v2-games-grid{grid-template-columns:1fr}}
</style>
