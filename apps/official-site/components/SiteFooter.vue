<script setup lang="ts">
import { footerNavigation } from '~/utils/site-content.mjs'

const { learnerLink } = useOfficialSiteLinks()
</script>

<template>
  <footer class="site-footer">
    <div class="container footer-grid">
      <div class="footer-brand">
        <NuxtLink class="brand brand-footer" to="/">
          <span class="brand-mark" aria-hidden="true">语</span>
          <span class="brand-copy">
            <strong>语学星</strong>
            <small>ENGLISHFLOW</small>
          </span>
        </NuxtLink>
        <p>让每一次学习都走向下一步。</p>
        <a class="footer-learning-link" :href="learnerLink('/learn', { source: 'official-footer' })">打开学习 Web →</a>
      </div>

      <div v-for="group in footerNavigation" :key="group.title" class="footer-column">
        <h2>{{ group.title }}</h2>
        <ul>
          <li v-for="link in group.links" :key="link.to">
            <NuxtLink :to="link.to">{{ link.label }}</NuxtLink>
          </li>
        </ul>
      </div>
    </div>
    <div class="container footer-bottom">
      <span>© {{ new Date().getFullYear() }} 语学星 EnglishFlow</span>
      <span>公开页面不承载登录后学习业务</span>
    </div>
  </footer>
</template>
