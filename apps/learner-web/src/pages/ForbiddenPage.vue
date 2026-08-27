<script setup lang="ts">
import { authT } from '../auth/i18n'
import { useSessionStore } from '../stores/session'

const session = useSessionStore()
</script>

<template>
  <main class="public-page">
    <section class="login-card" aria-labelledby="forbidden-title">
      <h1 id="forbidden-title">{{ authT('forbidden.title') }}</h1>
      <p class="lead">{{ authT('forbidden.description') }}</p>
      <p class="muted" role="alert">{{ session.forbiddenReason ?? authT('forbidden.description') }}</p>
      <div class="login-card__actions">
        <RouterLink class="button button--secondary" to="/home">{{ authT('callback.returning') }}</RouterLink>
        <RouterLink class="button button--ghost" to="/login">{{ authT('forbidden.login') }}</RouterLink>
      </div>
    </section>
  </main>
</template>
