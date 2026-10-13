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
  <section class="display-page v2-page v2-page--b6platform" aria-labelledby="b6-platform-title">
    <ExperienceHeader page="Platform" icon="monitor" title-id="b6-platform-title" />
    <div class="v2-b6platform-layout">
      <div class="v2-b6platform-main">
    <article class="display-card v2-b6platform-card">
      <div><h2>{{ t('displayTitle') }}</h2><p>{{ t('displayHint') }}</p></div>
      <LearningPreferences />
    </article>
    <article class="display-card display-motion v2-b6platform-card">
      <div><h2>{{ t('motionTitle') }}</h2><p>{{ t('motionHint') }}</p></div>
      <label class="privacy-toggle"><input type="checkbox" :checked="!motionDisabled" @change="engine.setMotionDisabled(!($event.target as HTMLInputElement).checked)" /> {{ t('motionEnabled') }}</label>
    </article>
    <article class="display-card v2-b6platform-card">
      <div><h2>{{ t('qualityTitle') }}</h2><p>{{ t('qualityHint') }}</p></div>
      <div class="quality-options">
        <button v-for="level in levels" :key="level" type="button" class="quality-option" :aria-pressed="performanceLevel === level" @click="engine.setLevel(level, 'manual')">
          <span class="quality-option__title"><strong>{{ t('quality' + level) }}</strong><AppIcon v-if="performanceLevel === level" name="check" :size="18" /></span>
          <small><span class="v2-sr-only">{{ level }}</span><span>{{ level === 'Ultra' ? '超高' : level === 'High' ? '高' : level === 'Medium' ? '均衡' : '流畅' }}</span></small><p>{{ t('quality' + level + 'Hint') }}</p>
        </button>
      </div>
    </article>
      </div>
      <div class="v2-b6platform-side">
    <article class="display-card display-help v2-b6platform-card"><AppIcon name="headphones" :size="30" /><div><h2>{{ t('deviceHelpTitle') }}</h2><p>{{ t('deviceHelpHint') }}</p><RouterLink class="button button--secondary" :to="{ name: 'support' }">{{ t('support') }} <AppIcon name="arrow" :size="16" /></RouterLink></div></article>
        <div class="v2-b6platform-tips">
          <h2 class="v2-b6platform-tips-title">温馨提示</h2>
          <ul class="v2-b6platform-tips-list">
            <li>动效开关即时生效，可按偏好调整</li>
            <li>画质选项可随时切换对比效果</li>
            <li>遇到设备问题，可前往客服寻求帮助</li>
          </ul>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.display-page{display:grid;gap:24px}.display-card{display:grid;gap:22px;padding:28px;border:1px solid var(--yx-color-border);border-radius:var(--yx-radius-card);background:var(--yx-color-surface-card)}.display-card h2{margin:0 0 10px;font-size:20px;letter-spacing:-.035em}.display-card p{margin:0;color:var(--yx-color-text-secondary);line-height:1.8;font-size:14px}.display-motion{grid-template-columns:minmax(0,1fr) auto;align-items:center}.quality-options{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.quality-option{text-align:left;display:grid;align-content:start;gap:10px;padding:20px;background:var(--yx-color-surface-page);border:1px solid var(--yx-color-border);border-radius:18px;color:var(--yx-color-text-primary);cursor:pointer}.quality-option[aria-pressed=true]{border-color:var(--yx-color-brand-primary);background:var(--yx-color-brand-primary-soft)}.quality-option__title{display:flex;justify-content:space-between;gap:8px;color:var(--yx-color-brand-primary)}.quality-option small{color:var(--yx-color-text-tertiary)}.display-help{grid-template-columns:auto minmax(0,1fr);background:var(--yx-color-brand-primary-soft)}.display-help .button{margin-top:18px}.display-help>svg{color:var(--yx-color-brand-primary)}
@media(max-width:1000px){.quality-options{grid-template-columns:repeat(2,minmax(0,1fr))}.display-motion{grid-template-columns:1fr}}
@media(max-width:480px){.display-card{padding:20px}.quality-options{grid-template-columns:1fr}.quality-option{padding:18px}.display-help{grid-template-columns:1fr}}
</style>

<style>
/* v2 B6Platform 页面级布局（只做样式）：对齐 webDemo learner-web 原型普通内容页（主列+侧栏两栏卡片）与卡片/标签风格。
 * 选择器全部以 .v2-page--b6platform 开头；颜色只用 --v2-* tokens，不写死色值以适配暗色。 */
.v2-page--b6platform.display-page{background:var(--v2-bg);color:var(--v2-ink);font-family:var(--v2-font);display:grid;gap:var(--v2-space-5);align-items:start;align-content:start;min-width:0}
.v2-page--b6platform>header{min-width:0}
.v2-page--b6platform .experience-heading{min-width:0}
.v2-page--b6platform .v2-b6platform-layout{display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:var(--v2-space-5);align-items:start;min-width:0}
.v2-page--b6platform .v2-b6platform-main{display:grid;gap:var(--v2-space-5);align-content:start;min-width:0}
.v2-page--b6platform .v2-b6platform-card{background:var(--v2-card);border:1px solid var(--v2-line);border-radius:var(--v2-radius-lg);box-shadow:var(--v2-shadow);padding:var(--v2-space-6);min-width:0;display:grid;gap:var(--v2-space-4);align-content:start}
.v2-page--b6platform .v2-b6platform-card>div:first-child{display:grid;gap:var(--v2-space-1);min-width:0}
.v2-page--b6platform .v2-b6platform-card h2{margin:0;color:var(--v2-ink);font-size:var(--v2-text-lg);line-height:1.4}
.v2-page--b6platform .v2-b6platform-card p{margin:0;color:var(--v2-mut);font-size:var(--v2-text-sm);line-height:1.7}
.v2-page--b6platform .display-motion{grid-template-columns:minmax(0,1fr) auto;align-items:center}
.v2-page--b6platform .privacy-toggle{display:flex;align-items:center;gap:var(--v2-space-2);color:var(--v2-ink);font-size:var(--v2-text-sm);line-height:1.6;cursor:pointer}
.v2-page--b6platform .privacy-toggle input{width:18px;height:18px;accent-color:var(--v2-brand)}
.v2-page--b6platform .quality-options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--v2-space-4);min-width:0}
.v2-page--b6platform .quality-option{display:grid;gap:var(--v2-space-2);align-content:start;text-align:left;padding:var(--v2-space-5);background:var(--v2-surface);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);color:var(--v2-ink);cursor:pointer;min-width:0}
.v2-page--b6platform .quality-option[aria-pressed="true"]{border-color:var(--v2-brand);background:var(--v2-soft)}
.v2-page--b6platform .quality-option__title{display:flex;align-items:center;justify-content:space-between;gap:var(--v2-space-2);color:var(--v2-brand)}
.v2-page--b6platform .quality-option__title strong{color:var(--v2-ink);font-size:var(--v2-text-md);line-height:1.5}
.v2-page--b6platform .quality-option small{display:inline-flex;align-items:center;width:fit-content;max-width:100%;padding:var(--v2-space-1) var(--v2-space-3);border-radius:var(--v2-radius-pill);background:var(--v2-soft);color:var(--v2-brand);font-size:var(--v2-text-xs);font-weight:700;line-height:1.6}
.v2-page--b6platform .quality-option p{margin:0;color:var(--v2-mut);font-size:var(--v2-text-xs);line-height:1.6}
.v2-page--b6platform .v2-b6platform-side{display:grid;gap:var(--v2-space-5);align-content:start;min-width:0}
.v2-page--b6platform .display-help{grid-template-columns:auto minmax(0,1fr);align-items:start}
.v2-page--b6platform .display-help>div{display:grid;gap:var(--v2-space-2);align-content:start;min-width:0}
.v2-page--b6platform .display-help .button{margin-top:var(--v2-space-3);width:fit-content;max-width:100%}
.v2-page--b6platform .v2-b6platform-tips{background:var(--v2-card);border:1px solid var(--v2-line);border-radius:var(--v2-radius-lg);box-shadow:var(--v2-shadow);padding:var(--v2-space-6);min-width:0;display:grid;align-content:start;gap:var(--v2-space-3)}
.v2-page--b6platform .v2-b6platform-tips-title{margin:0;color:var(--v2-ink);font-size:var(--v2-text-lg);line-height:1.4}
.v2-page--b6platform .v2-b6platform-tips-list{margin:0;padding-left:var(--v2-space-5);display:grid;gap:var(--v2-space-2);color:var(--v2-mut);font-size:var(--v2-text-sm);line-height:1.7}
.v2-page--b6platform button:focus-visible{outline:2px solid var(--v2-brand);outline-offset:2px}
.v2-page--b6platform a:focus-visible{outline:2px solid var(--v2-brand);outline-offset:2px}
.v2-page--b6platform input:focus-visible{outline:2px solid var(--v2-brand);outline-offset:2px}
@media (max-width:1190px){.v2-page--b6platform .v2-b6platform-layout{grid-template-columns:minmax(0,1fr) 250px}.v2-page--b6platform .v2-b6platform-card{padding:var(--v2-space-5)}}
@media (max-width:900px){.v2-page--b6platform .v2-b6platform-layout{grid-template-columns:1fr}.v2-page--b6platform .display-motion{grid-template-columns:1fr}.v2-page--b6platform .quality-options{grid-template-columns:1fr}.v2-page--b6platform .display-help{grid-template-columns:1fr}.v2-page--b6platform .v2-b6platform-side{grid-template-columns:1fr}}
</style>
