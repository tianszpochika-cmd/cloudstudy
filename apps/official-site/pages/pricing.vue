<script setup lang="ts">
import { computed } from 'vue'
import { usePublicProjection } from '~/composables/usePublicProjection'
import { resolvePublicPageState, resolvePublicState } from '~/utils/public-state.mjs'
import { useOfficialSeo } from '~/utils/seo'

const route = useRoute()
const { authLink } = useOfficialSiteLinks()
const { loadState, load } = usePublicProjection('pricing')
const previewState = computed(() => resolvePublicState(route.query.state))
const pageState = computed(() => {
  return resolvePublicPageState(previewState.value, loadState.value.state, loadState.value.projection.pricingPlans.length > 0 || loadState.value.projection.skus.length > 0)
})
const pricingPlans = computed(() => loadState.value.projection.pricingPlans)
const skus = computed(() => loadState.value.projection.skus)
const campaigns = computed(() => loadState.value.projection.campaigns)
function pricingLink(reference: { skuId: string | null; id: string }): string {
  const params = new URLSearchParams({ source: 'official-pricing', intent: 'review', skuId: reference.skuId || reference.id })
  return authLink(`/pricing?${params.toString()}`)
}

useOfficialSeo({
  title: '价格方案｜语学星 EnglishFlow',
  description: '了解语学星公开价格、学习权益和后续机构能力边界。公开页面不创建订单，不收集支付信息。',
  path: '/pricing',
  breadcrumbs: [{ name: '首页', path: '/' }, { name: '价格方案', path: '/pricing' }],
})

useHead(() => ({
  script: [
    {
      key: 'jsonld-pricing-public-offers',
      type: 'application/ld+json',
      children: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: '语学星公开价格方案',
        itemListElement: pricingPlans.value
          .filter((plan) => plan.availability === 'available' && plan.eligibility !== 'restricted')
          .map((plan, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            item: {
              '@type': 'Product',
              name: plan.name,
              description: plan.description,
              sku: plan.skuId || plan.id,
              ...(Number.parseFloat(plan.price.replace(/[^0-9.]/g, '')) >= 0
                ? { offers: { '@type': 'Offer', price: Number.parseFloat(plan.price.replace(/[^0-9.]/g, '')), priceCurrency: plan.currency || 'CNY', availability: 'https://schema.org/InStock' } }
                : {}),
            },
          })),
      }),
    },
  ],
}))
</script>

<template>
  <section class="page-hero">
    <div class="container">
      <div class="breadcrumb"><NuxtLink to="/">首页</NuxtLink><span aria-hidden="true">/</span><span>价格方案</span></div>
      <span class="eyebrow">Simple plans</span>
      <h1>先看清权益，再决定是否开始。</h1>
      <p>官网只展示公开价格和权益说明；登录、结算与订单事实会安全交给学习 Web 和商业服务。</p>
    </div>
  </section>

  <section class="page-content">
    <div class="container">
      <PublicStatus
        v-if="pageState !== 'ready'"
        :state="pageState"
        action-href="/pricing"
        action-label="回到价格方案"
        @retry="load"
      />
      <div v-else class="pricing-grid">
        <PricingCard v-for="plan in pricingPlans" :key="plan.id" :plan="plan" :action-href="pricingLink(plan)" />
      </div>
      <section v-if="pageState === 'ready' && skus.length" class="projection-section">
        <div class="section-heading section-heading-compact"><div><span class="eyebrow">Public SKU projection</span><h2>SKU 与权益明细</h2></div><p>仅用于公开说明，不创建订单或写入权益。</p></div>
        <div class="sku-grid"><PublicSkuCard v-for="sku in skus" :key="sku.id" :sku="sku" :action-href="pricingLink(sku)" /></div>
      </section>
      <section v-if="pageState === 'ready' && campaigns.length" class="projection-section">
        <div class="section-heading section-heading-compact"><div><span class="eyebrow">Public activities</span><h2>活动与资格提示</h2></div></div>
        <div class="campaign-grid"><PublicCampaignCard v-for="campaign in campaigns" :key="campaign.id" :campaign="campaign" /></div>
      </section>
      <div class="side-note" style="margin-top: 24px">
        <h2>价格的事实边界</h2>
        <p>价格、地区资格和权益以登录后服务端返回的版本化快照为准。官网不会通过隐藏接口创建订单，也不会把价格参数当作支付结果。</p>
      </div>
    </div>
  </section>
</template>
