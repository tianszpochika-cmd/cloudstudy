import type { M1016NotificationPreference, M1016NotificationPreferenceCommand } from '@englishflow/contracts'

export const NOTIFICATION_CATEGORIES = [
  { category: 'LEARNING', label: '学习进度' },
  { category: 'REVIEW', label: '复习提醒' },
  { category: 'STREAK', label: '连续学习' },
  { category: 'EXAM', label: '考试安排' },
  { category: 'CHECKPOINT', label: '学习检查点' },
  { category: 'STUDY_ROOM', label: '自习室互动' },
  { category: 'REWARDS', label: '奖励动态' },
  { category: 'COURSE', label: '课程更新' },
  { category: 'MEMBERSHIP', label: '会员服务' },
  { category: 'MARKETING', label: '活动资讯' },
  { category: 'SECURITY', label: '安全提醒' },
  { category: 'ACCOUNT', label: '账户通知' },
  { category: 'PAYMENT', label: '支付与订单' },
  { category: 'SYSTEM', label: '系统消息' },
] as const satisfies ReadonlyArray<{ category: M1016NotificationPreference['category']; label: string }>

export type NotificationCategory = M1016NotificationPreference['category']
export type NotificationChannel = M1016NotificationPreference['channel']
export type NotificationDndWindowCommand = M1016NotificationPreferenceCommand['dndWindow']
export type NotificationPreferencePage = {
  data: ReadonlyArray<M1016NotificationPreference>
  meta: { hasMore: boolean; nextCursor?: string | null }
}

export const NOTIFICATION_DND_OFF: NotificationDndWindowCommand = { startLocalTime: '00:00', endLocalTime: '00:00' }
export const DEFAULT_NOTIFICATION_DND_WINDOW: NotificationDndWindowCommand = { startLocalTime: '22:00', endLocalTime: '07:00' }

/** Equal endpoints are the server-defined disabled value; never infer it from an arbitrary interval. */
export function isNotificationDndEnabled(window: Pick<NotificationDndWindowCommand, 'startLocalTime' | 'endLocalTime'>): boolean {
  return window.startLocalTime !== window.endLocalTime
}

/** A refresh after a lost response can confirm that the owner committed this exact desired state. */
export function notificationPreferenceMatchesCommand(
  preference: M1016NotificationPreference | undefined,
  command: M1016NotificationPreferenceCommand,
): boolean {
  return Boolean(preference
    && preference.category === command.category
    && preference.enabled === command.enabled
    && preference.locale === command.locale
    && preference.consentVersion === command.consentVersion
    && preference.frequencyPolicy === command.frequencyPolicy
    && preference.dndWindow.startLocalTime === command.dndWindow.startLocalTime
    && preference.dndWindow.endLocalTime === command.dndWindow.endLocalTime)
}

export async function readAllNotificationPreferencePages(
  fetchPage: (cursor: string | null) => Promise<NotificationPreferencePage>,
): Promise<M1016NotificationPreference[]> {
  const rows: M1016NotificationPreference[] = []
  const seenCursors = new Set<string>()
  let cursor: string | null = null
  for (let pageNumber = 0; pageNumber < 10; pageNumber += 1) {
    const page = await fetchPage(cursor)
    if (!Array.isArray(page.data) || !page.meta || typeof page.meta.hasMore !== 'boolean') {
      throw new Error('通知偏好响应格式无效。')
    }
    rows.push(...page.data)
    if (!page.meta.hasMore) return rows
    const nextCursor = page.meta.nextCursor
    if (typeof nextCursor !== 'string' || !nextCursor || seenCursors.has(nextCursor)) {
      throw new Error('通知偏好分页游标无效。')
    }
    seenCursors.add(nextCursor)
    cursor = nextCursor
  }
  throw new Error('通知偏好分页超出允许范围。')
}

/** consentVersion is required preference metadata; it does not record or grant legal consent. */
export function makeNotificationPreferenceCommand(
  category: NotificationCategory,
  enabled: boolean,
  current?: M1016NotificationPreference,
  dndWindow?: NotificationDndWindowCommand,
  frequencyPolicy?: M1016NotificationPreferenceCommand['frequencyPolicy'],
): M1016NotificationPreferenceCommand {
  const returnedWindow = current?.dndWindow
  return {
    category,
    enabled,
    locale: 'zh-CN',
    consentVersion: current?.consentVersion ?? 1,
    dndWindow: dndWindow ?? (returnedWindow
      ? { startLocalTime: returnedWindow.startLocalTime, endLocalTime: returnedWindow.endLocalTime }
      : NOTIFICATION_DND_OFF),
    frequencyPolicy: frequencyPolicy ?? current?.frequencyPolicy ?? (enabled ? 'IMMEDIATE' : 'DISABLED'),
    expectedVersion: current?.version ?? 0,
  }
}
