<script setup lang="ts">
withDefaults(defineProps<{
  title: string
  description: string
  actionLabel?: string
}>(), {
  actionLabel: '',
})

defineEmits<{
  action: []
}>()
</script>

<template>
  <view class="yx-empty" role="status" aria-live="polite">
    <view class="yx-empty__mark" aria-hidden="true">✦</view>
    <text class="yx-empty__title">{{ title }}</text>
    <text class="yx-empty__description">{{ description }}</text>
    <button v-if="actionLabel" class="yx-button" type="button" @click="$emit('action')">{{ actionLabel }}</button>
  </view>
</template>
