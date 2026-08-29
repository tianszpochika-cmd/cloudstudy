<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { authT } from '../auth/i18n'
import { safeAdminReturnTo } from '../auth/gateway-auth'
import { useAdminStore } from '../stores/admin'

const route = useRoute()
const router = useRouter()
const session = useAdminStore()
const identifier = ref('')
const password = ref('')
const submitting = ref(false)
const errorMessage = ref<string | null>(null)
const returnTo = computed(() => safeAdminReturnTo(route.query.redirect))

async function submit(): Promise<void> {
  if (submitting.value) return
  errorMessage.value = null
  if (!identifier.value.trim() || !password.value) {
    errorMessage.value = authT('login.required')
    return
  }
  submitting.value = true
  session.setReturnTo(returnTo.value)
  try {
    const ok = await session.login(identifier.value, password.value)
    if (!ok) {
      errorMessage.value = session.lastError || authT('login.failed')
      return
    }
    await router.replace(session.can('admin.dashboard.read') ? session.consumeReturnTo() : { name: 'admin-forbidden' })
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <main class="login-page">
    <form class="login-card" novalidate @submit.prevent="submit">
      <span class="admin-brand__mark" aria-hidden="true">✦</span>
      <span class="admin-header__eyebrow">ENGLISHFLOW ADMIN</span>
      <h1>{{ authT('login.title') }}</h1>
      <p>{{ authT('login.description') }}</p>
      <label class="admin-login-field">
        <span>{{ authT('login.identifier') }}</span>
        <input v-model="identifier" name="identifier" type="text" autocomplete="username" :placeholder="authT('login.identifierPlaceholder')" :disabled="submitting">
      </label>
      <label class="admin-login-field">
        <span>{{ authT('login.password') }}</span>
        <input v-model="password" name="password" type="password" autocomplete="current-password" :placeholder="authT('login.passwordPlaceholder')" :disabled="submitting">
      </label>
      <p v-if="errorMessage" class="login-status" role="alert">{{ errorMessage }}</p>
      <p v-else class="login-seam" role="status" :aria-busy="submitting">{{ submitting ? authT('login.submitting') : authT('login.formHint') }}</p>
      <button class="el-button el-button--primary" type="submit" :disabled="submitting">{{ submitting ? authT('login.submitting') : authT('login.start') }}</button>
    </form>
  </main>
</template>
