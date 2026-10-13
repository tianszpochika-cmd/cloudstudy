<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { getGatewayBaseUrl } from '../platform/gateway'

const route = useRoute()
const status = ref('LOADING')
const copy = ref('')
const range = ref('')
const suggestion = ref('')

onMounted(async () => {
  const refValue = String(route.params.ref ?? '')
  if (!/^[0-9a-f]{32}$/.test(refValue)) {
    status.value = 'NOT_FOUND'
    copy.value = '没有找到这份分享。'
    return
  }
  try {
    const response = await fetch(`${getGatewayBaseUrl()}/public/learning/report-shares/${refValue}`, { credentials: 'omit' })
    if (response.status === 404) {
      status.value = 'NOT_FOUND'
      copy.value = '没有找到这份分享。'
      return
    }
    const payload = await response.json() as Record<string, unknown>
    const body = payload && typeof payload.data === 'object' && payload.data !== null ? payload.data as Record<string, unknown> : payload
    status.value = typeof body.status === 'string' ? body.status : 'NOT_FOUND'
    if (status.value === 'REVOKED') copy.value = '这份分享已经撤销。'
    else if (status.value === 'EXPIRED') copy.value = '这份分享已经过期。'
    else if (status.value !== 'ACTIVE') copy.value = '没有找到这份分享。'
    else {
      copy.value = typeof body.copy === 'string' ? body.copy : ''
      range.value = `${String(body.periodStart ?? '')} 至 ${String(body.periodEndExclusive ?? '')}`
      suggestion.value = typeof body.suggestion === 'string' ? body.suggestion : ''
    }
  } catch {
    status.value = 'NOT_FOUND'
    copy.value = '没有找到这份分享。'
  }
})
</script>

<template>
  <main class="share v2-page v2-page--reportshare" :data-share-status="status">
    <h1 class="v2-reportshare-title">分享的学习报告</h1>
    <div class="v2-reportshare-body"><div class="v2-reportshare-main">
    <div class="v2-reportshare-card">
    <p data-period-copy class="v2-reportshare-copy">{{ copy }}</p>
    <p v-if="status === 'ACTIVE'" class="v2-reportshare-range">{{ range }}</p>
    <p v-if="suggestion" data-suggestion class="v2-reportshare-suggestion">建议：{{ suggestion }}</p>
    <p class="v2-reportshare-note">这是只读分享，不包含登录信息。</p>
    </div>
    </div><aside class="v2-reportshare-rail" aria-label="分享说明"><h2>分享说明</h2><ol><li>只读查看，不包含登录信息。</li><li>撤销或过期的分享会说明原因。</li><li>有效分享显示统计区间与建议。</li></ol></aside></div>
  </main>
</template>

<style scoped>
.share { display: grid; gap: 12px; max-width: 640px; margin: 32px auto; padding: 24px; }
h1 { margin: 0; font-size: 28px; }
p { margin: 0; line-height: 1.6; }
</style>
