export interface MobileB5Sku { skuId: string; title: string; amountMinor: number; currency: string; billingPeriod: string; status: string }
export interface MobileB5PublicPlan { skuId: string; title: string; amountMinor: number; currency: string; availability: string }
export interface MobileB5Order { orderId: string; skuId: string; amountMinor: number; currency: string; status: string; channelCode: string }
export interface MobileB5Entitlement { entitlementCode: string; sourceRef: string; status: string; expiresAt: string }

export function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null }
export function unwrap(value: unknown): unknown { return isRecord(value) && 'data' in value ? value.data : value }
export function listRecords(value: unknown, key = 'items'): Array<Record<string, unknown>> { const source = unwrap(value); if (Array.isArray(source)) return source.filter(isRecord); return isRecord(source) && Array.isArray(source[key]) ? source[key].filter(isRecord) : [] }
export function text(value: unknown, fallback = ''): string { return typeof value === 'string' ? value : fallback }
export function num(value: unknown, fallback = 0): number { return typeof value === 'number' && Number.isFinite(value) ? value : fallback }
export function toSku(value: Record<string, unknown>): MobileB5Sku { return { skuId: text(value.skuId), title: text(value.title), amountMinor: num(value.amountMinor), currency: text(value.currency, 'CNY'), billingPeriod: text(value.billingPeriod), status: text(value.status) } }
export function toPublicPlan(value: Record<string, unknown>): MobileB5PublicPlan { return { skuId: text(value.skuId), title: text(value.title), amountMinor: num(value.amountMinor), currency: text(value.currency, 'CNY'), availability: text(value.availability) } }
export function toOrder(value: Record<string, unknown>): MobileB5Order { return { orderId: text(value.orderId), skuId: text(value.skuId), amountMinor: num(value.amountMinor), currency: text(value.currency, 'CNY'), status: text(value.status), channelCode: text(value.channelCode) } }
export function toEntitlement(value: Record<string, unknown>): MobileB5Entitlement { return { entitlementCode: text(value.entitlementCode), sourceRef: text(value.sourceRef, text(value.entitlementCode)), status: text(value.status), expiresAt: text(value.expiresAt) } }
export function money(amountMinor: number, currency: string): string { return currency === 'CNY' ? `¥${(amountMinor / 100).toFixed(2)}` : `${currency} ${(amountMinor / 100).toFixed(2)}` }
