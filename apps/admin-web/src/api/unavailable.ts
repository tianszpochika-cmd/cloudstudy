import { rejectUnavailableOperation } from '@englishflow/api-client'
import { operationAvailabilityMessages } from '@englishflow/i18n'
import { adminI18n } from '../platform/v2-foundation'

for (const locale of ['zh-CN', 'en-US'] as const) {
  adminI18n.registerMessages(locale, operationAvailabilityMessages[locale])
}

/** Restore the owner-bound request only after Gateway declares it available. */
export function unavailableOperation<TResponse = never>(): Promise<TResponse> {
  return rejectUnavailableOperation<TResponse>(adminI18n.t('common.featureUnavailable'))
}
