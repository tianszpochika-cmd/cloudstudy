<script setup lang="ts">
import { useRouter } from 'vue-router'

export interface BridgeCourse {
  code: string
  title: string
  summary: string
  level: string
}

defineProps<{ courses: BridgeCourse[] }>()

const router = useRouter()
function openCourse(code: string): void {
  void router.push({ name: 'learn-session', query: { contentId: code } })
}
</script>

<template>
  <section class="bridge-panel" aria-label="可学课程">
    <div class="bridge-heading">
      <p class="eyebrow">CANONICAL / 可学内容</p>
      <h3>先从这节开始学</h3>
      <p>专项练习库正在准备中，以下正典课程可以直接学习，进度会正常记录。</p>
    </div>
    <div class="bridge-list">
      <button v-for="course in courses" :key="course.code" type="button" class="bridge-course" @click="openCourse(course.code)">
        <span class="bridge-level">{{ course.level }}</span>
        <strong>{{ course.title }}</strong>
        <small>{{ course.summary }}</small>
        <span class="bridge-go">开始这一课 →</span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.bridge-panel{display:grid;gap:14px;padding:22px;border:1px solid var(--yx-color-border);border-radius:var(--yx-radius-card);background:var(--yx-color-surface-card);box-shadow:var(--yx-shadow-card)}
.bridge-heading h3{margin:6px 0;font-size:22px}
.bridge-heading p{margin:0;color:var(--yx-color-text-secondary);line-height:1.6}
.eyebrow{margin:0;color:var(--yx-color-brand-primary);font-size:12px;font-weight:800;letter-spacing:.12em}
.bridge-list{display:grid;gap:10px}
.bridge-course{display:grid;gap:4px;width:100%;padding:14px 16px;border:1px solid var(--yx-color-border);border-radius:12px;background:var(--yx-color-surface-page);text-align:left;color:var(--yx-color-text-primary)}
.bridge-course:hover{border-color:var(--yx-color-brand-primary)}
.bridge-level{color:var(--yx-color-text-secondary);font-size:11px}
.bridge-course small{color:var(--yx-color-text-secondary)}
.bridge-go{color:var(--yx-color-brand-primary);font-weight:700}
</style>
