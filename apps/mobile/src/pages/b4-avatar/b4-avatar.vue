<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppIcon from '../../components/AppIcon.vue'
import MobilePageHeader from '../../components/MobilePageHeader.vue'
import B4StatusPanel from '../../components/b4/B4StatusPanel.vue'
import { ensureMobilePageAccess } from '../../auth/navigation'
import type { B4AvatarItem, B4Loadout, B4PerformanceLevel } from '../../domain/b4'
import { useMobileExperience } from '../../platform/experience'
import { openUniPage } from '../../platform/uni-runtime'
import { useB4Store } from '../../stores/b4'
import { b10ThemeMode } from '../../platform/b10-foundation'

const { experienceStyle, experienceMotion } = useMobileExperience()
const b4 = useB4Store()
const accessGranted = ref(false)
const pageLoading = ref(true)
const pageReady = ref(false)
const themeClass = computed(() => `b10-theme--${b10ThemeMode.value}`)

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
  <view class="yx-page b4-avatar v2-avatar-page" :style="experienceStyle" :data-motion="experienceMotion" :class="themeClass">
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
/* v2 形象页换皮：对齐 mobile/styles.css 与 refine.css 中 .card/.eyebrow/.opt/.fb/.btn/.list-row，对齐 practice.vue v2-practice-* 与 today.vue v2-today-* 同样数值，仅用 var(--v2-*)。 */
.v2-avatar-page{box-sizing:border-box;max-width:100%;min-width:0;font-family:var(--v2-font)}
.v2-avatar-body{display:flex;flex-direction:column;gap:var(--v2-space-4);box-sizing:border-box;max-width:100%;min-width:0;font-family:var(--v2-font)}
.v2-avatar-body>*{min-width:0;max-width:100%}
.v2-avatar-card{display:grid;gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;padding:var(--v2-space-5);border:1px solid var(--v2-line);border-radius:var(--v2-radius-lg);background:var(--v2-card);box-shadow:var(--v2-shadow);font-family:var(--v2-font)}
.v2-avatar-card:hover{border-color:var(--v2-brand)}
.v2-avatar-head{display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;font-family:var(--v2-font)}
.v2-avatar-head>*{min-width:0;max-width:100%}
.v2-avatar-titles{display:grid;gap:var(--v2-space-1);box-sizing:border-box;max-width:100%;min-width:0;flex:1 1 auto;font-family:var(--v2-font)}
.v2-avatar-eyebrow{display:flex;align-items:center;flex-wrap:wrap;gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;margin:0 0 var(--v2-space-2);color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-xs);font-weight:700;letter-spacing:.06em;text-transform:uppercase;overflow-wrap:anywhere}
.v2-avatar-title{display:block;box-sizing:border-box;max-width:100%;min-width:0;margin:var(--v2-space-1) 0 0;color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-lg);font-weight:700;line-height:1.45;overflow-wrap:anywhere}
.v2-avatar-side{display:flex;align-items:center;flex-wrap:wrap;gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;font-family:var(--v2-font)}
.v2-avatar-side>*{min-width:0;max-width:100%}
.v2-avatar-desc{display:block;box-sizing:border-box;max-width:100%;min-width:0;color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.7;overflow-wrap:anywhere}
.v2-avatar-preview{display:grid;place-items:center;align-content:center;gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;min-height:var(--v2-space-12);padding:var(--v2-space-4);border-radius:var(--v2-radius-md);background:var(--v2-soft);color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.7;overflow:hidden;overflow-wrap:anywhere}
.v2-avatar-preview>*{min-width:0;max-width:100%}
.v2-avatar-list{display:grid;gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;font-family:var(--v2-font)}
.v2-avatar-list>*{min-width:0;max-width:100%}
.v2-avatar-row{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;padding:var(--v2-space-4);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);background:var(--v2-card);font-family:var(--v2-font)}
.v2-avatar-row:hover{border-color:var(--v2-brand)}
.v2-avatar-row>*{min-width:0;max-width:100%}
.v2-avatar-info{display:grid;gap:var(--v2-space-1);box-sizing:border-box;max-width:100%;min-width:0;flex:1 1 auto;font-family:var(--v2-font)}
.v2-avatar-name{display:block;box-sizing:border-box;max-width:100%;min-width:0;color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-sm);font-weight:700;line-height:1.45;overflow-wrap:anywhere}
.v2-avatar-go{display:flex;align-items:center;flex-wrap:wrap;gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;flex:0 0 auto;color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.7}
.v2-avatar-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;font-family:var(--v2-font)}
.v2-avatar-grid>*{min-width:0;max-width:100%}
.v2-avatar-item{display:grid;gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;padding:var(--v2-space-4);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);background:var(--v2-card);font-family:var(--v2-font)}
.v2-avatar-item:hover{border-color:var(--v2-brand)}
.v2-avatar-quality{display:block;box-sizing:border-box;max-width:100%;min-width:0;color:var(--v2-brand);font-family:var(--v2-font);font-size:var(--v2-text-xs);font-weight:700;letter-spacing:.06em;line-height:1.5;text-transform:uppercase;overflow-wrap:anywhere}
.v2-avatar-btn{box-sizing:border-box;display:flex;align-items:center;justify-content:center;width:100%;max-width:100%;min-width:0;min-height:var(--v2-space-12);padding:var(--v2-space-3) var(--v2-space-4);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);background:var(--v2-card);color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-sm);font-weight:600;line-height:1.5;white-space:nowrap;overflow-wrap:anywhere}
.v2-avatar-opt{box-sizing:border-box;display:flex;align-items:center;justify-content:center;width:100%;max-width:100%;min-width:0;min-height:var(--v2-space-12);padding:var(--v2-space-3) var(--v2-space-4);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);background:var(--v2-card);color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-sm);font-weight:600;line-height:1.5;white-space:nowrap;overflow-wrap:anywhere}
.v2-avatar-btn:hover,.v2-avatar-opt:hover{border-color:var(--v2-brand)}
.v2-avatar-btn:active,.v2-avatar-opt:active{transform:scale(.97)}
.v2-avatar-btn:focus-visible,.v2-avatar-opt:focus-visible{box-shadow:var(--v2-focus);outline:none}
.v2-avatar-btn:disabled,.v2-avatar-opt:disabled{background:var(--v2-surface);color:var(--v2-mut);border:1px dashed var(--v2-line);box-shadow:none}
.v2-avatar-next{font-family:var(--v2-font);white-space:nowrap}
.v2-avatar-fb{display:block;box-sizing:border-box;max-width:100%;min-width:0;margin-top:var(--v2-space-4);padding:var(--v2-space-3) var(--v2-space-4);border-radius:var(--v2-radius-md);background:var(--v2-surface);color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.7;overflow-wrap:anywhere}
@media(max-width:480px){.v2-avatar-grid{grid-template-columns:1fr}}
</style>
