<script setup lang="ts">
import AvatarArtwork from '../components/AvatarArtwork.vue'
import StudyArtwork from '../components/StudyArtwork.vue'
import ExperienceHeader from '../components/ExperienceHeader.vue'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { B4_PERFORMANCE_LEVELS, formatSeconds, gameLabel, interactionLabel, type B4InteractionCode } from '../domain/b4'
import B12RewardsCard from '../components/b12/B12RewardsCard.vue'
import B12SocialExtensions from '../components/b12/B12SocialExtensions.vue'
import { useB4Store } from '../stores/b4'
import { useExperienceText } from '../platform/experience-ui'

type B4Panel = 'world' | 'games' | 'social' | 'avatar' | 'offline'

const b4 = useB4Store()
const t = useExperienceText()
function stateLabel(value?: string) { return t(({ ACTIVE: 'stateActive', AVAILABLE: 'stateAvailable', UNLOCKED: 'stateAvailable', COMPLETED: 'stateCompleted', LOCKED: 'stateLocked', AT_RISK: 'stateAtRisk', BROKEN: 'stateBroken', FROZEN: 'stateFrozen', IN_PROGRESS: 'stateActive' } as Record<string, string>)[value ?? ''] ?? 'stateUnknown') }
function avatarSlotLabel(slot: string): string { return ({ HEAD: '头部装扮', FACE: '面部装扮', BODY: '服装', AURA: '光效装扮' } as Record<string, string>)[slot] ?? '装扮素材' }
function avatarQualityLabel(quality: string): string { return ({ COMMON: '普通款', RARE: '稀有款', EPIC: '珍藏款', LEGENDARY: '典藏款' } as Record<string, string>)[quality] ?? '素材' }
function questPeriod(value: string): string { return ({ DAILY: '每日', WEEKLY: '每周', SEASON: '赛季' } as Record<string, string>)[value] ?? '成长' }
const activePanel = ref<B4Panel>('world')
const focusMinutes = ref<25 | 45>(25)
const interactionCode = ref<B4InteractionCode>('CHEER_UP')
const weekendProtection = ref(false)
const timeZone = ref('Asia/Shanghai')
const now = ref(Date.now())
let timer: number | undefined

