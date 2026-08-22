<script setup lang="ts">
import { computed, ref } from 'vue'
import { filterPublicCourses } from '~/utils/public-projection'
import { resolvePublicPageState, resolvePublicState } from '~/utils/public-state.mjs'
import { useOfficialSeo } from '~/utils/seo'

const route = useRoute()
const activeFilter = ref('all')
const { loadState, load } = usePublicProjection('courses')
const previewState = computed(() => resolvePublicState(route.query.state))
const pageState = computed(() => resolvePublicPageState(previewState.value, loadState.value.state, loadState.value.projection.courses.length > 0))
const visibleCourses = computed(() => pageState.value === 'ready' ? filterPublicCourses(loadState.value.projection.courses, activeFilter.value) : [])

useOfficialSeo({ title: '课程体系｜语学星 EnglishFlow', description: '浏览语学星公开课程，了解语言学习闭环如何工作。', path: '/courses', breadcrumbs: [{ name: '首页', path: '/' }, { name: '课程体系', path: '/courses' }] })
</script>

<template>
  <section class="page-hero"><div class="container"><div class="breadcrumb"><NuxtLink to="/">首页</NuxtLink><span aria-hidden="true">/</span><span>课程体系</span></div><span class="eyebrow">Course map</span><h1>先找到适合自己的那一条学习路径。</h1><p>课程字段来自 SSR-safe 公开投影；登录后的进度、复习队列和报告由学习服务负责。</p></div></section>
  <section class="page-content"><div class="container"><div class="filter-bar" aria-label="课程筛选"><button class="filter-button" :class="{ 'is-active': activeFilter === 'all' }" type="button" @click="activeFilter = 'all'">全部课程</button><button class="filter-button" :class="{ 'is-active': activeFilter === '入门' }" type="button" @click="activeFilter = '入门'">入门阶段</button><button class="filter-button" :class="{ 'is-active': activeFilter === '进阶' }" type="button" @click="activeFilter = '进阶'">进阶阶段</button></div><PublicStatus v-if="pageState !== 'ready'" :state="pageState" action-href="/courses" action-label="回到课程目录" @retry="load" /><div v-else-if="visibleCourses.length" class="course-grid"><CourseCard v-for="course in visibleCourses" :key="course.id" :course="course" /></div><PublicStatus v-else state="empty" action-href="/courses" action-label="清除筛选" /></div></section>
</template>
