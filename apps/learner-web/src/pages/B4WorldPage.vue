<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { B4_PERFORMANCE_LEVELS, formatSeconds, gameLabel, interactionLabel, type B4GameCode, type B4InteractionCode } from '../domain/b4'
import B12RewardsCard from '../components/b12/B12RewardsCard.vue'
import B12SocialExtensions from '../components/b12/B12SocialExtensions.vue'
import { useB4Store } from '../stores/b4'

type B4Panel = 'world' | 'games' | 'social' | 'avatar' | 'offline'

const b4 = useB4Store()
const activePanel = ref<B4Panel>('world')
const gameResponseToken = ref('')
const gameItemCode = ref('')
const focusMinutes = ref<25 | 45>(25)
const interactionCode = ref<B4InteractionCode>('CHEER_UP')
const weekendProtection = ref(false)
const timeZone = ref('Asia/Shanghai')
const now = ref(Date.now())
let timer: number | undefined

const mapNodes = [
  { code: 'ORIGIN', title: '起源星门', description: '首次学习事件与成长入口' },
  { code: 'VOCAB_ORBIT', title: '词汇轨道', description: '词汇学习与复习事件' },
  { code: 'GRAMMAR_NEBULA', title: '语法星云', description: '阅读与 Checkpoint 进度' },
  { code: 'LISTENING_MOON', title: '听力卫星', description: '听力完成事件' },
  { code: 'SPEAKING_STAR', title: '表达恒星', description: '写作与合格游戏事件' },
  { code: 'GALAXY_GATE', title: '星系之门', description: '每日目标与全局成长' },
]
const galaxyNodes = computed(() => mapNodes.map((node) => {
  const serverNode = b4.galaxy?.nodes.find((item) => item.nodeCode === node.code)
  return {
    ...node,
    status: serverNode?.status ?? 'UNKNOWN',
    progress: serverNode?.progress ?? 0,
    requiredProgress: serverNode?.requiredProgress ?? 0,
    progressPercent: serverNode?.progressPercent ?? 0,
  }
}))
const unreadCount = computed(() => b4.notifications.filter((item) => !item.read).length)
const activeFocusSeconds = computed(() => {
  const focus = b4.activeFocus
  if (!focus) return 0
  const serverSeconds = focus.serverDurationSeconds
  if (focus.status !== 'RUNNING' || !focus.startedAt) return serverSeconds
  const startedAt = Date.parse(focus.startedAt)
  if (!Number.isFinite(startedAt)) return serverSeconds
  return Math.max(serverSeconds, Math.floor((now.value - startedAt) / 1000))
})

watch(() => b4.streak, (value) => {
  if (!value) return
  weekendProtection.value = value.weekendProtectionEnabled
  timeZone.value = value.timeZone
}, { immediate: true })

onMounted(() => {
  b4.restore()
  timer = window.setInterval(() => { now.value = Date.now() }, 1000)
  void b4.loadWorld()
})

onUnmounted(() => {
  if (timer !== undefined) window.clearInterval(timer)
})

function choosePerformance(level: string): void {
  if ((B4_PERFORMANCE_LEVELS as readonly string[]).includes(level)) b4.setPerformance(level as typeof B4_PERFORMANCE_LEVELS[number])
}

function retry(): void { void b4.loadWorld() }
function saveStreakSettings(): void { void b4.saveStreakSettings(timeZone.value, weekendProtection.value) }
function startGame(code: B4GameCode): void { gameResponseToken.value = ''; gameItemCode.value = ''; void b4.startGame(code) }
function sendGameEvent(): void { void b4.submitGameEvent(gameResponseToken.value, gameItemCode.value || undefined) }
function joinOrLeave(roomId: string, joined: boolean): void { void (joined ? b4.leaveRoom(roomId) : b4.joinRoom(roomId)) }
function sendInteraction(roomId: string): void { void b4.sendInteraction(roomId, interactionCode.value) }
function authorizePackage(packageId: string): void { void b4.authorizeOfflinePackage(packageId) }
function updateOfflineDownload(downloadId: string, action: 'PAUSE' | 'RESUME'): void { void b4.updateOfflineDownload(downloadId, action) }
function cleanupOfflineDownload(downloadId: string): void { void b4.cleanupOfflineDownload(downloadId) }
</script>

