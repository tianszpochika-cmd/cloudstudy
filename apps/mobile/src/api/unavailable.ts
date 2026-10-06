import { rejectUnavailableOperation } from '@englishflow/api-client'
import { operationAvailabilityMessages } from '@englishflow/i18n'
import { mobileI18n } from '../platform/v2-foundation'

for (const locale of ['zh-CN', 'en-US'] as const) {
  mobileI18n.registerMessages(locale, operationAvailabilityMessages[locale])
}

/** Restore the owner-bound request only after Gateway declares it available. */
export function unavailableOperation<TResponse = never>(): Promise<TResponse> {
  return rejectUnavailableOperation<TResponse>(mobileI18n.t('common.featureUnavailable'))
}
