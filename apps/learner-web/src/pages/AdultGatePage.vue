<script setup lang="ts">
import AuthLayout from '../layouts/AuthLayout.vue'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { authT } from '../auth/i18n'
import { currentBirthYearMax, isSubmittableBirthYear } from '../domain/adult-birth-year'
import { useB1Store } from '../stores/b1'
import { useSessionStore } from '../stores/session'

const router = useRouter()
const b1 = useB1Store()
const session = useSessionStore()
const busy = ref(false)
const error = ref<string | null>(null)
const birthYear = ref<number | null>(b1.onboarding.birthYear)
const birthYearMax = currentBirthYearMax()
const canConfirm = computed(() => isSubmittableBirthYear(birthYear.value, birthYearMax))

async function confirm(): Promise<void> {
  if (!canConfirm.value || busy.value) return
  busy.value = true
  error.value = null
  try {
    const submittedYear = birthYear.value as number
    if (await session.confirmAdultGate(submittedYear)) {
      const returnTo = session.consumeReturnTo()
      // A first-time learner must finish the durable onboarding write before entering home.
      // Existing deep links remain intact; only the default home return is staged through onboarding.
      await router.replace(returnTo === '/home' ? { name: 'onboarding' } : returnTo)
    }
    else if (session.adultGate === 'REJECTED') {
      await router.replace({ name: 'forbidden' })
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
  <AuthLayout>
    <section class="login-card" aria-labelledby="adult-title">
      <h1 id="adult-title">{{ authT('adult.title') }}</h1>
      <p class="lead">{{ authT('adult.description') }}</p>
      <label class="field-label" for="adult-birth-year">{{ authT('adult.birthYear') }}</label>
      <input id="adult-birth-year" v-model.number="birthYear" type="number" min="1900" :max="birthYearMax" autocomplete="bday-year" />
      <p v-if="error" class="error-text" role="alert">{{ error }}</p>
      <div class="login-card__actions">
        <button class="button button--primary" type="button" :disabled="busy || !canConfirm" @click="confirm">{{ busy ? authT('common.loading') : authT('adult.confirm') }}</button>
        <button class="button button--ghost" type="button" :disabled="busy" @click="cancel">取消</button>
      </div>
    </section>
  </AuthLayout>
</template>
