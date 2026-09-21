<script setup lang="ts">
import { learningMethods, frequentlyAsked } from "~/utils/experience-content";
import { useOfficialSeo } from "~/utils/seo";
const { t } = useSiteText(),
  sampleOpen = ref(false);
useOfficialSeo({
  title: t("official.cb2ffbd59f"),
  description: t("official.cea0be3689"),
  path: "/",
});
</script>
<template>
  <div>
    <section class="hero">
      <div class="container">
        <div class="hero-grid">
          <div class="hero-copy">
            <span class="opening-badge"
              ><i></i>{{ t("official.c0767ba7e6") }}</span
            >
            <h1>
              {{ t("official.c2e979a4ec") }}<br />{{ t("official.c0d2e65603")
              }}<em>{{ t("official.c4447ba091") }}</em>
            </h1>
            <p>
              {{ t("official.c06e480a6f") }}<br />{{ t("official.c194e2f85f") }}
            </p>
            <div class="hero-buttons">
              <SiteStartButton
                :label="t('official.c03e46770e')"
                data-primary
              /><NuxtLink class="link-arrow" to="/method"
                >{{ t("official.c780cfd719") }}<SiteIcon name="arrow"
              /></NuxtLink>
            </div>
            <div class="hero-note">
              <SiteIcon name="check" />{{ t("official.ca07074912") }}
            </div>
          </div>
          <div class="hero-art">
            <div class="hero-orbit"></div>
            <div class="hero-orbit second"></div>
            <span class="orbit-star"><SiteIcon name="star" /></span
            ><img
              class="hero-coffee"
              src="/illustrations/coffee.svg"
              :alt="t('official.c549a4509e')"
              width="340"
              height="170"
            />
            <div class="hero-plan">
              <div class="plan-top">
                <div>
                  <span>{{ t("official.c7044fa394") }}</span
                  ><SiteIcon name="star" />
                </div>
                <strong
                  >{{ t("official.cf1fb5ba70") }}<br />{{
                    t("official.cdce5f1fe0")
                  }}</strong
                ><small>{{ t("official.cfeb6541b7") }}</small>
              </div>
              <div class="plan-content">
                <div class="plan-row">
                  <span class="icon-tile"><SiteIcon name="repeat" /></span
                  ><span
                    ><strong>{{ t("official.cc00d6e830") }}</strong
                    ><small>{{ t("official.c18b7af2ce") }}</small></span
                  ><SiteIcon name="right" />
                </div>
                <div class="plan-row">
                  <span class="icon-tile"><SiteIcon name="headphones" /></span
                  ><span
                    ><strong>{{ t("official.c43bfad300") }}</strong
                    ><small>{{ t("official.c01f519a46") }}</small></span
                  ><SiteIcon name="right" />
                </div>
                <div class="plan-row">
                  <span class="icon-tile"><SiteIcon name="check" /></span
                  ><span
                    ><strong>{{ t("official.cca6c45ba5") }}</strong
                    ><small>{{ t("official.cd85170f72") }}</small></span
                  ><SiteIcon name="right" />
                </div>
              </div>
            </div>
            <div class="hero-word">
              <span><SiteIcon name="cup" />{{ t("official.c6a2493db0") }}</span
              ><strong>latte</strong
              ><small>{{ t("official.cbe3ae9e0b") }}</small
              ><button @click="sampleOpen = true">
                {{ t("official.cc88675823") }}<SiteIcon name="arrow" />
              </button>
            </div>
            <span class="art-caption"
              >A little practice, a little progress.</span
            >
          </div>
        </div>
        <div class="hero-proof">
          <div>
            <SiteIcon name="book" />
            <div>
              <strong>{{ t("official.c55a5698a4") }}</strong
              ><small>{{ t("official.c8de2c588a") }}</small>
            </div>
          </div>
          <div>
            <SiteIcon name="repeat" />
            <div>
              <strong>{{ t("official.c10864794a") }}</strong
              ><small>{{ t("official.c2e8729ebf") }}</small>
            </div>
          </div>
          <div>
            <SiteIcon name="phone" />
            <div>
              <strong>{{ t("official.c8695de4d2") }}</strong
              ><small>{{ t("official.c966f64dc5") }}</small>
            </div>
          </div>
        </div>
      </div>
    </section>
    <WorldSection />
    <section class="section section-line">
      <div class="container">
        <div class="section-title">
          <div>
            <span class="eyebrow">{{ t("official.ca7ad796ee") }}</span>
            <h2>{{ t("official.cbd64749cf") }}</h2>
          </div>
          <NuxtLink class="link-arrow" to="/courses"
            >{{ t("official.cd3e324ece") }}<SiteIcon name="arrow"
          /></NuxtLink>
        </div>
        <div class="topic-grid">
          <LearningMethodCard
            :course="learningMethods[0]"
            compact
          /><LearningMethodCard
            :course="learningMethods[2]"
            compact
          /><LearningMethodCard
            :course="learningMethods[3]"
            compact
          /><LearningMethodCard :course="learningMethods[1]" compact />
        </div>
      </div>
    </section>
    <section class="section try-section">
      <div class="container try-grid">
        <div class="try-copy">
          <span class="eyebrow">{{ t("official.c533ef5f2d") }}</span>
          <h2>
            {{ t("official.cfdc57cf16") }}<br />{{ t("official.c22bab5f1c") }}
          </h2>
          <p>
            {{ t("official.cb7c25e9b8") }}<br />{{ t("official.cafa66ea10") }}
          </p>
        </div>
        <PracticeSample />
      </div>
    </section>
    <section class="section-compact">
      <div class="container"><FreeBanner /></div>
    </section>
    <section class="section">
      <div class="container faq-grid">
        <div class="faq-intro">
          <div>
            <h2>{{ t("official.c1366dd887") }}</h2>
            <p>{{ t("official.cb6bce53e4") }}</p>
          </div>
          <NuxtLink class="link-arrow" to="/help"
            >{{ t("official.ce369b9eda") }}<SiteIcon name="arrow"
          /></NuxtLink>
        </div>
        <SiteFaq :items="frequentlyAsked.slice(0, 4)" />
      </div>
    </section>
    <SiteModal
      :open="sampleOpen"
      :title="t('official.c1a56cca0c')"
      @close="sampleOpen = false"
      ><PracticeSample
    /></SiteModal>
  </div>
</template>
