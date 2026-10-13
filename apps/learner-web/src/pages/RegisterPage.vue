<script setup lang="ts">
import AuthLayout from '../layouts/AuthLayout.vue'
import { computed, nextTick, ref, watch } from 'vue'
import AppIcon from '../components/AppIcon.vue'
import { useExperienceText } from '../platform/experience-ui'
import { useRoute, useRouter } from 'vue-router'
import { authT } from '../auth/i18n'
import { safeReturnTo } from '../auth/gateway-auth'
import { learnerAuthFailureCopy } from '../auth/auth-failure-copy'
import { useSessionStore } from '../stores/session'

const route = useRoute()
const router = useRouter()
const session = useSessionStore()
const t = useExperienceText()
const identifier = ref('')
const password = ref('')
const confirm = ref('')
const submitting = ref(false)
const error = ref<string | null>(null)
const errorKind = ref<'validation' | 'server' | null>(null)
const identifierInput = ref<HTMLInputElement | null>(null)
const passwordInput = ref<HTMLInputElement | null>(null)
const confirmInput = ref<HTMLInputElement | null>(null)
const showPassword = ref(false)
const showConfirm = ref(false)
const validationAttempted = ref(false)
const fieldErrors = computed(() => ({
  identifier: identifier.value.trim() ? null : 'register.identifierRequired',
  password: !password.value ? 'register.passwordRequired' : password.value.length < 12 ? 'register.shortPassword' : null,
  confirm: !confirm.value ? 'register.confirmRequired' : password.value !== confirm.value ? 'register.mismatch' : null,
}))
const firstValidationError = computed(() => fieldErrors.value.identifier ?? fieldErrors.value.password ?? fieldErrors.value.confirm)
watch(firstValidationError, (value) => {
  if (!value && errorKind.value === 'validation') {
    error.value = null
    errorKind.value = null
  }
})
const redirectTarget = computed(() => safeReturnTo(route.query.redirect ?? session.peekReturnTo()))

const hint = computed(() => {
  if (errorKind.value === 'validation' && firstValidationError.value) return authT(firstValidationError.value)
  if (error.value) return error.value
  if (submitting.value) return authT('register.submitting')
  return authT('register.passwordHint')
})

