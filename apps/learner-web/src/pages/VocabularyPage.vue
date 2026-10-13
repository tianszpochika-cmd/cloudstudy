<script setup lang="ts">
import ExperienceHeader from '../components/ExperienceHeader.vue'
import { computed, onMounted } from 'vue'
import B10StatePanel from '../components/b10/B10StatePanel.vue'
import { useLearningUi } from '../platform/learning-ui'
import { useB10Store } from '../stores/b10'
import { vocabPlayable } from '../domain/closed-practice'
import type { B10PerformanceLevel, B10ReviewQuality } from '../domain/b10'

import '../platform/b10-i18n'

const ui = useLearningUi()
const store = useB10Store()
const card = computed(() => store.currentCard)
const status = computed(() => store.vocabularyStatus)
const qualityOptions = computed<Array<{ value: B10ReviewQuality; label: string; description: string }>>(() => [
  { value: 0, label: ui.t('b10.vocabulary.forgotten'), description: ui.locale.value === 'zh-CN' ? '完全想不起' : 'Could not recall' },
  { value: 1, label: ui.t('b10.vocabulary.vague'), description: ui.locale.value === 'zh-CN' ? '需要提示' : 'Needed a hint' },
  { value: 2, label: ui.t('b10.vocabulary.remembered'), description: ui.locale.value === 'zh-CN' ? '顺利想起' : 'Recalled it' },
  { value: 3, label: ui.t('b10.vocabulary.fluent'), description: ui.locale.value === 'zh-CN' ? '轻而易举' : 'Effortless' },
])

onMounted(() => { store.restore(); void store.loadVocabulary() })
function retry(): void { void store.loadVocabulary() }
function sync(): void { void store.syncOffline() }
function performance(level: B10PerformanceLevel): void { store.setPerformanceLevel(level) }
function rate(value: B10ReviewQuality): void { void store.rateCard(value) }
</script>

