<script setup lang="ts">
import { computed } from 'vue'
import { usePublicProjection } from '~/composables/usePublicProjection'
import { resolvePublicPageState, resolvePublicState } from '~/utils/public-state.mjs'
import { useOfficialSeo } from '~/utils/seo'

const route = useRoute()
const { learnerLink, publicLink } = useOfficialSiteLinks()
const config = useRuntimeConfig()
const { loadState, load } = usePublicProjection('download')
const previewState = computed(() => resolvePublicState(route.query.state))
const downloadEnabled = computed(() => config.public.downloadEnabled !== false)
const pageState = computed(() => {
  if (previewState.value !== 'ready') return previewState.value
  if (!downloadEnabled.value) return 'download-disabled'
  return resolvePublicPageState('ready', loadState.value.state, loadState.value.projection.downloadChannels.length > 0 || loadState.value.projection.campaigns.length > 0)
})
const downloadChannels = computed(() => loadState.value.projection.downloadChannels)
const campaigns = computed(() => loadState.value.projection.campaigns)

function channelHref(channel: { id: string; href: string | null }): string | null {
  if (channel.href) return publicLink(channel.href)
  if (channel.id === 'learner-web') return learnerLink('/', { source: 'official-download' })
  return null
}

useOfficialSeo({
  title: '下载与体验｜语学星 EnglishFlow',
  description: '通过学习 Web 立即体验语学星；iOS、Android 与微信小程序入口按发布准备状态逐步开放。',
  path: '/download',
  breadcrumbs: [{ name: '首页', path: '/' }, { name: '下载体验', path: '/download' }],
})
</script>

<template>
  <section class="page-hero">
    <div class="container">
      <div class="breadcrumb"><NuxtLink to="/">首页</NuxtLink><span aria-hidden="true">/</span><span>下载体验</span></div>
      <span class="eyebrow">Start anywhere</span>
      <h1>从浏览器开始，等准备好再安装。</h1>
      <p>Windows 优先使用学习 Web/PWA；移动 App 与小程序遵循各自发布和条件编译边界。</p>
    </div>
  </section>

  <section class="page-content">
    <div class="container">
      <PublicStatus
        v-if="pageState !== 'ready'"
        :state="pageState"
        :action-href="pageState === 'download-disabled' ? learnerLink('/', { source: 'official-download-fallback' }) : '/download'"
        :action-label="pageState === 'download-disabled' ? '打开学习 Web' : '回到下载页面'"
        @retry="load"
      />
      <div class="download-grid">
        <article v-for="channel in downloadChannels" :key="channel.id" class="download-card">
          <span class="download-icon" aria-hidden="true">{{ channel.id === 'learner-web' ? '↗' : '↓' }}</span>
          <span class="eyebrow">{{ channel.platform }}</span>
          <h2>{{ channel.name }}</h2>
          <p>{{ channel.description }}</p>
          <a
            v-if="channel.availability === 'available' && pageState === 'ready' && channelHref(channel)"
            class="button button-primary button-block"
            :href="channelHref(channel)"
          >
            {{ channel.action }}
          </a>
          <span v-else class="button button-muted button-block" aria-disabled="true">{{ channel.action }}</span>
        </article>
      </div>
      <section v-if="pageState === 'ready' && campaigns.length" class="projection-section">
        <div class="section-heading section-heading-compact"><div><span class="eyebrow">Public activities</span><h2>活动与下载入口</h2></div><p>入口会根据发布状态、地区和资格安全降级。</p></div>
        <div class="campaign-grid"><PublicCampaignCard v-for="campaign in campaigns" :key="campaign.id" :campaign="campaign" /></div>
      </section>
      <div class="side-note" style="margin-top: 24px">
        <h2>下载安全提示</h2>
        <p>请只从官网公开入口或受信任的应用商店获取安装包。官网不会要求你在下载页输入密码、Token、支付凭证或上传录音。</p>
      </div>
    </div>
  </section>
</template>
