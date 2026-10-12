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
/* v2 客服页换皮：对齐 practice.vue v2-practice-* 与 today.vue v2-today-* 卡片/eyebrow/标题/列表行/按钮同样数值，对齐 webDemo/mobile/styles.css、refine.css，仅用 var(--v2-*)。 */
.v2-support-page{box-sizing:border-box;max-width:100%;min-width:0;font-family:var(--v2-font)}
.v2-support-body{display:flex;flex-direction:column;gap:var(--v2-space-4);box-sizing:border-box;max-width:100%;min-width:0;font-family:var(--v2-font)}
.v2-support-body>*{min-width:0;max-width:100%}
.v2-support-card{display:grid;gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;padding:var(--v2-space-5);border:1px solid var(--v2-line);border-radius:var(--v2-radius-lg);background:var(--v2-card);box-shadow:var(--v2-shadow);font-family:var(--v2-font)}
.v2-support-card:hover{border-color:var(--v2-brand)}
.v2-support-head{display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;font-family:var(--v2-font)}
.v2-support-head>*{min-width:0;max-width:100%}
.v2-support-titles{display:grid;gap:var(--v2-space-1);box-sizing:border-box;max-width:100%;min-width:0;flex:1 1 auto;font-family:var(--v2-font)}
.v2-support-eyebrow{display:flex;align-items:center;flex-wrap:wrap;gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;margin:0 0 var(--v2-space-2);color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-xs);font-weight:700;letter-spacing:.06em;text-transform:uppercase;overflow-wrap:anywhere}
.v2-support-name{display:block;box-sizing:border-box;max-width:100%;min-width:0;color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-lg);font-weight:700;line-height:1.45;overflow-wrap:anywhere}
.v2-support-h2{box-sizing:border-box;max-width:100%;min-width:0;font-family:var(--v2-font);overflow-wrap:anywhere}
.v2-support-d{display:block;box-sizing:border-box;max-width:100%;min-width:0;color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.7;overflow-wrap:anywhere}
.v2-support-list{display:grid;gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;font-family:var(--v2-font)}
.v2-support-list>*{min-width:0;max-width:100%}
.v2-support-row{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;padding:var(--v2-space-4);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);background:var(--v2-card);font-family:var(--v2-font)}
.v2-support-row:hover{border-color:var(--v2-brand)}
.v2-support-row>*{min-width:0;max-width:100%}
.v2-support-copy{display:grid;gap:var(--v2-space-1);box-sizing:border-box;max-width:100%;min-width:0;flex:1 1 auto;font-family:var(--v2-font)}
.v2-support-btn{box-sizing:border-box;display:flex;align-items:center;justify-content:center;gap:var(--v2-space-2);width:100%;max-width:100%;min-width:0;min-height:var(--v2-space-12);padding:var(--v2-space-3) var(--v2-space-4);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);background:var(--v2-card);color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-sm);font-weight:600;line-height:1.5;white-space:nowrap;overflow-wrap:anywhere}
.v2-support-opt{box-sizing:border-box;display:flex;align-items:center;justify-content:center;gap:var(--v2-space-2);width:100%;max-width:100%;min-width:0;min-height:var(--v2-space-12);padding:var(--v2-space-3) var(--v2-space-4);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);background:var(--v2-card);color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-sm);font-weight:600;line-height:1.5;white-space:nowrap;overflow-wrap:anywhere}
.v2-support-btn>*,.v2-support-opt>*{min-width:0;max-width:100%}
.v2-support-btn:hover,.v2-support-opt:hover{border-color:var(--v2-brand)}
.v2-support-btn:active,.v2-support-opt:active{transform:scale(.97)}
.v2-support-btn:focus-visible,.v2-support-opt:focus-visible{box-shadow:var(--v2-focus);outline:none}
.v2-support-btn:disabled,.v2-support-opt:disabled{background:var(--v2-surface);color:var(--v2-mut);border:1px dashed var(--v2-line);box-shadow:none}
.v2-support-fb{display:block;box-sizing:border-box;max-width:100%;min-width:0;margin-top:var(--v2-space-4);padding:var(--v2-space-3) var(--v2-space-4);border-radius:var(--v2-radius-md);background:var(--v2-surface);color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.7;overflow-wrap:anywhere}
.v2-support-empty{display:grid;gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;padding:var(--v2-space-4);border:1px dashed var(--v2-line);border-radius:var(--v2-radius-md);color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.7;overflow-wrap:anywhere}
</style>
