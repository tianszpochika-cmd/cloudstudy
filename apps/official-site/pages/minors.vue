<script setup lang="ts">
import { useOfficialSeo } from '~/utils/seo'

useOfficialSeo({
  title: '未成年人保护声明｜语学星 EnglishFlow',
  description: 'Phase 1 只面向成年用户与大学生；未成年人相关能力在专项合规前不开放。',
  path: '/minors',
  breadcrumbs: [{ name: '首页', path: '/' }, { name: '未成年人保护声明', path: '/minors' }],
})
</script>

<template>
  <section class="page-hero">
    <div class="container">
      <div class="breadcrumb"><NuxtLink to="/">首页</NuxtLink><span aria-hidden="true">/</span><span>未成年人保护声明</span></div>
      <span class="eyebrow">Minors protection</span>
      <h1>没准备好的能力，不开放。</h1>
      <p>本页为静态公开说明；儿童账号、家长账号、监护绑定、未成年人支付和 K12 学习目标在专项合规 Gate 完成前不开放。</p>
    </div>
  </section>

  <section class="page-content">
    <div class="container about-grid">
      <article class="prose">
        <h2>当前阶段的用户范围</h2>
        <p>Phase 1 只面向成年用户与大学生。注册与成人 Gate 由服务端判定，未通过前不会开放学习能力。</p>
        <h3>不会发生的事</h3>
        <p>官网不会创建儿童主体、家长绑定或未成年人权益；也不会以“体验”“测试”名义收集未成年人信息。任何例外都需要先完成专项合规并更新本声明。</p>
        <h3>如果你是家长或老师</h3>
        <p>请不要为未成年人注册或代为学习；后续 K12 能力开放时，会有独立的合规公示、 consent 流程与可验证的保护措施，而不是在本阶段悄悄放行。</p>
      </article>
      <aside class="side-note">
        <h2>相关公示</h2>
        <ul class="feature-list">
          <li><span aria-hidden="true">→</span><NuxtLink to="/terms">用户协议</NuxtLink></li>
          <li><span aria-hidden="true">→</span><NuxtLink to="/privacy">隐私与数据</NuxtLink></li>
          <li><span aria-hidden="true">→</span><NuxtLink to="/compliance">合规公示</NuxtLink></li>
        </ul>
      </aside>
    </div>
  </section>
</template>
