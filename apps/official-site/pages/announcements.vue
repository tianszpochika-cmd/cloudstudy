<script setup lang="ts">
import { computed } from 'vue'
import { usePublicProjection } from '~/composables/usePublicProjection'
import { resolvePublicPageState } from '~/utils/public-state.mjs'
import { useOfficialSeo } from '~/utils/seo'

const route = useRoute()
const { publicLink } = useOfficialSiteLinks()
const { loadState, load } = usePublicProjection('announcements')
const announcements = computed(() => loadState.value.projection.announcements)
const pageState = computed(() => resolvePublicPageState(route.query.state, loadState.value.state, announcements.value.length > 0))

useOfficialSeo({ title: '服务公告｜语学星 EnglishFlow', description: '查看语学星公开版本、服务状态和课程内容公告。', path: '/announcements', breadcrumbs: [{ name: '首页', path: '/' }, { name: '服务公告', path: '/announcements' }] })
</script>

<template>
  <section class="page-hero"><div class="container"><div class="breadcrumb"><NuxtLink to="/">首页</NuxtLink><span aria-hidden="true">/</span><span>服务公告</span></div><span class="eyebrow">Public announcements</span><h1>公开版本与服务状态。</h1><p>公告来自官网公开投影，不读取登录后的学习数据，也不在官网创建业务命令。</p></div></section>
  <section class="page-content"><div class="container"><PublicStatus v-if="pageState !== 'ready'" :state="pageState" action-href="/announcements" action-label="回到公告" @retry="load" /><div v-else-if="announcements.length" class="announcement-list"><a v-for="announcement in announcements" :key="announcement.id" class="announcement-item" :href="publicLink(announcement.href) || undefined"><strong>{{ announcement.title }}</strong><span>{{ announcement.summary }}</span><small>{{ announcement.publishedAt || '公开投影' }}</small></a></div><PublicStatus v-else state="empty" action-href="/announcements" action-label="查看公告状态" /></div></section>
</template>
