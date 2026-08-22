<script setup lang="ts">
import { ref } from 'vue'
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

async function confirm(): Promise<void> {
  busy.value = true
  error.value = null
  if (birthYear.value && await session.confirmAdultGate(birthYear.value)) await router.replace(session.consumeReturnTo())
  else error.value = session.lastError ?? authT('adult.rejected')
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
      <button class="button button--primary" type="button" :disabled="busy || !birthYear" @click="confirm">{{ busy ? authT('common.loading') : authT('adult.confirm') }}</button>
    </section>
  </main>
</template>
