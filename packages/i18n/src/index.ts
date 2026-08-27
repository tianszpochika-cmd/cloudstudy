export const DEFAULT_LOCALE = 'zh-CN' as const
export const DEFAULT_CONTENT_LOCALE = 'en-US' as const
export const DEFAULT_PSEUDO_LOCALE = 'en-XA' as const

export type Locale = string

export type MessageValue = string | MessageTree

export interface MessageTree {
  readonly [key: string]: MessageValue
}

export type MessagesByLocale = Readonly<Record<string, MessageTree>>

export type InterpolationValue = unknown
export type InterpolationValues = Readonly<Record<string, InterpolationValue>>

export type FallbackLocale = Locale | readonly Locale[] | false

export type PluralCategory = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other'

export interface MissingKeyContext {
  readonly key: string
  readonly locale: Locale
  readonly fallbackChain: readonly Locale[]
}

export interface I18nOptions {
  readonly locale?: Locale
  readonly contentLocale?: Locale
  readonly defaultLocale?: Locale
  readonly fallbackLocale?: FallbackLocale
  readonly pseudoLocale?: Locale
  readonly messages?: MessagesByLocale
  readonly onMissingKey?: (context: MissingKeyContext) => void
}

export interface TranslateOptions {
  readonly locale?: Locale
  readonly fallbackLocale?: FallbackLocale
}

export interface PluralTranslateOptions extends TranslateOptions {
  readonly type?: Intl.PluralRulesOptions['type']
}

export interface MissingKeyReport {
  readonly locale: Locale
  readonly sourceLocale: Locale
  readonly keys: readonly string[]
}

export interface MissingKeyScanOptions {
  readonly sourceLocale?: Locale
  readonly locales?: readonly Locale[]
  readonly ignore?: readonly string[]
}

export interface I18nState {
  readonly locale: Locale
  readonly contentLocale: Locale
}

export interface I18nInstance {
  readonly locale: Locale
  readonly contentLocale: Locale
  readonly state: I18nState
  readonly messages: MessagesByLocale
  setLocale(locale: Locale): I18nState
  setContentLocale(locale: Locale): I18nState
  getLocaleChain(locale?: Locale, fallbackLocale?: FallbackLocale): readonly Locale[]
  t(key: string, values?: InterpolationValues, options?: TranslateOptions): string
  tp(key: string, count: number, values?: InterpolationValues, options?: PluralTranslateOptions): string
  formatNumber(value: number, options?: Intl.NumberFormatOptions, locale?: Locale): string
  formatDate(value: Date | number | string, options?: Intl.DateTimeFormatOptions, locale?: Locale): string
  formatPlural(value: number, options?: Intl.PluralRulesOptions, locale?: Locale): PluralCategory
  registerMessages(locale: Locale, messages: MessageTree): void
  hasMessage(key: string, locale?: Locale, fallbackLocale?: FallbackLocale): boolean
  getMissingKeys(): readonly string[]
  clearMissingKeys(): void
  subscribe(listener: (state: I18nState) => void): () => void
}

interface ResolvedMessage {
  readonly value: string
  readonly locale: Locale
}

