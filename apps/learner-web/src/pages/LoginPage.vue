<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import EmptyState from '../components/EmptyState.vue'

const route = useRoute()
const router = useRouter()
const redirectTarget = computed(() => typeof route.query.redirect === 'string' ? route.query.redirect : '/home')

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
      <h1 id="login-title">登录学习空间</h1>
      <p class="lead">登录接口会严格使用生成的身份契约接入。当前先保留可恢复的入口，不提交未定义的账号字段。</p>
      <EmptyState
        title="身份契约尚未接入"
        description="后端认证 OpenAPI 与生成客户端就绪后，这里将替换为真实登录表单；现在不会伪造登录成功。"
      />
      <div class="login-card__actions">
        <RouterLink class="button button--secondary" :to="redirectTarget">返回受保护页面</RouterLink>
        <button class="button button--ghost" type="button" @click="returnToWelcome">返回欢迎页</button>
      </div>
    </section>
  </main>
</template>
