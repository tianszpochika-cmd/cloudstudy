<script setup lang="ts">
import { computed } from 'vue'
import AppIcon from '../../components/AppIcon.vue'
import MobilePageHeader from '../../components/MobilePageHeader.vue'
import { useMobileExperience } from '../../platform/experience'
const { experienceStyle, experienceMotion } = useMobileExperience()

import { onLoad } from '@dcloudio/uni-app'
import { authT } from '../../auth/i18n'
import { useSessionStore } from '../../stores/session'
import { openUniPage } from '../../platform/uni-runtime'

const session = useSessionStore()
const isRejected = computed(() => session.adultGate === 'REJECTED')
const explanation = computed(() => {
  if (isRejected.value) {
    return '当前版本仅面向 18 岁以上成人开放，暂不能向你开放学习功能。'
  }
  return '如果你认为这是误判，请联系帮助中心。'
})

onLoad((options) => { if (options?.returnTo) session.setReturnTo(options.returnTo) })

async function logout(): Promise<void> {
  await session.logout()
  openUniPage('/pages/login/login')
}
function goToProfile(): void { openUniPage('/pages/profile/profile') }
function goToSupport(): void { openUniPage('/pages/support/support') }
</script>

<template>
  <view class="yx-page v2-forbid-page" :style="experienceStyle" :data-motion="experienceMotion">
    <MobilePageHeader page="forbidden" />
    <view class="v2-forbid-body">
      <view class="yx-card card v2-forbid-card">
        <view class="v2-forbid-head">
          <view class="v2-forbid-titles">
            <text class="yx-eyebrow eyebrow v2-forbid-eyebrow"><AppIcon name="lock" :size="14" /><text>访问受限</text></text>
            <text class="h2 v2-forbid-title v2-forbid-h2">暂不能开放学习</text>
          </view>
        </view>
        <text class="yx-description d v2-forbid-d" role="alert">{{ explanation }}</text>
        <view class="yx-actions v2-forbid-list" style="display: grid; gap: 12rpx; margin-top: 30rpx;">
          <button v-if="isRejected" tabindex="0" role="button" class="yx-button yx-button--secondary btn opt list-row row v2-forbid-btn v2-forbid-opt v2-forbid-row" type="button" @click="goToProfile"><AppIcon name="me" :size="14" />个人中心与设置</button>
          <button v-if="isRejected" tabindex="0" role="button" class="yx-button yx-button--secondary btn opt list-row row v2-forbid-btn v2-forbid-opt v2-forbid-row" type="button" @click="goToSupport"><AppIcon name="help" :size="14" />帮助与反馈</button>
          <button tabindex="0" role="button" class="yx-button btn opt v2-forbid-btn v2-forbid-opt v2-forbid-submit" type="button" @click="logout">{{ authT('forbidden.login') }}<AppIcon name="back" :size="14" /></button>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
/* v2 无权限页换皮：对齐 practice.vue v2-practice-* 与 today.vue v2-today-* 卡片/eyebrow/标题/列表行/按钮同样数值，对齐 webDemo/mobile/styles.css、refine.css，仅用 var(--v2-*)。 */
.v2-forbid-page{box-sizing:border-box;min-width:0;max-width:100%;overflow-x:hidden;font-family:var(--v2-font);overflow-wrap:anywhere}
.v2-forbid-body{display:flex;flex-direction:column;gap:var(--v2-space-4);box-sizing:border-box;min-width:0;max-width:100%;font-family:var(--v2-font);overflow-wrap:anywhere}
.v2-forbid-card{display:grid;gap:var(--v2-space-2);box-sizing:border-box;min-width:0;max-width:100%;padding:var(--v2-space-5);border:1px solid var(--v2-line);border-radius:var(--v2-radius-lg);background:var(--v2-card);box-shadow:var(--v2-shadow);font-family:var(--v2-font);overflow-wrap:anywhere}
.v2-forbid-card:hover{border-color:var(--v2-brand)}
.v2-forbid-head{display:flex;align-items:center;gap:var(--v2-space-2);box-sizing:border-box;min-width:0;max-width:100%;font-family:var(--v2-font)}
.v2-forbid-titles{display:flex;flex-direction:column;gap:var(--v2-space-1);box-sizing:border-box;flex:1 1 auto;min-width:0;max-width:100%;font-family:var(--v2-font);overflow-wrap:anywhere}
.v2-forbid-eyebrow{display:flex;align-items:center;gap:var(--v2-space-2);box-sizing:border-box;min-width:0;max-width:100%;margin:0 0 var(--v2-space-2);color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-xs);font-weight:700;letter-spacing:.06em;text-transform:uppercase;overflow-wrap:anywhere}
.v2-forbid-title,.v2-forbid-h2{display:block;box-sizing:border-box;min-width:0;max-width:100%;margin:var(--v2-space-1) 0 0;color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-lg);font-weight:700;line-height:1.45;overflow-wrap:anywhere}
.v2-forbid-d{display:block;box-sizing:border-box;min-width:0;max-width:100%;margin-top:var(--v2-space-2);color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.7;overflow-wrap:anywhere}
.v2-forbid-list{display:grid;gap:var(--v2-space-4);box-sizing:border-box;min-width:0;max-width:100%;font-family:var(--v2-font);overflow-wrap:anywhere}
.v2-forbid-btn{box-sizing:border-box;display:flex;align-items:center;justify-content:center;gap:var(--v2-space-2);width:100%;min-width:0;max-width:100%;min-height:var(--v2-space-12);padding:var(--v2-space-3) var(--v2-space-4);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);background:var(--v2-card);color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-sm);font-weight:600;line-height:1.5;white-space:nowrap;overflow-wrap:anywhere}
.v2-forbid-btn:hover{border-color:var(--v2-brand)}
.v2-forbid-btn:active{transform:scale(.97)}
.v2-forbid-btn:focus-visible{box-shadow:var(--v2-focus);outline:none}
.v2-forbid-btn:disabled{background:var(--v2-surface);color:var(--v2-mut);border:1px dashed var(--v2-line);box-shadow:none}
.v2-forbid-opt{box-sizing:border-box;display:flex;align-items:center;justify-content:center;min-width:0;max-width:100%;font-family:var(--v2-font);font-size:var(--v2-text-sm);font-weight:600;white-space:nowrap;overflow-wrap:anywhere}
.v2-forbid-row{display:flex;align-items:center;gap:var(--v2-space-2);box-sizing:border-box;min-width:0;max-width:100%;padding:var(--v2-space-4);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);background:var(--v2-card);font-family:var(--v2-font);overflow-wrap:anywhere}
.v2-forbid-row:hover{border-color:var(--v2-brand)}
.v2-forbid-submit{box-sizing:border-box;min-width:0;max-width:100%;border-color:transparent;background:var(--v2-brand);color:var(--v2-inverse);font-family:var(--v2-font);font-weight:700;overflow-wrap:anywhere}
.v2-forbid-submit:hover{border-color:var(--v2-brand)}
</style>
