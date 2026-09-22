<script setup lang="ts">
import MobilePageHeader from '../../components/MobilePageHeader.vue'
import { useMobileExperience } from '../../platform/experience'
const { experienceStyle, experienceMotion } = useMobileExperience()

import { onShow } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { createMobileB5Order, listMobileB5Entitlements, listMobileB5Orders, listMobileB5Skus, prepareMobileB5Payment } from '../../api/b5'
import { listRecords, money, text, toEntitlement, toOrder, toSku, type MobileB5Entitlement, type MobileB5Order, type MobileB5Sku } from '../../domain/b5'
import { openUniPage, getUniRuntime } from '../../platform/uni-runtime'
import { useSessionStore } from '../../stores/session'

const session = useSessionStore()
const skus = ref<MobileB5Sku[]>([])
const orders = ref<MobileB5Order[]>([])
const entitlements = ref<MobileB5Entitlement[]>([])
const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
const message = ref('')
const active = computed(() => entitlements.value.filter((item) => item.status === 'ACTIVE'))

async function load(): Promise<void> {
  status.value = 'loading'
  message.value = ''
  try {
    const [skuResponse, orderResponse, entitlementResponse] = await Promise.all([listMobileB5Skus(), listMobileB5Orders(), listMobileB5Entitlements()])
    skus.value = listRecords(skuResponse).map(toSku).filter((item) => item.status === 'ACTIVE')
    orders.value = listRecords(orderResponse).map(toOrder)
    entitlements.value = listRecords(entitlementResponse).map(toEntitlement)
    status.value = 'ready'
  } catch (error) { status.value = 'error'; message.value = error instanceof Error ? error.message : '商业化服务暂时不可用。' }
}

async function createOrder(sku: MobileB5Sku): Promise<void> { try { await createMobileB5Order(sku.skuId); message.value = '订单已创建；支付通道按服务端发布闸门保持关闭。'; await load() } catch (error) { message.value = error instanceof Error ? error.message : '订单创建失败。' } }
async function recover(order: MobileB5Order): Promise<void> { try { const response = await prepareMobileB5Payment(order.orderId); const data = response && typeof response === 'object' && 'data' in response ? response.data : response; message.value = data && typeof data === 'object' && 'status' in data ? `支付恢复状态：${text(data.status)}` : '支付恢复请求已提交。' } catch (error) { message.value = error instanceof Error ? error.message : '支付恢复失败。' } }
function goBack(): void { openUniPage('/pages/world/world') }

onShow(async () => { await session.restore(); if (!session.isAuthenticated) { getUniRuntime().navigateTo({ url: '/pages/login/login' }); return }; void load() })
</script>

<template>
  <view class="yx-page b5-page" :style="experienceStyle" :data-motion="experienceMotion"><MobilePageHeader page="b5-commerce" /><view class="b5-access-note">当前以已开放权益为准，支付是否可用请查看订单提示。</view><view v-if="message" class="b5-message">{{ message }}</view><view class="b5-section"><view class="b5-section__heading"><text>当前权益</text><text class="b5-muted">{{ active.length }} 项</text></view><view v-if="active.length" class="b5-list"><view v-for="item in active" :key="item.sourceRef" class="b5-row"><view><text>{{ item.entitlementCode }}</text><text class="b5-muted">有效至 {{ item.expiresAt.slice(0, 10) }}</text></view><text class="b5-status">{{ item.status }}</text></view></view><text v-else class="b5-empty">暂无生效权益</text></view><view class="b5-section"><view class="b5-section__heading"><text>学习方案</text><text class="b5-muted">课程与学习方案</text></view><view v-if="status === 'loading'" class="b5-empty">正在加载学习方案…</view><view v-else class="b5-plan-list"><view v-for="sku in skus" :key="sku.skuId" class="b5-plan"><view><text class="b5-plan__title">{{ sku.title }}</text><text class="b5-muted">{{ sku.billingPeriod }} · {{ sku.skuId }}</text></view><view class="b5-plan__action"><text class="b5-price">{{ money(sku.amountMinor, sku.currency) }}</text><button tabindex="0" role="button" class="b5-primary" type="button" @click="createOrder(sku)">创建订单</button></view></view></view></view><view class="b5-section"><view class="b5-section__heading"><text>订单恢复</text><text class="b5-muted">服务端状态</text></view><view v-if="orders.length" class="b5-list"><view v-for="order in orders" :key="order.orderId" class="b5-row"><view><text>{{ order.orderId }}</text><text class="b5-muted">{{ order.skuId }} · {{ money(order.amountMinor, order.currency) }}</text></view><view class="b5-row__right"><text class="b5-status">{{ order.status }}</text><button tabindex="0" role="button" v-if="order.status === 'CREATED'" class="b5-secondary" type="button" @click="recover(order)">恢复</button></view></view></view><text v-else class="b5-empty">还没有订单</text></view></view>
