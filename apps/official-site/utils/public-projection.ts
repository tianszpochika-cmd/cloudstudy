export const PUBLIC_UI_LOCALES = ['zh-CN', 'en-US'] as const
export type PublicUiLocale = (typeof PUBLIC_UI_LOCALES)[number]
export const PUBLIC_THEME_MODES = ['light', 'dark', 'system', 'high-contrast'] as const
export type PublicThemeMode = (typeof PUBLIC_THEME_MODES)[number]

export interface PublicCourseProjection {
  readonly id: string
  readonly eyebrow: string
  readonly title: string
  readonly description: string
  readonly level: string
  readonly duration: string
  readonly tags: readonly string[]
}

export type PublicAvailability = 'available' | 'coming-soon' | 'unavailable' | 'maintenance' | 'restricted'
export type PublicEligibility = 'eligible' | 'restricted' | 'unknown'

export interface PublicEntitlementProjection {
  readonly id: string
  readonly code: string | null
  readonly name: string
  readonly description: string
  readonly status: 'included' | 'limited' | 'unavailable'
}

export interface PublicPricingProjection {
  readonly id: string
  readonly skuId: string | null
  readonly name: string
  readonly price: string
  readonly unit: string
  readonly currency: string
  readonly billingPeriod: string
  readonly description: string
  readonly features: readonly string[]
  readonly entitlements: readonly PublicEntitlementProjection[]
  readonly featured: boolean
  readonly availability: PublicAvailability
  readonly eligibility: PublicEligibility
  readonly eligibilityMessage: string
  readonly maintenanceMessage: string
}

export interface PublicSkuProjection extends PublicPricingProjection {
  readonly planId: string | null
}

export interface PublicCampaignProjection {
  readonly id: string
  readonly title: string
  readonly summary: string
  readonly availability: PublicAvailability
  readonly eligibility: PublicEligibility
  readonly eligibilityMessage: string
  readonly startsAt: string | null
  readonly endsAt: string | null
  readonly actionLabel: string
  readonly href: string | null
  readonly target: 'public' | 'learner' | 'download'
}

export interface PublicDownloadProjection {
  readonly id: string
  readonly name: string
  readonly platform: string
  readonly description: string
  readonly availability: PublicAvailability
  readonly action: string
  readonly href: string | null
}

export interface PublicAnnouncementProjection {
  readonly id: string
  readonly title: string
  readonly summary: string
  readonly publishedAt: string | null
  readonly href: string | null
}

export interface PublicComplianceProjection {
  readonly id: string
  readonly title: string
  readonly status: string
  readonly description: string
}

export interface PublicProjection {
  readonly schemaVersion: string
  readonly uiLocale: PublicUiLocale
  readonly contentLocale: string
  readonly generatedAt: string | null
  readonly courses: readonly PublicCourseProjection[]
  readonly pricingPlans: readonly PublicPricingProjection[]
  readonly skus: readonly PublicSkuProjection[]
  readonly campaigns: readonly PublicCampaignProjection[]
  readonly downloadChannels: readonly PublicDownloadProjection[]
  readonly announcements: readonly PublicAnnouncementProjection[]
  readonly complianceNotices: readonly PublicComplianceProjection[]
}

export type PublicProjectionLoadState = 'loading' | 'ready' | 'empty' | 'error' | 'permission' | 'recovery' | 'maintenance'

export interface PublicProjectionResponse {
  readonly projection: PublicProjection
  readonly state: PublicProjectionLoadState
  readonly stale: boolean
  readonly source: 'gateway' | 'memory-cache' | 'empty-fallback'
  readonly errorCode: string | null
}

export const EMPTY_PUBLIC_PROJECTION: PublicProjection = Object.freeze({
  schemaVersion: 'public-site-v1',
  uiLocale: 'zh-CN',
  contentLocale: 'en-US',
  generatedAt: null,
  courses: [],
  pricingPlans: [],
  skus: [],
  campaigns: [],
  downloadChannels: [],
  announcements: [],
  complianceNotices: [],
})

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback
}

function nullableText(value: unknown): string | null {
  const valueText = text(value)
  return valueText ? valueText : null
}

