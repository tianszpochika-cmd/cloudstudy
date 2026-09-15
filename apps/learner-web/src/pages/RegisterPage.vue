<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { safeReturnTo } from '../auth/gateway-auth'
import { useSessionStore } from '../stores/session'

const route = useRoute()
const router = useRouter()
const session = useSessionStore()
const identifier = ref('')
const password = ref('')
const confirm = ref('')
const submitting = ref(false)
const error = ref<string | null>(null)
const redirectTarget = computed(() => safeReturnTo(route.query.redirect ?? session.peekReturnTo()))

const hint = computed(() => {
  if (error.value) return error.value
  if (submitting.value) return '正在创建账号…'
  return '账号密码由语学星认证中心校验；密码至少 12 位。'
})

async function submit(): Promise<void> {
  if (submitting.value) return
  error.value = null
  if (!identifier.value.trim() || !password.value) {
    error.value = '请输入账号和密码。'
    return
  }
  if (password.value.length < 12) {
    error.value = '密码至少 12 位，请换一个更长的密码。'
    return
  }
  if (password.value !== confirm.value) {
    error.value = '两次输入的密码不一致。'
    return
  }
  submitting.value = true
  session.setReturnTo(redirectTarget.value)
  try {
    const ok = await session.register(identifier.value, password.value)
    if (!ok) {
      error.value = session.lastError || '注册没有完成，请稍后再试。'
      return
    }
    await router.replace(session.adultGate === 'REQUIRED' ? { name: 'onboarding' } : session.consumeReturnTo())
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <main class="public-page">
    <section class="login-card login-card--quiet" aria-labelledby="register-title">
      <div class="brand">
        <span class="brand__mark" aria-hidden="true">✦</span>
        <span>语学星</span>
      </div>
      <h1 id="register-title">创建账号，开始学习</h1>
      <p class="lead">仅面向 18 岁以上成人与大学生；注册后需要确认年龄与必要说明。</p>
      <form class="login-form" novalidate @submit.prevent="submit">
        <label class="field">
          <span>账号</span>
          <input v-model="identifier" name="identifier" type="text" autocomplete="username" inputmode="email" placeholder="邮箱或账号" :disabled="submitting">
        </label>
        <label class="field">
          <span>密码（至少 12 位）</span>
          <input v-model="password" name="password" type="password" autocomplete="new-password" placeholder="输入密码" :disabled="submitting">
        </label>
        <label class="field">
          <span>确认密码</span>
          <input v-model="confirm" name="confirm" type="password" autocomplete="new-password" placeholder="再输入一次" :disabled="submitting">
        </label>
        <div class="login-status" :class="{ 'login-status--error': error }" :role="error ? 'alert' : 'status'" aria-live="polite" :aria-busy="submitting">
          <span class="login-status__mark" aria-hidden="true">{{ error ? '!' : '✦' }}</span>
          <div>
            <strong>{{ error ? '注册暂时不可用' : '等待注册' }}</strong>
            <p>{{ hint }}</p>
          </div>
        </div>
        <button class="button button--primary" type="submit" :disabled="submitting">
          {{ submitting ? '正在注册…' : '注册并继续' }}
        </button>
      </form>
      <p class="micro-copy">已有账号？<RouterLink :to="{ name: 'login', query: { redirect: redirectTarget } }">去登录</RouterLink> · <RouterLink :to="{ name: 'reset-password', query: { redirect: redirectTarget } }">忘记密码</RouterLink></p>
    </section>
  </main>
</template>
