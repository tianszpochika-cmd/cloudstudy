export const THEME_MODES = ['light', 'dark', 'system', 'high-contrast'] as const
export type ThemeMode = (typeof THEME_MODES)[number]
export type ResolvedTheme = Exclude<ThemeMode, 'system'>

export type TokenPrimitive = string | number
export interface TokenTree {
  readonly [key: string]: TokenPrimitive | TokenTree
}
export interface CssVariableOptions {
  readonly prefix?: string
  readonly selector?: string
}

export interface ThemeStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem?(key: string): void
}

export interface ThemeControllerOptions {
  readonly initialTheme?: ThemeMode
  readonly storage?: ThemeStorage
  readonly storageKey?: string
  readonly systemPreference?: () => boolean
  readonly prefix?: string
}

export interface ThemeState {
  readonly theme: ThemeMode
  readonly resolvedTheme: ResolvedTheme
  readonly variables: Readonly<Record<string, string>>
  readonly css: string
}

export interface ThemeController {
  readonly theme: ThemeMode
  readonly resolvedTheme: ResolvedTheme
  readonly state: ThemeState
  setTheme(theme: ThemeMode): ThemeState
  restore(): ThemeState
  refresh(): ThemeState
  getVariables(): Readonly<Record<string, string>>
  getCss(): string
  subscribe(listener: (state: ThemeState) => void): () => void
  dispose(): void
}

const legacyColor = {
  brandPrimary: '#596BFF',
  brandSecondary: '#7C5CFC',
  surfacePage: '#F7F8FC',
  surfaceCard: '#FFFFFF',
  textPrimary: '#202332',
  textSecondary: '#666D80',
} as const

const legacyRadius = {
  card: '16px',
  button: '14px',
} as const

export const atomicTokens = {
  color: {
    brand: {
      primary: legacyColor.brandPrimary,
      secondary: legacyColor.brandSecondary,
      accent: '#3B8DFF',
    },
    neutral: {
      0: '#FFFFFF',
      50: '#F7F8FC',
      100: '#EEF0F7',
      200: '#DDE1ED',
      300: '#C4CADB',
      500: '#8A92A8',
      700: '#4F566B',
      900: '#202332',
      1000: '#000000',
    },
    blue: {
      500: '#3B8DFF',
      700: '#245ED7',
    },
    green: {
      500: '#1F9D68',
      700: '#147047',
    },
    orange: {
      500: '#B86B00',
      700: '#7A4300',
    },
    red: {
      500: '#C93737',
      700: '#8A1F1F',
    },
    purple: {
      500: '#7C5CFC',
      700: '#5937D1',
    },
  },
  typography: {
    fontFamily: {
      sans: 'Inter, "PingFang SC", "Microsoft YaHei", sans-serif',
      mono: '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
    },
    fontSize: {
      xs: '12px',
      sm: '14px',
      md: '16px',
      lg: '18px',
      xl: '24px',
      display: '36px',
    },
    fontWeight: {
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.2,
      normal: 1.5,
      relaxed: 1.75,
    },
  },
  spacing: {
    0: '0px',
    1: '4px',
    2: '8px',
    3: '12px',
    4: '16px',
    5: '20px',
    6: '24px',
    8: '32px',
    10: '40px',
    12: '48px',
    16: '64px',
  },
  radius: {
    none: '0px',
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    pill: '999px',
    card: legacyRadius.card,
    button: legacyRadius.button,
  },
  shadow: {
    none: 'none',
    sm: '0 1px 3px rgb(32 35 50 / 0.12)',
    md: '0 8px 24px rgb(32 35 50 / 0.12)',
    lg: '0 16px 48px rgb(32 35 50 / 0.16)',
  },
  motion: {
    durationFast: '120ms',
    durationNormal: '200ms',
    durationSlow: '320ms',
    easingStandard: 'cubic-bezier(0.2, 0, 0, 1)',
    easingEmphasized: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
  },
  breakpoint: {
    mobileMax: 639,
    tabletMax: 1023,
    padMax: 1279,
    desktopMin: 1280,
  },
  accessibility: {
    minTouchTarget: '44px',
    focusRing: '#3B8DFF',
    maxTextScale: 2,
  },
} as const

