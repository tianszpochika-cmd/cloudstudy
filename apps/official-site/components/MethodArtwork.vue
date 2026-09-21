<script setup lang="ts">
import type { LearningMethod } from "~/utils/experience-content";
defineProps<{ course: LearningMethod }>();
const { t } = useSiteText();
</script>
<template>
  <div class="course-art" :class="course.tone" aria-hidden="true">
    <span class="art-type">{{ t(course.type) }}</span
    ><span class="art-circle" /><img
      v-if="course.art === 'coffee'"
      src="/illustrations/coffee.svg"
      width="340"
      height="170"
      alt=""
    /><span v-else-if="course.art === 'type'" class="art-typeface"
      >Aa<small>+</small></span
    ><span v-else-if="course.art === 'syntax'" class="art-typeface">{ a }</span
    ><span v-else class="art-icon-wrap"><SiteIcon :name="course.icon" /></span
    ><span class="art-small">{{ course.en }}</span>
  </div>
</template>
