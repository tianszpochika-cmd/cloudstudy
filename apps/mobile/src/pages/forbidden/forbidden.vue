<script setup lang="ts">
import { computed } from 'vue'
import MobilePageHeader from '../../components/MobilePageHeader.vue'
import { useMobileExperience } from '../../platform/experience'
const { experienceStyle, experienceMotion } = useMobileExperience()

import { onLoad } from '@dcloudio/uni-app'
import { authT } from '../../auth/i18n'
import { useSessionStore } from '../../stores/session'
import { openUniPage } from '../../platform/uni-runtime'

const session = useSessionStore()
const isRejected = computed(() => session.adultGate === 'REJECTED')
const explanation = computed(() => {
  if (isRejected.value) {
    return '当前版本仅面向 18 岁以上成人开放，暂不能向你开放学习功能。'
  }
  return '如果你认为这是误判，请联系帮助中心。'
})

onLoad((options) => { if (options?.returnTo) session.setReturnTo(options.returnTo) })

async function logout(): Promise<void> {
  await session.logout()
  openUniPage('/pages/login/login')
}
function goToProfile(): void { openUniPage('/pages/profile/profile') }
function goToSupport(): void { openUniPage('/pages/support/support') }
</script>

<template>
  <view class="yx-page" :style="experienceStyle" :data-motion="experienceMotion">
    <MobilePageHeader page="forbidden" />
    <text class="yx-description" role="alert">{{ explanation }}</text>
    <view class="yx-actions" style="display: grid; gap: 12rpx; margin-top: 30rpx;">
      <button v-if="isRejected" tabindex="0" role="button" class="yx-button yx-button--secondary" type="button" @click="goToProfile">个人中心与设置</button>
      <button v-if="isRejected" tabindex="0" role="button" class="yx-button yx-button--secondary" type="button" @click="goToSupport">帮助与反馈</button>
      <button tabindex="0" role="button" class="yx-button" type="button" @click="logout">{{ authT('forbidden.login') }}</button>
    </view>
  </view>
</template>
