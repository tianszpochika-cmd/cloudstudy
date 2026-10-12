<script setup lang="ts">
import { computed } from 'vue'
import AppIcon from '../../components/AppIcon.vue'
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
  <view class="yx-page v2-forbid-page" :style="experienceStyle" :data-motion="experienceMotion">
    <MobilePageHeader page="forbidden" />
    <view class="v2-forbid-body">
      <view class="yx-card card v2-forbid-card">
        <view class="v2-forbid-head">
          <view class="v2-forbid-titles">
            <text class="yx-eyebrow eyebrow v2-forbid-eyebrow"><AppIcon name="lock" :size="14" /><text>访问受限</text></text>
            <text class="h2 v2-forbid-title v2-forbid-h2">暂不能开放学习</text>
          </view>
        </view>
        <text class="yx-description d v2-forbid-d" role="alert">{{ explanation }}</text>
        <view class="yx-actions v2-forbid-list" style="display: grid; gap: 12rpx; margin-top: 30rpx;">
          <button v-if="isRejected" tabindex="0" role="button" class="yx-button yx-button--secondary btn opt list-row row v2-forbid-btn v2-forbid-opt v2-forbid-row" type="button" @click="goToProfile"><AppIcon name="me" :size="14" />个人中心与设置</button>
          <button v-if="isRejected" tabindex="0" role="button" class="yx-button yx-button--secondary btn opt list-row row v2-forbid-btn v2-forbid-opt v2-forbid-row" type="button" @click="goToSupport"><AppIcon name="help" :size="14" />帮助与反馈</button>
          <button tabindex="0" role="button" class="yx-button btn opt v2-forbid-btn v2-forbid-opt v2-forbid-submit" type="button" @click="logout">{{ authT('forbidden.login') }}<AppIcon name="back" :size="14" /></button>
        </view>
      </view>
    </view>
  </view>
</template>
