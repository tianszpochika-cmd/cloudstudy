<script setup lang="ts">
import { useRouter } from 'vue-router'
import AuthLayout from '../layouts/AuthLayout.vue'
const router = useRouter()
import EmptyState from '../components/EmptyState.vue'

defineProps<{
  title: string
  description: string
}>()
</script>

<template>
  <AuthLayout class="v2-page v2-page--empty">
    <div class="v2-empty-layout">
      <div class="v2-empty-main">
        <section class="page-stack v2-empty-card">
          <EmptyState class="v2-empty-state" :title="title" :description="description" action-label="返回学习首页" @action="router.push({ name: 'home' })" />
        </section>
      </div>
      <aside class="v2-empty-side" aria-label="空状态说明">
        <h2 class="v2-empty-side-title">看到这个页面时</h2>
        <ol class="v2-empty-tips">
          <li>这里暂时没有可显示的内容。</li>
          <li>用主列按钮返回学习首页继续。</li>
          <li>反复看到可返回后再试一次。</li>
        </ol>
      </aside>
    </div>
  </AuthLayout>
</template>

<style>
/* v2 Empty 空状态页面级布局（只做样式）：无此页专用原型，对齐 webDemo learner-web 普通内容页卡片风格与收藏空状态居中通栏。
 * 选择器全部以 .v2-page--empty 开头；颜色只用 --v2-* tokens，不写死色值以适配暗色。 */
.v2-page--empty{background:var(--v2-bg);color:var(--v2-ink);font-family:var(--v2-font);min-width:0}
.v2-page--empty .v2-empty-layout{display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:var(--v2-space-5);align-items:start;min-width:0}
.v2-page--empty .v2-empty-main{display:grid;gap:var(--v2-space-5);align-content:start;min-width:0}
.v2-page--empty .v2-empty-card{background:var(--v2-card);border:1px solid var(--v2-line);border-radius:var(--v2-radius-lg);box-shadow:var(--v2-shadow);padding:var(--v2-space-12) var(--v2-space-6);min-width:0;display:grid;gap:var(--v2-space-4);align-content:start;justify-items:center;text-align:center}
.v2-page--empty .v2-empty-state{display:grid;gap:var(--v2-space-3);justify-items:center;min-width:0;max-width:100%}
.v2-page--empty .v2-empty-tag{display:inline-flex;align-items:center;width:fit-content;max-width:100%;padding:var(--v2-space-1) var(--v2-space-3);border-radius:var(--v2-radius-pill);background:var(--v2-soft);color:var(--v2-brand);font-size:var(--v2-text-xs);font-weight:700;line-height:1.6}
.v2-page--empty .v2-empty-side{background:var(--v2-card);border:1px solid var(--v2-line);border-radius:var(--v2-radius-lg);box-shadow:var(--v2-shadow);padding:var(--v2-space-6);min-width:0;display:grid;gap:var(--v2-space-3);align-content:start}
.v2-page--empty .v2-empty-side-title{margin:0;color:var(--v2-ink);font-size:var(--v2-text-lg);line-height:1.4}
.v2-page--empty .v2-empty-tips{margin:0;padding-left:var(--v2-space-5);display:grid;gap:var(--v2-space-2);color:var(--v2-mut);font-size:var(--v2-text-sm);line-height:1.7}
.v2-page--empty .v2-empty-tips li::marker{color:var(--v2-brand)}
.v2-page--empty a:focus-visible{outline:2px solid var(--v2-brand);outline-offset:2px}
.v2-page--empty button:focus-visible{outline:2px solid var(--v2-brand);outline-offset:2px}
@media (max-width:1190px){.v2-page--empty .v2-empty-layout{grid-template-columns:minmax(0,1fr) 250px}.v2-page--empty .v2-empty-card{padding:var(--v2-space-8) var(--v2-space-5)}.v2-page--empty .v2-empty-side{padding:var(--v2-space-5)}}
@media (max-width:900px){.v2-page--empty .v2-empty-layout{grid-template-columns:1fr}.v2-page--empty .v2-empty-side{grid-template-columns:1fr}}
</style>
