<script setup lang="ts">
import MobilePageHeader from '../../components/MobilePageHeader.vue'
import { openUniPage } from '../../platform/uni-runtime'
import { mobileT, useMobileExperience } from '../../platform/experience'
const { experienceStyle, experienceMotion } = useMobileExperience()

import { onLoad } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { continueAfterLogin } from '../../auth/navigation'
import { safeMobileReturnTo } from '../../auth/gateway-auth'
import { mobileAuthFailureCopy } from '../../auth/auth-failure-copy'
import { useSessionStore } from '../../stores/session'

const session = useSessionStore()
const identifier = ref('')
const password = ref('')
const confirm = ref('')
const returnTo = ref('/pages/home/home')
const submitting = ref(false)
const error = ref<string | null>(null)
/** IC-052 实时校验：输入即反馈，失败不枚举账号存在性。 */
const liveIdentifierHint = computed(() => {
  const value = identifier.value.trim()
  if (!value) return null
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return mobileT('auth.register.identifierInvalid')
  return null
})
const livePasswordHint = computed(() => {
  if (!password.value) return null
  if (password.value.length < 12) return mobileT('auth.register.shortPassword')
  return null
})
const liveConfirmHint = computed(() => {
  if (!confirm.value || !password.value) return null
  if (password.value !== confirm.value) return mobileT('auth.register.mismatch')
  return null
})
const hint = computed(() => {
  if (error.value) return error.value
  if (submitting.value) return mobileT('auth.register.submitting')
  return mobileT('auth.register.passwordHint')
})

function initialize(options?: { returnTo?: string; redirect?: string }): void {
  returnTo.value = safeMobileReturnTo(options?.returnTo ?? options?.redirect ?? session.peekReturnTo())
  session.setReturnTo(returnTo.value)
}

onLoad((options) => { initialize(options) })

async function submit(): Promise<void> {
  if (submitting.value) return
  error.value = null
  if (!identifier.value.trim() || !password.value) {
    error.value = mobileT('auth.register.required')
    return
  }
  if (password.value.length < 12) {
    error.value = mobileT('auth.register.shortPassword')
    return
  }
  if (password.value !== confirm.value) {
    error.value = mobileT('auth.register.mismatch')
    return
  }
  submitting.value = true
  try {
    const ok = await session.register(identifier.value, password.value)
    if (!ok) {
      error.value = mobileAuthFailureCopy('register', session.lastError, mobileT)
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

    <view class="yx-card yx-login-card" :aria-busy="submitting">
      <text class="mobile-auth-note">{{ mobileT('auth.register.passwordHint') }}</text>
      <form @submit="submit" :aria-busy="submitting">
        <label class="yx-field">
          <text>{{ mobileT('auth.register.identifier') }}</text>
          <input :aria-label="mobileT('auth.register.identifier')" v-model="identifier" type="text" autocomplete="username" :placeholder="mobileT('auth.register.identifierPlaceholder')" :disabled="submitting" />
          <text v-if="liveIdentifierHint" class="yx-login-error" role="status">{{ liveIdentifierHint }}</text>
        </label>
        <label class="yx-field">
          <text>{{ mobileT('auth.register.password') }}</text>
          <input :aria-label="mobileT('auth.register.password')" v-model="password" type="password" autocomplete="new-password" :placeholder="mobileT('auth.register.passwordPlaceholder')" :disabled="submitting" />
          <text v-if="livePasswordHint" class="yx-login-error" role="status">{{ livePasswordHint }}</text>
        </label>
        <label class="yx-field">
          <text>{{ mobileT('auth.register.confirmPassword') }}</text>
          <input :aria-label="mobileT('auth.register.confirmPassword')" v-model="confirm" type="password" autocomplete="new-password" :placeholder="mobileT('auth.register.confirmPasswordPlaceholder')" :disabled="submitting" />
          <text v-if="liveConfirmHint" class="yx-login-error" role="status">{{ liveConfirmHint }}</text>
        </label>
        <text v-if="error" class="yx-login-error" role="alert" aria-live="polite">{{ hint }}</text>
        <text v-else-if="submitting" class="mobile-auth-note" role="status" aria-live="polite">{{ hint }}</text>
        <button tabindex="0" role="button" class="yx-button" form-type="submit" :disabled="submitting">
          {{ submitting ? mobileT('auth.register.submitting') : mobileT('auth.register.start') }}
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
