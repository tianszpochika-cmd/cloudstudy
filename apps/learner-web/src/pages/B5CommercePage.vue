<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ApiError } from '../api/client'
import { createB5Order, listB5Entitlements, listB5Orders, listB5Skus, prepareB5Payment, redeemB5ActivationCode } from '../api/b5'
import { formatMinorAmount, listRecords, toEntitlement, toOrder, toSku, type B5Entitlement, type B5Order, type B5Sku } from '../domain/b5'

const skus = ref<B5Sku[]>([])
const orders = ref<B5Order[]>([])
const entitlements = ref<B5Entitlement[]>([])
const selectedSku = ref<B5Sku | null>(null)
const loading = ref(true)
const actionMessage = ref('')
const errorMessage = ref('')
const activationCode = ref('')

const activeEntitlements = computed(() => entitlements.value.filter((item) => item.status === 'ACTIVE'))

async function load(): Promise<void> {
  loading.value = true
  errorMessage.value = ''
  try {
    const [skuResponse, entitlementResponse, orderResponse] = await Promise.all([listB5Skus(), listB5Entitlements(), listB5Orders()])
    skus.value = listRecords(skuResponse).map(toSku).filter((item) => item.status === 'ACTIVE')
    entitlements.value = listRecords(entitlementResponse).map(toEntitlement)
    orders.value = listRecords(orderResponse).map(toOrder)
  } catch (error) {
    errorMessage.value = error instanceof ApiError ? error.message : '商业化服务暂时不可用，请稍后重试。'
  } finally {
    loading.value = false
  }
}

async function createOrder(sku: B5Sku): Promise<void> {
  selectedSku.value = sku
  actionMessage.value = ''
  errorMessage.value = ''
  try {
    const response = await createB5Order(sku.skuId)
    const created = listRecords({ items: [response] }).map(toOrder)[0]
    actionMessage.value = created?.orderId ? `订单 ${created.orderId} 已创建，支付渠道仍处于沙箱关闭状态。` : '订单已创建，等待服务端返回状态。'
    await load()
  } catch (error) {
    errorMessage.value = error instanceof ApiError ? error.message : '订单创建失败。'
  }
}

async function preparePayment(order: B5Order): Promise<void> {
  actionMessage.value = ''
  errorMessage.value = ''
  try {
    const response = await prepareB5Payment(order.orderId, order.channelCode || 'WECHAT')
    const data = response && typeof response === 'object' && 'data' in response ? response.data : response
    const status = data && typeof data === 'object' && 'status' in data ? String(data.status) : 'UNKNOWN'
    actionMessage.value = status === 'DISABLED' ? '支付通道已按发布闸门关闭；真实微信/支付宝/Apple 沙箱联调放在测试阶段。' : `支付准备状态：${status}`
  } catch (error) {
    errorMessage.value = error instanceof ApiError ? error.message : '支付准备失败。'
  }
}

async function redeem(): Promise<void> {
  if (!activationCode.value.trim()) return
  actionMessage.value = ''
  errorMessage.value = ''
  try {
    await redeemB5ActivationCode(activationCode.value.trim())
    activationCode.value = ''
    actionMessage.value = '激活码兑换成功，权益已写入账户。'
    await load()
  } catch (error) {
    errorMessage.value = error instanceof ApiError ? error.message : '激活码兑换失败。'
  }
}

onMounted(() => { void load() })
</script>

<template>
  <section class="commerce-page">
    <div class="commerce-hero">
      <div>
        <p class="eyebrow">B5 · COMMERCE</p>
        <h2>让学习权益，跟着目标一起成长。</h2>
        <p>价格、金额、订单和权益都由服务端事实驱动；客户端不自行判断支付成功。</p>
      </div>
      <div class="commerce-hero__status"><span class="status-dot" aria-hidden="true"></span><span>支付通道：沙箱关闭</span></div>
    </div>

    <div v-if="errorMessage" class="commerce-alert commerce-alert--error" role="alert">{{ errorMessage }} <button type="button" @click="load">重试</button></div>
    <div v-if="actionMessage" class="commerce-alert commerce-alert--success" role="status">{{ actionMessage }}</div>

    <div class="commerce-grid">
      <section class="commerce-panel commerce-panel--wide">
        <div class="panel-heading"><div><p class="panel-kicker">PLANS</p><h3>选择学习方案</h3></div><span class="fact-tag">金额单位：分</span></div>
        <div v-if="loading" class="empty-copy">正在读取服务端 SKU…</div>
        <div v-else class="plan-grid">
          <article v-for="sku in skus" :key="sku.skuId" class="plan-card" :class="{ 'plan-card--selected': selectedSku?.skuId === sku.skuId }">
            <span class="plan-card__period">{{ sku.billingPeriod }}</span>
            <h4>{{ sku.title }}</h4>
            <strong>{{ formatMinorAmount(sku.amountMinor, sku.currency) }}</strong>
            <p>{{ sku.entitlementCode }} · {{ sku.status }}</p>
            <button class="button button--primary" type="button" @click="createOrder(sku)">创建订单</button>
          </article>
        </div>
      </section>

      <section class="commerce-panel">
        <div class="panel-heading"><div><p class="panel-kicker">ENTITLEMENTS</p><h3>我的权益</h3></div><span class="fact-tag">{{ activeEntitlements.length }} 项生效</span></div>
        <div v-if="activeEntitlements.length" class="fact-list"><div v-for="item in activeEntitlements" :key="item.sourceRef" class="fact-row"><span>{{ item.entitlementCode }}</span><strong>{{ item.status }}</strong><small>有效至 {{ item.expiresAt.slice(0, 10) }}</small></div></div>
        <p v-else class="empty-copy">暂未发现生效权益，先完成一个学习目标吧。</p>
        <div class="activation-box"><label for="activation-code">激活码兑换</label><div class="activation-box__row"><input id="activation-code" v-model="activationCode" placeholder="输入激活码" autocomplete="off"><button class="button button--secondary" type="button" :disabled="!activationCode.trim()" @click="redeem">兑换</button></div><small>客户端只提交兑换动作，服务端负责一次性消费与审计。</small></div>
      </section>

      <section class="commerce-panel commerce-panel--wide">
        <div class="panel-heading"><div><p class="panel-kicker">ORDERS</p><h3>订单与支付恢复</h3></div><span class="fact-tag">服务端状态</span></div>
        <div v-if="orders.length" class="order-list"><div v-for="order in orders" :key="order.orderId" class="order-row"><div><strong>{{ order.orderId }}</strong><span>{{ order.skuId }} · {{ formatMinorAmount(order.amountMinor, order.currency) }}</span></div><div class="order-row__right"><span class="status-pill">{{ order.status }}</span><button v-if="order.status === 'CREATED'" class="button button--ghost" type="button" @click="preparePayment(order)">恢复支付</button></div></div></div>
        <p v-else class="empty-copy">还没有订单。创建订单后，支付失败或通道关闭时可从这里恢复。</p>
      </section>
    </div>
  </section>
