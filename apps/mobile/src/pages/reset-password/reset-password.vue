<script setup lang="ts">
import AppIcon from '../../components/AppIcon.vue'
import { openUniPage } from '../../platform/uni-runtime'
import { mobileT, useMobileExperience } from '../../platform/experience'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { usePointerFeedback } from '../../platform/pointer-feedback'
import { safeMobileRouteReturnTo } from '../../auth/gateway-auth'
import { mobileAuthFailureCopy } from '../../auth/auth-failure-copy'
import { useSessionStore } from '../../stores/session'

const { experienceStyle, experienceMotion } = useMobileExperience()
const session = useSessionStore()
type Field = 'identifier' | 'token' | 'newPassword'
type FieldEvent = { detail?: { value?: string } }
type SubmitEvent = { detail?: { value?: Partial<Record<Field, string>> } }
const step = ref<'request' | 'confirm'>('request')
const identifier = ref('')
const token = ref('')
const newPassword = ref('')
const showPassword = ref(false)
const focusedField = ref<Field | null>(null)
const identifierField = ref<{ $el?: HTMLElement } | null>(null)
const tokenField = ref<{ $el?: HTMLElement } | null>(null)
const passwordField = ref<{ $el?: HTMLElement } | null>(null)
const returnTo = ref('/pages/home/home')
const initialized = ref(false)
const submitting = ref(false)
const requestSent = ref(false)
const receiptShown = ref(false)
const resetCompleted = ref(false)
const validationAttempted = ref(false)
const serverFailure = ref<unknown | null>(null)
const failureAction = ref<'resetRequest' | 'resetConfirm'>('resetRequest')
const serverError = computed(() => serverFailure.value === null ? null : mobileAuthFailureCopy(failureAction.value, serverFailure.value, mobileT))
const identifierError = computed(() => {
  if (!validationAttempted.value) return null
  const length = identifier.value.trim().length
  if (!length) return mobileT('auth.resetPassword.requiredIdentifier')
  return length < 3 || length > 128 ? mobileT('auth.resetPassword.identifierLength') : null
})
const tokenError = computed(() => {
  if (!validationAttempted.value || step.value !== 'confirm') return null
  const length = token.value.trim().length
  if (!length) return mobileT('auth.resetPassword.requiredToken')
  return length < 32 || length > 512 ? mobileT('auth.resetPassword.tokenLength') : null
})
const passwordError = computed(() => {
  if (!validationAttempted.value || step.value !== 'confirm') return null
  if (!newPassword.value) return mobileT('auth.resetPassword.requiredNewPassword')
  if (newPassword.value.length < 12) return mobileT('auth.resetPassword.shortPassword')
  return newPassword.value.length > 128 ? mobileT('auth.resetPassword.passwordLength') : null
})
// Preserve the natural height of a reported error after correction. A uni blur
// can flush input state between pointerdown and click; removing its error row
// then would move the button under the pointer. Initially there are no rows.
const lastIdentifierError = ref('')
const lastTokenError = ref('')
const lastPasswordError = ref('')
// Keep reported feedback geometry while any field is being edited, including
// dependent-field errors. Blur or explicit submit reports the current messages.
// Corrected fields hide their old text but retain its natural layout space.
function reportFieldErrors(): void {
  if (submitting.value) return
  if (identifierError.value) lastIdentifierError.value = identifierError.value
  if (tokenError.value) lastTokenError.value = tokenError.value
  if (passwordError.value) lastPasswordError.value = passwordError.value
}
watch([identifierError, tokenError, passwordError], () => { if (focusedField.value === null) reportFieldErrors() })
watch(identifier, () => { requestSent.value = false })
watch(requestSent, (value) => { if (value) receiptShown.value = true })
function currentFeedback() {
  return {
    active: validationAttempted.value,
    fields: {
      identifier: { current: identifierError.value ? lastIdentifierError.value || null : null, last: lastIdentifierError.value },
      token: { current: tokenError.value ? lastTokenError.value || null : null, last: lastTokenError.value },
      newPassword: { current: passwordError.value ? lastPasswordError.value || null : null, last: lastPasswordError.value },
    },
    server: serverError.value,
    receipt: receiptShown.value,
  }
}
const pageRoot = ref<{ $el?: HTMLElement } | null>(null)
const pointerFeedback = usePointerFeedback({
  root: () => pageRoot.value?.$el ?? null,
  actions: '.reset-submit,.reset-text-button,.reset-password-toggle',
  capture: currentFeedback,
  disabled: () => submitting.value || resetCompleted.value,
  afterRelease: () => {
    // #ifdef H5
    syncNativeInputs()
    // #endif
  },
})
const visualFeedback = computed(() => pointerFeedback.value ?? currentFeedback())
let passwordControls = 'mobile-reset-newPassword-host'
// #ifdef H5
passwordControls = 'mobile-reset-newPassword'
function syncNativeInput(host: { $el?: HTMLElement } | null, kind: Field): void {
  const input = host?.$el?.querySelector<HTMLInputElement>('.uni-input-input')
  if (!input) return
  const fieldError = visualFeedback.value.fields[kind].current
  const description = [kind === 'newPassword' ? 'mobile-reset-password-hint' : null, fieldError ? `mobile-reset-${kind}-error` : null].filter(Boolean).join(' ')
  const attributes: Record<string, string | null> = {
    id: `mobile-reset-${kind}`,
    name: kind,
    autocomplete: kind === 'identifier' ? 'username' : kind === 'token' ? 'one-time-code' : 'new-password',
    autocapitalize: 'none',
    spellcheck: 'false',
    required: '',
    minlength: kind === 'newPassword' ? '12' : null,
    'aria-label': mobileT(`auth.resetPassword.${kind}`),
    'aria-labelledby': `mobile-reset-${kind}-label`,
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
  syncNativeInput(tokenField.value, 'token')
  syncNativeInput(passwordField.value, 'newPassword')
}
watch([
  step, identifier, token, newPassword, identifierError, tokenError, passwordError,
  showPassword, focusedField, submitting, resetCompleted, visualFeedback,
  () => mobileT('auth.resetPassword.identifier'), () => mobileT('auth.resetPassword.token'), () => mobileT('auth.resetPassword.newPassword'),
], async () => { await nextTick(); syncNativeInputs() }, { flush: 'post' })
// #endif

function initialize(options?: { token?: string; returnTo?: string; redirect?: string }): void {
  if (initialized.value) return
  initialized.value = true
  const requested = safeMobileRouteReturnTo(options?.returnTo ?? options?.redirect, '')
  returnTo.value = requested || safeMobileRouteReturnTo(session.peekReturnTo())
  session.setReturnTo(returnTo.value)
  if (typeof options?.token === 'string' && options.token.trim()) {
    token.value = options.token
    step.value = 'confirm'
  }
}
onLoad((options) => { initialize(options) })
onShow(() => { uni.setNavigationBarTitle({ title: mobileT('auth.resetPassword.title') }) })
onMounted(() => {
  initialize()
  // #ifdef H5
  syncNativeInputs()
  // #endif
})
async function focusField(kind: Field): Promise<void> {
  if (submitting.value || resetCompleted.value) return
  focusedField.value = null
  await nextTick()
  if (!submitting.value && !resetCompleted.value) focusedField.value = kind
}
function syncField(kind: Field, value: unknown): void {
  if (submitting.value || resetCompleted.value || typeof value !== 'string') return
  if (kind === 'identifier') identifier.value = value
  else if (step.value === 'confirm' && kind === 'token') token.value = value
  else if (step.value === 'confirm') newPassword.value = value
}
function blurField(kind: Field, event: FieldEvent): void {
  syncField(kind, event.detail?.value)
  if (focusedField.value === kind) focusedField.value = null
  reportFieldErrors()
}
function confirmField(kind: Field, event: FieldEvent): void {
  syncField(kind, event.detail?.value)
  if (step.value === 'request' || kind === 'newPassword') void submit()
  else void focusField(kind === 'identifier' ? 'token' : 'newPassword')
}
function clearValidation(): void {
  validationAttempted.value = false
  lastIdentifierError.value = ''
  lastTokenError.value = ''
  lastPasswordError.value = ''
}
async function switchStep(): Promise<void> {
  if (submitting.value || resetCompleted.value) return
  serverFailure.value = null
  requestSent.value = false
  receiptShown.value = false
  showPassword.value = false
  focusedField.value = null
  clearValidation()
  step.value = step.value === 'request' ? 'confirm' : 'request'
  if (step.value === 'request') { token.value = ''; newPassword.value = '' }
  await focusField(step.value === 'confirm' && identifier.value.trim() ? 'token' : 'identifier')
}
function togglePassword(): void { if (!submitting.value) showPassword.value = !showPassword.value }
function returnLogin(): void {
  if (!submitting.value) openUniPage(`/pages/login/login?returnTo=${encodeURIComponent(returnTo.value)}`)
}
// A keydown activation can focus the first error before this key's keyup.
// uni-input would then treat that keyup as confirm and skip the first error.
function submitKeyDown(event: KeyboardEvent): void {
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  event.stopPropagation()
}
function submitKeyUp(event: KeyboardEvent): void {
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  event.stopPropagation()
  void submit()
}
async function submit(event?: SubmitEvent): Promise<void> {
  if (submitting.value || resetCompleted.value) return
  const activeStep = step.value
  for (const kind of ['identifier', 'token', 'newPassword'] as const) syncField(kind, event?.detail?.value?.[kind])
  validationAttempted.value = true
  serverFailure.value = null
  if (activeStep === 'request') { requestSent.value = false; receiptShown.value = false }
  reportFieldErrors()
  const firstError = identifierError.value ? 'identifier' : tokenError.value ? 'token' : passwordError.value ? 'newPassword' : null
  if (firstError) { await focusField(firstError); return }
  if (submitting.value || step.value !== activeStep) return
  submitting.value = true
  failureAction.value = activeStep === 'request' ? 'resetRequest' : 'resetConfirm'
  try {
    // Password reset stays on the existing IAM TLS client with bounded requests.
    const success = activeStep === 'request'
      ? await session.requestPasswordReset(identifier.value)
      : await session.confirmPasswordReset(identifier.value, token.value, newPassword.value)
    if (!success) { serverFailure.value = session.lastError ?? 'UNKNOWN_AUTH_ERROR'; return }
    if (activeStep === 'request') requestSent.value = true
    else {
      resetCompleted.value = true
      identifier.value = ''
      token.value = ''
      newPassword.value = ''
      showPassword.value = false
      focusedField.value = null
      requestSent.value = false
      receiptShown.value = false
      clearValidation()
    }
  } catch (cause) {
    serverFailure.value = cause ?? 'UNKNOWN_AUTH_ERROR'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <view ref="pageRoot" class="yx-page v2-reset" :style="experienceStyle" :data-motion="experienceMotion">
    <view class="reset-topline">
      <view class="reset-brand"><AppIcon name="brand" :size="25" /><text>{{ mobileT('brand') }}</text></view>
      <text class="reset-adult-note">{{ mobileT('auth.resetPassword.note') }}</text>
    </view>
    <view class="reset-content" aria-labelledby="mobile-reset-title">
      <text id="mobile-reset-title" class="reset-title" role="heading" aria-level="1">{{ mobileT(step === 'request' ? 'auth.resetPassword.title' : 'auth.resetPassword.confirmTitle') }}</text>
      <text v-if="!resetCompleted" class="reset-description">{{ mobileT(step === 'request' ? 'auth.resetPassword.requestHint' : 'auth.resetPassword.confirmHint') }}</text>
      <text v-if="resetCompleted" class="reset-success" role="status">{{ mobileT('resetComplete') }}</text>
      <form v-else class="reset-form" :aria-busy="submitting" @submit="submit">
        <view class="reset-fields">
          <view class="reset-field">
            <label id="mobile-reset-identifier-label" class="reset-label" for="mobile-reset-identifier-host" @click="focusField('identifier')">{{ mobileT('auth.resetPassword.identifier') }}</label>
            <input id="mobile-reset-identifier-host" ref="identifierField" v-model="identifier" name="identifier" :maxlength="-1" class="reset-input" :class="{ 'is-invalid': visualFeedback.fields.identifier.current, 'is-focused': focusedField === 'identifier' }" type="text" text-content-type="username" :confirm-type="step === 'request' ? 'go' : 'next'" :focus="focusedField === 'identifier'" :placeholder="mobileT(step === 'request' ? 'auth.resetPassword.requestIdentifierPlaceholder' : 'auth.resetPassword.confirmIdentifierPlaceholder')" :disabled="submitting" :aria-invalid="visualFeedback.fields.identifier.current ? true : undefined" :aria-describedby="visualFeedback.fields.identifier.current ? 'mobile-reset-identifier-error' : undefined" @focus="focusedField = 'identifier'" @blur="blurField('identifier', $event)" @confirm="confirmField('identifier', $event)" />
            <text v-if="visualFeedback.active && visualFeedback.fields.identifier.last" id="mobile-reset-identifier-error" class="reset-field-error" :class="{ 'is-clear': !visualFeedback.fields.identifier.current }" :role="visualFeedback.fields.identifier.current ? 'alert' : undefined" :aria-hidden="!visualFeedback.fields.identifier.current">{{ visualFeedback.fields.identifier.current || visualFeedback.fields.identifier.last }}</text>
          </view>
          <view v-if="step === 'confirm'" class="reset-field">
            <label id="mobile-reset-token-label" class="reset-label" for="mobile-reset-token-host" @click="focusField('token')">{{ mobileT('auth.resetPassword.token') }}</label>
            <input id="mobile-reset-token-host" ref="tokenField" v-model="token" name="token" :maxlength="-1" class="reset-input" :class="{ 'is-invalid': visualFeedback.fields.token.current, 'is-focused': focusedField === 'token' }" type="text" text-content-type="oneTimeCode" confirm-type="next" :focus="focusedField === 'token'" :placeholder="mobileT('auth.resetPassword.tokenPlaceholder')" :disabled="submitting" :aria-invalid="visualFeedback.fields.token.current ? true : undefined" :aria-describedby="visualFeedback.fields.token.current ? 'mobile-reset-token-error' : undefined" @focus="focusedField = 'token'" @blur="blurField('token', $event)" @confirm="confirmField('token', $event)" />
            <text v-if="visualFeedback.active && visualFeedback.fields.token.last" id="mobile-reset-token-error" class="reset-field-error" :class="{ 'is-clear': !visualFeedback.fields.token.current }" :role="visualFeedback.fields.token.current ? 'alert' : undefined" :aria-hidden="!visualFeedback.fields.token.current">{{ visualFeedback.fields.token.current || visualFeedback.fields.token.last }}</text>
          </view>
          <view v-if="step === 'confirm'" class="reset-field">
            <label id="mobile-reset-newPassword-label" class="reset-label" for="mobile-reset-newPassword-host" @click="focusField('newPassword')">{{ mobileT('auth.resetPassword.newPassword') }}</label>
            <view class="reset-password">
              <input id="mobile-reset-newPassword-host" ref="passwordField" v-model="newPassword" name="newPassword" :maxlength="-1" class="reset-input" :class="{ 'is-invalid': visualFeedback.fields.newPassword.current, 'is-focused': focusedField === 'newPassword' }" type="text" :password="!showPassword" text-content-type="newPassword" confirm-type="go" :focus="focusedField === 'newPassword'" :placeholder="mobileT('auth.resetPassword.newPasswordPlaceholder')" :disabled="submitting" :aria-invalid="visualFeedback.fields.newPassword.current ? true : undefined" :aria-describedby="visualFeedback.fields.newPassword.current ? 'mobile-reset-password-hint mobile-reset-newPassword-error' : 'mobile-reset-password-hint'" @focus="focusedField = 'newPassword'" @blur="blurField('newPassword', $event)" @confirm="confirmField('newPassword', $event)" />
              <button class="reset-password-toggle" tabindex="0" role="button" :aria-controls="passwordControls" :aria-label="mobileT(showPassword ? 'auth.resetPassword.hidePassword' : 'auth.resetPassword.showPassword')" :aria-pressed="showPassword" :disabled="submitting" :aria-disabled="submitting" @click="togglePassword"><AppIcon name="eye" :size="19" /></button>
            </view>
            <text id="mobile-reset-password-hint" class="reset-password-hint">{{ mobileT('auth.resetPassword.passwordHint') }}</text>
            <text v-if="visualFeedback.active && visualFeedback.fields.newPassword.last" id="mobile-reset-newPassword-error" class="reset-field-error" :class="{ 'is-clear': !visualFeedback.fields.newPassword.current }" :role="visualFeedback.fields.newPassword.current ? 'alert' : undefined" :aria-hidden="!visualFeedback.fields.newPassword.current">{{ visualFeedback.fields.newPassword.current || visualFeedback.fields.newPassword.last }}</text>
          </view>
          <text v-if="visualFeedback.server" class="reset-server-error" role="alert">{{ visualFeedback.server }}</text>
          <text v-if="visualFeedback.receipt && step === 'request'" class="reset-receipt" :class="{ 'is-clear': !requestSent }" :role="requestSent ? 'status' : undefined" :aria-hidden="!requestSent">{{ mobileT('resetSent') }}</text>
          <button class="reset-submit" tabindex="0" role="button" form-type="submit" :disabled="submitting" :aria-disabled="submitting" @keydown="submitKeyDown" @keyup="submitKeyUp">{{ mobileT(step === 'request' ? submitting ? 'auth.resetPassword.sending' : 'auth.resetPassword.sendInstructions' : submitting ? 'auth.resetPassword.resetting' : 'auth.resetPassword.resetAction') }}</button>
        </view>
        <view class="reset-switch"><button class="reset-step-button reset-text-button" tabindex="0" role="button" :disabled="submitting" :aria-disabled="submitting" @click="switchStep">{{ mobileT(step === 'request' ? 'auth.resetPassword.receivedCode' : 'auth.resetPassword.back') }}</button></view>
      </form>
      <view class="reset-exit"><button class="reset-login-button reset-text-button" tabindex="0" role="button" :disabled="submitting" :aria-disabled="submitting" @click="returnLogin">{{ mobileT('auth.resetPassword.returnLogin') }}</button></view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.yx-page.v2-reset {
  max-width: none;
  min-height: 100vh;
  min-height: 100dvh;
  padding: calc(20px + env(safe-area-inset-top)) 24px calc(40px + env(safe-area-inset-bottom));
  background: var(--v2-bg);
  color: var(--v2-ink);
  font-family: var(--v2-font);
  line-height: 1.6;
}
.reset-topline { display: flex; flex-direction: column; align-items: flex-start; max-width: 1080px; margin: 0 auto 40px; }
.reset-brand { display: inline-flex; min-height: 44px; align-items: center; gap: 10px; color: var(--v2-ink); font-size: 20px; font-weight: 650; white-space: nowrap; }
.reset-brand :deep(.app-icon) { color: var(--v2-brand); }
.reset-adult-note { color: var(--v2-mut); font-size: 13px; line-height: 1.6; overflow-wrap: anywhere; }
.reset-content { width: 100%; max-width: 420px; margin: 0 auto; }
.reset-title { display: block; margin: 0 0 8px; color: var(--v2-ink); text-align: center; font-size: 28px; line-height: 1.4; font-weight: 650; letter-spacing: 0; }
.reset-description { display: block; color: var(--v2-mut); text-align: center; font-size: 14px; line-height: 1.75; }
.reset-form { display: block; margin-top: 32px; }
.reset-fields { display: grid; gap: 24px; }
.reset-field { display: grid; gap: 8px; min-width: 0; }
.reset-label { color: var(--v2-ink); font-size: 14px; line-height: 1.6; font-weight: 500; }
.v2-reset .reset-input { width: 100%; height: calc(1.5em + 24px); min-height: 48px; padding: 0 14px; border: 1px solid var(--v2-line); border-radius: 10px; color: var(--v2-ink); background: var(--v2-card); font-size: 16px; line-height: 1.5; font-weight: 400; }
.reset-input :deep(.uni-input-input), .reset-input :deep(.uni-input-placeholder) { font: inherit; color: inherit; }
.reset-input :deep(.uni-input-placeholder) { color: var(--v2-mut); }
.v2-reset .reset-input.is-invalid { border-color: var(--v2-bad); }
.v2-reset .reset-input.is-focused, .v2-reset .reset-input:focus-within { outline: 2px solid var(--v2-brand); outline-offset: 2px; }
.reset-password { position: relative; min-width: 0; }
.v2-reset .reset-password .reset-input { padding-right: 58px; }
.v2-reset .reset-password-toggle { position: absolute; top: 50%; right: 4px; display: flex; width: 44px; height: 44px; min-height: 44px; padding: 0; align-items: center; justify-content: center; transform: translateY(-50%); border: 0; border-radius: 8px; background: transparent; color: var(--v2-mut); }
.v2-reset .reset-password-toggle:active:not([disabled]) { transform: translateY(-50%); background: var(--v2-soft); }
.reset-password-hint { color: var(--v2-mut); font-size: 13px; line-height: 1.6; }
.reset-field-error, .reset-server-error { display: block; color: var(--v2-bad); font-size: 14px; line-height: 1.6; overflow-wrap: anywhere; }
.reset-field-error.is-clear, .reset-receipt.is-clear { visibility: hidden; }
.v2-reset .reset-text-button { display: inline-flex; width: auto; min-width: 44px; min-height: 44px; margin: 0; padding: 8px 0; align-items: center; justify-content: center; border: 0; border-radius: 0; background: transparent; color: var(--v2-brand); font-size: 14px; line-height: 1.6; font-weight: 500; text-align: center; }
.v2-reset .reset-submit { display: flex; width: 100%; min-height: 48px; margin: 0; padding: 12px 20px; align-items: center; justify-content: center; border: 1px solid transparent; border-radius: 10px; background: var(--v2-brand); color: var(--v2-inverse); box-shadow: none; font-size: 16px; line-height: 1.5; font-weight: 600; }
.v2-reset .reset-submit:active:not([disabled]) { transform: none; background: var(--v2-brand2); }
.v2-reset button[disabled] { cursor: default; }
.v2-reset .reset-submit[disabled] { opacity: .6; }
.v2-reset button:focus-visible { outline: 2px solid var(--v2-brand); outline-offset: 3px; }
.reset-exit { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 4px 8px; margin-top: 28px; padding-top: 16px; border-top: 1px solid var(--v2-line); color: var(--v2-mut); font-size: 14px; line-height: 1.6; }
@media (min-width: 521px) {
  .yx-page.v2-reset { padding: calc(32px + env(safe-area-inset-top)) 32px calc(64px + env(safe-area-inset-bottom)); }
  .reset-topline { flex-direction: row; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 80px; }
}
@media (prefers-reduced-motion: reduce) {
  .v2-reset * { transition: none; animation: none; }
}
.reset-switch { display: flex; justify-content: center; margin-top: 12px; }
.reset-success { display: block; margin-top: 32px; color: var(--v2-mut); font-size: 14px; line-height: 1.75; }
.reset-receipt { display: block; color: var(--v2-mut); font-size: 14px; line-height: 1.75; overflow-wrap: anywhere; }
</style>
