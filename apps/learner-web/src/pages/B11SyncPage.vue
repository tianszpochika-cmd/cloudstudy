<script setup lang="ts">
import ExperienceHeader from '../components/ExperienceHeader.vue'
import { onMounted, onUnmounted } from 'vue'
import { RouterLink } from 'vue-router'
import { useB11Store } from '../stores/b11'

const store = useB11Store()
onMounted(() => { void store.pull() })
onUnmounted(() => store.dispose())
</script>

<template>
  <section class="b11-page v2-page v2-page--b11sync"><ExperienceHeader class="v2-b11sync-head" page="Sync" icon="monitor" title-id="b11-sync-title" /><div class="v2-b11sync-body"><div class="v2-b11sync-main"><div class="b11-sync-grid v2-b11sync-grid"><article class="b11-panel v2-b11sync-panel"><p class="eyebrow">通知偏好<span class="v2-sr-only">通知偏好</span></p><h3>通知偏好</h3><p class="b11-note">通知按类别和渠道管理。</p><RouterLink class="b11-link" to="/settings/notifications">打开通知设置</RouterLink></article><article class="b11-panel v2-b11sync-panel"><p class="eyebrow">离线恢复<span class="v2-sr-only">离线恢复</span></p><h3>同步状态</h3><dl><div><dt>状态</dt><dd>{{ ({ idle: '空闲', ready: '就绪', loading: '加载中', recovering: '恢复中', offline: '离线', error: '同步异常', empty: '暂无数据', permission: '无权限', expired: '已过期', revoked: '已撤销' } as Record<string, string>)[store.status] ?? '未知状态' }}<span class="v2-sr-only">（{{ store.status }}）</span></dd></div><div><dt>同步位置<span class="v2-sr-only">cursor</span></dt><dd>{{ store.cursor ? '已记录' : '暂无' }}<span class="v2-sr-only">（{{ store.cursor }}）</span></dd></div><div><dt>待同步</dt><dd>{{ store.pending.length }}</dd></div><div><dt>冲突</dt><dd>{{ store.lastSync?.conflicts.length ?? 0 }}</dd></div></dl><button class="b11-primary" type="button" @click="void store.sync()">重试同步</button><p role="status" class="b11-note">{{ store.message }}</p></article></div></div><aside class="v2-b11sync-rail" aria-label="同步提示"><h2>同步说明</h2><ol><li>待同步和冲突数量在这里查看。</li><li>同步失败可点重试同步。</li><li>通知偏好去系统设置里调整。</li></ol></aside></div></section>
</template>

<style scoped>
.b11-page{display:grid;gap:24px}.b11-hero{display:grid;gap:8px}.b11-hero h2{margin:0;font-size:clamp(28px,4vw,46px);letter-spacing:-.04em}.b11-hero p{max-width:760px;color:var(--yx-text-secondary)}.b11-sync-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.b11-panel{display:grid;gap:14px;padding:20px;border:1px solid var(--yx-border);border-radius:var(--yx-radius-card);background:var(--yx-surface-card);box-shadow:var(--yx-shadow-sm)}.b11-panel h3{margin:0}.b11-panel button{padding:10px 14px;border:1px solid var(--yx-border);border-radius:var(--yx-radius-button);background:var(--yx-surface-card);color:var(--yx-text-primary);cursor:pointer;text-align:left}.b11-panel button.active{border-color:var(--yx-brand-primary);background:var(--yx-surface-muted)}.b11-primary{background:var(--yx-brand-primary)!important;color:var(--yx-on-brand)!important;border-color:var(--yx-brand-primary)!important}.b11-note{margin:0;color:var(--yx-text-secondary);font-size:13px;line-height:1.6}dl{display:grid;gap:8px;margin:0}dl div{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--yx-border)}dt{color:var(--yx-text-secondary)}dd{margin:0;font-weight:600}@media(max-width:720px){.b11-sync-grid{grid-template-columns:1fr}}
.b11-link{width:fit-content;color:var(--yx-brand-primary);text-decoration:none}
</style>

<style>
/* B11Sync v2 页面级样式（只做样式）：对齐 webDemo“专项练习会话（左主练习卡 + 右侧提示栏）”原型。
 * 选择器全部以 .v2-page--b11sync 开头；颜色只用 --v2-* tokens，不写死色值以适配暗色。 */
