<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { authT } from '../auth/i18n'
import { useB1Store } from '../stores/b1'
import { useSessionStore } from '../stores/session'

const router = useRouter()
const b1 = useB1Store()
const session = useSessionStore()
const busy = ref(false)
const error = ref<string | null>(null)
const birthYear = ref<number | null>(b1.onboarding.birthYear)
const canConfirm = computed(() => Number.isInteger(birthYear.value) && (birthYear.value as number) >= 1900 && (birthYear.value as number) <= new Date().getFullYear() - 18)

async function confirm(): Promise<void> {
  if (!canConfirm.value || busy.value) return
  busy.value = true
  error.value = null
  try {
    if (await session.confirmAdultGate(birthYear.value as number)) {
      const returnTo = session.consumeReturnTo()
      // A first-time learner must finish the durable onboarding write before entering home.
      // Existing deep links remain intact; only the default home return is staged through onboarding.
      await router.replace(returnTo === '/home' ? { name: 'onboarding' } : returnTo)
    }
    else error.value = session.lastError ?? authT('adult.rejected')
  } finally {
    busy.value = false
  }
}

async function cancel(): Promise<void> {
  if (busy.value) return
  busy.value = true
  await session.logout()
  await router.replace({ name: 'login' })
  busy.value = false
}
</script>

<template>
  <main class="public-page">
    <section class="login-card" aria-labelledby="adult-title">
      <h1 id="adult-title">{{ authT('adult.title') }}</h1>
      <p class="lead">{{ authT('adult.description') }}</p>
      <label class="field-label" for="adult-birth-year">{{ authT('adult.birthYear') }}</label>
      <input id="adult-birth-year" v-model.number="birthYear" type="number" min="1900" :max="new Date().getFullYear() - 18" autocomplete="bday-year" />
      <p v-if="error" class="error-text" role="alert">{{ error }}</p>
      <div class="login-card__actions">
        <button class="button button--primary" type="button" :disabled="busy || !canConfirm" @click="confirm">{{ busy ? authT('common.loading') : authT('adult.confirm') }}</button>
        <button class="button button--ghost" type="button" :disabled="busy" @click="cancel">取消</button>
      </div>
    </section>
  </main>
</template>
