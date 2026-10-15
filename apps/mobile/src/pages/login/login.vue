<script setup lang="ts">
import AppIcon from '../../components/AppIcon.vue'
import { openUniPage } from '../../platform/uni-runtime'
import { mobileT, useMobileExperience } from '../../platform/experience'
import { onLoad, onReady } from '@dcloudio/uni-app'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { authT } from '../../auth/i18n'
import { mobileAuthFailureCopy } from '../../auth/auth-failure-copy'
import { continueAfterLogin } from '../../auth/navigation'
import { safeMobileRouteReturnTo } from '../../auth/gateway-auth'
import { useSessionStore } from '../../stores/session'

const { experienceStyle, experienceMotion } = useMobileExperience()
const session = useSessionStore()
type Field = 'identifier' | 'password'
type FieldEvent = { detail?: { value?: string } }
type SubmitEvent = { detail?: { value?: Partial<Record<Field, string>> } }
const showPassword = ref(false)
const identifier = ref('')
const password = ref('')
const returnTo = ref('/pages/home/home')
const submitting = ref(false)
const initialized = ref(false)
const error = ref<string | null>(null)
const lastErrorText = ref<string | null>(null)
const requiredError = ref(false)
const validationAttempted = ref(false)
const identifierMissing = computed(() => validationAttempted.value && !identifier.value.trim())
const passwordMissing = computed(() => validationAttempted.value && !password.value)
const identifierFocused = ref(false)
const passwordFocused = ref(false)
const identifierField = ref<{ $el?: HTMLElement } | null>(null)
const passwordField = ref<{ $el?: HTMLElement } | null>(null)
watch(error, (value) => { if (value) lastErrorText.value = value }, { flush: 'sync' })
let passwordControls = 'mobile-login-password-host'
// #ifdef H5
passwordControls = 'mobile-login-password'
// #endif

watch([identifier, password], () => {
  if (requiredError.value && identifier.value.trim() && password.value) {
    requiredError.value = false
    error.value = null
  }
})

// Keep uni-input and its focus/model handling on every platform. This version of
// uni-h5 passes ARIA to the wrapper and limits native autocomplete to off/code.
// The H5-only bridge supplies semantics to the actual input, without reading values.
// #ifdef H5
function syncNativeInput(host: { $el?: HTMLElement } | null, kind: 'identifier' | 'password'): void {
  const input = host?.$el?.querySelector<HTMLInputElement>('.uni-input-input')
  if (!input) return
  const missing = kind === 'identifier' ? identifierMissing.value : passwordMissing.value
  const attributes: Record<string, string | null> = {
    id: `mobile-login-${kind}`,
    name: kind,
    autocomplete: kind === 'identifier' ? 'username' : 'current-password',
    autocapitalize: 'none',
    spellcheck: 'false',
    required: '',
    'aria-label': authT(`login.${kind}`),
    'aria-labelledby': `mobile-login-${kind}-label`,
    'aria-invalid': missing ? 'true' : null,
    'aria-describedby': missing && error.value ? 'mobile-login-error' : null,
  }
  for (const [name, value] of Object.entries(attributes)) {
    if (value === null) input.removeAttribute(name)
    else input.setAttribute(name, value)
  }
}
function syncNativeInputs(): void {
  syncNativeInput(identifierField.value, 'identifier')
  syncNativeInput(passwordField.value, 'password')
}
// Uni's view/form slots can update without updating the page component itself.
// Watch the semantic state explicitly, after their render flush, and synchronize
// after the child input patch; a page onUpdated hook does not cover these slots.
watch([
  identifier, password, identifierMissing, passwordMissing, error, submitting,
  showPassword, identifierFocused, passwordFocused,
  () => authT('login.identifier'), () => authT('login.password'),
], async () => {
  await nextTick()
  syncNativeInputs()
}, { flush: 'post' })
// #endif