export const semanticTokens = {
  light: {
    color: {
      background: {
        canvas: '#F7F8FC',
        surface: '#FFFFFF',
        raised: '#FFFFFF',
        inverse: '#202332',
      },
      text: {
        primary: '#202332',
        secondary: '#666D80',
        muted: '#8A92A8',
        inverse: '#FFFFFF',
        onBrand: '#FFFFFF',
      },
      border: {
        subtle: '#EEF0F7',
        default: '#DDE1ED',
        strong: '#8A92A8',
        focus: '#3B8DFF',
      },
      action: {
        primary: '#596BFF',
        primaryHover: '#4658E6',
        secondary: '#7C5CFC',
        disabled: '#C4CADB',
      },
      status: {
        success: '#147047',
        warning: '#7A4300',
        danger: '#8A1F1F',
        info: '#245ED7',
      },
      state: {
        hover: 'rgb(89 107 255 / 0.08)',
        pressed: 'rgb(89 107 255 / 0.16)',
        selected: 'rgb(89 107 255 / 0.12)',
        overlay: 'rgb(32 35 50 / 0.48)',
      },
    },
    shadow: {
      surface: '0 8px 24px rgb(32 35 50 / 0.12)',
      focus: '0 0 0 3px rgb(59 141 255 / 0.32)',
    },
    focus: {
      outline: '#3B8DFF',
      outlineWidth: '3px',
    },
  },
  dark: {
    color: {
      background: {
        canvas: '#11131C',
        surface: '#1B1F2B',
        raised: '#252A39',
        inverse: '#FFFFFF',
      },
      text: {
        primary: '#F7F8FC',
        secondary: '#C4CADB',
        muted: '#8A92A8',
        inverse: '#202332',
        onBrand: '#FFFFFF',
      },
      border: {
        subtle: '#252A39',
        default: '#4F566B',
        strong: '#8A92A8',
        focus: '#6EA8FF',
      },
      action: {
        primary: '#7E8CFF',
        primaryHover: '#A0AAFF',
        secondary: '#A18BFF',
        disabled: '#4F566B',
      },
      status: {
        success: '#5DCC96',
        warning: '#F0B35A',
        danger: '#FF8585',
        info: '#82B6FF',
      },
      state: {
        hover: 'rgb(126 140 255 / 0.14)',
        pressed: 'rgb(126 140 255 / 0.24)',
        selected: 'rgb(126 140 255 / 0.18)',
        overlay: 'rgb(0 0 0 / 0.64)',
      },
    },
    shadow: {
      surface: '0 12px 32px rgb(0 0 0 / 0.36)',
      focus: '0 0 0 3px rgb(110 168 255 / 0.42)',
    },
    focus: {
      outline: '#6EA8FF',
      outlineWidth: '3px',
    },
  },
  'high-contrast': {
    color: {
      background: {
        canvas: '#000000',
        surface: '#000000',
        raised: '#000000',
        inverse: '#FFFFFF',
      },
      text: {
        primary: '#FFFFFF',
        secondary: '#FFFFFF',
        muted: '#FFFFFF',
        inverse: '#000000',
        onBrand: '#FFFFFF',
      },
      border: {
        subtle: '#FFFFFF',
        default: '#FFFFFF',
        strong: '#FFFF00',
        focus: '#FFFF00',
      },
      action: {
        primary: '#0000EE',
        primaryHover: '#00FFFF',
        secondary: '#800080',
        disabled: '#808080',
      },
      status: {
        success: '#00FF00',
        warning: '#FFFF00',
        danger: '#FF0000',
        info: '#00FFFF',
      },
      state: {
        hover: '#333333',
        pressed: '#666666',
        selected: '#0000EE',
        overlay: '#000000',
      },
    },
    shadow: {
      surface: 'none',
      focus: '0 0 0 3px #FFFF00',
    },
    focus: {
      outline: '#FFFF00',
      outlineWidth: '3px',
    },
  },
} as const

export const themeTokens = semanticTokens

// Keep the original public shape stable while exposing the new token layers.
export const designTokens = {
  color: legacyColor,
  radius: legacyRadius,
  breakpoint: atomicTokens.breakpoint,
  accessibility: atomicTokens.accessibility,
  atomic: atomicTokens,
  semantic: semanticTokens,
  themeModes: THEME_MODES,
} as const

export type DesignTokens = typeof designTokens
export type AtomicTokens = typeof atomicTokens
export type SemanticTokens = typeof semanticTokens

function isTokenTree(value: unknown): value is TokenTree {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function kebabCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[\s_.]+/g, '-')
    .replace(/[^a-zA-Z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
}

function normalizePrefix(prefix: string): string {
  return kebabCase(prefix) || 'ef'
}

export function flattenTokens(tokens: TokenTree, parentPath: readonly string[] = []): Readonly<Record<string, TokenPrimitive>> {
  const result: Record<string, TokenPrimitive> = {}
  for (const [key, value] of Object.entries(tokens)) {
    const path = [...parentPath, key]
    if (isTokenTree(value)) {
      Object.assign(result, flattenTokens(value, path))
    } else {
      result[path.join('.')] = value
    }
  }
  return result
}

export function toCssVariableMap(
  tokens: TokenTree,
  options: CssVariableOptions = {},
): Readonly<Record<string, string>> {
  const prefix = normalizePrefix(options.prefix ?? 'ef')
  const result: Record<string, string> = {}
  for (const [path, value] of Object.entries(flattenTokens(tokens))) {
    const variable = `--${prefix}-${path.split('.').map(kebabCase).join('-')}`
    result[variable] = String(value)
  }
  return result
}

export function toCssVariables(tokens: TokenTree, options: CssVariableOptions = {}): string {
  const selector = options.selector ?? ':root'
  const variables = toCssVariableMap(tokens, options)
  const declarations = Object.entries(variables)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, value]) => `  ${name}: ${value};`)
    .join('\n')
  return `${selector} {\n${declarations}\n}`
}

