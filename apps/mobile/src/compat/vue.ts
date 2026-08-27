export * from '@vue/runtime-dom'

// DCloud's H5 runtime checks this internal flag during component setup.
// The mobile shell is not SSR-rendered, so the safe default is false.
export const isInSSRComponentSetup = false

// uni-h5 is compiled against Vue internals that are intentionally not part
// of Vue 3.5's public runtime-dom exports. Keep the adapter small and
// version-local so application code still imports the public Vue surface.
export { onActivated as onBeforeActivate, onDeactivated as onBeforeDeactivate } from '@vue/runtime-dom'
export { createApp as createVueApp } from '@vue/runtime-dom'

export function logError(error: unknown, info?: unknown): void {
  console.error(info ?? 'uni-h5 runtime error', error)
}

type HookTarget = Record<string, unknown>
type LifecycleHook = (...args: never[]) => unknown

// Vue keeps injectHook internal. Uni's lifecycle adapter only needs the same
// append-to-target behavior for its named lifecycle arrays.
export function injectHook(lifecycle: string, hook: LifecycleHook, target?: unknown): LifecycleHook {
  if (!target || typeof target !== 'object') return hook
  const targetRecord = target as HookTarget
  const registered = targetRecord[lifecycle]
  if (Array.isArray(registered)) {
    registered.push(hook)
  } else {
    targetRecord[lifecycle] = [hook]
  }
  return hook
}