const PLACEHOLDER_PATTERN = /\{\{\s*([\w.-]+)\s*\}\}|\{\s*([\w.-]+)\s*\}/g
const PSEUDO_PROTECTED_PATTERN = /\{\{\s*[\w.-]+\s*\}\}|\{\s*[\w.-]+\s*\}|<\/?[A-Za-z][^>]*>/g
const PSEUDO_ACCENTS: Readonly<Record<string, string>> = {
  a: 'à',
  A: 'À',
  e: 'ë',
  E: 'Ë',
  i: 'ï',
  I: 'Ï',
  o: 'õ',
  O: 'Õ',
  u: 'ü',
  U: 'Ü',
  c: 'ç',
  C: 'Ç',
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isMessageTree(value: unknown): value is MessageTree {
  return isRecord(value)
}

function cloneMessageTree(messages: MessageTree): MessageTree {
  const result: Record<string, MessageValue> = {}
  for (const [key, value] of Object.entries(messages)) {
    result[key] = isMessageTree(value) ? cloneMessageTree(value) : value
  }
  return result
}

function mergeMessageTrees(base: MessageTree, incoming: MessageTree): MessageTree {
  const result: Record<string, MessageValue> = cloneMessageTree(base)
  for (const [key, value] of Object.entries(incoming)) {
    const existing = result[key]
    if (isMessageTree(existing) && isMessageTree(value)) {
      result[key] = mergeMessageTrees(existing, value)
    } else {
      result[key] = isMessageTree(value) ? cloneMessageTree(value) : value
    }
  }
  return result
}

function normalizeMessageMap(messages: MessagesByLocale | undefined): Record<string, MessageTree> {
  const result: Record<string, MessageTree> = {}
  for (const [locale, value] of Object.entries(messages ?? {})) {
    if (!isMessageTree(value)) continue
    const normalized = normalizeLocale(locale)
    result[normalized] = mergeMessageTrees(result[normalized] ?? {}, value)
  }
  return result
}

export function normalizeLocale(locale: Locale): Locale {
  const candidate = String(locale).trim().replace(/_/g, '-')
  if (!candidate) return DEFAULT_LOCALE
  try {
    return Intl.getCanonicalLocales(candidate)[0] ?? candidate
  } catch {
    return candidate
  }
}

function localeBases(locale: Locale): readonly Locale[] {
  const segments = locale.split('-')
  const bases: Locale[] = []
  for (let length = segments.length - 1; length > 0; length -= 1) {
    const candidate = segments.slice(0, length).join('-')
    if (candidate.split('-').at(-1)?.length === 1) continue
    bases.push(candidate)
  }
  return bases
}

function appendLocale(target: Locale[], locale: Locale | undefined): void {
  if (!locale) return
  const normalized = normalizeLocale(locale)
  if (!target.includes(normalized)) target.push(normalized)
}

export function resolveLocaleChain(
  locale: Locale,
  fallbackLocale: FallbackLocale = [DEFAULT_LOCALE],
  defaultLocale: Locale = DEFAULT_LOCALE,
): readonly Locale[] {
  const chain: Locale[] = []
  const requested = normalizeLocale(locale)
  appendLocale(chain, requested)
  for (const base of localeBases(requested)) appendLocale(chain, base)

  if (fallbackLocale !== false) {
    const fallbacks = typeof fallbackLocale === 'string' ? [fallbackLocale] : fallbackLocale
    for (const fallback of fallbacks) {
      const normalized = normalizeLocale(fallback)
      appendLocale(chain, normalized)
    }
    const normalizedDefault = normalizeLocale(defaultLocale)
    appendLocale(chain, normalizedDefault)
  }

  return chain
}

function lookupMessage(messages: MessageTree | undefined, key: string): string | undefined {
  if (!messages) return undefined
  const exact = messages[key]
  if (typeof exact === 'string') return exact

  let current: MessageValue | undefined = messages
  for (const segment of key.split('.')) {
    if (!isMessageTree(current)) return undefined
    current = current[segment]
  }
  return typeof current === 'string' ? current : undefined
}

function resolveMessage(
  messages: Readonly<Record<string, MessageTree>>,
  key: string,
  locale: Locale,
  fallbackLocale: FallbackLocale,
  defaultLocale: Locale,
  candidateKeys: readonly string[] = [key],
): ResolvedMessage | undefined {
  const chain = resolveLocaleChain(locale, fallbackLocale, defaultLocale)
  for (const candidateLocale of chain) {
    for (const candidateKey of candidateKeys) {
      const value = lookupMessage(messages[candidateLocale], candidateKey)
      if (value !== undefined) return { value, locale: candidateLocale }
    }
  }
  return undefined
}

function valueToString(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'bigint') return value.toString()
  return String(value)
}

export function interpolate(message: string, values: InterpolationValues = {}): string {
  return message.replace(PLACEHOLDER_PATTERN, (placeholder, doubleName: string | undefined, singleName: string | undefined) => {
    const name = doubleName ?? singleName
    if (!name || !(name in values)) return placeholder
    return valueToString(values[name])
  })
}

function pseudoTransformText(text: string): string {
  let transformed = ''
  for (const character of text) {
    const accented = PSEUDO_ACCENTS[character] ?? character
    transformed += accented
    if ('aeiouAEIOU'.includes(character)) transformed += accented.toLowerCase()
  }
  return transformed
}

export interface PseudoLocalizeOptions {
  readonly prefix?: string
  readonly suffix?: string
}

export function pseudoLocalize(message: string, options: PseudoLocalizeOptions = {}): string {
  const prefix = options.prefix ?? '[!! '
  const suffix = options.suffix ?? ' !!]'
  let result = ''
  let cursor = 0
  for (const match of message.matchAll(PSEUDO_PROTECTED_PATTERN)) {
    const start = match.index ?? cursor
    result += pseudoTransformText(message.slice(cursor, start))
    result += match[0]
    cursor = start + match[0].length
  }
  result += pseudoTransformText(message.slice(cursor))
  return `${prefix}${result}${suffix}`
}

export function pseudoLocalizeMessages(messages: MessageTree, options: PseudoLocalizeOptions = {}): MessageTree {
  const result: Record<string, MessageValue> = {}
  for (const [key, value] of Object.entries(messages)) {
    result[key] = isMessageTree(value) ? pseudoLocalizeMessages(value, options) : pseudoLocalize(value, options)
  }
  return result
}

