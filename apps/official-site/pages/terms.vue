<script setup lang="ts">
import { useOfficialSeo } from '~/utils/seo'

useOfficialSeo({
  title: '用户协议｜语学星 EnglishFlow',
  description: '阅读语学星公开服务的边界：公开信息不等同于订单、权益或学习事实。',
  path: '/terms',
  breadcrumbs: [{ name: '首页', path: '/' }, { name: '用户协议', path: '/terms' }],
})
</script>

<template>
  <section class="page-hero">
    <div class="container">
      <div class="breadcrumb"><NuxtLink to="/">首页</NuxtLink><span aria-hidden="true">/</span><span>用户协议</span></div>
      <span class="eyebrow">Terms</span>
      <h1>先把边界说清楚，再谈使用。</h1>
      <p>本页为静态公开说明；课程、价格、下载页面的公开信息不等同于订单、权益或学习事实。</p>
    </div>
  </section>

  <section class="page-content">
    <div class="container about-grid">
      <article class="prose">
        <h2>公开信息与正式服务</h2>
        <p>官网负责品牌、课程介绍、价格、下载和合规公示。登录后服务会重新鉴权并以服务端版本化事实为准，公开页面的描述不构成对订单、权益、进度或成绩的承诺。</p>
        <h3>阶段边界</h3>
        <p>当前阶段面向成年用户与大学生。AI、实时语音与 K12 能力有独立阶段，不会在基础边界尚未准备好时提前混入；任何“已上线”的说法以正式发布与服务状态页为准。</p>
        <h3>下载与安装</h3>
        <p>安装包与商店入口以 <NuxtLink to="/download">下载页</NuxtLink> 的可用状态为准；失败时请按页面给出的出口重试，不要使用非官方来源的安装包。</p>
      </article>
      <aside class="side-note">
        <h2>相关公示</h2>
        <ul class="feature-list">
          <li><span aria-hidden="true">→</span><NuxtLink to="/privacy">隐私与数据</NuxtLink></li>
          <li><span aria-hidden="true">→</span><NuxtLink to="/minors">未成年人保护声明</NuxtLink></li>
          <li><span aria-hidden="true">→</span><NuxtLink to="/compliance">合规公示</NuxtLink></li>
        </ul>
      </aside>
    </div>
  </section>
</template>
