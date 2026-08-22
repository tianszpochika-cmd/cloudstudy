<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { authT } from '../auth/i18n'
import { safeAdminReturnTo } from '../auth/gateway-auth'
import { useAdminStore } from '../stores/admin'

const route = useRoute()
const session = useAdminStore()
const loginUrl = ref('')
onMounted(() => { loginUrl.value = session.prepareLogin(safeAdminReturnTo(route.query.redirect)) })
</script>

<template>
  <main class="login-page"><div class="login-card"><span class="admin-brand__mark">✦</span><span class="admin-header__eyebrow">ENGLISHFLOW ADMIN</span><h1>{{ authT('login.title') }}</h1><p>{{ authT('login.description') }}</p><p class="login-seam">{{ authT('login.pending') }}</p><a v-if="loginUrl" class="el-button el-button--primary" :href="loginUrl">{{ authT('login.start') }}</a><RouterLink to="/">{{ authT('forbidden.login') }}</RouterLink></div></main>
</template>
