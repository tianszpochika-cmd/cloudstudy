<script setup lang="ts">
import { learningMethods } from "~/utils/experience-content";
import { useOfficialSeo } from "~/utils/seo";
const { t } = useSiteText(),
  route = useRoute(),
  course = computed(() =>
    learningMethods.find((c) => c.id === route.params.id),
  );
if (!course.value)
  throw createError({
    statusCode: 404,
    statusMessage: "Learning content not found",
  });
useOfficialSeo({
  title: t(course.value!.title) + " · " + t("official.c78c3d2787"),
  description: t(course.value!.description),
  path: "/courses/" + course.value!.id,
});
</script>
<template>
  <div v-if="course">
    <section class="page-heading">
      <div class="container">
        <nav class="breadcrumb" :aria-label="t('official.cb458ea40b')">
          <NuxtLink to="/courses">{{ t("official.c36a0f1dc5") }}</NuxtLink
          ><SiteIcon name="right" /><span>{{ t(course.title) }}</span>
        </nav>
        <div class="course-hero-grid">
          <div>
            <span class="pill">{{ t(course.type) }}</span>
            <h1>{{ t(course.title) }}<br />{{ t(course.subtitle) }}</h1>
            <p>{{ t(course.description) }}</p>
            <div class="course-hero-actions">
              <SiteStartButton
                :label="t('official.cd28ebd1dd')"
                data-primary
              /><NuxtLink class="link-arrow" to="/method"
                >{{ t("official.ccc3aad4f2") }}<SiteIcon name="arrow"
              /></NuxtLink>
            </div>
          </div>
          <MethodArtwork :course="course" />
        </div>
      </div>
    </section>
    <section class="page-body">
      <div class="container detail-layout">
        <div class="detail-main">
          <h2>{{ t("official.cd529d921d") }}</h2>
          <div class="learning-points">
            <div
              v-for="[title, text] in course.points"
              :key="title"
              class="learning-point"
            >
              <SiteIcon name="check" />
              <h3>{{ t(title) }}</h3>
              <p>{{ t(text) }}</p>
            </div>
          </div>
          <h2>{{ t("official.c0d2ad5cd6") }}</h2>
          <div class="lesson-list">
            <details
              v-for="([title, text], i) in course.lessons"
              :key="title"
              :open="i === 0"
            >
              <summary>
                <span>0{{ i + 1 }}</span
                >{{ t(title) }}<SiteIcon name="right" />
              </summary>
              <div class="lesson-detail">
                <p>{{ t(text) }}</p>
                <NuxtLink to="/method" class="link-arrow"
                  >{{ t("official.c2efea64f5") }}<SiteIcon name="arrow"
                /></NuxtLink>
              </div>
            </details>
          </div>
          <p class="catalog-note">{{ t("official.cedf796f35") }}</p>
        </div>
        <aside class="detail-aside">
          <span class="eyebrow">{{ t("official.cf4d016977") }}</span>
          <h3>{{ t("official.c8158df616") }}</h3>
          <p>
            {{ t("official.c7be801719") }}<br />{{ t("official.c456007104") }}
          </p>
          <ul>
            <li><SiteIcon name="globe" />{{ t("official.cbd5585110") }}</li>
            <li><SiteIcon name="user" />{{ t("official.c80d27561e") }}</li>
            <li><SiteIcon name="repeat" />{{ t("official.ccf685c377") }}</li>
          </ul>
          <SiteStartButton :label="t('official.c896a13eca')" />
        </aside>
      </div>
    </section>
  </div>
</template>
