<script setup lang="ts">
import MobilePageHeader from '../../components/MobilePageHeader.vue'
import AppIcon from '../../components/AppIcon.vue'
import { useMobileExperience } from '../../platform/experience'
const { experienceStyle, experienceMotion } = useMobileExperience()

import { onShow } from '@dcloudio/uni-app'
import B4StatusPanel from '../../components/b4/B4StatusPanel.vue'
import type { B4PerformanceLevel } from '../../domain/b4'
import { getUniRuntime } from '../../platform/uni-runtime'
import { useSessionStore } from '../../stores/session'
import { useB4Store } from '../../stores/b4'

const session = useSessionStore()
const b4 = useB4Store()

onShow(async () => {
  await session.restore()
  if (!session.isAuthenticated) { getUniRuntime().navigateTo({ url: '/pages/login/login' }); return }
  b4.restore()
  if (!b4.offlinePackages.length) void b4.loadWorld()
})

function selectPerformance(level: B4PerformanceLevel): void { b4.setPerformance(level) }
function packageStatus(value: string | null | undefined): string { return ({ PUBLISHED: '可获取', AUTHORIZED: '已授权', DOWNLOADING: '下载中', PAUSED: '已暂停', ACTIVE_LOCAL: '可离线使用', CLEANED: '已清理', DELETED: '已下线' } as Record<string, string>)[value ?? ''] ?? '状态待确认' }
function queueStatus(value: string): string { return ({ PENDING: '待同步', SYNCING: '同步中', FAILED: '同步失败' } as Record<string, string>)[value] ?? '待确认' }
function fileSize(bytes: number): string { return bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB` }
</script>

<template>
  <view class="yx-page b4-offline v2-offline-page" :style="experienceStyle" :data-motion="experienceMotion">
    <MobilePageHeader page="b4-offline" />

    <view class="v2-offline-body">
      <B4StatusPanel class="v2-offline-status" :status="b4.status" :online="b4.online" :message="b4.lastError" :queue-count="b4.queueCount" :performance-level="b4.performanceLevel" @retry="b4.loadWorld" @sync="b4.syncOffline" @performance="selectPerformance" />
      <view class="yx-card card v2-offline-card">
        <view class="heading v2-offline-head">
          <view class="v2-offline-titles">
            <text class="kicker eyebrow v2-offline-eyebrow">离线学习</text>
            <text class="card-title h2 v2-offline-title v2-offline-h2">内容包</text>
          </view>
          <view class="v2-offline-side">
            <AppIcon name="inbox" :size="18" />
            <text class="muted d v2-offline-d v2-offline-count">{{ b4.online ? '在线' : '离线' }}</text>
          </view>
        </view>
        <view v-if="b4.offlinePackages.length" class="package-list v2-offline-list">
          <view v-for="item in b4.offlinePackages" :key="item.packageId" class="package card v2-offline-card v2-offline-row row">
            <view class="v2-offline-info">
              <text class="package-name v2-offline-name">{{ item.packageCode }}</text>
              <text class="muted d v2-offline-d">{{ fileSize(item.sizeBytes) }} · {{ item.completedPartCount }}/{{ item.partCount }} 部分</text>
            </view>
            <text class="package-state v2-offline-state v2-offline-tag">{{ packageStatus(item.downloadState ?? item.state) }}</text>
            <button tabindex="0" role="button" v-if="item.state === 'PUBLISHED' && !item.downloadId" class="small-button secondary btn opt v2-offline-btn v2-offline-opt" type="button" @click="b4.authorizeOfflinePackage(item.packageId)">请求授权<AppIcon name="chev" :size="14" /></button>
            <button tabindex="0" role="button" v-if="item.downloadId && ['AUTHORIZED', 'DOWNLOADING'].includes(item.downloadState ?? '')" class="small-button secondary btn opt v2-offline-btn v2-offline-opt" type="button" @click="b4.updateOfflineDownload(item.downloadId, 'PAUSE')">暂停</button>
            <button tabindex="0" role="button" v-if="item.downloadId && item.downloadState === 'PAUSED'" class="small-button secondary btn opt v2-offline-btn v2-offline-opt" type="button" @click="b4.updateOfflineDownload(item.downloadId, 'RESUME')">继续</button>
            <button tabindex="0" role="button" v-if="item.downloadId && item.downloadState !== 'ACTIVE_LOCAL'" class="small-button secondary btn opt v2-offline-btn v2-offline-opt" type="button" @click="b4.cleanupOfflineDownload(item.downloadId)">清理</button>
          </view>
        </view>
        <text v-else class="empty-copy fb d v2-offline-fb v2-offline-d">暂无可下载的内容包。</text>
      </view>
      <view class="yx-card card v2-offline-card">
        <view class="heading v2-offline-head">
          <view class="v2-offline-titles">
            <text class="kicker eyebrow v2-offline-eyebrow">离线操作</text>
            <text class="card-title h2 v2-offline-title v2-offline-h2">待同步</text>
          </view>
          <view class="v2-offline-side">
            <AppIcon name="refresh" :size="18" />
            <text class="muted d v2-offline-d v2-offline-count">{{ b4.queueCount }} 条</text>
          </view>
        </view>
        <view v-if="b4.offlineRecords.length" class="queue-list v2-offline-list">
          <view v-for="item in b4.offlineRecords" :key="item.id" class="queue card v2-offline-card v2-offline-row row">
            <text class="v2-offline-name">自习室互动</text>
            <text class="queue-state v2-offline-state v2-offline-tag">{{ queueStatus(item.status) }}</text>
            <text v-if="item.lastError" class="muted d v2-offline-d">{{ item.lastError }}</text>
          </view>
        </view>
        <text v-else class="empty-copy fb d v2-offline-fb v2-offline-d">没有待同步操作。</text>
        <button tabindex="0" role="button" v-if="b4.queueCount" class="yx-button btn opt v2-offline-btn v2-offline-opt v2-offline-submit" type="button" @click="b4.syncOffline">立即同步<AppIcon name="refresh" :size="14" /></button>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.b4-offline{padding-bottom:56rpx}.heading{display:flex;align-items:flex-start;justify-content:space-between;gap:14rpx}.kicker{display:block;color:var(--yx-brand);font-size:21rpx;font-weight:800;letter-spacing:2rpx}.card-title{display:block;margin-top:8rpx;font-size:34rpx;font-weight:750}.muted{display:block;color:var(--yx-text-secondary);font-size:22rpx;line-height:1.55}.package-list,.queue-list{display:grid;gap:12rpx;margin-top:18rpx}.package{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10rpx;padding:18rpx;border:1rpx solid var(--yx-border);border-radius:14rpx;background:var(--yx-surface-card)}.package>view{display:grid;gap:6rpx}.package-name{font-size:27rpx;font-weight:700}.package-state{color:var(--yx-brand);font-size:22rpx;font-weight:800}.small-button{min-height:64rpx;padding:0 18rpx;border:0;border-radius:12rpx;color:var(--yx-on-brand);background:var(--yx-action);font-size:22rpx;line-height:64rpx}.small-button.secondary{border:1rpx solid var(--yx-border);color:var(--yx-brand);background:var(--yx-surface-card)}.queue{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6rpx;padding:16rpx;border-radius:12rpx;background:var(--yx-surface-page)}.queue-state{color:var(--yx-warning);font-size:21rpx}.queue .muted{grid-column:1/-1}.empty-copy{display:block;padding:18rpx;border:1rpx dashed var(--yx-border);border-radius:12rpx;color:var(--yx-text-secondary);font-size:24rpx;line-height:1.6}@media(max-width:460px){.package{grid-template-columns:1fr}.package .small-button{width:100%}}
</style>
