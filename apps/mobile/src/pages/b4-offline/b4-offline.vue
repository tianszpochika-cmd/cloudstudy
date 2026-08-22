<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app'
import B4StatusPanel from '../../components/b4/B4StatusPanel.vue'
import type { B4PerformanceLevel } from '../../domain/b4'
import { getUniRuntime } from '../../platform/uni-runtime'
import { useSessionStore } from '../../stores/session'
import { useB4Store } from '../../stores/b4'

const session = useSessionStore()
const b4 = useB4Store()

onShow(() => {
  session.restore()
  if (!session.isAuthenticated) { getUniRuntime().navigateTo({ url: '/pages/login/login' }); return }
  b4.restore()
  if (!b4.offlinePackages.length) void b4.loadWorld()
})

function selectPerformance(level: B4PerformanceLevel): void { b4.setPerformance(level) }
</script>

<template>
  <view class="yx-page b4-offline">
    <text class="yx-eyebrow">B4 · OFFLINE / WEAK NETWORK</text>
    <text class="yx-title">离线包与待同步</text>
    <text class="yx-description">授权、分片、校验和同步状态只接受服务端响应；断网时不把本地事件显示为已完成。</text>
    <B4StatusPanel :status="b4.status" :online="b4.online" :message="b4.lastError" :queue-count="b4.queueCount" :performance-level="b4.performanceLevel" @retry="b4.loadWorld" @sync="b4.syncOffline" @performance="selectPerformance" />
    <view class="yx-card"><view class="heading"><view><text class="kicker">OFFLINE PACKAGES</text><text class="card-title">内容包</text></view><text class="muted">{{ b4.online ? '在线' : '离线' }}</text></view><text class="muted">授权成功不等于已下载；移动端等待真实 manifest、分片传输和 hash 校验结果。</text><view v-if="b4.offlinePackages.length" class="package-list"><view v-for="item in b4.offlinePackages" :key="item.packageId" class="package"><view><text class="package-name">{{ item.packageCode }}</text><text class="muted">{{ item.packageId }} · v{{ item.version }}</text></view><text class="package-state">{{ item.downloadState ?? item.state }}</text><text class="muted">{{ item.sizeBytes }} bytes · {{ item.completedPartCount }} / {{ item.partCount }} part · {{ item.downloadedBytes }} bytes</text><button v-if="item.state === 'PUBLISHED' && !item.downloadId" class="small-button secondary" type="button" @click="b4.authorizeOfflinePackage(item.packageId)">请求授权</button><button v-if="item.downloadId && ['AUTHORIZED', 'DOWNLOADING'].includes(item.downloadState ?? '')" class="small-button secondary" type="button" @click="b4.updateOfflineDownload(item.downloadId, 'PAUSE')">暂停下载</button><button v-if="item.downloadId && item.downloadState === 'PAUSED'" class="small-button secondary" type="button" @click="b4.updateOfflineDownload(item.downloadId, 'RESUME')">恢复下载</button><button v-if="item.downloadId && item.downloadState !== 'ACTIVE_LOCAL'" class="small-button secondary" type="button" @click="b4.cleanupOfflineDownload(item.downloadId)">清理临时分片</button><text v-if="!item.downloadId" class="muted">授权后才会生成下载任务。</text><text v-else class="muted">服务端状态：{{ item.downloadState ?? 'UNKNOWN' }}；完成后仍需服务端校验。</text></view></view><text v-else class="empty-copy">服务端未返回离线包，未使用本地伪造包。</text></view>
    <view class="yx-card"><view class="heading"><view><text class="kicker">LOCAL SYNC QUEUE</text><text class="card-title">待同步事件</text></view><text class="muted">{{ b4.queueCount }} 条</text></view><view v-if="b4.offlineRecords.length" class="queue-list"><view v-for="item in b4.offlineRecords" :key="item.id" class="queue"><text>{{ item.event.eventType }}</text><text class="queue-state">{{ item.status }}</text><text class="muted">{{ item.event.entityId }} · {{ item.lastError ?? '等待服务端确认' }}</text></view></view><text v-else class="empty-copy">暂无本地待同步事件。</text><button v-if="b4.queueCount" class="yx-button" type="button" @click="b4.syncOffline">提交待同步事件</button></view>
  </view>
</template>

<style scoped lang="scss">
.b4-offline{padding-bottom:56rpx}.heading{display:flex;align-items:flex-start;justify-content:space-between;gap:14rpx}.kicker{display:block;color:#596bff;font-size:21rpx;font-weight:800;letter-spacing:2rpx}.card-title{display:block;margin-top:8rpx;font-size:34rpx;font-weight:750}.muted{display:block;color:#666d80;font-size:22rpx;line-height:1.55}.package-list,.queue-list{display:grid;gap:12rpx;margin-top:18rpx}.package{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10rpx;padding:18rpx;border:1rpx solid #eef0f5;border-radius:14rpx;background:#fff}.package>view{display:grid;gap:6rpx}.package-name{font-size:27rpx;font-weight:700}.package-state{color:#596bff;font-size:22rpx;font-weight:800}.small-button{min-height:64rpx;padding:0 18rpx;border:0;border-radius:12rpx;color:#fff;background:#596bff;font-size:22rpx;line-height:64rpx}.small-button.secondary{border:1rpx solid #d9dce7;color:#596bff;background:#fff}.queue{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6rpx;padding:16rpx;border-radius:12rpx;background:#f7f8fc}.queue-state{color:#9b5b00;font-size:21rpx}.queue .muted{grid-column:1/-1}.empty-copy{display:block;padding:18rpx;border:1rpx dashed #dfe3ee;border-radius:12rpx;color:#666d80;font-size:24rpx;line-height:1.6}@media(max-width:460px){.package{grid-template-columns:1fr}.package .small-button{width:100%}}
</style>