function booleanValue(value: unknown): boolean {
  return value === true
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function stringList(value: unknown): string[] {
  return list(value).filter((item): item is string => typeof item === 'string' && Boolean(item.trim())).map((item) => item.trim())
}

function localized(value: unknown, locale: PublicUiLocale, fallback = ''): string {
  if (typeof value === 'string') return text(value, fallback)
  if (!isRecord(value)) return fallback
  return text(value[locale] ?? value['zh-CN'] ?? value['en-US'], fallback)
}

function availability(value: unknown): PublicAvailability {
  const candidate = text(value).toLowerCase().replaceAll('_', '-')
  if (['available', 'published', 'active', 'enabled'].includes(candidate)) return 'available'
  if (['maintenance', 'maintaining', 'temporarily-unavailable'].includes(candidate)) return 'maintenance'
  if (['restricted', 'region-restricted', 'not-eligible'].includes(candidate)) return 'restricted'
  if (['unavailable', 'disabled', 'offline', 'revoked'].includes(candidate)) return 'unavailable'
  return 'coming-soon'
}

function eligibility(value: unknown): PublicEligibility {
  const candidate = text(value).toLowerCase().replaceAll('_', '-')
  if (['eligible', 'available', 'allowed', 'qualified'].includes(candidate)) return 'eligible'
  if (['restricted', 'denied', 'not-eligible', 'ineligible'].includes(candidate)) return 'restricted'
  return 'unknown'
}

function entitlementStatus(value: unknown): PublicEntitlementProjection['status'] {
  const candidate = text(value).toLowerCase().replaceAll('_', '-')
  if (['included', 'active', 'available', 'enabled'].includes(candidate)) return 'included'
  if (['limited', 'partial', 'quota'].includes(candidate)) return 'limited'
  return 'unavailable'
}

function sourceData(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) return {}
  if (isRecord(value.publicProjection)) return value.publicProjection
  if (isRecord(value.data)) return value.data
  if (isRecord(value.result)) return value.result
  return value
}

function normalizeCourse(value: unknown, locale: PublicUiLocale): PublicCourseProjection | null {
  if (!isRecord(value)) return null
  const id = text(value.id ?? value.courseId ?? value.contentCode)
  const title = localized(value.title, locale)
  if (!id || !title) return null
  return { id, eyebrow: localized(value.eyebrow ?? value.contentType, locale), title, description: localized(value.description ?? value.summary, locale), level: localized(value.level ?? value.targetLevel, locale), duration: localized(value.duration, locale), tags: stringList(value.tags).slice(0, 12) }
}

function normalizeEntitlement(value: unknown, locale: PublicUiLocale, index: number): PublicEntitlementProjection | null {
  if (typeof value === 'string') {
    const name = text(value)
    return name ? { id: `entitlement-${index + 1}`, code: null, name, description: '', status: 'included' } : null
  }
  if (!isRecord(value)) return null
  const id = text(value.id ?? value.entitlementId ?? value.code ?? value.name)
  const name = localized(value.name ?? value.title ?? value.code, locale)
  if (!id || !name) return null
  return {
    id,
    code: nullableText(value.code),
    name,
    description: localized(value.description ?? value.summary, locale),
    status: entitlementStatus(value.status ?? value.availability),
  }
}

function normalizeEntitlements(value: unknown, locale: PublicUiLocale): PublicEntitlementProjection[] {
  return list(value).map((item, index) => normalizeEntitlement(item, locale, index)).filter((item): item is PublicEntitlementProjection => item !== null).slice(0, 20)
}

function normalizePrice(value: unknown, locale: PublicUiLocale): PublicPricingProjection | null {
  if (!isRecord(value)) return null
  const sku = isRecord(value.sku) ? value.sku : {}
  const id = text(value.id ?? value.planId ?? value.skuId ?? value.priceCode ?? sku.id)
  const name = localized(value.name ?? value.title ?? value.priceCode ?? sku.name, locale)
  if (!id || !name) return null
  const rawAvailability = value.availability ?? value.status ?? (value.published === false ? 'unpublished' : undefined)
  const rawEligibility = value.regionEligibility ?? value.eligibility ?? value.qualification ?? value.regionStatus
  return {
    id,
    skuId: nullableText(value.skuId ?? sku.id),
    name,
    price: localized(value.price ?? value.displayPrice ?? value.displayAmount ?? sku.price, locale, '暂未发布'),
    unit: localized(value.unit ?? value.billingPeriod ?? value.billingCycle ?? sku.unit, locale),
    currency: localized(value.currency ?? sku.currency, locale),
    billingPeriod: localized(value.billingPeriod ?? value.billingCycle ?? value.period ?? sku.billingPeriod, locale),
    description: localized(value.description ?? value.summary ?? sku.description, locale),
    features: stringList(value.features ?? value.benefits).slice(0, 12),
    entitlements: normalizeEntitlements(value.entitlements ?? value.includedEntitlements ?? value.includedBenefits, locale),
    featured: booleanValue(value.featured),
    availability: availability(rawAvailability),
    eligibility: eligibility(rawEligibility),
    eligibilityMessage: localized(value.eligibilityMessage ?? value.regionMessage ?? value.qualificationMessage, locale),
    maintenanceMessage: localized(value.maintenanceMessage ?? value.statusMessage, locale),
  }
}

