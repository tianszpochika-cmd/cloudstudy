import { MobileApiError, mobileApiClient } from './client'
import { ConsentHttpError, runLearningConsentWithdrawal, type LearningConsentWithdrawalResult } from '../domain/learning-consent-withdrawal'

/** Gateway consent write. skipAuthRetry keeps a learning 403 from leaving settings. */
export function withdrawLearningConsent(idempotencyKey: string): Promise<LearningConsentWithdrawalResult> {
  return runLearningConsentWithdrawal(async (path, init) => {
    try {
      return await mobileApiClient.request(path, {
        method: init.method,
        data: init.body,
        header: init.idempotencyKey ? { 'Idempotency-Key': init.idempotencyKey } : undefined,
        skipAuthRetry: true,
      })
    } catch (error) {
      if (error instanceof MobileApiError) throw new ConsentHttpError(error.status, error.message)
      throw error
    }
  }, idempotencyKey)
}