<template>
  <main class="b4-page" :data-performance="b4.performanceLevel" :data-avatar-render="b4.effectiveAvatarRenderMode" aria-labelledby="b4-title">
    <section class="b4-hero">
      <div>
        <p class="eyebrow">B4 · GROWTH & SOCIAL</p>
        <h1 id="b4-title">把每一次真实学习，连成自己的星系。</h1>
        <p>XP、Streak、游戏、Avatar 和自习室都只展示服务端返回的事实；网络异常时会明确保留待同步状态。</p>
      </div>
      <div class="b4-hero__orb" :class="{ 'b4-hero__orb--static': b4.performanceLevel === 'Performance' }" aria-hidden="true">✦</div>
    </section>

    <section class="b4-status" :class="`b4-status--${b4.status}`" role="status" aria-live="polite">
      <div>
        <strong>{{ b4.status === 'loading' ? '正在读取 B4 服务端数据' : b4.online ? '网络可用' : '网络不可用' }}</strong>
        <span>{{ b4.lastError ?? (b4.queueCount ? `本机有 ${b4.queueCount} 条待同步事件。` : '服务端确认后才会显示为已完成。') }}</span>
      </div>
      <div class="b4-status__actions">
        <span v-if="b4.queueCount" class="b4-queue">待同步 {{ b4.queueCount }}</span>
        <button v-if="b4.status === 'offline' || b4.status === 'error'" class="button button--secondary" type="button" @click="retry">重试读取</button>
        <button v-if="b4.queueCount" class="button button--secondary" type="button" @click="b4.syncOffline">同步队列</button>
        <label class="quality-select">性能
          <select :value="b4.performanceLevel" aria-label="B4 性能档位" @change="choosePerformance(($event.target as HTMLSelectElement).value)">
            <option v-for="level in B4_PERFORMANCE_LEVELS" :key="level" :value="level">{{ level }}</option>
          </select>
        </label>
      </div>
    </section>

    <nav class="b4-tabs" aria-label="B4 学习端模块">
      <button v-for="tab in ([['world', '成长世界'], ['games', '游戏大厅'], ['social', '自习室'], ['avatar', 'Avatar / 衣柜'], ['offline', '离线包']] as const)" :key="tab[0]" type="button" :class="{ 'b4-tabs__item--active': activePanel === tab[0] }" @click="activePanel = tab[0]">{{ tab[1] }}</button>
    </nav>

    <template v-if="activePanel === 'world'">
      <section class="b4-metrics" aria-label="成长摘要">
        <article class="b4-metric"><span>XP</span><strong v-if="b4.profile">{{ b4.profile.xp }}</strong><strong v-else>—</strong><small>{{ b4.profile ? `Lv.${b4.profile.level} · ${b4.profile.rank}` : '等待服务端成长账户' }}</small></article>
        <article class="b4-metric"><span>STAR COIN</span><strong v-if="b4.profile">{{ b4.profile.coins }}</strong><strong v-else>—</strong><small>{{ b4.profile ? `规则 ${b4.profile.ruleVersion ?? '未返回'}` : '余额以服务端账本为准' }}</small></article>
        <article class="b4-metric"><span>STREAK</span><strong v-if="b4.streak">{{ b4.streak.currentStreak }} 天</strong><strong v-else>—</strong><small>{{ b4.streak?.status ?? '等待服务端连续学习状态' }}</small></article>
        <article class="b4-metric"><span>通知</span><strong>{{ unreadCount }}</strong><small>{{ b4.notifications.length ? '未读通知' : '服务端未返回通知' }}</small></article>
      </section>

      <section class="b4-grid b4-grid--world">
        <article class="b4-card b4-card--wide">
          <div class="b4-card__heading"><div><p class="card-kicker">GALAXY MAP</p><h2>成长世界</h2></div><span class="b4-fact-tag">服务端进度</span></div>
          <p class="b4-muted">地图节点由成长接口返回的 growth.nodes 驱动；未返回的节点保持 UNKNOWN，客户端不自行补算完成状态。</p>
          <div class="b4-map" :class="{ 'b4-map--static': b4.performanceLevel === 'Performance' }">
            <article v-for="node in galaxyNodes" :key="node.code" class="b4-map__node"><span class="b4-map__dot" aria-hidden="true"></span><strong>{{ node.title }}</strong><small>{{ node.description }}</small><em>{{ node.status }} · {{ node.progress }} / {{ node.requiredProgress }}（{{ node.progressPercent }}%）</em></article>
          </div>
          <small v-if="b4.galaxy" class="b4-muted">总成长 XP：{{ b4.galaxy.totalXp }} · 规则：{{ b4.galaxy.ruleVersion ?? '服务端未返回' }}</small>
          <div class="b4-season" v-if="b4.season"><span>{{ b4.season.title }}</span><strong>{{ b4.season.points }} 赛季点</strong><small>{{ b4.season.status }} · {{ b4.season.seasonId }}</small></div>
          <div v-else class="b4-inline-empty">服务端未返回当前赛季数据。</div>
        </article>

        <article class="b4-card">
          <div class="b4-card__heading"><div><p class="card-kicker">STREAK CALENDAR</p><h2>连续学习</h2></div><span class="b4-streak-mark" :class="`b4-streak-mark--${b4.streak?.status ?? 'UNKNOWN'}`">♨</span></div>
          <template v-if="b4.streak">
            <div class="b4-streak-number"><strong>{{ b4.streak.currentStreak }}</strong><span>天连续学习</span></div>
            <p class="b4-muted">上次有效日：{{ b4.streak.lastValidDate ?? '服务端暂无记录' }}<br>时区：{{ b4.streak.timeZone }} · 状态：{{ b4.streak.status }}</p>
            <label class="b4-toggle"><input v-model="weekendProtection" type="checkbox"><span>开启周末保护</span></label>
            <label class="b4-field">IANA 时区<input v-model="timeZone" type="text" autocomplete="off"></label>
            <button class="button button--secondary" type="button" @click="saveStreakSettings">保存 Streak 设置</button>
            <button v-if="['AT_RISK', 'BROKEN', 'FROZEN'].includes(b4.streak.status)" class="button button--ghost" type="button" @click="b4.rescueStreak('CHALLENGE')">请求破冰挑战</button>
          </template>
          <p v-else class="b4-inline-empty">服务端未返回 Streak 日历，客户端不自行补算连续天数。</p>
        </article>
      </section>

      <section class="b4-card">
        <div class="b4-card__heading"><div><p class="card-kicker">QUESTS</p><h2>今日成长任务</h2></div><span>{{ b4.quests.length ? `${b4.quests.length} 个服务端任务` : '未返回任务' }}</span></div>
        <div v-if="b4.quests.length" class="b4-quest-list"><article v-for="quest in b4.quests" :key="quest.questId" class="b4-quest"><div><strong>{{ quest.title }}</strong><small>{{ quest.period }} · {{ quest.questId }}</small></div><div class="b4-quest__progress"><span>{{ quest.progress }} / {{ quest.target }}</span><progress :value="quest.progress" :max="Math.max(quest.target, 1)"></progress></div><span class="b4-quest__state">{{ quest.claimed ? '已领取' : quest.completed ? '待领取' : '进行中' }}</span></article></div>
        <p v-else class="b4-inline-empty">服务端未返回任务，未使用本地样例填充。</p>
      </section>
      <B12RewardsCard />
    </template>

    <template v-else-if="activePanel === 'games'">
      <section class="b4-card">
        <div class="b4-card__heading"><div><p class="card-kicker">GAME LOBBY</p><h2>规则化学习游戏</h2></div><span>可用性由服务端阶段 Gate 决定</span></div>
        <p class="b4-muted">游戏题包和 responseToken 必须由服务端会话返回；页面不会用本地答案、分数或奖励替代服务端判定。</p>
        <div v-if="b4.games.length" class="b4-game-grid"><article v-for="game in b4.games" :key="game.gameCode" class="b4-game" :class="{ 'b4-game--disabled': !game.enabled }"><span class="b4-game__icon" aria-hidden="true">✦</span><strong>{{ gameLabel(game.gameCode) }}</strong><small>{{ game.gameCode }}</small><span>发布阶段 {{ game.releasePhase }} · {{ game.enabled ? '当前可用' : '尚未开放' }}</span><span>{{ game.maxMinutes ?? '—' }} 分钟上限 · 暂停 {{ game.pauseLimitMinutes ?? '—' }} 分钟</span><button class="button button--primary" type="button" :disabled="!game.enabled" @click="startGame(game.gameCode)">{{ game.enabled ? '创建服务端会话' : '阶段未开放' }}</button></article></div>
        <p v-else class="b4-inline-empty">服务端未返回游戏目录，无法开始游戏。</p>
      </section>
      <section v-if="b4.activeGame" class="b4-card b4-game-session">
        <div class="b4-card__heading"><div><p class="card-kicker">GAME SESSION</p><h2>{{ gameLabel(b4.activeGame.gameCode) }}</h2></div><span class="b4-session-state">{{ b4.activeGame.status }}</span></div>
        <div class="b4-session-meta"><span>sessionId：{{ b4.activeGame.sessionId }}</span><span>seq：{{ b4.activeGame.seq }}</span><span>回合：{{ b4.activeGame.attemptCount }}</span></div>
        <p v-if="!gameResponseToken" class="b4-warning">当前会话快照没有返回题目或 responseToken，因此提交按钮不会替你猜答案；暂停/恢复仍可调用服务端状态机。</p>
        <div v-if="b4.activeGame.challenges.length" class="b4-challenge-list"><strong>服务端题包</strong><button v-for="challenge in b4.activeGame.challenges" :key="challenge.roundNo" class="button button--ghost" type="button" @click="gameResponseToken = challenge.challengeToken; gameItemCode = challenge.itemCode">第 {{ challenge.roundNo }} 轮 · {{ challenge.itemCode }}</button></div>
        <div class="b4-form-grid"><label class="b4-field">服务端 responseToken<input v-model="gameResponseToken" type="text" autocomplete="off" placeholder="点击服务端题包，或等待题包下发"></label><label class="b4-field">题目 itemCode（服务端必填）<input v-model="gameItemCode" type="text" autocomplete="off"></label></div>
        <div class="b4-button-row"><button class="button button--secondary" type="button" :disabled="!gameResponseToken.trim()" @click="sendGameEvent">提交服务端回合</button><button v-if="b4.activeGame.status === 'IN_PROGRESS' || b4.activeGame.status === 'READY'" class="button button--ghost" type="button" @click="b4.pauseGame">暂停</button><button v-if="b4.activeGame.status === 'PAUSED'" class="button button--ghost" type="button" @click="b4.resumeGame">恢复</button><button class="button button--ghost" type="button" @click="b4.refreshGame">刷新会话</button><button class="button button--danger" type="button" @click="b4.finishGame">结束并请求服务端结果</button></div>
      </section>
      <section v-if="b4.lastGameResult" class="b4-card b4-result"><strong>服务端最终结果：{{ b4.lastGameResult.passed ? '通过' : '未通过' }}</strong><span>正确率 {{ b4.lastGameResult.accuracyPercent }}% · 完成度 {{ b4.lastGameResult.completionPercent }}% · 得分 {{ b4.lastGameResult.serverScore }}</span><small>奖励资格：{{ b4.lastGameResult.rewardEligible ? '服务端允许' : '服务端未授予' }}</small></section>
    </template>

    <template v-else-if="activePanel === 'social'">
      <section class="b4-grid b4-grid--social">
        <article class="b4-card b4-card--wide"><div class="b4-card__heading"><div><p class="card-kicker">STUDY ROOMS</p><h2>虚拟自习室</h2></div><span>仅预设互动</span></div><div v-if="b4.rooms.length" class="b4-room-list"><article v-for="room in b4.rooms" :key="room.roomId" class="b4-room"><div><strong>{{ room.name }}</strong><small>{{ room.templateCode }} · {{ room.chatMode }}</small></div><span>{{ room.memberCount }} / {{ room.capacity }} 人</span><button class="button button--secondary" type="button" @click="joinOrLeave(room.roomId, room.joined)">{{ room.joined ? '离开' : '加入' }}</button><div v-if="room.joined" class="b4-room__actions"><button class="button button--primary" type="button" @click="b4.startFocus(room.roomId, focusMinutes)">开始 {{ focusMinutes }} 分钟专注</button><select v-model="interactionCode" aria-label="预设互动"><option v-for="code in (['CHEER_UP', 'STUDY_TOGETHER', 'CONGRATS', 'TRY_AGAIN', 'TONIGHT_20_MIN'] as B4InteractionCode[])" :key="code" :value="code">{{ interactionLabel(code) }}</option></select><button class="button button--ghost" type="button" @click="sendInteraction(room.roomId)">发送预设鼓励</button></div></article></div><p v-else class="b4-inline-empty">服务端未返回自习室列表。</p></article>
        <article class="b4-card"><div class="b4-card__heading"><div><p class="card-kicker">POMODORO</p><h2>番茄专注</h2></div><span v-if="b4.activeFocus">{{ b4.activeFocus.status }}</span></div><template v-if="b4.activeFocus"><strong class="b4-timer">{{ formatSeconds(activeFocusSeconds) }}</strong><p class="b4-muted">本地显示计时；实际专注时长以服务端 session 返回为准。</p><div class="b4-button-row"><button v-if="b4.activeFocus.status === 'RUNNING'" class="button button--secondary" type="button" @click="b4.updateFocus('PAUSE')">暂停</button><button v-if="b4.activeFocus.status === 'PAUSED'" class="button button--secondary" type="button" @click="b4.updateFocus('RESUME')">恢复</button><button v-if="['RUNNING', 'PAUSED'].includes(b4.activeFocus.status)" class="button button--danger" type="button" @click="b4.updateFocus('COMPLETE')">完成专注</button></div></template><template v-else><p class="b4-muted">先加入一个房间，再由服务端创建专注 session。</p><label class="b4-field">本端计划时长<select v-model="focusMinutes"><option :value="25">25 分钟</option><option :value="45">45 分钟</option></select></label><small class="b4-muted">当前 B4 REST 接口以服务端计时为准，本端选择不会伪造服务器时长。</small></template></article>
      </section>
      <section class="b4-card"><div class="b4-card__heading"><div><p class="card-kicker">NOTIFICATIONS</p><h2>通知</h2></div><button v-if="b4.notifications.length" class="button button--ghost" type="button" @click="b4.readAllNotifications">全部标记已读</button></div><div v-if="b4.notifications.length" class="b4-notification-list"><article v-for="item in b4.notifications" :key="item.messageId" class="b4-notification" :class="{ 'b4-notification--unread': !item.read }"><div><strong>{{ item.title }}</strong><p>{{ item.body || '服务端未提供正文。' }}</p><small>{{ item.category ?? 'SYSTEM' }} · {{ item.createdAt ?? '时间未返回' }}</small></div><button v-if="!item.read" class="button button--secondary" type="button" @click="b4.readNotification(item.messageId)">标记已读</button></article></div><p v-else class="b4-inline-empty">服务端未返回通知。</p></section>
      <B12SocialExtensions />
    </template>

    <template v-else-if="activePanel === 'avatar'">
      <section class="b4-grid b4-grid--avatar">
        <article class="b4-card b4-avatar-card"><div class="b4-card__heading"><div><p class="card-kicker">AVATAR</p><h2>我的 Avatar</h2></div><span>{{ b4.effectiveAvatarRenderMode }}</span></div><div class="b4-avatar-preview" :class="{ 'b4-avatar-preview--static': b4.effectiveAvatarRenderMode === '2D_FALLBACK' }" aria-label="Avatar 预览"><span>✦</span><small>{{ b4.effectiveAvatarRenderMode === '3D' ? '3D 资源模式' : '2D 静态 fallback' }}</small></div><p v-if="b4.avatarProfile" class="b4-muted">资源版本：{{ b4.avatarProfile.resourceVersion }} · 当前衣柜：{{ b4.avatarProfile.loadoutId }}</p><p v-else class="b4-inline-empty">服务端未返回 Avatar 配置。</p><button class="button button--secondary" type="button" :disabled="!b4.avatarProfile" @click="b4.saveAvatarProfile(b4.effectiveAvatarRenderMode, b4.avatarProfile?.resourceVersion)">保存当前渲染模式</button></article>
        <article class="b4-card"><div class="b4-card__heading"><div><p class="card-kicker">WARDROBE</p><h2>衣柜</h2></div><span>{{ b4.loadouts.length ? `${b4.loadouts.length} 套` : '未返回' }}</span></div><div v-if="b4.loadouts.length" class="b4-loadout-list"><article v-for="loadout in b4.loadouts" :key="loadout.loadoutId" class="b4-loadout"><div><strong>{{ loadout.name }}</strong><small>{{ loadout.loadoutId }} · {{ loadout.items.length }} 件</small></div><span v-if="loadout.equipped" class="b4-equipped">当前装备</span><button v-else class="button button--secondary" type="button" @click="b4.equipLoadout(loadout.loadoutId)">装备</button></article></div><p v-else class="b4-inline-empty">服务端未返回衣柜套装。</p></article>
      </section>
      <section class="b4-card"><div class="b4-card__heading"><div><p class="card-kicker">ITEMS</p><h2>可见资源</h2></div><span>{{ b4.avatarResources?.resourceVersion ?? '资源版本未返回' }}</span></div><div v-if="b4.avatarItems.length" class="b4-item-grid"><article v-for="item in b4.avatarItems" :key="item.itemCode" class="b4-item"><span>{{ item.quality }}</span><strong>{{ item.itemCode }}</strong><small>{{ item.slot }} · {{ item.resourceVersion }}</small></article></div><p v-else class="b4-inline-empty">服务端未返回 Avatar 物品，未使用本地样例。</p><p class="b4-muted">Performance 档自动使用 2D fallback；低配端不依赖 3D 资产完成成长和学习主链。</p></section>
    </template>

    <template v-else>
      <section class="b4-card"><div class="b4-card__heading"><div><p class="card-kicker">OFFLINE PACKAGES</p><h2>离线包与弱网状态</h2></div><span>{{ b4.online ? '在线' : '离线' }}</span></div><p class="b4-muted">下载状态只显示服务端返回的 manifest 状态。授权成功不等于资源已下载，浏览器端会等待真实清单、分片和校验结果。</p><div v-if="b4.offlinePackages.length" class="b4-package-list"><article v-for="item in b4.offlinePackages" :key="item.packageId" class="b4-package"><div><strong>{{ item.packageCode }}</strong><small>{{ item.packageId }} · v{{ item.version }}</small></div><span class="b4-package__state">{{ item.downloadState ?? item.state }}</span><span>{{ item.sizeBytes }} bytes · {{ item.completedPartCount }} / {{ item.partCount }} part · {{ item.downloadedBytes }} bytes</span><button v-if="item.state === 'PUBLISHED' && !item.downloadId" class="button button--secondary" type="button" @click="authorizePackage(item.packageId)">请求授权</button><button v-if="item.downloadId && ['AUTHORIZED', 'DOWNLOADING'].includes(item.downloadState ?? '')" class="button button--secondary" type="button" @click="updateOfflineDownload(item.downloadId, 'PAUSE')">暂停下载</button><button v-if="item.downloadId && item.downloadState === 'PAUSED'" class="button button--secondary" type="button" @click="updateOfflineDownload(item.downloadId, 'RESUME')">恢复下载</button><button v-if="item.downloadId && item.downloadState !== 'ACTIVE_LOCAL'" class="button button--ghost" type="button" @click="cleanupOfflineDownload(item.downloadId)">清理临时分片</button><small v-if="!item.downloadId">授权后才会生成下载任务。</small><small v-else>服务端状态：{{ item.downloadState ?? 'UNKNOWN' }}；完成后仍需服务端校验。</small></article></div><p v-else class="b4-inline-empty">服务端未返回离线包，未使用本地伪造包。</p></section>
      <section class="b4-card"><div class="b4-card__heading"><div><p class="card-kicker">LOCAL QUEUE</p><h2>待同步事件</h2></div><span>{{ b4.queueCount }} 条</span></div><div v-if="b4.offlineRecords.length" class="b4-queue-list"><article v-for="item in b4.offlineRecords" :key="item.id"><strong>{{ item.event.eventType }}</strong><span>{{ item.status }}</span><small>{{ item.event.entityId }} · {{ item.lastError ?? '等待服务端确认' }}</small></article></div><p v-else class="b4-inline-empty">暂无本地待同步事件。</p><button v-if="b4.queueCount" class="button button--primary" type="button" @click="b4.syncOffline">提交待同步事件</button></section>
    </template>
  </main>
