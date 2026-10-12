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
