<script setup lang="ts">
import ExperienceHeader from '../components/ExperienceHeader.vue'
import { computed, onMounted, ref } from 'vue'
import { createB5Order, listB5Entitlements, listB5Orders, prepareB5Payment, readB5PublicCatalog, redeemB5ActivationCode, requestB5Refund } from '../api/b5'
import { formatMinorAmount, listRecords, toEntitlement, toOrder, toPublicPlan, type B5Entitlement, type B5Order, type B5PublicPlan } from '../domain/b5'
import { userFacingError } from '../platform/user-facing-error'

const plans = ref<B5PublicPlan[]>([])
const orders = ref<B5Order[]>([])
const entitlements = ref<B5Entitlement[]>([])
const selectedPlan = ref<B5PublicPlan | null>(null)
const loading = ref(true)
const actionMessage = ref('')
const errorMessage = ref('')
const activationCode = ref('')
const refundTarget = ref<B5Order | null>(null)

const activeEntitlements = computed(() => entitlements.value.filter((item) => item.status === 'ACTIVE'))
const periodLabel: Record<B5PublicPlan['billingPeriod'], string> = { FREE: '免费', MONTH: '每月', QUARTER: '每季', YEAR: '每年', PERPETUAL: '一次性' }
const orderStatusLabel: Record<string, string> = { CREATED: '待支付', PAID: '已支付', REFUNDED: '已退款', REFUND_PENDING: '退款处理中', CANCELLED: '已取消', FAILED: '支付失败' }

async function load(): Promise<void> {
  loading.value = true
  errorMessage.value = ''
  const [catalog, accountEntitlements, accountOrders] = await Promise.allSettled([readB5PublicCatalog(), listB5Entitlements(), listB5Orders()])
  plans.value = catalog.status === 'fulfilled' ? listRecords(catalog.value, 'plans').map(toPublicPlan).filter((plan): plan is B5PublicPlan => plan !== null) : []
  entitlements.value = accountEntitlements.status === 'fulfilled' ? listRecords(accountEntitlements.value).map(toEntitlement) : []
  orders.value = accountOrders.status === 'fulfilled' ? listRecords(accountOrders.value).map(toOrder) : []
  if (catalog.status === 'rejected') errorMessage.value = userFacingError(catalog.reason instanceof Error ? catalog.reason.message : null, '学习方案暂时无法读取，请稍后重试。')
  else if (accountEntitlements.status === 'rejected' || accountOrders.status === 'rejected') errorMessage.value = '账户权益或订单暂时无法读取，请稍后重试。'
  loading.value = false
}

async function createOrder(plan: B5PublicPlan): Promise<void> {
  if (plan.availability !== 'PUBLISHED' || !plans.value.some((item) => item.planId === plan.planId)) return
  selectedPlan.value = plan
  actionMessage.value = ''
  errorMessage.value = ''
  try {
    const response = await createB5Order(plan.skuId)
    const created = listRecords({ items: [response] }).map(toOrder)[0]
    actionMessage.value = created?.orderId ? '订单已创建，可在下方查看进度。' : '订单已创建，正在等待确认。'
    await load()
  } catch (error) {
    errorMessage.value = userFacingError(error instanceof Error ? error.message : null, '订单创建失败，请稍后重试。')
  }
}

async function preparePayment(order: B5Order): Promise<void> {
  actionMessage.value = ''
  errorMessage.value = ''
  try {
    const response = await prepareB5Payment(order.orderId, order.channelCode || 'SANDBOX')
    const data = response && typeof response === 'object' && 'data' in response ? response.data : response
    const status = data && typeof data === 'object' && 'status' in data ? String(data.status) : 'UNKNOWN'
    actionMessage.value = status === 'DISABLED' ? '支付暂未开放，请稍后再试。' : '已更新支付状态。'
  } catch (error) {
    errorMessage.value = userFacingError(error instanceof Error ? error.message : null, '支付暂时无法继续，请稍后重试。')
  }
}