</template>

<style scoped>
.b4-page{display:grid;gap:22px}.b4-hero{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:34px;border-radius:24px;color:#fff;background:linear-gradient(135deg,#596bff,#7c5cfc);box-shadow:0 16px 48px rgb(89 107 255 / 18%)}.b4-hero h1{max-width:720px;margin:10px 0 12px;font-size:clamp(30px,5vw,48px);line-height:1.12;letter-spacing:-.04em}.b4-hero p:not(.eyebrow){max-width:720px;margin:0;color:rgb(255 255 255 / 84%);line-height:1.7}.b4-hero .eyebrow{color:rgb(255 255 255 / 76%)}.b4-hero__orb{display:grid;width:132px;height:132px;flex:0 0 auto;place-items:center;border:1px solid rgb(255 255 255 / 45%);border-radius:50%;font-size:52px;background:rgb(255 255 255 / 12%);animation:b4-orbit 6s linear infinite}.b4-hero__orb--static{animation:none}.b4-status{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 18px;border:1px solid var(--yx-color-border);border-radius:16px;background:var(--yx-color-surface-card)}.b4-status--offline,.b4-status--error{border-color:#f2c7ce;background:#fff8f9}.b4-status>div:first-child{display:grid;gap:4px}.b4-status strong{font-size:14px}.b4-status span{color:var(--yx-color-text-secondary);font-size:13px;line-height:1.5}.b4-status__actions{display:flex;align-items:center;justify-content:flex-end;gap:8px;flex-wrap:wrap}.b4-queue{color:#9b5b00!important;font-weight:750}.quality-select{display:flex;align-items:center;gap:6px;color:var(--yx-color-text-secondary);font-size:13px}.quality-select select,.b4-field select{min-height:38px;padding:0 10px;border:1px solid #d9dce7;border-radius:10px;color:#202332;background:var(--yx-color-surface-card)}.b4-tabs{display:flex;gap:8px;overflow:auto;padding-bottom:2px}.b4-tabs button{min-height:40px;padding:0 14px;border:1px solid var(--yx-color-border);border-radius:12px;color:var(--yx-color-text-secondary);background:var(--yx-color-surface-card);white-space:nowrap}.b4-tabs button:hover,.b4-tabs__item--active{border-color:#596bff!important;color:#596bff!important;background:#eef0ff!important}.b4-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.b4-metric{display:grid;gap:6px;padding:20px;border:1px solid #e6e8f0;border-radius:16px;background:var(--yx-color-surface-card)}.b4-metric span,.b4-card h2,.card-kicker{margin:0}.b4-metric span{color:#596bff;font-size:12px;font-weight:800;letter-spacing:.12em}.b4-metric strong{font-size:30px}.b4-metric small{color:var(--yx-color-text-secondary)}.b4-grid{display:grid;gap:18px}.b4-grid--world{grid-template-columns:minmax(0,1.3fr) minmax(280px,.7fr)}.b4-grid--social{grid-template-columns:minmax(0,1.4fr) minmax(280px,.6fr)}.b4-grid--avatar{grid-template-columns:minmax(260px,.8fr) minmax(0,1.2fr)}.b4-card{display:grid;gap:16px;padding:24px;border:1px solid #e6e8f0;border-radius:18px;background:var(--yx-color-surface-card);box-shadow:0 8px 24px rgb(31 35 48 / 5%)}.b4-card--wide{min-width:0}.b4-card__heading{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.b4-card h2{font-size:22px}.b4-card__heading>span,.b4-fact-tag,.b4-session-state{color:var(--yx-color-text-secondary);font-size:13px}.b4-muted{margin:0;color:var(--yx-color-text-secondary);font-size:13px;line-height:1.7}.b4-inline-empty{margin:0;padding:20px;border:1px dashed #dfe3ee;border-radius:12px;color:var(--yx-color-text-secondary);line-height:1.6}.b4-map{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;padding:18px;border-radius:16px;background:radial-gradient(circle at 20% 0,#eef0ff,#f9faff 55%,#fff)}.b4-map--static{background:var(--yx-color-surface-page)}.b4-map__node{display:grid;gap:8px;min-height:142px;padding:14px;border:1px solid #dfe3f7;border-radius:14px;background:rgb(255 255 255 / 72%)}.b4-map__dot{width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#596bff,#7c5cfc);box-shadow:0 0 0 6px #eef0ff}.b4-map__node strong{font-size:15px}.b4-map__node small,.b4-map__node em{color:var(--yx-color-text-secondary);font-size:12px;line-height:1.45;font-style:normal}.b4-map__node em{color:#9b5b00}.b4-season{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:12px 14px;border-radius:12px;background:var(--yx-color-surface-page)}.b4-season strong{color:#596bff}.b4-season small{color:var(--yx-color-text-secondary)}.b4-streak-mark{display:grid;width:38px;height:38px;place-items:center;border-radius:12px;color:#fff;background:#f2a83b}.b4-streak-mark--ACTIVE{background:linear-gradient(135deg,#596bff,#7c5cfc)}.b4-streak-mark--BROKEN,.b4-streak-mark--FROZEN{color:var(--yx-color-text-secondary);background:#edf0f4}.b4-streak-number{display:flex;align-items:baseline;gap:10px}.b4-streak-number strong{font-size:52px;line-height:1;color:#596bff}.b4-streak-number span{color:var(--yx-color-text-secondary)}.b4-toggle{display:flex;align-items:center;gap:8px;color:#202332;font-size:14px}.b4-field{display:grid;gap:6px;color:var(--yx-color-text-secondary);font-size:13px}.b4-field input,.b4-field select{width:100%;min-height:40px;padding:0 10px;border:1px solid #d9dce7;border-radius:10px;color:#202332;background:var(--yx-color-surface-card)}.b4-button-row{display:flex;gap:8px;flex-wrap:wrap}.button--danger{color:#b52d43!important;background:#fff0f3!important}.b4-quest-list{display:grid;gap:10px}.b4-quest{display:grid;grid-template-columns:minmax(180px,1fr) minmax(180px,1fr) auto;align-items:center;gap:14px;padding:14px;border:1px solid #eef0f5;border-radius:12px}.b4-quest>div:first-child{display:grid;gap:4px}.b4-quest small,.b4-quest__progress span{color:var(--yx-color-text-secondary);font-size:12px}.b4-quest__progress{display:grid;gap:6px}.b4-quest progress{width:100%;height:7px;accent-color:#596bff}.b4-quest__state{color:#596bff;font-size:12px;white-space:nowrap}.b4-game-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.b4-game{display:grid;gap:9px;padding:16px;border:1px solid #e6e8f0;border-radius:14px}.b4-game__icon{display:grid;width:36px;height:36px;place-items:center;border-radius:12px;color:#596bff;background:#eef0ff}.b4-game small,.b4-game>span:not(.b4-game__icon){color:var(--yx-color-text-secondary);font-size:12px}.b4-game .button{margin-top:4px}.b4-session-meta{display:flex;gap:12px;flex-wrap:wrap;color:var(--yx-color-text-secondary);font-size:12px}.b4-warning{margin:0;padding:12px;border-radius:12px;color:#8b5a10;background:#fff8e7;line-height:1.6}.b4-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.b4-result{display:flex;align-items:center;gap:16px;flex-wrap:wrap;color:#26745f;background:#edf9f4}.b4-result span,.b4-result small{color:#46786b}.b4-room-list,.b4-notification-list,.b4-loadout-list,.b4-package-list,.b4-queue-list{display:grid;gap:10px}.b4-room,.b4-notification,.b4-loadout,.b4-package{display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:center;gap:12px;padding:14px;border:1px solid #eef0f5;border-radius:12px}.b4-room>div:first-child,.b4-notification>div,.b4-loadout>div:first-child,.b4-package>div:first-child{display:grid;gap:4px}.b4-room small,.b4-notification small,.b4-loadout small,.b4-package small,.b4-package>span{color:var(--yx-color-text-secondary);font-size:12px}.b4-room__actions{grid-column:1/-1;display:flex!important;align-items:center;gap:8px!important;flex-wrap:wrap;border-top:1px solid #eef0f5;padding-top:12px}.b4-room__actions select{min-height:40px;padding:0 10px;border:1px solid #d9dce7;border-radius:10px;color:#202332;background:var(--yx-color-surface-card)}.b4-timer{display:block;font-variant-numeric:tabular-nums;font-size:56px;color:#596bff}.b4-notification--unread{border-color:#cfd4ff;background:#fafaff}.b4-notification p{margin:0;color:var(--yx-color-text-secondary);font-size:13px;line-height:1.5}.b4-session-state,.b4-equipped{padding:5px 8px;border-radius:8px;color:#26745f!important;background:#edf9f4}.b4-avatar-preview{display:grid;min-height:180px;place-items:center;border-radius:18px;color:#fff;background:radial-gradient(circle at 35% 25%,#7c5cfc,#202c70 70%);font-size:68px}.b4-avatar-preview small{color:rgb(255 255 255 / 75%);font-size:12px}.b4-avatar-preview--static{color:#596bff;background:#eef0ff}.b4-avatar-preview--static small{color:var(--yx-color-text-secondary)}.b4-loadout button{grid-column:3}.b4-item-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.b4-item{display:grid;gap:6px;padding:14px;border-radius:12px;background:var(--yx-color-surface-page)}.b4-item span{color:#596bff;font-size:12px;font-weight:800}.b4-item small{color:var(--yx-color-text-secondary);font-size:12px}.b4-package__state{color:#596bff!important;font-weight:800}.b4-queue-list article{display:grid;grid-template-columns:1fr auto;gap:5px;padding:12px;border-radius:10px;background:var(--yx-color-surface-page)}.b4-queue-list small{grid-column:1/-1;color:var(--yx-color-text-secondary)}.b4-queue-list span{color:#9b5b00;font-size:12px}@keyframes b4-orbit{to{transform:rotate(360deg)}}
@media(max-width:900px){.b4-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.b4-grid--world,.b4-grid--social,.b4-grid--avatar{grid-template-columns:1fr}.b4-map{grid-template-columns:repeat(2,minmax(0,1fr))}.b4-game-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:640px){.b4-hero{padding:24px}.b4-hero__orb{width:76px;height:76px;font-size:30px}.b4-status{display:grid}.b4-status__actions{justify-content:flex-start}.b4-metrics{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.b4-metric{padding:14px}.b4-metric strong{font-size:24px}.b4-card{padding:18px}.b4-map,.b4-game-grid,.b4-item-grid,.b4-form-grid{grid-template-columns:1fr}.b4-quest,.b4-room,.b4-notification,.b4-package{grid-template-columns:1fr}.b4-room__actions{grid-column:auto}.b4-loadout button{grid-column:auto}.b4-timer{font-size:46px}}
@media(prefers-reduced-motion:reduce){.b4-hero__orb{animation:none}}
.b4-game--disabled{background:var(--yx-color-surface-page)}.b4-game--disabled .b4-game__icon{color:#8a91a3;background:#eceef4}.b4-game .button:disabled{cursor:not-allowed;opacity:.55}
</style>
