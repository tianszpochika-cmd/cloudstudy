<script setup lang="ts">
import MobilePageHeader from '../../components/MobilePageHeader.vue'
import { openUniPage } from '../../platform/uni-runtime'
import { mobileT, useMobileExperience } from '../../platform/experience'
const { experienceStyle, experienceMotion } = useMobileExperience()

import { onLoad } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { mobileAuthFailureCopy } from '../../auth/auth-failure-copy'
import { useSessionStore } from '../../stores/session'

const session = useSessionStore()
const step = ref<'request' | 'confirm'>('request')
const identifier = ref('')
const token = ref('')
const newPassword = ref('')
const submitting = ref(false)
const done = ref(false)
const resetCompleted = ref(false)
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
    error.value = mobileT('auth.resetPassword.requiredIdentifier')
    return
  }
  submitting.value = true
  try {
    done.value = await session.requestPasswordReset(identifier.value)
    if (!done.value) error.value = mobileAuthFailureCopy('resetRequest', session.lastError, mobileT)
  } finally {
    submitting.value = false
  }
}

async function confirm(): Promise<void> {
  if (submitting.value) return
  error.value = null
  if (!identifier.value.trim() || !token.value.trim() || !newPassword.value) {
    error.value = mobileT('auth.resetPassword.requiredFields')
    return
  }
  if (newPassword.value.length < 12) {
    error.value = mobileT('auth.resetPassword.shortPassword')
    return
  }
  submitting.value = true
  try {
    done.value = await session.confirmPasswordReset(identifier.value, token.value, newPassword.value)
    if (done.value) { resetCompleted.value = true; identifier.value = ''; token.value = ''; newPassword.value = '' }
    if (!done.value) error.value = mobileAuthFailureCopy('resetConfirm', session.lastError, mobileT)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <view class="yx-page yx-login-page v2-reset" :style="experienceStyle" :data-motion="experienceMotion">

    <MobilePageHeader page="reset-password" />

    <view class="v2-reset-brand" aria-hidden="true"><text class="v2-reset-brand-mark">✦</text></view>

    <view class="yx-card yx-login-card v2-reset-card" :aria-busy="submitting">
      <text class="v2-reset-title">{{ mobileT('auth.resetPassword.resetAction') }}</text>
      <text class="mobile-auth-note v2-reset-desc">{{ mobileT('adultNote') }}</text>
      <text v-if="resetCompleted" class="mobile-success-note v2-reset-note" role="status" aria-live="polite">{{ mobileT('resetComplete') }}</text>
      <text v-else-if="done && step === 'request'" class="mobile-success-note v2-reset-note" role="status" aria-live="polite">{{ mobileT('resetSent') }}</text>
      <text v-if="!resetCompleted && !(done && step === 'request')" class="mobile-auth-note v2-reset-note">{{ mobileT(step === 'request' ? 'auth.resetPassword.requestHint' : 'auth.resetPassword.confirmHint') }}</text>
      <form v-if="!resetCompleted && step === 'request'" class="v2-reset-form" @submit="send" :aria-busy="submitting">
        <label class="yx-field v2-reset-field">
          <text>{{ mobileT('auth.resetPassword.identifier') }}</text>
          <input class="v2-reset-input" :aria-label="mobileT('auth.resetPassword.identifier')" v-model="identifier" type="text" autocomplete="username" :placeholder="mobileT('auth.resetPassword.requestIdentifierPlaceholder')" :disabled="submitting" />
        </label>
        <text v-if="error" class="yx-login-error v2-reset-error" role="alert" aria-live="polite">{{ error }}</text>
        <button tabindex="0" role="button" class="yx-button v2-reset-primary" form-type="submit" :disabled="submitting">{{ submitting ? mobileT('auth.resetPassword.sending') : mobileT('auth.resetPassword.sendInstructions') }}</button>
        <button tabindex="0" role="button" class="mobile-text-button v2-reset-secondary" type="button" @click="step = 'confirm'">{{ mobileT('auth.resetPassword.receivedCode') }}</button>
      </form>
      <form v-else-if="!resetCompleted" class="v2-reset-form" @submit="confirm" :aria-busy="submitting">
        <label class="yx-field v2-reset-field">
          <text>{{ mobileT('auth.resetPassword.identifier') }}</text>
          <input class="v2-reset-input" :aria-label="mobileT('auth.resetPassword.identifier')" v-model="identifier" type="text" autocomplete="username" :placeholder="mobileT('auth.resetPassword.confirmIdentifierPlaceholder')" :disabled="submitting" />
        </label>
        <label class="yx-field v2-reset-field">
          <text>{{ mobileT('auth.resetPassword.token') }}</text>
          <input class="v2-reset-input" :aria-label="mobileT('auth.resetPassword.token')" v-model="token" type="text" autocomplete="one-time-code" :placeholder="mobileT('auth.resetPassword.tokenPlaceholder')" :disabled="submitting" />
        </label>
        <label class="yx-field v2-reset-field">
          <text>{{ mobileT('auth.resetPassword.newPassword') }}</text>
          <input class="v2-reset-input" :aria-label="mobileT('auth.resetPassword.newPassword')" v-model="newPassword" type="password" autocomplete="new-password" :placeholder="mobileT('auth.resetPassword.newPasswordPlaceholder')" :disabled="submitting" />
        </label>
        <text v-if="error" class="yx-login-error v2-reset-error" role="alert" aria-live="polite">{{ error }}</text>
        <button tabindex="0" role="button" class="yx-button v2-reset-primary" form-type="submit" :disabled="submitting">{{ submitting ? mobileT('auth.resetPassword.resetting') : mobileT('auth.resetPassword.resetAction') }}</button>
        <button tabindex="0" role="button" class="mobile-text-button v2-reset-secondary" type="button" @click="step = 'request'">{{ mobileT('auth.resetPassword.back') }}</button>
      </form>
      <button tabindex="0" role="button" class="mobile-text-button v2-reset-secondary" @click="openUniPage('/pages/login/login')">{{ mobileT('toLogin') }}</button>
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
