<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { getUniRuntime } from '../../platform/uni-runtime'
import EmptyState from '../../components/EmptyState.vue'
import { authT } from '../../auth/i18n'
import { useSessionStore } from '../../stores/session'

const session = useSessionStore()
const loginUrl = ref('')
const error = ref<string | null>(null)

onLoad(async (options) => {
  await session.restore()
  const callback = options?.code || options?.error ? { code: options.code, state: options.state, error: options.error, errorDescription: options.error_description, returnTo: options.returnTo ?? options.redirect } : session.readLaunchCallback()
  if (callback) {
    if (await session.completeLogin(callback)) getUniRuntime().navigateTo({ url: session.consumeReturnTo() })
    else error.value = session.lastError
    return
  }
  loginUrl.value = session.prepareLogin('/pages/home/home')
})

function openLogin(): void {
  if (!loginUrl.value) return
  const runtime = getUniRuntime()
  if (runtime.openURL) runtime.openURL(loginUrl.value)
  else runtime.showToast({ title: authT('login.pending'), icon: 'none' })
}

function goBack(): void {
  getUniRuntime().navigateTo({ url: '/pages/home/home' })
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
      <EmptyState :title="authT('login.pending')" :description="authT('login.noSuccess')" />
      <text v-if="error" class="yx-error" role="alert">{{ error }}</text>
      <button v-if="loginUrl" class="yx-button" type="button" @click="openLogin">{{ authT('login.start') }}</button>
      <button class="yx-button yx-button--secondary" type="button" @click="goBack">返回学习首页</button>
    </view>
  </view>
</template>
