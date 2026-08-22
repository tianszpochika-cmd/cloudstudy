<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import EmptyState from '../components/EmptyState.vue'
import { authT } from '../auth/i18n'
import { safeReturnTo } from '../auth/gateway-auth'
import { useSessionStore } from '../stores/session'

const route = useRoute()
const router = useRouter()
const session = useSessionStore()
const redirectTarget = computed(() => safeReturnTo(route.query.redirect))
const loginUrl = ref('')
const callbackError = computed(() => typeof route.query.error === 'string' ? route.query.error : session.lastError)

onMounted(() => {
  session.setReturnTo(redirectTarget.value)
  loginUrl.value = session.prepareLogin(redirectTarget.value)
})

function returnToWelcome(): void {
  void router.push('/')
}
</script>

<template>
  <main class="public-page">
    <section class="login-card" aria-labelledby="login-title">
      <div class="brand">
        <span class="brand__mark" aria-hidden="true">✦</span>
        <span>语学星</span>
      </div>
      <h1 id="login-title">{{ authT('login.title') }}</h1>
      <p class="lead">{{ authT('login.description') }}</p>
      <EmptyState :title="authT('login.pending')" :description="authT('login.noSuccess')" />
      <p v-if="callbackError" class="error-text" role="alert">{{ callbackError }}</p>
      <div class="login-card__actions">
        <a v-if="loginUrl" class="button button--primary" :href="loginUrl">{{ authT('login.start') }}</a>
        <RouterLink class="button button--secondary" :to="redirectTarget">{{ authT('login.restore') }}</RouterLink>
        <button class="button button--ghost" type="button" @click="returnToWelcome">{{ authT('forbidden.login') }}</button>
      </div>
    </section>
  </main>
</template>
