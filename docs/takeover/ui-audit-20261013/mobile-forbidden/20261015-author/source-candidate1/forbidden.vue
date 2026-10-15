<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { onHide, onReady, onShow } from '@dcloudio/uni-app'
import AppIcon from '../../components/AppIcon.vue'
import { mobileT, useMobileExperience } from '../../platform/experience'
import { getUniRuntime } from '../../platform/uni-runtime'
import { useSessionStore } from '../../stores/session'

type SessionStore = ReturnType<typeof useSessionStore>
type Identity = NonNullable<ReturnType<SessionStore['getMobileApiIdentity']>>
type Action = 'read' | 'account' | 'help' | 'logout' | 'login'
const { experienceStyle, experienceMotion } = useMobileExperience()
const session = useSessionStore()
const pending = ref<Action | null>(null)
const verifiedOwner = ref<Identity | null>(null)
const readFailed = ref(false)
const actionError = ref<string | null>(null)
let active = false
let operation = 0
let restoringOperation: number | null = null
let navigationReady = false
const busy = computed(() => pending.value !== null)
const canManageAccount = computed(() => session.isAuthenticated)
function sameOwner(owner: Identity): boolean {
  const current = session.getMobileApiIdentity()
  return session.isAuthenticated && current?.subject === owner.subject && current.revision === owner.revision
}
function current(request: number): boolean { return active && operation === request }
const reason = computed(() => {
  if (readFailed.value || !verifiedOwner.value || !sameOwner(verifiedOwner.value) || session.adultGate === 'UNKNOWN') return 'unknown'
  if (session.adultGate === 'REJECTED') return 'adult'
  // A sticky safety marker does not establish an owner-scoped withdrawal.
  if (session.learningConsentWithdrawn) return 'paused'
  return 'generic'
})
const title = computed(() => mobileT('forbidden.' + reason.value + 'Title'))
const description = computed(() => mobileT('forbidden.' + reason.value + 'Description'))
const pendingLabel = computed(() => mobileT('forbidden.' + (pending.value === 'read' ? 'checking' : pending.value === 'logout' ? 'signingOut' : 'opening')))
watch(title, () => { if (active && navigationReady) uni.setNavigationBarTitle({ title: title.value }) })
onReady(() => { navigationReady = true; uni.setNavigationBarTitle({ title: title.value }) })

function leave(): void {
  active = false; operation++; restoringOperation = null
  pending.value = null; verifiedOwner.value = null; readFailed.value = false; actionError.value = null
}
onHide(leave)
onBeforeUnmount(leave)
onBeforeUnmount(() => { navigationReady = false })
onShow(() => { active = true; void readCurrent() })

watch(() => session.identityRevision, () => {
  verifiedOwner.value = null
  if (restoringOperation === operation) return
  // logout intentionally clears this owner's identity before its request settles.
  if (pending.value === 'logout' && !session.getMobileApiIdentity() && !session.isAuthenticated) return
  operation++; pending.value = null; readFailed.value = false; actionError.value = null
  if (active) void nextTick().then(() => { if (active && !pending.value) void readCurrent() })
}, { flush: 'sync' })

