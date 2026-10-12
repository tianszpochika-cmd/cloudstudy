<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import AppIcon from '../../components/AppIcon.vue'
import MobilePageHeader from '../../components/MobilePageHeader.vue'
import { useMobileExperience } from '../../platform/experience'
import { getGatewayBaseUrl } from '../../platform/gateway'
import { getUniRuntime } from '../../platform/uni-runtime'
import { b10ThemeMode } from '../../platform/b10-foundation'

const { experienceStyle, experienceMotion } = useMobileExperience()
const themeClass = computed(() => `b10-theme--${b10ThemeMode.value}`)
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
  <view class="yx-page v2-share-page" :style="experienceStyle" :data-motion="experienceMotion" :data-share-status="status" :class="themeClass">
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
/* v2 分享报告页换皮：对齐 practice.vue v2-practice-* 与 today.vue v2-today-* 卡片/eyebrow/标题/列表行同样数值，对齐 webDemo/mobile/styles.css、refine.css，仅用 var(--v2-*)。 */
.v2-share-page{box-sizing:border-box;min-width:0;max-width:100%;overflow-x:hidden;font-family:var(--v2-font);overflow-wrap:anywhere}
.v2-share-body{display:flex;flex-direction:column;gap:var(--v2-space-4);box-sizing:border-box;min-width:0;max-width:100%;font-family:var(--v2-font);overflow-wrap:anywhere}
.v2-share-body>*{min-width:0;max-width:100%}
.v2-share-card{display:grid;gap:var(--v2-space-2);box-sizing:border-box;min-width:0;max-width:100%;padding:var(--v2-space-5);border:1px solid var(--v2-line);border-radius:var(--v2-radius-lg);background:var(--v2-card);box-shadow:var(--v2-shadow);font-family:var(--v2-font);overflow-wrap:anywhere}
.v2-share-card:hover{border-color:var(--v2-brand)}
.v2-share-eyebrow{display:flex;align-items:center;flex-wrap:wrap;gap:var(--v2-space-2);box-sizing:border-box;min-width:0;max-width:100%;margin:0 0 var(--v2-space-2);color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-xs);font-weight:700;letter-spacing:.06em;text-transform:uppercase;overflow-wrap:anywhere}
.v2-share-eyebrow>*{min-width:0;max-width:100%}
.v2-share-title,.v2-share-h2{display:block;box-sizing:border-box;min-width:0;max-width:100%;margin:var(--v2-space-1) 0 0;color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-lg);font-weight:700;line-height:1.45;overflow-wrap:anywhere}
.v2-share-list{display:grid;gap:var(--v2-space-2);box-sizing:border-box;min-width:0;max-width:100%;font-family:var(--v2-font);overflow-wrap:anywhere}
.v2-share-list>*{min-width:0;max-width:100%}
.v2-share-d{display:block;box-sizing:border-box;min-width:0;max-width:100%;color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.7;overflow-wrap:anywhere}
.v2-share-row{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:var(--v2-space-2);box-sizing:border-box;min-width:0;max-width:100%;padding:var(--v2-space-4);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);background:var(--v2-card);font-family:var(--v2-font);overflow-wrap:anywhere}
.v2-share-row:hover{border-color:var(--v2-brand)}
.v2-share-row>*{min-width:0;max-width:100%}
.v2-share-copy,.v2-share-suggestion,.v2-share-note{box-sizing:border-box;min-width:0;max-width:100%;flex:1 1 auto;color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.7;overflow-wrap:anywhere}
</style>
