export { listB13Skus as listB5Skus, listB13Entitlements as listB5Entitlements, listB13Orders as listB5Orders,
  createB13Order as createB5Order, prepareB13Payment as prepareB5Payment, redeemB13ActivationCode as redeemB5ActivationCode } from './b13'

// B13 canonical Gateway surface kept visible at the compatibility import used by the page.
export const B13_COMMERCE_ROUTES = {
  skus: '/commerce/skus',
  orders: '/commerce/orders',
  entitlements: '/commerce/entitlements/me',
  paymentIntent: '/commerce/orders/{orderId}/payment-intents',
} as const
export const B13_IDEMPOTENCY_HEADER = 'Idempotency-Key'
