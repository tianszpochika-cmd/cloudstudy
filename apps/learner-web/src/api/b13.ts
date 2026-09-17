import { apiClient } from './client'

export const B13_COMMERCE_PATHS = {
  skus: '/commerce/skus',
  orders: '/commerce/orders?limit=50',
  entitlements: '/commerce/entitlements/me',
  createOrder: '/commerce/orders',
  paymentIntent: (orderId: string) => `/commerce/orders/${encodeURIComponent(orderId)}/payment-intents`,
  redeemActivation: '/commerce/activation-codes/redeem',
  refund: (orderId: string) => `/commerce/orders/${encodeURIComponent(orderId)}/refunds`,
  readiness: '/commerce/readiness',
} as const

let keySequence = 0
function idempotencyKey(prefix: string): string {
  keySequence += 1
  const suffix = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${keySequence}`
  return `${prefix}-${suffix}`
}

function withKey(prefix: string): { headers: { 'Idempotency-Key': string } } {
  return { headers: { 'Idempotency-Key': idempotencyKey(prefix) } }
}

export function listB13Skus(): Promise<unknown> { return apiClient.get(B13_COMMERCE_PATHS.skus) }
export function listB13Orders(): Promise<unknown> { return apiClient.get(B13_COMMERCE_PATHS.orders) }
export function listB13Entitlements(): Promise<unknown> { return apiClient.get(B13_COMMERCE_PATHS.entitlements) }
export function createB13Order(skuId: string): Promise<unknown> {
  return apiClient.post(B13_COMMERCE_PATHS.createOrder, { skuId }, withKey(`b13-order-${skuId}`))
}
export function prepareB13Payment(orderId: string, provider = 'SANDBOX'): Promise<unknown> {
  return apiClient.post(B13_COMMERCE_PATHS.paymentIntent(orderId), { provider }, withKey(`b13-payment-${orderId}`))
}
export function redeemB13ActivationCode(code: string): Promise<unknown> {
  return apiClient.post(B13_COMMERCE_PATHS.redeemActivation, { code }, withKey('b13-activation'))
}
export function requestB13Refund(orderId: string, reasonCode = 'USER_REQUEST'): Promise<unknown> {
  return apiClient.post(B13_COMMERCE_PATHS.refund(orderId), { reasonCode }, withKey(`b13-refund-${orderId}`))
}
export function readB13Readiness(): Promise<unknown> { return apiClient.get(B13_COMMERCE_PATHS.readiness) }
