<script setup lang="ts">
import AppIcon from '../components/AppIcon.vue'
import StudyArtwork from '../components/StudyArtwork.vue'
import { useExperienceText } from '../platform/experience-ui'
const t = useExperienceText()
</script>
<template>
  <main class="auth-layout v2-auth">
    <aside class="auth-art v2-auth-intro" aria-hidden="true">
      <div class="brand"><AppIcon name="spark" :size="34" /><span>{{ t('brand') }}</span></div>
      <div class="auth-art__copy v2-auth-intro__copy"><span class="card-kicker v2-eyebrow">语学星 · 成人英语学习</span><h2>{{ t('authTitle') }}</h2><p>{{ t('authDescription') }}</p><div class="v2-auth-tags"><span class="v2-tag">规则化学习</span><span class="v2-tag">持续复习</span><span class="v2-tag">清楚的记录</span></div></div>
      <StudyArtwork /><small>LEARN A LITTLE. EVERY DAY.</small>
    </aside>
    <div class="auth-content v2-auth-form"><div class="auth-topline v2-auth-topline"><RouterLink class="brand" :to="{ name: 'login' }"><AppIcon name="spark" :size="25" /><span>{{ t('brand') }}</span></RouterLink><span>{{ t('authNote') }}</span></div><slot /></div>
  </main>
</template>
<style>
.auth-layout.v2-auth { background: var(--v2-bg); color: var(--v2-ink); font-family: var(--v2-font); grid-template-columns: minmax(300px,1fr) minmax(360px,500px); gap: 40px; padding: 32px 46px; align-items: center; min-height: 100dvh; max-width: 1280px; margin: 0 auto; }
.auth-art.v2-auth-intro { background: var(--v2-grad-soft); color: var(--v2-ink); border-radius: 24px; padding: 44px; min-height: 480px; justify-content: center; }
.auth-art.v2-auth-intro .brand, .auth-art.v2-auth-intro .brand svg { color: var(--v2-brand); }
.v2-auth-intro__copy { margin-top: 0; }
.v2-auth-intro__copy h2 { font-size: 40px; line-height: 1.3; letter-spacing: -1.5px; font-weight: 700; color: var(--v2-ink); }
.v2-auth-intro__copy p { color: var(--v2-mut); font-size: 15px; line-height: 1.8; max-width: 360px; }
.v2-eyebrow { color: var(--v2-brand); font-size: 12px; font-weight: 700; letter-spacing: 1px; }
.v2-auth-tags { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 18px; }
.v2-tag { display: inline-flex; padding: 4px 12px; border-radius: var(--v2-radius-pill); background: var(--v2-card); color: var(--v2-brand); font-size: 12px; font-weight: 600; border: 1px solid var(--v2-line); }
.auth-art.v2-auth-intro .study-artwork { opacity: .35; }
.auth-art.v2-auth-intro > small { color: var(--v2-mut); }
.auth-content.v2-auth-form { background: var(--v2-card); border: 1px solid var(--v2-line); border-radius: var(--v2-radius-lg); box-shadow: var(--v2-shadow); padding: 40px 36px; }
.v2-auth-form .button--primary { background: var(--v2-brand); color: var(--v2-inverse); border-radius: var(--v2-radius-md); }
.v2-auth-form .field input { border-radius: var(--v2-radius-md); border-color: var(--v2-line); background: var(--v2-card); }
.v2-auth-form .field input:focus { outline: 2px solid var(--v2-focus); outline-offset: 1px; }
@media (max-width: 900px) { .auth-layout.v2-auth { grid-template-columns: 1fr; padding: 20px 16px; } .auth-art.v2-auth-intro { min-height: 200px; padding: 25px; } .v2-auth-intro__copy h2 { font-size: 28px; } }
</style>
