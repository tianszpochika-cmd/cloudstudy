<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { adminT } from '../platform/admin-i18n'
import { adminI18n, adminI18nAdapter } from '../platform/v2-foundation'

/**
 * B4-09 admin UI locale switcher (UI only).
 *
 * Switches the shared UI `locale` through the persisted adapter; the content
 * and learning language `contentLocale` is never touched here. French/German
 * are skeleton locales — untranslated keys fall back to zh-CN without
 * crashing (see @englishflow/i18n starter-locales).
 */

const localeOptions = computed(() => [
  { value: 'zh-CN', label: adminT('localeSwitcher.zh') },
  { value: 'en-US', label: adminT('localeSwitcher.en') },
  { value: 'fr', label: adminT('localeSwitcher.fr') },
  { value: 'de', label: adminT('localeSwitcher.de') },
])

const current = ref(adminI18n.locale)
const contentLocale = ref(adminI18n.contentLocale)
const unsubscribe = adminI18n.subscribe((state) => {
  current.value = state.locale
  contentLocale.value = state.contentLocale
})
onUnmounted(unsubscribe)

const label = computed(() => {
  const found = localeOptions.value.find((option) => option.value === current.value)
  return found ? found.label : current.value
})

function switchLocale(value: string): void {
  adminI18nAdapter.setLocale(value)
}
</script>

<template>
  <el-dropdown trigger="click" @command="switchLocale">
    <button class="admin-icon-button" type="button" :aria-label="adminT('localeSwitcher.ariaLabel', { label: label, contentLocale: contentLocale })">
      <span aria-hidden="true">{{ adminT('localeSwitcher.iconMark') }}</span><span class="admin-locale-tag">{{ current }}</span>
    </button>
    <template #dropdown>
      <el-dropdown-menu>
        <el-dropdown-item v-for="option in localeOptions" :key="option.value" :command="option.value" :disabled="option.value === current">
          {{ option.label }}
        </el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
</template>

<style scoped>
.admin-locale-tag { font-size: 10px; opacity: 0.75; }
</style>
