<script setup lang="ts">
import MobilePageHeader from '../../components/MobilePageHeader.vue'
import { openUniPage } from '../../platform/uni-runtime'
import { mobileT, useMobileExperience } from '../../platform/experience'
const { experienceStyle, experienceMotion } = useMobileExperience()

import { onLoad } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { continueAfterLogin } from '../../auth/navigation'
import { safeMobileReturnTo } from '../../auth/gateway-auth'
import { useSessionStore } from '../../stores/session'

const session = useSessionStore()
const identifier = ref('')
const password = ref('')
const confirm = ref('')
const returnTo = ref('/pages/home/home')
const submitting = ref(false)
const error = ref<string | null>(null)

function initialize(options?: { returnTo?: string; redirect?: string }): void {
  returnTo.value = safeMobileReturnTo(options?.returnTo ?? options?.redirect ?? session.peekReturnTo())
  session.setReturnTo(returnTo.value)
}

onLoad((options) => { initialize(options) })

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
  try {
    const ok = await session.register(identifier.value, password.value)
    if (!ok) {
      error.value = session.lastError || '注册没有完成，请稍后再试。'
      return
    }
    password.value = ''
    confirm.value = ''
    continueAfterLogin(session.consumeReturnTo())
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <view class="yx-page yx-login-page" :style="experienceStyle" :data-motion="experienceMotion">

    <MobilePageHeader page="register" />

    <view class="yx-card yx-login-card">
      <form @submit="submit">
        <label class="yx-field">
          <text>账号</text>
          <input aria-label="账号" v-model="identifier" type="text" autocomplete="username" placeholder="邮箱或账号" :disabled="submitting" />
        </label>
        <label class="yx-field">
          <text>密码（至少 12 位）</text>
          <input aria-label="密码" v-model="password" type="password" autocomplete="new-password" placeholder="输入密码" :disabled="submitting" />
        </label>
        <label class="yx-field">
          <text>确认密码</text>
          <input aria-label="确认密码" v-model="confirm" type="password" autocomplete="new-password" placeholder="再输入一次" :disabled="submitting" />
        </label>
        <text v-if="error" class="yx-login-error" role="alert">{{ error }}</text>
        <button tabindex="0" role="button" class="yx-button" form-type="submit" :disabled="submitting">
          {{ submitting ? '正在注册…' : '注册并继续' }}
        </button>
      </form>
    </view>
    <button tabindex="0" role="button" class="mobile-text-button mobile-auth-return" @click="openUniPage('/pages/login/login')">{{ mobileT('toLogin') }}</button>
    <text class="mobile-auth-note">{{ mobileT('adultNote') }}</text>
  </view>
</template>

<style scoped>
.yx-login-card { margin-top: 28rpx; }
.yx-field { display: grid; gap: 10rpx; margin-top: 22rpx; color: var(--yx-text-primary); font-size: 24rpx; font-weight: 700; }
.yx-field:first-child { margin-top: 0; }
.yx-field input { box-sizing: border-box; width: 100%; height: 80rpx; padding: 0 18rpx; border: 1rpx solid var(--yx-border); border-radius: 12rpx; color: var(--yx-text-primary); background: var(--yx-surface-page); font-size: 26rpx; font-weight: 400; }
.yx-field input:focus { border-color: var(--yx-brand); }
.yx-login-error { display: block; margin-top: 18rpx; color: var(--yx-danger); font-size: 22rpx; line-height: 1.55; }
</style>
