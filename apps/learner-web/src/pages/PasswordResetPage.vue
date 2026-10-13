<script setup lang="ts">
import AuthLayout from '../layouts/AuthLayout.vue'
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { authT } from '../auth/i18n'
import { safeReturnTo } from '../auth/gateway-auth'
import { learnerAuthFailureCopy, learnerAuthFailureMarker } from '../auth/auth-failure-copy'
import { useSessionStore } from '../stores/session'

const route = useRoute()
const router = useRouter()
const session = useSessionStore()
const step = ref<'request' | 'confirm'>(typeof route.query.token === 'string' && route.query.token ? 'confirm' : 'request')
const identifier = ref('')
const token = ref(typeof route.query.token === 'string' ? route.query.token : '')
const newPassword = ref('')
const submitting = ref(false)
const requestSent = ref(false)
const error = ref<string | null>(null)
const errorKind = ref<'validation' | 'server' | null>(null)
const redirectTarget = computed(() => safeReturnTo(route.query.redirect ?? session.peekReturnTo()))

const hint = computed(() => {
  if (error.value) return error.value
  if (submitting.value) return step.value === 'confirm' ? authT('passwordReset.resetting') : authT('passwordReset.sending')
  if (step.value === 'confirm') return authT('passwordReset.confirmHint')
  return requestSent.value ? authT('passwordReset.requestSent') : authT('passwordReset.requestHint')
})

async function send(): Promise<void> {
  if (submitting.value) return
  error.value = null
  errorKind.value = null
  if (!identifier.value.trim()) {
    error.value = authT('passwordReset.requiredIdentifier')
    errorKind.value = 'validation'
    return
  }
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
  if (!identifier.value.trim() || !token.value.trim() || !newPassword.value) {
    error.value = authT('passwordReset.requiredFields')
    errorKind.value = 'validation'
    return
  }
  if (newPassword.value.length < 12) {
    error.value = authT('passwordReset.shortPassword')
    errorKind.value = 'validation'
    return
  }
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
      <div class="brand">
        <span class="brand__mark" aria-hidden="true">✦</span>
        <span>语学星</span>
      </div>
      <h1 id="reset-title" class="v2-auth-title">{{ authT('passwordReset.title') }}</h1>
      <p class="lead v2-auth-lead">{{ authT('passwordReset.description') }}</p>
      <div class="login-status v2-auth-status" :role="error ? 'alert' : 'status'" aria-live="polite" :aria-busy="submitting">
        <span class="login-status__mark" aria-hidden="true">{{ error ? '!' : '✦' }}</span>
        <div>
          <strong>{{ error ? authT(errorKind === 'validation' ? 'passwordReset.validationTitle' : 'passwordReset.errorTitle') : authT('passwordReset.requestTitle') }}</strong>
          <p>{{ hint }}</p>
        </div>
      </div>
      <form v-if="step === 'request'" class="login-form v2-auth-fields" novalidate @submit.prevent="send">
        <label class="field v2-field">
          <span>{{ authT('passwordReset.identifier') }}</span>
          <input v-model="identifier" name="identifier" type="text" autocomplete="username" :aria-label="authT('passwordReset.identifier')" :placeholder="authT('passwordReset.requestIdentifierPlaceholder')" :disabled="submitting">
        </label>
        <button class="button button--primary v2-btn v2-btn--primary v2-btn--block" type="submit" :disabled="submitting">{{ submitting ? authT('passwordReset.sending') : authT('passwordReset.sendInstructions') }}</button>
        <button class="button v2-btn v2-btn--ghost v2-btn--block" type="button" @click="step = 'confirm'">{{ authT('passwordReset.receivedCode') }}</button>
      </form>
      <form v-else class="login-form v2-auth-fields" novalidate @submit.prevent="confirm">
        <label class="field v2-field">
          <span>{{ authT('passwordReset.identifier') }}</span>
          <input v-model="identifier" name="identifier" type="text" autocomplete="username" :aria-label="authT('passwordReset.identifier')" :placeholder="authT('passwordReset.confirmIdentifierPlaceholder')" :disabled="submitting">
        </label>
        <label class="field v2-field">
          <span>{{ authT('passwordReset.token') }}</span>
          <input v-model="token" name="token" type="text" autocomplete="one-time-code" :aria-label="authT('passwordReset.token')" :placeholder="authT('passwordReset.tokenPlaceholder')" :disabled="submitting">
        </label>
        <label class="field v2-field">
          <span>{{ authT('passwordReset.newPassword') }}</span>
          <input v-model="newPassword" name="newPassword" type="password" autocomplete="new-password" :aria-label="authT('passwordReset.newPassword')" :placeholder="authT('passwordReset.newPasswordPlaceholder')" :disabled="submitting">
        </label>
        <button class="button button--primary v2-btn v2-btn--primary v2-btn--block" type="submit" :disabled="submitting">{{ submitting ? authT('passwordReset.resetting') : authT('passwordReset.resetAction') }}</button>
        <button class="button v2-btn v2-btn--ghost v2-btn--block" type="button" @click="step = 'request'">{{ authT('passwordReset.back') }}</button>
      </form>
      <p class="micro-copy v2-auth-micro"><RouterLink :to="{ name: 'login', query: { redirect: redirectTarget } }">{{ authT('passwordReset.returnLogin') }}</RouterLink></p>
    </section>
  </AuthLayout>
</template>