async function focusField(kind: 'identifier' | 'password'): Promise<void> {
  if (submitting.value) return
  identifierFocused.value = false
  passwordFocused.value = false
  await nextTick()
  if (submitting.value) return
  if (kind === 'identifier') identifierFocused.value = true
  else passwordFocused.value = true
}

function timeout<T>(promise: Promise<T>, milliseconds: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  const expired = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), milliseconds)
  })
  return Promise.race([promise, expired]).finally(() => clearTimeout(timer))
}

async function initialize(options?: { returnTo?: string; redirect?: string }): Promise<void> {
  if (initialized.value) return
  initialized.value = true
  const requested = safeMobileRouteReturnTo(options?.returnTo ?? options?.redirect, '')
  returnTo.value = requested || safeMobileRouteReturnTo(session.peekReturnTo())
  session.setReturnTo(returnTo.value)
  try {
    await timeout(session.restore(), 1500, '会话恢复超时')
    if (session.isAuthenticated) await continueAfterLogin(session.consumeReturnTo())
  } catch {
    // An unavailable existing session leaves the public login form usable.
  }
}

onLoad((options) => { void initialize(options) })
onReady(() => { uni.setNavigationBarTitle({ title: mobileT('auth.login.start') }) })
onMounted(() => {
  void initialize()
  // #ifdef H5
  syncNativeInputs()
  // #endif
})

function navigate(path: string): void {
  if (!submitting.value) openUniPage(path)
}

function togglePassword(): void {
  if (!submitting.value) showPassword.value = !showPassword.value
}

function syncField(kind: Field, value: unknown): void {
  if (submitting.value || typeof value !== 'string') return
  if (kind === 'identifier') identifier.value = value
  else password.value = value
}

function blurField(kind: Field, event: FieldEvent): void {
  // Uni's model update may be throttled; its field events carry the current value.
  syncField(kind, event.detail?.value)
  if (kind === 'identifier') identifierFocused.value = false
  else passwordFocused.value = false
}

function confirmNext(event: FieldEvent): void {
  syncField('identifier', event.detail?.value)
  void focusField('password')
}

async function confirmSubmit(event: FieldEvent): Promise<void> {
  syncField('password', event.detail?.value)
  await submit()
}

