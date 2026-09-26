export const PERFORMANCE_LEVELS = ['Ultra', 'High', 'Medium', 'Performance'] as const

export type PerformanceLevel = (typeof PERFORMANCE_LEVELS)[number]
export type PerformanceSource = 'auto' | 'manual' | 'restore'
export type RenderSurface = 'threeD' | 'waveform' | 'rive' | 'particles'
export type RenderMode = 'full' | 'lightweight' | '2.5d' | 'svg' | 'static'
export type MediaSurface = RenderSurface | 'audioPlayback' | 'offlinePrefetch'

export interface PerformanceSignal {
  frameRate?: number
  memoryPressure?: boolean
  networkQuality?: 'good' | 'degraded' | 'offline'
  offlineStoragePressure?: boolean
}

export interface RenderPolicy {
  surface: RenderSurface
  enabled: boolean
  mode: RenderMode
  budget: number
}

export interface PerformanceStrategy {
  level: PerformanceLevel
  motionScale: number
  particleBudget: number
  textureBudgetMb: number
  enableThreeD: boolean
  enableWaveform: boolean
  enableRive: boolean
  fallbackMode: RenderMode
  maxCanvasPixels: number
  enableHeavyMedia: boolean
  allowOfflinePrefetch: boolean
}

export interface PerformanceState {
  level: PerformanceLevel
  source: PerformanceSource
  reducedMotion: boolean
  motionDisabled: boolean
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
  motionDisabled?: boolean
}

export interface AdaptivePerformanceEngine {
  readonly level: PerformanceLevel
  readonly state: PerformanceState
  setLevel(level: PerformanceLevel, source?: PerformanceSource): PerformanceState
  resetLevelToAutomatic(): PerformanceState
  setMotionDisabled(disabled: boolean, source?: PerformanceSource): PerformanceState
  observe(signal: PerformanceSignal): PerformanceState
  getRenderPolicy(surface: RenderSurface): RenderPolicy
  getMediaPolicy(surface: MediaSurface): { enabled: boolean; mode: RenderMode | 'native' | 'cache-only'; budget: number }
  restore(): PerformanceState
  subscribe(listener: (state: PerformanceState) => void): () => void
  dispose(): void
}

const DEFAULT_STORAGE_KEY = 'yx.performance.level'

