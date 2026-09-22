<script setup lang="ts">
import ExperienceHeader from '../components/ExperienceHeader.vue'
import { onMounted, onUnmounted } from 'vue'
import { useB11Store } from '../stores/b11'

const store = useB11Store()
onMounted(() => { void store.loadPreferences(); void store.pull() })
onUnmounted(() => store.dispose())
function toggle(channel: 'IN_APP' | 'EMAIL' | 'PUSH'): void { if (!store.preference) return; const enabled = store.preference.enabledChannels.includes(channel); const next = enabled ? store.preference.enabledChannels.filter((item) => item !== channel) : [...store.preference.enabledChannels, channel]; void store.savePreferences({ ...store.preference, enabledChannels: next }) }
</script>

<template>
  <section class="b11-page"><ExperienceHeader page="Sync" icon="monitor" title-id="b11-sync-title" /><div class="b11-sync-grid"><article class="b11-panel"><p class="eyebrow">NOTIFICATION PREFERENCES</p><h3>通知偏好</h3><button v-for="channel in ['IN_APP', 'EMAIL', 'PUSH']" :key="channel" type="button" :class="{ active: store.preference?.enabledChannels.includes(channel as 'IN_APP' | 'EMAIL' | 'PUSH') }" @click="toggle(channel as 'IN_APP' | 'EMAIL' | 'PUSH')">{{ channel }} · {{ store.preference?.enabledChannels.includes(channel as 'IN_APP' | 'EMAIL' | 'PUSH') ? '已开启' : '已关闭' }}</button><p class="b11-note">版本 {{ store.preference?.version ?? '读取中' }} · UI locale 与 contentLocale 分离</p></article><article class="b11-panel"><p class="eyebrow">OFFLINE RECOVERY</p><h3>同步状态</h3><dl><div><dt>状态</dt><dd>{{ store.status }}</dd></div><div><dt>cursor</dt><dd>{{ store.cursor }}</dd></div><div><dt>待同步</dt><dd>{{ store.pending.length }}</dd></div><div><dt>冲突</dt><dd>{{ store.lastSync?.conflicts.length ?? 0 }}</dd></div></dl><button class="b11-primary" type="button" @click="void store.sync()">重试同步</button><p role="status" class="b11-note">{{ store.message }}</p></article></div></section>
</template>

<style scoped>
.b11-page{display:grid;gap:24px}.b11-hero{display:grid;gap:8px}.b11-hero h2{margin:0;font-size:clamp(28px,4vw,46px);letter-spacing:-.04em}.b11-hero p{max-width:760px;color:var(--yx-text-secondary)}.b11-sync-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.b11-panel{display:grid;gap:14px;padding:20px;border:1px solid var(--yx-border);border-radius:var(--yx-radius-card);background:var(--yx-surface-card);box-shadow:var(--yx-shadow-sm)}.b11-panel h3{margin:0}.b11-panel button{padding:10px 14px;border:1px solid var(--yx-border);border-radius:var(--yx-radius-button);background:var(--yx-surface-card);color:var(--yx-text-primary);cursor:pointer;text-align:left}.b11-panel button.active{border-color:var(--yx-brand-primary);background:var(--yx-surface-muted)}.b11-primary{background:var(--yx-brand-primary)!important;color:var(--yx-on-brand)!important;border-color:var(--yx-brand-primary)!important}.b11-note{margin:0;color:var(--yx-text-secondary);font-size:13px;line-height:1.6}dl{display:grid;gap:8px;margin:0}dl div{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--yx-border)}dt{color:var(--yx-text-secondary)}dd{margin:0;font-weight:600}@media(max-width:720px){.b11-sync-grid{grid-template-columns:1fr}}
</style>
