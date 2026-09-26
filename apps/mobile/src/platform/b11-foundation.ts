import { ref } from 'vue'
import { mobileI18n, mobileThemeController } from './v2-foundation'
import type { ThemeMode } from '@englishflow/design-tokens'

mobileI18n.registerMessages('zh-CN', {
  b11: {
    status: { idle: '正在准备内容', loading: '正在加载内容', ready: '内容已就绪', empty: '当前没有可用内容', offline: '暂时无法连接服务', forbidden: '当前会话没有访问权限', expired: '播放授权已过期', recovering: '正在保留本地进度', error: '服务暂时不可用', retry: '重试', sync: '恢复同步', quality: '画质', qualityUltra: '精致', qualityHigh: '舒适', qualityMedium: '轻量', qualityPerformance: '省资源', motionOn: '开启动效', motionOff: '关闭动效' },
    listening: { eyebrow: 'B11 · LISTENING', title: '听清时间线，再完成同步练习。', description: '播放、速度、A-B、Language Clips、字幕和题目同步由媒体清单与内容版本控制。', play: '播放', pause: '暂停', setA: '设为 A 点', setB: '设为 B 点', clearAB: '清除 A-B', clip: 'Language Clips', dictation: '听写答案', submit: '提交听写', position: '播放进度', noMedia: '当前内容没有授权播放地址；保留字幕与练习，未伪造音频。', revoked: '媒体权益已撤销，不能继续播放。' },
    reading: { eyebrow: 'B11 · GRADED READING', title: '读懂一段，保留可恢复的进度。', description: '文章版本、阅读位置、理解题和离线恢复由服务端确认；错误不会覆盖最后位置。', save: '保存进度', next: '下一段', question: '理解检查', submit: '提交答案', noArticle: '暂时没有可用的授权文章。' },
    speaking: { eyebrow: 'B11 · PHONETICS / SHADOWING', title: '先获得麦克风许可，再听回自己的练习。', description: '听示范、跟读、录音回放，再为自己做一次评价。', permission: '请求麦克风权限', start: '开始录音', stop: '停止录音', playback: '本地回放', retake: '重新录音', save: '保存练习记录', rating: '自评', noPermission: '无需麦克风也能学习音标。', localOnly: '录音已保存在此设备，练习记录尚未保存。', aiOff: '练习方式：回听与自评' },
    common: { contentVersion: '内容版本', offline: '离线草稿已保留', pending: '待同步', storageFull: '本机空间不足，未丢弃已保存内容', recovery: '联网后可重试。', noSample: '内容准备好后会在这里显示' },
  },
})

mobileI18n.registerMessages('en-US', {
  b11: {
    status: { idle: 'Waiting for media and learning services', loading: 'Loading server content', ready: 'Content is ready', empty: 'No content is available', offline: 'Unable to connect', forbidden: 'This session is not allowed', expired: 'Playback authorization expired', recovering: 'Keeping local progress', error: 'Service is unavailable', retry: 'Retry', sync: 'Recover sync', quality: 'Quality', qualityUltra: 'Detailed', qualityHigh: 'Balanced', qualityMedium: 'Light', qualityPerformance: 'Efficient', motionOn: 'Enable motion', motionOff: 'Disable motion' },
    listening: { eyebrow: 'B11 · LISTENING', title: 'Follow the timeline and complete the synced practice.', description: 'Playback, speed, A-B, Language Clips, subtitles and questions are bound to the media manifest and content version.', play: 'Play', pause: 'Pause', setA: 'Set A', setB: 'Set B', clearAB: 'Clear A-B', clip: 'Language Clips', dictation: 'Dictation answer', submit: 'Submit dictation', position: 'Playback position', noMedia: 'No authorized playback URL; subtitles and practice remain available.', revoked: 'Media rights were revoked; playback is disabled.' },
    reading: { eyebrow: 'B11 · GRADED READING', title: 'Read a block and keep recoverable progress.', description: 'Article version, reading position, comprehension and offline recovery are server-confirmed.', save: 'Save progress', next: 'Next block', question: 'Comprehension', submit: 'Submit answer', noArticle: 'No authorized article is available.' },
    speaking: { eyebrow: 'B11 · PHONETICS / SHADOWING', title: 'Listen, speak, and hear yourself again.', description: 'Follow a sample, replay your recording, then rate your practice.', permission: 'Allow microphone', start: 'Start recording', stop: 'Stop recording', playback: 'Replay', retake: 'Retake', save: 'Save practice', rating: 'Self-rating', noPermission: 'You can still learn phonetics without a microphone.', localOnly: 'Recording saved on this device; practice is not saved yet.', aiOff: 'Practice: replay and self-rating' },
    common: { contentVersion: 'Content version', offline: 'Offline draft retained', pending: 'Pending sync', storageFull: 'Local storage is full; saved content was retained', recovery: 'Retry when connected.', noSample: 'Content will appear here when available' },
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