async function readCurrent(): Promise<void> {
  if (!active || busy.value) return
  const request = ++operation
  pending.value = 'read'; verifiedOwner.value = null; readFailed.value = false; actionError.value = null
  try {
    restoringOperation = request
    await session.restore()
    if (restoringOperation === request) restoringOperation = null
    if (!current(request)) return
    const owner = session.getMobileApiIdentity()
    if (!session.isAuthenticated || !owner) return
    await session.refreshGateFromServer()
    if (current(request) && sameOwner(owner)) verifiedOwner.value = owner
  } catch {
    if (current(request)) { readFailed.value = true; actionError.value = 'readFailed' }
  } finally {
    if (restoringOperation === request) restoringOperation = null
    if (current(request)) pending.value = null
  }
}
async function navigate(url: string, publicExit = false): Promise<void> {
  const runtime = getUniRuntime()
  if (publicExit && runtime.reLaunch) await runtime.reLaunch({ url })
  else await runtime.navigateTo({ url })
}
const loginPath = '/pages/login/login?returnTo=%2Fpages%2Fsettings%2Fsettings'
async function open(action: 'account' | 'help' | 'login'): Promise<void> {
  if (!active || busy.value) return
  const owner = session.getMobileApiIdentity()
  if (action !== 'login' && (!owner || !session.isAuthenticated)) return
  const request = ++operation
  pending.value = action; actionError.value = null
  try {
    await session.restore()
    if (!current(request)) return
    if (action === 'login') {
      if (session.isAuthenticated || session.getMobileApiIdentity()) {
        pending.value = null; void readCurrent(); return
      }
      await navigate(loginPath, true)
    } else {
      if (!owner || !sameOwner(owner)) return
      await navigate(action === 'account' ? '/pages/settings/settings' : '/pages/support/support')
    }
  } catch { if (current(request)) actionError.value = 'navigationFailed' }
  finally { if (current(request)) pending.value = null }
}
async function logout(): Promise<void> {
  if (!active || busy.value || !session.isAuthenticated || !session.getMobileApiIdentity()) return
  const request = ++operation
  pending.value = 'logout'; actionError.value = null
  try {
    const acknowledged = await session.logout()
    if (!current(request) || session.getMobileApiIdentity() || session.status !== 'unauthenticated') return
    if (!acknowledged) { actionError.value = 'logoutUnconfirmed'; return }
    try { await navigate(loginPath, true) }
    catch { if (current(request)) actionError.value = 'navigationFailed' }
  } catch {
    if (current(request)) actionError.value = 'logoutFailed'
  } finally { if (current(request)) pending.value = null }
}
</script>

<template>
  <view class="yx-page forbidden-page" :style="experienceStyle" :data-motion="experienceMotion" :aria-busy="busy">
    <view class="forbidden-shell">
      <view class="forbidden-brand"><AppIcon name="brand" :size="25" /><text>{{ mobileT('brand') }}</text></view>
      <view class="forbidden-content" aria-labelledby="mobile-forbidden-title" aria-describedby="mobile-forbidden-description">
        <AppIcon class="forbidden-lock" name="lock" :size="22" />
        <text id="mobile-forbidden-title" class="forbidden-title" role="heading" aria-level="1">{{ title }}</text>
        <text id="mobile-forbidden-description" class="forbidden-description">{{ description }}</text>
        <view class="forbidden-actions">
          <template v-if="canManageAccount">
            <button class="forbidden-primary" role="button" tabindex="0" :disabled="busy" :aria-disabled="busy" @click="open('account')" @keydown.enter.stop.prevent @keyup.enter.stop.prevent="open('account')" @keydown.space.stop.prevent @keyup.space.stop.prevent="open('account')">{{ mobileT('forbidden.account') }}</button>
            <button class="forbidden-secondary" role="button" tabindex="0" :disabled="busy" :aria-disabled="busy" @click="open('help')" @keydown.enter.stop.prevent @keyup.enter.stop.prevent="open('help')" @keydown.space.stop.prevent @keyup.space.stop.prevent="open('help')">{{ mobileT('forbidden.help') }}</button>
          </template>
          <button v-else class="forbidden-primary" role="button" tabindex="0" :disabled="busy" :aria-disabled="busy" @click="open('login')" @keydown.enter.stop.prevent @keyup.enter.stop.prevent="open('login')" @keydown.space.stop.prevent @keyup.space.stop.prevent="open('login')">{{ mobileT('forbidden.login') }}</button>
          <text v-if="pending" class="forbidden-status" role="status" aria-live="polite">{{ pendingLabel }}</text>
          <text v-if="actionError" class="forbidden-error" role="alert">{{ mobileT('forbidden.' + actionError) }}</text>
          <button v-if="readFailed" class="forbidden-text" role="button" tabindex="0" :disabled="busy" :aria-disabled="busy" @click="readCurrent" @keydown.enter.stop.prevent @keyup.enter.stop.prevent="readCurrent()" @keydown.space.stop.prevent @keyup.space.stop.prevent="readCurrent()">{{ mobileT('forbidden.reload') }}</button>
        </view>
      </view>
      <view v-if="canManageAccount" class="forbidden-exit">
        <button class="forbidden-text" role="button" tabindex="0" :disabled="busy" :aria-disabled="busy" @click="logout" @keydown.enter.stop.prevent @keyup.enter.stop.prevent="logout()" @keydown.space.stop.prevent @keyup.space.stop.prevent="logout()">{{ mobileT('forbidden.logout') }}</button>
      </view>
    </view>
  </view>
