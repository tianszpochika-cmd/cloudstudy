<script setup lang="ts">
import MobilePageHeader from '../../components/MobilePageHeader.vue'
import { openUniPage } from '../../platform/uni-runtime'
import { mobileT, useMobileExperience } from '../../platform/experience'
const { experienceStyle, experienceMotion } = useMobileExperience()

import { onLoad } from '@dcloudio/uni-app'
import { onMounted, ref } from 'vue'
import { authT } from '../../auth/i18n'
import { mobileAuthFailureCopy } from '../../auth/auth-failure-copy'
import { continueAfterLogin } from '../../auth/navigation'
import { safeMobileRouteReturnTo } from '../../auth/gateway-auth'
import { useSessionStore } from '../../stores/session'

const session = useSessionStore()
const showPassword = ref(false)
const identifier = ref('')
const password = ref('')
const returnTo = ref('/pages/home/home')
const submitting = ref(false)
const initialized = ref(false)
const error = ref<string | null>(null)

function timeout<T>(promise: Promise<T>, milliseconds: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(message)), milliseconds)),
  ])
}

async function initialize(options?: { returnTo?: string; redirect?: string }): Promise<void> {
  if (initialized.value) return
  initialized.value = true
  const requested = safeMobileRouteReturnTo(options?.returnTo ?? options?.redirect, '')
  returnTo.value = requested || safeMobileRouteReturnTo(session.peekReturnTo())
  session.setReturnTo(returnTo.value)
  try {
    await timeout(session.restore(), 1500, '会话恢复超时')
    if (session.isAuthenticated) {
      await continueAfterLogin(session.consumeReturnTo())
    }
  } catch {
    // The form remains available when an existing cookie/session cannot be restored.
  }
}

onLoad((options) => { void initialize(options) })
onMounted(() => { void initialize() })

async function submit(): Promise<void> {
  if (submitting.value) return
  if (!identifier.value.trim() || !password.value) {
    error.value = authT('login.required')
    return
  }
  submitting.value = true
  error.value = null
  try {
    const success = await timeout(session.login(identifier.value, password.value), 10000, '登录服务响应超时，请稍后重试。')
    if (!success) {
      error.value = mobileAuthFailureCopy('login', session.lastError, mobileT)
      return
    }
    password.value = ''
    await continueAfterLogin(session.consumeReturnTo())
  } catch (cause) {
    error.value = mobileAuthFailureCopy('login', cause, mobileT)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <view class="yx-page yx-login-page v2-login" :style="experienceStyle" :data-motion="experienceMotion">

    <MobilePageHeader page="login" />

    <view class="v2-login-brand" aria-hidden="true"><text class="v2-login-brand-mark">✦</text></view>

    <view class="yx-card yx-login-card v2-login-card">
      <text class="v2-login-title">{{ mobileT('account') }}</text>
      <text class="mobile-auth-note v2-login-desc">{{ mobileT('adultNote') }}</text>
      <!-- No .prevent here: uni emits submit as a component event whose payload has no
           preventDefault, and Vue skips a handler guarded by a modifier that does not apply to a
           non-DOM event. There is also no native default action left to cancel. -->
      <form class="v2-login-form" @submit="submit">
        <label class="yx-field v2-login-field">
          <text>{{ authT('login.identifier') }}</text>
          <input class="v2-login-input" :aria-label="authT('login.identifier')" v-model="identifier" type="text" autocomplete="username" :placeholder="authT('login.identifierPlaceholder')" :disabled="submitting" />
        </label>
        <label class="yx-field v2-login-field">
          <text>{{ authT('login.password') }}</text>
          <view class="mobile-password v2-login-password"><input class="v2-login-input" :aria-label="authT('login.password')" v-model="password" :password="!showPassword" type="text" autocomplete="current-password" :placeholder="authT('login.passwordPlaceholder')" :disabled="submitting" @confirm="submit" /><button tabindex="0" role="button" class="mobile-text-button mobile-password-toggle v2-login-toggle" :aria-pressed="showPassword" @click="showPassword = !showPassword">{{ mobileT(showPassword ? 'hide' : 'show') }}</button></view>
        </label>
        <text v-if="error" class="yx-login-error v2-login-error" role="alert">{{ error }}</text>
        <!-- uni-app resolves form submission from the form-type prop, not from the HTML type
             attribute: its button component only calls form.submit() when props.formType is
             'submit'. A plain type="submit" therefore looks right on H5 but never submits. -->
        <button tabindex="0" role="button" class="yx-button v2-login-primary" form-type="submit" :disabled="submitting">
          {{ submitting ? authT('login.submitting') : authT('login.start') }}
        </button>
      </form>
      <button tabindex="0" role="button" class="mobile-text-button v2-login-secondary" @click="openUniPage('/pages/register/register')">{{ mobileT('register') }} ↗</button>
      <button tabindex="0" role="button" class="mobile-text-button v2-login-secondary" @click="openUniPage('/pages/reset-password/reset-password')">{{ mobileT('forgot') }}</button>
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
.yx-login-note { display: block; margin-top: 22rpx; color: var(--yx-text-tertiary); font-size: 22rpx; line-height: 1.6; }
</style>
