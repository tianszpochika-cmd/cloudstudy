<script setup lang="ts">
import AuthLayout from '../layouts/AuthLayout.vue'
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { authT } from '../auth/i18n'
import { safeReturnTo } from '../auth/gateway-auth'
import { learnerAuthFailureCopy } from '../auth/auth-failure-copy'
import { useSessionStore } from '../stores/session'

const route = useRoute()
const router = useRouter()
const session = useSessionStore()
const identifier = ref('')
const password = ref('')
const confirm = ref('')
const submitting = ref(false)
const error = ref<string | null>(null)
const errorKind = ref<'validation' | 'server' | null>(null)
const redirectTarget = computed(() => safeReturnTo(route.query.redirect ?? session.peekReturnTo()))

const hint = computed(() => {
  if (error.value) return error.value
  if (submitting.value) return authT('register.submitting')
  return authT('register.passwordHint')
})

async function submit(): Promise<void> {
  if (submitting.value) return
  error.value = null
  errorKind.value = null
  if (!identifier.value.trim() || !password.value) {
    error.value = authT('register.required')
    errorKind.value = 'validation'
    return
  }
  if (password.value.length < 12) {
    error.value = authT('register.shortPassword')
    errorKind.value = 'validation'
    return
  }
  if (password.value !== confirm.value) {
    error.value = authT('register.mismatch')
    errorKind.value = 'validation'
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
    await router.replace(session.adultGate === 'REQUIRED' ? { name: 'onboarding' } : session.consumeReturnTo())
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <AuthLayout>
    <section class="login-card login-card--quiet" aria-labelledby="register-title">
      <div class="brand">
        <span class="brand__mark" aria-hidden="true">✦</span>
        <span>语学星</span>
      </div>
      <h1 id="register-title">{{ authT('register.title') }}</h1>
      <p class="lead">{{ authT('register.description') }}</p>
      <form class="login-form" novalidate @submit.prevent="submit">
        <label class="field">
          <span>{{ authT('register.identifier') }}</span>
          <input v-model="identifier" name="identifier" type="text" autocomplete="username" inputmode="email" :aria-label="authT('register.identifier')" :placeholder="authT('register.identifierPlaceholder')" :disabled="submitting">
        </label>
        <label class="field">
          <span>{{ authT('register.password') }}</span>
          <input v-model="password" name="password" type="password" autocomplete="new-password" :aria-label="authT('register.password')" :placeholder="authT('register.passwordPlaceholder')" :disabled="submitting">
        </label>
        <label class="field">
          <span>{{ authT('register.confirmPassword') }}</span>
          <input v-model="confirm" name="confirm" type="password" autocomplete="new-password" :aria-label="authT('register.confirmPassword')" :placeholder="authT('register.confirmPasswordPlaceholder')" :disabled="submitting">
        </label>
        <div class="login-status" :class="{ 'login-status--error': error }" :role="error ? 'alert' : 'status'" aria-live="polite" :aria-busy="submitting">
          <span class="login-status__mark" aria-hidden="true">{{ error ? '!' : '✦' }}</span>
          <div>
            <strong>{{ error ? authT(errorKind === 'validation' ? 'register.validationTitle' : 'register.errorTitle') : authT('register.ready') }}</strong>
            <p>{{ hint }}</p>
          </div>
        </div>
        <button class="button button--primary" type="submit" :disabled="submitting">
          {{ submitting ? authT('register.submitting') : authT('register.start') }}
        </button>
      </form>
      <p class="micro-copy">{{ authT('register.existingAccount') }}<RouterLink class="micro-copy__action" :to="{ name: 'login', query: { redirect: redirectTarget } }">{{ authT('register.signIn') }}</RouterLink> · <RouterLink :to="{ name: 'reset-password', query: { redirect: redirectTarget } }">{{ authT('register.forgotPassword') }}</RouterLink></p>
    </section>
  </AuthLayout>
</template>
