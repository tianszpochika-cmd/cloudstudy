<script setup lang="ts">
import AuthLayout from '../layouts/AuthLayout.vue'
import { computed, nextTick, ref, watch } from 'vue'
import AppIcon from '../components/AppIcon.vue'
import { useExperienceText } from '../platform/experience-ui'
import { useRoute, useRouter } from 'vue-router'
import { authT } from '../auth/i18n'
import { safeReturnTo } from '../auth/gateway-auth'
import { learnerAuthFailureCopy, learnerAuthFailureMarker } from '../auth/auth-failure-copy'
import { useSessionStore } from '../stores/session'

const route = useRoute()
const router = useRouter()
const session = useSessionStore()
const t = useExperienceText()
const step = ref<'request' | 'confirm'>(typeof route.query.token === 'string' && route.query.token ? 'confirm' : 'request')
const identifier = ref('')
const token = ref(typeof route.query.token === 'string' ? route.query.token : '')
const newPassword = ref('')
const submitting = ref(false)
const requestSent = ref(false)
const error = ref<string | null>(null)
const errorKind = ref<'validation' | 'server' | null>(null)
const identifierInput = ref<HTMLInputElement | null>(null)
const tokenInput = ref<HTMLInputElement | null>(null)
const passwordInput = ref<HTMLInputElement | null>(null)
const validationAttempted = ref(false)
const showPassword = ref(false)
const redirectTarget = computed(() => safeReturnTo(route.query.redirect ?? session.peekReturnTo()))
const fieldErrors = computed(() => ({
  identifier: identifier.value.trim() ? null : 'passwordReset.requiredIdentifier',
  token: step.value === 'confirm' && !token.value.trim() ? 'passwordReset.requiredToken' : null,
  newPassword: step.value !== 'confirm' ? null : !newPassword.value ? 'passwordReset.requiredNewPassword' : newPassword.value.length < 12 ? 'passwordReset.shortPassword' : null,
}))
const firstValidationError = computed(() => fieldErrors.value.identifier ?? fieldErrors.value.token ?? fieldErrors.value.newPassword)
watch(firstValidationError, (value) => {
  if (!value && errorKind.value === 'validation') {
    error.value = null
    errorKind.value = null
  }
})
watch(identifier, () => { requestSent.value = false })

async function validate(): Promise<boolean> {
  validationAttempted.value = true
  if (!firstValidationError.value) return true
  error.value = authT(firstValidationError.value)
  errorKind.value = 'validation'
  await nextTick()
  const firstInvalidInput = fieldErrors.value.identifier ? identifierInput.value : fieldErrors.value.token ? tokenInput.value : passwordInput.value
  firstInvalidInput?.focus()
  return false
}

async function switchStep(): Promise<void> {
  if (submitting.value) return
  error.value = null
  errorKind.value = null
  requestSent.value = false
  validationAttempted.value = false
  showPassword.value = false
  step.value = step.value === 'request' ? 'confirm' : 'request'
  if (step.value === 'request') {
    token.value = ''
    newPassword.value = ''
  }
  await nextTick()
  const nextInput = step.value === 'confirm' && identifier.value.trim() ? tokenInput.value : identifierInput.value
  nextInput?.focus()
}

const feedback = computed(() => {
  if (errorKind.value === 'server') return error.value
  return requestSent.value ? authT('passwordReset.requestSent') : null
})

async function send(): Promise<void> {
  if (submitting.value) return
  error.value = null
  errorKind.value = null
  requestSent.value = false
  if (!await validate() || submitting.value || step.value !== 'request') return
  submitting.value = true
  try {
    const ok = await session.requestPasswordReset(identifier.value)
    if (!ok && learnerAuthFailureMarker(session.lastError) === 'RATE_LIMITED') {
      requestSent.value = false
      error.value = learnerAuthFailureCopy('resetRequest', session.lastError, authT)
      errorKind.value = 'server'
      return
    }
    requestSent.value = true
    error.value = null
    errorKind.value = null
  } finally {
    submitting.value = false
  }
}

