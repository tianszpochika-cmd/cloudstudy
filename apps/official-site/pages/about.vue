<script setup lang="ts">
import { useOfficialSeo } from '~/utils/seo'

useOfficialSeo({
  title: '关于我们｜语学星 EnglishFlow',
  description: '了解语学星的产品使命、学习方法和面向成年用户与大学生的阶段边界。',
  path: '/about',
  breadcrumbs: [{ name: '首页', path: '/' }, { name: '关于我们', path: '/about' }],
})
</script>

<template>
  <section class="page-hero">
    <div class="container">
      <div class="breadcrumb"><NuxtLink to="/">首页</NuxtLink><span aria-hidden="true">/</span><span>关于我们</span></div>
      <span class="eyebrow">About EnglishFlow</span>
      <h1>让学习回到真实、可继续的节奏。</h1>
      <p>我们相信，语言学习不应该只由一次分数定义，而应该由每一次理解、练习、反馈和复习共同构成。</p>
    </div>
  </section>

  <section class="page-content">
    <div class="container about-grid">
      <article class="prose">
        <h2>我们在解决什么问题？</h2>
        <p>很多学习产品把目标、内容、练习和反馈分散在不同入口里，用户知道自己“学过”，却很难知道下一步该做什么。语学星用规则化的学习闭环把这些动作接起来。</p>
        <h3>先做对 Phase 1</h3>
        <p>当前阶段面向成年用户与大学生，优先把目标设定、内容版本、规则练习、复习队列、学习报告和跨端恢复做好。AI、实时语音与 K12 能力都有独立阶段，不会在基础边界尚未准备好时提前混入。</p>
        <h3>公开与登录后的边界</h3>
        <p>官网负责品牌、课程介绍、价格、下载和合规公示；登录后的学习数据、计划、作答、进度、权益和通知由独立服务负责。两者通过受控深链衔接，不在官网复制学习工作区。</p>
      </article>
      <aside class="side-note">
        <h2>我们的三个坚持</h2>
        <ul class="feature-list">
          <li><span aria-hidden="true">✓</span>结果可解释：反馈告诉你为什么。</li>
          <li><span aria-hidden="true">✓</span>事实有归属：学习、内容和权益各自有唯一 owner。</li>
          <li><span aria-hidden="true">✓</span>边界可见：未开放能力不伪装成已上线。</li>
        </ul>
      </aside>
    </div>
  </section>
</template>