function resolveLocaleOptions<T extends object>(
  localeOrOptions: Locale | T | undefined,
  optionsOrLocale: T | Locale | undefined,
): { locale: Locale; options: T | undefined } {
  if (typeof localeOrOptions === 'string') {
    return {
      locale: normalizeLocale(localeOrOptions),
      options: typeof optionsOrLocale === 'string' ? undefined : optionsOrLocale,
    }
  }
  return {
    locale: typeof optionsOrLocale === 'string' ? normalizeLocale(optionsOrLocale) : DEFAULT_LOCALE,
    options: localeOrOptions ?? (typeof optionsOrLocale === 'string' ? undefined : optionsOrLocale),
  }
}

export function formatNumber(value: number, locale?: Locale, options?: Intl.NumberFormatOptions): string
export function formatNumber(value: number, options?: Intl.NumberFormatOptions, locale?: Locale): string
export function formatNumber(
  value: number,
  localeOrOptions?: Locale | Intl.NumberFormatOptions,
  optionsOrLocale?: Intl.NumberFormatOptions | Locale,
): string {
  const resolved = resolveLocaleOptions<Intl.NumberFormatOptions>(localeOrOptions, optionsOrLocale)
  try {
    return new Intl.NumberFormat(resolved.locale, resolved.options).format(value)
  } catch {
    try {
      return new Intl.NumberFormat(DEFAULT_LOCALE, resolved.options).format(value)
    } catch {
      return String(value)
    }
  }
}

export function formatDate(value: Date | number | string, locale?: Locale, options?: Intl.DateTimeFormatOptions): string
export function formatDate(value: Date | number | string, options?: Intl.DateTimeFormatOptions, locale?: Locale): string
export function formatDate(
  value: Date | number | string,
  localeOrOptions?: Locale | Intl.DateTimeFormatOptions,
  optionsOrLocale?: Intl.DateTimeFormatOptions | Locale,
): string {
  const resolved = resolveLocaleOptions<Intl.DateTimeFormatOptions>(localeOrOptions, optionsOrLocale)
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  try {
    return new Intl.DateTimeFormat(resolved.locale, resolved.options).format(date)
  } catch {
    try {
      return new Intl.DateTimeFormat(DEFAULT_LOCALE, resolved.options).format(date)
    } catch {
      return date.toISOString()
    }
  }
}

export function formatPlural(
  value: number,
  locale: Locale = DEFAULT_LOCALE,
  options: Intl.PluralRulesOptions = {},
): PluralCategory {
  try {
    return new Intl.PluralRules(normalizeLocale(locale), options).select(value) as PluralCategory
  } catch {
    try {
      return new Intl.PluralRules(DEFAULT_LOCALE, options).select(value) as PluralCategory
    } catch {
      return 'other'
    }
  }
}

