import { learnerI18n } from './v2-foundation'

learnerI18n.registerMessages('zh-CN', {
  b10: {
    state: { loading: '正在读取服务端学习数据…', empty: '当前没有可用的已发布内容。', offline: '网络暂时不可用，已保留最近一次安全快照。', error: '服务暂时不可用。', forbidden: '当前账号没有访问这项学习数据的权限。', stale: '内容版本已失效或已下线。', recovering: '正在保存并恢复当前学习状态…', cached: '当前显示的是本地安全快照。', queued: '待同步不等于已掌握。', ready: '服务端数据已就绪。' },
    common: { retry: '重新读取', sync: '同步队列', ui: '界面', content: '内容', performance: '性能档位：{{level}}', version: '内容版本：{{version}}', noAnswerRule: '答案规则仅在服务端判定，学习端不保存答案规则。', backHome: '返回学习首页' },
    vocabulary: { title: '词汇与 SRS', recall: '先回忆，再揭晓', reveal: '显示内容', revealing: '正在读取内容…', frontOnly: '正面不展示释义或标准答案。', confidence: '选择信心度', forgotten: '忘了', vague: '模糊', remembered: '记得', fluent: '很熟', complete: '本批次已完成。', pending: '本次复习已排队，服务端确认后才会更新掌握度。', empty: '今天没有到期复习。', recovery: '刷新服务端批次后继续。' },
    practice: { title: '基础练习', progress: '第 {{current}} / {{total}} 题', submit: '提交答案', next: '下一题', checkpoint: '保存断点', draft: '当前答案已保存在本地草稿。', noQuestions: '当前练习没有题目。' },
    reading: { title: '分级阅读', progress: '{{percent}}% 已保存', lookup: '查词', mine: '加入表达复习', mined: '已加入表达复习', save: '保存进度', quiz: '理解检查', quizSubmit: '提交答案', noArticle: '暂时没有可阅读内容。', fallback: '结构化内容不可用，已退回文本阅读。' },
    grammar: { title: '语法树与长难句', tree: '语法知识树', xray: '长难句 X 光机', linear: '线性结构模式', previous: '上移', next: '下移', checkOrder: '检查顺序', imitation: '结构仿写', imitationSubmit: '检查仿写', practice: '规则练习', submit: '提交练习', noTree: '暂时没有可用的语法知识点。' },
    writing: { title: '规则写作反馈', draft: '你的草稿', autoSaved: '本地自动保存', submit: '提交规则评测', submitting: '正在提交…', proofreading: '病句改错', proofreadingSubmit: '提交改错', feedback: '服务端规则反馈', history: '历史反馈', noPrompt: '暂时没有可用的写作题目。', noAi: 'Phase 1 仅使用规则反馈，不引入 AI 评分。' },
    report: { title: '错题与学习报告', daily: '日报', weekly: '周报', generated: '生成于 {{date}}', weakness: '薄弱项与修复路径', noWeakness: '服务端没有返回薄弱项证据。', noReport: '服务端尚未返回报告快照。' },
  },
})

learnerI18n.registerMessages('en-US', {
  b10: {
    state: { loading: 'Loading learning data…', empty: 'No published learning content is available.', offline: 'The network is unavailable. The last safe snapshot is still available.', error: 'The service is temporarily unavailable.', forbidden: 'This account is not allowed to read this learning data.', stale: 'The content version is stale or withdrawn.', recovering: 'Saving and recovering the current learning state…', cached: 'Showing the local safe snapshot.', queued: 'Queued does not mean mastered.', ready: 'Server data is ready.' },
    common: { retry: 'Reload', sync: 'Sync queue', ui: 'UI', content: 'Content', performance: 'Performance: {{level}}', version: 'Content version: {{version}}', noAnswerRule: 'Answer rules stay server-side; the learner app never stores them.', backHome: 'Back to Home' },
    vocabulary: { title: 'Vocabulary & SRS', recall: 'Recall first, then reveal', reveal: 'Reveal content', revealing: 'Loading content…', frontOnly: 'The front never shows meanings or answer keys.', confidence: 'Choose confidence', forgotten: 'Forgot', vague: 'Vague', remembered: 'Remembered', fluent: 'Fluent', complete: 'This batch is complete.', pending: 'This review is queued until the server confirms mastery.', empty: 'There are no reviews due today.', recovery: 'Reload the server batch to continue.' },
    practice: { title: 'Basic practice', progress: 'Question {{current}} / {{total}}', submit: 'Submit answer', next: 'Next question', checkpoint: 'Save checkpoint', draft: 'The current answer is kept in a local draft.', noQuestions: 'This practice session has no questions.' },
    reading: { title: 'Graded reading', progress: '{{percent}}% saved', lookup: 'Look up', mine: 'Add expression review', mined: 'Added to expression review', save: 'Save progress', quiz: 'Comprehension check', quizSubmit: 'Submit answer', noArticle: 'No reading content is available.', fallback: 'Structured content is unavailable; text reading remains available.' },
    grammar: { title: 'Grammar tree & long sentences', tree: 'Grammar knowledge tree', xray: 'Long-sentence X-ray', linear: 'Linear structure mode', previous: 'Move up', next: 'Move down', checkOrder: 'Check order', imitation: 'Structure imitation', imitationSubmit: 'Check imitation', practice: 'Rule-based practice', submit: 'Submit practice', noTree: 'No grammar points are available.' },
    writing: { title: 'Rule-based writing feedback', draft: 'Your draft', autoSaved: 'Auto-saved locally', submit: 'Submit ruled evaluation', submitting: 'Submitting…', proofreading: 'Proofreading', proofreadingSubmit: 'Submit correction', feedback: 'Server rule feedback', history: 'Feedback history', noPrompt: 'No writing prompt is available.', noAi: 'Phase 1 uses rules only; no AI scoring is introduced.' },
    report: { title: 'Mistakes & learning report', daily: 'Daily', weekly: 'Weekly', generated: 'Generated {{date}}', weakness: 'Weaknesses & repair path', noWeakness: 'The server returned no weakness evidence.', noReport: 'The server has not returned a report snapshot.' },
  },
})