<template>
  <section class="b10-page v2-page v2-page--vocab" :data-performance="store.performanceLevel" aria-labelledby="vocabulary-title">
    <ExperienceHeader class="v2-vocab-head" page="Vocabulary" icon="cards" title-id="vocabulary-title" />
    <B10StatePanel v-if="status !== 'ready' || store.queueCount" class="v2-vocab-state" :status="status" :message="store.vocabularyMessage" :queue-count="store.queueCount" :cached="store.vocabularyCached" module-label="VOC / SRS" :performance-level="store.performanceLevel" @retry="retry" @sync="sync" @performance="performance" />
    <section v-if="card" class="vocabulary-layout v2-vocab-layout">
      <article class="vocabulary-card v2-vocab-card" :class="{ 'vocabulary-card--static': store.performanceLevel === 'Performance' }" aria-live="polite">
        <div class="card-topline v2-vocab-topline"><span>{{ card.position + 1 }}<span v-if="card.total"> / {{ card.total }}</span></span><span>{{ ({ NEW: '新', LEARNING: '学习中', SHORT_TERM: '短期稳固', CONSOLIDATING: '巩固中', MASTERED: '已通过复查', CONSOLIDATED: '长期稳固', AT_RISK: '即将遗忘', SUSPENDED: '已暂停' } as Record<string, string>)[card.srs?.masteryStatus ?? 'NEW'] ?? card.srs?.masteryStatus ?? '新' }} · {{ ({ NONE: '暂无延迟复测', D1_PENDING: '等待 D+1 复测', D7_PENDING: '等待 D+7 复测', PASSED: '延迟复测通过', FAILED: '延迟复测未通过' } as Record<string, string>)[card.srs?.delayedVerifyStage ?? 'NONE'] ?? card.srs?.delayedVerifyStage ?? '暂无延迟复测' }}</span></div>
        <section v-if="store.cardPhase === 'FRONT' || store.cardPhase === 'REVEALING'" class="card-front v2-vocab-front" aria-label="词卡正面">
          <span class="eyebrow">{{ ui.t('b10.vocabulary.recall') }}</span><h3>{{ card.title }}</h3><div class="phonetics"><span v-if="card.phoneticUs">US {{ card.phoneticUs }}</span><span v-if="card.phoneticUk">UK {{ card.phoneticUk }}</span></div><audio v-if="vocabPlayable(card.audioUrl)" data-vocab-play :src="card.audioUrl ?? undefined" controls></audio><p v-else data-vocab-silent>没有发音，不能播放。</p><p v-if="card.frontHint">{{ card.frontHint }}</p><p class="muted">{{ ui.t('b10.vocabulary.frontOnly') }}</p><button class="primary-button" type="button" :disabled="store.cardPhase !== 'FRONT'" @click="store.revealCard">{{ store.cardPhase === 'REVEALING' ? ui.t('b10.vocabulary.revealing') : ui.t('b10.vocabulary.reveal') }}</button>
        </section>
        <section v-else-if="store.cardPhase === 'BACK' || store.cardPhase === 'SUBMITTING' || store.cardPhase === 'PENDING_SYNC' || store.cardPhase === 'SYNCED'" class="card-back v2-vocab-back" aria-label="词卡内容">
          <span class="eyebrow">{{ ui.t('b10.vocabulary.confidence') }}</span><h3>{{ card.title }}</h3><div class="meaning"><strong>{{ card.back?.meaningCn ?? '—' }}</strong><span v-if="card.back?.partOfSpeech">{{ ({ noun: '名词', 'n.': '名词', verb: '动词', 'v.': '动词', adjective: '形容词', 'adj.': '形容词', adverb: '副词', 'adv.': '副词', pronoun: '代词', preposition: '介词', 'prep.': '介词', conjunction: '连词', 'conj.': '连词', interjection: '感叹词', article: '冠词', numeral: '数词', determiner: '限定词', auxiliary: '助动词', modal: '情态动词', phrase: '短语', idiom: '习语', expression: '表达', chunk: '语块' } as Record<string, string>)[(card.back.partOfSpeech ?? '').toLowerCase()] ?? card.back.partOfSpeech }}</span></div><p v-if="card.back?.definitionEn">{{ card.back.definitionEn }}</p><ul v-if="card.back?.examples.length" class="examples"><li v-for="example in card.back.examples" :key="example.sentence"><span>{{ example.sentence }}</span><small v-if="example.translation">{{ example.translation }}</small></li></ul><p v-if="card.back?.collocations.length" class="muted">{{ card.back.collocations.join(' · ') }}</p><p v-if="card.back?.rootSummary" class="muted">{{ card.back.rootSummary }}</p>
          <div class="ratings" :aria-label="ui.t('b10.vocabulary.confidence')"><button v-for="option in qualityOptions" :key="option.value" class="rating" :disabled="store.cardPhase !== 'BACK'" type="button" @click="rate(option.value)"><strong>{{ option.value }} · {{ option.label }}</strong><small>{{ option.description }}</small></button></div>
          <p v-if="store.cardPhase === 'PENDING_SYNC'" class="notice">{{ ui.t('b10.vocabulary.pending') }}</p><p v-if="store.cardPhase === 'SYNCED'" class="notice">{{ ui.t('b10.vocabulary.complete') }}</p>
        </section>
        <section v-else class="card-error" role="alert"><strong>{{ ui.t('b10.state.stale') }}</strong><p>{{ store.vocabularyMessage ?? ui.t('b10.vocabulary.recovery') }}</p><button class="primary-button" type="button" @click="retry">{{ ui.t('b10.common.retry') }}</button></section>
      </article>
      <aside class="side-panel v2-vocab-side"><h3>{{ ui.t('b10.vocabulary.title') }}</h3><p>{{ card.position + 1 }} / {{ card.total || store.cards.length }}</p><p v-if="card.srs?.dueLocalDate">到期：{{ card.srs.dueLocalDate }}</p><p v-if="card.srs?.nextReviewLocalDate">下次复习：{{ card.srs.nextReviewLocalDate }}</p><p>复习次数：{{ card.srs?.reviewCount ?? 0 }}</p><p class="v2-sr-only">{{ ui.t('b10.common.version', { version: card.contentVersionId ?? '—' }) }}</p><button class="secondary-button" type="button" @click="sync">{{ ui.t('b10.common.sync') }}（{{ store.queueCount }}）</button></aside>
    </section>
    <section v-else-if="status === 'empty'" class="empty-panel v2-vocab-empty"><strong>{{ ui.t('b10.vocabulary.empty') }}</strong><p>{{ ui.t('b10.state.empty') }}</p></section>
  </section>