function formatPluralMessage(
  message: string,
  count: number,
  locale: Locale,
  values: InterpolationValues,
): string {
  const number = formatNumber(count, locale)
  return interpolate(message.replace(/#/g, number), { ...values, count })
}

function collectKeys(messages: MessageTree, prefix = ''): string[] {
  const keys: string[] = []
  for (const [key, value] of Object.entries(messages)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (isMessageTree(value)) keys.push(...collectKeys(value, path))
    else keys.push(path)
  }
  return keys
}

export function collectMessageKeys(messages: MessageTree): readonly string[] {
  return collectKeys(messages).sort()
}

export function findMissingKeys(
  messagesByLocale: MessagesByLocale,
  options: MissingKeyScanOptions = {},
): readonly MissingKeyReport[] {
  const normalizedMessages = normalizeMessageMap(messagesByLocale)
  const sourceLocale = normalizeLocale(options.sourceLocale ?? DEFAULT_LOCALE)
  const sourceKeys = new Set(collectMessageKeys(normalizedMessages[sourceLocale] ?? {}))
  const ignored = new Set(options.ignore ?? [])
  const locales = options.locales?.map(normalizeLocale) ?? Object.keys(normalizedMessages)
  const reports: MissingKeyReport[] = []

  for (const locale of locales) {
    if (locale === sourceLocale) continue
    const targetKeys = new Set(collectMessageKeys(normalizedMessages[locale] ?? {}))
    const missing = [...sourceKeys].filter((key) => !targetKeys.has(key) && !ignored.has(key)).sort()
    if (missing.length > 0) reports.push({ locale, sourceLocale, keys: missing })
  }
  return reports
}

export function hasMissingKeys(
  messagesByLocale: MessagesByLocale,
  options: MissingKeyScanOptions = {},
): boolean {
  return findMissingKeys(messagesByLocale, options).some((report) => report.keys.length > 0)
}

export function createI18n(options: I18nOptions = {}): I18nInstance {
  const defaultLocale = normalizeLocale(options.defaultLocale ?? DEFAULT_LOCALE)
  const fallbackLocale = options.fallbackLocale ?? [defaultLocale]
  const pseudoLocale = normalizeLocale(options.pseudoLocale ?? DEFAULT_PSEUDO_LOCALE)
  const messageStore = normalizeMessageMap(options.messages)
  let currentState: I18nState = {
    locale: normalizeLocale(options.locale ?? defaultLocale),
    contentLocale: normalizeLocale(options.contentLocale ?? DEFAULT_CONTENT_LOCALE),
  }
  const missingKeys = new Set<string>()
  const listeners = new Set<(state: I18nState) => void>()
  let disposed = false

  const stateSnapshot = (): I18nState => ({ ...currentState })
  const emit = (): void => {
    if (disposed) return
    const snapshot = stateSnapshot()
    for (const listener of listeners) listener(snapshot)
  }
  const markMissing = (key: string, locale = currentState.locale): void => {
    missingKeys.add(key)
    options.onMissingKey?.({
      key,
      locale: normalizeLocale(locale),
      fallbackChain: resolveLocaleChain(locale, fallbackLocale, defaultLocale),
    })
  }
  const resolve = (key: string, translateOptions: TranslateOptions = {}, candidateKeys: readonly string[] = [key]): ResolvedMessage | undefined => {
    const locale = normalizeLocale(translateOptions.locale ?? currentState.locale)
    const fallback = translateOptions.fallbackLocale ?? fallbackLocale
    return resolveMessage(messageStore, key, locale, fallback, defaultLocale, candidateKeys)
  }
  const translate = (key: string, values: InterpolationValues = {}, translateOptions: TranslateOptions = {}): string => {
    const resolved = resolve(key, translateOptions)
    if (!resolved) {
      markMissing(key, translateOptions.locale ?? currentState.locale)
      return key
    }
    const message = currentState.locale === pseudoLocale || normalizeLocale(translateOptions.locale ?? '') === pseudoLocale
      ? pseudoLocalize(resolved.value)
      : resolved.value
    return interpolate(message, values)
  }

  return {
    get locale() { return currentState.locale },
    get contentLocale() { return currentState.contentLocale },
    get state() { return stateSnapshot() },
    get messages() { return messageStore },
    setLocale(locale) {
      currentState = { ...currentState, locale: normalizeLocale(locale) }
      emit()
      return stateSnapshot()
    },
    setContentLocale(locale) {
      currentState = { ...currentState, contentLocale: normalizeLocale(locale) }
      emit()
      return stateSnapshot()
    },
    getLocaleChain(locale = currentState.locale, fallback = fallbackLocale) {
      return resolveLocaleChain(locale, fallback, defaultLocale)
    },
    t(key, values = {}, translateOptions = {}) {
      return translate(key, values, translateOptions)
    },
    tp(key, count, values = {}, translateOptions = {}) {
      const locale = normalizeLocale(translateOptions.locale ?? currentState.locale)
      const category = formatPlural(count, locale, { type: translateOptions.type ?? 'cardinal' })
      const candidateKeys = [`${key}.${category}`, `${key}.other`, key]
      const resolved = resolve(key, translateOptions, candidateKeys)
      if (!resolved) {
        markMissing(key, translateOptions.locale ?? currentState.locale)
        return key
      }
      const message = locale === pseudoLocale ? pseudoLocalize(resolved.value) : resolved.value
      return formatPluralMessage(message, count, locale, values)
    },
    formatNumber(value, numberOptions = {}, locale = currentState.locale) {
      return formatNumber(value, locale, numberOptions)
    },
    formatDate(value, dateOptions = {}, locale = currentState.locale) {
      return formatDate(value, locale, dateOptions)
    },
    formatPlural(value, pluralOptions = {}, locale = currentState.locale) {
      return formatPlural(value, locale, pluralOptions)
    },
    registerMessages(locale, messages) {
      const normalized = normalizeLocale(locale)
      messageStore[normalized] = mergeMessageTrees(messageStore[normalized] ?? {}, messages)
    },
    hasMessage(key, locale = currentState.locale, fallback = fallbackLocale) {
      return resolveMessage(messageStore, key, locale, fallback, defaultLocale) !== undefined
    },
    getMissingKeys() {
      return [...missingKeys].sort()
    },
    clearMissingKeys() {
      missingKeys.clear()
    },
    subscribe(listener) {
      if (disposed) throw new Error('i18n instance has been disposed')
      listeners.add(listener)
      listener(stateSnapshot())
      return () => listeners.delete(listener)
    },
  }
}
