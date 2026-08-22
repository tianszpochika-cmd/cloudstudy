<script setup lang="ts">
import { authT } from '../auth/i18n'
import { useAdminStore } from '../stores/admin'
const session = useAdminStore()
</script>

<template><main class="login-page"><div class="login-card"><h1>{{ authT('forbidden.title') }}</h1><p>{{ authT('forbidden.description') }}</p><p v-if="!session.permissions.length">{{ authT('forbidden.empty') }}</p><p v-else>{{ session.permissions.length }} permissions received from the server.</p><div class="login-actions"><RouterLink to="/dashboard">{{ authT('session.restored') }}</RouterLink><RouterLink to="/login">{{ authT('forbidden.login') }}</RouterLink></div></div></main></template>

