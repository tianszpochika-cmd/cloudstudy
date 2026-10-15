import { nextTick, onMounted, onUnmounted, shallowRef } from 'vue'

type PointerFeedbackOptions<T> = {
  root: () => HTMLElement | null
  actions: string
  capture: () => T
  disabled: () => boolean
  afterRelease: () => void
}

/** Keep feedback geometry stable from a real H5 press through its click. */
export function usePointerFeedback<T>(options: PointerFeedbackOptions<T>) {
  const snapshot = shallowRef<T | null>(null)
  // #ifdef H5
  let gesture: { id: number; action: Element } | null = null
  let mounted = false
  function release(): void {
    gesture = null
    snapshot.value = null
    if (mounted) void nextTick().then(() => { if (mounted) options.afterRelease() })
  }
  function start(event: PointerEvent): void {
    const root = options.root()
    const action = event.target instanceof Element ? event.target.closest(options.actions) : null
    if (!root || !action || !root.contains(action) || !event.isPrimary || event.button !== 0 || options.disabled()) return
    snapshot.value = options.capture()
    gesture = { id: event.pointerId, action }
  }
  function end(event: PointerEvent): void {
    if (!gesture || event.pointerId !== gesture.id) return
    // Blur can enable an action after pointerdown; only the final state decides
    // whether a closing click is possible on a uni action.
    const action = gesture.action
    if (action.matches(':disabled') || action.getAttribute('aria-disabled') === 'true' || (action.hasAttribute('disabled') && action.getAttribute('disabled') !== 'false')) { release(); return }
    const rect = gesture.action.getBoundingClientRect()
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) release()
    // A release within the action retains feedback through the real click.
  }
  function cancel(event: PointerEvent): void { if (gesture?.id === event.pointerId) release() }
  function clicked(): void { if (gesture) release() }
  function interrupted(): void { if (gesture) release() }
  function windowBlur(event: FocusEvent): void { if (event.target === window) interrupted() }
  function visibility(): void { if (document.hidden) interrupted() }
  onMounted(() => {
    mounted = true
    document.addEventListener('pointerdown', start, true)
    document.addEventListener('pointerup', end, true)
    document.addEventListener('pointercancel', cancel, true)
    document.addEventListener('click', clicked)
    document.addEventListener('contextmenu', interrupted, true)
    document.addEventListener('dragstart', interrupted, true)
    document.addEventListener('visibilitychange', visibility)
    window.addEventListener('blur', windowBlur)
  })
  onUnmounted(() => {
    mounted = false
    document.removeEventListener('pointerdown', start, true)
    document.removeEventListener('pointerup', end, true)
    document.removeEventListener('pointercancel', cancel, true)
    document.removeEventListener('click', clicked)
    document.removeEventListener('contextmenu', interrupted, true)
    document.removeEventListener('dragstart', interrupted, true)
    document.removeEventListener('visibilitychange', visibility)
    window.removeEventListener('blur', windowBlur)
    release()
  })
  // #endif
  return snapshot
}
