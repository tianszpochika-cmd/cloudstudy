<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import EmptyState from '../components/EmptyState.vue'
import { useLearnerContentStore } from '../stores/learner-content'

const router = useRouter()
const store = useLearnerContentStore()
const content = computed(() => store.home?.content ?? [])
const contentStatus = computed(() => store.home?.contentStatus ?? 'EMPTY')

onMounted(() => { store.restore(); void store.loadHome() })
function retry(): void { void store.retry('home') }
function openCourse(contentId: string): void { void router.push({ name: 'learn-session', query: { contentId } }) }
</script>

<template>
  <section class="page-stack" aria-labelledby="courses-title">
    <header class="page-heading"><div><p class="eyebrow">B18 · CONTENT PROJECTION</p><h2 id="courses-title">课程与学习内容</h2><p>仅展示当前主体有权访问且已发布的内容版本；下线、权限和服务故障都有明确恢复路径。</p></div><span class="locale-pill">内容语言：{{ store.home?.contentLocale ?? 'en-US' }}</span></header>
    <div v-if="store.homeStatus === 'loading'" class="info-card"><h3>正在加载课程…</h3><p>正在读取 learner/content Gateway 投影。</p></div>
    <div v-else-if="store.homeStatus === 'forbidden'" class="info-card state-card"><h3>暂无访问权限</h3><p>当前课程权限由服务端策略决定。</p><button class="button button--secondary" type="button" @click="router.push({ name: 'login' })">重新登录</button></div>
    <div v-else-if="contentStatus === 'UNAVAILABLE' || store.homeStatus === 'offline'" class="info-card state-card"><h3>课程服务正在恢复</h3><p>已保留课程入口，不会把服务异常显示成空课程。</p><button class="button button--secondary" type="button" @click="retry">重试</button></div>
    <EmptyState v-else-if="!content.length" title="暂无已发布课程" description="可能是内容尚未发布、权益尚未生效或当前筛选没有结果。" />
    <div v-else class="course-grid"><button v-for="item in content" :key="item.contentId" class="course-card" type="button" @click="openCourse(item.contentId)"><span class="card-kicker">{{ item.kind }}</span><h3>{{ item.title }}</h3><p>{{ item.description || '由服务端内容投影提供课程摘要。' }}</p><small>{{ item.contentLocale }} · {{ item.status }}</small></button></div>
    <p v-if="store.lastError" class="error-text" role="alert">{{ store.lastError }}</p>
  </section>
</template>

<style scoped>
.page-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:20px}.page-heading h2{margin:8px 0;font-size:clamp(30px,5vw,48px);line-height:1.1}.page-heading p:not(.eyebrow){max-width:720px;margin:0;color:var(--yx-color-text-secondary);line-height:1.7}.locale-pill{padding:9px 12px;border:1px solid var(--yx-color-border);border-radius:999px;color:var(--yx-color-text-secondary);font-size:12px}.state-card{display:flex;align-items:center;justify-content:space-between;gap:18px;border-color:var(--yx-color-warning)}.course-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.course-card{display:grid;gap:8px;min-height:190px;padding:22px;border:1px solid var(--yx-color-border);border-radius:var(--yx-radius-card);color:inherit;background:var(--yx-color-surface-card);text-align:left;box-shadow:var(--yx-shadow-card);cursor:pointer}.course-card h3,.course-card p{margin:0}.course-card p{color:var(--yx-color-text-secondary);line-height:1.6}.course-card small{color:var(--yx-color-text-secondary)}.error-text{color:var(--yx-color-danger)}@media(max-width:900px){.course-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:640px){.page-heading,.state-card{display:grid;align-items:start}.course-grid{grid-template-columns:1fr}.course-card{min-height:0}}
</style>
