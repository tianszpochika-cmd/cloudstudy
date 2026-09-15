<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { useSessionStore } from '../../stores/session'

const session = useSessionStore()
const step = ref<'request' | 'confirm'>('request')
const identifier = ref('')
const token = ref('')
const newPassword = ref('')
const submitting = ref(false)
const done = ref(false)
const error = ref<string | null>(null)

function initialize(options?: { token?: string }): void {
  if (typeof options?.token === 'string' && options.token) {
    token.value = options.token
    step.value = 'confirm'
  }
}

onLoad((options) => { initialize(options) })

async function send(): Promise<void> {
  if (submitting.value) return
  error.value = null
  if (!identifier.value.trim()) {
    error.value = '请输入账号。'
    return
  }
  submitting.value = true
  try {
    done.value = await session.requestPasswordReset(identifier.value)
    if (!done.value) error.value = session.lastError || '发送没有完成，请稍后再试。'
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
    done.value = await session.confirmPasswordReset(token.value, newPassword.value)
    if (!done.value) error.value = session.lastError || '重置没有完成，口令可能已过期。'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <view class="yx-page yx-login-page">
    <view class="yx-brand">
      <text class="yx-brand__mark" aria-hidden="true">✦</text>
      <text>语学星</text>
    </view>
    <text class="yx-eyebrow">ACCOUNT</text>
    <text class="yx-title">找回密码</text>
    <text class="yx-description">{{ done ? '如果账号存在，重置指引已经发出。' : '无论账号是否存在，提示都一样。' }}</text>

    <view class="yx-card yx-login-card">
      <form v-if="step === 'request'" @submit="send">
        <label class="yx-field">
          <text>账号</text>
          <input v-model="identifier" type="text" autocomplete="username" placeholder="邮箱或账号" :disabled="submitting" />
        </label>
        <text v-if="error" class="yx-login-error" role="alert">{{ error }}</text>
        <button class="yx-button" form-type="submit" :disabled="submitting">{{ submitting ? '正在发送…' : '发送重置指引' }}</button>
        <button class="yx-button yx-button--ghost" type="button" @click="step = 'confirm'">我已收到口令</button>
      </form>
      <form v-else @submit="confirm">
        <label class="yx-field">
          <text>重置口令</text>
          <input v-model="token" type="text" autocomplete="one-time-code" placeholder="邮件里的口令" :disabled="submitting" />
        </label>
        <label class="yx-field">
          <text>新密码（至少 12 位）</text>
          <input v-model="newPassword" type="password" autocomplete="new-password" placeholder="输入新密码" :disabled="submitting" />
        </label>
        <text v-if="error" class="yx-login-error" role="alert">{{ error }}</text>
        <button class="yx-button" form-type="submit" :disabled="submitting">{{ submitting ? '正在重置…' : '重置密码' }}</button>
        <button class="yx-button yx-button--ghost" type="button" @click="step = 'request'">返回上一步</button>
      </form>
    </view>
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