async function submit(event?: SubmitEvent): Promise<void> {
  if (submitting.value) return
  // Named uni-form values are current even before a pending model update arrives.
  for (const kind of ['identifier', 'password'] as const) syncField(kind, event?.detail?.value?.[kind])
  validationAttempted.value = true
  error.value = null
  requiredError.value = false
  if (!identifier.value.trim() || !password.value) {
    requiredError.value = true
    error.value = authT('login.required')
    await focusField(!identifier.value.trim() ? 'identifier' : 'password')
    return
  }
  submitting.value = true
  try {
    // The IAM and permission requests already have bounded client timeouts.
    // A separate page race could unlock this form while the login still runs.
    const success = await session.login(identifier.value, password.value)
    if (!success) {
      error.value = mobileAuthFailureCopy('login', session.lastError, mobileT)
      return
    }
    password.value = ''
    await continueAfterLogin(session.consumeReturnTo())
  } catch (cause) {
    error.value = mobileAuthFailureCopy('login', cause, mobileT)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <view class="yx-page v2-login" :style="experienceStyle" :data-motion="experienceMotion">
    <view class="login-topline">
      <view class="login-brand"><AppIcon name="brand" :size="25" /><text>{{ mobileT('brand') }}</text></view>
      <text class="login-adult-note">{{ mobileT('auth.login.note') }}</text>
    </view>
    <view class="login-content" aria-labelledby="mobile-login-title">
      <text id="mobile-login-title" class="login-title" role="heading" aria-level="1">{{ mobileT('auth.login.title') }}</text>
      <text class="login-description">{{ mobileT('auth.login.description') }}</text>
      <!-- Uni submit is a component event, not a native form event. -->
      <form class="login-form" :aria-busy="submitting" @submit="submit">
        <view class="login-fields">
        <view class="login-field">
          <label id="mobile-login-identifier-label" class="login-label" for="mobile-login-identifier-host" @click="focusField('identifier')">{{ authT('login.identifier') }}</label>
          <input
            id="mobile-login-identifier-host"
            ref="identifierField"
            v-model="identifier"
            name="identifier"
            class="login-input"
            :class="{ 'is-invalid': identifierMissing, 'is-focused': identifierFocused }"
            type="text"
            text-content-type="username"
            confirm-type="next"
            :focus="identifierFocused"
            :placeholder="authT('login.identifierPlaceholder')"
            :disabled="submitting"
            :aria-invalid="identifierMissing || undefined"
            :aria-describedby="identifierMissing && error ? 'mobile-login-error' : undefined"
            @focus="identifierFocused = true"
            @blur="blurField('identifier', $event)"
            @confirm="confirmNext"
          />
        </view>
        <view class="login-field">
          <label id="mobile-login-password-label" class="login-label" for="mobile-login-password-host" @click="focusField('password')">{{ authT('login.password') }}</label>
          <view class="login-password">
            <input
              id="mobile-login-password-host"
              ref="passwordField"
              v-model="password"
              name="password"
              class="login-input"
              :class="{ 'is-invalid': passwordMissing, 'is-focused': passwordFocused }"
              :password="!showPassword"
              type="text"
              text-content-type="password"
              confirm-type="go"
              :focus="passwordFocused"
              :placeholder="authT('login.passwordPlaceholder')"
              :disabled="submitting"
              :aria-invalid="passwordMissing || undefined"
              :aria-describedby="passwordMissing && error ? 'mobile-login-error' : undefined"
              @focus="passwordFocused = true"
              @blur="blurField('password', $event)"
              @confirm="confirmSubmit"
            />
            <button
              class="login-password-toggle"
              tabindex="0"
              role="button"
              :aria-controls="passwordControls"
              :aria-label="mobileT(showPassword ? 'auth.login.hidePassword' : 'auth.login.showPassword')"
              :aria-pressed="showPassword"
              :disabled="submitting"
              :aria-disabled="submitting"
              @click="togglePassword"
            ><AppIcon name="eye" :size="19" /></button>
          </view>
          <view class="login-recovery"><button class="login-text-button" tabindex="0" role="button" :disabled="submitting" :aria-disabled="submitting" @click="navigate('/pages/reset-password/reset-password')">{{ mobileT('forgot') }}</button></view>
        </view>
        <text v-if="lastErrorText" :id="error ? 'mobile-login-error' : undefined" class="login-error" :class="{ 'is-cleared': !error }" :role="error ? 'alert' : undefined" :aria-hidden="!error || undefined">{{ error || lastErrorText }}</text>
        <button class="login-submit" tabindex="0" role="button" form-type="submit" :disabled="submitting" :aria-disabled="submitting" @keydown.enter.stop.prevent @keyup.enter.stop.prevent="submit()" @keydown.space.stop.prevent @keyup.space.stop.prevent="submit()">{{ submitting ? authT('login.submitting') : mobileT('auth.login.start') }}</button>
        </view>
      </form>
      <view class="login-register"><text>{{ mobileT('auth.login.noAccount') }}</text><button class="login-text-button" tabindex="0" role="button" :disabled="submitting" :aria-disabled="submitting" @click="navigate('/pages/register/register')">{{ mobileT('register') }}</button></view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.yx-page.v2-login {
  max-width: none;
  min-height: 100vh;
  min-height: 100dvh;
  padding: calc(20px + env(safe-area-inset-top)) 24px calc(40px + env(safe-area-inset-bottom));
  background: var(--v2-bg);
  color: var(--v2-ink);
  font-family: var(--v2-font);
  line-height: 1.6;
}
.login-topline { display: flex; flex-direction: column; align-items: flex-start; max-width: 1080px; margin: 0 auto 40px; }
.login-brand { display: inline-flex; min-height: 44px; align-items: center; gap: 10px; color: var(--v2-ink); font-size: 20px; font-weight: 650; white-space: nowrap; }
.login-brand :deep(.app-icon) { color: var(--v2-brand); }
.login-adult-note { color: var(--v2-mut); font-size: 13px; line-height: 1.6; overflow-wrap: anywhere; }
.login-content { width: 100%; max-width: 420px; margin: 0 auto; }
.login-title { display: block; margin: 0 0 8px; color: var(--v2-ink); text-align: center; font-size: 28px; line-height: 1.4; font-weight: 650; letter-spacing: 0; }
.login-description { display: block; color: var(--v2-mut); text-align: center; font-size: 14px; line-height: 1.75; }
.login-form { display: block; margin-top: 32px; }
.login-fields { display: grid; gap: 24px; }
.login-field { display: grid; gap: 8px; min-width: 0; }
.login-label { color: var(--v2-ink); font-size: 14px; line-height: 1.6; font-weight: 500; }
.v2-login .login-input { width: 100%; height: calc(1.5em + 24px); min-height: 48px; padding: 0 14px; border: 1px solid var(--v2-line); border-radius: 10px; color: var(--v2-ink); background: var(--v2-card); font-size: 16px; line-height: 1.5; font-weight: 400; }
.login-input :deep(.uni-input-input), .login-input :deep(.uni-input-placeholder) { font: inherit; color: inherit; }
.login-input :deep(.uni-input-placeholder) { color: var(--v2-mut); }
.v2-login .login-input.is-invalid { border-color: var(--v2-bad); }
.v2-login .login-input.is-focused, .v2-login .login-input:focus-within { outline: 2px solid var(--v2-brand); outline-offset: 2px; }
.login-password { position: relative; min-width: 0; }
.v2-login .login-password .login-input { padding-right: 58px; }
.v2-login .login-password-toggle { position: absolute; top: 50%; right: 4px; display: flex; width: 44px; height: 44px; min-height: 44px; padding: 0; align-items: center; justify-content: center; transform: translateY(-50%); border: 0; border-radius: 8px; background: transparent; color: var(--v2-mut); }
.v2-login .login-password-toggle:active:not([disabled]) { transform: translateY(-50%); background: var(--v2-soft); }
.login-recovery { display: flex; justify-content: flex-end; margin-top: -4px; }
.v2-login .login-text-button { display: inline-flex; width: auto; min-width: 44px; min-height: 44px; margin: 0; padding: 8px 0; align-items: center; justify-content: center; border: 0; border-radius: 0; background: transparent; color: var(--v2-brand); font-size: 14px; line-height: 1.6; font-weight: 500; text-align: center; }
.login-error { display: block; color: var(--v2-bad); font-size: 14px; line-height: 1.6; overflow-wrap: anywhere; }
.login-error.is-cleared { visibility: hidden; }
.v2-login .login-submit { display: flex; width: 100%; min-height: 48px; margin: 0; padding: 12px 20px; align-items: center; justify-content: center; border: 1px solid transparent; border-radius: 10px; background: var(--v2-brand); color: var(--v2-inverse); box-shadow: none; font-size: 16px; line-height: 1.5; font-weight: 600; }
.v2-login .login-submit:active:not([disabled]) { transform: none; background: var(--v2-brand2); }
.v2-login button[disabled] { cursor: default; }
.v2-login .login-submit[disabled] { opacity: .6; }
.v2-login button:focus-visible { outline: 2px solid var(--v2-brand); outline-offset: 3px; }
.login-register { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 4px 8px; margin-top: 28px; padding-top: 16px; border-top: 1px solid var(--v2-line); color: var(--v2-mut); font-size: 14px; line-height: 1.6; }
@media (min-width: 521px) {
  .yx-page.v2-login { padding: calc(32px + env(safe-area-inset-top)) 32px calc(64px + env(safe-area-inset-bottom)); }
  .login-topline { flex-direction: row; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 80px; }
}
@media (prefers-reduced-motion: reduce) {
  .v2-login * { transition: none; animation: none; }
}
</style>
