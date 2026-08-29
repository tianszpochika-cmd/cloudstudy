<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { authT } from '../auth/i18n'
import { safeReturnTo } from '../auth/gateway-auth'
import { useSessionStore } from '../stores/session'

const route = useRoute()
const router = useRouter()
const session = useSessionStore()
const identifier = ref('')
const password = ref('')
const submitting = ref(false)
const loginError = ref<string | null>(null)
const redirectTarget = computed(() => safeReturnTo(route.query.redirect ?? session.peekReturnTo()))

const statusDescription = computed(() => {
  if (loginError.value) return loginError.value
  if (submitting.value) return authT('login.submitting')
  return authT('login.formHint')
})

async function submit(): Promise<void> {
  if (submitting.value) return
  loginError.value = null
  if (!identifier.value.trim() || !password.value) {
    loginError.value = authT('login.required')
    return
  }
  submitting.value = true
  session.setReturnTo(redirectTarget.value)
  try {
    const ok = await session.login(identifier.value, password.value)
    if (!ok) {
      loginError.value = session.lastError || authT('login.failed')
      return
    }
    await router.replace(session.adultGate === 'REQUIRED' ? { name: 'onboarding' } : session.consumeReturnTo())
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <main class="public-page">
    <section class="login-card login-card--quiet" aria-labelledby="login-title">
      <div class="brand">
        <span class="brand__mark" aria-hidden="true">✦</span>
        <span>语学星</span>
      </div>
      <h1 id="login-title">{{ authT('login.title') }}</h1>
      <p class="lead">{{ authT('login.description') }}</p>
      <form class="login-form" novalidate @submit.prevent="submit">
        <label class="field">
          <span>{{ authT('login.identifier') }}</span>
          <input
            v-model="identifier"
            name="identifier"
            type="text"
            autocomplete="username"
            inputmode="email"
            :placeholder="authT('login.identifierPlaceholder')"
            :disabled="submitting"
          >
        </label>
        <label class="field">
          <span>{{ authT('login.password') }}</span>
          <input
            v-model="password"
            name="password"
            type="password"
            autocomplete="current-password"
            :placeholder="authT('login.passwordPlaceholder')"
            :disabled="submitting"
          >
        </label>
        <div class="login-status" :class="{ 'login-status--error': loginError }" :role="loginError ? 'alert' : 'status'" aria-live="polite" :aria-busy="submitting">
          <span class="login-status__mark" aria-hidden="true">{{ loginError ? '!' : '✦' }}</span>
          <div>
            <strong>{{ loginError ? authT('login.unavailable') : authT('login.ready') }}</strong>
            <p>{{ statusDescription }}</p>
          </div>
        </div>
        <button class="button button--primary" type="submit" :disabled="submitting">
          {{ submitting ? authT('login.submitting') : authT('login.start') }}
        </button>
      </form>
      <p class="micro-copy">{{ authT('login.afterLogin') }}</p>
    </section>
  </main>
</template>
