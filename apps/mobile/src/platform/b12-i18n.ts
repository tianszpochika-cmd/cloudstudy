import { ref } from 'vue'
import { mobileI18n } from './v2-foundation'

const zh = {
  status: { loading: '正在读取服务端状态…', success: '服务端已确认', error: '操作未完成', empty: '当前没有可展示数据', permission: '当前会话没有访问权限', offline: '网络不可用，待同步状态已保留', recovery: '需要恢复服务端状态后再继续', retry: '重试' },
  rewards: { title: '学习奖励箱', freeNotice: '仅展示学习获得的免费、非现金奖励；不支持购买、交易、提现或客户端抽取。', probability: '查看概率', open: '开启奖励箱', opening: '正在向服务端请求开启…', granted: '待开启', opened: '已开启', empty: '当前没有待开启奖励箱。', noProbability: '服务端暂未返回概率快照。', tier: '档位', duplicate: '重复奖励已按服务端规则转换', audit: '审计号', rule: '概率版本', confirmed: '开启结果已由服务端确认。' },
  social: { leaderboard: '房间排行榜', loadLeaderboard: '查看排行榜', loadingLeaderboard: '正在读取排行榜…', emptyLeaderboard: '当前房间暂无可展示的专注快照。', privacy: '排行榜只展示服务端允许的脱敏标识，不接收用户编号输入。', focusSeconds: '有效专注', report: '举报此成员', reportReason: '举报原因', submitReport: '提交预设举报', submittingReport: '正在提交举报…', reportReceived: '举报已进入服务端审核队列。', noSelfReport: '不能举报自己。' },
  notifications: { preferences: '通知偏好', room: '房间互动', focus: '专注提醒', system: '系统通知', dnd: '免打扰', saved: '通知偏好已由服务端确认。' },
}
const en = {
  status: { loading: 'Loading server state…', success: 'Confirmed by server', error: 'The action did not complete', empty: 'Nothing is available to display', permission: 'This session cannot access the resource', offline: 'Offline; pending state is preserved', recovery: 'Recover the server state before continuing', retry: 'Retry' },
  rewards: { title: 'Learning reward chests', freeNotice: 'Only free, non-cash learning rewards are shown; no purchase, trading, withdrawal, or client-side draw is supported.', probability: 'View probability', open: 'Open chest', opening: 'Requesting the server to open…', granted: 'Ready to open', opened: 'Opened', empty: 'There are no reward chests to open.', noProbability: 'The server has not returned a probability snapshot.', tier: 'Tier', duplicate: 'Duplicate reward was converted by the server rule', audit: 'Audit', rule: 'Probability version', confirmed: 'The opening result was confirmed by the server.' },
  social: { leaderboard: 'Room leaderboard', loadLeaderboard: 'View leaderboard', loadingLeaderboard: 'Loading leaderboard…', emptyLeaderboard: 'No focus snapshot is available for this room.', privacy: 'Only server-approved de-identified references are shown; no user identifier is entered here.', focusSeconds: 'Valid focus', report: 'Report member', reportReason: 'Report reason', submitReport: 'Submit preset report', submittingReport: 'Submitting report…', reportReceived: 'The report entered the server review queue.', noSelfReport: 'You cannot report yourself.' },
  notifications: { preferences: 'Notification preferences', room: 'Room interactions', focus: 'Focus reminders', system: 'System notifications', dnd: 'Do not disturb', saved: 'Notification preferences confirmed by the server.' },
}

mobileI18n.registerMessages('zh-CN', { b12: zh })
mobileI18n.registerMessages('en-US', { b12: en })
export const b12UiLocale = ref(mobileI18n.locale)
mobileI18n.subscribe((state) => { b12UiLocale.value = state.locale })
export function b12T(key: string, values?: Record<string, unknown>): string { b12UiLocale.value; return mobileI18n.t(`b12.${key}`, values) }
