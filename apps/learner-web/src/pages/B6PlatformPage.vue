<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { type PerformanceLevel } from '@englishflow/performance'
import { experiencePerformance as engine, useExperienceText } from '../platform/experience-ui'
import ExperienceHeader from '../components/ExperienceHeader.vue'
import LearningPreferences from '../components/LearningPreferences.vue'
import AppIcon from '../components/AppIcon.vue'

const t = useExperienceText()
const motionDisabled = ref(engine.state.motionDisabled)
const performanceLevel = ref<PerformanceLevel>(engine.level)
const levels: PerformanceLevel[] = ['Ultra', 'High', 'Medium', 'Performance']
const unsubscribe = engine.subscribe(state => {
  performanceLevel.value = state.level
  motionDisabled.value = state.motionDisabled
})
onUnmounted(unsubscribe)
</script>

<template>
  <section class="display-page" aria-labelledby="b6-platform-title">
    <ExperienceHeader page="Platform" icon="monitor" title-id="b6-platform-title" />
    <article class="display-card">
      <div><h2>{{ t('displayTitle') }}</h2><p>{{ t('displayHint') }}</p></div>
      <LearningPreferences />
    </article>
    <article class="display-card display-motion">
      <div><h2>{{ t('motionTitle') }}</h2><p>{{ t('motionHint') }}</p></div>
      <label class="privacy-toggle"><input type="checkbox" :checked="!motionDisabled" @change="engine.setMotionDisabled(!($event.target as HTMLInputElement).checked)" /> {{ t('motionEnabled') }}</label>
    </article>
    <article class="display-card">
      <div><h2>{{ t('qualityTitle') }}</h2><p>{{ t('qualityHint') }}</p></div>
      <div class="quality-options">
        <button v-for="level in levels" :key="level" type="button" class="quality-option" :aria-pressed="performanceLevel === level" @click="engine.setLevel(level, 'manual')">
          <span class="quality-option__title"><strong>{{ t('quality' + level) }}</strong><AppIcon v-if="performanceLevel === level" name="check" :size="18" /></span>
          <small>{{ level }}</small><p>{{ t('quality' + level + 'Hint') }}</p>
        </button>
      </div>
    </article>
    <article class="display-card display-help"><AppIcon name="headphones" :size="30" /><div><h2>{{ t('deviceHelpTitle') }}</h2><p>{{ t('deviceHelpHint') }}</p><RouterLink class="button button--secondary" :to="{ name: 'support' }">{{ t('support') }} <AppIcon name="arrow" :size="16" /></RouterLink></div></article>
  </section>
</template>

<style scoped>
.display-page{display:grid;gap:24px}.display-card{display:grid;gap:22px;padding:28px;border:1px solid var(--yx-color-border);border-radius:var(--yx-radius-card);background:var(--yx-color-surface-card)}.display-card h2{margin:0 0 10px;font-size:20px;letter-spacing:-.035em}.display-card p{margin:0;color:var(--yx-color-text-secondary);line-height:1.8;font-size:14px}.display-motion{grid-template-columns:minmax(0,1fr) auto;align-items:center}.quality-options{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.quality-option{text-align:left;display:grid;align-content:start;gap:10px;padding:20px;background:var(--yx-color-surface-page);border:1px solid var(--yx-color-border);border-radius:18px;color:var(--yx-color-text-primary);cursor:pointer}.quality-option[aria-pressed=true]{border-color:var(--yx-color-brand-primary);background:var(--yx-color-brand-primary-soft)}.quality-option__title{display:flex;justify-content:space-between;gap:8px;color:var(--yx-color-brand-primary)}.quality-option small{color:var(--yx-color-text-tertiary)}.display-help{grid-template-columns:auto minmax(0,1fr);background:var(--yx-color-brand-primary-soft)}.display-help .button{margin-top:18px}.display-help>svg{color:var(--yx-color-brand-primary)}
@media(max-width:1000px){.quality-options{grid-template-columns:repeat(2,minmax(0,1fr))}.display-motion{grid-template-columns:1fr}}
@media(max-width:480px){.display-card{padding:20px}.quality-options{grid-template-columns:1fr}.quality-option{padding:18px}.display-help{grid-template-columns:1fr}}
</style>
