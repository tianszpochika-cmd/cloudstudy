import { createHash } from 'node:crypto';
import { ACCESS_POLICY, TELEMETRY_POLICY } from './policy-loader.mjs';

const MASK_STRATEGIES = new Set(['keep', 'hash', 'partial', 'email', 'phone', 'ip', 'dateOnly', 'drop']);
const IDENTITY_FIELDS = ACCESS_POLICY.tenantBoundary.selfIdentityFields;

function normalizeKey(key) {
  return String(key).replace(/[\s_-]/g, '').toLowerCase();
}

const sensitiveKeySet = new Set(TELEMETRY_POLICY.sensitiveKeys.map(normalizeKey));
const sensitiveValuePatterns = TELEMETRY_POLICY.sensitiveValuePatterns.map((item) => ({
  name: item.name,
  pattern: new RegExp(item.pattern, 'i'),
}));

function isSensitiveKey(key) {
  const normalized = normalizeKey(key);
  if (sensitiveKeySet.has(normalized)) {
    return true;
  }

  return [
    'password',
    'passcode',
    'authorization',
    'secret',
    'privatekey',
    'rawaudio',
    'audiobytes',
    'recordingbytes',
    'paymentcredential',
    'paymenttoken',
    'cardnumber',
    'securitycode',
    'transactionproof',
  ].some((fragment) => normalized.includes(fragment)) || normalized.endsWith('token');
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function scanValue(value, path, findings) {
  if (typeof value === 'string') {
    for (const item of sensitiveValuePatterns) {
      if (item.pattern.test(value)) {
        findings.push({ path, kind: 'value', rule: item.name });
      }
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((child, index) => scanValue(child, `${path}[${index}]`, findings));
    return;
  }

  if (!isPlainObject(value)) {
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (isSensitiveKey(key)) {
      findings.push({ path: childPath, kind: 'key', rule: 'sensitive-key' });
      continue;
    }
    scanValue(child, childPath, findings);
  }
}

export function findSensitiveData(value) {
  const findings = [];
  scanValue(value, '$', findings);
  return findings;
}

export function assertNoSensitiveData(value, code = 'SENSITIVE_DATA_FORBIDDEN') {
  const findings = findSensitiveData(value);
  if (findings.length > 0) {
    const error = new Error(`${code}: sensitive content is not allowed`);
    error.name = 'SensitiveDataError';
    error.code = code;
    error.findings = findings.map(({ path, kind, rule }) => ({ path, kind, rule }));
    throw error;
  }
  return value;
}

function actorRoles(actor) {
  if (!actor || typeof actor !== 'object') {
    return [];
  }
  if (Array.isArray(actor.roles)) {
    return actor.roles.filter((role) => typeof role === 'string');
  }
  return typeof actor.role === 'string' ? [actor.role] : [];
}

function sameTenant(actor, resource) {
  const actorTenantId = actor?.tenantId;
  const resourceTenantId = resource?.[ACCESS_POLICY.tenantBoundary.resourceTenantField];
  return typeof actorTenantId === 'string' && actorTenantId.length > 0 &&
    typeof resourceTenantId === 'string' && resourceTenantId.length > 0 &&
    actorTenantId === resourceTenantId;
}

function selfOwned(actor, resource) {
  if (!actor || typeof actor.id !== 'string' || actor.id.length === 0) {
    return false;
  }
  return IDENTITY_FIELDS.some((field) => resource?.[field] === actor.id);
}

function scopeAllows(scope, role, actor, resource) {
  if (scope === 'tenant') {
    return sameTenant(actor, resource);
  }

  if (scope === 'self') {
    return sameTenant(actor, resource) && selfOwned(actor, resource);
  }

  if (scope === 'global') {
    return ACCESS_POLICY.tenantBoundary.globalRoles.includes(role);
  }

  return false;
}

function deny(reasonCode, extra = {}) {
  return { allowed: false, reasonCode, ...extra };
}

export function evaluateAccess({ actor, resource, action } = {}, policy = ACCESS_POLICY) {
  if (!actor || typeof actor.id !== 'string' || !Array.isArray(actor.roles) && typeof actor.role !== 'string') {
    return deny('ACTOR_CONTEXT_REQUIRED');
  }
  if (!resource || typeof resource.type !== 'string' || typeof action !== 'string') {
    return deny('RESOURCE_AND_ACTION_REQUIRED');
  }

  const roles = actorRoles(actor);
  if (roles.length === 0) {
    return deny('ROLE_REQUIRED');
  }

  for (const role of roles) {
    const rolePolicy = policy.roles[role];
    if (!rolePolicy) {
      continue;
    }
    for (const permission of rolePolicy.permissions) {
      if (permission.resource !== resource.type || !permission.actions.includes(action)) {
        continue;
      }
      const scope = permission.scope ?? rolePolicy.scope;
      if (!scopeAllows(scope, role, actor, resource)) {
        return deny('TENANT_OR_RESOURCE_SCOPE_DENIED', { role, permission });
      }
      return { allowed: true, reasonCode: 'ALLOW', role, permission, scope };
    }
  }

  return deny('PERMISSION_NOT_GRANTED');
}

export function authorize(request, policy = ACCESS_POLICY) {
  const decision = evaluateAccess(request, policy);
  if (!decision.allowed) {
    const error = new Error(`access denied: ${decision.reasonCode}`);
    error.name = 'AuthorizationError';
    error.code = 'ACCESS_DENIED';
    error.reasonCode = decision.reasonCode;
    throw error;
  }
  return decision;
}

function hasRole(roles, allowedRoles) {
  return roles.some((role) => allowedRoles.includes(role));
}

export function authorizeExport({ actor, subjectId, tenantId, policyName, action = 'create' } = {}, policy = ACCESS_POLICY) {
  const exportPolicy = policy.exportPolicies[policyName];
  if (!exportPolicy) {
    const error = new Error('unknown export policy');
    error.name = 'AuthorizationError';
    error.code = 'EXPORT_POLICY_NOT_FOUND';
    throw error;
  }

  const resource = {
    type: 'export',
    tenantId,
    subjectId,
  };
  const decision = evaluateAccess({ actor, resource, action }, policy);
  if (!decision.allowed || !hasRole(actorRoles(actor), exportPolicy.allowedRoles)) {
    const error = new Error(`export denied: ${decision.reasonCode}`);
    error.name = 'AuthorizationError';
    error.code = 'EXPORT_DENIED';
    error.reasonCode = decision.reasonCode;
    throw error;
  }

  if (exportPolicy.scope === 'self' && subjectId !== actor.id) {
    const error = new Error('export denied: subject is not the actor');
    error.name = 'AuthorizationError';
    error.code = 'EXPORT_SUBJECT_DENIED';
    throw error;
  }
  if (exportPolicy.scope === 'tenant' && tenantId !== actor.tenantId) {
    const error = new Error('export denied: tenant boundary');
    error.name = 'AuthorizationError';
    error.code = 'EXPORT_TENANT_DENIED';
    throw error;
  }

  return { ...decision, policyName, exportPolicy };
}

function stableHash(value) {
  return `sha256:${createHash('sha256').update(`yuxuexing-export-v1:${String(value)}`).digest('hex').slice(0, 24)}`;
}

function maskScalar(strategy, value) {
  if (value === null || value === undefined) {
    return value;
  }
  if (strategy === 'drop') {
    return undefined;
  }
  if (strategy === 'keep') {
    return value;
  }
  if (strategy === 'hash') {
    return stableHash(value);
  }
  const stringValue = String(value);
  if (strategy === 'partial') {
    return stringValue.length <= 2 ? '*'.repeat(stringValue.length) : `${stringValue[0]}***${stringValue.at(-1)}`;
  }
  if (strategy === 'email') {
    const [local, domain] = stringValue.split('@');
    if (!local || !domain) {
      return '***';
    }
    return `${local[0]}***@${domain}`;
  }
  if (strategy === 'phone') {
    return stringValue.length <= 4 ? '****' : `${'*'.repeat(Math.max(0, stringValue.length - 4))}${stringValue.slice(-4)}`;
  }
  if (strategy === 'ip') {
    if (stringValue.includes(':')) {
      return `${stringValue.split(':').slice(0, 3).join(':')}:*`;
    }
    const octets = stringValue.split('.');
    return octets.length === 4 ? `${octets.slice(0, 3).join('.')}.*` : '***';
  }
  if (strategy === 'dateOnly') {
    const date = new Date(stringValue);
    return Number.isNaN(date.valueOf()) ? 'invalid-date' : date.toISOString().slice(0, 10);
  }
  return undefined;
}

function maskExportValue(value, strategy, fields) {
  if (Array.isArray(value)) {
    return value.map((item) => maskExportValue(item, strategy, fields)).filter((item) => item !== undefined);
  }
  if (isPlainObject(value)) {
    return maskExportObject(value, fields);
  }
  return maskScalar(strategy, value);
}

function maskExportObject(value, fields) {
  const output = {};
  for (const [key, child] of Object.entries(value)) {
    const strategy = fields[key];
    if (!strategy || isSensitiveKey(key) || !MASK_STRATEGIES.has(strategy)) {
      continue;
    }
    const masked = maskExportValue(child, strategy, fields);
    if (masked !== undefined) {
      output[key] = masked;
    }
  }
  return output;
}

export function maskExportFields(value, { policyName } = {}, policy = ACCESS_POLICY) {
  const exportPolicy = policy.exportPolicies[policyName];
  if (!exportPolicy) {
    const error = new Error('unknown export policy');
    error.name = 'ExportSanitizationError';
    error.code = 'EXPORT_POLICY_NOT_FOUND';
    throw error;
  }
  return maskExportValue(value, 'keep', exportPolicy.fields);
}

export function isSensitiveKeyName(key) {
  return isSensitiveKey(key);
}

export { MASK_STRATEGIES };