function askRefund(order: B5Order): void {
  refundTarget.value = order
  actionMessage.value = ''
  errorMessage.value = ''
}

function cancelRefund(): void {
  refundTarget.value = null
}

async function confirmRefund(): Promise<void> {
  const order = refundTarget.value
  if (!order) return
  refundTarget.value = null
  actionMessage.value = ''
  errorMessage.value = ''
  try {
    await requestB5Refund(order.orderId, 'USER_REQUEST')
    actionMessage.value = '退款申请已提交，可在下方查看进度。'
    await load()
  } catch (error) {
    errorMessage.value = userFacingError(error instanceof Error ? error.message : null, '退款申请失败，请稍后重试。')
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
    errorMessage.value = userFacingError(error instanceof Error ? error.message : null, '激活码兑换失败，请核对后重试。')
  }
}

onMounted(() => { void load() })
</script>

<template>
  <section class="commerce-page v2-page v2-page--b5commerce">
    <ExperienceHeader class="v2-b5commerce-head" page="Commerce" icon="wallet" title-id="commerce-title" />

    <div class="v2-b5commerce-body"><div class="v2-b5commerce-main">
    <div v-if="errorMessage" class="commerce-alert commerce-alert--error v2-b5commerce-alert" role="alert">{{ errorMessage }} <button type="button" @click="load">重试</button></div>
    <div v-if="actionMessage" class="commerce-alert commerce-alert--success v2-b5commerce-alert" role="status">{{ actionMessage }}</div>

    <div class="commerce-grid v2-b5commerce-grid">
      <section class="commerce-panel commerce-panel--wide v2-b5commerce-card">
        <div class="panel-heading"><div><p class="panel-kicker v2-b5commerce-kicker">选择学习方案<span class="v2-sr-only">学习方案</span></p><h3>选择学习方案</h3></div></div>
        <div v-if="loading" class="empty-copy">正在读取学习方案…</div>
        <p v-else-if="!plans.length" class="empty-copy">暂无可购买的学习方案。</p>
        <div v-else class="plan-grid">
          <article v-for="plan in plans" :key="plan.planId" class="plan-card" :class="{ 'plan-card--selected': selectedPlan?.planId === plan.planId }">
            <span class="plan-card__period">{{ periodLabel[plan.billingPeriod] }}</span>
            <h4>{{ plan.title }}</h4>
            <strong>{{ formatMinorAmount(plan.amountMinor, plan.currency) }}</strong>
            <p v-if="plan.availability !== 'PUBLISHED'">{{ plan.availability === 'COMING_SOON' ? '即将开放' : '暂不可购买' }}</p>
            <button v-if="plan.availability === 'PUBLISHED'" class="button button--primary" type="button" @click="createOrder(plan)">创建订单</button>
          </article>
        </div>
      </section>

      <section class="commerce-panel v2-b5commerce-card">
        <div class="panel-heading"><div><p class="panel-kicker v2-b5commerce-kicker">我的权益<span class="v2-sr-only">已获权益</span></p><h3>我的权益</h3></div><span class="fact-tag">{{ activeEntitlements.length }} 项生效</span></div>
        <div v-if="activeEntitlements.length" class="fact-list"><div v-for="item in activeEntitlements" :key="item.sourceRef" class="fact-row"><span>学习权益</span><strong>使用中</strong><small v-if="item.expiresAt">有效至 {{ item.expiresAt.slice(0, 10) }}</small></div></div>
        <p v-else class="empty-copy">暂未开通学习权益。</p>
        <div class="activation-box"><label for="activation-code">激活码兑换</label><div class="activation-box__row"><input id="activation-code" v-model="activationCode" placeholder="输入激活码" autocomplete="off"><button class="button button--secondary" type="button" :disabled="!activationCode.trim()" @click="redeem">兑换</button><small v-if="!activationCode.trim()" class="disabled-reason" data-disabled-reason>输入激活码后可兑换。</small></div><small>兑换后可在上方查看已生效的学习权益。</small></div>
      </section>

      <section class="commerce-panel commerce-panel--wide v2-b5commerce-card">
        <div class="panel-heading"><div><p class="panel-kicker v2-b5commerce-kicker">我的订单<span class="v2-sr-only">订单</span></p><h3>我的订单</h3></div></div>
        <div v-if="orders.length" class="order-list"><div v-for="order in orders" :key="order.orderId" class="order-row"><div><strong>订单 {{ order.orderId }}</strong><span>{{ formatMinorAmount(order.amountMinor, order.currency) }}</span></div><div class="order-row__right"><span class="status-pill">{{ orderStatusLabel[order.status] ?? '处理中' }}</span><button v-if="order.status === 'CREATED'" class="button button--ghost" type="button" @click="preparePayment(order)">恢复支付</button><button v-if="order.status === 'PAID'" class="button button--ghost" type="button" @click="askRefund(order)">申请退款</button></div></div></div>
        <p v-else class="empty-copy">还没有订单。</p>
        <div v-if="refundTarget" class="activation-box" role="dialog" aria-label="退款二次确认"><label>确认退款 {{ refundTarget.orderId }}？</label><small>服务端确认后订单进入退款流程，对应权益将被撤销；该操作不可撤销。</small><div class="activation-box__row"><button class="button button--primary" type="button" @click="confirmRefund">确认退款</button><button class="button button--secondary" type="button" @click="cancelRefund">取消</button></div></div>
      </section>
    </div>
    </div><aside class="v2-b5commerce-rail" aria-label="订阅提示"><h2>订阅提示</h2><ol><li>未开放方案会标注状态，暂不可创建订单。</li><li>激活码兑换后，可在本页查看已生效的学习权益。</li><li>订单状态与退款进度在本页查看，退款需服务端确认。</li></ol></aside></div>
  </section>
