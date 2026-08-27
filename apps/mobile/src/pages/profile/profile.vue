<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { ensureMobilePageAccess } from '../../auth/navigation'
import { useLearnerContentStore } from '../../stores/learner-content'
import { useSessionStore } from '../../stores/session'
import { authT } from '../../auth/i18n'

const session = useSessionStore()
const store = useLearnerContentStore()
const nickname = ref('')
const accent = ref<'US' | 'UK'>('US')
const saving = ref(false)
const saved = ref(false)
const goalLabel = computed(() => store.goals.find((item) => item.value === store.account.goal)?.label ?? store.account.goal ?? '尚未设置')

onShow(async () => {
  if (!await ensureMobilePageAccess('/pages/profile/profile')) return
  await store.loadAccount()
  nickname.value = store.account.nickname
  accent.value = store.account.accentPref
})

async function save(): Promise<void> {
  saving.value = true
  saved.value = false
  await store.saveProfile({ nickname: nickname.value.trim() || '学习者', accentPref: accent.value })
  saved.value = store.accountStatus === 'ready' && !store.lastError
  saving.value = false
}
</script>

<template>
  <view class="yx-page">
    <text class="yx-eyebrow">PROFILE</text>
    <text class="yx-title">我的</text>
    <navigator class="yx-card b6-profile-entry" url="/pages/b6-platform/b6-platform"><text>端与性能验收</text><text class="b6-profile-entry__hint">跨端矩阵、画质降级和无障碍基线</text></navigator>
    <view class="yx-card profile-card">
      <text class="card-title">学习资料</text>
      <label class="field"><text>昵称</text><input v-model="nickname" aria-label="昵称" /></label>
      <label class="field"><text>发音偏好</text><picker :range="['US', 'UK']" :value="accent === 'US' ? 0 : 1" @change="accent = $event.detail.value === 1 ? 'UK' : 'US'"><view class="picker-value">{{ accent === 'US' ? '美式英语' : '英式英语' }}</view></picker></label>
      <button class="yx-button" :loading="saving" :disabled="saving" @click="save">{{ saving ? '保存中…' : '保存资料' }}</button>
      <text v-if="saved" class="success" role="status">资料已保存到服务端。</text>
    </view>
    <view class="yx-card profile-facts">
      <text class="card-title">服务端学习档案</text>
      <text>学习目标：{{ goalLabel }}</text>
      <text>每日目标：{{ store.account.quota ?? '—' }} 分钟</text>
      <text>成人 Gate：{{ store.account.ageConfirmed ? '已确认' : '待确认' }}</text>
      <text>UI：{{ store.account.uiLocale }} · 内容：{{ store.account.contentLocale }}</text>
    </view>
    <text v-if="store.lastError" class="error" role="alert">{{ store.lastError }}</text>
    <button v-if="session.isAuthenticated" class="yx-button" type="button" @click="session.logout">{{ authT('session.logout') }}</button>
  </view>
</template>

<style scoped>
.b6-profile-entry{display:flex;flex-direction:column;gap:8rpx;color:#202332;font-size:30rpx;font-weight:600}.b6-profile-entry__hint{color:#666d80;font-size:24rpx;font-weight:400}.profile-card,.profile-facts{display:grid;gap:18rpx}.card-title{font-size:30rpx;font-weight:700}.field{display:grid;gap:8rpx;color:#666d80;font-size:24rpx}.field input,.picker-value{box-sizing:border-box;min-height:76rpx;padding:20rpx;border:1rpx solid #e6e8f0;border-radius:12rpx;color:#202332;background:#fff}.profile-facts text:not(.card-title){color:#666d80;font-size:24rpx}.success{color:#25855a;font-size:24rpx}.error{display:block;color:#b54747;font-size:24rpx}
</style>
