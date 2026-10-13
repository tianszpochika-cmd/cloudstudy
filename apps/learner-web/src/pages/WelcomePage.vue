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

<style>
/* v2 Welcome 页面级布局（只做样式）：原型无欢迎页专属样式，对齐 webDemo learner-web 普通内容页（主列+侧栏两栏卡片）与卡片/标签风格。
 * 选择器全部以 .v2-page--welcome 开头；颜色只用 --v2-* tokens，不写死色值以适配暗色。 */
.v2-page--welcome{background:var(--v2-bg);color:var(--v2-ink);font-family:var(--v2-font);min-width:0}
.v2-page--welcome.auth-layout{grid-template-columns:minmax(280px,360px) minmax(0,1fr);gap:var(--v2-space-8);align-items:center;max-width:1280px;margin:0 auto;min-width:0}
.v2-page--welcome .v2-auth-intro{min-width:0}
.v2-page--welcome .v2-auth-form{width:100%;max-width:none;min-width:0;background:var(--v2-bg);border:0;box-shadow:none;padding:0;display:grid;align-content:start}
.v2-page--welcome .v2-welcome-layout{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:var(--v2-space-5);align-items:start;min-width:0;width:100%}
.v2-page--welcome .v2-welcome-main{display:grid;gap:var(--v2-space-5);align-content:start;min-width:0}
.v2-page--welcome .v2-welcome-card{width:100%;max-width:none;background:var(--v2-card);border:1px solid var(--v2-line);border-radius:var(--v2-radius-lg);box-shadow:var(--v2-shadow);padding:var(--v2-space-8);min-width:0;display:grid;gap:var(--v2-space-4);align-content:start}
.v2-page--welcome .v2-welcome-brand{display:flex;align-items:center;gap:var(--v2-space-3);color:var(--v2-ink);font-size:var(--v2-text-lg);font-weight:700;line-height:1.4}
.v2-page--welcome .v2-welcome-brand .brand__mark{display:inline-grid;place-items:center;width:36px;height:36px;border-radius:var(--v2-radius-md);background:var(--v2-brand);color:var(--v2-inverse);font-size:var(--v2-text-md)}
.v2-page--welcome .v2-welcome-eyebrow{display:inline-flex;align-items:center;width:fit-content;max-width:100%;margin:0;padding:var(--v2-space-1) var(--v2-space-3);border-radius:var(--v2-radius-pill);background:var(--v2-soft);color:var(--v2-brand);font-size:var(--v2-text-xs);font-weight:700;letter-spacing:1px;line-height:1.6}
.v2-page--welcome .v2-welcome-title{margin:0;color:var(--v2-ink);font-size:var(--v2-text-2xl);line-height:1.3;letter-spacing:-1px}
.v2-page--welcome .v2-welcome-lead{margin:0;color:var(--v2-mut);font-size:var(--v2-text-md);line-height:1.8}
.v2-page--welcome .v2-welcome-actions{display:flex;flex-wrap:wrap;gap:var(--v2-space-3);margin-top:var(--v2-space-2)}
.v2-page--welcome .v2-welcome-action{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 var(--v2-space-5);border-radius:var(--v2-radius-md);font-size:var(--v2-text-sm);font-weight:700;line-height:1.5;text-decoration:none}
.v2-page--welcome .v2-welcome-actions .button--primary{background:var(--v2-brand);color:var(--v2-inverse);border:1px solid var(--v2-brand)}
.v2-page--welcome .v2-welcome-actions .button--primary:hover:not(:disabled){background:var(--v2-brand2)}
.v2-page--welcome .v2-welcome-actions .button--secondary{background:var(--v2-soft);color:var(--v2-brand);border:1px solid var(--v2-line)}
.v2-page--welcome .v2-welcome-actions .button--secondary:hover:not(:disabled){background:var(--v2-surface)}
.v2-page--welcome .v2-welcome-micro{margin:0;color:var(--v2-mut);font-size:var(--v2-text-sm);line-height:1.7}
.v2-page--welcome .v2-welcome-side{background:var(--v2-card);border:1px solid var(--v2-line);border-radius:var(--v2-radius-lg);box-shadow:var(--v2-shadow);padding:var(--v2-space-6);min-width:0;display:grid;gap:var(--v2-space-3);align-content:start}
.v2-page--welcome .v2-welcome-side-title{margin:0;color:var(--v2-ink);font-size:var(--v2-text-lg);line-height:1.4}
.v2-page--welcome .v2-welcome-tips{margin:0;padding:0;list-style:none;display:grid;gap:var(--v2-space-3);counter-reset:welcome-tip;min-width:0}
.v2-page--welcome .v2-welcome-tips li{display:grid;grid-template-columns:auto minmax(0,1fr);gap:var(--v2-space-3);align-items:start;color:var(--v2-mut);font-size:var(--v2-text-sm);line-height:1.7;background:var(--v2-surface);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);padding:var(--v2-space-3) var(--v2-space-4)}
.v2-page--welcome .v2-welcome-tips li::before{counter-increment:welcome-tip;content:counter(welcome-tip);display:inline-grid;place-items:center;width:24px;height:24px;border-radius:var(--v2-radius-pill);background:var(--v2-soft);color:var(--v2-brand);font-size:var(--v2-text-xs);font-weight:700;line-height:1}
.v2-page--welcome a:focus-visible{outline:2px solid var(--v2-brand);outline-offset:2px}
@media (max-width:1190px){.v2-page--welcome.auth-layout{grid-template-columns:minmax(260px,320px) minmax(0,1fr);gap:var(--v2-space-5)}.v2-page--welcome .v2-welcome-layout{grid-template-columns:minmax(0,1fr) 250px}.v2-page--welcome .v2-welcome-card{padding:var(--v2-space-6)}.v2-page--welcome .v2-welcome-side{padding:var(--v2-space-5)}}
@media (max-width:900px){.v2-page--welcome.auth-layout{grid-template-columns:1fr}.v2-page--welcome .v2-welcome-layout{grid-template-columns:1fr}.v2-page--welcome .v2-welcome-card{padding:var(--v2-space-5)}.v2-page--welcome .v2-welcome-actions{display:grid;grid-template-columns:1fr}.v2-page--welcome .v2-welcome-action{width:100%}}
</style>
