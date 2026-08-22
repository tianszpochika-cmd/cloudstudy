<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { renderOfficialSiteTokenStyle } from '~/utils/design-system'
import { officialI18nAdapter, officialThemeAdapter, officialThemeController } from '~/utils/v2-foundation'

const uiLocale = ref(officialI18nAdapter.state.locale)
const contentLocale = ref(officialI18nAdapter.state.contentLocale)
const unsubscribeLocale = officialI18nAdapter.subscribe((state) => {
  uiLocale.value = state.locale
  contentLocale.value = state.contentLocale
})

onMounted(() => {
  officialI18nAdapter.restore()
  officialThemeController.restore()
})

onBeforeUnmount(unsubscribeLocale)

useHead({
  htmlAttrs: {
    lang: computed(() => uiLocale.value),
    'data-ui-locale': computed(() => uiLocale.value),
    'data-content-locale': computed(() => contentLocale.value),
  },
  style: [
    {
      id: 'englishflow-official-site-tokens',
      children: `:root{${renderOfficialSiteTokenStyle()}}`,
    },
  ],
  script: [{ id: 'englishflow-official-theme-bootstrap', children: officialThemeAdapter.noFlashScript }],
})
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
