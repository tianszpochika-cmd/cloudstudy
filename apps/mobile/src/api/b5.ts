export { listB13Skus as listMobileB5Skus, listB13Orders as listMobileB5Orders,
  listB13Entitlements as listMobileB5Entitlements, createB13Order as createMobileB5Order,
  prepareB13Payment as prepareMobileB5Payment } from './b13'

// B13 canonical Gateway surface kept visible at the compatibility import used by the page.
export const B13_COMMERCE_ROUTES = {
  skus: '/commerce/skus',
  orders: '/commerce/orders',
  entitlements: '/commerce/entitlements/me',
  paymentIntent: '/commerce/orders/{orderId}/payment-intents',
} as const
export const B13_IDEMPOTENCY_HEADER = 'Idempotency-Key'
