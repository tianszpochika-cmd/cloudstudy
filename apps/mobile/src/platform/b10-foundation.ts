import { ref } from 'vue'
import type { ThemeMode } from '@englishflow/design-tokens'
import { mobileI18n, mobileThemeController } from './v2-foundation'

mobileI18n.registerMessages('zh-CN', {
  b10: {
    status: {
      idle: '等待读取学习服务', loading: '正在读取服务端学习数据', ready: '学习服务已连接', empty: '当前没有可用内容', offline: '网络暂时不可用', forbidden: '当前会话没有访问权限', stale: '内容版本已失效', error: '服务暂时不可用',
      retry: '重试', login: '去登录', sync: '同步待处理记录', noSample: '未使用本地样例填充结果。', pending: '待同步不等于已结算。',
    },
    common: { performance: '画质', theme: '主题', uiLocale: '界面语言', contentLocale: '学习内容语言', light: '亮色', dark: '暗色', system: '跟随系统', contrast: '高对比', chinese: '简体中文', english: 'English', recovery: '保留本地草稿，可联网后恢复。', stale: '当前版本已下线或发生变化，请重新读取。' },
    vocab: { eyebrow: 'VOCABULARY · SRS', title: '先想起来，再看答案。', description: '词卡、信心度和复习排程由 learning-service 负责；正面不展示答案。', reveal: '显示答案', revealing: '正在读取答案…', noAnswer: '服务端未返回受保护释义。', due: '下次复习', rate: '记忆信心', empty: '今天没有到期词卡', queued: '本次复习已保存到待同步队列。', accepted: '复习已记录。' },
    practice: { eyebrow: 'PRACTICE · RULE-BASED', title: '做一题，马上知道下一步。', description: '题面与判分以服务端版本为准；客户端不提交分数或标准答案。', loading: '正在创建练习会话…', empty: '服务端没有返回题目', next: '下一题', submit: '提交答案', complete: '查看错题与报告', checkpoint: '保存断点', restored: '已恢复上次断点。' },
    report: { eyebrow: 'MASTERY · REPORT', title: '把错误变成下一步。', mistakes: '错题与错误原因', report: '学习报告', retry: '开始订正', verify: '提交验证', noMistakes: '当前没有待修复错题', noReport: '暂时没有可用报告', ready: '报告已生成', partial: '报告部分生成，稍后可重试', reason: '规则证据' },
    grammar: { eyebrow: 'GRAMMAR · X-RAY', title: '把长难句拆成可练的结构。', tree: '语法知识树', sentence: '长难句 X 光机', order: '调整句子积木顺序', imitate: '按结构槽位仿写', correction: '病句改错', submit: '提交规则练习', degraded: '结构图加载失败，已降级为线性句法。', noGraph: '暂时没有可用的句法结构。' },
    writing: { eyebrow: 'WRITING · RULE FEEDBACK', title: '写出来，再看规则依据。', description: '反馈来自版本化规则与原文位置；Phase 1 不引入 AI 评分。', draft: '本地草稿', save: '保存草稿', submit: '提交规则评测', correction: '提交病句改错', feedback: '规则反馈', noPrompt: '暂时没有可用写作题。', aiOff: 'AI 评分：关闭（Phase 1）' },
    reading: { eyebrow: 'READING · IMMERSIVE', title: '读懂一段，再留下可复习的位置。', description: '阅读进度与文章版本绑定；查词/挖掘失败不会丢失最后进度。', save: '保存阅读进度', mining: '挖掘为表达', mined: '已加入复习信号', translation: '显示译文', hideTranslation: '隐藏译文', noArticle: '暂时没有可用的授权文章', question: '理解检查', submit: '提交答案' },
  },
})

