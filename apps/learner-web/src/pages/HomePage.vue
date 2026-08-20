<script setup lang="ts">
import EmptyState from '../components/EmptyState.vue'
</script>

<template>
  <section class="page-stack" aria-labelledby="home-title">
    <div class="hero-panel">
      <div>
        <p class="eyebrow">ADAPTIVE HOME</p>
        <h2 id="home-title">今天，从一个清晰的小任务开始。</h2>
        <p>学习首页的任务、进度和复习风险会从后端契约加载；壳层已经准备好加载、空态和错误态。</p>
      </div>
      <div class="hero-panel__orb" aria-hidden="true">✦</div>
    </div>

    <div class="grid grid--two">
      <article class="info-card">
        <span class="card-kicker">当前状态</span>
        <h3>等待学习数据</h3>
        <p>没有本地伪造的课程、任务或进度。连接 Core API 后，这里显示真实的今日学习流。</p>
      </article>
      <article class="info-card">
        <span class="card-kicker">可恢复设计</span>
        <h3>先保留你的下一步</h3>
        <p>路由目标和壳层状态可以恢复；业务提交会在契约、鉴权和同步能力完成后启用。</p>
      </article>
    </div>

    <EmptyState
      title="今日任务为空"
      description="这是一个真实的空状态，不代表学习失败。完成身份和学习计划契约接入后，系统会在这里呈现下一步。"
    />
  </section>
</template>
