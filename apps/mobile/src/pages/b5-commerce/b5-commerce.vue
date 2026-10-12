<script setup lang="ts">
import MobilePageHeader from '../../components/MobilePageHeader.vue'
import AppIcon from '../../components/AppIcon.vue'
import { useMobileExperience } from '../../platform/experience'
const { experienceStyle, experienceMotion } = useMobileExperience()

import { onShow } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { createMobileB5Order, getMobileB5PublicCatalog, listMobileB5Entitlements, listMobileB5Orders, prepareMobileB5Payment } from '../../api/b5'
import { listRecords, money, text, toEntitlement, toOrder, toPublicPlan, type MobileB5Entitlement, type MobileB5Order, type MobileB5PublicPlan } from '../../domain/b5'
import { openUniPage, getUniRuntime } from '../../platform/uni-runtime'
import { useSessionStore } from '../../stores/session'

const session = useSessionStore()
const plans = ref<MobileB5PublicPlan[]>([])
const orders = ref<MobileB5Order[]>([])
const entitlements = ref<MobileB5Entitlement[]>([])
const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
const message = ref('')
const active = computed(() => entitlements.value.filter((item) => item.status === 'ACTIVE'))

async function load(): Promise<void> {
  status.value = 'loading'
  message.value = ''
  try {
    const [catalogResponse, orderResponse, entitlementResponse] = await Promise.all([getMobileB5PublicCatalog(), listMobileB5Orders(), listMobileB5Entitlements()])
    plans.value = listRecords(catalogResponse, 'plans').map(toPublicPlan).filter((item) => item.skuId && item.availability === 'PUBLISHED')
    orders.value = listRecords(orderResponse).map(toOrder)
    entitlements.value = listRecords(entitlementResponse).map(toEntitlement)
    status.value = 'ready'
  } catch (error) { status.value = 'error'; message.value = error instanceof Error ? error.message : '商业化服务暂时不可用。' }
}

async function createOrder(plan: MobileB5PublicPlan): Promise<void> { try { await createMobileB5Order(plan.skuId); await load(); message.value = '订单已创建，请在订单中查看后续状态。' } catch (error) { message.value = error instanceof Error ? error.message : '订单创建失败。' } }
async function recover(order: MobileB5Order): Promise<void> { try { const response = await prepareMobileB5Payment(order.orderId); const data = response && typeof response === 'object' && 'data' in response ? response.data : response; message.value = data && typeof data === 'object' && 'status' in data ? `支付恢复状态：${text(data.status)}` : '支付恢复请求已提交。' } catch (error) { message.value = error instanceof Error ? error.message : '支付恢复失败。' } }
function goBack(): void { openUniPage('/pages/world/world') }

onShow(async () => { await session.restore(); if (!session.isAuthenticated) { getUniRuntime().navigateTo({ url: '/pages/login/login' }); return }; void load() })
</script>

