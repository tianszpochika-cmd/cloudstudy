<script setup lang="ts">
import MobilePageHeader from '../../components/MobilePageHeader.vue'
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
  if (!b4.avatarProfile) void b4.loadWorld()
})

function selectPerformance(level: B4PerformanceLevel): void { b4.setPerformance(level) }
</script>

<template>
  <view class="yx-page b4-avatar" :style="experienceStyle" :data-motion="experienceMotion">
    <MobilePageHeader page="b4-avatar" />

    <B4StatusPanel :status="b4.status" :online="b4.online" :message="b4.lastError" :queue-count="b4.queueCount" :performance-level="b4.performanceLevel" @retry="b4.loadWorld" @sync="b4.syncOffline" @performance="selectPerformance" />
    <view class="yx-card preview-card"><view class="heading"><view><text class="kicker">MY LOOK</text><text class="card-title">{{ b4.effectiveAvatarRenderMode }}</text></view><text class="muted">{{ b4.avatarResources?.resourceVersion ?? '资源版本未返回' }}</text></view><view class="avatar-preview" :class="{ static: b4.effectiveAvatarRenderMode === '2D_FALLBACK' }"><text>✦</text><text>{{ b4.effectiveAvatarRenderMode === '3D' ? '3D 资源模式' : '静态展示' }}</text></view><text v-if="b4.avatarProfile" class="muted">{{ b4.avatarProfile.avatarId }} · 当前衣柜 {{ b4.avatarProfile.loadoutId }}</text><text v-else class="empty-copy">暂时没有可用形象，请稍后重试。</text><button tabindex="0" role="button" class="yx-button yx-button--secondary" type="button" :disabled="!b4.avatarProfile" @click="b4.saveAvatarProfile(b4.effectiveAvatarRenderMode)">保存当前渲染模式</button></view>
    <view class="yx-card"><view class="heading"><view><text class="kicker">WARDROBE</text><text class="card-title">衣柜套装</text></view><text class="muted">{{ b4.loadouts.length }} 套</text></view><view v-if="b4.loadouts.length" class="loadout-list"><view v-for="loadout in b4.loadouts" :key="loadout.loadoutId" class="loadout"><view><text class="loadout-name">{{ loadout.name }}</text><text class="muted">{{ loadout.loadoutId }} · {{ loadout.items.length }} 件</text></view><text v-if="loadout.equipped" class="equipped">当前装备</text><button tabindex="0" role="button" v-else class="small-button secondary" type="button" @click="b4.equipLoadout(loadout.loadoutId)">装备</button></view></view><text v-else class="empty-copy">衣柜里暂时没有可用套装。</text></view>
    <view class="yx-card"><view class="heading"><view><text class="kicker">ITEMS</text><text class="card-title">可见资源</text></view><text class="muted">{{ b4.avatarItems.length }} 项</text></view><view v-if="b4.avatarItems.length" class="item-grid"><view v-for="item in b4.avatarItems" :key="item.itemCode" class="item"><text>{{ item.quality }}</text><text class="item-code">{{ item.itemCode }}</text><text class="muted">{{ item.slot }} · {{ item.resourceVersion }}</text></view></view><text v-else class="empty-copy">暂时没有可用装扮。</text></view>
  </view>
</template>

<style scoped lang="scss">
.b4-avatar{padding-bottom:56rpx}.heading{display:flex;align-items:flex-start;justify-content:space-between;gap:14rpx}.kicker{display:block;color:var(--yx-brand);font-size:21rpx;font-weight:800;letter-spacing:2rpx}.card-title{display:block;margin-top:8rpx;font-size:34rpx;font-weight:750}.muted{display:block;color:var(--yx-text-secondary);font-size:22rpx;line-height:1.55}.preview-card{display:grid;gap:14rpx}.avatar-preview{display:grid;min-height:260rpx;place-items:center;align-content:center;gap:10rpx;border-radius:18rpx;color:var(--yx-on-brand);background:radial-gradient(circle at 35% 25%,var(--yx-action),var(--yx-text-primary) 70%);font-size:84rpx}.avatar-preview text:last-child{font-size:22rpx;color:var(--yx-brand-soft)}.avatar-preview.static{color:var(--yx-brand);background:var(--yx-brand-soft)}.avatar-preview.static text:last-child{color:var(--yx-text-secondary)}.empty-copy{display:block;padding:18rpx;border:1rpx dashed var(--yx-border);border-radius:12rpx;color:var(--yx-text-secondary);font-size:24rpx;line-height:1.6}.loadout-list{display:grid;gap:10rpx;margin-top:18rpx}.loadout{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:10rpx;padding:16rpx;border-radius:12rpx;background:var(--yx-surface-page)}.loadout>view{display:grid;gap:6rpx}.loadout-name{font-size:27rpx;font-weight:700}.equipped{color:var(--yx-success);font-size:21rpx}.small-button{min-height:64rpx;padding:0 18rpx;border:0;border-radius:12rpx;color:var(--yx-on-brand);background:var(--yx-action);font-size:22rpx;line-height:64rpx}.small-button.secondary{border:1rpx solid var(--yx-border);color:var(--yx-brand);background:var(--yx-surface-card)}.item-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12rpx;margin-top:18rpx}.item{display:grid;gap:7rpx;padding:16rpx;border-radius:12rpx;background:var(--yx-surface-page)}.item>text:first-child{color:var(--yx-brand);font-size:21rpx;font-weight:800}.item-code{font-size:25rpx;font-weight:700}@media(max-width:480px){.item-grid{grid-template-columns:1fr}}
</style>
