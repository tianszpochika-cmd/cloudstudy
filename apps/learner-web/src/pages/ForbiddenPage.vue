<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import AuthLayout from '../layouts/AuthLayout.vue'
import { authT } from '../auth/i18n'
import { useSessionStore } from '../stores/session'

const router = useRouter()
const session = useSessionStore()

const isRejected = computed(() => session.adultGate === 'REJECTED')
const explanation = computed(() => {
  if (isRejected.value) {
    return '当前版本仅面向 18 岁以上成人开放，暂不能向你开放学习功能。'
  }
  return session.forbiddenReason ?? authT('forbidden.description')
})

async function logout(): Promise<void> {
  await session.logout()
  await router.replace({ name: 'login' })
}
</script>

<template>
  <AuthLayout class="v2-page v2-page--forbidden">
    <div class="v2-forbidden-layout">
      <div class="v2-forbidden-main">
        <section class="login-card v2-forbidden-card" aria-labelledby="forbidden-title">
          <h1 id="forbidden-title" class="v2-forbidden-title">{{ isRejected ? '学习访问受限' : authT('forbidden.title') }}</h1>
          <p class="lead v2-forbidden-lead">{{ explanation }}</p>
          <p v-if="!isRejected && session.forbiddenReason" class="muted v2-forbidden-reason" role="alert">{{ session.forbiddenReason }}</p>
          <div class="login-card__actions v2-forbidden-actions">
            <template v-if="isRejected">
              <RouterLink class="button button--secondary" to="/settings">前往账号设置</RouterLink>
              <RouterLink class="button button--ghost" to="/support">帮助与反馈</RouterLink>
              <button class="button button--ghost" type="button" @click="logout">退出登录</button>
            </template>
            <template v-else>
              <RouterLink class="button button--secondary" to="/home">返回学习首页</RouterLink>
              <button class="button button--ghost" type="button" @click="logout">{{ authT('forbidden.login') }}</button>
            </template>
          </div>
        </section>
      </div>
      <aside class="v2-forbidden-side" aria-label="访问受限说明">
        <h2 class="v2-forbidden-side-title">遇到访问受限时</h2>
        <ol class="v2-forbidden-tips">
          <li>主列会说明访问受限的原因。</li>
          <li>按主列按钮继续下一步。</li>
          <li>可用退出登录结束当前会话。</li>
        </ol>
      </aside>
    </div>
  </AuthLayout>
</template>

<style>
/* v2 Forbidden 无权限页面级布局（只做样式）：无此页专用原型，对齐 webDemo learner-web 普通内容页主列+侧栏两栏卡片与标签风格。
 * 选择器全部以 .v2-page--forbidden 开头；颜色只用 --v2-* tokens，不写死色值以适配暗色。 */
.v2-page--forbidden{background:var(--v2-bg);color:var(--v2-ink);font-family:var(--v2-font);min-width:0}
.v2-page--forbidden .v2-forbidden-layout{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:var(--v2-space-5);align-items:start;min-width:0;width:100%}
.v2-page--forbidden .v2-forbidden-main{display:grid;gap:var(--v2-space-5);align-content:start;min-width:0}
.v2-page--forbidden .v2-forbidden-card{width:100%;max-width:none;background:var(--v2-card);border:1px solid var(--v2-line);border-radius:var(--v2-radius-lg);box-shadow:var(--v2-shadow);padding:var(--v2-space-8);min-width:0;display:grid;gap:var(--v2-space-4);align-content:start}
.v2-page--forbidden .v2-forbidden-title{margin:0;color:var(--v2-ink);font-size:var(--v2-text-xl);line-height:1.4;letter-spacing:-1px}
.v2-page--forbidden .v2-forbidden-lead{margin:0;color:var(--v2-mut);font-size:var(--v2-text-md);line-height:1.8}
.v2-page--forbidden .v2-forbidden-reason{margin:0;background:var(--v2-warn-soft);color:var(--v2-warn);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);padding:var(--v2-space-3) var(--v2-space-4);font-size:var(--v2-text-sm);line-height:1.7}
.v2-page--forbidden .v2-forbidden-actions{display:flex;flex-wrap:wrap;gap:var(--v2-space-3);margin-top:var(--v2-space-2)}
.v2-page--forbidden .v2-forbidden-side{background:var(--v2-card);border:1px solid var(--v2-line);border-radius:var(--v2-radius-lg);box-shadow:var(--v2-shadow);padding:var(--v2-space-6);min-width:0;display:grid;gap:var(--v2-space-3);align-content:start}
.v2-page--forbidden .v2-forbidden-side-title{margin:0;color:var(--v2-ink);font-size:var(--v2-text-lg);line-height:1.4}
.v2-page--forbidden .v2-forbidden-tips{margin:0;padding-left:var(--v2-space-5);display:grid;gap:var(--v2-space-2);color:var(--v2-mut);font-size:var(--v2-text-sm);line-height:1.7}
.v2-page--forbidden .v2-forbidden-tips li::marker{color:var(--v2-brand)}
.v2-page--forbidden a:focus-visible{outline:2px solid var(--v2-brand);outline-offset:2px}
.v2-page--forbidden button:focus-visible{outline:2px solid var(--v2-brand);outline-offset:2px}
@media (max-width:1190px){.v2-page--forbidden .v2-forbidden-layout{grid-template-columns:minmax(0,1fr) 250px}.v2-page--forbidden .v2-forbidden-card{padding:var(--v2-space-6)}.v2-page--forbidden .v2-forbidden-side{padding:var(--v2-space-5)}}
@media (max-width:900px){.v2-page--forbidden .v2-forbidden-layout{grid-template-columns:1fr}.v2-page--forbidden .v2-forbidden-actions{display:grid;grid-template-columns:1fr}}
</style>
