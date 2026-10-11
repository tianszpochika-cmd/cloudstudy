import { getInMemoryAccessToken } from '../auth/access-token'
import { ConsentHttpError, runLearningConsentWithdrawal, type LearningConsentWithdrawalResult } from '../domain/learning-consent-withdrawal'
import { getGatewayBaseUrl } from '../platform/gateway'

/**
 * Consent writes go through the Gateway, like the existing onboarding consent calls.
 * This fetch does not use the shared client's forbidden redirect, so a 403 on targets
 * can stay on the settings page.
 */
export function withdrawLearningConsent(idempotencyKey: string): Promise<LearningConsentWithdrawalResult> {
  return runLearningConsentWithdrawal(async (path, init) => {
    const headers = new Headers({ accept: 'application/json' })
    const token = getInMemoryAccessToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)
    if (init.body !== undefined) headers.set('content-type', 'application/json')
    if (init.idempotencyKey) headers.set('Idempotency-Key', init.idempotencyKey)
    const response = await fetch(`${getGatewayBaseUrl().replace(/\/$/, '')}${path}`, {
      method: init.method,
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      credentials: 'include',
    })
    const text = await response.text()
    if (!response.ok) throw new ConsentHttpError(response.status)
    if (!text) return undefined
    try {
      return JSON.parse(text) as unknown
    } catch {
      return text
    }
  }, idempotencyKey)
}
