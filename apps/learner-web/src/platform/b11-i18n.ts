import { learnerI18n } from './v2-foundation'

learnerI18n.registerMessages('zh-CN', {
  b11: {
    common: {
      retry: '重新读取', sync: '同步离线队列', performance: '画质：{{level}}', ui: '界面', content: '内容', phase1: '练习反馈帮助你找到需要巩固的地方。',
      noMedia: '媒体授权地址不可用，仍可继续检查时间轴、字幕和题目。', revoked: '内容版权或媒体授权已撤回。', expired: '播放授权已过期，请重新读取。', offline: '当前离线，已保留本地安全状态。',
    },
    state: { loading: '正在读取…', empty: '当前没有可用内容。', ready: '准备好了，开始吧。', error: '服务暂时不可用。', forbidden: '当前账号无权访问此资源。', permission: '当前账号无权播放音频。', offline: '网络暂时不可用，变更已保留。', revoked: '内容已撤回。', expired: '授权已过期。', recovering: '正在恢复本地学习状态…' },
    listening: {
      title: '听力精练', description: '按句复听，尝试听写。', play: '播放', pause: '暂停', speed: '速度', subtitles: '显示字幕', hideSubtitles: '隐藏字幕', markA: '标记 A', markB: '标记 B', clearAB: '清除 A-B', loop: '循环片段', download: '缓存音频', downloaded: '已缓存', dictation: '听写', answerPlaceholder: '写下你听到的句子', submit: '提交听写', noMaterial: '暂无听力材料。', noClips: '暂无片段。', revoked: '音频授权已撤回。', expired: '音频授权已过期。', mediaUnavailable: '音频暂不可用。', positionSaved: '播放位置已保存。', rightsAvailable: '版权允许', progress: '播放进度', clips: '片段', clipLabel: '片段 {{index}}', playback: '听力播放', textAlternative: '阅读文本', textFallbackHint: '可先阅读文本。', missingText: '暂无可阅读文本。', segmentLabel: '第 {{index}} 句', noSegment: '暂无句子', dictationUnavailable: '听写暂不可用。',
    },
    reading: {
      title: '分级阅读', description: '文章、进度、理解题和内容版本保持一致；离线时保留文本快照并等待服务端确认。', fontSize: '字号', bilingual: '显示译文', hideTranslation: '隐藏译文', next: '下一段', save: '保存进度', quiz: '理解检查', submit: '提交答案', noArticle: '暂时没有可阅读内容。', noQuestions: '当前文章没有理解题。', ruleFeedback: '提交答案后，查看理解反馈。',
    },
    speaking: {
      title: '音标与影子跟读', description: '音标、口型、录音回放、重录和自评在 Phase 1 只保留可解释的规则边界。', permission: '开始录音前才请求麦克风权限。', denied: '麦克风权限未开启，音标学习仍可继续。', start: '开始录音', stop: '停止录音', save: '保存录音', replay: '回放本地副本', retake: '重录', delete: '删除录音', rating: '自我评价', needsPractice: '需要练习', basic: '基本可以', fluent: '很流畅', uncertain: '不确定', localOnly: '本地加密副本已保留，待网络恢复后登记。', saved: '录音已保存。', missing: '本地副本已过期或被清理。', noPhonemes: '暂无音标内容。', noAi: '回放自己的声音，对照示范做一次自我评价。', shadowing: '影子跟读', startShadowing: '开始影子跟读', shadowingSaved: '影子跟读进度已保存。',
    },
  },
})

learnerI18n.registerMessages('en-US', {
  b11: {
    common: {
      retry: 'Reload', sync: 'Sync offline queue', performance: 'Quality: {{level}}', ui: 'UI', content: 'Content', phase1: 'Phase 1 does not enable ASR, digital humans, or AI scoring.',
      noMedia: 'The media authorization is unavailable; timeline, subtitles, and questions remain available.', revoked: 'The content right or media authorization was revoked.', expired: 'The playback authorization expired. Reload to request a new one.', offline: 'You are offline; the local safe state is preserved.',
    },
    state: { loading: 'Loading…', empty: 'No content is available.', ready: 'Server data is ready.', error: 'The service is temporarily unavailable.', forbidden: 'This account cannot access this resource.', permission: 'This account cannot play the audio.', offline: 'The network is unavailable; changes are preserved.', revoked: 'The content was revoked.', expired: 'The authorization expired.', recovering: 'Recovering the local learning state…' },
    listening: {
      title: 'Intensive listening', description: 'Replay a segment, then try dictation.', play: 'Play', pause: 'Pause', speed: 'Speed', subtitles: 'Show subtitles', hideSubtitles: 'Hide subtitles', markA: 'Mark A', markB: 'Mark B', clearAB: 'Clear A-B', loop: 'Loop segment', download: 'Cache audio', downloaded: 'Cached', dictation: 'Dictation', answerPlaceholder: 'Write what you hear', submit: 'Submit dictation', noMaterial: 'No listening material yet.', noClips: 'No clips yet.', revoked: 'Audio access was revoked.', expired: 'Audio access expired.', mediaUnavailable: 'Audio is unavailable.', positionSaved: 'Playback position saved.', rightsAvailable: 'Rights available', progress: 'Playback progress', clips: 'Clips', clipLabel: 'Clip {{index}}', playback: 'Listening', textAlternative: 'Read text', textFallbackHint: 'Read the text for now.', missingText: 'No readable text is available.', segmentLabel: 'Segment {{index}}', noSegment: 'No segment', dictationUnavailable: 'Dictation is unavailable.',
    },
    reading: {
      title: 'Graded reading', description: 'The article, progress, questions, and content version stay aligned; offline text remains available until the server confirms.', fontSize: 'Font size', bilingual: 'Show translation', hideTranslation: 'Hide translation', next: 'Next block', save: 'Save progress', quiz: 'Comprehension check', submit: 'Submit answer', noArticle: 'No reading content is available.', noQuestions: 'This article has no questions.', ruleFeedback: 'Rule feedback comes from the server; the client never guesses answers.',
    },
    speaking: {
      title: 'Phonetics & shadowing', description: 'Phonetics, mouth profiles, local playback, retake, and self-rating stay within explainable Phase 1 rules.', permission: 'Microphone permission is requested only after you start recording.', denied: 'Microphone permission is unavailable; phonetics practice remains available.', start: 'Start recording', stop: 'Stop recording', save: 'Encrypt and register', replay: 'Replay local copy', retake: 'Retake', delete: 'Delete recording', rating: 'Self-rating', needsPractice: 'Needs practice', basic: 'Basic', fluent: 'Fluent', uncertain: 'Uncertain', localOnly: 'The encrypted local copy is preserved and can be registered when online.', saved: 'Recording metadata is registered.', missing: 'The local copy expired or was cleared.', noPhonemes: 'No phonetics content is available.', noAi: 'No AI score, ASR, or digital human is started.', shadowing: 'Shadowing', startShadowing: 'Start shadowing', shadowingSaved: 'Shadowing progress saved.',
    },
  },
})
