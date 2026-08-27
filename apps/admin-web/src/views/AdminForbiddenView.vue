<script setup lang="ts">
import { authT } from '../auth/i18n'
import { useAdminStore } from '../stores/admin'
const session = useAdminStore()
</script>

<template><main class="login-page"><div class="login-card"><h1>{{ authT('forbidden.title') }}</h1><p>{{ authT('forbidden.description') }}</p><p class="login-status" role="alert">{{ authT('forbidden.reason', { reason: session.forbiddenReason || authT('forbidden.fallbackReason') }) }}</p><p>{{ authT('forbidden.requested', { permission: session.forbiddenPermission || '—' }) }}</p><p>{{ authT('forbidden.permissionCount', { count: session.permissions.length }) }}</p><div class="login-actions"><RouterLink v-if="session.can('admin.dashboard.read')" to="/dashboard">{{ authT('session.restored') }}</RouterLink><RouterLink to="/login">{{ authT('forbidden.login') }}</RouterLink></div></div></main></template>
