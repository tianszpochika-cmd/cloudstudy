<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <main class="public-page">
    <section class="welcome-card" aria-labelledby="welcome-title">
      <div class="brand brand--large">
        <span class="brand__mark" aria-hidden="true">✦</span>
        <span>语学星</span>
      </div>
      <p class="eyebrow">LANGUAGE LEARNING, ONE CLEAR STEP</p>
      <h1 id="welcome-title">把每一次练习，变成下一次掌握。</h1>
      <p class="lead">面向成人与大学生的语言学习空间。先建立目标，再用练习、反馈和复习形成可持续的学习闭环。</p>
      <div class="welcome-card__actions">
        <RouterLink class="button button--primary" to="/login">开始学习</RouterLink>
        <RouterLink class="button button--secondary" to="/login">已有账号，登录</RouterLink>
      </div>
      <p class="micro-copy">当前为工程基座预览，业务数据将在 API 契约接入后显示。</p>
    </section>
  </main>
</template>
