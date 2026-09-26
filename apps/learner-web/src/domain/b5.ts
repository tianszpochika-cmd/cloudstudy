export interface B5PublicPlan {
  planId: string
  skuId: string
  title: string
  billingPeriod: 'FREE' | 'MONTH' | 'QUARTER' | 'YEAR' | 'PERPETUAL'
  amountMinor: number
  currency: string
  priceSnapshotId: string
  availability: 'PUBLISHED' | 'COMING_SOON' | 'UNAVAILABLE'
}

export interface B5Order {
  orderId: string
  skuId: string
  channelCode: string
  amountMinor: number
  currency: string
  status: string
  createdAt: string
  paidAt: string
}

export interface B5Entitlement {
  entitlementCode: string
  sourceType: string
  sourceRef: string
  status: string
  activeFrom: string
  expiresAt: string
  amountMinor: number
  reasonCode: string
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function unwrapB5(value: unknown): unknown {
  if (!isRecord(value)) return value
  return 'data' in value ? value.data : value
}

export function listRecords(value: unknown, key = 'items'): Array<Record<string, unknown>> {
  const source = unwrapB5(value)
  if (Array.isArray(source)) return source.filter(isRecord)
  if (!isRecord(source) || !Array.isArray(source[key])) return []
  return source[key].filter(isRecord)
}

export function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

export function numberValue(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export function toPublicPlan(value: Record<string, unknown>): B5PublicPlan | null {
  const periods = ['FREE', 'MONTH', 'QUARTER', 'YEAR', 'PERPETUAL']
  const availability = ['PUBLISHED', 'COMING_SOON', 'UNAVAILABLE']
  if (typeof value.planId !== 'string' || !value.planId || typeof value.skuId !== 'string' || !value.skuId
    || typeof value.title !== 'string' || !value.title || typeof value.billingPeriod !== 'string' || !periods.includes(value.billingPeriod)
    || typeof value.currency !== 'string' || !/^[A-Z]{3}$/.test(value.currency)
    || typeof value.priceSnapshotId !== 'string' || !value.priceSnapshotId
    || typeof value.amountMinor !== 'number' || !Number.isInteger(value.amountMinor) || value.amountMinor < 0
    || typeof value.availability !== 'string' || !availability.includes(value.availability)) return null
  return {
    planId: value.planId,
    skuId: value.skuId,
    title: value.title,
    billingPeriod: value.billingPeriod as B5PublicPlan['billingPeriod'],
    amountMinor: value.amountMinor,
    currency: value.currency,
    priceSnapshotId: value.priceSnapshotId,
    availability: value.availability as B5PublicPlan['availability'],
  }
}

export function toOrder(value: Record<string, unknown>): B5Order {
  return {
    orderId: stringValue(value.orderId),
    skuId: stringValue(value.skuId),
    channelCode: stringValue(value.channelCode),
    amountMinor: numberValue(value.amountMinor),
    currency: stringValue(value.currency, 'CNY'),
    status: stringValue(value.status),
    createdAt: stringValue(value.createdAt),
    paidAt: stringValue(value.paidAt),
  }
}

export function toEntitlement(value: Record<string, unknown>): B5Entitlement {
  return {
    entitlementCode: stringValue(value.entitlementCode),
    sourceType: stringValue(value.sourceType),
    sourceRef: stringValue(value.sourceRef),
    status: stringValue(value.status),
    activeFrom: stringValue(value.activeFrom),
    expiresAt: stringValue(value.expiresAt),
    amountMinor: numberValue(value.amountMinor),
    reasonCode: stringValue(value.reasonCode),
  }
}

export function formatMinorAmount(amountMinor: number, currency = 'CNY'): string {
  return currency === 'CNY' ? `¥${(amountMinor / 100).toFixed(2)}` : `${currency} ${(amountMinor / 100).toFixed(2)}`
}
