<script setup lang="ts">
import AppIcon from '../components/AppIcon.vue'
import StudyArtwork from '../components/StudyArtwork.vue'
import { useExperienceText } from '../platform/experience-ui'
const t = useExperienceText()
</script>
<template>
  <main class="auth-layout">
    <aside class="auth-art" aria-hidden="true">
      <div class="brand"><AppIcon name="spark" :size="34" /><span>{{ t('brand') }}</span></div>
      <div class="auth-art__copy"><span class="card-kicker">A LITTLE, EVERY DAY</span><h2>{{ t('authTitle') }}</h2><p>{{ t('authDescription') }}</p></div>
      <StudyArtwork /><small>LEARN A LITTLE. EVERY DAY.</small>
    </aside>
    <div class="auth-content"><div class="auth-topline"><RouterLink class="brand" :to="{ name: 'login' }"><AppIcon name="spark" :size="25" /><span>{{ t('brand') }}</span></RouterLink><span>{{ t('authNote') }}</span></div><slot /></div>
  </main>
</template>