async function submit(): Promise<void> {
  if (submitting.value) return
  error.value = null
  errorKind.value = null
  validationAttempted.value = true
  if (firstValidationError.value) {
    error.value = authT(firstValidationError.value)
    errorKind.value = 'validation'
    await nextTick()
    const firstInvalidInput = fieldErrors.value.identifier ? identifierInput.value : fieldErrors.value.password ? passwordInput.value : confirmInput.value
    firstInvalidInput?.focus()
    return
  }
  submitting.value = true
  session.setReturnTo(redirectTarget.value)
  try {
    const ok = await session.register(identifier.value, password.value)
    if (!ok) {
      error.value = learnerAuthFailureCopy('register', session.lastError, authT)
      errorKind.value = 'server'
      return
    }
    await router.replace(session.adultGate === 'REJECTED' ? { name: 'forbidden' } : session.adultGate === 'PASSED' ? session.consumeReturnTo() : { name: 'onboarding' })
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <AuthLayout>
    <section class="login-card login-card--quiet v2-auth-card" aria-labelledby="register-title">
      <h1 id="register-title" class="v2-auth-title">{{ authT('register.title') }}</h1>
      <p class="lead v2-auth-lead">{{ authT('register.description') }}</p>
      <form class="login-form v2-auth-fields" novalidate :aria-busy="submitting" @submit.prevent="submit">
        <div class="field v2-field">
          <label for="register-identifier">{{ authT('register.identifier') }}</label>
          <input id="register-identifier" ref="identifierInput" v-model="identifier" name="identifier" type="text" autocomplete="username" autocapitalize="none" :spellcheck="false" required :aria-invalid="validationAttempted && !!fieldErrors.identifier || undefined" :aria-describedby="validationAttempted && fieldErrors.identifier ? 'register-identifier-error' : undefined" :placeholder="authT('register.identifierPlaceholder')" :disabled="submitting">
          <small v-if="validationAttempted && fieldErrors.identifier" id="register-identifier-error" class="register-field-error">{{ authT(fieldErrors.identifier) }}</small>
        </div>
        <div class="field v2-field">
          <label for="register-password">{{ authT('register.password') }}</label>
          <div class="password-field">
            <input id="register-password" ref="passwordInput" v-model="password" name="password" :type="showPassword ? 'text' : 'password'" autocomplete="new-password" required minlength="12" :aria-invalid="validationAttempted && !!fieldErrors.password || undefined" :aria-describedby="validationAttempted && fieldErrors.password ? 'register-password-error' : 'register-password-hint'" :placeholder="authT('register.passwordPlaceholder')" :disabled="submitting">
            <button type="button" class="icon-button" :disabled="submitting" aria-controls="register-password" :aria-label="t(showPassword ? 'hidePassword' : 'showPassword')" :aria-pressed="showPassword" @click="showPassword = !showPassword"><AppIcon name="eye" :size="19" /></button>
          </div>
          <small v-if="!(validationAttempted && fieldErrors.password)" id="register-password-hint" class="register-password-hint">{{ authT('register.passwordHint') }}</small>
          <small v-if="validationAttempted && fieldErrors.password" id="register-password-error" class="register-field-error">{{ authT(fieldErrors.password) }}</small>
        </div>
        <div class="field v2-field">
          <label for="register-confirm">{{ authT('register.confirmPassword') }}</label>
          <div class="password-field">
            <input id="register-confirm" ref="confirmInput" v-model="confirm" name="confirm" :type="showConfirm ? 'text' : 'password'" autocomplete="new-password" required :aria-invalid="validationAttempted && !!fieldErrors.confirm || undefined" :aria-describedby="validationAttempted && fieldErrors.confirm ? 'register-confirm-error' : undefined" :placeholder="authT('register.confirmPasswordPlaceholder')" :disabled="submitting">
            <button type="button" class="icon-button" :disabled="submitting" aria-controls="register-confirm" :aria-label="`${t(showConfirm ? 'hidePassword' : 'showPassword')} · ${authT('register.confirmPassword')}`" :aria-pressed="showConfirm" @click="showConfirm = !showConfirm"><AppIcon name="eye" :size="19" /></button>
          </div>
          <small v-if="validationAttempted && fieldErrors.confirm" id="register-confirm-error" class="register-field-error">{{ authT(fieldErrors.confirm) }}</small>
        </div>
        <div v-if="error || submitting" id="register-status" class="login-status v2-auth-status" :class="{ 'login-status--error': error }" :role="error ? 'alert' : 'status'" :aria-busy="submitting">
          <span class="login-status__mark" aria-hidden="true">{{ error ? '!' : '✦' }}</span>
          <div>
            <strong>{{ error ? authT(errorKind === 'validation' ? 'register.validationTitle' : 'register.errorTitle') : authT('register.submitting') }}</strong>
            <p v-if="!submitting || error">{{ hint }}</p>
          </div>
        </div>
        <button class="button button--primary v2-btn v2-btn--primary v2-btn--block" type="submit" :disabled="submitting">
          {{ submitting ? authT('register.submitting') : authT('register.start') }}
        </button>
      </form>
      <nav class="micro-copy v2-auth-micro register-exits" :aria-label="authT('register.existingAccount')"><span>{{ authT('register.existingAccount') }}</span><RouterLink :to="{ name: 'login', query: { redirect: redirectTarget } }">{{ authT('register.signIn') }}</RouterLink></nav>
    </section>
  </AuthLayout>
</template>

<style scoped>
.register-password-hint { color: var(--v2-mut); font-size: 13px; font-weight: 400; line-height: 1.7; }
.register-field-error { color: var(--v2-bad); font-size: var(--v2-text-xs); font-weight: 400; line-height: 1.7; }
.register-exits { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 8px 16px; padding-top: 16px; border-top: 1px solid var(--v2-line); margin-top: 28px; }
.register-exits a { display: inline-flex; align-items: center; min-width: 44px; min-height: 44px; }
</style>
