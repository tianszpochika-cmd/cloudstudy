import type {
  I18nInstance,
  I18nState,
  Locale,
} from './index'

export type I18nAdapterKind = 'nuxt-ssr' | 'vue-web' | 'uni-app' | 'element-plus'

export interface I18nAdapterOptions {
  readonly localeStorage?: LocaleStorage
  readonly localeStorageKey?: string
  readonly contentLocaleStorageKey?: string
}

export interface I18nAdapter {
  readonly kind: I18nAdapterKind
  readonly instance: I18nInstance
  readonly state: I18nState
  setLocale(locale: Locale): I18nState
  setContentLocale(locale: Locale): I18nState
  serialize(): string
  restore(): I18nState
  subscribe(listener: (state: I18nState) => void): () => void
  dispose(): void
}

export interface NuxtI18nAdapter extends I18nAdapter {
  readonly noFlashScript: string
}

export interface ElementPlusI18nAdapter extends I18nAdapter {
  getElementPlusLocale(): string
}

/** Minimal storage contract shared by browser localStorage and uni storage adapters. */
export interface LocaleStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

function safeRead(storage: LocaleStorage | undefined, key: string): string | null {
  try {
    return storage?.getItem(key) ?? null
  } catch {
    return null
  }
}

function safeWrite(storage: LocaleStorage | undefined, key: string, value: string): void {
  try {
    storage?.setItem(key, value)
  } catch {
    // Locale persistence is a convenience and must not block rendering.
  }
}

function createBaseAdapter(
  kind: I18nAdapterKind,
  instance: I18nInstance,
  options: I18nAdapterOptions = {},
): I18nAdapter {
  const localeKey = options.localeStorageKey ?? 'ef.ui-locale'
  const contentLocaleKey = options.contentLocaleStorageKey ?? 'ef.content-locale'
  const persist = (): void => {
    safeWrite(options.localeStorage, localeKey, instance.locale)
    safeWrite(options.localeStorage, contentLocaleKey, instance.contentLocale)
  }
  // subscribe emits the current state immediately. Do not replace a saved
  // preference with constructor defaults before restore has read it.
  let initialEmission = true
  const unsubscribePersistence = instance.subscribe(() => {
    if (initialEmission) {
      initialEmission = false
      return
    }
    persist()
  })

  return {
    kind,
    instance,
    get state() { return instance.state },
    setLocale(locale) { return instance.setLocale(locale) },
    setContentLocale(locale) { return instance.setContentLocale(locale) },
    serialize() {
      return JSON.stringify({ locale: instance.locale, contentLocale: instance.contentLocale })
    },
    restore() {
      const locale = safeRead(options.localeStorage, localeKey)
      const contentLocale = safeRead(options.localeStorage, contentLocaleKey)
      if (locale) instance.setLocale(locale)
      if (contentLocale) instance.setContentLocale(contentLocale)
      return instance.state
    },
    subscribe(listener) { return instance.subscribe(listener) },
    dispose() { unsubscribePersistence() },
  }
}

function noFlashScript(state: I18nState): string {
  const serialized = JSON.stringify({ locale: state.locale, contentLocale: state.contentLocale })
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
  return `(function(){var s=${serialized};document.documentElement.lang=s.locale;document.documentElement.dataset.uiLocale=s.locale;document.documentElement.dataset.contentLocale=s.contentLocale;})();`
}

/** Nuxt SSR bridge: serialize the server state and set the document locale before hydration. */
export function createNuxtI18nAdapter(instance: I18nInstance, options: I18nAdapterOptions = {}): NuxtI18nAdapter {
  const adapter = createBaseAdapter('nuxt-ssr', instance, options)
  return {
    ...adapter,
    get noFlashScript() { return noFlashScript(instance.state) },
  }
}

/** Vue Web bridge: framework-neutral so the app can wrap state with Vue ref/computed. */
export function createVueWebI18nAdapter(instance: I18nInstance, options: I18nAdapterOptions = {}): I18nAdapter {
  return createBaseAdapter('vue-web', instance, options)
}

/** uni-app bridge: the caller supplies uni.getStorageSync/setStorageSync through this contract. */
export function createUniAppI18nAdapter(instance: I18nInstance, options: I18nAdapterOptions = {}): I18nAdapter {
  return createBaseAdapter('uni-app', instance, options)
}

/** Element Plus bridge: map the shared UI locale to Element Plus' locale identifiers. */
export function createElementPlusI18nAdapter(
  instance: I18nInstance,
  options: I18nAdapterOptions & { readonly localeMap?: Readonly<Record<string, string>> } = {},
): ElementPlusI18nAdapter {
  const adapter = createBaseAdapter('element-plus', instance, options)
  const localeMap = options.localeMap ?? { 'zh-CN': 'zh-CN', 'en-US': 'en', 'en-GB': 'en' }
  return {
    ...adapter,
    getElementPlusLocale() { return localeMap[instance.locale] ?? localeMap['zh-CN'] ?? 'zh-CN' },
  }
}
