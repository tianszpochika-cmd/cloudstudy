<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppIcon from '../../components/AppIcon.vue'
import MobilePageHeader from '../../components/MobilePageHeader.vue'
import B4StatusPanel from '../../components/b4/B4StatusPanel.vue'
import { ensureMobilePageAccess } from '../../auth/navigation'
import type { B4AvatarItem, B4Loadout, B4PerformanceLevel } from '../../domain/b4'
import { useMobileExperience } from '../../platform/experience'
import { openUniPage } from '../../platform/uni-runtime'
import { useB4Store } from '../../stores/b4'

const { experienceStyle, experienceMotion } = useMobileExperience()
const b4 = useB4Store()
const accessGranted = ref(false)
const pageLoading = ref(true)
const pageReady = ref(false)

onShow(async () => {
  accessGranted.value = false
  pageReady.value = false
  pageLoading.value = true
  if (!await ensureMobilePageAccess('/pages/b4-avatar/b4-avatar')) {
    pageLoading.value = false
    return
  }
  accessGranted.value = true
  b4.restore()
  await loadAvatarPage()
})

async function loadAvatarPage(): Promise<void> {
  pageReady.value = false
  pageLoading.value = true
  try {
    await b4.loadWorld()
    pageReady.value = b4.status === 'ready'
  } finally {
    pageLoading.value = false
  }
}

function selectPerformance(level: B4PerformanceLevel): void { b4.setPerformance(level) }
function loadoutTitle(loadout: B4Loadout, index: number): string {
  return loadout.name !== loadout.loadoutId ? loadout.name : `套装 ${index + 1}`
}
function itemTitle(item: B4AvatarItem): string {
  const slot: Record<string, string> = { HEAD: '头部装扮', FACE: '面部装扮', BODY: '服装', AURA: '光效装扮' }
  return slot[item.slot] ?? '装扮素材'
}
function itemQuality(quality: string): string {
  const labels: Record<string, string> = { COMMON: '普通款', RARE: '稀有款', EPIC: '珍藏款', LEGENDARY: '典藏款' }
  return labels[quality] ?? '款式待补充'
}
</script>

