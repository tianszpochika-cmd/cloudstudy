<script setup lang="ts">
import { computed } from 'vue'
import { backMobile, mobileT } from '../platform/experience'
import { openUniPage } from '../platform/uni-runtime'
const props = defineProps<{ page: string; kicker?: string; title?: string; description?: string }>()
const isTab = computed(() => ['home', 'learn', 'b2-practice', 'world', 'profile'].includes(props.page))
const isAuth = computed(() => ['login', 'register', 'reset-password'].includes(props.page))
</script>

<template>
  <view class="mobile-page-header">
    <view class="mobile-topbar">
      <view v-if="isTab || isAuth" class="mobile-wordmark"><view class="mobile-logo" aria-hidden="true">✦</view><text>{{ mobileT('brand') }}</text></view>
      <button tabindex="0" role="button" v-else class="mobile-back" :aria-label="mobileT('back')" @click="backMobile"><text aria-hidden="true">‹</text>{{ mobileT('back') }}</button>
      <text v-if="isAuth" class="mobile-topbar-note">{{ mobileT('authTag') }}</text>
      <button tabindex="0" role="button" v-else class="mobile-settings" :aria-label="mobileT('settings')" @click="openUniPage('/pages/settings/settings')"><text aria-hidden="true">☷</text></button>
    </view>
    <view class="mobile-intro" :class="{ 'mobile-intro--hero': page === 'home' || isAuth, 'mobile-intro--world': page === 'world' }">
      <view class="mobile-intro-copy">
        <text class="mobile-kicker">{{ kicker ?? mobileT(`pages.${page}.kicker`) }}</text>
        <text class="mobile-page-title" role="heading" aria-level="1">{{ title ?? mobileT(`pages.${page}.title`) }}</text>
        <text class="mobile-page-description">{{ description ?? mobileT(`pages.${page}.description`) }}</text>
      </view>
      <view v-if="page === 'home' || isAuth || page === 'world'" class="mobile-book-art" aria-hidden="true">
        <view class="mobile-art-orbit"></view><text class="mobile-art-spark">✦</text>
        <view class="mobile-art-book"><text>Aa</text><view></view><view></view></view>
        <view class="mobile-art-disc"></view>
      </view>
    </view>
  </view>
</template>
