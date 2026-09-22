<script setup lang="ts">
import { computed } from 'vue'

export type AppIconName =
  | 'arrow' | 'chevron' | 'close' | 'menu' | 'bell' | 'sun' | 'route' | 'cards' | 'bookmark' | 'monitor' | 'eye' | 'lock'
  | 'book'
  | 'chart'
  | 'check'
  | 'globe'
  | 'headphones'
  | 'help'
  | 'home'
  | 'mic'
  | 'moon'
  | 'pen'
  | 'search'
  | 'settings'
  | 'spark'
  | 'star'
  | 'target'
  | 'user'
  | 'wallet'

const props = withDefaults(defineProps<{ name?: AppIconName; size?: number }>(), { name: 'spark', size: 18 })

const iconPaths: Record<AppIconName, string[]> = {
  arrow: ['M4 12h15', 'm13 5 7 7-7 7'],
  chevron: ['m9 5 7 7-7 7'],
  close: ['m6 6 12 12', 'M18 6 6 18'],
  menu: ['M4 6h16', 'M4 12h16', 'M4 18h16'],
  bell: ['M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9', 'M10 21h4'],
  sun: ['M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z', 'M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5'],
  route: ['M5 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z', 'M19 22a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z', 'M5 6v7a3 3 0 0 0 3 3h8a3 3 0 0 0 0-6H9', 'M19 16v2'],
  cards: ['M5 6h14v15H5z', 'M8 2h13v15', 'M9 11h6', 'M9 15h4'],
  bookmark: ['M6 3h12v18l-6-4-6 4V3Z'],
  monitor: ['M3 4h18v13H3z', 'M12 17v4', 'M8 21h8'],
  eye: ['M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z'],
  lock: ['M5 10h14v11H5z', 'M8 10V7a4 4 0 0 1 8 0v3', 'M12 14v3'],
  book: ['M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15Z', 'M4 20.5A2.5 2.5 0 0 1 6.5 18H20', 'M8 7h8', 'M8 10h6'],
  chart: ['M4 19V5', 'M4 19h16', 'm7 15 3-4 3 2 4-6'],
  check: ['m5 12 4 4L19 6'],
  globe: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M3 12h18', 'M12 3c2.2 2.4 3.3 5.4 3.3 9s-1.1 6.6-3.3 9c-2.2-2.4-3.3-5.4-3.3-9S9.8 5.4 12 3Z'],
  headphones: ['M4 13v-1a8 8 0 0 1 16 0v1', 'M4 13h3v6H6a2 2 0 0 1-2-2v-4Z', 'M20 13h-3v6h1a2 2 0 0 0 2-2v-4Z'],
  help: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M9.8 9a2.4 2.4 0 1 1 4.2 1.6c-.9.8-2 1.2-2 2.7', 'M12 17h.01'],
  home: ['M3.5 10.5 12 3l8.5 7.5', 'M5.5 9.5V21h13V9.5', 'M9.5 21v-6h5v6'],
  mic: ['M12 15a3 3 0 0 0 3-3V7a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3Z', 'M5 11a7 7 0 0 0 14 0', 'M12 18v3', 'M8 21h8'],
  moon: ['M20.4 14.2A8.7 8.7 0 0 1 9.8 3.6 8.8 8.8 0 1 0 20.4 14.2Z'],
  pen: ['m4 20 4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z', 'm13.5 7.5 3 3'],
  search: ['m20 20-4.3-4.3', 'M10.8 18a7.2 7.2 0 1 0 0-14.4 7.2 7.2 0 0 0 0 14.4Z'],
  settings: ['M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z', 'm19.4 15 .1.1a2 2 0 1 1-2.8 2.8l-.1-.1a2 2 0 0 0-3.4 1.4v.2a2 2 0 1 1-4 0v-.2a2 2 0 0 0-3.4-1.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A2 2 0 0 0 4.5 12a2 2 0 0 0-1.5-1.9 2 2 0 1 1 1.5-3.8 2 2 0 0 0 1.5-1.9 2 2 0 1 1 3.8-1.5 2 2 0 0 0 3.4-1.4v-.2a2 2 0 1 1 4 0v.2a2 2 0 0 0 3.4 1.4 2 2 0 1 1 2.8 2.8l-.1.1A2 2 0 0 0 19.5 8c0 .9.6 1.7 1.5 1.9a2 2 0 1 1-1.5 3.8 2 2 0 0 0-.1 1.3Z'],
  spark: ['M12 2.5 14.2 9l6.3 2.2-6.3 2.2L12 20l-2.2-6.6-6.3-2.2L9.8 9 12 2.5Z'],
  star: ['M12 3.8 14.5 9l5.7.8-4.1 4 1 5.7-5.1-2.7-5.1 2.7 1-5.7-4.1-4L9.5 9 12 3.8Z'],
  target: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z', 'M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z'],
  user: ['M20 21a8 8 0 0 0-16 0', 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z'],
  wallet: ['M4 6.5A2.5 2.5 0 0 1 6.5 4H19a1 1 0 0 1 1 1v15H6.5A2.5 2.5 0 0 1 4 17.5v-11Z', 'M4 8h16', 'M15 13h3'],
}

const paths = computed(() => iconPaths[props.name] ?? iconPaths.spark)
</script>

<template>
  <svg class="app-icon" :width="size" :height="size" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path v-for="path in paths" :key="path" :d="path" />
  </svg>
</template>

<style scoped>
.app-icon { display: block; flex: 0 0 auto; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
</style>
