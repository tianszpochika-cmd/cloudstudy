<script setup lang="ts">
import type { LearningMethod } from "~/utils/experience-content";
defineProps<{ course: LearningMethod; compact?: boolean }>();
const { t } = useSiteText();
</script>
<template>
  <NuxtLink
    :to="'/courses/' + course.id"
    :class="compact ? 'topic-card' : 'course-card'"
    ><template v-if="compact"
      ><span class="icon-tile" :class="course.tone"
        ><SiteIcon :name="course.icon"
      /></span>
      <h3>{{ t(course.title) }}</h3>
      <p>{{ t(course.short) }}</p>
      <span class="card-link"
        >{{ t("official.cbe1356abf")
        }}<SiteIcon name="arrow" /></span></template
    ><template v-else
      ><MethodArtwork :course="course" />
      <div class="course-content">
        <h2>{{ t(course.title) }}</h2>
        <p>{{ t(course.short) }}</p>
        <div class="course-tags">
          <span v-for="tag in course.tags" :key="tag">{{ t(tag) }}</span>
        </div>
        <div class="course-bottom">
          <span>{{ t("official.c8b980a2ff") }}</span
          ><SiteIcon name="arrow" />
        </div></div></template
  ></NuxtLink>
</template>