export function resolveTheme(theme: ThemeMode, systemDark = detectSystemDark()): ResolvedTheme {
  if (theme === 'system') return systemDark ? 'dark' : 'light'
  return theme
}

export function getThemeTokens(theme: ThemeMode = 'light', systemDark = detectSystemDark()): TokenTree {
  return semanticTokens[resolveTheme(theme, systemDark)]
}

export function getThemeVariableMap(
  theme: ThemeMode = 'light',
  options: CssVariableOptions & { readonly systemDark?: boolean; readonly includeAtomic?: boolean } = {},
): Readonly<Record<string, string>> {
  const semantic = getThemeTokens(theme, options.systemDark ?? detectSystemDark())
  const tokens: TokenTree = options.includeAtomic
    ? { atomic: atomicTokens, semantic }
    : semantic
  return toCssVariableMap(tokens, options)
}

export function getThemeCss(
  theme: ThemeMode = 'light',
  options: CssVariableOptions & { readonly systemDark?: boolean; readonly includeAtomic?: boolean } = {},
): string {
  const semantic = getThemeTokens(theme, options.systemDark ?? detectSystemDark())
  const tokens: TokenTree = options.includeAtomic
    ? { atomic: atomicTokens, semantic }
    : semantic
  return toCssVariables(tokens, options)
}

export function detectSystemDark(): boolean {
  const candidate = globalThis as typeof globalThis & {
    matchMedia?: (query: string) => { readonly matches: boolean }
  }
  if (typeof candidate.matchMedia !== 'function') return false
  return candidate.matchMedia('(prefers-color-scheme: dark)').matches
}

function isThemeMode(value: string | null): value is ThemeMode {
  return value !== null && (THEME_MODES as readonly string[]).includes(value)
}

function snapshotTheme(
  theme: ThemeMode,
  systemDark: boolean,
  prefix: string,
): ThemeState {
  const resolvedTheme = resolveTheme(theme, systemDark)
  return {
    theme,
    resolvedTheme,
    variables: getThemeVariableMap(theme, { prefix, systemDark }),
    css: getThemeCss(theme, { prefix, systemDark }),
  }
}

export function createThemeController(options: ThemeControllerOptions = {}): ThemeController {
  const storageKey = options.storageKey ?? 'ef.theme'
  const storage = options.storage
  const systemPreference = options.systemPreference ?? detectSystemDark
  const prefix = options.prefix ?? 'ef'
  let currentTheme: ThemeMode = options.initialTheme ?? 'system'
  let currentSystemDark = systemPreference()
  let disposed = false
  const listeners = new Set<(state: ThemeState) => void>()

  const snapshot = (): ThemeState => snapshotTheme(currentTheme, currentSystemDark, prefix)
  const emit = (): void => {
    if (disposed) return
    const current = snapshot()
    for (const listener of listeners) listener(current)
  }
  const persist = (): void => {
    try {
      storage?.setItem(storageKey, currentTheme)
    } catch {
      // A blocked or quota-limited storage must not break theme switching.
    }
  }

  return {
    get theme() { return currentTheme },
    get resolvedTheme() { return resolveTheme(currentTheme, currentSystemDark) },
    get state() { return snapshot() },
    setTheme(theme) {
      if (!(THEME_MODES as readonly string[]).includes(theme)) throw new Error(`Unsupported theme: ${theme}`)
      currentTheme = theme
      persist()
      emit()
      return snapshot()
    },
    restore() {
      let stored: string | null = null
      try {
        stored = storage?.getItem(storageKey) ?? null
      } catch {
        stored = null
      }
      if (isThemeMode(stored)) currentTheme = stored
      emit()
      return snapshot()
    },
    refresh() {
      currentSystemDark = systemPreference()
      emit()
      return snapshot()
    },
    getVariables() {
      return snapshot().variables
    },
    getCss() {
      return snapshot().css
    },
    subscribe(listener) {
      if (disposed) throw new Error('Theme controller has been disposed')
      listeners.add(listener)
      listener(snapshot())
      return () => listeners.delete(listener)
    },
    dispose() {
      disposed = true
      listeners.clear()
    },
  }
}
