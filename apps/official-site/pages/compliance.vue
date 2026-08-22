<script setup lang="ts">
import { computed } from 'vue'
import { usePublicProjection } from '~/composables/usePublicProjection'
import { resolvePublicPageState, resolvePublicState } from '~/utils/public-state.mjs'
import { useOfficialSeo } from '~/utils/seo'

const route = useRoute()
const { loadState, load } = usePublicProjection('compliance')
const previewState = computed(() => resolvePublicState(route.query.state))
const pageState = computed(() => resolvePublicPageState(previewState.value, loadState.value.state, loadState.value.projection.complianceNotices.length > 0))
const complianceNotices = computed(() => loadState.value.projection.complianceNotices)
useOfficialSeo({
  title: '合规公示｜语学星 EnglishFlow',
  description: '查看语学星的主体与备案、隐私数据、成人阶段与未成年人保护边界说明。',
  path: '/compliance',
  breadcrumbs: [{ name: '首页', path: '/' }, { name: '合规公示', path: '/compliance' }],
})
</script>

<template>
  <section class="page-hero">
    <div class="container">
      <div class="breadcrumb"><NuxtLink to="/">首页</NuxtLink><span aria-hidden="true">/</span><span>合规公示</span></div>
      <span class="eyebrow">Public compliance</span>
      <h1>把已经确定的边界，清楚地公示出来。</h1>
      <p>本页面只呈现公开合规说明。正式备案、许可与主体信息以依法完成审核后的最新公示版本为准。</p>
    </div>
  </section>

  <section class="page-content">
    <div class="container">
      <PublicStatus v-if="pageState !== 'ready'" :state="pageState" action-href="/compliance" action-label="回到合规公示" @retry="load" />
      <div v-else class="notice-grid">
        <article v-for="notice in complianceNotices" :key="notice.title" class="notice-card">
          <span class="notice-status">{{ notice.status }}</span>
          <h2>{{ notice.title }}</h2>
          <p>{{ notice.description }}</p>
        </article>
      </div>

      <div class="compliance-layout" style="margin-top: 42px">
        <article class="prose">
          <h2 id="privacy">隐私与数据</h2>
          <p>官网页面用于公开信息展示与受控跳转，不承载登录后的学习工作区。除为完成页面运行所必需的技术信息外，官网不在公开页面收集密码、Token、原始录音、支付凭证或未脱敏自由文本。</p>
          <h3 id="terms">用户协议与服务边界</h3>
          <p>课程、价格、下载和活动页面的公开信息不等同于订单、权益或学习事实。登录后服务会重新鉴权并以服务端版本化事实为准。</p>
          <h3 id="minors">未成年人保护声明</h3>
          <p>Phase 1 只面向成年用户与大学生。儿童账号、家长账号、监护绑定、未成年人支付和 K12 学习目标在专项合规 Gate 完成前不开放，也不会由官网创建对应主体或权益。</p>
        </article>
        <aside class="side-note">
          <h2>如何识别可信入口</h2>
          <p>请通过本官网导航进入课程、价格、下载和公示页面；进入学习 Web 后，地址栏与登录状态由学习端和标准身份服务负责。若发现索要敏感信息的非官方页面，请停止操作。</p>
        </aside>
      </div>
    </div>
  </section>
</template>
