<script setup lang="ts">
import { useOfficialSeo } from '~/utils/seo'

useOfficialSeo({
  title: '服务状态｜语学星 EnglishFlow',
  description: '查看语学星公开服务的可用状态说明；未开放能力不伪装成已上线。',
  path: '/status',
  breadcrumbs: [{ name: '首页', path: '/' }, { name: '服务状态', path: '/status' }],
})
</script>

<template>
  <section class="page-hero">
    <div class="container">
      <div class="breadcrumb"><NuxtLink to="/">首页</NuxtLink><span aria-hidden="true">/</span><span>服务状态</span></div>
      <span class="eyebrow">Status</span>
      <h1>可用不可用，都写清楚。</h1>
      <p>本页为静态公开说明，不读取登录状态；实时运行状态以登录后服务与正式运维公告为准。</p>
    </div>
  </section>

  <section class="page-content">
    <div class="container about-grid">
      <article class="prose">
        <h2>当前公开状态</h2>
        <p>官网公开内容、课程介绍、价格说明与下载指引处于可访问状态；学习 Web、移动端安装包、小程序与生产支付能力按各自页面的可用标记为准，标记为“暂未开放”的不会提前提供服务。</p>
        <h3>下载失败时</h3>
        <p>请按 <NuxtLink to="/download">下载页</NuxtLink> 给出的出口重试或更换渠道；不要使用非官方来源的安装包，也不要在公开页面提交账号、Token 或支付信息。</p>
        <h3>状态与事实的关系</h3>
        <p>本页不复制登录后的学习、订单或权益事实；任何差异都以服务端版本化事实为准，官网不会用静态文案覆盖运行结论。</p>
      </article>
      <aside class="side-note">
        <h2>相关入口</h2>
        <ul class="feature-list">
          <li><span aria-hidden="true">→</span><NuxtLink to="/download">下载体验</NuxtLink></li>
          <li><span aria-hidden="true">→</span><NuxtLink to="/announcements">服务公告</NuxtLink></li>
          <li><span aria-hidden="true">→</span><NuxtLink to="/compliance">合规公示</NuxtLink></li>
        </ul>
      </aside>
    </div>
  </section>
</template>
