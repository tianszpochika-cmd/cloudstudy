import type { B8PolicyVersion, B8PolicyVersionListEnvelope } from '@englishflow/contracts'
import { adminClient } from './client'

export interface PolicyVersionPage {
  items: B8PolicyVersion[]
  nextCursor: string | null
}

const POLICY_VERSIONS_PATH = '/iam/policy-versions'
const statuses = new Set(['DRAFT', 'SUBMITTED', 'APPROVED', 'ACTIVE', 'REVOKED'])

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function strings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string')
}

function roleBinding(value: unknown): boolean {
  return record(value) && typeof value.roleCode === 'string' && strings(value.permissions)
}

function rule(value: unknown): boolean {
  return record(value) && (value.effect === 'ALLOW' || value.effect === 'DENY')
    && strings(value.requiredPermissions) && strings(value.actions) && strings(value.resourceTypes)
    && record(value.conditions)
    && (value.conditions.phases === undefined || strings(value.conditions.phases))
    && (value.conditions.requiredConsentPurposes === undefined || strings(value.conditions.requiredConsentPurposes))
    && (value.conditions.contentRights === undefined || strings(value.conditions.contentRights))
    && (value.conditions.minimumDeviceTrust === undefined
      || value.conditions.minimumDeviceTrust === null
      || typeof value.conditions.minimumDeviceTrust === 'string')
    && (value.conditions.requiresAdultEligibility === undefined
      || value.conditions.requiresAdultEligibility === null
      || typeof value.conditions.requiresAdultEligibility === 'boolean')
    && (value.conditions.ownerMatchRequired === undefined
      || value.conditions.ownerMatchRequired === null
      || typeof value.conditions.ownerMatchRequired === 'boolean')
    && (value.conditions.tenantMatchRequired === undefined
      || value.conditions.tenantMatchRequired === null
      || typeof value.conditions.tenantMatchRequired === 'boolean')
}

function policyVersion(value: unknown): value is B8PolicyVersion {
  if (!record(value) || !record(value.document) || !record(value.separationOfDuties)) return false
  return typeof value.policyVersionId === 'string'
    && typeof value.version === 'string'
    && statuses.has(String(value.status))
    && Number.isInteger(value.revision)
    && typeof value.updatedAt === 'string'
    && typeof value.document.name === 'string'
    && Array.isArray(value.document.roleBindings)
    && value.document.roleBindings.every(roleBinding)
    && Array.isArray(value.document.rules)
    && value.document.rules.every(rule)
    && Array.isArray(value.auditLinks)
    && typeof value.separationOfDuties.satisfied === 'boolean'
}

export function parsePolicyVersionPage(response: unknown): PolicyVersionPage {
  if (!record(response) || !record(response.data) || !record(response.meta)
    || !Array.isArray(response.data.items)
    || typeof response.meta.hasMore !== 'boolean') {
    throw new Error('POLICY_RESPONSE_INVALID')
  }
  // One malformed row must not blank the page. Keep null device-trust for 「未设置」 display.
  const items = response.data.items.filter(policyVersion) as B8PolicyVersion[]
  const cursor = response.meta.nextCursor
  if (response.meta.hasMore && !response.data.items.length) {
    throw new Error('POLICY_RESPONSE_INVALID')
  }
  if (response.meta.hasMore && (typeof cursor !== 'string' || !cursor)) {
    throw new Error('POLICY_RESPONSE_INVALID')
  }
  if (!response.meta.hasMore && cursor != null) {
    throw new Error('POLICY_RESPONSE_INVALID')
  }
  return {
    items,
    nextCursor: response.meta.hasMore ? cursor as string : null,
  }
}

export async function listB8PolicyVersions(cursor?: string): Promise<PolicyVersionPage> {
  const path = `${POLICY_VERSIONS_PATH}?pageSize=50${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`
  const response = await adminClient.request<B8PolicyVersionListEnvelope>(path)
  return parsePolicyVersionPage(response)
}
