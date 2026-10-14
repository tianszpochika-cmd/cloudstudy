<script setup lang="ts">
import AppIcon from '../../components/AppIcon.vue'
import { openUniPage } from '../../platform/uni-runtime'
import { mobileT, useMobileExperience } from '../../platform/experience'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { continueAfterLogin } from '../../auth/navigation'
import { safeMobileRouteReturnTo } from '../../auth/gateway-auth'
import { mobileAuthFailureCopy } from '../../auth/auth-failure-copy'
import { useSessionStore } from '../../stores/session'

const { experienceStyle, experienceMotion } = useMobileExperience()
const session = useSessionStore()
type Field = 'identifier' | 'password' | 'confirm'
type FieldEvent = { detail?: { value?: string } }
type SubmitEvent = { detail?: { value?: Partial<Record<Field, string>> } }
const identifier = ref('')
const password = ref('')
const confirm = ref('')
const showPassword = ref(false)
const showConfirm = ref(false)
const focusedField = ref<Field | null>(null)
const identifierField = ref<{ $el?: HTMLElement } | null>(null)
const passwordField = ref<{ $el?: HTMLElement } | null>(null)
const confirmField = ref<{ $el?: HTMLElement } | null>(null)
const returnTo = ref('/pages/home/home')
const initialized = ref(false)
const submitting = ref(false)
const validationAttempted = ref(false)
const serverFailure = ref<unknown | null>(null)
const serverError = computed(() => serverFailure.value === null ? null : mobileAuthFailureCopy('register', serverFailure.value, mobileT))
const identifierError = computed(() => validationAttempted.value && !identifier.value.trim() ? mobileT('auth.register.requiredIdentifier') : null)
const passwordError = computed(() => {
  if (!validationAttempted.value) return null
  if (!password.value) return mobileT('auth.register.requiredPassword')
  return password.value.length < 12 ? mobileT('auth.register.shortPassword') : null
})
const confirmError = computed(() => {
  if (!validationAttempted.value) return null
  if (!confirm.value) return mobileT('auth.register.requiredConfirm')
  return password.value !== confirm.value ? mobileT('auth.register.mismatch') : null
})
// Preserve each reported error line's natural space while the user corrects it.
// A blur can flush uni's input value between pointerdown and click; removing
// that line immediately would move the submit button out from under the pointer.
const lastIdentifierError = ref('')
const lastPasswordError = ref('')
const lastConfirmError = ref('')
watch(identifierError, (value) => { if (value) lastIdentifierError.value = value })
watch(passwordError, (value) => { if (value) lastPasswordError.value = value })
watch(confirmError, (value) => { if (value) lastConfirmError.value = value })
let passwordControls = 'mobile-register-password-host'
let confirmControls = 'mobile-register-confirm-host'
// #ifdef H5
passwordControls = 'mobile-register-password'
confirmControls = 'mobile-register-confirm'

// uni-h5 puts ARIA on the wrapper; keep uni's model/focus handling and supply
// semantics to the actual input after the child render. Never read its value.
function syncNativeInput(host: { $el?: HTMLElement } | null, kind: Field): void {
  const input = host?.$el?.querySelector<HTMLInputElement>('.uni-input-input')
  if (!input) return
  const fieldError = kind === 'identifier' ? identifierError.value : kind === 'password' ? passwordError.value : confirmError.value
  const description = [kind === 'password' ? 'mobile-register-password-hint' : null, fieldError ? `mobile-register-${kind}-error` : null].filter(Boolean).join(' ')
  const attributes: Record<string, string | null> = {
    id: `mobile-register-${kind}`,
    name: kind,
    autocomplete: kind === 'identifier' ? 'username' : 'new-password',
    autocapitalize: 'none',
    spellcheck: 'false',
    required: '',
    minlength: kind === 'password' ? '12' : null,
    'aria-label': mobileT(`auth.register.${kind === 'confirm' ? 'confirmPassword' : kind}`),
    'aria-labelledby': `mobile-register-${kind}-label`,
    'aria-invalid': fieldError ? 'true' : null,
    'aria-describedby': description || null,
  }
  for (const [name, value] of Object.entries(attributes)) {
    if (value === null) input.removeAttribute(name)
    else input.setAttribute(name, value)
  }
}
function syncNativeInputs(): void {
  syncNativeInput(identifierField.value, 'identifier')
  syncNativeInput(passwordField.value, 'password')
  syncNativeInput(confirmField.value, 'confirm')
}
watch([
  identifier, password, confirm, identifierError, passwordError, confirmError,
  showPassword, showConfirm, focusedField, submitting,
  () => mobileT('auth.register.identifier'), () => mobileT('auth.register.password'), () => mobileT('auth.register.confirmPassword'),
], async () => { await nextTick(); syncNativeInputs() }, { flush: 'post' })
// #endif