mobileI18n.registerMessages('en-US', {
  b10: {
    status: { idle: 'Waiting for learning service', loading: 'Loading server learning data', ready: 'Learning service connected', empty: 'No content is available', offline: 'Network is unavailable', forbidden: 'This session is not allowed', stale: 'Content version is stale', error: 'Service is unavailable', retry: 'Retry', login: 'Sign in', sync: 'Sync pending records', noSample: 'No local sample was used.', pending: 'Pending does not mean settled.' },
    common: { performance: 'Quality', theme: 'Theme', uiLocale: 'UI language', contentLocale: 'Content language', light: 'Light', dark: 'Dark', system: 'System', contrast: 'High contrast', chinese: '简体中文', english: 'English', recovery: 'Your local draft is kept for recovery.', stale: 'The current version changed or was unpublished.' },
    vocab: { eyebrow: 'VOCABULARY · SRS', title: 'Recall first, then reveal.', description: 'Cards, confidence and scheduling are owned by learning-service; answers stay protected.', reveal: 'Reveal answer', revealing: 'Loading protected answer…', noAnswer: 'No protected definition was returned.', due: 'Next review', rate: 'Confidence', empty: 'No cards are due today', queued: 'This review is queued for sync.', accepted: 'Review recorded.' },
    practice: { eyebrow: 'PRACTICE · RULE-BASED', title: 'Answer one and see the next step.', description: 'The server owns the versioned prompt and score; the client never sends a score or answer key.', loading: 'Creating practice session…', empty: 'The server returned no exercises', next: 'Next', submit: 'Submit answer', complete: 'Open mistakes and report', checkpoint: 'Save checkpoint', restored: 'The previous checkpoint was restored.' },
    report: { eyebrow: 'MASTERY · REPORT', title: 'Turn mistakes into the next step.', mistakes: 'Mistakes and causes', report: 'Learning report', retry: 'Start retry', verify: 'Submit verification', noMistakes: 'No mistakes need repair', noReport: 'No report is available yet', ready: 'Report ready', partial: 'Report is partial; retry later', reason: 'Rule evidence' },
    grammar: { eyebrow: 'GRAMMAR · X-RAY', title: 'Turn long sentences into practice structures.', tree: 'Grammar tree', sentence: 'Sentence X-ray', order: 'Reorder sentence blocks', imitate: 'Imitate by structure slots', correction: 'Proofreading correction', submit: 'Submit rule practice', degraded: 'The graph failed; linear syntax is shown.', noGraph: 'No sentence graph is available.' },
    writing: { eyebrow: 'WRITING · RULE FEEDBACK', title: 'Write, then inspect the rule evidence.', description: 'Feedback comes from versioned rules and source positions; Phase 1 has no AI scoring.', draft: 'Local draft', save: 'Save draft', submit: 'Submit rule evaluation', correction: 'Submit correction', feedback: 'Rule feedback', noPrompt: 'No writing prompt is available', aiOff: 'AI scoring: off (Phase 1)' },
    reading: { eyebrow: 'READING · IMMERSIVE', title: 'Read deeply and leave a reviewable trace.', description: 'Progress is pinned to the article version; lookup/mining failures keep the last saved position.', save: 'Save reading progress', mining: 'Mine expression', mined: 'Added to review signal', translation: 'Show translation', hideTranslation: 'Hide translation', noArticle: 'No authorized article is available', question: 'Comprehension check', submit: 'Submit answer' },
  },
})

export const b10UiLocale = ref(mobileI18n.locale)
export const b10ContentLocale = ref(mobileI18n.contentLocale)
export const b10ThemeMode = ref<ThemeMode>(mobileThemeController.theme)

mobileI18n.subscribe((state) => {
  b10UiLocale.value = state.locale
  b10ContentLocale.value = state.contentLocale
})
mobileThemeController.subscribe((state) => { b10ThemeMode.value = state.theme })

export function b10T(key: string, values?: Record<string, unknown>): string {
  b10UiLocale.value
  return mobileI18n.t(`b10.${key}`, values)
}

export function setB10ContentLocale(locale: string): void {
  mobileI18n.setContentLocale(locale)
}

export function setB10ThemeMode(mode: ThemeMode): void {
  mobileThemeController.setTheme(mode)
}
