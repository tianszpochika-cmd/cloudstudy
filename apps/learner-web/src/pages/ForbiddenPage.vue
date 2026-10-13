<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import AuthLayout from '../layouts/AuthLayout.vue'
import { authT } from '../auth/i18n'
import { useSessionStore } from '../stores/session'

const router = useRouter()
const session = useSessionStore()

const isRejected = computed(() => session.adultGate === 'REJECTED')
const explanation = computed(() => {
  if (isRejected.value) {
    return '当前版本仅面向 18 岁以上成人开放，暂不能向你开放学习功能。'
  }
  return session.forbiddenReason ?? authT('forbidden.description')
})

async function logout(): Promise<void> {
  await session.logout()
  await router.replace({ name: 'login' })
}
</script>

<template>
  <AuthLayout class="v2-page v2-page--forbidden">
    <div class="v2-forbidden-layout">
      <div class="v2-forbidden-main">
        <section class="login-card v2-forbidden-card" aria-labelledby="forbidden-title">
          <h1 id="forbidden-title" class="v2-forbidden-title">{{ isRejected ? '学习访问受限' : authT('forbidden.title') }}</h1>
          <p class="lead v2-forbidden-lead">{{ explanation }}</p>
          <p v-if="!isRejected && session.forbiddenReason" class="muted v2-forbidden-reason" role="alert">{{ session.forbiddenReason }}</p>
          <div class="login-card__actions v2-forbidden-actions">
            <template v-if="isRejected">
              <RouterLink class="button button--secondary" to="/settings">前往账号设置</RouterLink>
              <RouterLink class="button button--ghost" to="/support">帮助与反馈</RouterLink>
              <button class="button button--ghost" type="button" @click="logout">退出登录</button>
            </template>
            <template v-else>
              <RouterLink class="button button--secondary" to="/home">返回学习首页</RouterLink>
              <button class="button button--ghost" type="button" @click="logout">{{ authT('forbidden.login') }}</button>
            </template>
          </div>
        </section>
      </div>
      <aside class="v2-forbidden-side" aria-label="访问受限说明">
        <h2 class="v2-forbidden-side-title">遇到访问受限时</h2>
        <ol class="v2-forbidden-tips">
          <li>主列会说明访问受限的原因。</li>
          <li>按主列按钮继续下一步。</li>
          <li>可用退出登录结束当前会话。</li>
        </ol>
      </aside>
    </div>
  </AuthLayout>
</template>