function normalizeSku(value: unknown, locale: PublicUiLocale): PublicSkuProjection | null {
  if (!isRecord(value)) return null
  const normalized = normalizePrice(value, locale)
  if (!normalized) return null
  const skuId = text(value.skuId ?? value.id ?? normalized.skuId)
  if (!skuId) return null
  return { ...normalized, id: skuId, skuId, planId: nullableText(value.planId ?? value.pricePlanId ?? value.planCode) }
}

function normalizeCampaign(value: unknown, locale: PublicUiLocale): PublicCampaignProjection | null {
  if (!isRecord(value)) return null
  const cta = isRecord(value.cta) ? value.cta : {}
  const id = text(value.id ?? value.campaignId ?? value.code)
  const title = localized(value.title ?? value.name, locale)
  if (!id || !title) return null
  const targetValue = text(value.target ?? value.destination ?? cta.target).toLowerCase()
  const target: PublicCampaignProjection['target'] = targetValue.includes('download') ? 'download' : targetValue.includes('learner') || targetValue.includes('login') ? 'learner' : 'public'
  const rawEligibility = value.regionEligibility ?? value.eligibility ?? value.qualification ?? value.regionStatus
  const rawAvailability = value.availability ?? value.status
  return {
    id,
    title,
    summary: localized(value.summary ?? value.description, locale),
    availability: availability(rawAvailability),
    eligibility: eligibility(rawEligibility),
    eligibilityMessage: localized(value.eligibilityMessage ?? value.regionMessage ?? value.qualificationMessage, locale),
    startsAt: nullableText(value.startsAt ?? value.startAt),
    endsAt: nullableText(value.endsAt ?? value.endAt),
    actionLabel: localized(value.actionLabel ?? value.action ?? cta.label, locale, target === 'download' ? '查看下载' : target === 'learner' ? '进入学习 Web' : '查看活动'),
    href: nullableText(value.href ?? value.url ?? cta.href),
    target,
  }
}

function normalizeDownload(value: unknown, locale: PublicUiLocale): PublicDownloadProjection | null {
  if (!isRecord(value)) return null
  const id = text(value.id ?? value.channelId ?? value.channel ?? value.platform)
  const name = localized(value.name ?? value.title ?? value.channel, locale)
  if (!id || !name) return null
  const status = text(value.availability ?? value.status).toLowerCase()
  return { id, name, platform: localized(value.platform, locale), description: localized(value.description, locale), availability: availability(status), action: localized(value.action, locale, status === 'available' ? '立即体验' : '暂未开放'), href: nullableText(value.href ?? value.url ?? value.downloadUrl) }
}

function normalizeAnnouncement(value: unknown, locale: PublicUiLocale): PublicAnnouncementProjection | null {
  if (!isRecord(value)) return null
  const id = text(value.id ?? value.announcementId ?? value.announcementCode)
  const title = localized(value.title, locale)
  if (!id || !title) return null
  return { id, title, summary: localized(value.summary ?? value.description, locale), publishedAt: nullableText(value.publishedAt), href: nullableText(value.href ?? value.url) }
}

function normalizeCompliance(value: unknown, locale: PublicUiLocale): PublicComplianceProjection | null {
  if (!isRecord(value)) return null
  const id = text(value.id ?? value.noticeId ?? value.noticeCode ?? value.title)
  const title = localized(value.title, locale)
  if (!id || !title) return null
  return { id, title, status: localized(value.status ?? value.version, locale), description: localized(value.description ?? value.summary ?? value.body, locale) }
}

export function resolvePublicUiLocale(value: unknown): PublicUiLocale {
  const candidate = Array.isArray(value) ? value[0] : value
  return candidate === 'en-US' ? 'en-US' : 'zh-CN'
}

export function resolvePublicThemeMode(value: unknown): PublicThemeMode {
  const candidate = Array.isArray(value) ? value[0] : value
  return PUBLIC_THEME_MODES.includes(candidate as PublicThemeMode) ? candidate as PublicThemeMode : 'system'
}