</template>

<style scoped>
.forbidden-page { box-sizing: border-box; min-width: 0; min-height: 100vh; padding: calc(24px + env(safe-area-inset-top)) 24px calc(40px + env(safe-area-inset-bottom)); background: var(--v2-bg); color: var(--v2-ink); font-family: var(--v2-font); }
.forbidden-shell { width: 100%; max-width: 420px; min-width: 0; margin: 0 auto; }
.forbidden-brand { display: inline-flex; align-items: center; gap: 10px; min-height: 44px; font-size: 20px; font-weight: 650; }
.forbidden-brand :deep(.app-icon) { color: var(--v2-brand); }
.forbidden-content { margin-top: clamp(40px, 10vh, 88px); }
.forbidden-lock { margin-bottom: 20px; color: var(--v2-mut); }
.forbidden-title { display: block; margin: 0; font-size: 28px; font-weight: 650; line-height: 1.4; overflow-wrap: break-word; }
.forbidden-description { display: block; margin-top: 20px; color: var(--v2-mut); font-size: 14px; line-height: 1.75; overflow-wrap: break-word; }
.forbidden-actions { display: grid; gap: 16px; margin-top: clamp(32px, 7vh, 64px); }
.forbidden-primary, .forbidden-secondary { box-sizing: border-box; display: flex; align-items: center; justify-content: center; width: 100%; min-width: 0; min-height: 48px; margin: 0; padding: 12px 18px; border: 1px solid transparent; border-radius: 10px; font: inherit; font-size: 16px; font-weight: 600; line-height: 1.5; white-space: normal; overflow-wrap: break-word; }
.forbidden-primary { background: var(--v2-brand); color: var(--v2-inverse); }
.forbidden-primary:active:not([disabled]) { background: var(--v2-brand2); }
.forbidden-secondary { border-color: var(--v2-mut); background: transparent; color: var(--v2-ink); }
.forbidden-exit { margin-top: clamp(32px, 8vh, 64px); padding-top: 16px; border-top: 1px solid var(--v2-line); }
.forbidden-text { display: flex; align-items: center; justify-content: center; min-height: 44px; min-width: 44px; width: 100%; margin: 0; padding: 10px 0; border: 0; border-radius: 6px; background: transparent; color: var(--v2-mut); font: inherit; font-size: 14px; line-height: 1.6; white-space: normal; overflow-wrap: break-word; }
.forbidden-error, .forbidden-status { display: block; font-size: 13px; line-height: 1.6; overflow-wrap: anywhere; }
.forbidden-error { color: var(--v2-bad); }
.forbidden-status { color: var(--v2-mut); }
.forbidden-page button[disabled] { opacity: .6; cursor: default; }
.forbidden-page button:focus-visible { outline: 2px solid var(--v2-brand); outline-offset: 3px; }
@media (max-height: 600px) { .forbidden-content { margin-top: 32px; } .forbidden-actions, .forbidden-exit { margin-top: 28px; } }
@media (min-width: 768px) { .forbidden-page { padding-top: calc(40px + env(safe-area-inset-top)); padding-bottom: calc(64px + env(safe-area-inset-bottom)); } }
</style>
