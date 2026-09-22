<script setup lang="ts">
import MobilePageHeader from '../../components/MobilePageHeader.vue'
import { openUniPage } from '../../platform/uni-runtime'
import { mobileT, useMobileExperience } from '../../platform/experience'
const { experienceStyle, experienceMotion } = useMobileExperience()

import { onLoad } from '@dcloudio/uni-app'
import { onMounted, ref } from 'vue'
import { authT } from '../../auth/i18n'
import { continueAfterLogin } from '../../auth/navigation'
import { safeMobileReturnTo } from '../../auth/gateway-auth'
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
  returnTo.value = safeMobileReturnTo(options?.returnTo ?? options?.redirect ?? session.peekReturnTo())
  session.setReturnTo(returnTo.value)
  try {
    await timeout(session.restore(), 1500, '会话恢复超时')
    if (session.isAuthenticated) {
      continueAfterLogin(session.consumeReturnTo())
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
      error.value = session.lastError || authT('login.failed')
      return
    }
    password.value = ''
    continueAfterLogin(session.consumeReturnTo())
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : authT('login.failed')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <view class="yx-page yx-login-page" :style="experienceStyle" :data-motion="experienceMotion">

    <MobilePageHeader page="login" />

    <view class="yx-card yx-login-card">
      <view class="mobile-auth-heading"><text>{{ mobileT('account') }}</text><button tabindex="0" role="button" class="mobile-text-button" @click="openUniPage('/pages/register/register')">{{ mobileT('register') }} ↗</button></view>
      <!-- No .prevent here: uni emits submit as a component event whose payload has no
           preventDefault, and Vue skips a handler guarded by a modifier that does not apply to a
           non-DOM event. There is also no native default action left to cancel. -->
      <form @submit="submit">
        <label class="yx-field">
          <text>{{ authT('login.identifier') }}</text>
          <input :aria-label="authT('login.identifier')" v-model="identifier" type="text" autocomplete="username" :placeholder="authT('login.identifierPlaceholder')" :disabled="submitting" />
        </label>
        <label class="yx-field">
          <text>{{ authT('login.password') }}</text>
          <view class="mobile-password"><input :aria-label="authT('login.password')" v-model="password" :password="!showPassword" type="text" autocomplete="current-password" :placeholder="authT('login.passwordPlaceholder')" :disabled="submitting" @confirm="submit" /><button tabindex="0" role="button" class="mobile-text-button mobile-password-toggle" :aria-pressed="showPassword" @click="showPassword = !showPassword">{{ mobileT(showPassword ? 'hide' : 'show') }}</button></view>
        </label>
        <text v-if="error" class="yx-login-error" role="alert">{{ error }}</text>
        <!-- uni-app resolves form submission from the form-type prop, not from the HTML type
             attribute: its button component only calls form.submit() when props.formType is
             'submit'. A plain type="submit" therefore looks right on H5 but never submits. -->
        <button tabindex="0" role="button" class="yx-button" form-type="submit" :disabled="submitting">
          {{ submitting ? authT('login.submitting') : authT('login.start') }}
        </button>
      </form>
      <view class="mobile-auth-links"><button tabindex="0" role="button" class="mobile-text-button" @click="openUniPage('/pages/reset-password/reset-password')">{{ mobileT('forgot') }}</button><text class="mobile-profile-caption">{{ mobileT('authTag') }}</text></view>
    </view>
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
.yx-login-note { display: block; margin-top: 22rpx; color: var(--yx-text-tertiary); font-size: 22rpx; line-height: 1.6; }
</style>