function initialize(options?: { returnTo?: string; redirect?: string }): void {
  if (initialized.value) return
  initialized.value = true
  const requested = safeMobileRouteReturnTo(options?.returnTo ?? options?.redirect, '')
  returnTo.value = requested || safeMobileRouteReturnTo(session.peekReturnTo())
  session.setReturnTo(returnTo.value)
}
onLoad((options) => { initialize(options) })
onShow(() => { uni.setNavigationBarTitle({ title: mobileT('auth.register.start') }) })
onMounted(() => {
  initialize()
  // #ifdef H5
  syncNativeInputs()
  // #endif
})

async function focusField(kind: Field): Promise<void> {
  if (submitting.value) return
  focusedField.value = null
  await nextTick()
  if (!submitting.value) focusedField.value = kind
}
function syncField(kind: Field, value: unknown): void {
  if (submitting.value) return
  if (typeof value !== 'string') return
  if (kind === 'identifier') identifier.value = value
  else if (kind === 'password') password.value = value
  else confirm.value = value
}
function blurField(kind: Field, event: FieldEvent): void {
  // uni-h5 throttles model updates; blur/confirm and named form values carry
  // the current component value, even when the user submits immediately.
  syncField(kind, event.detail?.value)
  if (focusedField.value === kind) focusedField.value = null
}
function confirmNext(kind: Field, next: Field, event: FieldEvent): void {
  syncField(kind, event.detail?.value)
  void focusField(next)
}
async function confirmSubmit(event: FieldEvent): Promise<void> {
  syncField('confirm', event.detail?.value)
  await submit()
}
function togglePassword(kind: 'password' | 'confirm'): void {
  if (submitting.value) return
  if (kind === 'password') showPassword.value = !showPassword.value
  else showConfirm.value = !showConfirm.value
}
function signIn(): void {
  if (!submitting.value) openUniPage(`/pages/login/login?returnTo=${encodeURIComponent(returnTo.value)}`)
}
async function submit(event?: SubmitEvent): Promise<void> {
  if (submitting.value) return
  for (const kind of ['identifier', 'password', 'confirm'] as const) syncField(kind, event?.detail?.value?.[kind])
  validationAttempted.value = true
  serverFailure.value = null
  const firstError = identifierError.value ? 'identifier' : passwordError.value ? 'password' : confirmError.value ? 'confirm' : null
  if (firstError) { await focusField(firstError); return }
  submitting.value = true
  try {
    // IAM registration and permission lookup already use bounded client requests.
    // Keep the form locked until the complete existing flow resolves.
    const success = await session.register(identifier.value, password.value)
    if (!success) { serverFailure.value = session.lastError ?? 'UNKNOWN_AUTH_ERROR'; return }
    password.value = ''
    confirm.value = ''
    validationAttempted.value = false
    await continueAfterLogin(session.consumeReturnTo())
  } catch (cause) {
    serverFailure.value = cause ?? 'UNKNOWN_AUTH_ERROR'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <view class="yx-page v2-register" :style="experienceStyle" :data-motion="experienceMotion">
    <view class="register-topline">
      <view class="register-brand"><AppIcon name="brand" :size="25" /><text>{{ mobileT('brand') }}</text></view>
      <text class="register-adult-note">{{ mobileT('auth.register.note') }}</text>
    </view>
    <view class="register-content" aria-labelledby="mobile-register-title">
      <text id="mobile-register-title" class="register-title" role="heading" aria-level="1">{{ mobileT('auth.register.title') }}</text>
      <text class="register-description">{{ mobileT('auth.register.description') }}</text>
      <form class="register-form" :aria-busy="submitting" @submit="submit">
        <view class="register-fields">
          <view class="register-field">
            <label id="mobile-register-identifier-label" class="register-label" for="mobile-register-identifier-host" @click="focusField('identifier')">{{ mobileT('auth.register.identifier') }}</label>
            <input id="mobile-register-identifier-host" ref="identifierField" v-model="identifier" name="identifier" class="register-input" :class="{ 'is-invalid': identifierError, 'is-focused': focusedField === 'identifier' }" type="text" text-content-type="username" confirm-type="next" :focus="focusedField === 'identifier'" :placeholder="mobileT('auth.register.identifierPlaceholder')" :disabled="submitting" :aria-invalid="identifierError ? true : undefined" :aria-describedby="identifierError ? 'mobile-register-identifier-error' : undefined" @focus="focusedField = 'identifier'" @blur="blurField('identifier', $event)" @confirm="confirmNext('identifier', 'password', $event)" />
            <text v-if="validationAttempted && lastIdentifierError" id="mobile-register-identifier-error" class="register-field-error" :class="{ 'is-clear': !identifierError }" :role="identifierError ? 'alert' : undefined" :aria-hidden="!identifierError">{{ identifierError || lastIdentifierError }}</text>
          </view>
          <view class="register-field">
            <label id="mobile-register-password-label" class="register-label" for="mobile-register-password-host" @click="focusField('password')">{{ mobileT('auth.register.password') }}</label>
            <view class="register-password">
              <input id="mobile-register-password-host" ref="passwordField" v-model="password" name="password" class="register-input" :class="{ 'is-invalid': passwordError, 'is-focused': focusedField === 'password' }" type="text" :password="!showPassword" text-content-type="newPassword" confirm-type="next" :focus="focusedField === 'password'" :placeholder="mobileT('auth.register.passwordPlaceholder')" :disabled="submitting" :aria-invalid="passwordError ? true : undefined" :aria-describedby="passwordError ? 'mobile-register-password-hint mobile-register-password-error' : 'mobile-register-password-hint'" @focus="focusedField = 'password'" @blur="blurField('password', $event)" @confirm="confirmNext('password', 'confirm', $event)" />
              <button class="register-password-toggle" tabindex="0" role="button" :aria-controls="passwordControls" :aria-label="mobileT(showPassword ? 'auth.register.hidePassword' : 'auth.register.showPassword')" :aria-pressed="showPassword" :disabled="submitting" :aria-disabled="submitting" @click="togglePassword('password')"><AppIcon name="eye" :size="19" /></button>
            </view>
            <text id="mobile-register-password-hint" class="register-password-hint">{{ mobileT('auth.register.passwordHint') }}</text>
            <text v-if="validationAttempted && lastPasswordError" id="mobile-register-password-error" class="register-field-error" :class="{ 'is-clear': !passwordError }" :role="passwordError ? 'alert' : undefined" :aria-hidden="!passwordError">{{ passwordError || lastPasswordError }}</text>
          </view>
          <view class="register-field">
            <label id="mobile-register-confirm-label" class="register-label" for="mobile-register-confirm-host" @click="focusField('confirm')">{{ mobileT('auth.register.confirmPassword') }}</label>
            <view class="register-password">
              <input id="mobile-register-confirm-host" ref="confirmField" v-model="confirm" name="confirm" class="register-input" :class="{ 'is-invalid': confirmError, 'is-focused': focusedField === 'confirm' }" type="text" :password="!showConfirm" text-content-type="newPassword" confirm-type="go" :focus="focusedField === 'confirm'" :placeholder="mobileT('auth.register.confirmPasswordPlaceholder')" :disabled="submitting" :aria-invalid="confirmError ? true : undefined" :aria-describedby="confirmError ? 'mobile-register-confirm-error' : undefined" @focus="focusedField = 'confirm'" @blur="blurField('confirm', $event)" @confirm="confirmSubmit" />
              <button class="register-password-toggle" tabindex="0" role="button" :aria-controls="confirmControls" :aria-label="mobileT(showConfirm ? 'auth.register.hideConfirm' : 'auth.register.showConfirm')" :aria-pressed="showConfirm" :disabled="submitting" :aria-disabled="submitting" @click="togglePassword('confirm')"><AppIcon name="eye" :size="19" /></button>
            </view>
            <text v-if="validationAttempted && lastConfirmError" id="mobile-register-confirm-error" class="register-field-error" :class="{ 'is-clear': !confirmError }" :role="confirmError ? 'alert' : undefined" :aria-hidden="!confirmError">{{ confirmError || lastConfirmError }}</text>
          </view>
          <text v-if="serverError" class="register-server-error" role="alert">{{ serverError }}</text>
          <button class="register-submit" tabindex="0" role="button" form-type="submit" :disabled="submitting" :aria-disabled="submitting">{{ submitting ? mobileT('auth.register.submitting') : mobileT('auth.register.start') }}</button>
        </view>
      </form>
      <view class="register-signin"><text>{{ mobileT('auth.register.hasAccount') }}</text><button class="register-text-button" tabindex="0" role="button" :disabled="submitting" :aria-disabled="submitting" @click="signIn">{{ mobileT('auth.register.signIn') }}</button></view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.yx-page.v2-register {
  max-width: none;
  min-height: 100vh;
  min-height: 100dvh;
  padding: calc(20px + env(safe-area-inset-top)) 24px calc(40px + env(safe-area-inset-bottom));
  background: var(--v2-bg);
  color: var(--v2-ink);
  font-family: var(--v2-font);
  line-height: 1.6;
}
.register-topline { display: flex; flex-direction: column; align-items: flex-start; max-width: 1080px; margin: 0 auto 40px; }
.register-brand { display: inline-flex; min-height: 44px; align-items: center; gap: 10px; color: var(--v2-ink); font-size: 20px; font-weight: 650; white-space: nowrap; }
.register-brand :deep(.app-icon) { color: var(--v2-brand); }
.register-adult-note { color: var(--v2-mut); font-size: 13px; line-height: 1.6; overflow-wrap: anywhere; }
.register-content { width: 100%; max-width: 420px; margin: 0 auto; }
.register-title { display: block; margin: 0 0 8px; color: var(--v2-ink); text-align: center; font-size: 28px; line-height: 1.4; font-weight: 650; letter-spacing: 0; }
.register-description { display: block; color: var(--v2-mut); text-align: center; font-size: 14px; line-height: 1.75; }
.register-form { display: block; margin-top: 32px; }
.register-fields { display: grid; gap: 24px; }
.register-field { display: grid; gap: 8px; min-width: 0; }
.register-label { color: var(--v2-ink); font-size: 14px; line-height: 1.6; font-weight: 500; }
.v2-register .register-input { width: 100%; height: calc(1.5em + 24px); min-height: 48px; padding: 0 14px; border: 1px solid var(--v2-line); border-radius: 10px; color: var(--v2-ink); background: var(--v2-card); font-size: 16px; line-height: 1.5; font-weight: 400; }
.register-input :deep(.uni-input-input), .register-input :deep(.uni-input-placeholder) { font: inherit; color: inherit; }
.register-input :deep(.uni-input-placeholder) { color: var(--v2-mut); }
.v2-register .register-input.is-invalid { border-color: var(--v2-bad); }
.v2-register .register-input.is-focused, .v2-register .register-input:focus-within { outline: 2px solid var(--v2-brand); outline-offset: 2px; }
.register-password { position: relative; min-width: 0; }
.v2-register .register-password .register-input { padding-right: 58px; }
.v2-register .register-password-toggle { position: absolute; top: 50%; right: 4px; display: flex; width: 44px; height: 44px; min-height: 44px; padding: 0; align-items: center; justify-content: center; transform: translateY(-50%); border: 0; border-radius: 8px; background: transparent; color: var(--v2-mut); }
.v2-register .register-password-toggle:active:not([disabled]) { transform: translateY(-50%); background: var(--v2-soft); }
.register-password-hint { color: var(--v2-mut); font-size: 13px; line-height: 1.6; }
.register-field-error, .register-server-error { display: block; color: var(--v2-bad); font-size: 14px; line-height: 1.6; overflow-wrap: anywhere; }
.register-field-error.is-clear { visibility: hidden; }
.v2-register .register-text-button { display: inline-flex; width: auto; min-width: 44px; min-height: 44px; margin: 0; padding: 8px 0; align-items: center; justify-content: center; border: 0; border-radius: 0; background: transparent; color: var(--v2-brand); font-size: 14px; line-height: 1.6; font-weight: 500; text-align: center; }
.v2-register .register-submit { display: flex; width: 100%; min-height: 48px; margin: 0; padding: 12px 20px; align-items: center; justify-content: center; border: 1px solid transparent; border-radius: 10px; background: var(--v2-brand); color: var(--v2-inverse); box-shadow: none; font-size: 16px; line-height: 1.5; font-weight: 600; }
.v2-register .register-submit:active:not([disabled]) { transform: none; background: var(--v2-brand2); }
.v2-register button[disabled] { cursor: default; }
.v2-register .register-submit[disabled] { opacity: .6; }
.v2-register button:focus-visible { outline: 2px solid var(--v2-brand); outline-offset: 3px; }
.register-signin { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 4px 8px; margin-top: 28px; padding-top: 16px; border-top: 1px solid var(--v2-line); color: var(--v2-mut); font-size: 14px; line-height: 1.6; }
@media (min-width: 521px) {
  .yx-page.v2-register { padding: calc(32px + env(safe-area-inset-top)) 32px calc(64px + env(safe-area-inset-bottom)); }
  .register-topline { flex-direction: row; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 80px; }
}
@media (prefers-reduced-motion: reduce) {
  .v2-register * { transition: none; animation: none; }
}
</style>
