<script setup lang="ts">
import { useOfficialSeo } from "~/utils/seo";
const { t } = useSiteText();
const { loadState, load } = usePublicProjection("pricing");
const plans = computed(() => [...new Map(
  [...loadState.value.projection.skus, ...loadState.value.projection.pricingPlans]
    .map((plan) => [plan.skuId || plan.id, plan]),
).values()]);
const catalogEmpty = computed(() =>
  ["ready", "empty"].includes(loadState.value.state) && !plans.value.length,
);
const showCatalog = computed(() =>
  ["ready", "recovery"].includes(loadState.value.state) && plans.value.length > 0,
);
useOfficialSeo({
  title: t("official.r1PricingTitle"),
  description: t("official.r1PricingNote"),
  path: "/pricing",
});
</script>
<template>
  <div>
    <PageHeading
      :title="t('official.r1PricingTitle')"
      :lead="t('official.r1PricingNote')"
      :label="t('official.r1PricingLabel')"
    />
    <section class="page-body">
      <div class="container">
        <div v-if="showCatalog" class="published-grid" data-public-catalog>
          <article v-for="item in plans" :key="item.id" class="public-course-card" :data-availability="item.availability">
            <h2>{{ item.name }}</h2>
            <p v-if="item.price" class="sku-price"><strong>{{ item.price }}</strong><span>{{ item.unit || item.currency }}</span></p>
            <p v-if="item.eligibilityMessage">{{ item.eligibilityMessage }}</p>
            <p v-if="item.description">{{ item.description }}</p>
            <ul v-if="item.entitlements.length">
              <li v-for="entitlement in item.entitlements" :key="entitlement.id">
                {{ entitlement.name }}<span v-if="entitlement.description"> · {{ entitlement.description }}</span>
              </li>
            </ul>
            <p>{{ t(`official.r1Availability_${item.availability}`) }}</p>
          </article>
        </div>
        <PublicStatus
          v-if="loadState.state !== 'ready' || catalogEmpty"
          :state="catalogEmpty ? 'empty' : loadState.state"
          :title="catalogEmpty ? t('official.r1PricingPreparing') : undefined"
          :message="catalogEmpty ? t('official.r1PricingEmptyNote') : undefined"
          :action-href="catalogEmpty ? '/announcements' : undefined"
          :action-label="t('official.c584d952d2')"
          @retry="load"
        />
        <p class="catalog-note">{{ t("official.r1PricingBoundary") }}</p>
        <SiteStartButton />
      </div>
    </section>
  </div>
</template>
