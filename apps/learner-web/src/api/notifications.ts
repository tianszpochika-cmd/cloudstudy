import { apiClient } from './client'
import { createClientId } from '../platform/client-id'
import type { M1016NotificationPreference as ContractNotificationPreference, M1016NotificationPreferenceCommand } from '@englishflow/contracts'

/** P1R decision 1A: message-center reads/writes (M6-001). Owner projections only. */

export type NotificationPreference = ContractNotificationPreference
export type NotificationCategory = M1016NotificationPreferenceCommand['category']
export type NotificationChannel = NotificationPreference['channel']
export type NotificationDndWindow = M1016NotificationPreferenceCommand['dndWindow']

export interface NotificationCategoryOption {
  code: NotificationCategory
  labelKey: string
  smsType?: string
}

export const NOTIFICATION_CATEGORIES: readonly NotificationCategoryOption[] = [
  { code: 'LEARNING', labelKey: 'experience.notificationPreferences.categories.learning' },
  { code: 'REVIEW', labelKey: 'experience.notificationPreferences.categories.review' },
  { code: 'STREAK', labelKey: 'experience.notificationPreferences.categories.streak' },
  { code: 'EXAM', labelKey: 'experience.notificationPreferences.categories.exam' },
  { code: 'CHECKPOINT', labelKey: 'experience.notificationPreferences.categories.checkpoint' },
  { code: 'STUDY_ROOM', labelKey: 'experience.notificationPreferences.categories.studyRoom' },
  { code: 'REWARDS', labelKey: 'experience.notificationPreferences.categories.rewards' },
  { code: 'COURSE', labelKey: 'experience.notificationPreferences.categories.course' },
  { code: 'MEMBERSHIP', labelKey: 'experience.notificationPreferences.categories.membership' },
  { code: 'MARKETING', labelKey: 'experience.notificationPreferences.categories.marketing' },
  { code: 'SECURITY', labelKey: 'experience.notificationPreferences.categories.security', smsType: 'SECURITY_ALERT' },
  { code: 'ACCOUNT', labelKey: 'experience.notificationPreferences.categories.account', smsType: 'ACCOUNT_VERIFICATION' },
  { code: 'PAYMENT', labelKey: 'experience.notificationPreferences.categories.payment', smsType: 'CRITICAL_ACCOUNT_PAYMENT' },
  { code: 'SYSTEM', labelKey: 'experience.notificationPreferences.categories.system' },
] as const

export const NOTIFICATION_CHANNELS: readonly { code: NotificationChannel; labelKey: string }[] = [
  { code: 'IN_APP', labelKey: 'experience.notificationPreferences.channels.inApp' },
  { code: 'PUSH', labelKey: 'experience.notificationPreferences.channels.push' },
  { code: 'EMAIL', labelKey: 'experience.notificationPreferences.channels.email' },
  { code: 'SMS', labelKey: 'experience.notificationPreferences.channels.sms' },
] as const

export const NO_DND_WINDOW: NotificationDndWindow = { startLocalTime: '00:00', endLocalTime: '00:00' }
export const DEFAULT_DND_WINDOW: NotificationDndWindow = { startLocalTime: '22:00', endLocalTime: '07:00' }

export interface UpdateNotificationPreferenceInput {
  category: NotificationCategory
  channel: NotificationChannel
  enabled: boolean
  existing?: NotificationPreference | null
  dndWindow?: NotificationDndWindow
  frequencyPolicy?: NotificationPreference['frequencyPolicy']
}

export interface InboxMessage {
  messageId: string
  title: string | null
  safeBody: string | null
  channel: string | null
  createdAt: string | null
  read: boolean
}

function isNotificationCategory(value: unknown): value is NotificationCategory {
  return NOTIFICATION_CATEGORIES.some((category) => category.code === value)
}