</template>

<style scoped>
.commerce-page{display:grid;gap:24px}.commerce-hero{display:flex;align-items:flex-start;justify-content:space-between;gap:24px;padding:28px;border-radius:24px;background:linear-gradient(135deg,var(--yx-color-text-primary),var(--yx-color-brand-primary));color:var(--yx-color-on-brand)}.commerce-hero h2{margin:8px 0;font-size:clamp(26px,4vw,42px);letter-spacing:-1px}.commerce-hero p{max-width:680px;color:color-mix(in srgb,var(--yx-color-on-brand) 80%, transparent);line-height:1.65}.commerce-hero .eyebrow{color:var(--yx-color-brand-primary-soft);letter-spacing:2px;font-size:12px;font-weight:800}.commerce-hero__status{display:flex;align-items:center;gap:8px;white-space:nowrap;padding:10px 12px;border:1px solid color-mix(in srgb,var(--yx-color-surface-card) 22%, transparent);border-radius:999px;background:color-mix(in srgb,var(--yx-color-surface-card) 12%, transparent);font-size:13px}.commerce-hero__status .status-dot{background:var(--yx-color-warning)}.commerce-alert{padding:12px 16px;border-radius:12px;font-size:14px}.commerce-alert button{margin-left:8px;border:0;background:none;text-decoration:underline;cursor:pointer}.commerce-alert--error{color:var(--yx-color-danger);background:var(--yx-color-danger-soft)}.commerce-alert--success{color:var(--yx-color-success);background:var(--yx-color-success-soft)}.commerce-grid{display:grid;grid-template-columns:1.45fr 1fr;gap:20px}.commerce-panel{padding:24px;border:1px solid var(--yx-color-border);border-radius:20px;background:var(--yx-color-surface-card);box-shadow:0 10px 28px color-mix(in srgb,var(--yx-color-brand-primary) 6%, transparent)}.commerce-panel--wide{grid-column:span 2}.panel-heading{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:18px}.panel-kicker{margin:0;color:var(--yx-color-brand-primary);font-size:11px;font-weight:800;letter-spacing:2px}.panel-heading h3{margin:6px 0 0;font-size:22px}.fact-tag{color:var(--yx-color-text-secondary);font-size:12px}.plan-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}.plan-card{display:flex;flex-direction:column;gap:10px;min-height:210px;padding:18px;border:1px solid var(--yx-color-border);border-radius:16px;background:var(--yx-color-surface-card)}.plan-card--selected{border-color:var(--yx-color-brand-primary);box-shadow:0 0 0 3px var(--yx-color-brand-primary-soft)}.plan-card h4{margin:0;font-size:17px}.plan-card strong{font-size:26px;color:var(--yx-color-brand-primary)}.plan-card p{margin:0;min-height:36px;color:var(--yx-color-text-secondary);font-size:12px}.plan-card__period{color:var(--yx-color-brand-primary);font-size:11px;font-weight:800;letter-spacing:1px}.button{padding:10px 14px;border:0;border-radius:10px;font:inherit;font-size:13px;font-weight:700;cursor:pointer}.button:disabled{opacity:.45;cursor:not-allowed}.button--primary{color:var(--yx-color-on-brand);background:var(--yx-color-brand-primary)}.button--secondary{color:var(--yx-color-brand-primary);background:var(--yx-color-brand-primary-soft)}.button--ghost{padding:7px 10px;color:var(--yx-color-brand-primary);background:var(--yx-color-surface-muted)}.empty-copy{margin:0;padding:16px;border:1px dashed var(--yx-color-border);border-radius:12px;color:var(--yx-color-text-secondary);line-height:1.6;font-size:14px}.fact-list,.order-list{display:grid;gap:9px}.fact-row{display:grid;grid-template-columns:1fr auto;gap:4px;padding:12px;border-radius:12px;background:var(--yx-color-surface-page)}.fact-row strong{color:var(--yx-color-success);font-size:12px}.fact-row small{grid-column:1 / -1;color:var(--yx-color-text-secondary)}.activation-box{display:grid;gap:9px;margin-top:20px;padding-top:18px;border-top:1px solid var(--yx-color-surface-muted)}.activation-box label{font-size:13px;font-weight:700}.activation-box__row{display:flex;gap:8px}.activation-box input{min-width:0;flex:1;padding:10px 12px;border:1px solid var(--yx-color-border);border-radius:10px;font:inherit}.activation-box small{color:var(--yx-color-text-secondary);line-height:1.5}.order-row{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 16px;border-radius:12px;background:var(--yx-color-surface-page)}.order-row>div:first-child{display:grid;gap:5px}.order-row span{color:var(--yx-color-text-secondary);font-size:12px}.order-row__right{display:flex;align-items:center;gap:10px}.status-pill{padding:5px 9px;border-radius:999px;color:var(--yx-color-brand-primary);background:var(--yx-color-brand-primary-soft);font-size:11px;font-weight:800}@media (max-width:900px){.commerce-grid{grid-template-columns:1fr}.commerce-panel--wide{grid-column:auto}.plan-grid{grid-template-columns:repeat(2,1fr)}}@media (max-width:620px){.commerce-hero{display:grid;padding:20px}.commerce-hero__status{justify-self:start}.plan-grid{grid-template-columns:1fr}.order-row{align-items:flex-start;flex-direction:column}.order-row__right{width:100%;justify-content:space-between}}
</style>