</template>

<style scoped lang="scss">
.b5-page{min-height:100vh;padding:30rpx;background:var(--yx-surface-page);color:var(--yx-text-primary)}.b5-topbar{display:flex;align-items:center;gap:16rpx}.b5-back{width:62rpx;height:62rpx;margin:0;padding:0;border:0;border-radius:18rpx;color:var(--yx-brand);background:var(--yx-surface-card);font-size:48rpx;line-height:58rpx}.b5-kicker{display:block;color:var(--yx-brand);font-size:20rpx;font-weight:800;letter-spacing:3rpx}.b5-title{display:block;margin-top:6rpx;font-size:36rpx;font-weight:800}.b5-gate{display:flex;align-items:center;gap:8rpx;margin-left:auto;padding:10rpx 14rpx;border:1rpx solid var(--yx-border);border-radius:999rpx;color:var(--yx-text-secondary);background:var(--yx-surface-card);font-size:20rpx}.b5-dot{width:12rpx;height:12rpx;border-radius:50%;background:var(--yx-warning)}.b5-card,.b5-section{margin-top:24rpx;padding:24rpx;border:1rpx solid var(--yx-border);border-radius:22rpx;background:var(--yx-surface-card)}.b5-hero{display:grid;gap:12rpx;background:linear-gradient(135deg,var(--yx-text-primary),var(--yx-action));color:var(--yx-on-brand)}.b5-hero__title{font-size:38rpx;font-weight:800;line-height:1.35}.b5-muted{display:block;color:var(--yx-text-secondary);font-size:22rpx;line-height:1.55}.b5-hero .b5-muted{color:var(--yx-brand-soft)}.b5-message{margin-top:18rpx;padding:16rpx;border-radius:14rpx;color:var(--yx-success);background:var(--yx-border);font-size:23rpx;line-height:1.55}.b5-section__heading{display:flex;align-items:center;justify-content:space-between;margin-bottom:16rpx;font-size:28rpx;font-weight:750}.b5-list{display:grid;gap:10rpx}.b5-row{display:flex;align-items:center;justify-content:space-between;gap:16rpx;padding:16rpx;border-radius:14rpx;background:var(--yx-surface-page)}.b5-row>view:first-child{display:grid;gap:6rpx}.b5-status{color:var(--yx-success);font-size:21rpx;font-weight:700}.b5-row__right{display:flex;align-items:center;gap:12rpx}.b5-empty{display:block;padding:18rpx;border:1rpx dashed var(--yx-border);border-radius:14rpx;color:var(--yx-text-secondary);font-size:23rpx}.b5-plan-list{display:grid;gap:10rpx}.b5-plan{display:flex;align-items:center;justify-content:space-between;gap:16rpx;padding:18rpx;border-radius:14rpx;background:var(--yx-surface-page)}.b5-plan__title{display:block;font-size:27rpx;font-weight:700}.b5-plan__action{display:flex;align-items:center;gap:14rpx}.b5-price{color:var(--yx-success);font-size:27rpx;font-weight:800}.b5-primary,.b5-secondary{margin:0;padding:12rpx 16rpx;border:0;border-radius:12rpx;font-size:22rpx}.b5-primary{color:var(--yx-on-brand);background:var(--yx-action)}.b5-secondary{color:var(--yx-brand);background:var(--yx-brand-soft)}@media(max-width:520px){.b5-plan{align-items:flex-start;flex-direction:column}.b5-plan__action{width:100%;justify-content:space-between}.b5-hero__title{font-size:32rpx}}
</style>
