<script setup lang="ts">
import { computed } from 'vue'
import type { PublicCampaignProjection } from '~/utils/public-projection'

const props = defineProps<{ campaign: PublicCampaignProjection }>()
const { authLink, publicLink } = useOfficialSiteLinks()

const availabilityLabel = computed(() => ({
  available: '进行中',
  'coming-soon': '即将开放',
  unavailable: '已结束',
  maintenance: '维护中',
  restricted: '地区受限',
}[props.campaign.availability]))

const actionHref = computed(() => {
  if (props.campaign.availability !== 'available' || props.campaign.eligibility === 'restricted') return null
  const projectionHref = publicLink(props.campaign.href)
  if (projectionHref) return projectionHref
  if (props.campaign.target === 'download') return publicLink('/download')
  if (props.campaign.target === 'learner') {
    const params = new URLSearchParams({ source: 'official-campaign', campaignId: props.campaign.id, intent: 'review' })
    return authLink(`/pricing?${params.toString()}`)
  }
  return null
})
</script>

<template>
  <article class="campaign-card" :data-availability="campaign.availability" :data-eligibility="campaign.eligibility">
    <div class="campaign-card-top">
      <span class="eyebrow">Public activity</span>
      <span class="projection-status" :class="`projection-status-${campaign.availability}`">{{ availabilityLabel }}</span>
    </div>
    <h3>{{ campaign.title }}</h3>
    <p>{{ campaign.summary }}</p>
    <p v-if="campaign.startsAt || campaign.endsAt" class="campaign-window">
      <span aria-hidden="true">◷</span>{{ campaign.startsAt || '已开始' }}<span aria-hidden="true">—</span>{{ campaign.endsAt || '持续开放' }}
    </p>
    <p class="eligibility-hint" :data-eligibility="campaign.eligibility">
      <span aria-hidden="true">ⓘ</span>{{ campaign.eligibilityMessage || (campaign.eligibility === 'restricted' ? '当前地区或资格暂不可用' : campaign.eligibility === 'unknown' ? '资格将在目标服务中重新确认' : '公开资格已满足') }}
    </p>
    <a v-if="actionHref" class="button button-secondary button-small" :href="actionHref">{{ campaign.actionLabel }}</a>
    <span v-else class="button button-muted button-small" aria-disabled="true">{{ campaign.availability === 'maintenance' ? '维护中' : campaign.eligibility === 'restricted' ? '当前不可用' : campaign.actionLabel }}</span>
  </article>
</template>
