export const PERFORMANCE_LEVELS = ['Ultra', 'High', 'Medium', 'Performance'] as const

export type PerformanceLevel = (typeof PERFORMANCE_LEVELS)[number]
export type PerformanceSource = 'auto' | 'manual' | 'restore'

export interface PerformanceStrategy {
  level: PerformanceLevel
  motionScale: number
  particleBudget: number
  textureBudgetMb: number
  enableThreeD: boolean
  enableWaveform: boolean
  enableRive: boolean
}

export interface PerformanceState {
  level: PerformanceLevel
  source: PerformanceSource
  reducedMotion: boolean
  updatedAt: number
  strategy: PerformanceStrategy
}

export interface PerformanceStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem?(key: string): void
}

export interface AdaptivePerformanceEngineOptions {
  storage?: PerformanceStorage
  storageKey?: string
  now?: () => number
  reducedMotion?: boolean
  deviceMemoryGb?: number
  hardwareConcurrency?: number
}

export interface AdaptivePerformanceEngine {
  readonly level: PerformanceLevel
  readonly state: PerformanceState
  setLevel(level: PerformanceLevel, source?: PerformanceSource): PerformanceState
  restore(): PerformanceState
  subscribe(listener: (state: PerformanceState) => void): () => void
  dispose(): void
}

const DEFAULT_STORAGE_KEY = 'yx.performance.level'

const STRATEGIES: Record<PerformanceLevel, PerformanceStrategy> = {
  Ultra: { level: 'Ultra', motionScale: 1, particleBudget: 100, textureBudgetMb: 512, enableThreeD: true, enableWaveform: true, enableRive: true },
  High: { level: 'High', motionScale: 0.85, particleBudget: 64, textureBudgetMb: 256, enableThreeD: true, enableWaveform: true, enableRive: true },
  Medium: { level: 'Medium', motionScale: 0.55, particleBudget: 24, textureBudgetMb: 128, enableThreeD: true, enableWaveform: false, enableRive: true },
  Performance: { level: 'Performance', motionScale: 0, particleBudget: 0, textureBudgetMb: 64, enableThreeD: false, enableWaveform: false, enableRive: false },
}

function browserStorage(): PerformanceStorage | undefined {
  if (typeof window === 'undefined' || !window.localStorage) return undefined
  return window.localStorage
}

function detectReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function detectAutomaticLevel(options: AdaptivePerformanceEngineOptions, reducedMotion: boolean): PerformanceLevel {
  if (reducedMotion) return 'Performance'
  const memory = options.deviceMemoryGb ?? (typeof navigator !== 'undefined' && 'deviceMemory' in navigator ? Number((navigator as Navigator & { deviceMemory?: number }).deviceMemory) : undefined)
  const cores = options.hardwareConcurrency ?? (typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : undefined)
  if ((memory !== undefined && memory <= 4) || (cores !== undefined && cores <= 4)) return 'Medium'
  if (typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches) return 'Medium'
  return 'High'
}

function cloneStrategy(level: PerformanceLevel): PerformanceStrategy {
  return { ...STRATEGIES[level] }
}

export function getPerformanceStrategy(level: PerformanceLevel): PerformanceStrategy {
  return cloneStrategy(level)
}

export function createAdaptivePerformanceEngine(options: AdaptivePerformanceEngineOptions = {}): AdaptivePerformanceEngine {
  const storage = options.storage ?? browserStorage()
  const storageKey = options.storageKey ?? DEFAULT_STORAGE_KEY
  const now = options.now ?? (() => Date.now())
  const reducedMotion = options.reducedMotion ?? detectReducedMotion()
  const listeners = new Set<(state: PerformanceState) => void>()
  let current: PerformanceState = {
    level: detectAutomaticLevel(options, reducedMotion),
    source: 'auto',
    reducedMotion,
    updatedAt: now(),
    strategy: cloneStrategy(detectAutomaticLevel(options, reducedMotion)),
  }
  let disposed = false

  const emit = (): void => {
    if (disposed) return
    const snapshot = { ...current, strategy: cloneStrategy(current.level) }
    for (const listener of listeners) listener(snapshot)
  }

  const setLevel = (level: PerformanceLevel, source: PerformanceSource = 'manual'): PerformanceState => {
    if (!PERFORMANCE_LEVELS.includes(level)) throw new Error(`Unsupported performance level: ${level}`)
    current = { ...current, level, source, updatedAt: now(), strategy: cloneStrategy(level) }
    if (source === 'manual' || source === 'restore') storage?.setItem(storageKey, level)
    emit()
    return { ...current, strategy: cloneStrategy(current.level) }
  }

  const restore = (): PerformanceState => {
    const stored = storage?.getItem(storageKey)
    if (stored && (PERFORMANCE_LEVELS as readonly string[]).includes(stored)) return setLevel(stored as PerformanceLevel, 'restore')
    return { ...current, source: current.source, strategy: cloneStrategy(current.level) }
  }

  return {
    get level() { return current.level },
    get state() { return { ...current, strategy: cloneStrategy(current.level) } },
    setLevel,
    restore,
    subscribe(listener) {
      if (disposed) throw new Error('Performance engine has been disposed')
      listeners.add(listener)
      listener({ ...current, strategy: cloneStrategy(current.level) })
      return () => listeners.delete(listener)
    },
    dispose() {
      disposed = true
      listeners.clear()
    },
  }
}
