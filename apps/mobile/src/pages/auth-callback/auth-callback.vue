<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'
import { onMounted, ref } from 'vue'
import { continueAfterLogin } from '../../auth/navigation'
import { openUniPage } from '../../platform/uni-runtime'
import { authT } from '../../auth/i18n'
import { type MobileCallbackInput } from '../../auth/gateway-auth'
import { useSessionStore } from '../../stores/session'

const session = useSessionStore()
const error = ref<string | null>(null)
let initialized = false

function browserCallbackInput(): MobileCallbackInput | null {
  if (typeof window === 'undefined' || !window.location) return null
  const search = new URLSearchParams(window.location.search)
  const hashQueryIndex = window.location.hash.indexOf('?')
  const hash = new URLSearchParams(hashQueryIndex >= 0 ? window.location.hash.slice(hashQueryIndex + 1) : '')
  const read = (key: string): string | undefined => search.get(key) ?? hash.get(key) ?? undefined
  const code = read('code')
  const state = read('state')
  const callbackError = read('error')
  if (!code && !state && !callbackError) return null
  return {
    code,
    state,
    error: callbackError,
    errorDescription: read('error_description'),
    errorUri: read('error_uri'),
    returnTo: read('returnTo') ?? read('redirect'),
  }
}

async function initialize(options?: { code?: string; state?: string; error?: string; error_description?: string; error_uri?: string; returnTo?: string; redirect?: string }): Promise<void> {
  if (initialized) return
  const input = options && (options.code || options.state || options.error)
    ? { code: options.code, state: options.state, error: options.error, errorDescription: options.error_description, errorUri: options.error_uri, returnTo: options.returnTo ?? options.redirect }
    : browserCallbackInput()
  if (!input) return
  initialized = true
  if (await session.completeLogin(input)) continueAfterLogin(session.consumeReturnTo())
  else error.value = authT('callback.failed')
}

onLoad((options) => { void initialize(options) })
// uni-app H5 may mount the callback page after a hash deep-link without
// replaying the page-level onLoad hook. Read only the visible callback query
// and use the same one-shot authentication path in that case.
onMounted(() => { void initialize() })
</script>

<template>
  <view class="yx-page yx-auth-handoff">
    <view class="yx-auth-handoff__mark" aria-hidden="true">✦</view>
    <text class="yx-title">{{ error ? authT('callback.failed') : authT('callback.title') }}</text>
    <text v-if="!error" class="yx-description">{{ authT('callback.restoring') }}</text>
    <text v-else class="yx-error" role="alert">{{ error }}</text>
    <button v-if="error" class="yx-button" type="button" @click="openUniPage('/pages/login/login')">{{ authT('forbidden.login') }}</button>
  </view>
</template>

<style scoped>
.yx-auth-handoff { display: flex; min-height: 100vh; box-sizing: border-box; flex-direction: column; align-items: center; justify-content: center; padding-top: calc(48rpx + env(safe-area-inset-top)); padding-bottom: calc(48rpx + env(safe-area-inset-bottom)); text-align: center; }
.yx-auth-handoff .yx-title { margin-top: 28rpx; }
.yx-auth-handoff .yx-description { max-width: 620rpx; }
.yx-auth-handoff__mark { display: flex; width: 112rpx; height: 112rpx; align-items: center; justify-content: center; border-radius: 34rpx; color: #fff; background: linear-gradient(135deg, #596bff, #7c5cfc); font-size: 48rpx; box-shadow: 0 14rpx 34rpx rgba(89, 107, 255, .24); animation: mobile-auth-pulse 1.8s ease-in-out infinite; }
@keyframes mobile-auth-pulse { 50% { transform: scale(.94); opacity: .78; } }
</style>
