import { ref } from 'vue'
import { mobileI18n, mobileThemeController } from './v2-foundation'
import type { ThemeMode } from '@englishflow/design-tokens'

mobileI18n.registerMessages('zh-CN', {
  b11: {
    status: { idle: '等待媒体与学习服务', loading: '正在读取服务端内容', ready: '内容已就绪', empty: '当前没有可用内容', offline: '网络暂时不可用', forbidden: '当前会话没有访问权限', expired: '播放授权已过期', recovering: '正在保留本地进度', error: '服务暂时不可用', retry: '重试', sync: '恢复同步', motionOn: '开启动效', motionOff: '关闭动效' },
    listening: { eyebrow: 'B11 · LISTENING', title: '听清时间线，再完成同步练习。', description: '播放、速度、A-B、Language Clips、字幕和题目同步由媒体清单与内容版本控制。', play: '播放', pause: '暂停', setA: '设为 A 点', setB: '设为 B 点', clearAB: '清除 A-B', clip: 'Language Clips', dictation: '听写答案', submit: '提交听写', position: '播放进度', noMedia: '当前内容没有授权播放地址；保留字幕与练习，未伪造音频。', revoked: '媒体权益已撤销，不能继续播放。' },
    reading: { eyebrow: 'B11 · GRADED READING', title: '读懂一段，保留可恢复的进度。', description: '文章版本、阅读位置、理解题和离线恢复由服务端确认；错误不会覆盖最后位置。', save: '保存进度', next: '下一段', question: '理解检查', submit: '提交答案', noArticle: '暂时没有可用的授权文章。' },
    speaking: { eyebrow: 'B11 · PHONETICS / SHADOWING', title: '先获得麦克风许可，再听回自己的练习。', description: 'Phase 1 只有音标、影子跟读、真实录音与自评；不调用 ASR、不生成 AI 分数、不接入数字人。', permission: '请求麦克风权限', start: '开始录音', stop: '停止录音', playback: '本地回放', retake: '重新录音', save: '加密并登记', rating: '自评', noPermission: '未获得麦克风权限仍可学习音标与跟读脚本。', localOnly: '录音只保留在设备安全存储，服务端尚未确认。', aiOff: 'AI 评分：关闭（Phase 1）' },
    common: { contentVersion: '内容版本', offline: '离线草稿已保留', pending: '待同步不等于已结算', storageFull: '本机空间不足，未丢弃已保存内容', recovery: '联网后可恢复未确认操作', noSample: '没有使用本地样例伪造结果' },
  },
})

mobileI18n.registerMessages('en-US', {
  b11: {
    status: { idle: 'Waiting for media and learning services', loading: 'Loading server content', ready: 'Content is ready', empty: 'No content is available', offline: 'Network is unavailable', forbidden: 'This session is not allowed', expired: 'Playback authorization expired', recovering: 'Keeping local progress', error: 'Service is unavailable', retry: 'Retry', sync: 'Recover sync', motionOn: 'Enable motion', motionOff: 'Disable motion' },
    listening: { eyebrow: 'B11 · LISTENING', title: 'Follow the timeline and complete the synced practice.', description: 'Playback, speed, A-B, Language Clips, subtitles and questions are bound to the media manifest and content version.', play: 'Play', pause: 'Pause', setA: 'Set A', setB: 'Set B', clearAB: 'Clear A-B', clip: 'Language Clips', dictation: 'Dictation answer', submit: 'Submit dictation', position: 'Playback position', noMedia: 'No authorized playback URL; subtitles and practice remain available.', revoked: 'Media rights were revoked; playback is disabled.' },
    reading: { eyebrow: 'B11 · GRADED READING', title: 'Read a block and keep recoverable progress.', description: 'Article version, reading position, comprehension and offline recovery are server-confirmed.', save: 'Save progress', next: 'Next block', question: 'Comprehension', submit: 'Submit answer', noArticle: 'No authorized article is available.' },
    speaking: { eyebrow: 'B11 · PHONETICS / SHADOWING', title: 'Grant microphone permission, then listen to your practice.', description: 'Phase 1 provides phonetics, shadowing, recordings and self-rating only; no ASR, AI score or digital human.', permission: 'Request microphone permission', start: 'Start recording', stop: 'Stop recording', playback: 'Local playback', retake: 'Retake', save: 'Encrypt and register', rating: 'Self-rating', noPermission: 'You can still learn phonetics and shadowing without microphone access.', localOnly: 'The recording stays in secure device storage until the server confirms it.', aiOff: 'AI scoring: off (Phase 1)' },
    common: { contentVersion: 'Content version', offline: 'Offline draft retained', pending: 'Pending does not mean settled', storageFull: 'Local storage is full; saved content was retained', recovery: 'Unconfirmed actions can recover when online', noSample: 'No local sample was used to fake a result' },
  },
})

export const b11UiLocale = ref(mobileI18n.locale)
export const b11ContentLocale = ref(mobileI18n.contentLocale)
export const b11ThemeMode = ref<ThemeMode>(mobileThemeController.theme)
mobileI18n.subscribe((state) => { b11UiLocale.value = state.locale; b11ContentLocale.value = state.contentLocale })
mobileThemeController.subscribe((state) => { b11ThemeMode.value = state.theme })

export function b11T(key: string, values?: Record<string, unknown>): string {
  b11UiLocale.value
  return mobileI18n.t(`b11.${key}`, values)
}
