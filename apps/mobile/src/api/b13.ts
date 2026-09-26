import { mobileApiClient } from './client'

export const B13_COMMERCE_PATHS = {
  publicCatalog: '/public/commerce/catalog',
  skus: '/commerce/skus',
  orders: '/commerce/orders?limit=50',
  entitlements: '/commerce/entitlements/me',
  createOrder: '/commerce/orders',
  paymentIntent: (orderId: string) => `/commerce/orders/${encodeURIComponent(orderId)}/payment-intents`,
} as const

let keySequence = 0
function idempotencyKey(prefix: string): string {
  keySequence += 1
  const runtimeCrypto = globalThis.crypto as Crypto | undefined
  const suffix = runtimeCrypto && typeof runtimeCrypto.randomUUID === 'function'
    ? runtimeCrypto.randomUUID()
    : `${Date.now()}-${keySequence}`
  return `${prefix}-${suffix}`
}

function withKey(prefix: string): { header: { 'Idempotency-Key': string } } {
  return { header: { 'Idempotency-Key': idempotencyKey(prefix) } }
}

export function listB13Skus(): Promise<unknown> { return mobileApiClient.request(B13_COMMERCE_PATHS.skus) }
export function getB13PublicCatalog(): Promise<unknown> { return mobileApiClient.request(B13_COMMERCE_PATHS.publicCatalog) }
export function listB13Orders(): Promise<unknown> { return mobileApiClient.request(B13_COMMERCE_PATHS.orders) }
export function listB13Entitlements(): Promise<unknown> { return mobileApiClient.request(B13_COMMERCE_PATHS.entitlements) }
export function createB13Order(skuId: string): Promise<unknown> {
  return mobileApiClient.request(B13_COMMERCE_PATHS.createOrder, { method: 'POST', data: { skuId }, ...withKey(`b13-order-${skuId}`) })
}
export function prepareB13Payment(orderId: string, provider = 'SANDBOX'): Promise<unknown> {
  return mobileApiClient.request(B13_COMMERCE_PATHS.paymentIntent(orderId), { method: 'POST', data: { provider }, ...withKey(`b13-payment-${orderId}`) })
}
