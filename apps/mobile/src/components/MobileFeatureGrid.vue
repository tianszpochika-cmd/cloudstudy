<script setup lang="ts">
import { mobileT } from '../platform/experience'
import { openUniPage } from '../platform/uni-runtime'
withDefaults(defineProps<{ compact?: boolean }>(), { compact: false })
const features = [
  { page: 'b2-vocabulary', icon: 'Aa', tone: 'purple' }, { page: 'b11-listening', icon: '◖◗', tone: 'sage' },
  { page: 'b11-reading', icon: '▤', tone: 'apricot' }, { page: 'b11-speaking', icon: '♫', tone: 'purple' },
  { page: 'b3-grammar', icon: '⌘', tone: 'sage' }, { page: 'b3-writing', icon: '✎', tone: 'apricot' },
]
</script>
<template>
  <view class="mobile-feature-section">
    <view class="mobile-section-heading"><text>{{ mobileT('practiceHeading') }}</text><text class="mobile-section-note">{{ mobileT('practiceNote') }}</text></view>
    <view class="mobile-feature-grid" :class="{ 'mobile-feature-grid--compact': compact }">
      <button tabindex="0" role="button" v-for="feature in features" :key="feature.page" class="mobile-feature" @click="openUniPage(`/pages/${feature.page}/${feature.page}`)">
        <text class="mobile-feature-icon" :class="`mobile-feature-icon--${feature.tone}`" aria-hidden="true">{{ feature.icon }}</text>
        <text class="mobile-feature-title">{{ mobileT(`pages.${feature.page}.short`) }}</text>
        <text v-if="!compact" class="mobile-feature-description">{{ mobileT(`pages.${feature.page}.description`) }}</text>
      </button>
    </view>
    <button v-if="compact" tabindex="0" role="button" class="mobile-text-button" @click="openUniPage('/pages/practice/practice')">{{ mobileT('morePractice') }} →</button>
  </view>
</template>
