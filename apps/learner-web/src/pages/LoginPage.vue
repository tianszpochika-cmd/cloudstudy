<script setup lang="ts">
import { learnerReturnTo } from '../router'
import AppIcon from '../components/AppIcon.vue'
import { useExperienceText } from '../platform/experience-ui'
const t = useExperienceText()
const showPassword = ref(false)
import AuthLayout from '../layouts/AuthLayout.vue'
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { authT } from '../auth/i18n'
import { learnerAuthFailureCopy, learnerAuthFailureMarker, learnerLoginArrival } from '../auth/auth-failure-copy'
import { useSessionStore } from '../stores/session'

const route = useRoute()
const router = useRouter()
const session = useSessionStore()
const identifier = ref('')
const password = ref('')
const submitting = ref(false)
const loginError = ref<string | null>(null)
const failureKind = ref<'consent_withdrawn' | 'eligibility_insufficient' | 'credentials' | 'other' | null>(null)
const identifierInput = ref<HTMLInputElement | null>(null)
const passwordInput = ref<HTMLInputElement | null>(null)
const validationAttempted = ref(false)
const requiredError = ref(false)
const identifierMissing = computed(() => validationAttempted.value && !identifier.value.trim())
const passwordMissing = computed(() => validationAttempted.value && !password.value)
watch([identifier, password], () => {
  if (requiredError.value && identifier.value.trim() && password.value) {
    requiredError.value = false
    loginError.value = null
    failureKind.value = null
  }
})
const redirectTarget = computed(() => learnerReturnTo(route.query.redirect ?? session.peekReturnTo()))
const arrival = computed(() => learnerLoginArrival(route.query.reason))
const noticeKind = computed(() => {
  if (failureKind.value === 'consent_withdrawn' || failureKind.value === 'eligibility_insufficient') return failureKind.value
  if (failureKind.value) return null
  return arrival.value
})

const statusTitle = computed(() => {
  if (submitting.value && !loginError.value) return authT('login.ready')
  if (noticeKind.value === 'consent_withdrawn') return authT('login.consentWithdrawnTitle')
  if (noticeKind.value === 'eligibility_insufficient') return authT('login.eligibilityTitle')
  if (loginError.value) return authT('login.errorTitle')
  return authT('login.ready')
})

const statusDescription = computed(() => {
  if (loginError.value) return loginError.value
  if (submitting.value) return authT('login.submitting')
  if (noticeKind.value === 'consent_withdrawn') return authT('login.consentWithdrawn')
  if (noticeKind.value === 'eligibility_insufficient') return authT('login.eligibilityInsufficient')
  return authT('login.formHint')
})

async function submit(): Promise<void> {
  if (submitting.value) return
  loginError.value = null
  failureKind.value = null
  requiredError.value = false
  validationAttempted.value = true
  if (!identifier.value.trim() || !password.value) {
    failureKind.value = 'other'
    loginError.value = authT('login.required')
    requiredError.value = true
    await nextTick()
    const firstInvalidInput = identifierMissing.value ? identifierInput.value : passwordInput.value
    firstInvalidInput?.focus()
    return
  }
  submitting.value = true
  session.setReturnTo(redirectTarget.value)
  try {
    const ok = await session.login(identifier.value, password.value)
    if (!ok) {
      const marker = learnerAuthFailureMarker(session.lastError)
      failureKind.value = marker === 'iam.consent.withdrawn'
        ? 'consent_withdrawn'
        : marker === 'iam.eligibility.insufficient'
          ? 'eligibility_insufficient'
          : marker === 'iam.credentials.invalid'
            ? 'credentials'
            : 'other'
      loginError.value = learnerAuthFailureCopy('login', session.lastError, authT)
      return
    }
    failureKind.value = null
    await router.replace(session.adultGate === 'REQUIRED' ? { name: 'onboarding' } : session.adultGate === 'REJECTED' ? { name: 'forbidden' } : learnerReturnTo(session.consumeReturnTo()))
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <AuthLayout>
    <section class="login-card login-card--quiet v2-auth-card" aria-labelledby="login-title">
      <div class="brand">
        <span class="brand__mark" aria-hidden="true">✦</span>
        <span>语学星</span>
      </div>
      <h1 id="login-title" class="v2-auth-title">{{ authT('login.title') }}</h1>
      <p class="lead v2-auth-lead">{{ authT('login.description') }}</p>
      <form class="login-form v2-auth-fields" novalidate :aria-busy="submitting" @submit.prevent="submit">
        <label class="field v2-field">
          <span>{{ authT('login.identifier') }}</span>
          <input
            ref="identifierInput"
            v-model="identifier"
            name="identifier"
            type="text"
            autocomplete="username"
            autocapitalize="none"
            :spellcheck="false"
            required
            :aria-invalid="identifierMissing || undefined"
            :aria-describedby="identifierMissing ? 'login-status' : undefined"
            :placeholder="authT('login.identifierPlaceholder')"
            :disabled="submitting"
          >
        </label>
        <div class="field v2-field">
          <label for="login-password">{{ authT('login.password') }}</label>
          <div class="password-field"><input
            id="login-password"
            ref="passwordInput"
            v-model="password"
            name="password"
            :type="showPassword ? 'text' : 'password'"
            autocomplete="current-password"
            required
            :aria-invalid="passwordMissing || undefined"
            :aria-describedby="passwordMissing ? 'login-status' : undefined"
            :placeholder="authT('login.passwordPlaceholder')"
            :disabled="submitting"
          ><button type="button" class="icon-button" :disabled="submitting" aria-controls="login-password" :aria-label="t(showPassword ? 'hidePassword' : 'showPassword')" :aria-pressed="showPassword" @click="showPassword = !showPassword"><AppIcon name="eye" :size="19" /></button></div>
        </div>
        <div class="auth-links v2-auth-links"><RouterLink :to="{ name: 'register', query: { redirect: redirectTarget } }">{{ t('createAccount') }}</RouterLink><RouterLink v-if="!noticeKind" :to="{ name: 'reset-password', query: { redirect: redirectTarget } }">{{ t('forgot') }}</RouterLink></div>
        <div v-if="loginError || submitting || noticeKind" id="login-status" class="login-status v2-auth-status" :class="{ 'login-status--error': loginError && !noticeKind }" :role="loginError && !noticeKind ? 'alert' : 'status'" :aria-busy="submitting">
          <span class="login-status__mark" aria-hidden="true">{{ loginError && !noticeKind ? '!' : '✦' }}</span>
          <div>
            <strong>{{ statusTitle }}</strong>
            <p>{{ statusDescription }}</p>
          </div>
        </div>
        <button class="button button--primary v2-btn v2-btn--primary v2-btn--block" type="submit" :disabled="submitting">
          {{ submitting ? authT('login.submitting') : authT('login.start') }}
        </button>
      </form>
      <p class="micro-copy v2-auth-micro">{{ authT('login.afterLogin') }}</p>
    </section>
  </AuthLayout>
</template>
