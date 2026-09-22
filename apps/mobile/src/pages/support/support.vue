<script setup lang="ts">
import MobilePageHeader from '../../components/MobilePageHeader.vue'
import { useMobileExperience } from '../../platform/experience'
const { experienceStyle, experienceMotion } = useMobileExperience()

import { onLoad } from '@dcloudio/uni-app'
import { ref } from 'vue'
import {
  MOBILE_SUPPORT_CATEGORIES,
  createMobileSupportTicket,
  listMobileSupportTickets,
  type MobileSupportTicket,
} from '../../api/support'

const tickets = ref<MobileSupportTicket[]>([])
const category = ref<string>('TECHNICAL')
const description = ref('')
const submitting = ref(false)
const error = ref<string | null>(null)

async function load(): Promise<void> {
  error.value = null
  try {
    tickets.value = await listMobileSupportTickets()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '客服暂时不可用。'
  }
}

async function submit(): Promise<void> {
  if (submitting.value || !description.value.trim()) return
  submitting.value = true
  error.value = null
  try {
    const ticket = await createMobileSupportTicket({ categoryCode: category.value, description: description.value })
    if (ticket) {
      tickets.value = [ticket, ...tickets.value]
      description.value = ''
    }
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '工单创建未完成。'
  } finally {
    submitting.value = false
  }
}

onLoad(() => { void load() })
</script>

<template>
  <view class="yx-page" :style="experienceStyle" :data-motion="experienceMotion">

    <MobilePageHeader page="support" />

    <view class="yx-card">
      <label class="yx-field">
        <text>问题分类</text>
        <picker :value="MOBILE_SUPPORT_CATEGORIES.indexOf(category as typeof MOBILE_SUPPORT_CATEGORIES[number])" :range="[...MOBILE_SUPPORT_CATEGORIES]" @change="category = MOBILE_SUPPORT_CATEGORIES[Number($event.detail.value)] ?? 'TECHNICAL'">
          <view>{{ category }}</view>
        </picker>
      </label>
      <label class="yx-field">
        <text>问题描述（仅本地，发送指纹）</text>
        <textarea v-model="description" placeholder="描述问题，原文不出端" :disabled="submitting" />
      </label>
      <text v-if="error" class="yx-login-error" role="alert">{{ error }}</text>
      <button tabindex="0" role="button" class="yx-button" type="button" :disabled="submitting || !description.trim()" @click="submit">
        {{ submitting ? '正在提交…' : '提交工单' }}
      </button>
    </view>

    <view class="yx-card">
      <text class="yx-eyebrow">我的工单</text>
      <text v-if="!tickets.length">暂无可见工单。</text>
      <view v-for="ticket in tickets" :key="ticket.ticketId">
        <text>{{ ticket.ticketId }} · {{ ticket.categoryCode }} · {{ ticket.state }}</text>
      </view>
    </view>
  </view>
</template>

<style scoped>
.yx-card { margin-top: 28rpx; }
.yx-field { display: grid; gap: 10rpx; margin-top: 22rpx; }
.yx-login-error { display: block; margin-top: 18rpx; color: var(--yx-danger); }
</style>
