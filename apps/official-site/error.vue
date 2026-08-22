<script setup lang="ts">
defineProps<{
  error: {
    statusCode?: number
    statusMessage?: string
  }
}>()

useHead({
  title: '页面暂时不可用｜语学星 EnglishFlow',
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
})

function goHome() {
  clearError({ redirect: '/' })
}
</script>

<template>
  <div class="error-page">
    <div class="error-page-inner">
      <span class="eyebrow">{{ error.statusCode || 500 }}</span>
      <h1>这一步暂时走不通。</h1>
      <p>{{ error.statusMessage || '公开页面暂时不可用，请返回官网首页继续浏览。' }}</p>
      <button class="button button-primary" type="button" @click="goHome">回到首页</button>
    </div>
  </div>
</template>
