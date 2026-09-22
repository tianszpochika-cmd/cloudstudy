<script setup lang="ts">
import { delayedVerifyLabel, masteryLabel, type SrsSummary } from '../../domain/b2'

defineProps<{ srs: SrsSummary | null }>()
</script>

<template>
  <div v-if="srs" class="srs-badge" aria-label="记忆状态">
    <span class="srs-badge__status">{{ masteryLabel(srs.masteryStatus) }}</span>
    <span v-if="srs.riskBand === 'HIGH'" class="srs-badge__risk">高风险</span>
    <span class="srs-badge__next">{{ srs.nextReviewLocalDate ? `下次复习：${srs.nextReviewLocalDate}` : '暂无下次复习日期' }}</span>
    <span v-if="srs.delayedVerifyStage !== 'NONE'" class="srs-badge__verify">{{ delayedVerifyLabel(srs.delayedVerifyStage) }}</span>
  </div>
  <span v-else class="srs-badge srs-badge--unknown">服务端未返回记忆状态</span>
</template>

<style scoped>
.srs-badge { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; color: var(--yx-color-text-secondary); font-size: 12px; }
.srs-badge__status, .srs-badge__risk, .srs-badge__verify { padding: 5px 9px; border-radius: 999px; font-weight: 700; }
.srs-badge__status { color: var(--yx-color-brand-primary); background: var(--yx-color-brand-primary-soft); }
.srs-badge__risk { color: var(--yx-color-warning); background: var(--yx-color-warning-soft); }
.srs-badge__verify { color: var(--yx-color-success); background: var(--yx-color-success-soft); }
.srs-badge__next { color: var(--yx-color-text-secondary); }
.srs-badge--unknown { display: inline-flex; padding: 5px 9px; border-radius: 999px; background: var(--yx-color-surface-muted); }
</style>
