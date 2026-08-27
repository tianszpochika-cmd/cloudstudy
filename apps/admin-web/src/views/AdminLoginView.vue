<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { authT } from '../auth/i18n'
import { safeAdminReturnTo } from '../auth/gateway-auth'
import { useAdminStore } from '../stores/admin'

const route = useRoute()
const session = useAdminStore()
const loginUrl = ref('')
const statusMessage = computed(() => {
  if (session.lastError === 'SESSION_EXPIRED') return authT('session.expired')
  if (session.lastError === 'LOGOUT_FAILED') return authT('session.logoutFailed')
  return session.lastError
})
onMounted(async () => {
  try {
    loginUrl.value = await session.prepareLogin(safeAdminReturnTo(route.query.redirect))
  } catch (error) {
    session.lastError = error instanceof Error ? error.message : authT('login.noSuccess')
  }
})
</script>

<template>
  <main class="login-page"><div class="login-card"><span class="admin-brand__mark">✦</span><span class="admin-header__eyebrow">ENGLISHFLOW ADMIN</span><h1>{{ authT('login.title') }}</h1><p>{{ authT('login.description') }}</p><p v-if="statusMessage" class="login-status" role="alert">{{ statusMessage }}</p><p class="login-seam">{{ authT('login.pending') }}</p><a v-if="loginUrl" class="el-button el-button--primary" :href="loginUrl">{{ authT('login.start') }}</a></div></main>
</template>