function isNotificationChannel(value: unknown): value is NotificationChannel {
  return NOTIFICATION_CHANNELS.some((channel) => channel.code === value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function unwrap(value: unknown): unknown {
  if (!isRecord(value)) return value
  return 'data' in value ? value.data : value
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value : fallback
}

function listOf(value: unknown): unknown[] {
  const data = unwrap(value)
  if (Array.isArray(data)) return data
  if (isRecord(data) && Array.isArray(data.items)) return data.items as unknown[]
  return []
}

function parseNotificationPreference(value: unknown): NotificationPreference {
  if (!isRecord(value) || !isNotificationCategory(value.category) || !isNotificationChannel(value.channel)
    || typeof value.enabled !== 'boolean' || value.locale !== 'zh-CN'
    || !Number.isSafeInteger(value.consentVersion) || Number(value.consentVersion) < 1
    || !Number.isSafeInteger(value.version) || Number(value.version) < 1
    || typeof value.updatedAt !== 'string' || !isRecord(value.dndWindow)
    || typeof value.dndWindow.startLocalTime !== 'string' || typeof value.dndWindow.endLocalTime !== 'string'
    || typeof value.dndWindow.timezone !== 'string'
    || !['IMMEDIATE', 'DAILY_DIGEST', 'WEEKLY_DIGEST', 'DISABLED'].includes(String(value.frequencyPolicy))) {
    throw new Error('notification preference response is invalid')
  }
  return value as unknown as NotificationPreference
}

export async function listNotificationPreferences(): Promise<NotificationPreference[]> {
  const rows: NotificationPreference[] = []
  const cursors = new Set<string>()
  let cursor: string | null = null

  for (let page = 0; page < 1000; page += 1) {
    const query = new URLSearchParams({ pageSize: '100' })
    if (cursor) query.set('cursor', cursor)
    const raw = await apiClient.get<unknown>(`/notifications/preferences?${query.toString()}`)
    if (!isRecord(raw) || !Array.isArray(raw.data) || !isRecord(raw.meta)) {
      throw new Error('notification preference page is invalid')
    }
    if (typeof raw.meta.hasMore !== 'boolean') throw new Error('notification preference page metadata is invalid')
    rows.push(...raw.data.map(parseNotificationPreference))
    if (!raw.meta.hasMore) {
      if (raw.meta.nextCursor !== null && raw.meta.nextCursor !== undefined) {
        throw new Error('notification preference cursor does not match page metadata')
      }
      return rows
    }
    const nextCursor = text(raw.meta.nextCursor)
    if (!nextCursor || cursors.has(nextCursor)) throw new Error('notification preference cursor is invalid')
    cursors.add(nextCursor)
    cursor = nextCursor
  }
  throw new Error('notification preference pagination limit exceeded')
}

export async function setNotificationPreference(input: UpdateNotificationPreferenceInput): Promise<NotificationPreference> {
  const category = NOTIFICATION_CATEGORIES.find((item) => item.code === input.category)
  if (!category || (input.channel === 'SMS' && !category.smsType)) {
    throw new Error('notification category is not available for this channel')
  }
  const notificationType = input.channel === 'SMS' ? category.smsType! : input.category
  const expectedVersion = input.existing?.version ?? 0
  const frequencyPolicy = input.frequencyPolicy ?? (input.enabled ? 'IMMEDIATE' : 'DISABLED')
  const existingWindow = input.existing?.dndWindow
  const command: M1016NotificationPreferenceCommand = {
    category: input.category,
    enabled: input.enabled,
    locale: 'zh-CN',
    // This is required preference metadata only. It does not record or prove user consent.
    consentVersion: input.existing?.consentVersion ?? 1,
    dndWindow: input.dndWindow ?? (existingWindow
      ? { startLocalTime: existingWindow.startLocalTime, endLocalTime: existingWindow.endLocalTime }
      : NO_DND_WINDOW),
    frequencyPolicy,
    expectedVersion,
  }
  const raw = await apiClient.put<unknown>(
    `/notifications/preferences/${encodeURIComponent(notificationType)}/${encodeURIComponent(input.channel)}`,
    command,
    { headers: { 'Idempotency-Key': createClientId('notif-pref') } },
  )
  return parseNotificationPreference(unwrap(raw))
}

export async function listInboxMessages(): Promise<InboxMessage[]> {
  const rows = listOf(await apiClient.get<unknown>('/notifications/messages'))
  return rows.filter(isRecord).map((row) => ({
    messageId: text(row.messageId),
    title: typeof row.title === 'string' ? row.title : null,
    safeBody: typeof row.safeBody === 'string' ? row.safeBody : null,
    channel: typeof row.channel === 'string' ? row.channel : null,
    createdAt: typeof row.createdAt === 'string' ? row.createdAt : null,
    read: row.read === true,
  })).filter((m) => m.messageId !== '')
}

export async function markMessageRead(messageId: string): Promise<void> {
  await apiClient.put<unknown>(
    `/notifications/messages/${encodeURIComponent(messageId)}/read`,
    {},
    { headers: { 'Idempotency-Key': createClientId('notif-read') } },
  )
}

export async function markAllMessagesRead(): Promise<void> {
  await apiClient.put<unknown>(
    '/notifications/messages/read-all',
    {},
    { headers: { 'Idempotency-Key': createClientId('notif-read-all') } },
  )
}
