<script setup lang="ts">
import MobilePageHeader from '../../components/MobilePageHeader.vue'
import AppIcon from '../../components/AppIcon.vue'
import { useMobileExperience } from '../../platform/experience'
const { experienceStyle, experienceMotion } = useMobileExperience()

import { onShow } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { ensureMobilePageAccess } from '../../auth/navigation'
import {
  loadMobileSupportDesk,
  type MobileSupportTicket,
} from '../../api/support'
import { supportNotice, ticketNotice, type ClosureBoard } from '../../domain/it7-closure'

const tickets = ref<MobileSupportTicket[]>([])
const closure = ref<ClosureBoard | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const categoryNames: Record<string, string> = {
  CONTENT_CORRECTION: '内容纠错', ACCOUNT_ACCESS: '账号访问', BILLING: '订单权益',
  LEARNING_DATA: '学习记录', PRIVACY_REQUEST: '隐私请求', TECHNICAL: '设备问题',
}
const stateNames: Record<string, string> = {
  OPEN: '已提交', ACKNOWLEDGED: '已受理', IN_PROGRESS: '处理中',
  WAITING_CUSTOMER: '等待补充', RESOLVED: '已解决', CLOSED: '已关闭',
}

async function load(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    const desk = await loadMobileSupportDesk()
    tickets.value = desk.tickets
    closure.value = desk.board
  } catch (cause) {
    tickets.value = []
    error.value = cause instanceof Error ? cause.message : '客服暂时不可用。'
  } finally {
    loading.value = false
  }
}

onShow(async () => { if (await ensureMobilePageAccess('/pages/support/support')) await load() })
</script>

<template>
  <view class="yx-page v2-support-page" :style="experienceStyle" :data-motion="experienceMotion">

    <MobilePageHeader page="support" />

    <view class="v2-support-body">
    <view class="yx-card card v2-support-card">
      <view class="v2-support-head">
        <view class="v2-support-titles">
          <text class="yx-eyebrow eyebrow v2-support-eyebrow"><AppIcon name="help" :size="14" /><text>客服与帮助</text></text>
        </view>
      </view>
      <text class="yx-note d v2-support-d">暂不能提交新工单，可查看已有工单。</text>
      <text class="yx-note it7-closure d v2-support-d">{{ ticketNotice(closure) }}</text>
      <text v-if="supportNotice(closure)" class="yx-note d v2-support-d">{{ supportNotice(closure) }}</text>
    </view>

    <view class="yx-card card v2-support-card">
      <view class="v2-support-head">
        <view class="v2-support-titles">
          <text class="yx-eyebrow eyebrow v2-support-eyebrow"><AppIcon name="ticket" :size="14" /><text>我的工单</text></text>
        </view>
      </view>
      <text v-if="loading" role="status" class="fb d v2-support-fb v2-support-d">正在读取工单…</text>
      <text v-else-if="error" class="yx-login-error fb d v2-support-fb v2-support-d" role="alert">工单暂不可用，请重试。</text>
      <text v-else-if="!tickets.length" class="fb d v2-support-fb v2-support-d v2-support-empty">暂无可见工单。</text>
      <view v-else class="yx-ticket-list v2-support-list">
        <view v-for="ticket in tickets" :key="ticket.ticketId" class="yx-ticket list-row row card v2-support-row v2-support-card">
          <view class="v2-support-copy">
            <text class="v2-support-name v2-support-h2">工单 {{ ticket.ticketId }}</text>
            <text class="d v2-support-d">{{ categoryNames[ticket.categoryCode] ?? '历史分类' }} · {{ stateNames[ticket.state] ?? '历史状态' }}</text>
          </view>
        </view>
      </view>
      <button class="yx-button btn opt v2-support-btn v2-support-opt" type="button" :disabled="loading" @click="load">{{ error ? '重试' : '刷新' }}<AppIcon name="refresh" :size="14" /></button>
    </view>
    </view>
  </view>
</template>

<style scoped>
.yx-card { margin-top: 28rpx; }
.yx-page :deep(.mobile-page-description) { display: none; }
.yx-note { display: block; margin-top: 12rpx; }
.yx-ticket { display: grid; gap: 6rpx; margin-top: 18rpx; overflow-wrap: anywhere; }
.yx-login-error { display: block; margin-top: 18rpx; color: var(--yx-danger); }
</style>
