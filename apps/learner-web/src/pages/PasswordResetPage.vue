<script setup lang="ts">
import AuthLayout from '../layouts/AuthLayout.vue'
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { safeReturnTo } from '../auth/gateway-auth'
import { useSessionStore } from '../stores/session'

const route = useRoute()
const router = useRouter()
const session = useSessionStore()
const step = ref<'request' | 'confirm'>(typeof route.query.token === 'string' && route.query.token ? 'confirm' : 'request')
const identifier = ref('')
const token = ref(typeof route.query.token === 'string' ? route.query.token : '')
const newPassword = ref('')
const submitting = ref(false)
const done = ref(false)
const error = ref<string | null>(null)
const redirectTarget = computed(() => safeReturnTo(route.query.redirect ?? session.peekReturnTo()))

const hint = computed(() => {
  if (error.value) return error.value
  if (done.value) return step.value === 'confirm' ? '密码已重置，请用新密码登录。' : '如果账号存在，重置指引已经发出；请查收后继续。'
  return step.value === 'confirm' ? '请输入重置口令与新密码（至少 12 位）。' : '填写注册时使用的账号，然后查收重置指引。'
})

async function send(): Promise<void> {
  if (submitting.value) return
  error.value = null
  if (!identifier.value.trim()) {
    error.value = '请输入账号。'
    return
  }
  submitting.value = true
  try {
    const ok = await session.requestPasswordReset(identifier.value)
    done.value = ok
    if (!ok) error.value = session.lastError || '发送没有完成，请稍后再试。'
  } finally {
    submitting.value = false
  }
}

async function confirm(): Promise<void> {
  if (submitting.value) return
  error.value = null
  if (!token.value.trim() || !newPassword.value) {
    error.value = '请输入重置口令与新密码。'
    return
  }
  if (newPassword.value.length < 12) {
    error.value = '新密码至少 12 位。'
    return
  }
  submitting.value = true
  try {
    const ok = await session.confirmPasswordReset(token.value, newPassword.value)
    done.value = ok
    if (!ok) {
      error.value = session.lastError || '重置没有完成，口令可能已过期。'
      return
    }
    await router.replace({ name: 'login', query: { redirect: redirectTarget.value } })
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <AuthLayout>
    <section class="login-card login-card--quiet" aria-labelledby="reset-title">
      <div class="brand">
        <span class="brand__mark" aria-hidden="true">✦</span>
        <span>语学星</span>
      </div>
      <h1 id="reset-title">找回密码</h1>
      <p class="lead">输入注册时使用的账号，我们会发送重置指引。</p>
      <div class="login-status" :role="error ? 'alert' : 'status'" aria-live="polite">
        <span class="login-status__mark" aria-hidden="true">{{ error ? '!' : '✦' }}</span>
        <div>
          <strong>{{ error ? '暂时不可用' : '密码重置' }}</strong>
          <p>{{ hint }}</p>
        </div>
      </div>
      <form v-if="step === 'request'" class="login-form" novalidate @submit.prevent="send">
        <label class="field">
          <span>账号</span>
          <input v-model="identifier" name="identifier" type="text" autocomplete="username" placeholder="邮箱或账号" :disabled="submitting">
        </label>
        <button class="button button--primary" type="submit" :disabled="submitting">{{ submitting ? '正在发送…' : '发送重置指引' }}</button>
        <button class="button" type="button" @click="step = 'confirm'">我已收到口令</button>
      </form>
      <form v-else class="login-form" novalidate @submit.prevent="confirm">
        <label class="field">
          <span>重置口令</span>
          <input v-model="token" name="token" type="text" autocomplete="one-time-code" placeholder="邮件里的口令" :disabled="submitting">
        </label>
        <label class="field">
          <span>新密码（至少 12 位）</span>
          <input v-model="newPassword" name="newPassword" type="password" autocomplete="new-password" placeholder="输入新密码" :disabled="submitting">
        </label>
        <button class="button button--primary" type="submit" :disabled="submitting">{{ submitting ? '正在重置…' : '重置密码并去登录' }}</button>
        <button class="button" type="button" @click="step = 'request'">返回上一步</button>
      </form>
      <p class="micro-copy"><RouterLink :to="{ name: 'login', query: { redirect: redirectTarget } }">返回登录</RouterLink></p>
    </section>
  </AuthLayout>
</template>
