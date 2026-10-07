<script setup lang="ts">
import { learningMethods } from "~/utils/experience-content";
import { useOfficialSeo } from "~/utils/seo";
const { t } = useSiteText(),
  route = useRoute(),
  router = useRouter();
const group = computed(() => String(route.query.group || "all")),
  query = computed(() => String(route.query.q || ""));
const filtered = computed(() =>
  learningMethods.filter(
    (c) =>
      (group.value === "all" || group.value === c.group) &&
      [t(c.title), t(c.short), ...c.tags.map((tg) => t(tg))]
        .join(" ")
        .toLowerCase()
        .includes(query.value.trim().toLowerCase()),
  ),
);
function filter(groupValue: string, searchValue = query.value) {
  void router.replace({
    query: {
      ...route.query,
      group: groupValue === "all" ? undefined : groupValue,
      q: searchValue || undefined,
    },
  });
}
const { loadState, load } = usePublicProjection("courses");
const { registerLink } = useOfficialSiteLinks();
const coursesEmpty = computed(
  () => loadState.value.state === "empty" ||
    (loadState.value.state === "ready" && !loadState.value.projection.courses.length),
);
useOfficialSeo({
  title: t("official.c66fb6e8c0"),
  description: t("official.c0978c4332"),
  path: "/courses",
});
</script>
<template>
  <div>
    <PageHeading
      :title="t('official.c2ce2364ca')"
      :lead="t('official.c297e08cd6')"
      :label="t('official.c36a0f1dc5')"
    />
    <section class="page-body">
      <div class="container">
        <div class="catalog-toolbar">
          <div
            class="filters"
            role="group"
            :aria-label="t('official.c1e76eaf3e')"
          >
            <button
              v-for="[value, label] in [
                ['all', 'official.c778fc8f99'],
                ['words', 'official.c51abd5661'],
                ['understand', 'official.c211e55ac9'],
                ['express', 'official.c9c7bdaf00'],
              ]"
              :key="value"
              :aria-pressed="group === value"
              @click="filter(value!)"
            >
              {{ t(label!) }}
            </button>
          </div>
          <label class="search-field"
            ><SiteIcon name="search" /><input
              type="search"
              :value="query"
              :placeholder="t('official.c0636e53fd')"
              :aria-label="t('official.ca7df47a9e')"
              @input="
                filter(group, ($event.target as HTMLInputElement).value)
              " /><button
              :aria-label="t('official.c2a73ffdf9')"
              @click="filter(group, '')"
            >
              <SiteIcon name="close" /></button
          ></label>
        </div>
        <p class="catalog-count" aria-live="polite">
          {{ filtered.length }}{{ t("official.c818470248") }}
        </p>
        <div class="catalog-grid">
          <LearningMethodCard
            v-for="course in filtered"
            :key="course.id"
            :course="course"
          />
          <div v-if="!filtered.length" class="empty-state">
            <SiteIcon name="search" />
            <h2>{{ t("official.c7bdb79725") }}</h2>
            <p>{{ t("official.c515c474f9") }}</p>
            <button class="btn btn-outline" @click="filter('all', '')">
              {{ t("official.cb6d26530e") }}
            </button>
          </div>
        </div>
        <section class="published-courses" aria-labelledby="published-courses-title">
          <div class="published-courses-header">
            <div>
              <h2 id="published-courses-title">{{ t("official.c52c0deec0") }}</h2>
              <p class="catalog-note">{{ t("official.cab2cf9e17") }}</p>
            </div>
            <NuxtLink class="link-arrow" :to="registerLink()" external data-register-entry
              >{{ t("official.caa236cbb2") }}<SiteIcon name="arrow"
            /></NuxtLink>
          </div>
          <div
            v-if="
              ['ready', 'recovery'].includes(loadState.state) &&
              loadState.projection.courses.length
            "
            class="published-grid"
          >
            <article
              v-for="course in loadState.projection.courses"
              :key="course.id"
              class="public-course-card"
            >
              <span v-if="course.level" class="pill">{{ course.level }}</span>
              <h3>{{ course.title }}</h3>
              <p v-if="course.description">{{ course.description }}</p>
              <NuxtLink class="link-arrow" :to="registerLink()" external data-register-entry
                >{{ t("official.caa236cbb2") }}<SiteIcon name="arrow"
              /></NuxtLink>
            </article>
          </div>
          <PublicStatus
            v-if="loadState.state !== 'ready' || !loadState.projection.courses.length"
            :state="loadState.state === 'ready' ? 'empty' : loadState.state"
            :title="coursesEmpty ? t('official.r1CoursesPreparing') : undefined"
            :message="coursesEmpty ? t('official.r1CoursesPreparingNote') : undefined"
            :action-label="coursesEmpty ? t('official.c03e46770e') : undefined"
            :action-href="coursesEmpty ? registerLink() : undefined"
            @retry="load"
          />
        </section>
      </div>
    </section>
  </div>
</template>
