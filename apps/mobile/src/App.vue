<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app'
import { useSessionStore } from './stores/session'

const session = useSessionStore()

onLaunch(() => {
  session.restore()
})
</script>

<template>
  <slot />
</template>