const mapNodes = [
  { code: 'ORIGIN', title: '起源星门', description: '从第一步开始，认识自己的世界' },
  { code: 'VOCAB_ORBIT', title: '词汇轨道', description: '一点点积累自己的词汇' },
  { code: 'GRAMMAR_NEBULA', title: '语法星云', description: '在阅读里看懂句子' },
  { code: 'LISTENING_MOON', title: '听力卫星', description: '慢慢听清每一句话' },
  { code: 'SPEAKING_STAR', title: '表达恒星', description: '把想法自然地说出来' },
  { code: 'GALAXY_GATE', title: '星系之门', description: '让坚持留下看得见的足迹' },
]
const galaxyNodes = computed(() => mapNodes.map((node) => {
  const serverNode = b4.galaxy?.nodes.find((item) => item.nodeCode === node.code)
  return {
    ...node,
    hasData: !!serverNode,
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
function gameStatusLabel(value: string): string { return ({ READY: '准备中', IN_PROGRESS: '进行中', PAUSED: '已暂停', FINISHED: '已结束', COMPLETED: '已完成', EXPIRED: '已过期' } as Record<string, string>)[value] ?? '状态待确认' }
function packageStatus(value?: string | null): string { return ({ PUBLISHED: '可获取', AUTHORIZED: '已授权', DOWNLOADING: '下载中', PAUSED: '已暂停', ACTIVE_LOCAL: '可离线使用', CLEANED: '已清理', DELETED: '已下线' } as Record<string, string>)[value ?? ''] ?? '状态待确认' }
function queueStatus(value: string): string { return ({ PENDING: '待同步', SYNCING: '同步中', FAILED: '同步失败' } as Record<string, string>)[value] ?? '待确认' }
function fileSize(bytes: number): string { return bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB` }
function notificationCategory(value: string | null): string { return ({ SYSTEM: '系统', ROOM_INTERACTION: '自习室', FOCUS_REMINDER: '专注提醒', LEARNING: '学习提醒' } as Record<string, string>)[value ?? ''] ?? '通知' }
function notificationTime(value: string | null): string { const timestamp = value ? Date.parse(value) : NaN; return Number.isFinite(timestamp) ? new Intl.DateTimeFormat(undefined, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(timestamp) : '' }
function joinOrLeave(roomId: string, joined: boolean): void { void (joined ? b4.leaveRoom(roomId) : b4.joinRoom(roomId)) }
function sendInteraction(roomId: string): void { void b4.sendInteraction(roomId, interactionCode.value) }
function authorizePackage(packageId: string): void { void b4.authorizeOfflinePackage(packageId) }
function updateOfflineDownload(downloadId: string, action: 'PAUSE' | 'RESUME'): void { void b4.updateOfflineDownload(downloadId, action) }
function cleanupOfflineDownload(downloadId: string): void { void b4.cleanupOfflineDownload(downloadId) }
</script>

<template>
  <section class="b4-page v2-page v2-page--b4world" :data-performance="b4.performanceLevel" :data-avatar-render="b4.effectiveAvatarRenderMode" aria-labelledby="b4-title">
    <ExperienceHeader page="World" icon="globe" title-id="b4-title" hero><StudyArtwork compact /></ExperienceHeader>

    <section class="b4-status" :class="`b4-status--${b4.status}`" role="status" aria-live="polite">
      <div>
        <strong>{{ b4.status === 'loading' ? '正在加载你的学习世界' : b4.online ? '网络可用' : '网络不可用' }}</strong>
        <span>{{ b4.lastError ?? (b4.queueCount ? `本机有 ${b4.queueCount} 条待同步记录。` : '每一次学习，都会留下自己的成长足迹。') }}</span>
      </div>
      <div class="b4-status__actions">
        <span v-if="b4.queueCount" class="b4-queue">待同步 {{ b4.queueCount }}</span>
        <button v-if="b4.status === 'offline' || b4.status === 'error'" class="button button--secondary" type="button" @click="retry">重试读取</button>
        <button v-if="b4.queueCount" class="button button--secondary" type="button" @click="b4.syncOffline">同步队列</button>
        <label class="quality-select">性能
          <select :value="b4.performanceLevel" aria-label="世界画质" @change="choosePerformance(($event.target as HTMLSelectElement).value)">
            <option v-for="level in B4_PERFORMANCE_LEVELS" :key="level" :value="level">{{ ({ Ultra: "超高", High: "高", Medium: "均衡", Performance: "流畅" } as Record<string, string>)[level] ?? level }}</option>
          </select>
        </label>
      </div>
    </section>

    <nav class="b4-tabs" aria-label="学习世界导航">
      <button v-for="tab in ([['world', '成长世界'], ['games', '游戏大厅'], ['social', '自习室'], ['avatar', '我的角色'], ['offline', '离线包']] as const)" :key="tab[0]" type="button" :class="{ 'b4-tabs__item--active': activePanel === tab[0] }" :aria-pressed="activePanel === tab[0]" @click="activePanel = tab[0]">{{ tab[1] }}</button>
    </nav>

    <template v-if="activePanel === 'world'">
      <section class="b4-metrics" aria-label="成长摘要">
        <article class="b4-metric"><span>XP</span><strong v-if="b4.profile">{{ b4.profile.xp }}</strong><strong v-else>—</strong><small>{{ b4.profile ? `Lv.${b4.profile.level} · ${b4.profile.rank}` : '成长记录暂未加载' }}</small></article>
        <article class="b4-metric"><span>星币<span class="v2-sr-only">星币</span></span><strong v-if="b4.profile">{{ b4.profile.coins }}</strong><strong v-else>—</strong><small>学习积累的星币</small></article>
        <article class="b4-metric"><span>连续天数<span class="v2-sr-only">连续学习</span></span><strong v-if="b4.streak">{{ b4.streak.currentStreak }} 天</strong><strong v-else>—</strong><small>{{ stateLabel(b4.streak?.status) }}</small></article>
        <article class="b4-metric"><span>通知</span><strong>{{ unreadCount }}</strong><small>{{ b4.notifications.length ? '未读通知' : '暂时没有新通知' }}</small></article>
      </section>

      <section class="b4-grid b4-grid--world v2-b4world-main">
        <article class="b4-card b4-card--wide">
          <div class="b4-card__heading"><div><p class="card-kicker">成长地图<span class="v2-sr-only">星系地图</span></p><h2>成长世界</h2></div><span class="b4-fact-tag">我的学习足迹</span></div>
          <p class="b4-muted">每次练习，都在为你的学习世界添一点光。看看已经走过的路，再选一个方向继续。</p>
          <div class="b4-map" :class="{ 'b4-map--static': b4.performanceLevel === 'Performance' }">
            <article v-for="node in galaxyNodes" :key="node.code" class="b4-map__node"><span class="b4-map__dot" aria-hidden="true"></span><strong>{{ node.title }}</strong><small>{{ node.description }}</small><em v-if="node.hasData">{{ stateLabel(node.status) }} · {{ node.progress }} / {{ node.requiredProgress }}（{{ node.progressPercent }}%）</em><em v-else>{{ t('stateUnknown') }}</em></article>
          </div>
          <small v-if="b4.galaxy" class="b4-muted">总成长 XP：{{ b4.galaxy.totalXp }}</small>
          <div class="b4-season" v-if="b4.season"><span>{{ b4.season.title }}</span><strong>{{ b4.season.points }} 赛季点</strong><small>{{ stateLabel(b4.season.status) }}</small></div>
          <div v-else class="b4-inline-empty">新的成长活动正在准备中。</div>
        </article>

        <article class="b4-card">
          <div class="b4-card__heading"><div><p class="card-kicker">连续学习<span class="v2-sr-only">连续学习日历</span></p><h2>连续学习</h2></div><span class="b4-streak-mark" :class="`b4-streak-mark--${b4.streak?.status ?? 'UNKNOWN'}`">♨</span></div>
          <template v-if="b4.streak">
            <div class="b4-streak-number"><strong>{{ b4.streak.currentStreak }}</strong><span>天连续学习</span></div>
            <p class="b4-muted">上次有效日：{{ b4.streak.lastValidDate ?? '暂无记录' }}<br>时区：{{ b4.streak.timeZone }} · 状态：{{ stateLabel(b4.streak.status) }}</p>
            <label class="b4-toggle"><input v-model="weekendProtection" type="checkbox"><span>开启周末保护</span></label>
            <label class="b4-field">所在时区<input v-model="timeZone" type="text" autocomplete="off"></label>
            <button class="button button--secondary" type="button" @click="saveStreakSettings">保存连续学习偏好</button>
            <button v-if="['AT_RISK', 'BROKEN', 'FROZEN'].includes(b4.streak.status)" class="button button--ghost" type="button" @click="b4.rescueStreak('CHALLENGE')">请求破冰挑战</button>
          </template>
          <p v-else class="b4-inline-empty">连续学习记录暂时未能加载。</p>
        </article>
      </section>

      <section class="b4-card">
        <div class="b4-card__heading"><div><p class="card-kicker">成长任务<span class="v2-sr-only">成长任务</span></p><h2>今日成长任务</h2></div><span>{{ b4.quests.length ? `${b4.quests.length} 个成长任务` : '未返回任务' }}</span></div>
        <div v-if="b4.quests.length" class="b4-quest-list"><article v-for="quest in b4.quests" :key="quest.questId" class="b4-quest"><div><strong>{{ quest.title }}</strong><small>{{ questPeriod(quest.period) }}</small></div><div class="b4-quest__progress"><span>{{ quest.progress }} / {{ quest.target }}</span><progress :value="quest.progress" :max="Math.max(quest.target, 1)"></progress></div><span class="b4-quest__state">{{ quest.claimed ? '已领取' : quest.completed ? '待领取' : '进行中' }}</span></article></div>
        <p v-else class="b4-inline-empty">今天还没有新的成长任务。</p>
      </section>
      <B12RewardsCard />
    </template>

    <template v-else-if="activePanel === 'games'">
      <section class="b4-card">
        <div class="b4-card__heading"><div><p class="card-kicker">学习游戏</p><h2>小游戏</h2></div><span>玩法准备中</span></div>
        <div v-if="b4.games.length" class="b4-game-grid"><article v-for="game in b4.games" :key="game.gameCode" class="b4-game b4-game--disabled"><span class="b4-game__icon" aria-hidden="true">✦</span><strong>{{ gameLabel(game.gameCode) }}</strong><span>{{ game.enabled ? '玩法准备中' : '暂未开放' }}</span><span v-if="game.maxMinutes">每次最多 {{ game.maxMinutes }} 分钟</span><button class="button button--primary" type="button" disabled>暂未开放</button></article></div>
        <p v-else class="b4-inline-empty">暂无可用游戏。</p>
      </section>
      <section v-if="b4.activeGame" class="b4-card b4-game-session">
        <div class="b4-card__heading"><div><p class="card-kicker">游戏进度</p><h2>{{ gameLabel(b4.activeGame.gameCode) }}</h2></div><span class="b4-session-state">{{ gameStatusLabel(b4.activeGame.status) }}</span></div>
        <div class="b4-session-meta"><span>已进行 {{ b4.activeGame.attemptCount }} 回合</span></div>
        <p class="b4-warning">当前还没有可操作的题目。</p>
        <div class="b4-button-row"><button v-if="b4.activeGame.status === 'IN_PROGRESS' || b4.activeGame.status === 'READY'" class="button button--ghost" type="button" @click="b4.pauseGame">暂停</button><button v-if="b4.activeGame.status === 'PAUSED'" class="button button--ghost" type="button" @click="b4.resumeGame">恢复</button><button class="button button--ghost" type="button" @click="b4.refreshGame">刷新</button><button class="button button--danger" type="button" @click="b4.finishGame">结束</button></div>
      </section>
      <section v-if="b4.lastGameResult" class="b4-card b4-result"><strong>{{ b4.lastGameResult.passed ? '挑战通过' : '再练习一次' }}</strong><span>正确率 {{ b4.lastGameResult.accuracyPercent }}% · 完成度 {{ b4.lastGameResult.completionPercent }}% · 得分 {{ b4.lastGameResult.serverScore }}</span><small>{{ b4.lastGameResult.rewardEligible ? '符合奖励条件' : '暂不符合奖励条件' }}</small></section>
    </template>

    <template v-else-if="activePanel === 'social'">
      <section class="b4-grid b4-grid--social">
        <article class="b4-card b4-card--wide"><div class="b4-card__heading"><div><p class="card-kicker">学习小组<span class="v2-sr-only">自习室</span></p><h2>虚拟自习室</h2></div><span>仅预设互动</span></div><div v-if="b4.rooms.length" class="b4-room-list"><article v-for="room in b4.rooms" :key="room.roomId" class="b4-room"><div><strong>{{ room.name }}</strong><small>安静自习 · 互相鼓励</small></div><span>{{ room.memberCount }} / {{ room.capacity }} 人</span><button class="button button--secondary" type="button" @click="joinOrLeave(room.roomId, room.joined)">{{ room.joined ? '离开' : '加入' }}</button><div v-if="room.joined" class="b4-room__actions"><button class="button button--primary" type="button" @click="b4.startFocus(room.roomId, focusMinutes)">开始 {{ focusMinutes }} 分钟专注</button><select v-model="interactionCode" aria-label="预设互动"><option v-for="code in (['CHEER_UP', 'STUDY_TOGETHER', 'CONGRATS', 'TRY_AGAIN', 'TONIGHT_20_MIN'] as B4InteractionCode[])" :key="code" :value="code">{{ interactionLabel(code) }}</option></select><button class="button button--ghost" type="button" @click="sendInteraction(room.roomId)">发送预设鼓励</button></div></article></div><p v-else class="b4-inline-empty">自习室暂时未能加载，请稍后再试。</p></article>
        <article class="b4-card"><div class="b4-card__heading"><div><p class="card-kicker">番茄专注<span class="v2-sr-only">番茄专注</span></p><h2>番茄专注</h2></div><span v-if="b4.activeFocus">{{ b4.activeFocus.status }}</span></div><template v-if="b4.activeFocus"><strong class="b4-timer">{{ formatSeconds(activeFocusSeconds) }}</strong><p class="b4-muted">暂停时休息一下，准备好后再继续。</p><div class="b4-button-row"><button v-if="b4.activeFocus.status === 'RUNNING'" class="button button--secondary" type="button" @click="b4.updateFocus('PAUSE')">暂停</button><button v-if="b4.activeFocus.status === 'PAUSED'" class="button button--secondary" type="button" @click="b4.updateFocus('RESUME')">恢复</button><button v-if="['RUNNING', 'PAUSED'].includes(b4.activeFocus.status)" class="button button--danger" type="button" @click="b4.updateFocus('COMPLETE')">完成专注</button></div></template><template v-else><p class="b4-muted">找一个喜欢的房间，安静地学一会儿。</p><label class="b4-field">计划专注时长<select v-model="focusMinutes"><option :value="25">25 分钟</option><option :value="45">45 分钟</option></select></label><small class="b4-muted">完成一次专注后，可以回到这里查看记录。</small></template></article>
      </section>
      <section class="b4-card"><div class="b4-card__heading"><div><p class="card-kicker">消息</p><h2>通知</h2></div><button v-if="b4.notifications.length" class="button button--ghost" type="button" @click="b4.readAllNotifications">全部标记已读</button></div><div v-if="b4.notifications.length" class="b4-notification-list"><article v-for="item in b4.notifications" :key="item.messageId" class="b4-notification" :class="{ 'b4-notification--unread': !item.read }"><div><strong>{{ item.title }}</strong><p v-if="item.body">{{ item.body }}</p><small>{{ notificationCategory(item.category) }}<template v-if="notificationTime(item.createdAt)"> · {{ notificationTime(item.createdAt) }}</template></small></div><button v-if="!item.read" class="button button--secondary" type="button" @click="b4.readNotification(item.messageId)">标记已读</button></article></div><p v-else class="b4-inline-empty">暂无新通知。</p></section>
      <B12SocialExtensions />
    </template>

    <template v-else-if="activePanel === 'avatar'">
      <section class="b4-grid b4-grid--avatar">
        <article class="b4-card b4-avatar-card">
          <div class="b4-card__heading"><div><p class="card-kicker">形象</p><h2>展示预览</h2></div><span>本机画质</span></div>
          <div class="b4-avatar-preview" :class="{ 'b4-avatar-preview--static': b4.effectiveAvatarRenderMode === '2D_FALLBACK' }" aria-label="角色形象示意"><AvatarArtwork /><small>形象示意</small></div>
          <p class="b4-muted">画质只影响本机显示；角色素材尚未就绪。</p>
        </article>
        <article class="b4-card">
          <div class="b4-card__heading"><div><p class="card-kicker">衣柜</p><h2>套装素材</h2></div><span>{{ b4.loadouts.length }} 套</span></div>
          <div v-if="b4.loadouts.length" class="b4-loadout-list"><article v-for="loadout in b4.loadouts" :key="loadout.loadoutId" class="b4-loadout"><div><strong>{{ loadout.name }}</strong><small>{{ loadout.items.length }} 件素材</small></div><span>预览</span></article></div>
          <p v-else class="b4-inline-empty">暂无可展示的套装素材。</p>
        </article>
      </section>
      <section class="b4-card">
        <div class="b4-card__heading"><div><p class="card-kicker">装扮</p><h2>外观素材</h2></div><span>{{ b4.avatarItems.length }} 款</span></div>
        <div v-if="b4.avatarItems.length" class="b4-item-grid"><article v-for="item in b4.avatarItems" :key="item.itemCode" class="b4-item"><span>{{ avatarQualityLabel(item.quality) }}</span><strong>{{ avatarSlotLabel(item.slot) }}</strong></article></div>
        <p v-else class="b4-inline-empty">暂无可展示的装扮素材。</p>
        <p class="b4-muted">素材预览不代表已获得奖励。</p>
      </section>
    </template>

    <template v-else>
      <section class="b4-card"><div class="b4-card__heading"><div><p class="card-kicker">离线学习</p><h2>内容包</h2></div><span>{{ b4.online ? '在线' : '离线' }}</span></div><div v-if="b4.offlinePackages.length" class="b4-package-list"><article v-for="item in b4.offlinePackages" :key="item.packageId" class="b4-package"><div><strong>{{ item.packageCode }}</strong><small>{{ fileSize(item.sizeBytes) }} · {{ item.completedPartCount }}/{{ item.partCount }} 部分</small></div><span class="b4-package__state">{{ packageStatus(item.downloadState ?? item.state) }}</span><button v-if="item.state === 'PUBLISHED' && !item.downloadId" class="button button--secondary" type="button" @click="authorizePackage(item.packageId)">请求授权</button><button v-if="item.downloadId && ['AUTHORIZED', 'DOWNLOADING'].includes(item.downloadState ?? '')" class="button button--secondary" type="button" @click="updateOfflineDownload(item.downloadId, 'PAUSE')">暂停</button><button v-if="item.downloadId && item.downloadState === 'PAUSED'" class="button button--secondary" type="button" @click="updateOfflineDownload(item.downloadId, 'RESUME')">继续</button><button v-if="item.downloadId && item.downloadState !== 'ACTIVE_LOCAL'" class="button button--ghost" type="button" @click="cleanupOfflineDownload(item.downloadId)">清理</button></article></div><p v-else class="b4-inline-empty">暂无可下载的内容包。</p></section>
      <section class="b4-card"><div class="b4-card__heading"><div><p class="card-kicker">离线操作</p><h2>待同步</h2></div><span>{{ b4.queueCount }} 条</span></div><div v-if="b4.offlineRecords.length" class="b4-queue-list"><article v-for="item in b4.offlineRecords" :key="item.id"><strong>自习室互动</strong><span>{{ queueStatus(item.status) }}</span><small v-if="item.lastError">{{ item.lastError }}</small></article></div><p v-else class="b4-inline-empty">没有待同步操作。</p><button v-if="b4.queueCount" class="button button--primary" type="button" @click="b4.syncOffline">立即同步</button></section>
    </template>
    <aside class="v2-b4world-rail" aria-label="练习提示"><h2>语言世界</h2><ol><li>选择一个场景开始练习。</li><li>完成后可回到列表继续。</li></ol></aside>
  </section>
</template>

<style scoped>
.b4-page{display:grid;gap:22px}.b4-hero{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:34px;border-radius:24px;color:var(--yx-color-on-brand);background:linear-gradient(135deg,var(--yx-color-brand-primary),var(--yx-color-brand-primary));box-shadow:0 16px 48px color-mix(in srgb,var(--yx-color-brand-primary) 18%, transparent)}.b4-hero h1{max-width:720px;margin:10px 0 12px;font-size:clamp(30px,5vw,48px);line-height:1.12;letter-spacing:-.04em}.b4-hero p:not(.eyebrow){max-width:720px;margin:0;color:color-mix(in srgb,var(--yx-color-on-brand) 84%, transparent);line-height:1.7}.b4-hero .eyebrow{color:color-mix(in srgb,var(--yx-color-on-brand) 76%, transparent)}.b4-hero__orb{display:grid;width:132px;height:132px;flex:0 0 auto;place-items:center;border:1px solid color-mix(in srgb,var(--yx-color-surface-card) 45%, transparent);border-radius:50%;font-size:52px;background:color-mix(in srgb,var(--yx-color-surface-card) 12%, transparent);animation:b4-orbit 6s linear infinite}.b4-hero__orb--static{animation:none}.b4-status{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 18px;border:1px solid var(--yx-color-border);border-radius:16px;background:var(--yx-color-surface-card)}.b4-status--offline,.b4-status--error{border-color:var(--yx-color-danger-soft);background:var(--yx-color-danger-soft)}.b4-status>div:first-child{display:grid;gap:4px}.b4-status strong{font-size:14px}.b4-status span{color:var(--yx-color-text-secondary);font-size:13px;line-height:1.5}.b4-status__actions{display:flex;align-items:center;justify-content:flex-end;gap:8px;flex-wrap:wrap}.b4-queue{color:var(--yx-color-warning)!important;font-weight:750}.quality-select{display:flex;align-items:center;gap:6px;color:var(--yx-color-text-secondary);font-size:13px}.quality-select select,.b4-field select{min-height:38px;padding:0 10px;border:1px solid var(--yx-color-border);border-radius:10px;color:var(--yx-color-text-primary);background:var(--yx-color-surface-card)}.b4-tabs{display:flex;gap:8px;overflow:auto;padding-bottom:2px}.b4-tabs button{min-height:40px;padding:0 14px;border:1px solid var(--yx-color-border);border-radius:12px;color:var(--yx-color-text-secondary);background:var(--yx-color-surface-card);white-space:nowrap}.b4-tabs button:hover,.b4-tabs__item--active{border-color:var(--yx-color-brand-primary)!important;color:var(--yx-color-brand-primary)!important;background:var(--yx-color-brand-primary-soft)!important}.b4-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.b4-metric{display:grid;gap:6px;padding:20px;border:1px solid var(--yx-color-border);border-radius:16px;background:var(--yx-color-surface-card)}.b4-metric span,.b4-card h2,.card-kicker{margin:0}.b4-metric span{color:var(--yx-color-brand-primary);font-size:12px;font-weight:800;letter-spacing:.12em}.b4-metric strong{font-size:30px}.b4-metric small{color:var(--yx-color-text-secondary)}.b4-grid{display:grid;gap:18px}.b4-grid--world{grid-template-columns:minmax(0,1.3fr) minmax(280px,.7fr)}.b4-grid--social{grid-template-columns:minmax(0,1.4fr) minmax(280px,.6fr)}.b4-grid--avatar{grid-template-columns:minmax(260px,.8fr) minmax(0,1.2fr)}.b4-card{display:grid;gap:16px;padding:24px;border:1px solid var(--yx-color-border);border-radius:18px;background:var(--yx-color-surface-card);box-shadow:0 8px 24px color-mix(in srgb,var(--yx-color-brand-primary) 5%, transparent)}.b4-card--wide{min-width:0}.b4-card__heading{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.b4-card h2{font-size:22px}.b4-card__heading>span,.b4-fact-tag,.b4-session-state{color:var(--yx-color-text-secondary);font-size:13px}.b4-muted{margin:0;color:var(--yx-color-text-secondary);font-size:13px;line-height:1.7}.b4-inline-empty{margin:0;padding:20px;border:1px dashed var(--yx-color-border);border-radius:12px;color:var(--yx-color-text-secondary);line-height:1.6}.b4-map{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;padding:18px;border-radius:16px;background:radial-gradient(circle at 20% 0,var(--yx-color-brand-primary-soft),var(--yx-color-surface-page) 55%,var(--yx-color-surface-card))}.b4-map--static{background:var(--yx-color-surface-page)}.b4-map__node{display:grid;gap:8px;min-height:142px;padding:14px;border:1px solid var(--yx-color-border);border-radius:14px;background:color-mix(in srgb,var(--yx-color-surface-card) 72%, transparent)}.b4-map__dot{width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,var(--yx-color-brand-primary),var(--yx-color-brand-primary));box-shadow:0 0 0 6px var(--yx-color-brand-primary-soft)}.b4-map__node strong{font-size:15px}.b4-map__node small,.b4-map__node em{color:var(--yx-color-text-secondary);font-size:12px;line-height:1.45;font-style:normal}.b4-map__node em{color:var(--yx-color-warning)}.b4-season{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:12px 14px;border-radius:12px;background:var(--yx-color-surface-page)}.b4-season strong{color:var(--yx-color-brand-primary)}.b4-season small{color:var(--yx-color-text-secondary)}.b4-streak-mark{display:grid;width:38px;height:38px;place-items:center;border-radius:12px;color:var(--yx-color-on-brand);background:var(--yx-color-warning)}.b4-streak-mark--ACTIVE{background:linear-gradient(135deg,var(--yx-color-brand-primary),var(--yx-color-brand-primary))}.b4-streak-mark--BROKEN,.b4-streak-mark--FROZEN{color:var(--yx-color-text-secondary);background:var(--yx-color-surface-muted)}.b4-streak-number{display:flex;align-items:baseline;gap:10px}.b4-streak-number strong{font-size:52px;line-height:1;color:var(--yx-color-brand-primary)}.b4-streak-number span{color:var(--yx-color-text-secondary)}.b4-toggle{display:flex;align-items:center;gap:8px;color:var(--yx-color-text-primary);font-size:14px}.b4-field{display:grid;gap:6px;color:var(--yx-color-text-secondary);font-size:13px}.b4-field input,.b4-field select{width:100%;min-height:40px;padding:0 10px;border:1px solid var(--yx-color-border);border-radius:10px;color:var(--yx-color-text-primary);background:var(--yx-color-surface-card)}.b4-button-row{display:flex;gap:8px;flex-wrap:wrap}.button--danger{color:var(--yx-color-danger)!important;background:var(--yx-color-danger-soft)!important}.b4-quest-list{display:grid;gap:10px}.b4-quest{display:grid;grid-template-columns:minmax(180px,1fr) minmax(180px,1fr) auto;align-items:center;gap:14px;padding:14px;border:1px solid var(--yx-color-surface-muted);border-radius:12px}.b4-quest>div:first-child{display:grid;gap:4px}.b4-quest small,.b4-quest__progress span{color:var(--yx-color-text-secondary);font-size:12px}.b4-quest__progress{display:grid;gap:6px}.b4-quest progress{width:100%;height:7px;accent-color:var(--yx-color-brand-primary)}.b4-quest__state{color:var(--yx-color-brand-primary);font-size:12px;white-space:nowrap}.b4-game-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.b4-game{display:grid;gap:9px;padding:16px;border:1px solid var(--yx-color-border);border-radius:14px}.b4-game__icon{display:grid;width:36px;height:36px;place-items:center;border-radius:12px;color:var(--yx-color-brand-primary);background:var(--yx-color-brand-primary-soft)}.b4-game small,.b4-game>span:not(.b4-game__icon){color:var(--yx-color-text-secondary);font-size:12px}.b4-game .button{margin-top:4px}.b4-session-meta{display:flex;gap:12px;flex-wrap:wrap;color:var(--yx-color-text-secondary);font-size:12px}.b4-warning{margin:0;padding:12px;border-radius:12px;color:var(--yx-color-warning);background:var(--yx-color-warning-soft);line-height:1.6}.b4-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.b4-result{display:flex;align-items:center;gap:16px;flex-wrap:wrap;color:var(--yx-color-success);background:var(--yx-color-success-soft)}.b4-result span,.b4-result small{color:var(--yx-color-success)}.b4-room-list,.b4-notification-list,.b4-loadout-list,.b4-package-list,.b4-queue-list{display:grid;gap:10px}.b4-room,.b4-notification,.b4-loadout,.b4-package{display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:center;gap:12px;padding:14px;border:1px solid var(--yx-color-surface-muted);border-radius:12px}.b4-room>div:first-child,.b4-notification>div,.b4-loadout>div:first-child,.b4-package>div:first-child{display:grid;gap:4px}.b4-room small,.b4-notification small,.b4-loadout small,.b4-package small,.b4-package>span{color:var(--yx-color-text-secondary);font-size:12px}.b4-room__actions{grid-column:1/-1;display:flex!important;align-items:center;gap:8px!important;flex-wrap:wrap;border-top:1px solid var(--yx-color-surface-muted);padding-top:12px}.b4-room__actions select{min-height:40px;padding:0 10px;border:1px solid var(--yx-color-border);border-radius:10px;color:var(--yx-color-text-primary);background:var(--yx-color-surface-card)}.b4-timer{display:block;font-variant-numeric:tabular-nums;font-size:56px;color:var(--yx-color-brand-primary)}.b4-notification--unread{border-color:var(--yx-color-brand-primary-soft);background:var(--yx-color-brand-primary-soft)}.b4-notification p{margin:0;color:var(--yx-color-text-secondary);font-size:13px;line-height:1.5}.b4-session-state,.b4-equipped{padding:5px 8px;border-radius:8px;color:var(--yx-color-success)!important;background:var(--yx-color-success-soft)}.b4-avatar-preview{display:grid;min-height:180px;place-items:center;border-radius:18px;color:var(--yx-color-on-brand);background:radial-gradient(circle at 35% 25%,var(--yx-color-brand-primary),var(--yx-color-text-primary) 70%);font-size:68px}.b4-avatar-preview small{color:color-mix(in srgb,var(--yx-color-on-brand) 75%, transparent);font-size:12px}.b4-avatar-preview--static{color:var(--yx-color-brand-primary);background:var(--yx-color-brand-primary-soft)}.b4-avatar-preview--static small{color:var(--yx-color-text-secondary)}.b4-loadout button{grid-column:3}.b4-item-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.b4-item{display:grid;gap:6px;padding:14px;border-radius:12px;background:var(--yx-color-surface-page)}.b4-item span{color:var(--yx-color-brand-primary);font-size:12px;font-weight:800}.b4-item small{color:var(--yx-color-text-secondary);font-size:12px}.b4-package__state{color:var(--yx-color-brand-primary)!important;font-weight:800}.b4-queue-list article{display:grid;grid-template-columns:1fr auto;gap:5px;padding:12px;border-radius:10px;background:var(--yx-color-surface-page)}.b4-queue-list small{grid-column:1/-1;color:var(--yx-color-text-secondary)}.b4-queue-list span{color:var(--yx-color-warning);font-size:12px}@keyframes b4-orbit{to{transform:rotate(360deg)}}
@media(max-width:900px){.b4-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.b4-grid--world,.b4-grid--social,.b4-grid--avatar{grid-template-columns:1fr}.b4-map{grid-template-columns:repeat(2,minmax(0,1fr))}.b4-game-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:640px){.b4-hero{padding:24px}.b4-hero__orb{width:76px;height:76px;font-size:30px}.b4-status{display:grid}.b4-status__actions{justify-content:flex-start}.b4-metrics{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.b4-metric{padding:14px}.b4-metric strong{font-size:24px}.b4-card{padding:18px}.b4-map,.b4-game-grid,.b4-item-grid,.b4-form-grid{grid-template-columns:1fr}.b4-quest,.b4-room,.b4-notification,.b4-package{grid-template-columns:1fr}.b4-room__actions{grid-column:auto}.b4-loadout button{grid-column:auto}.b4-timer{font-size:46px}}
@media(prefers-reduced-motion:reduce){.b4-hero__orb{animation:none}}
.b4-game--disabled{background:var(--yx-color-surface-page)}.b4-game--disabled .b4-game__icon{color:var(--yx-color-text-secondary);background:var(--yx-color-surface-muted)}.b4-game .button:disabled{cursor:not-allowed;opacity:.55}
</style>

<style>
/* v2 B4World 页面级布局（只做样式）：对齐 webDemo learner-web 原型 world（.desktop-page--world .desktop-body 1.3fr 1fr，主列+侧栏）与普通内容页卡片风格。
 * 选择器全部以 .v2-page--b4world 开头；颜色只用 --v2-* tokens，不写死色值以适配暗色。 */
.v2-page--b4world.b4-page{background:var(--v2-bg);color:var(--v2-ink);font-family:var(--v2-font);display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:var(--v2-space-5);align-items:start;min-width:0}
.v2-page--b4world>header.experience-heading{grid-column:1/-1;min-width:0}
.v2-page--b4world>.b4-status{grid-column:1/-1;min-width:0}
.v2-page--b4world>.b4-tabs{grid-column:1/-1;min-width:0}
.v2-page--b4world>section{grid-column:1;min-width:0}
.v2-page--b4world .b4-status{display:flex;align-items:center;justify-content:space-between;gap:var(--v2-space-4);flex-wrap:wrap;background:var(--v2-card);border:1px solid var(--v2-line);border-radius:var(--v2-radius-lg);box-shadow:var(--v2-shadow);padding:var(--v2-space-4) var(--v2-space-5)}
.v2-page--b4world .b4-status>div:first-child{display:grid;gap:var(--v2-space-1);min-width:0}
.v2-page--b4world .b4-status strong{color:var(--v2-ink);font-size:var(--v2-text-sm)}
.v2-page--b4world .b4-status span{color:var(--v2-mut);font-size:var(--v2-text-sm);line-height:1.6}
.v2-page--b4world .b4-status__actions{display:flex;align-items:center;justify-content:flex-end;gap:var(--v2-space-2);flex-wrap:wrap}
.v2-page--b4world .b4-queue{display:inline-flex;align-items:center;padding:var(--v2-space-1) var(--v2-space-3);border-radius:var(--v2-radius-pill);background:var(--v2-warn-soft);color:var(--v2-warn);font-size:var(--v2-text-xs);font-weight:700}
.v2-page--b4world .quality-select{display:flex;align-items:center;gap:var(--v2-space-2);color:var(--v2-mut);font-size:var(--v2-text-sm)}
.v2-page--b4world .b4-tabs{display:flex;gap:var(--v2-space-2);overflow:auto;padding-bottom:var(--v2-space-1)}
.v2-page--b4world .b4-tabs button{min-height:40px;padding:0 var(--v2-space-4);border:1px solid var(--v2-line);border-radius:var(--v2-radius-pill);background:var(--v2-card);color:var(--v2-mut);font-size:var(--v2-text-sm);font-weight:600;white-space:nowrap;cursor:pointer;transition:border-color var(--v2-motion-fast)}
.v2-page--b4world .b4-tabs button:hover{border-color:var(--v2-brand);color:var(--v2-brand)}
.v2-page--b4world .b4-tabs .b4-tabs__item--active{background:var(--v2-soft);border-color:var(--v2-brand);color:var(--v2-brand)}
.v2-page--b4world .b4-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:var(--v2-space-4);background:transparent;border:0;box-shadow:none;padding:0}
.v2-page--b4world .b4-metric{display:grid;gap:var(--v2-space-2);align-content:start;background:var(--v2-card);border:1px solid var(--v2-line);border-radius:var(--v2-radius-lg);box-shadow:var(--v2-shadow);padding:var(--v2-space-5);min-width:0}
.v2-page--b4world .b4-metric span{margin:0;color:var(--v2-brand);font-size:var(--v2-text-xs);font-weight:800;letter-spacing:1px}
.v2-page--b4world .b4-metric strong{margin:0;color:var(--v2-ink);font-size:var(--v2-text-xl);line-height:1.25}
.v2-page--b4world .b4-metric small{color:var(--v2-mut);font-size:var(--v2-text-xs);line-height:1.6}
.v2-page--b4world .b4-grid{background:transparent;border:0;box-shadow:none;padding:0;display:grid;gap:var(--v2-space-5);min-width:0;align-items:start}
.v2-page--b4world .v2-b4world-main{grid-template-columns:minmax(0,1.3fr) minmax(0,1fr)}
.v2-page--b4world .b4-grid--social{grid-template-columns:minmax(0,1.4fr) minmax(0,.6fr)}
.v2-page--b4world .b4-grid--avatar{grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr)}
.v2-page--b4world .b4-card{background:var(--v2-card);border:1px solid var(--v2-line);border-radius:var(--v2-radius-lg);box-shadow:var(--v2-shadow);padding:var(--v2-space-6);min-width:0;display:grid;gap:var(--v2-space-4);align-content:start}
.v2-page--b4world .b12-card{background:var(--v2-card);border:1px solid var(--v2-line);border-radius:var(--v2-radius-lg);box-shadow:var(--v2-shadow);padding:var(--v2-space-6);min-width:0;display:grid;gap:var(--v2-space-4);align-content:start}
.v2-page--b4world .b4-card--wide{min-width:0}
.v2-page--b4world .b4-card__heading{display:flex;align-items:flex-start;justify-content:space-between;gap:var(--v2-space-4)}
.v2-page--b4world .b12-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:var(--v2-space-4)}
.v2-page--b4world .b4-card__heading>div{display:grid;gap:var(--v2-space-1);min-width:0}
.v2-page--b4world .b12-heading>div{display:grid;gap:var(--v2-space-1);min-width:0}
.v2-page--b4world .b4-card h2{margin:0;font-size:var(--v2-text-lg);color:var(--v2-ink);line-height:1.4}
.v2-page--b4world .b12-heading h2{margin:0;font-size:var(--v2-text-lg);color:var(--v2-ink);line-height:1.4}
.v2-page--b4world .card-kicker{margin:0;color:var(--v2-brand);font-size:var(--v2-text-xs);font-weight:700;letter-spacing:1px}
.v2-page--b4world .b12-kicker{margin:0;color:var(--v2-brand);font-size:var(--v2-text-xs);font-weight:700;letter-spacing:1px}
.v2-page--b4world .b4-card__heading>span{color:var(--v2-mut);font-size:var(--v2-text-xs)}
.v2-page--b4world .b12-state{color:var(--v2-mut);font-size:var(--v2-text-xs)}
.v2-page--b4world .b4-fact-tag{display:inline-flex;align-items:center;width:fit-content;max-width:100%;padding:var(--v2-space-1) var(--v2-space-3);border-radius:var(--v2-radius-pill);background:var(--v2-soft);color:var(--v2-brand);font-size:var(--v2-text-xs);font-weight:700;line-height:1.6}
.v2-page--b4world .b4-session-state{display:inline-flex;align-items:center;width:fit-content;max-width:100%;padding:var(--v2-space-1) var(--v2-space-3);border-radius:var(--v2-radius-pill);background:var(--v2-ok-soft);color:var(--v2-ok);font-size:var(--v2-text-xs);font-weight:700}
.v2-page--b4world .b4-quest__state{display:inline-flex;align-items:center;padding:var(--v2-space-1) var(--v2-space-3);border-radius:var(--v2-radius-pill);background:var(--v2-soft);color:var(--v2-brand);font-size:var(--v2-text-xs);font-weight:700;white-space:nowrap}
.v2-page--b4world .b4-package__state{color:var(--v2-brand);font-weight:800;font-size:var(--v2-text-xs)}
.v2-page--b4world .b12-chest__kind{display:inline-flex;align-items:center;padding:var(--v2-space-1) var(--v2-space-3);border-radius:var(--v2-radius-pill);background:var(--v2-soft);color:var(--v2-brand);font-size:var(--v2-text-xs);font-weight:700}
.v2-page--b4world .b4-muted{margin:0;color:var(--v2-mut);font-size:var(--v2-text-sm);line-height:1.7}
.v2-page--b4world .b12-muted{margin:0;color:var(--v2-mut);font-size:var(--v2-text-sm);line-height:1.7}
.v2-page--b4world .b4-inline-empty{margin:0;padding:var(--v2-space-4);border:1px dashed var(--v2-line);border-radius:var(--v2-radius-md);color:var(--v2-mut);font-size:var(--v2-text-sm);line-height:1.6}
.v2-page--b4world .b12-inline-state{margin:0;color:var(--v2-mut);font-size:var(--v2-text-sm);line-height:1.6}
.v2-page--b4world .b4-warning{margin:0;padding:var(--v2-space-3) var(--v2-space-4);border-radius:var(--v2-radius-md);background:var(--v2-warn-soft);color:var(--v2-warn);font-size:var(--v2-text-sm);line-height:1.6}
.v2-page--b4world .b4-result{display:flex;align-items:center;gap:var(--v2-space-4);flex-wrap:wrap;background:var(--v2-ok-soft);color:var(--v2-ok)}
.v2-page--b4world .b4-result span{color:var(--v2-ok);font-size:var(--v2-text-sm)}
.v2-page--b4world .b4-result small{color:var(--v2-ok);font-size:var(--v2-text-xs)}
.v2-page--b4world .b12-result{display:grid;gap:var(--v2-space-1);padding:var(--v2-space-4);background:var(--v2-ok-soft);color:var(--v2-ok);border-radius:var(--v2-radius-md);font-size:var(--v2-text-sm);line-height:1.6}
.v2-page--b4world .b4-map{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--v2-space-3);padding:var(--v2-space-4);background:var(--v2-surface);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md)}
.v2-page--b4world .b4-map__node{display:grid;gap:var(--v2-space-2);align-content:start;min-height:120px;padding:var(--v2-space-4);background:var(--v2-card);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);min-width:0}
.v2-page--b4world .b4-map__dot{width:var(--v2-space-5);height:var(--v2-space-5);border-radius:50%;background:var(--v2-brand)}
.v2-page--b4world .b4-map__node strong{color:var(--v2-ink);font-size:var(--v2-text-sm)}
.v2-page--b4world .b4-map__node small{color:var(--v2-mut);font-size:var(--v2-text-xs);line-height:1.5}
.v2-page--b4world .b4-map__node em{color:var(--v2-mut);font-size:var(--v2-text-xs);font-style:normal;line-height:1.5}
.v2-page--b4world .b4-season{display:flex;align-items:center;gap:var(--v2-space-3);flex-wrap:wrap;padding:var(--v2-space-3) var(--v2-space-4);background:var(--v2-surface);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md)}
.v2-page--b4world .b4-season strong{color:var(--v2-brand);font-size:var(--v2-text-sm)}
.v2-page--b4world .b4-season span{color:var(--v2-ink);font-size:var(--v2-text-sm)}
.v2-page--b4world .b4-season small{color:var(--v2-mut);font-size:var(--v2-text-xs)}
.v2-page--b4world .b4-streak-mark{display:grid;width:38px;height:38px;place-items:center;border-radius:var(--v2-radius-md);background:var(--v2-soft);color:var(--v2-brand);font-size:var(--v2-text-md)}
.v2-page--b4world .b4-streak-number{display:flex;align-items:baseline;gap:var(--v2-space-3)}
.v2-page--b4world .b4-streak-number strong{font-size:var(--v2-text-2xl);line-height:1;color:var(--v2-brand)}
.v2-page--b4world .b4-streak-number span{color:var(--v2-mut);font-size:var(--v2-text-sm)}
.v2-page--b4world .b4-toggle{display:flex;align-items:center;gap:var(--v2-space-2);color:var(--v2-ink);font-size:var(--v2-text-sm)}
.v2-page--b4world .b4-field{display:grid;gap:var(--v2-space-2);color:var(--v2-mut);font-size:var(--v2-text-sm)}
.v2-page--b4world .b4-field input{width:100%;min-height:40px;padding:0 var(--v2-space-3);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);background:var(--v2-card);color:var(--v2-ink);font-size:var(--v2-text-sm)}
.v2-page--b4world .b4-field select{width:100%;min-height:40px;padding:0 var(--v2-space-3);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);background:var(--v2-card);color:var(--v2-ink);font-size:var(--v2-text-sm)}
.v2-page--b4world .quality-select select{min-height:38px;padding:0 var(--v2-space-3);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);background:var(--v2-card);color:var(--v2-ink);font-size:var(--v2-text-sm)}
.v2-page--b4world .b4-room__actions select{min-height:40px;padding:0 var(--v2-space-3);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);background:var(--v2-card);color:var(--v2-ink);font-size:var(--v2-text-sm)}
.v2-page--b4world .b12-report-controls select{min-height:40px;padding:0 var(--v2-space-3);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);background:var(--v2-card);color:var(--v2-ink);font-size:var(--v2-text-sm)}
.v2-page--b4world .b4-button-row{display:flex;gap:var(--v2-space-2);flex-wrap:wrap}
.v2-page--b4world .b4-quest-list{display:grid;gap:var(--v2-space-3)}
.v2-page--b4world .b4-room-list{display:grid;gap:var(--v2-space-3)}
.v2-page--b4world .b4-notification-list{display:grid;gap:var(--v2-space-3)}
.v2-page--b4world .b4-loadout-list{display:grid;gap:var(--v2-space-3)}
.v2-page--b4world .b4-package-list{display:grid;gap:var(--v2-space-3)}
.v2-page--b4world .b4-queue-list{display:grid;gap:var(--v2-space-3)}
.v2-page--b4world .b12-chest-list{display:grid;gap:var(--v2-space-3)}
.v2-page--b4world .b4-quest{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) auto;align-items:center;gap:var(--v2-space-4);padding:var(--v2-space-4);background:var(--v2-surface);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md)}
.v2-page--b4world .b4-quest>div:first-child{display:grid;gap:var(--v2-space-1);min-width:0}
.v2-page--b4world .b4-quest strong{color:var(--v2-ink);font-size:var(--v2-text-sm)}
.v2-page--b4world .b4-quest small{color:var(--v2-mut);font-size:var(--v2-text-xs)}
.v2-page--b4world .b4-quest__progress{display:grid;gap:var(--v2-space-2)}
.v2-page--b4world .b4-quest__progress span{color:var(--v2-mut);font-size:var(--v2-text-xs)}
.v2-page--b4world .b4-quest progress{width:100%;height:8px;accent-color:var(--v2-brand)}
.v2-page--b4world .b4-game-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--v2-space-3)}
.v2-page--b4world .b4-game{display:grid;gap:var(--v2-space-2);align-content:start;padding:var(--v2-space-4);background:var(--v2-surface);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);min-width:0}
.v2-page--b4world .b4-game strong{color:var(--v2-ink);font-size:var(--v2-text-sm)}
.v2-page--b4world .b4-game>span:not(.b4-game__icon){color:var(--v2-mut);font-size:var(--v2-text-xs)}
.v2-page--b4world .b4-game__icon{display:grid;width:36px;height:36px;place-items:center;border-radius:var(--v2-radius-md);background:var(--v2-soft);color:var(--v2-brand)}
.v2-page--b4world .b4-session-meta{display:flex;gap:var(--v2-space-3);flex-wrap:wrap;color:var(--v2-mut);font-size:var(--v2-text-xs)}
.v2-page--b4world .b4-room{display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:center;gap:var(--v2-space-3);padding:var(--v2-space-4);background:var(--v2-surface);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md)}
.v2-page--b4world .b4-room>div:first-child{display:grid;gap:var(--v2-space-1);min-width:0}
.v2-page--b4world .b4-room strong{color:var(--v2-ink);font-size:var(--v2-text-sm)}
.v2-page--b4world .b4-room small{color:var(--v2-mut);font-size:var(--v2-text-xs)}
.v2-page--b4world .b4-room>span{color:var(--v2-mut);font-size:var(--v2-text-xs)}
.v2-page--b4world .b4-room__actions{grid-column:1/-1;display:flex;align-items:center;gap:var(--v2-space-2);flex-wrap:wrap;border-top:1px solid var(--v2-line);padding-top:var(--v2-space-3)}
.v2-page--b4world .b4-timer{display:block;font-size:var(--v2-text-2xl);color:var(--v2-brand);font-variant-numeric:tabular-nums;line-height:1.1}
.v2-page--b4world .b4-notification{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:var(--v2-space-3);padding:var(--v2-space-4);background:var(--v2-surface);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md)}
.v2-page--b4world .b4-notification>div{display:grid;gap:var(--v2-space-1);min-width:0}
.v2-page--b4world .b4-notification strong{color:var(--v2-ink);font-size:var(--v2-text-sm)}
.v2-page--b4world .b4-notification p{margin:0;color:var(--v2-mut);font-size:var(--v2-text-sm);line-height:1.6}
.v2-page--b4world .b4-notification small{color:var(--v2-mut);font-size:var(--v2-text-xs)}
.v2-page--b4world .b4-notification--unread{background:var(--v2-soft);border-color:var(--v2-brand)}
.v2-page--b4world .b12-room-tabs{display:flex;gap:var(--v2-space-2);flex-wrap:wrap}
.v2-page--b4world .b12-room-tabs button{min-height:36px;padding:0 var(--v2-space-4);border:1px solid var(--v2-line);border-radius:var(--v2-radius-pill);background:var(--v2-card);color:var(--v2-mut);font-size:var(--v2-text-xs);font-weight:700;cursor:pointer}
.v2-page--b4world .b12-room-tabs button.active{background:var(--v2-soft);border-color:var(--v2-brand);color:var(--v2-brand)}
.v2-page--b4world .b12-report-controls{display:grid;gap:var(--v2-space-2);color:var(--v2-mut);font-size:var(--v2-text-sm)}
.v2-page--b4world .b12-settings-link{color:var(--v2-brand);font-weight:600;font-size:var(--v2-text-sm)}
.v2-page--b4world .b4-avatar-preview{display:grid;place-items:center;gap:var(--v2-space-2);min-height:180px;padding:var(--v2-space-5);border-radius:var(--v2-radius-md);background:var(--v2-surface);border:1px solid var(--v2-line);color:var(--v2-brand)}
.v2-page--b4world .b4-avatar-preview small{color:var(--v2-mut);font-size:var(--v2-text-xs)}
.v2-page--b4world .b4-loadout{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:var(--v2-space-3);padding:var(--v2-space-4);background:var(--v2-surface);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md)}
.v2-page--b4world .b4-loadout>div:first-child{display:grid;gap:var(--v2-space-1);min-width:0}
.v2-page--b4world .b4-loadout strong{color:var(--v2-ink);font-size:var(--v2-text-sm)}
.v2-page--b4world .b4-loadout small{color:var(--v2-mut);font-size:var(--v2-text-xs)}
.v2-page--b4world .b4-loadout>span{color:var(--v2-mut);font-size:var(--v2-text-xs)}
.v2-page--b4world .b4-item-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--v2-space-3)}
.v2-page--b4world .b4-item{display:grid;gap:var(--v2-space-1);padding:var(--v2-space-4);background:var(--v2-surface);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);min-width:0}
.v2-page--b4world .b4-item span{color:var(--v2-brand);font-size:var(--v2-text-xs);font-weight:800}
.v2-page--b4world .b4-item strong{color:var(--v2-ink);font-size:var(--v2-text-sm)}
.v2-page--b4world .b4-package{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:var(--v2-space-3);padding:var(--v2-space-4);background:var(--v2-surface);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md)}
.v2-page--b4world .b4-package>div:first-child{display:grid;gap:var(--v2-space-1);min-width:0}
.v2-page--b4world .b4-package strong{color:var(--v2-ink);font-size:var(--v2-text-sm)}
.v2-page--b4world .b4-package small{color:var(--v2-mut);font-size:var(--v2-text-xs)}
.v2-page--b4world .b4-package>span{color:var(--v2-mut);font-size:var(--v2-text-xs)}
.v2-page--b4world .b4-queue-list article{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:var(--v2-space-1);padding:var(--v2-space-3) var(--v2-space-4);background:var(--v2-surface);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md)}
.v2-page--b4world .b4-queue-list strong{color:var(--v2-ink);font-size:var(--v2-text-sm)}
.v2-page--b4world .b4-queue-list span{color:var(--v2-warn);font-size:var(--v2-text-xs)}
.v2-page--b4world .b4-queue-list small{grid-column:1/-1;color:var(--v2-mut);font-size:var(--v2-text-xs)}
.v2-page--b4world .b12-chest{display:grid;gap:var(--v2-space-2);padding:var(--v2-space-4);background:var(--v2-surface);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md)}
.v2-page--b4world .v2-b4world-rail{grid-column:2;grid-row:4/span 40;position:sticky;top:var(--v2-space-6);background:var(--v2-card);border:1px solid var(--v2-line);border-radius:var(--v2-radius-lg);box-shadow:var(--v2-shadow);padding:var(--v2-space-6);min-width:0;display:grid;align-content:start;gap:var(--v2-space-3)}
.v2-page--b4world .v2-b4world-rail h2{margin:0;font-size:var(--v2-text-lg);color:var(--v2-ink);line-height:1.4}
.v2-page--b4world .v2-b4world-rail ol{margin:0;padding-left:var(--v2-space-5);display:grid;gap:var(--v2-space-2);color:var(--v2-mut);font-size:var(--v2-text-sm);line-height:1.7}
.v2-page--b4world button:focus-visible{outline:2px solid var(--v2-brand);outline-offset:2px}
.v2-page--b4world a:focus-visible{outline:2px solid var(--v2-brand);outline-offset:2px}
.v2-page--b4world input:focus-visible{outline:2px solid var(--v2-brand);outline-offset:2px}
.v2-page--b4world select:focus-visible{outline:2px solid var(--v2-brand);outline-offset:2px}
@media (max-width:1190px){.v2-page--b4world{grid-template-columns:minmax(0,1fr) 250px}.v2-page--b4world .b4-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.v2-page--b4world .b4-map{grid-template-columns:repeat(2,minmax(0,1fr))}.v2-page--b4world .v2-b4world-main{grid-template-columns:minmax(0,1fr) minmax(0,.9fr)}}
@media (max-width:900px){.v2-page--b4world{grid-template-columns:1fr}.v2-page--b4world>section{grid-column:1}.v2-page--b4world .v2-b4world-main{grid-template-columns:1fr}.v2-page--b4world .b4-grid--social{grid-template-columns:1fr}.v2-page--b4world .b4-grid--avatar{grid-template-columns:1fr}.v2-page--b4world .b4-map{grid-template-columns:1fr}.v2-page--b4world .b4-game-grid{grid-template-columns:1fr}.v2-page--b4world .b4-item-grid{grid-template-columns:1fr}.v2-page--b4world .b4-quest{grid-template-columns:1fr}.v2-page--b4world .b4-room{grid-template-columns:1fr}.v2-page--b4world .b4-notification{grid-template-columns:1fr}.v2-page--b4world .b4-package{grid-template-columns:1fr}.v2-page--b4world .v2-b4world-rail{grid-column:1;grid-row:auto;position:static}}
</style>