<template>
  <view class="yx-page b5-page v2-shop-page" :style="experienceStyle" :data-motion="experienceMotion">
    <MobilePageHeader page="b5-commerce" />
    <view class="v2-shop-body">
      <view v-if="message" class="b5-message fb d v2-shop-fb v2-shop-d" role="status"><AppIcon name="alert" :size="14" /><text>{{ message }}</text></view>
      <view class="b5-section card v2-shop-card">
        <view class="b5-section__heading v2-shop-head">
          <view class="v2-shop-titles">
            <text class="v2-shop-eyebrow eyebrow"><AppIcon name="ticket" :size="14" /><text>ENTITLEMENTS</text></text>
            <text class="v2-shop-title v2-shop-h2 h2">当前权益</text>
            <text class="b5-muted v2-shop-d d">{{ active.length }} 项</text>
          </view>
        </view>
        <view v-if="active.length" class="b5-list v2-shop-list">
          <view v-for="item in active" :key="item.sourceRef" class="b5-row list-row row v2-shop-row">
            <view class="v2-shop-copy">
              <text class="v2-shop-name v2-shop-h2">{{ item.entitlementCode }}</text>
              <text class="b5-muted v2-shop-d d">有效至 {{ item.expiresAt.slice(0, 10) }}</text>
            </view>
            <text class="b5-status v2-shop-state v2-shop-tag">{{ item.status }}</text>
          </view>
        </view>
        <text v-else class="b5-empty fb d v2-shop-fb v2-shop-d v2-shop-empty">暂无生效权益</text>
      </view>
      <view class="b5-section card v2-shop-card">
        <view class="b5-section__heading v2-shop-head">
          <view class="v2-shop-titles">
            <text class="v2-shop-eyebrow eyebrow"><AppIcon name="store" :size="14" /><text>PLANS</text></text>
            <text class="v2-shop-title v2-shop-h2 h2">学习方案</text>
          </view>
        </view>
        <view v-if="status === 'loading'" class="b5-empty fb d v2-shop-fb v2-shop-d" role="status"><AppIcon name="refresh" :size="14" /><text>正在加载学习方案…</text></view>
        <view v-else-if="!plans.length" class="b5-empty fb d v2-shop-fb v2-shop-d"><AppIcon name="inbox" :size="14" /><text>当前没有可购买的方案。</text></view>
        <view v-else class="b5-plan-list v2-shop-list">
          <view v-for="plan in plans" :key="plan.skuId" class="b5-plan list-row row v2-shop-row">
            <view class="v2-shop-copy">
              <text class="b5-plan__title v2-shop-name v2-shop-h2">{{ plan.title }}</text>
            </view>
            <view class="b5-plan__action v2-shop-actions row">
              <text class="b5-price v2-shop-price">{{ money(plan.amountMinor, plan.currency) }}</text>
              <button tabindex="0" role="button" class="b5-primary btn v2-shop-btn v2-shop-opt v2-shop-submit" type="button" @click="createOrder(plan)">选择方案<AppIcon name="chev" :size="14" /></button>
            </view>
          </view>
        </view>
      </view>
      <view class="b5-section card v2-shop-card">
        <view class="b5-section__heading v2-shop-head">
          <view class="v2-shop-titles">
            <text class="v2-shop-eyebrow eyebrow"><AppIcon name="swap" :size="14" /><text>ORDERS</text></text>
            <text class="v2-shop-title v2-shop-h2 h2">订单恢复</text>
            <text class="b5-muted v2-shop-d d">服务端状态</text>
          </view>
        </view>
        <view v-if="orders.length" class="b5-list v2-shop-list">
          <view v-for="order in orders" :key="order.orderId" class="b5-row list-row row v2-shop-row">
            <view class="v2-shop-copy">
              <text class="v2-shop-name v2-shop-h2">{{ order.orderId }}</text>
              <text class="b5-muted v2-shop-d d">{{ order.skuId }} · {{ money(order.amountMinor, order.currency) }}</text>
            </view>
            <view class="b5-row__right v2-shop-actions row">
              <text class="b5-status v2-shop-state v2-shop-tag">{{ order.status }}</text>
              <button tabindex="0" role="button" v-if="order.status === 'CREATED'" class="b5-secondary btn v2-shop-btn v2-shop-opt" type="button" @click="recover(order)">恢复<AppIcon name="refresh" :size="14" /></button>
            </view>
          </view>
        </view>
        <text v-else class="b5-empty fb d v2-shop-fb v2-shop-d v2-shop-empty">还没有订单</text>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.b5-page{min-height:100vh;padding:30rpx;background:var(--yx-surface-page);color:var(--yx-text-primary)}.b5-topbar{display:flex;align-items:center;gap:16rpx}.b5-back{width:62rpx;height:62rpx;margin:0;padding:0;border:0;border-radius:18rpx;color:var(--yx-brand);background:var(--yx-surface-card);font-size:48rpx;line-height:58rpx}.b5-kicker{display:block;color:var(--yx-brand);font-size:20rpx;font-weight:800;letter-spacing:3rpx}.b5-title{display:block;margin-top:6rpx;font-size:36rpx;font-weight:800}.b5-gate{display:flex;align-items:center;gap:8rpx;margin-left:auto;padding:10rpx 14rpx;border:1rpx solid var(--yx-border);border-radius:999rpx;color:var(--yx-text-secondary);background:var(--yx-surface-card);font-size:20rpx}.b5-dot{width:12rpx;height:12rpx;border-radius:50%;background:var(--yx-warning)}.b5-card,.b5-section{margin-top:24rpx;padding:24rpx;border:1rpx solid var(--yx-border);border-radius:22rpx;background:var(--yx-surface-card)}.b5-hero{display:grid;gap:12rpx;background:linear-gradient(135deg,var(--yx-text-primary),var(--yx-action));color:var(--yx-on-brand)}.b5-hero__title{font-size:38rpx;font-weight:800;line-height:1.35}.b5-muted{display:block;color:var(--yx-text-secondary);font-size:22rpx;line-height:1.55}.b5-hero .b5-muted{color:var(--yx-brand-soft)}.b5-message{margin-top:18rpx;padding:16rpx;border-radius:14rpx;color:var(--yx-success);background:var(--yx-border);font-size:23rpx;line-height:1.55}.b5-section__heading{display:flex;align-items:center;justify-content:space-between;margin-bottom:16rpx;font-size:28rpx;font-weight:750}.b5-list{display:grid;gap:10rpx}.b5-row{display:flex;align-items:center;justify-content:space-between;gap:16rpx;padding:16rpx;border-radius:14rpx;background:var(--yx-surface-page)}.b5-row>view:first-child{display:grid;gap:6rpx}.b5-status{color:var(--yx-success);font-size:21rpx;font-weight:700}.b5-row__right{display:flex;align-items:center;gap:12rpx}.b5-empty{display:block;padding:18rpx;border:1rpx dashed var(--yx-border);border-radius:14rpx;color:var(--yx-text-secondary);font-size:23rpx}.b5-plan-list{display:grid;gap:10rpx}.b5-plan{display:flex;align-items:center;justify-content:space-between;gap:16rpx;padding:18rpx;border-radius:14rpx;background:var(--yx-surface-page)}.b5-plan__title{display:block;font-size:27rpx;font-weight:700}.b5-plan__action{display:flex;align-items:center;gap:14rpx}.b5-price{color:var(--yx-success);font-size:27rpx;font-weight:800}.b5-primary,.b5-secondary{margin:0;padding:12rpx 16rpx;border:0;border-radius:12rpx;font-size:22rpx}.b5-primary{color:var(--yx-on-brand);background:var(--yx-action)}.b5-secondary{color:var(--yx-brand);background:var(--yx-brand-soft)}@media(max-width:520px){.b5-plan{align-items:flex-start;flex-direction:column}.b5-plan__action{width:100%;justify-content:space-between}.b5-hero__title{font-size:32rpx}}