</template>

<style scoped>
.b10-page{display:grid;gap:22px}.page-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:20px}.page-heading h2{margin:8px 0;font-size:clamp(30px,5vw,48px);line-height:1.1}.page-heading p:not(.eyebrow){max-width:680px;margin:0;color:var(--yx-color-text-secondary);line-height:1.7}.eyebrow{margin:0;color:var(--yx-color-brand-primary);font-size:12px;font-weight:800;letter-spacing:.12em}.locale-pill{padding:9px 12px;border:1px solid var(--yx-color-border);border-radius:999px;color:var(--yx-color-text-secondary);font-size:12px}.vocabulary-layout{display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:20px}.vocabulary-card,.side-panel,.empty-panel{padding:26px;border:1px solid var(--yx-color-border);border-radius:var(--yx-radius-card);background:var(--yx-color-surface-card);box-shadow:var(--yx-shadow-card)}.vocabulary-card:not(.vocabulary-card--static){transition:transform 180ms ease,box-shadow 180ms ease}.card-topline{display:flex;justify-content:space-between;gap:12px;color:var(--yx-color-text-secondary);font-size:13px}.card-front,.card-back,.card-error{display:grid;gap:16px;align-content:center;min-height:430px;max-width:700px;margin:0 auto;text-align:center}.card-front h3,.card-back h3{margin:0;font-size:clamp(42px,8vw,74px);line-height:1.05;letter-spacing:-.04em}.phonetics,.meaning{display:flex;flex-wrap:wrap;justify-content:center;gap:10px;color:var(--yx-color-text-secondary)}.meaning{align-items:baseline;color:var(--yx-color-text-primary);font-size:24px}.meaning span{color:var(--yx-color-brand-primary);font-size:13px}.muted,.card-back p{margin:0;color:var(--yx-color-text-secondary);line-height:1.7}.primary-button,.secondary-button{min-height:44px;padding:0 16px;border:0;border-radius:12px;font-weight:800}.primary-button{color:var(--yx-color-text-on-brand);background:var(--yx-color-brand-primary)}.secondary-button{border:1px solid var(--yx-color-border);color:var(--yx-color-brand-primary);background:var(--yx-color-surface-page)}button:disabled{cursor:wait;opacity:.55}.examples{display:grid;gap:10px;margin:0;padding:0;list-style:none;text-align:left}.examples li{display:grid;gap:4px;padding:12px 14px;border-radius:12px;background:var(--yx-color-surface-muted)}.examples small{color:var(--yx-color-text-secondary)}.ratings{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.rating{display:grid;gap:4px;min-height:64px;padding:8px;border:1px solid var(--yx-color-border);border-radius:12px;color:var(--yx-color-text-primary);background:var(--yx-color-surface-page)}.rating:hover{border-color:var(--yx-color-brand-primary);color:var(--yx-color-brand-primary);background:var(--yx-color-brand-primary-soft)}.rating small{color:var(--yx-color-text-secondary);font-size:11px}.notice{padding:10px 12px;border-radius:10px;color:var(--yx-color-warning);background:var(--yx-color-surface-muted)}.card-error p{color:var(--yx-color-text-secondary)}.side-panel{display:grid;align-content:start;gap:10px;height:max-content}.side-panel h3{margin:0}.side-panel p{margin:0;color:var(--yx-color-text-secondary);line-height:1.6}.empty-panel{min-height:160px}.empty-panel p{color:var(--yx-color-text-secondary)}
@media(max-width:800px){.page-heading{align-items:flex-start;flex-direction:column}.vocabulary-layout{grid-template-columns:1fr}.side-panel{order:-1}.ratings{grid-template-columns:repeat(2,minmax(0,1fr))}.vocabulary-card{padding:20px 16px}}
</style>

<style>
.v2-page--vocab { display: grid; gap: var(--v2-space-6); font-family: var(--v2-font); }
.v2-page--vocab .v2-vocab-head { min-width: 0; }
.v2-page--vocab .v2-vocab-state { min-width: 0; }
.v2-page--vocab .v2-vocab-layout { display: grid; grid-template-columns: minmax(0, 1fr) 280px; gap: var(--v2-space-6); align-items: start; }
.v2-page--vocab .v2-vocab-card { grid-column: 1; background: var(--v2-card); border: 1px solid var(--v2-line); border-radius: var(--v2-radius-lg); box-shadow: var(--v2-shadow); padding: var(--v2-space-6); min-width: 0; }
.v2-page--vocab .v2-vocab-side { grid-column: 2; grid-row: 1; position: sticky; top: var(--v2-space-6); display: grid; align-content: start; gap: var(--v2-space-2); height: max-content; background: var(--v2-card); border: 1px solid var(--v2-line); border-radius: var(--v2-radius-lg); box-shadow: var(--v2-shadow); padding: var(--v2-space-5); min-width: 0; }
.v2-page--vocab .v2-vocab-empty { background: var(--v2-card); border: 1px solid var(--v2-line); border-radius: var(--v2-radius-lg); box-shadow: var(--v2-shadow); padding: var(--v2-space-8); min-width: 0; display: grid; gap: var(--v2-space-3); min-height: 160px; align-content: center; text-align: center; }
.v2-page--vocab .v2-vocab-empty strong { color: var(--v2-ink); font-size: var(--v2-text-lg); }
.v2-page--vocab .v2-vocab-empty p { margin: 0; color: var(--v2-mut); font-size: var(--v2-text-sm); line-height: 1.7; }
.v2-page--vocab .v2-vocab-topline { display: flex; justify-content: space-between; align-items: center; gap: var(--v2-space-3); color: var(--v2-mut); font-size: var(--v2-text-sm); }
.v2-page--vocab .v2-vocab-topline span:last-child { display: inline-flex; align-items: center; border-radius: var(--v2-radius-pill); background: var(--v2-soft); color: var(--v2-brand); font-size: var(--v2-text-xs); font-weight: 700; padding: var(--v2-space-1) var(--v2-space-3); white-space: nowrap; }
.v2-page--vocab .v2-vocab-front { display: grid; gap: var(--v2-space-4); align-content: center; min-height: 430px; max-width: 700px; margin: 0 auto; text-align: center; }
.v2-page--vocab .v2-vocab-back { display: grid; gap: var(--v2-space-4); align-content: center; min-height: 430px; max-width: 700px; margin: 0 auto; text-align: center; }
.v2-page--vocab .v2-vocab-front h3 { margin: 0; color: var(--v2-ink); font-size: clamp(32px, 6vw, 56px); line-height: 1.05; letter-spacing: -0.04em; }
.v2-page--vocab .v2-vocab-back h3 { margin: 0; color: var(--v2-ink); font-size: clamp(32px, 6vw, 56px); line-height: 1.05; letter-spacing: -0.04em; }
.v2-page--vocab .eyebrow { margin: 0; color: var(--v2-brand); font-size: var(--v2-text-xs); font-weight: 800; letter-spacing: 0.12em; }
.v2-page--vocab .phonetics { display: flex; flex-wrap: wrap; justify-content: center; gap: var(--v2-space-2); color: var(--v2-mut); font-size: var(--v2-text-sm); }
.v2-page--vocab .meaning { display: flex; flex-wrap: wrap; justify-content: center; align-items: baseline; gap: var(--v2-space-2); color: var(--v2-ink); font-size: var(--v2-text-lg); }
.v2-page--vocab .meaning span { border-radius: var(--v2-radius-pill); background: var(--v2-soft); color: var(--v2-brand); font-size: var(--v2-text-xs); font-weight: 700; padding: var(--v2-space-1) var(--v2-space-3); }
.v2-page--vocab .muted { margin: 0; color: var(--v2-mut); font-size: var(--v2-text-sm); line-height: 1.7; }
.v2-page--vocab .v2-vocab-front p { margin: 0; color: var(--v2-mut); font-size: var(--v2-text-sm); line-height: 1.7; }
.v2-page--vocab .v2-vocab-back p { margin: 0; color: var(--v2-mut); font-size: var(--v2-text-sm); line-height: 1.7; }
.v2-page--vocab audio { width: 100%; }
.v2-page--vocab .examples { display: grid; gap: var(--v2-space-2); margin: 0; padding: 0; list-style: none; text-align: left; }
.v2-page--vocab .examples li { display: grid; gap: var(--v2-space-1); padding: var(--v2-space-3) var(--v2-space-4); border-radius: var(--v2-radius-md); background: var(--v2-surface); color: var(--v2-ink); font-size: var(--v2-text-sm); line-height: 1.6; }
.v2-page--vocab .examples small { color: var(--v2-mut); font-size: var(--v2-text-xs); }
.v2-page--vocab .ratings { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--v2-space-2); }
.v2-page--vocab .rating { display: grid; gap: var(--v2-space-1); min-height: 64px; padding: var(--v2-space-2); border: 1px solid var(--v2-line); border-radius: var(--v2-radius-md); color: var(--v2-ink); background: var(--v2-card); font-size: var(--v2-text-sm); cursor: pointer; }
.v2-page--vocab .rating small { color: var(--v2-mut); font-size: var(--v2-text-xs); }
.v2-page--vocab .rating:hover { border-color: var(--v2-brand); color: var(--v2-brand); background: var(--v2-soft); }
.v2-page--vocab .rating:disabled { opacity: 0.55; cursor: not-allowed; }
.v2-page--vocab .notice { padding: var(--v2-space-2) var(--v2-space-3); border-radius: var(--v2-radius-md); color: var(--v2-warn); background: var(--v2-warn-soft); font-size: var(--v2-text-sm); }
.v2-page--vocab .primary-button { min-height: 44px; padding: 0 var(--v2-space-4); border: 0; border-radius: var(--v2-radius-md); font-weight: 800; color: var(--v2-inverse); background: var(--v2-brand); }
.v2-page--vocab .secondary-button { min-height: 44px; padding: 0 var(--v2-space-4); border: 1px solid var(--v2-line); border-radius: var(--v2-radius-md); font-weight: 800; color: var(--v2-brand); background: var(--v2-card); }
.v2-page--vocab button:disabled { opacity: 0.55; }
.v2-page--vocab .v2-vocab-side h3 { margin: 0; color: var(--v2-ink); font-size: var(--v2-text-md); line-height: 1.5; }
.v2-page--vocab .v2-vocab-side p { margin: 0; color: var(--v2-mut); font-size: var(--v2-text-sm); line-height: 1.6; }
.v2-page--vocab .v2-sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
.v2-page--vocab .primary-button:focus-visible { outline: 2px solid var(--v2-brand); outline-offset: 2px; }
.v2-page--vocab .secondary-button:focus-visible { outline: 2px solid var(--v2-brand); outline-offset: 2px; }
.v2-page--vocab .rating:focus-visible { outline: 2px solid var(--v2-brand); outline-offset: 2px; }
@media (max-width: 1190px) { .v2-page--vocab .v2-vocab-layout { grid-template-columns: minmax(0, 1fr) 240px; gap: var(--v2-space-5); } .v2-page--vocab .v2-vocab-card { padding: var(--v2-space-5); } .v2-page--vocab .v2-vocab-side { padding: var(--v2-space-4); } }
@media (max-width: 900px) { .v2-page--vocab .v2-vocab-layout { grid-template-columns: 1fr; } .v2-page--vocab .v2-vocab-card { grid-column: 1; padding: var(--v2-space-5) var(--v2-space-4); } .v2-page--vocab .v2-vocab-side { grid-column: 1; grid-row: auto; position: static; } .v2-page--vocab .v2-vocab-front { min-height: 0; } .v2-page--vocab .v2-vocab-back { min-height: 0; } .v2-page--vocab .ratings { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
</style>
