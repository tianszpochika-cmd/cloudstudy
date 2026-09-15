<script setup lang="ts">
import { useOfficialSeo } from '~/utils/seo'

useOfficialSeo({
  title: '隐私与数据｜语学星 EnglishFlow',
  description: '了解语学星官网的信息边界：公开页面不收集密码、Token、录音与支付凭证。',
  path: '/privacy',
  breadcrumbs: [{ name: '首页', path: '/' }, { name: '隐私与数据', path: '/privacy' }],
})
</script>

<template>
  <section class="page-hero">
    <div class="container">
      <div class="breadcrumb"><NuxtLink to="/">首页</NuxtLink><span aria-hidden="true">/</span><span>隐私与数据</span></div>
      <span class="eyebrow">Privacy</span>
      <h1>公开页面，只做公开的事。</h1>
      <p>本页为静态公开说明，不读取登录状态、不携带业务 Token；正式版本以合规公示为准。</p>
    </div>
  </section>

  <section class="page-content">
    <div class="container about-grid">
      <article class="prose">
        <h2>我们收集什么、不收集什么</h2>
        <p>官网页面用于公开信息展示与受控跳转。除为完成页面运行所必需的技术信息外，官网不在公开页面收集密码、Token、原始录音、支付凭证或未脱敏自由文本。</p>
        <h3>登录后的数据在哪里</h3>
        <p>学习数据、计划、作答、进度、权益和通知由独立服务负责，官网不复制、不缓存、不拼接这些事实。进入学习端后的一切鉴权与数据处理以服务端版本化事实为准。</p>
        <h3>你的选择</h3>
        <p>你可以随时停止浏览公开页面而不产生账号或权益；需要行使导出、删除等权利时，请在登录后的设置与隐私入口提交，官网不受理口头或页内表单的敏感请求。</p>
      </article>
      <aside class="side-note">
        <h2>相关公示</h2>
        <ul class="feature-list">
          <li><span aria-hidden="true">→</span><NuxtLink to="/terms">用户协议</NuxtLink></li>
          <li><span aria-hidden="true">→</span><NuxtLink to="/compliance">合规公示</NuxtLink></li>
          <li><span aria-hidden="true">→</span><NuxtLink to="/status">服务状态</NuxtLink></li>
        </ul>
      </aside>
    </div>
  </section>
</template>
