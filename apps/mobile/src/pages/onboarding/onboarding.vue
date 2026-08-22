<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { getUniRuntime } from '../../platform/uni-runtime'
import { useLearnerContentStore } from '../../stores/learner-content'

const store = useLearnerContentStore()
const goal = ref(store.onboarding.goal)
const quota = ref(store.onboarding.quota ?? 15)
const consent = ref(false)
const canSave = computed(() => Boolean(goal.value && quota.value && consent.value && store.onboardingStatus !== 'loading'))

onShow(() => { store.restore(); goal.value = store.onboarding.goal; quota.value = store.onboarding.quota ?? 15; void store.loadOnboarding() })

async function save(): Promise<void> {
  if (!canSave.value || !goal.value) return
  await store.saveOnboarding(goal.value, quota.value)
  if (store.onboardingStatus === 'ready' || store.onboardingStatus === 'offline') getUniRuntime().navigateTo({ url: '/pages/assessment/assessment' })
}
</script>

<template>
  <view class="yx-page">
    <text class="yx-eyebrow">FIRST DAY · LEARNER SERVICE</text>
    <text class="yx-title">先定一个适合你的学习起点。</text>
    <text class="yx-description">目标、偏好和首日状态由 learner-service 保存；界面语言与学习内容语言保持独立。</text>
    <view class="yx-card">
      <text class="section-title">学习目标</text>
      <view class="choice-list"><button v-for="item in store.goals" :key="item.value" :class="['choice', { selected: goal === item.value }]" @click="goal = item.value"><text>{{ item.label }}</text><text class="choice-description">{{ item.description }}</text></button></view>
      <text class="section-title">每天投入</text>
      <view class="choice-list"><button v-for="item in [5, 15, 30, 45, 60]" :key="item" :class="['choice', { selected: quota === item }]" @click="quota = item">{{ item }} 分钟</button></view>
      <label class="consent"><checkbox :checked="consent" @click="consent = !consent" />我已确认年满 18 周岁并同意隐私说明</label>
      <view class="locale-note">UI：{{ store.onboarding.uiLocale }} · 内容：{{ store.onboarding.contentLocale }}</view>
      <button class="yx-button" :disabled="!canSave" @click="save">保存目标并开始测评</button>
      <text v-if="store.lastError" class="error" role="alert">{{ store.lastError }}；已保留本地草稿，可稍后重试。</text>
    </view>
  </view>
</template>

<style scoped>
.section-title { display: block; margin: 18rpx 0; font-weight: 700; }
.choice-list { display: flex; flex-wrap: wrap; gap: 16rpx; }
.choice { display: grid; gap: 6rpx; margin: 0; padding: 16rpx 20rpx; border: 1rpx solid #e6e8f0; border-radius: 14rpx; color: #202332; background: #fff; font-size: 26rpx; text-align: left; }
.choice-description { color: #666d80; font-size: 21rpx; }
.choice.selected { border-color: #596bff; color: #596bff; background: #eef0ff; }
.consent { display: flex; align-items: center; margin-top: 24rpx; color: #666d80; font-size: 24rpx; }
.locale-note { margin: 18rpx 0; color: #8a91a3; font-size: 22rpx; }
.error { display: block; margin-top: 18rpx; color: #b54747; font-size: 22rpx; }
</style>