function responseState(value: unknown): PublicProjectionLoadState | null {
  const candidates: Record<string, unknown>[] = []
  if (isRecord(value)) {
    candidates.push(value)
    if (isRecord(value.data)) candidates.push(value.data)
    if (isRecord(value.result)) candidates.push(value.result)
  }
  for (const candidate of candidates) {
    if (candidate.maintenance === true) return 'maintenance'
    const state = text(candidate.state ?? candidate.serviceState ?? candidate.projectionState ?? candidate.accessState).toLowerCase().replaceAll('_', '-')
    if (['maintenance', 'maintaining'].includes(state)) return 'maintenance'
    if (['permission', 'forbidden', 'denied', 'access-denied'].includes(state)) return 'permission'
    if (['recovery', 'recovering', 'degraded', 'stale'].includes(state)) return 'recovery'
    if (['error', 'failed', 'unavailable'].includes(state)) return 'error'
    if (state === 'loading') return 'loading'
  }
  return null
}

export function normalizePublicProjection(value: unknown, requestedLocale: PublicUiLocale = 'zh-CN'): PublicProjection {
  const source = sourceData(value)
  const locale = resolvePublicUiLocale(source.uiLocale ?? requestedLocale)
  const pricingPlans = list(source.pricingPlans ?? source.pricing ?? source.prices).map((item) => normalizePrice(item, locale)).filter((item): item is PublicPricingProjection => item !== null)
  const explicitSkus = list(source.skus ?? source.publicSkus).map((item) => normalizeSku(item, locale)).filter((item): item is PublicSkuProjection => item !== null)
  const skus = explicitSkus.length
    ? explicitSkus
    : pricingPlans.filter((plan): plan is PublicPricingProjection & { skuId: string } => Boolean(plan.skuId)).map((plan) => ({ ...plan, id: plan.skuId, planId: plan.id }))
  return {
    schemaVersion: text(source.schemaVersion, 'public-site-v1'),
    uiLocale: locale,
    contentLocale: text(source.contentLocale, 'en-US'),
    generatedAt: nullableText(source.generatedAt),
    courses: list(source.courses).map((item) => normalizeCourse(item, locale)).filter((item): item is PublicCourseProjection => item !== null),
    pricingPlans,
    skus,
    campaigns: list(source.campaigns ?? source.activities ?? source.promotions).map((item) => normalizeCampaign(item, locale)).filter((item): item is PublicCampaignProjection => item !== null),
    downloadChannels: list(source.downloadChannels ?? source.downloads).map((item) => normalizeDownload(item, locale)).filter((item): item is PublicDownloadProjection => item !== null),
    announcements: list(source.announcements ?? source.notices).map((item) => normalizeAnnouncement(item, locale)).filter((item): item is PublicAnnouncementProjection => item !== null),
    complianceNotices: list(source.complianceNotices ?? source.compliance).map((item) => normalizeCompliance(item, locale)).filter((item): item is PublicComplianceProjection => item !== null),
  }
}

export function normalizePublicProjectionResponse(value: unknown, requestedLocale: PublicUiLocale = 'zh-CN'): PublicProjectionResponse {
  const projection = normalizePublicProjection(value, requestedLocale)
  const explicitState = responseState(value)
  const state = explicitState ?? (hasPublicProjectionData(projection) ? 'ready' : 'empty')
  const root = isRecord(value) ? value : {}
  const candidateSource = text(root.source).toLowerCase()
  const source: PublicProjectionResponse['source'] = candidateSource === 'gateway' || candidateSource === 'memory-cache' || candidateSource === 'empty-fallback' ? candidateSource : 'gateway'
  return {
    projection,
    state,
    stale: root.stale === true || state === 'recovery',
    source,
    errorCode: nullableText(root.errorCode),
  }
}

export function hasPublicProjectionData(projection: PublicProjection): boolean {
  return projection.courses.length > 0 || projection.pricingPlans.length > 0 || projection.skus.length > 0 || projection.campaigns.length > 0 || projection.downloadChannels.length > 0 || projection.announcements.length > 0 || projection.complianceNotices.length > 0
}

export function filterPublicCourses(courses: readonly PublicCourseProjection[], filter = 'all'): readonly PublicCourseProjection[] {
  if (filter === 'all') return courses
  // The UI exposes product stages while the public API exposes CEFR levels.
  // Keep that translation in the projection boundary instead of asking every
  // page to know the content taxonomy.
  const levelsByStage: Record<string, readonly string[]> = {
    '入门': ['A1', 'A2'],
    '进阶': ['B1', 'B2', 'C1', 'C2'],
  }
  const levels = levelsByStage[filter]
  if (levels) return courses.filter((course) => levels.includes(course.level.toUpperCase()))
  return courses.filter((course) => course.level.includes(filter))
}