.v2-page--b11sync{background:var(--v2-bg);color:var(--v2-ink);font-family:var(--v2-font);display:grid;gap:var(--v2-space-5);align-items:start}
.v2-page--b11sync .v2-b11sync-head{min-width:0}
.v2-page--b11sync .v2-b11sync-body{display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:var(--v2-space-5);align-items:start;min-width:0}
.v2-page--b11sync .v2-b11sync-main{display:grid;gap:var(--v2-space-5);min-width:0}
.v2-page--b11sync .v2-b11sync-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--v2-space-5);align-items:start;min-width:0}
.v2-page--b11sync .v2-b11sync-panel,.v2-page--b11sync .v2-b11sync-rail{background:var(--v2-card);border:1px solid var(--v2-line);border-radius:var(--v2-radius-lg);box-shadow:var(--v2-shadow);padding:var(--v2-space-6);min-width:0}
.v2-page--b11sync .v2-b11sync-panel{display:grid;gap:var(--v2-space-4);align-content:start}
.v2-page--b11sync .v2-b11sync-panel h3{margin:0;font-size:var(--v2-text-lg);color:var(--v2-ink);line-height:1.4}
.v2-page--b11sync .eyebrow{margin:0;color:var(--v2-brand);font-size:var(--v2-text-xs);font-weight:800;letter-spacing:.12em}
.v2-page--b11sync .b11-note{margin:0;color:var(--v2-mut);font-size:var(--v2-text-sm);line-height:1.6}
.v2-page--b11sync dl{display:grid;gap:var(--v2-space-2);margin:0}
.v2-page--b11sync dl div{display:flex;justify-content:space-between;align-items:baseline;gap:var(--v2-space-3);padding:var(--v2-space-2) 0;border-bottom:1px solid var(--v2-line)}
.v2-page--b11sync dt{color:var(--v2-mut);font-size:var(--v2-text-sm)}
.v2-page--b11sync dd{margin:0;font-weight:700;color:var(--v2-ink);font-size:var(--v2-text-sm)}
.v2-page--b11sync .b11-link{width:fit-content;color:var(--v2-brand);font-weight:700;text-decoration:none;font-size:var(--v2-text-sm)}
.v2-page--b11sync .b11-link:hover{color:var(--v2-brand2);text-decoration:underline}
.v2-page--b11sync .b11-primary{min-height:40px;padding:0 var(--v2-space-4);border:1px solid var(--v2-brand);border-radius:var(--v2-radius-sm);background:var(--v2-brand);color:var(--v2-inverse);font-weight:750;cursor:pointer;justify-self:start}
.v2-page--b11sync .b11-primary:hover:not(:disabled){background:var(--v2-brand2);border-color:var(--v2-brand2)}
.v2-page--b11sync .b11-primary:disabled{opacity:.5;cursor:not-allowed}
.v2-page--b11sync .progress{height:6px;border-radius:var(--v2-radius-pill);background:var(--v2-surface);overflow:hidden}
.v2-page--b11sync .progress span{display:block;height:100%;background:var(--v2-brand)}
.v2-page--b11sync .v2-b11sync-rail{position:sticky;top:var(--v2-space-6);display:grid;align-content:start;gap:var(--v2-space-3)}
.v2-page--b11sync .v2-b11sync-rail h2{margin:0;font-size:var(--v2-text-lg);color:var(--v2-ink)}
.v2-page--b11sync .v2-b11sync-rail ol{margin:0;padding-left:var(--v2-space-5);display:grid;gap:var(--v2-space-2);color:var(--v2-mut);font-size:var(--v2-text-sm);line-height:1.7}
.v2-page--b11sync button:focus-visible,.v2-page--b11sync a:focus-visible{outline:2px solid var(--v2-brand);outline-offset:2px}
@media(max-width:1190px){.v2-page--b11sync .v2-b11sync-body{grid-template-columns:minmax(0,1fr) 250px}}
@media(max-width:900px){.v2-page--b11sync .v2-b11sync-body{grid-template-columns:1fr}.v2-page--b11sync .v2-b11sync-grid{grid-template-columns:1fr}.v2-page--b11sync .v2-b11sync-rail{position:static}}
</style>