</template>

<style scoped>
.commerce-page{display:grid;gap:24px}.commerce-hero{display:flex;align-items:flex-start;justify-content:space-between;gap:24px;padding:28px;border-radius:24px;background:linear-gradient(135deg,#1e2b62,#596bff);color:#fff}.commerce-hero h2{margin:8px 0;font-size:clamp(26px,4vw,42px);letter-spacing:-1px}.commerce-hero p{max-width:680px;color:rgba(255,255,255,.8);line-height:1.65}.commerce-hero .eyebrow{color:#d7dcff;letter-spacing:2px;font-size:12px;font-weight:800}.commerce-hero__status{display:flex;align-items:center;gap:8px;white-space:nowrap;padding:10px 12px;border:1px solid rgba(255,255,255,.22);border-radius:999px;background:rgba(255,255,255,.12);font-size:13px}.commerce-hero__status .status-dot{background:#ffc857}.commerce-alert{padding:12px 16px;border-radius:12px;font-size:14px}.commerce-alert button{margin-left:8px;border:0;background:none;text-decoration:underline;cursor:pointer}.commerce-alert--error{color:#9d2936;background:#fff0f1}.commerce-alert--success{color:#1f6c51;background:#eaf8f1}.commerce-grid{display:grid;grid-template-columns:1.45fr 1fr;gap:20px}.commerce-panel{padding:24px;border:1px solid #e4e7f1;border-radius:20px;background:#fff;box-shadow:0 10px 28px rgba(39,52,100,.06)}.commerce-panel--wide{grid-column:span 2}.panel-heading{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:18px}.panel-kicker{margin:0;color:#596bff;font-size:11px;font-weight:800;letter-spacing:2px}.panel-heading h3{margin:6px 0 0;font-size:22px}.fact-tag{color:#6c7488;font-size:12px}.plan-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}.plan-card{display:flex;flex-direction:column;gap:10px;min-height:210px;padding:18px;border:1px solid #e4e7f1;border-radius:16px;background:#fafbff}.plan-card--selected{border-color:#596bff;box-shadow:0 0 0 3px #eef0ff}.plan-card h4{margin:0;font-size:17px}.plan-card strong{font-size:26px;color:#293460}.plan-card p{margin:0;min-height:36px;color:#6c7488;font-size:12px}.plan-card__period{color:#596bff;font-size:11px;font-weight:800;letter-spacing:1px}.button{padding:10px 14px;border:0;border-radius:10px;font:inherit;font-size:13px;font-weight:700;cursor:pointer}.button:disabled{opacity:.45;cursor:not-allowed}.button--primary{color:#fff;background:#596bff}.button--secondary{color:#3d4ed3;background:#eef0ff}.button--ghost{padding:7px 10px;color:#596bff;background:#f5f6fb}.empty-copy{margin:0;padding:16px;border:1px dashed #d9ddea;border-radius:12px;color:#6c7488;line-height:1.6;font-size:14px}.fact-list,.order-list{display:grid;gap:9px}.fact-row{display:grid;grid-template-columns:1fr auto;gap:4px;padding:12px;border-radius:12px;background:#f7f8fc}.fact-row strong{color:#27775b;font-size:12px}.fact-row small{grid-column:1 / -1;color:#6c7488}.activation-box{display:grid;gap:9px;margin-top:20px;padding-top:18px;border-top:1px solid #edf0f6}.activation-box label{font-size:13px;font-weight:700}.activation-box__row{display:flex;gap:8px}.activation-box input{min-width:0;flex:1;padding:10px 12px;border:1px solid #dce1ef;border-radius:10px;font:inherit}.activation-box small{color:#6c7488;line-height:1.5}.order-row{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 16px;border-radius:12px;background:#f7f8fc}.order-row>div:first-child{display:grid;gap:5px}.order-row span{color:#6c7488;font-size:12px}.order-row__right{display:flex;align-items:center;gap:10px}.status-pill{padding:5px 9px;border-radius:999px;color:#596bff;background:#eef0ff;font-size:11px;font-weight:800}@media (max-width:900px){.commerce-grid{grid-template-columns:1fr}.commerce-panel--wide{grid-column:auto}.plan-grid{grid-template-columns:repeat(2,1fr)}}@media (max-width:620px){.commerce-hero{display:grid;padding:20px}.commerce-hero__status{justify-self:start}.plan-grid{grid-template-columns:1fr}.order-row{align-items:flex-start;flex-direction:column}.order-row__right{width:100%;justify-content:space-between}}
</style>
