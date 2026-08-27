<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'
import { onMounted } from 'vue'
import { ref } from 'vue'
import { getUniRuntime } from '../../platform/uni-runtime'
import { authT } from '../../auth/i18n'
import { useSessionStore } from '../../stores/session'
import { safeMobileReturnTo } from '../../auth/gateway-auth'
import { continueAfterLogin } from '../../auth/navigation'

const session = useSessionStore()
const loginUrl = ref('')
const error = ref<string | null>(null)
const preparing = ref(false)
const returnTo = ref('/pages/home/home')
let initializationStarted = false

function timeout<T>(promise: Promise<T>, milliseconds: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(message)), milliseconds)),
  ])
}

async function ensureLoginUrl(): Promise<string | null> {
  if (loginUrl.value) return loginUrl.value
  if (preparing.value) return null
  preparing.value = true
  error.value = null
  try {
    loginUrl.value = await timeout(session.prepareLogin(returnTo.value), 8000, '身份服务响应超时，请重试。')
    return loginUrl.value
  } catch (cause) {
    error.value = cause instanceof Error && /cancel|denied/i.test(cause.message) ? authT('login.cancelled') : authT('login.retryHint')
    return null
  } finally {
    preparing.value = false
  }
}

async function initialize(options?: { returnTo?: string; redirect?: string; code?: string; state?: string; error?: string; error_description?: string }): Promise<void> {
  if (initializationStarted) return
  initializationStarted = true
  returnTo.value = safeMobileReturnTo(options?.returnTo ?? options?.redirect ?? session.peekReturnTo())
  const callback = options?.code || options?.error ? { code: options.code, state: options.state, error: options.error, errorDescription: options.error_description, returnTo: options.returnTo ?? options.redirect } : session.readLaunchCallback()
  if (callback) {
    if (await session.completeLogin(callback)) continueAfterLogin(session.consumeReturnTo())
    else error.value = callback.error === 'access_denied' ? authT('login.cancelled') : authT('login.failed')
    return
  }
  if (session.isAuthenticated) { continueAfterLogin(session.consumeReturnTo()); return }
  // A stale browser session or an unavailable identity API must not block the
  // login entry itself. Restore in the background and keep the real OIDC
  // action available within a bounded wait.
  void timeout(session.restore(), 1200, '会话恢复超时').catch(() => undefined)
  await ensureLoginUrl()
}

onLoad((options) => { void initialize(options) })
// uni-app H5 can mount the page before its page-level onLoad hook is replayed
// during a hash navigation. Keep the login action usable in that case.
onMounted(() => { void initialize() })

async function openLogin(): Promise<void> {
  const target = await ensureLoginUrl()
  if (!target) return
  const runtime = getUniRuntime()
  if (runtime.openURL) runtime.openURL(target)
  else if (typeof window !== 'undefined') window.location.assign(target)
  else runtime.showToast({ title: authT('login.pending'), icon: 'none' })
}
</script>

<template>
  <view class="yx-page">
    <view class="yx-brand">
      <text class="yx-brand__mark" aria-hidden="true">✦</text>
      <text>语学星</text>
    </view>
    <text class="yx-eyebrow">ACCOUNT</text>
    <text class="yx-title">{{ authT('login.title') }}</text>
    <text class="yx-description">{{ authT('login.description') }}</text>
    <view class="yx-card">
      <view class="yx-login-status" :class="{ 'yx-login-status--error': error }" :role="error ? 'alert' : 'status'" aria-live="polite">
        <text class="yx-login-status__mark" aria-hidden="true">{{ error ? '!' : '✦' }}</text>
        <view class="yx-login-status__copy">
          <text class="yx-login-status__title">{{ error ? authT('login.unavailable') : loginUrl ? authT('login.ready') : authT('login.pending') }}</text>
          <text class="yx-login-status__description">{{ error ? authT('login.retryHint') : loginUrl ? authT('login.readyDescription') : authT('login.preparingDescription') }}</text>
        </view>
      </view>
      <button class="yx-button" type="button" :disabled="preparing" @click="openLogin">{{ preparing ? authT('login.preparing') : error ? authT('login.retry') : authT('login.start') }}</button>
      <text class="yx-login-note">{{ authT('login.afterLogin') }}</text>
    </view>
  </view>
</template>

<style scoped>
.yx-login-status { display: flex; align-items: center; gap: 18rpx; margin-top: 28rpx; padding: 18rpx; border: 1rpx solid var(--yx-border); border-radius: 16rpx; background: var(--yx-surface-page); }
.yx-login-status__mark { display: flex; width: 52rpx; height: 52rpx; flex: 0 0 auto; align-items: center; justify-content: center; border-radius: 16rpx; color: var(--yx-brand); background: var(--yx-brand-soft); font-size: 28rpx; font-weight: 800; }
.yx-login-status__copy { display: flex; min-width: 0; flex-direction: column; gap: 6rpx; }
.yx-login-status__title { color: var(--yx-text-primary); font-size: 26rpx; font-weight: 700; }
.yx-login-status__description, .yx-login-note { color: var(--yx-text-secondary); font-size: 22rpx; line-height: 1.6; }
.yx-login-status--error { border-color: var(--yx-danger); background: var(--yx-danger-soft); }
.yx-login-status--error .yx-login-status__mark { color: var(--yx-danger); background: rgba(233, 86, 104, .12); }
.yx-login-note { display: block; margin-top: 22rpx; color: var(--yx-text-tertiary); }
</style>
