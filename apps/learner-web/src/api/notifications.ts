import { apiClient } from './client'
import { createClientId } from '../platform/client-id'

/** P1R decision 1A: message-center reads/writes (M6-001). Owner projections only. */

export interface NotificationPreference {
  notificationType: string
  channel: string
  enabled: boolean
  locale: string | null
}

export interface InboxMessage {
  messageId: string
  title: string | null
  safeBody: string | null
  channel: string | null
  readAt: string | null
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

export async function listNotificationPreferences(): Promise<NotificationPreference[]> {
  const rows = listOf(await apiClient.get<unknown>('/notifications/preferences'))
  return rows.filter(isRecord).map((row) => ({
    notificationType: text(row.notificationType, 'GENERAL'),
    channel: text(row.channel, 'IN_APP'),
    enabled: row.enabled !== false,
    locale: typeof row.locale === 'string' ? row.locale : null,
  }))
}

export async function setNotificationPreference(input: {
  notificationType: string
  channel: string
  enabled: boolean
  locale?: string | null
}): Promise<void> {
  // The server requires a locale on every preference write (proven live:
  // locale-less writes fail closed); default mirrors the onboarding profile.
  await apiClient.put<unknown>(
    `/notifications/preferences/${encodeURIComponent(input.notificationType)}/${encodeURIComponent(input.channel)}`,
    { enabled: input.enabled, locale: input.locale ?? 'zh-CN' },
    { headers: { 'Idempotency-Key': createClientId('notif-pref') } },
  )
}

export async function listInboxMessages(): Promise<InboxMessage[]> {
  const rows = listOf(await apiClient.get<unknown>('/notifications/messages'))
  return rows.filter(isRecord).map((row) => ({
    messageId: text(row.messageId),
    title: typeof row.title === 'string' ? row.title : null,
    safeBody: typeof row.safeBody === 'string' ? row.safeBody : null,
    channel: typeof row.channel === 'string' ? row.channel : null,
    readAt: typeof row.readAt === 'string' ? row.readAt : null,
  })).filter((m) => m.messageId !== '')
}

export async function markMessageRead(messageId: string): Promise<void> {
  await apiClient.post<unknown>(
    `/notifications/messages/${encodeURIComponent(messageId)}/read`,
    {},
    { headers: { 'Idempotency-Key': createClientId('notif-read') } },
  )
}

export async function markAllMessagesRead(): Promise<void> {
  await apiClient.post<unknown>(
    '/notifications/messages/read-all',
    {},
    { headers: { 'Idempotency-Key': createClientId('notif-read-all') } },
  )
}
