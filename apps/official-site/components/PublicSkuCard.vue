<script setup lang="ts">
import { computed } from 'vue'
import type { PublicSkuProjection } from '~/utils/public-projection'

const props = defineProps<{
  sku: PublicSkuProjection
  actionHref?: string
}>()

const availabilityLabel = computed(() => ({
  available: '已发布',
  'coming-soon': '暂未发布',
  unavailable: '暂不可用',
  maintenance: '维护中',
  restricted: '地区受限',
}[props.sku.availability]))

const eligibilityLabel = computed(() => ({
  eligible: '当前地区可查看',
  restricted: '当前地区或资格受限',
  unknown: '登录后确认资格',
}[props.sku.eligibility]))

const canContinue = computed(() => props.sku.availability === 'available' && props.sku.eligibility !== 'restricted' && Boolean(props.actionHref))
</script>

<template>
  <article class="sku-card" :data-availability="sku.availability" :data-eligibility="sku.eligibility">
    <div class="sku-card-top">
      <div>
        <span class="eyebrow">SKU projection</span>
        <h3>{{ sku.name }}</h3>
      </div>
      <span class="projection-status" :class="`projection-status-${sku.availability}`">{{ availabilityLabel }}</span>
    </div>
    <p class="sku-code">SKU {{ sku.skuId || sku.id }}</p>
    <div class="sku-price"><strong>{{ sku.price }}</strong><span>{{ sku.unit || sku.billingPeriod || sku.currency }}</span></div>
    <p v-if="sku.description" class="sku-description">{{ sku.description }}</p>
    <ul v-if="sku.entitlements.length" class="entitlement-list" aria-label="公开权益说明">
      <li v-for="entitlement in sku.entitlements" :key="entitlement.id" :data-entitlement-status="entitlement.status">
        <span aria-hidden="true">{{ entitlement.status === 'included' ? '✓' : entitlement.status === 'limited' ? '·' : '—' }}</span>
        <span><strong>{{ entitlement.name }}</strong><small v-if="entitlement.description">{{ entitlement.description }}</small></span>
      </li>
    </ul>
    <p v-else class="sku-empty">权益明细将在正式发布后补充。</p>
    <p class="eligibility-hint" :data-eligibility="sku.eligibility">
      <span aria-hidden="true">ⓘ</span>{{ sku.eligibilityMessage || eligibilityLabel }}
    </p>
    <a v-if="canContinue" class="button button-secondary button-block" :href="actionHref">登录后查看并确认</a>
    <span v-else class="button button-muted button-block" aria-disabled="true">{{ sku.availability === 'maintenance' ? '维护中' : sku.eligibility === 'restricted' ? '当前不可用' : '暂未开放' }}</span>
  </article>
</template>
