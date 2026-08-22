<script setup lang="ts">
import { computed } from 'vue'
import { getPublicStateMeta } from '~/utils/public-state.mjs'

type PublicState = 'ready' | 'loading' | 'empty' | 'error' | 'download-disabled' | 'permission' | 'recovery' | 'maintenance'

const props = withDefaults(
  defineProps<{
    state: PublicState
    title?: string
    message?: string
    actionLabel?: string
    actionHref?: string
  }>(),
  {
    title: '',
    message: '',
    actionLabel: '',
    actionHref: '',
  },
)

const emit = defineEmits<{ retry: [] }>()
const meta = computed(() => getPublicStateMeta(props.state))
const isRetryAction = computed(() => ['error', 'recovery', 'maintenance'].includes(props.state) && !props.actionHref)
</script>

<template>
  <section class="public-status" :class="`public-status-${state}`" :role="meta.role" aria-live="polite">
    <span class="status-icon" aria-hidden="true">{{ meta.icon }}</span>
    <div class="status-copy">
      <h2>{{ title || meta.title }}</h2>
      <p>{{ message || meta.message }}</p>
      <NuxtLink v-if="actionHref" class="button button-secondary button-small" :to="actionHref">
        {{ actionLabel || meta.actionLabel }}
      </NuxtLink>
      <button v-else-if="isRetryAction" class="button button-secondary button-small" type="button" @click="emit('retry')">
        {{ actionLabel || meta.actionLabel }}
      </button>
    </div>
  </section>
</template>