<template>
  <view class="yx-page b4-avatar v2-avatar-page" :style="experienceStyle" :data-motion="experienceMotion">
    <MobilePageHeader page="b4-avatar" />

    <view class="v2-avatar-body">
      <template v-if="accessGranted">
        <B4StatusPanel :status="b4.status" :online="b4.online" :message="b4.lastError" :queue-count="b4.queueCount" :performance-level="b4.performanceLevel" @retry="loadAvatarPage" @sync="b4.syncOffline" @performance="selectPerformance" />
        <text v-if="pageLoading" class="empty-copy v2-avatar-fb">正在加载角色信息…</text>
        <text v-else-if="!pageReady" class="empty-copy v2-avatar-fb">角色信息暂不可用。</text>
        <template v-else>
          <view class="yx-card preview-card card v2-avatar-card">
            <view class="heading v2-avatar-head"><view class="v2-avatar-titles"><text class="kicker v2-avatar-eyebrow">形象</text><text class="card-title v2-avatar-title">展示预览</text></view><view class="v2-avatar-side"><AppIcon name="spark" :size="18" /><text class="muted v2-avatar-desc">本机画质</text></view></view>
            <text class="muted v2-avatar-desc">画质只影响本机显示；角色素材尚未就绪。</text>
            <view class="avatar-preview v2-avatar-preview" :class="{ static: b4.effectiveAvatarRenderMode === '2D_FALLBACK' }"><text>✦</text><text>形象示意</text></view>
          </view>

          <view class="yx-card card v2-avatar-card">
            <view class="heading v2-avatar-head"><view class="v2-avatar-titles"><text class="kicker v2-avatar-eyebrow">衣柜</text><text class="card-title v2-avatar-title">套装素材</text></view><view class="v2-avatar-side"><AppIcon name="grid" :size="18" /><text class="muted v2-avatar-desc">{{ b4.loadouts.length }} 套</text></view></view>
            <view v-if="b4.loadouts.length" class="loadout-list v2-avatar-list">
              <view v-for="(loadout, index) in b4.loadouts" :key="loadout.loadoutId" class="loadout v2-avatar-row">
                <view class="v2-avatar-info"><text class="loadout-name v2-avatar-name">{{ loadoutTitle(loadout, index) }}</text><text class="muted v2-avatar-desc">{{ loadout.items.length }} 件素材</text></view>
                <view class="v2-avatar-go"><text class="muted v2-avatar-desc">预览</text><AppIcon name="chev" :size="14" /></view>
              </view>
            </view>
            <text v-else class="empty-copy v2-avatar-fb">暂无可展示的套装素材。</text>
          </view>

          <view class="yx-card card v2-avatar-card">
            <view class="heading v2-avatar-head"><view class="v2-avatar-titles"><text class="kicker v2-avatar-eyebrow">装扮</text><text class="card-title v2-avatar-title">外观素材</text></view><view class="v2-avatar-side"><AppIcon name="star" :size="18" /><text class="muted v2-avatar-desc">{{ b4.avatarItems.length }} 款</text></view></view>
            <text class="muted v2-avatar-desc">素材展示不代表已获得奖励。</text>
            <view v-if="b4.avatarItems.length" class="item-grid v2-avatar-grid">
              <view v-for="item in b4.avatarItems" :key="item.itemCode" class="item v2-avatar-item"><AppIcon name="spark" :size="16" /><text class="v2-avatar-quality">{{ itemQuality(item.quality) }}</text><text class="item-title v2-avatar-name">{{ itemTitle(item) }}</text></view>
            </view>
            <text v-else class="empty-copy v2-avatar-fb">暂无可展示的装扮素材。</text>
            <button tabindex="0" role="button" class="yx-button yx-button--secondary btn v2-avatar-btn v2-avatar-opt v2-avatar-next" type="button" @click="openUniPage('/pages/world/world')">查看奖励<AppIcon name="chev" :size="14" /></button>
          </view>
        </template>
      </template>
    </view>
  </view>
</template>

<style scoped lang="scss">
.b4-avatar{padding-bottom:56rpx}.heading{display:flex;align-items:flex-start;justify-content:space-between;gap:14rpx}.kicker{display:block;color:var(--yx-brand);font-size:21rpx;font-weight:800;letter-spacing:2rpx}.card-title{display:block;margin-top:8rpx;font-size:34rpx;font-weight:750}.muted{display:block;color:var(--yx-text-secondary);font-size:22rpx;line-height:1.55}.preview-card{display:grid;gap:14rpx}.avatar-preview{display:grid;min-height:260rpx;place-items:center;align-content:center;gap:10rpx;border-radius:18rpx;color:var(--yx-on-brand);background:radial-gradient(circle at 35% 25%,var(--yx-action),var(--yx-text-primary) 70%);font-size:84rpx}.avatar-preview text:last-child{font-size:22rpx;color:var(--yx-brand-soft)}.avatar-preview.static{color:var(--yx-brand);background:var(--yx-brand-soft)}.avatar-preview.static text:last-child{color:var(--yx-text-secondary)}.empty-copy{display:block;padding:18rpx;border:1rpx dashed var(--yx-border);border-radius:12rpx;color:var(--yx-text-secondary);font-size:24rpx;line-height:1.6}.loadout-list{display:grid;gap:10rpx;margin-top:18rpx}.loadout{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:10rpx;padding:16rpx;border-radius:12rpx;background:var(--yx-surface-page)}.loadout>view{display:grid;gap:6rpx}.loadout-name{font-size:27rpx;font-weight:700}.item-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12rpx;margin-top:18rpx}.item{display:grid;gap:7rpx;padding:16rpx;border-radius:12rpx;background:var(--yx-surface-page)}.item>text:first-child{color:var(--yx-brand);font-size:21rpx;font-weight:800}.item-title{font-size:25rpx;font-weight:700}@media(max-width:480px){.item-grid{grid-template-columns:1fr}}
</style>
