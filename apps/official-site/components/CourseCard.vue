<script setup lang="ts">
defineProps<{
  course: {
    id: string
    eyebrow: string
    title: string
    description: string
    level: string
    duration: string
    tags: string[]
  }
}>()
</script>

<template>
  <article class="course-card card-lift">
    <div class="course-card-top">
      <span class="eyebrow">{{ course.eyebrow }}</span>
      <span class="course-index" aria-hidden="true">{{ course.id.slice(0, 2).toUpperCase() }}</span>
    </div>
    <h2>{{ course.title }}</h2>
    <p>{{ course.description }}</p>
    <div class="course-meta">
      <span>{{ course.level }}</span>
      <span>{{ course.duration }}</span>
    </div>
    <div class="tag-list" aria-label="课程特点">
      <span v-for="tag in course.tags" :key="tag" class="tag">{{ tag }}</span>
    </div>
  </article>
</template>
