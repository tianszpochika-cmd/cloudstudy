<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import AppIcon from '../../components/AppIcon.vue'
import MobilePageHeader from '../../components/MobilePageHeader.vue'
import { useMobileExperience } from '../../platform/experience'
import { getGatewayBaseUrl } from '../../platform/gateway'
import { getUniRuntime } from '../../platform/uni-runtime'

const { experienceStyle, experienceMotion } = useMobileExperience()
const status = ref('LOADING')
const copy = ref('')
const suggestion = ref('')

onLoad((query) => {
  const refValue = String(query?.ref ?? '')
  if (!/^[0-9a-f]{32}$/.test(refValue)) {
    status.value = 'NOT_FOUND'
    copy.value = '没有找到这份分享。'
    return
  }
  getUniRuntime().request({
    url: `${getGatewayBaseUrl()}/public/learning/report-shares/${refValue}`,
    method: 'GET',
    success: (response) => {
      if (response.statusCode === 404) {
        status.value = 'NOT_FOUND'
        copy.value = '没有找到这份分享。'
        return
      }
      const payload = response.data
      const record = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {}
      const nested = record.data && typeof record.data === 'object' ? record.data as Record<string, unknown> : record
      status.value = typeof nested.status === 'string' ? nested.status : 'NOT_FOUND'
      if (status.value === 'REVOKED') copy.value = '这份分享已经撤销。'
      else if (status.value === 'EXPIRED') copy.value = '这份分享已经过期。'
      else if (status.value !== 'ACTIVE') copy.value = '没有找到这份分享。'
      else {
        copy.value = typeof nested.copy === 'string' ? nested.copy : ''
        suggestion.value = typeof nested.suggestion === 'string' ? nested.suggestion : ''
      }
    },
    fail: () => {
      status.value = 'NOT_FOUND'
      copy.value = '没有找到这份分享。'
    },
  })
})
</script>

<template>
  <view class="yx-page v2-share-page" :style="experienceStyle" :data-motion="experienceMotion" :data-share-status="status">
    <MobilePageHeader page="report-share" kicker="只读分享" title="分享的学习报告" description="这是只读分享，不包含登录信息。" />
    <view class="v2-share-body">
      <view class="yx-card share card v2-share-card">
        <view class="eyebrow v2-share-eyebrow"><AppIcon name="chart" :size="14" /><text>只读分享</text></view>
        <text class="h2 v2-share-title v2-share-h2">分享的学习报告</text>
        <view class="v2-share-list">
          <text class="d v2-share-d v2-share-row v2-share-copy" data-period-copy>{{ copy }}</text>
          <text class="d v2-share-d v2-share-row v2-share-suggestion" v-if="suggestion" data-suggestion>建议：{{ suggestion }}</text>
          <text class="d v2-share-d v2-share-row v2-share-note">这是只读分享，不包含登录信息。</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.share { display: grid; gap: 12px; }
</style>
