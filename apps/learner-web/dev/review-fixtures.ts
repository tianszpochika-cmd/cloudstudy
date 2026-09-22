/** Curated, synthetic records for design review only. Unknown requests fail closed. */
const tasks = [
  { id: 'review-1', title: '在咖啡馆，轻松开口', description: '从一句自然的点单开始，熟悉日常表达。', kind: 'NEW', minutes: 8, contentCode: 'cafe', completed: false },
  { id: 'review-2', title: '把昨天的单词记牢', description: '复习 12 个词，给记忆加一点温度。', kind: 'REVIEW', minutes: 5, contentCode: 'words', completed: false },
  { id: 'review-3', title: '读一段慢下来的生活', description: '完成今天的短篇阅读。', kind: 'NEW', minutes: 7, contentCode: 'reading', completed: true },
]
const catalog = [
  { contentId: 'cafe', title: '日常英语 · 从咖啡馆开始', description: '一杯咖啡，一次自然的交流。', kind: 'SPEAKING' },
  { contentId: 'reading', title: '慢下来，读懂生活', description: '用短篇阅读，认识熟悉世界的新表达。', kind: 'READING' },
  { contentId: 'words', title: '每天 12 个实用词', description: '在例句里记单词，在复习里慢慢记牢。', kind: 'VOCABULARY' },
  { contentId: 'listening', title: '听见英语的节奏', description: '短音频，跟着自己的速度反复听。', kind: 'LISTENING' },
  { contentId: 'grammar', title: '把句子搭起来', description: '从简单结构开始，理解每一部分的作用。', kind: 'GRAMMAR' },
  { contentId: 'writing', title: '给朋友写一封信', description: '从一句问候开始，写出自己的想法。', kind: 'WRITING' },
].map(item => ({ ...item, contentVersionId: '1', status: 'PUBLISHED', contentLocale: 'en-US' }))
const records: Record<string, unknown> = {
  '/learner/home': { streakDays: 7, starCoins: 120, currentXp: 260, levelTitle: '认真生活的学习者', dailyStream: { tasks, targetMinutes: 20, completedMinutes: 7 } },
  '/content/learner/catalog': { items: catalog },
  '/learning/continue-context': { hasContext: false },
  '/learner/profile': { nickname: '星星同学', accentPref: 'US', dailyQuotaMinutes: 20, level: 'A2', stateVersion: 1 },
  '/learner/privacy': { showMinutes: true, leaderboardVisibility: 'NICKNAME' },
  '/learning/srs/overview': { total: 240, newCount: 20, learningCount: 48, reviewCount: 52, masteredCount: 120 },
  '/learning/plan/current': { status: 'ACTIVE', targetMinutes: 20, planVersion: 1, updatedAt: '2026-09-22T06:00:00Z' },
  '/learning/mistakes/queue': { items: [{ interaction_id: 'review-m1', resource_key: '日常表达', domain_code: 'GRAMMAR', message: '再看一次：描述习惯时，注意第三人称动词的变化。', error_category: '主谓一致', mistake_status: 'OPEN' }] },
  '/learning/stats/daily-report': { studyMinutes: 20, newItems: 12, reviewItems: 18, accuracy: 87, masteredIncrement: 6, d1Pending: 5, d7Pending: 3, forgettingRate: 8, calculationVersion: 'review-1', generatedAt: '2026-09-22T06:00:00Z', weaknesses: [{ label: '日常动词', value: 32, nextAction: '明天再复习一次' }] },
  '/notifications/inbox': { items: [{ messageId: 'review-notice', title: '留一点时间给今天的自己', safeBody: '你的今日任务已准备好，从一个小练习开始吧。', readAt: null, createdAt: '2026-09-22T06:00:00Z' }] },
  '/writing/prompts': [{ promptId: 1, contentVersionId: 1, title: '一封简单的邀请信', taskText: 'Invite a friend to have coffee this weekend. Tell them when and where to meet.', targetStructure: ['问候', '邀请', '时间与地点', '期待回复'] }],
  '/writing/templates': [{ templateId: 1, contentVersionId: 1, title: '友好的邀请', structure: [{ slotCode: 'opening', label: '先和朋友打声招呼', required: true }, { slotCode: 'invitation', label: '说明你的邀请', required: true }] }],
  '/writing/materials': [{ materialId: 1, contentVersionId: 1, title: '用得上的一句话', bodyText: 'Would you like to join me for a coffee?' }],
  '/writing/history': [], '/writing/proofreading/exercises': [],
  '/grammar/points': [{ grammarPointId: 1, contentVersionId: 1, title: '一般现在时', description: '表达习惯，或描述经常发生的事。', explanation: '说一件经常做的事，可以从 I / You / We + 动词原形 开始。' }],
  '/grammar/exercises': [], '/grammar/mastery': [],
  '/gamification/me/summary': { level: 3, totalXp: 260, starCoins: 120 },
  '/gamification/streak': { currentStreak: 7, longestStreak: 12, status: 'ACTIVE', timeZone: 'Asia/Shanghai', weekendProtectionEnabled: false },
  '/gamification/quests': { items: [] }, '/gamification/me/rewards': { items: [] }, '/gamification/me/ledger': { items: [] },
  '/avatar/items': { items: [] }, '/avatar/loadouts': { items: [] }, '/avatar/resources': { items: [] },
  '/games/catalog': { items: [] },
}
records['/learning/stats/weekly-report'] = { ...(records['/learning/stats/daily-report'] as object), studyMinutes: 105, newItems: 68, reviewItems: 112 }
for (const path of ['/learning/stats/daily-report', '/learning/stats/weekly-report']) Object.assign(records[path] as object, { reportId: 'design-report', weakness: [{ label: '日常动词', value: 32, nextAction: '明天再复习一次' }, { label: '句子结构', value: 24, nextAction: '完成一次语法练习' }] })
records['/notifications/messages'] = records['/notifications/inbox']
records['/notifications/preferences'] = { items: [{ notificationType: 'LEARNING_REMINDER', channel: 'IN_APP', enabled: true, locale: 'zh-CN' }] }
records['/iam/devices'] = { items: [{ deviceId: 'design-device', deviceName: '当前浏览器', platform: 'WEB', current: true, status: 'ACTIVE', region: '本地', clientVersion: 'Web' }] }
const article = { articleId: 1, contentVersionId: 1, title: 'A quieter kind of morning', cefrLevel: 'A2', wordCount: 86, estimatedMinutes: 4, rightsStatus: 'AUTHORIZED', blocks: [
  { blockId: 'paragraph-1', text: 'Every morning, Mia takes the long way to work. She walks past a small garden and stops to listen to the birds.', translation: '每天早上，米娅都会绕一点路去上班。她经过一座小花园，停下来听鸟鸣。', tokens: [] },
  { blockId: 'paragraph-2', text: 'At the corner, a café opens its doors. The smell of fresh coffee makes her smile. She orders a small cup and says hello to the owner.', translation: '街角的咖啡馆打开了门。新鲜咖啡的香气让她露出微笑。她点了一小杯，和店主打了声招呼。', tokens: [] },
  { blockId: 'paragraph-3', text: 'These little moments do not take much time. But they help her feel ready for the day.', translation: '这些小小的时刻不会占用太多时间，却让她准备好迎接新的一天。', tokens: [] },
] }
records['/reading/articles'] = [article]; records['/reading/articles/1'] = article
records['/reading/questions'] = [{ questionId: 1, articleId: 1, contentVersionId: 1, stemText: 'Why does Mia take the long way to work?', options: [{ key: 'A', text: 'She enjoys small moments along the way.' }, { key: 'B', text: 'She cannot find the short way.' }] }]
records['/listening/materials'] = [{ materialId: 1, title: 'A coffee, please', cefrLevel: 'A2', durationMs: 30000, contentVersionId: 1, rightsStatus: 'AUTHORIZED', segments: [{ segmentId: 's1', startMs: 0, endMs: 5000, text: 'Could I have a coffee, please?', translation: '请给我一杯咖啡。', tokens: [], annotations: [] }, { segmentId: 's2', startMs: 5000, endMs: 10000, text: 'Of course. Would you like some milk?', translation: '当然。需要加点牛奶吗？', tokens: [], annotations: [] }] }]
records['/phonetics/catalog'] = { items: ['iː','ɪ','e','æ','ɑː','ɒ','ɔː','ʊ','uː','ʌ','ɜː','ə','eɪ','aɪ','ɔɪ','əʊ','aʊ','ɪə','eə','ʊə','p','b','t','d','k','g','f','v','θ','ð','s','z','ʃ','ʒ','h','tʃ','dʒ','m','n','ŋ','l','r','j','w','ts','dz','tr','dr'].map((symbol,index) => ({ phonemeId: index+1, symbol, group: index < 20 ? 'VOWEL' : 'CONSONANT', exampleWord: index === 0 ? 'see' : '', description: '对照示范，感受口型的变化。', contentVersionId: 1, mouthProfile: { profileVersion: 'design-1', fallback2d: '', jawOpen: .4, tongueHeight: .5, tongueBackness: .4, lipRound: .3, voicing: true } })) }
records['/phonetics/minimal-pairs'] = []
const vocabulary = { items: [{ itemId: 'word-1', vocabularyId: 'word-1', itemType: 'VOCAB', title: 'wander', word: 'wander', contentVersionId: 1, phonetic: '/ˈwɒndə/', meaningCn: '漫步；闲逛', definitionEn: 'To walk slowly without a fixed direction.', examples: [{ sentence: 'We wandered through the quiet streets.', translation: '我们在安静的街道上漫步。' }] }] }
const practice = { sessionId: 'design-practice', status: 'IN_PROGRESS', stateVersion: 1, contentVersionId: 1, items: [{ exerciseId: 'q1', id: 'q1', type: 'CHOICE', prompt: 'Choose a natural way to order a coffee.', helperText: '选择一句自然、礼貌的表达。', contentVersionId: 1, options: [{ key: 'A', text: 'Could I have a coffee, please?' }, { key: 'B', text: 'Coffee me want.' }] }] }
export function installReviewTransport() {
  // Memory-backed storage keeps preview activity away from the actual app's cache/session hints.
  const memory = new Map<string, string>()
  const storage: Storage = { get length() { return memory.size }, key: index => [...memory.keys()][index] ?? null, getItem: key => memory.get(key) ?? null, setItem: (key, value) => { memory.set(key, String(value)) }, removeItem: key => { memory.delete(key) }, clear: () => memory.clear() }
  Object.defineProperty(window, 'localStorage', { configurable: true, value: storage })
  Object.defineProperty(window, 'sessionStorage', { configurable: true, value: storage })
  const mode = new URLSearchParams(location.search).get('state')
  window.fetch = async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.href)
    const path = url.pathname.replace(/^\/api\/v1/, '')
    const method = init?.method ?? (input instanceof Request ? input.method : 'GET')
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
    if (mode === 'error') return json({ message: '当前是网络异常的界面预览，请稍后重试。' }, 503)
    // Only read-like initialization commands may return synthetic display data.
    if (method === 'POST' && path === '/learning/srs/batches') return json(mode === 'empty' ? { items: [] } : vocabulary)
    if (method === 'POST' && path === '/assessment/sessions') return json(mode === 'empty' ? { sessionId: 'empty', items: [] } : practice)
    if (method !== 'GET') return json({ message: '界面预览不会保存或提交学习记录，请到真实应用操作。' }, 503)
    if (mode === 'empty') return json({ items: [], empty: true })
    if (path.startsWith('/content/learner/vocabulary/')) return json(vocabulary.items[0])
    if (path.startsWith('/content/learner/')) {
      if(path.endsWith('/catalog')) return json(records[path])
      const item = catalog.find(item => path.endsWith('/' + item.contentId))
      if(item) return json({ ...item, items: [{ itemId: 'r1', itemType: 'READING', text: 'Could I have a coffee, please?', options: [] }, { itemId: 'r2', itemType: 'READING', text: 'A small kindness can make an ordinary day feel special.', options: [] }] })
    }
    if (Object.hasOwn(records, path)) return json(records[path])
    return json({ message: '此模块暂未配置示例内容。你可以查看布局，业务操作请前往真实应用。' }, 503)
  }
}