<style>
/* v2 B5Commerce 页面级布局（只做样式）：对齐 webDemo learner-web 原型普通内容页（.desktop-body 两栏卡片 + .desktop-dashboard 主列+侧栏）与卡片/标签风格。
 * 选择器全部以 .v2-page--b5commerce 开头；颜色只用 --v2-* tokens，不写死色值以适配暗色。 */
.v2-page--b5commerce.commerce-page{background:var(--v2-bg);color:var(--v2-ink);font-family:var(--v2-font);display:grid;gap:var(--v2-space-5);align-items:start;align-content:start;min-width:0}
.v2-page--b5commerce .v2-b5commerce-head{min-width:0}
.v2-page--b5commerce .v2-b5commerce-body{display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:var(--v2-space-5);align-items:start;min-width:0}
.v2-page--b5commerce .v2-b5commerce-main{display:grid;gap:var(--v2-space-5);align-content:start;min-width:0}
.v2-page--b5commerce .v2-b5commerce-alert{display:flex;align-items:center;gap:var(--v2-space-2);flex-wrap:wrap;padding:var(--v2-space-3) var(--v2-space-4);border-radius:var(--v2-radius-md);font-size:var(--v2-text-sm);line-height:1.6}
.v2-page--b5commerce .commerce-alert--error{background:var(--v2-bad-soft);color:var(--v2-bad)}
.v2-page--b5commerce .commerce-alert--success{background:var(--v2-ok-soft);color:var(--v2-ok)}
.v2-page--b5commerce .v2-b5commerce-grid{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(0,1fr);gap:var(--v2-space-5);align-items:start;min-width:0}
.v2-page--b5commerce .v2-b5commerce-card{background:var(--v2-card);border:1px solid var(--v2-line);border-radius:var(--v2-radius-lg);box-shadow:var(--v2-shadow);padding:var(--v2-space-6);min-width:0;display:grid;gap:var(--v2-space-4);align-content:start}
.v2-page--b5commerce .commerce-panel--wide{grid-column:1/-1}
.v2-page--b5commerce .panel-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:var(--v2-space-4)}
.v2-page--b5commerce .panel-heading>div{display:grid;gap:var(--v2-space-1);min-width:0}
.v2-page--b5commerce .v2-b5commerce-kicker{margin:0;color:var(--v2-brand);font-size:var(--v2-text-xs);font-weight:700;letter-spacing:1px}
.v2-page--b5commerce .panel-heading h3{margin:0;color:var(--v2-ink);font-size:var(--v2-text-lg);line-height:1.4}
.v2-page--b5commerce .fact-tag{display:inline-flex;align-items:center;padding:var(--v2-space-1) var(--v2-space-3);border-radius:var(--v2-radius-pill);background:var(--v2-soft);color:var(--v2-brand);font-size:var(--v2-text-xs);font-weight:700;line-height:1.6;white-space:nowrap}
.v2-page--b5commerce .empty-copy{margin:0;padding:var(--v2-space-4);border:1px dashed var(--v2-line);border-radius:var(--v2-radius-md);color:var(--v2-mut);font-size:var(--v2-text-sm);line-height:1.6}
.v2-page--b5commerce .plan-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--v2-space-4);min-width:0}
.v2-page--b5commerce .plan-card{display:flex;flex-direction:column;gap:var(--v2-space-3);min-height:210px;padding:var(--v2-space-4);background:var(--v2-surface);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);min-width:0}
.v2-page--b5commerce .plan-card--selected{border-color:var(--v2-brand)}
.v2-page--b5commerce .plan-card__period{color:var(--v2-brand);font-size:var(--v2-text-xs);font-weight:800;letter-spacing:1px}
.v2-page--b5commerce .plan-card h4{margin:0;color:var(--v2-ink);font-size:var(--v2-text-md);line-height:1.5}
.v2-page--b5commerce .plan-card strong{color:var(--v2-brand);font-size:var(--v2-text-xl);line-height:1.25}
.v2-page--b5commerce .plan-card p{margin:0;min-height:36px;color:var(--v2-mut);font-size:var(--v2-text-xs);line-height:1.6}
.v2-page--b5commerce .fact-list{display:grid;gap:var(--v2-space-3)}
.v2-page--b5commerce .order-list{display:grid;gap:var(--v2-space-3)}
.v2-page--b5commerce .fact-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:var(--v2-space-1);padding:var(--v2-space-3) var(--v2-space-4);background:var(--v2-surface);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md)}
.v2-page--b5commerce .fact-row span{color:var(--v2-ink);font-size:var(--v2-text-sm)}
.v2-page--b5commerce .fact-row strong{color:var(--v2-ok);font-size:var(--v2-text-xs)}
.v2-page--b5commerce .fact-row small{grid-column:1/-1;color:var(--v2-mut);font-size:var(--v2-text-xs)}
.v2-page--b5commerce .order-row{display:flex;align-items:center;justify-content:space-between;gap:var(--v2-space-4);padding:var(--v2-space-4);background:var(--v2-surface);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md)}
.v2-page--b5commerce .order-row>div:first-child{display:grid;gap:var(--v2-space-1);min-width:0}
.v2-page--b5commerce .order-row strong{color:var(--v2-ink);font-size:var(--v2-text-sm)}
.v2-page--b5commerce .order-row span{color:var(--v2-mut);font-size:var(--v2-text-xs)}
.v2-page--b5commerce .order-row__right{display:flex;align-items:center;gap:var(--v2-space-2);flex-wrap:wrap}
.v2-page--b5commerce .status-pill{display:inline-flex;align-items:center;padding:var(--v2-space-1) var(--v2-space-3);border-radius:var(--v2-radius-pill);background:var(--v2-soft);color:var(--v2-brand);font-size:var(--v2-text-xs);font-weight:700;white-space:nowrap}
.v2-page--b5commerce .activation-box{display:grid;gap:var(--v2-space-3);margin-top:var(--v2-space-5);padding-top:var(--v2-space-4);border-top:1px solid var(--v2-line)}
.v2-page--b5commerce .activation-box label{color:var(--v2-ink);font-size:var(--v2-text-sm);font-weight:700}
.v2-page--b5commerce .activation-box__row{display:flex;gap:var(--v2-space-2);flex-wrap:wrap}
.v2-page--b5commerce .activation-box input{min-width:0;flex:1;padding:var(--v2-space-3);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);background:var(--v2-card);color:var(--v2-ink);font-size:var(--v2-text-sm)}
.v2-page--b5commerce .activation-box small{color:var(--v2-mut);font-size:var(--v2-text-xs);line-height:1.6}
.v2-page--b5commerce .v2-b5commerce-rail{position:sticky;top:var(--v2-space-6);background:var(--v2-card);border:1px solid var(--v2-line);border-radius:var(--v2-radius-lg);box-shadow:var(--v2-shadow);padding:var(--v2-space-6);min-width:0;display:grid;align-content:start;gap:var(--v2-space-3)}
.v2-page--b5commerce .v2-b5commerce-rail h2{margin:0;color:var(--v2-ink);font-size:var(--v2-text-lg);line-height:1.4}
.v2-page--b5commerce .v2-b5commerce-rail ol{margin:0;padding-left:var(--v2-space-5);display:grid;gap:var(--v2-space-2);color:var(--v2-mut);font-size:var(--v2-text-sm);line-height:1.7}
.v2-page--b5commerce button:focus-visible{outline:2px solid var(--v2-brand);outline-offset:2px}
.v2-page--b5commerce a:focus-visible{outline:2px solid var(--v2-brand);outline-offset:2px}
.v2-page--b5commerce input:focus-visible{outline:2px solid var(--v2-brand);outline-offset:2px}
@media (max-width:1190px){.v2-page--b5commerce .v2-b5commerce-body{grid-template-columns:minmax(0,1fr) 250px}.v2-page--b5commerce .v2-b5commerce-grid{grid-template-columns:minmax(0,1fr) minmax(0,.9fr)}.v2-page--b5commerce .plan-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:900px){.v2-page--b5commerce .v2-b5commerce-body{grid-template-columns:1fr}.v2-page--b5commerce .v2-b5commerce-grid{grid-template-columns:1fr}.v2-page--b5commerce .commerce-panel--wide{grid-column:auto}.v2-page--b5commerce .plan-grid{grid-template-columns:1fr}.v2-page--b5commerce .order-row{align-items:flex-start;flex-direction:column}.v2-page--b5commerce .v2-b5commerce-rail{position:static}}
</style>
