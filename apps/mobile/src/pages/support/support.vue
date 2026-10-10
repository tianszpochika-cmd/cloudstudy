<script setup lang="ts">
import MobilePageHeader from '../../components/MobilePageHeader.vue'
import { useMobileExperience } from '../../platform/experience'
const { experienceStyle, experienceMotion } = useMobileExperience()

import { onShow } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { ensureMobilePageAccess } from '../../auth/navigation'
import {
  listMobileSupportTickets,
  readMobileClosureBoard,
  type MobileSupportTicket,
} from '../../api/support'
import { supportNotice, ticketNotice, type ClosureBoard } from '../../domain/it7-closure'

const tickets = ref<MobileSupportTicket[]>([])
const closure = ref<ClosureBoard | null>(null)
const loading = ref(false)
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
    tickets.value = await listMobileSupportTickets()
    closure.value = await readMobileClosureBoard().catch(() => null)
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
  <view class="yx-page" :style="experienceStyle" :data-motion="experienceMotion">

    <MobilePageHeader page="support" />

    <view class="yx-card">
      <text class="yx-eyebrow">客服与帮助</text>
      <text class="yx-note it7-closure">{{ ticketNotice(closure) }}</text>
      <text v-if="supportNotice(closure)" class="yx-note">{{ supportNotice(closure) }}</text>
    </view>

    <view class="yx-card">
      <text class="yx-eyebrow">我的工单</text>
      <text v-if="loading" role="status">正在读取工单…</text>
      <text v-else-if="error" class="yx-login-error" role="alert">工单暂不可用，请重试。</text>
      <text v-else-if="!tickets.length">暂无可见工单。</text>
      <view v-else class="yx-ticket-list">
        <view v-for="ticket in tickets" :key="ticket.ticketId" class="yx-ticket">
          <text>工单 {{ ticket.ticketId }}</text>
          <text>{{ categoryNames[ticket.categoryCode] ?? '历史分类' }} · {{ stateNames[ticket.state] ?? '历史状态' }}</text>
        </view>
      </view>
      <button class="yx-button" type="button" :disabled="loading" @click="load">{{ error ? '重试' : '刷新' }}</button>
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
