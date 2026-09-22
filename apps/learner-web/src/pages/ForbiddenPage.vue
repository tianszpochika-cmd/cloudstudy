<script setup lang="ts">
import AuthLayout from '../layouts/AuthLayout.vue'
import { authT } from '../auth/i18n'
import { useSessionStore } from '../stores/session'

const session = useSessionStore()
</script>

<template>
  <AuthLayout>
    <section class="login-card" aria-labelledby="forbidden-title">
      <h1 id="forbidden-title">{{ authT('forbidden.title') }}</h1>
      <p class="lead">{{ authT('forbidden.description') }}</p>
      <p class="muted" role="alert">{{ session.forbiddenReason ?? authT('forbidden.description') }}</p>
      <div class="login-card__actions">
        <RouterLink class="button button--secondary" to="/home">返回学习首页</RouterLink>
        <RouterLink class="button button--ghost" to="/login">{{ authT('forbidden.login') }}</RouterLink>
      </div>
    </section>
  </AuthLayout>
</template>