const STRATEGIES: Record<PerformanceLevel, PerformanceStrategy> = {
  Ultra: { level: 'Ultra', motionScale: 1, particleBudget: 100, textureBudgetMb: 512, enableThreeD: true, enableWaveform: true, enableRive: true, fallbackMode: 'full', maxCanvasPixels: 4096 * 4096, enableHeavyMedia: true, allowOfflinePrefetch: true },
  High: { level: 'High', motionScale: 0.85, particleBudget: 64, textureBudgetMb: 256, enableThreeD: true, enableWaveform: true, enableRive: true, fallbackMode: 'lightweight', maxCanvasPixels: 3072 * 3072, enableHeavyMedia: true, allowOfflinePrefetch: true },
  Medium: { level: 'Medium', motionScale: 0.55, particleBudget: 24, textureBudgetMb: 128, enableThreeD: true, enableWaveform: false, enableRive: true, fallbackMode: '2.5d', maxCanvasPixels: 2048 * 2048, enableHeavyMedia: false, allowOfflinePrefetch: true },
  Performance: { level: 'Performance', motionScale: 0, particleBudget: 0, textureBudgetMb: 64, enableThreeD: false, enableWaveform: false, enableRive: false, fallbackMode: 'static', maxCanvasPixels: 1024 * 1024, enableHeavyMedia: false, allowOfflinePrefetch: false },
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

function cloneStrategy(level: PerformanceLevel, motionDisabled = false): PerformanceStrategy {
  const strategy = { ...STRATEGIES[level] }
  return motionDisabled ? { ...strategy, motionScale: 0, particleBudget: 0 } : strategy
}

function previousLevel(level: PerformanceLevel): PerformanceLevel {
  const index = PERFORMANCE_LEVELS.indexOf(level)
  return PERFORMANCE_LEVELS[Math.min(PERFORMANCE_LEVELS.length - 1, index + 1)]
}

export function getRenderPolicy(level: PerformanceLevel, surface: RenderSurface): RenderPolicy {
  const strategy = STRATEGIES[level]
  if (surface === 'threeD') return { surface, enabled: strategy.enableThreeD, mode: strategy.fallbackMode, budget: strategy.textureBudgetMb }
  if (surface === 'waveform') return { surface, enabled: strategy.enableWaveform, mode: strategy.enableWaveform ? strategy.fallbackMode : 'static', budget: strategy.textureBudgetMb }
  if (surface === 'rive') return { surface, enabled: strategy.enableRive, mode: strategy.enableRive ? strategy.fallbackMode : 'static', budget: strategy.particleBudget }
  return { surface, enabled: strategy.particleBudget > 0, mode: strategy.particleBudget > 0 ? strategy.fallbackMode : 'static', budget: strategy.particleBudget }
}

export function getPerformanceStrategy(level: PerformanceLevel): PerformanceStrategy {
  return cloneStrategy(level)
}

export function getMediaPolicy(level: PerformanceLevel, surface: MediaSurface, motionDisabled = false): { enabled: boolean; mode: RenderMode | 'native' | 'cache-only'; budget: number } {
  const strategy = cloneStrategy(level, motionDisabled)
  if (surface === 'audioPlayback') return { enabled: true, mode: 'native', budget: strategy.textureBudgetMb }
  if (surface === 'offlinePrefetch') return { enabled: strategy.allowOfflinePrefetch, mode: strategy.allowOfflinePrefetch ? 'cache-only' : 'static', budget: strategy.textureBudgetMb }
  const policy = getRenderPolicy(level, surface)
  if (motionDisabled && (surface === 'rive' || surface === 'particles')) return { enabled: false, mode: 'static', budget: 0 }
  return policy
}

export function createAdaptivePerformanceEngine(options: AdaptivePerformanceEngineOptions = {}): AdaptivePerformanceEngine {
  const storage = options.storage ?? browserStorage()
  const storageKey = options.storageKey ?? DEFAULT_STORAGE_KEY
  const now = options.now ?? (() => Date.now())
  const reducedMotion = options.reducedMotion ?? detectReducedMotion()
  let motionDisabled = options.motionDisabled ?? reducedMotion
  const listeners = new Set<(state: PerformanceState) => void>()
  let current: PerformanceState = {
    level: detectAutomaticLevel(options, reducedMotion),
    source: 'auto',
    reducedMotion,
    updatedAt: now(),
    motionDisabled,
    strategy: cloneStrategy(detectAutomaticLevel(options, reducedMotion), motionDisabled),
  }
  let disposed = false

  const emit = (): void => {
    if (disposed) return
    const snapshot = { ...current, strategy: cloneStrategy(current.level, current.motionDisabled) }
    for (const listener of listeners) listener(snapshot)
  }

  const setLevel = (level: PerformanceLevel, source: PerformanceSource = 'manual'): PerformanceState => {
    if (!PERFORMANCE_LEVELS.includes(level)) throw new Error(`Unsupported performance level: ${level}`)
    current = { ...current, level, source, updatedAt: now(), strategy: cloneStrategy(level, current.motionDisabled) }
    if (source === 'manual' || source === 'restore') storage?.setItem(storageKey, level)
    emit()
    return { ...current, strategy: cloneStrategy(current.level, current.motionDisabled) }
  }

  const resetLevelToAutomatic = (): PerformanceState => {
    if (storage && !storage.removeItem) throw new Error('Performance storage cannot clear a saved level')
    storage?.removeItem?.(storageKey)
    return setLevel(detectAutomaticLevel(options, reducedMotion), 'auto')
  }

  const setMotionDisabled = (disabled: boolean, source: PerformanceSource = 'manual'): PerformanceState => {
    motionDisabled = disabled
    current = { ...current, motionDisabled, source, updatedAt: now(), strategy: cloneStrategy(current.level, motionDisabled) }
    if (source === 'manual' || source === 'restore') storage?.setItem(`${storageKey}:motion`, disabled ? 'off' : 'on')
    emit()
    return { ...current, strategy: cloneStrategy(current.level, current.motionDisabled) }
  }

  const observe = (signal: PerformanceSignal): PerformanceState => {
    const shouldDegrade = (signal.frameRate !== undefined && signal.frameRate < 30)
      || signal.memoryPressure === true
      || signal.networkQuality === 'offline'
      || signal.offlineStoragePressure === true
    if (shouldDegrade && current.level !== 'Performance') return setLevel(previousLevel(current.level), 'auto')
    return { ...current, strategy: cloneStrategy(current.level, current.motionDisabled) }
  }

  const restore = (): PerformanceState => {
    const stored = storage?.getItem(storageKey)
    const storedMotion = storage?.getItem(`${storageKey}:motion`)
    if (storedMotion === 'off' || storedMotion === 'on') motionDisabled = storedMotion === 'off'
    if (stored && (PERFORMANCE_LEVELS as readonly string[]).includes(stored)) return setLevel(stored as PerformanceLevel, 'restore')
    current = { ...current, motionDisabled, source: current.source, strategy: cloneStrategy(current.level, motionDisabled) }
    return { ...current, strategy: cloneStrategy(current.level, current.motionDisabled) }
  }

  return {
    get level() { return current.level },
    get state() { return { ...current, strategy: cloneStrategy(current.level, current.motionDisabled) } },
    setLevel,
    resetLevelToAutomatic,
    setMotionDisabled,
    observe,
    getRenderPolicy: (surface) => getRenderPolicy(current.level, surface),
    getMediaPolicy: (surface) => getMediaPolicy(current.level, surface, current.motionDisabled),
    restore,
    subscribe(listener) {
      if (disposed) throw new Error('Performance engine has been disposed')
      listeners.add(listener)
      listener({ ...current, strategy: cloneStrategy(current.level, current.motionDisabled) })
      return () => listeners.delete(listener)
    },
    dispose() {
      disposed = true
      listeners.clear()
    },
  }
}
