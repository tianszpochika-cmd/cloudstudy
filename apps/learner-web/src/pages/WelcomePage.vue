<script setup lang="ts">
import AuthLayout from '../layouts/AuthLayout.vue'
import { RouterLink } from 'vue-router'
</script>

<template>
  <AuthLayout class="v2-page v2-page--welcome">
    <div class="v2-welcome-layout">
      <div class="v2-welcome-main">
        <section class="welcome-card login-card v2-welcome-card" aria-labelledby="welcome-title">
          <div class="brand brand--large v2-welcome-brand">
            <span class="brand__mark" aria-hidden="true">✦</span>
            <span>语学星</span>
          </div>
          <p class="eyebrow v2-welcome-eyebrow">LANGUAGE LEARNING, ONE CLEAR STEP</p>
          <h1 id="welcome-title" class="v2-welcome-title">把每一次练习，变成下一次掌握。</h1>
          <p class="lead v2-welcome-lead">面向成人与大学生的语言学习空间。先建立目标，再用练习、反馈和复习形成可持续的学习闭环。</p>
          <div class="welcome-card__actions v2-welcome-actions">
            <RouterLink class="button button--primary v2-welcome-action" to="/login">开始学习</RouterLink>
            <RouterLink class="button button--secondary v2-welcome-action" to="/login">已有账号，登录</RouterLink>
          </div>
          <p class="micro-copy v2-welcome-micro">一点一点，学得更从容。</p>
        </section>
      </div>
      <aside class="v2-welcome-side" aria-label="学习说明">
        <h2 class="v2-welcome-side-title">这样开始</h2>
        <ol class="v2-welcome-tips">
          <li>先登录，进入适合你的学习安排。</li>
          <li>跟着练习与反馈一步步完成。</li>
          <li>需要巩固的内容会在复习中出现。</li>
        </ol>
      </aside>
    </div>
  </AuthLayout>
</template>
