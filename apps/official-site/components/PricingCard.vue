<script setup lang="ts">
import { computed } from 'vue'
import type { PublicPricingProjection } from '~/utils/public-projection'

const props = defineProps<{
  plan: PublicPricingProjection
  actionHref?: string
}>()

const availabilityLabel = computed(() => ({
  available: '已发布',
  'coming-soon': '暂未发布',
  unavailable: '暂不可用',
  maintenance: '维护中',
  restricted: '地区受限',
}[props.plan.availability]))

const canContinue = computed(() => props.plan.availability === 'available' && props.plan.eligibility !== 'restricted' && Boolean(props.actionHref))
</script>

<template>
  <article class="pricing-card" :class="{ 'is-featured': plan.featured, 'is-disabled': !canContinue }" :data-availability="plan.availability" :data-eligibility="plan.eligibility">
    <span v-if="plan.featured" class="pricing-badge">推荐起点</span>
    <div class="pricing-head">
      <span class="eyebrow">{{ plan.name }}</span>
      <span v-if="plan.availability !== 'available'" class="availability-badge">{{ availabilityLabel }}</span>
    </div>
    <p v-if="plan.skuId" class="sku-code">SKU {{ plan.skuId }}</p>
    <p class="pricing-description">{{ plan.description }}</p>
    <div class="pricing-price">
      <strong>{{ plan.price }}</strong>
      <span>{{ plan.unit }}</span>
    </div>
    <ul class="feature-list">
      <li v-for="feature in plan.features" :key="feature">
        <span aria-hidden="true">✓</span>{{ feature }}
      </li>
    </ul>
    <p class="eligibility-hint" :data-eligibility="plan.eligibility">
      <span aria-hidden="true">ⓘ</span>{{ plan.eligibilityMessage || (plan.eligibility === 'restricted' ? '当前地区或资格暂不可用' : plan.eligibility === 'unknown' ? '登录后确认地区与资格' : '公开资格已满足') }}
    </p>
    <a
      v-if="canContinue"
      class="button button-primary button-block"
      :href="actionHref"
    >
      登录后查看并开始
    </a>
    <span v-else class="button button-muted button-block" aria-disabled="true">{{ plan.availability === 'maintenance' ? '维护中' : plan.eligibility === 'restricted' ? '当前地区不可用' : '暂未开放' }}</span>
  </article>
</template>