async function confirm(): Promise<void> {
  if (submitting.value) return
  error.value = null
  errorKind.value = null
  if (!await validate() || submitting.value || step.value !== 'confirm') return
  submitting.value = true
  try {
    const ok = await session.confirmPasswordReset(identifier.value, token.value, newPassword.value)
    if (!ok) {
      error.value = learnerAuthFailureCopy('resetConfirm', session.lastError, authT)
      errorKind.value = 'server'
      return
    }
    await router.replace({ name: 'login', query: { redirect: redirectTarget.value } })
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <AuthLayout>
    <section class="login-card login-card--quiet v2-auth-card" aria-labelledby="reset-title">
      <h1 id="reset-title" class="v2-auth-title">{{ authT(step === 'request' ? 'passwordReset.title' : 'passwordReset.confirmTitle') }}</h1>
      <p class="lead v2-auth-lead">{{ authT(step === 'request' ? 'passwordReset.requestHint' : 'passwordReset.confirmDescription') }}</p>
      <form class="login-form v2-auth-fields" novalidate :aria-busy="submitting" @submit.prevent="step === 'request' ? send() : confirm()">
        <div class="field v2-field">
          <label for="reset-identifier">{{ authT('passwordReset.identifier') }}</label>
          <input id="reset-identifier" ref="identifierInput" v-model="identifier" name="identifier" type="text" autocomplete="username" autocapitalize="none" :spellcheck="false" required :aria-invalid="validationAttempted && !!fieldErrors.identifier || undefined" :aria-describedby="validationAttempted && fieldErrors.identifier ? 'reset-identifier-error' : undefined" :placeholder="authT(step === 'request' ? 'passwordReset.requestIdentifierPlaceholder' : 'passwordReset.confirmIdentifierPlaceholder')" :disabled="submitting">
          <small v-if="validationAttempted && fieldErrors.identifier" id="reset-identifier-error" class="reset-field-error">{{ authT(fieldErrors.identifier) }}</small>
        </div>
        <template v-if="step === 'confirm'">
          <div class="field v2-field">
            <label for="reset-token">{{ authT('passwordReset.token') }}</label>
            <input id="reset-token" ref="tokenInput" v-model="token" name="token" type="text" autocomplete="one-time-code" autocapitalize="none" :spellcheck="false" required :aria-invalid="validationAttempted && !!fieldErrors.token || undefined" :aria-describedby="validationAttempted && fieldErrors.token ? 'reset-token-error' : undefined" :placeholder="authT('passwordReset.tokenPlaceholder')" :disabled="submitting">
            <small v-if="validationAttempted && fieldErrors.token" id="reset-token-error" class="reset-field-error">{{ authT(fieldErrors.token) }}</small>
          </div>
          <div class="field v2-field">
            <label for="reset-password">{{ authT('passwordReset.newPassword') }}</label>
            <div class="password-field">
              <input id="reset-password" ref="passwordInput" v-model="newPassword" name="newPassword" :type="showPassword ? 'text' : 'password'" autocomplete="new-password" required minlength="12" :aria-invalid="validationAttempted && !!fieldErrors.newPassword || undefined" :aria-describedby="validationAttempted && fieldErrors.newPassword ? 'reset-password-error' : undefined" :placeholder="authT('passwordReset.newPasswordPlaceholder')" :disabled="submitting">
              <button type="button" class="icon-button" :disabled="submitting" aria-controls="reset-password" :aria-label="t(showPassword ? 'hidePassword' : 'showPassword')" :aria-pressed="showPassword" @click="showPassword = !showPassword"><AppIcon name="eye" :size="19" /></button>
            </div>
            <small v-if="validationAttempted && fieldErrors.newPassword" id="reset-password-error" class="reset-field-error">{{ authT(fieldErrors.newPassword) }}</small>
          </div>
        </template>
        <p v-if="feedback" id="reset-status" class="reset-feedback" :class="{ 'reset-feedback--error': errorKind === 'server' }" :role="errorKind === 'server' ? 'alert' : 'status'">{{ feedback }}</p>
        <button class="button button--primary v2-btn v2-btn--primary v2-btn--block" type="submit" :disabled="submitting" aria-live="polite">{{ authT(step === 'request' ? submitting ? 'passwordReset.sending' : 'passwordReset.sendInstructions' : submitting ? 'passwordReset.resetting' : 'passwordReset.resetAction') }}</button>
        <div class="reset-switch"><button id="reset-step-switch" class="reset-step-link" type="button" :disabled="submitting" @click="switchStep">{{ authT(step === 'request' ? 'passwordReset.receivedCode' : 'passwordReset.requestAgain') }}</button></div>
      </form>
      <nav class="micro-copy v2-auth-micro reset-exit" :aria-label="authT('passwordReset.returnLogin')"><RouterLink :to="{ name: 'login', query: { redirect: redirectTarget } }">{{ authT('passwordReset.returnLogin') }}</RouterLink></nav>
    </section>
  </AuthLayout>
</template>

<style scoped>
.reset-field-error { color: var(--v2-bad); font-size: 13px; font-weight: 400; line-height: 1.7; }
.reset-feedback { margin: 0; color: var(--v2-mut); font-size: 14px; line-height: 1.75; }
.reset-feedback--error { color: var(--v2-bad); }
.reset-switch { display: flex; justify-content: center; }
.reset-step-link { display: inline-flex; justify-content: center; align-items: center; min-width: 44px; min-height: 44px; border: 0; padding: 0 8px; color: var(--v2-brand); background: transparent; font-size: 14px; line-height: 1.6; font-weight: 500; cursor: pointer; }
.reset-step-link:hover:not(:disabled) { text-decoration: underline; }
.reset-step-link:disabled { color: var(--v2-mut); cursor: wait; }
.reset-exit { display: flex; justify-content: center; margin-top: 20px; border-top: 1px solid var(--v2-line); padding-top: 16px; }
.reset-exit a { display: inline-flex; align-items: center; min-width: 44px; min-height: 44px; }
</style>