/* v2 商城页换皮：对齐 mobile/styles.css 与 refine.css 中 .card/.eyebrow/.tag/.opt/.btn/.fb/.list-row，对齐 practice.vue v2-practice-* 与 today.vue v2-today-* 同样数值，仅用 var(--v2-*)。 */
.v2-shop-page{box-sizing:border-box;max-width:100%;min-width:0;font-family:var(--v2-font)}
.v2-shop-body{display:flex;flex-direction:column;gap:var(--v2-space-4);box-sizing:border-box;max-width:100%;min-width:0;font-family:var(--v2-font)}
.v2-shop-body>*{min-width:0;max-width:100%}
.v2-shop-card{display:grid;gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;padding:var(--v2-space-5);border:1px solid var(--v2-line);border-radius:var(--v2-radius-lg);background:var(--v2-card);box-shadow:var(--v2-shadow);font-family:var(--v2-font)}
.v2-shop-card:hover{border-color:var(--v2-brand)}
.v2-shop-head{display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;font-family:var(--v2-font)}
.v2-shop-head>*{min-width:0;max-width:100%}
.v2-shop-titles{display:grid;gap:var(--v2-space-1);box-sizing:border-box;max-width:100%;min-width:0;flex:1 1 auto;font-family:var(--v2-font)}
.v2-shop-eyebrow{display:flex;align-items:center;flex-wrap:wrap;gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;margin:0 0 var(--v2-space-2);color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-xs);font-weight:700;letter-spacing:.06em;text-transform:uppercase;overflow-wrap:anywhere}
.v2-shop-title{display:block;box-sizing:border-box;max-width:100%;min-width:0;margin:var(--v2-space-1) 0 0;color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-lg);font-weight:700;line-height:1.45;overflow-wrap:anywhere}
.v2-shop-h2{box-sizing:border-box;max-width:100%;min-width:0;font-family:var(--v2-font);overflow-wrap:anywhere}
.v2-shop-name{display:block;box-sizing:border-box;max-width:100%;min-width:0;color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-lg);font-weight:700;line-height:1.45;overflow-wrap:anywhere}
.v2-shop-d{display:block;box-sizing:border-box;max-width:100%;min-width:0;color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.7;overflow-wrap:anywhere}
.v2-shop-list{display:grid;gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;font-family:var(--v2-font)}
.v2-shop-list>*{min-width:0;max-width:100%}
.v2-shop-row{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;padding:var(--v2-space-4);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);background:var(--v2-card);font-family:var(--v2-font)}
.v2-shop-row:hover{border-color:var(--v2-brand)}
.v2-shop-row>*{min-width:0;max-width:100%}
.v2-shop-copy{display:grid;gap:var(--v2-space-1);box-sizing:border-box;max-width:100%;min-width:0;flex:1 1 auto;font-family:var(--v2-font)}
.v2-shop-actions{display:flex;flex-wrap:wrap;align-items:center;gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;font-family:var(--v2-font)}
.v2-shop-actions>*{min-width:0;max-width:100%}
.v2-shop-btn{box-sizing:border-box;display:flex;align-items:center;justify-content:center;width:100%;max-width:100%;min-width:0;min-height:var(--v2-space-12);padding:var(--v2-space-3) var(--v2-space-4);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);background:var(--v2-card);color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-sm);font-weight:600;line-height:1.5;white-space:nowrap;overflow-wrap:anywhere}
.v2-shop-opt{box-sizing:border-box;display:flex;align-items:center;justify-content:center;width:100%;max-width:100%;min-width:0;min-height:var(--v2-space-12);padding:var(--v2-space-3) var(--v2-space-4);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);background:var(--v2-card);color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-sm);font-weight:600;line-height:1.5;white-space:nowrap;overflow-wrap:anywhere}
.v2-shop-btn:hover,.v2-shop-opt:hover{border-color:var(--v2-brand)}
.v2-shop-btn:active,.v2-shop-opt:active{transform:scale(.97)}
.v2-shop-btn:focus-visible,.v2-shop-opt:focus-visible{box-shadow:var(--v2-focus);outline:none}
.v2-shop-btn:disabled,.v2-shop-opt:disabled{background:var(--v2-surface);color:var(--v2-mut);border:1px dashed var(--v2-line);box-shadow:none}
.v2-shop-submit{border-color:transparent;background:var(--v2-brand);color:var(--v2-inverse);font-family:var(--v2-font);font-weight:700;white-space:nowrap}
.v2-shop-submit:hover{border-color:var(--v2-brand)}
.v2-shop-tag{display:inline-flex;align-items:center;justify-self:start;box-sizing:border-box;max-width:100%;min-width:0;padding:var(--v2-space-1) var(--v2-space-2);border-radius:var(--v2-radius-pill);background:var(--v2-soft);color:var(--v2-brand);font-family:var(--v2-font);font-size:var(--v2-text-xs);font-weight:700;line-height:1.5;overflow-wrap:anywhere}
.v2-shop-state{display:inline-flex;align-items:center;box-sizing:border-box;max-width:100%;min-width:0;padding:var(--v2-space-1) var(--v2-space-2);border-radius:var(--v2-radius-pill);background:var(--v2-ok-soft);color:var(--v2-ok);font-family:var(--v2-font);font-size:var(--v2-text-xs);font-weight:700;line-height:1.5;overflow-wrap:anywhere}
.v2-shop-price{box-sizing:border-box;max-width:100%;min-width:0;color:var(--v2-ok);font-family:var(--v2-font);font-size:var(--v2-text-lg);font-weight:800;line-height:1.2;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
.v2-shop-fb{display:block;box-sizing:border-box;max-width:100%;min-width:0;margin-top:var(--v2-space-4);padding:var(--v2-space-3) var(--v2-space-4);border-radius:var(--v2-radius-md);background:var(--v2-surface);color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.7;overflow-wrap:anywhere}
.v2-shop-empty{display:grid;gap:var(--v2-space-2);box-sizing:border-box;max-width:100%;min-width:0;padding:var(--v2-space-4);border:1px dashed var(--v2-line);border-radius:var(--v2-radius-md);color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.7;overflow-wrap:anywhere}
</style>
