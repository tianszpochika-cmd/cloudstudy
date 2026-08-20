import { readFileSync } from 'node:fs';
import { ACCESS_POLICY, TELEMETRY_POLICY, TELEMETRY_SCHEMA } from '../../packages/telemetry/src/index.mjs';
import { isSensitiveKeyName, MASK_STRATEGIES } from '../../packages/telemetry/src/security.mjs';

const requiredRoles = ['learner', 'admin', 'content-editor', 'finance-auditor'];
const requiredSensitiveKeys = ['password', 'accessToken', 'refreshToken', 'rawAudio', 'paymentCredential', 'receipt'];
const failures = [];

function check(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}

function includesAll(collection, required) {
  return required.every((item) => collection.includes(item));
}

check(ACCESS_POLICY.defaultEffect === 'deny', 'RBAC defaultEffect must be deny');
check(TELEMETRY_POLICY.defaultEffect === 'deny', 'telemetry defaultEffect must be deny');
check(includesAll(Object.keys(ACCESS_POLICY.roles), requiredRoles), 'required minimum roles are missing');
check(ACCESS_POLICY.tenantBoundary.missingTenantEffect === 'deny', 'missing tenant must deny');
check(ACCESS_POLICY.tenantBoundary.crossTenantEffect === 'deny', 'cross tenant access must deny');
check(Array.isArray(ACCESS_POLICY.tenantBoundary.globalRoles) && ACCESS_POLICY.tenantBoundary.globalRoles.length === 0, 'no global role may be silently granted');

for (const [role, definition] of Object.entries(ACCESS_POLICY.roles)) {
  check(['self', 'tenant'].includes(definition.scope), `${role} has an invalid default scope`);
  for (const permission of definition.permissions) {
    check(ACCESS_POLICY.resources.includes(permission.resource), `${role} references unknown resource ${permission.resource}`);
    check(permission.actions.every((action) => ACCESS_POLICY.actions.includes(action)), `${role} references an unknown action`);
    check(['self', 'tenant'].includes(permission.scope), `${role} has a permission outside self/tenant scope`);
    if (permission.exportPolicy) {
      check(Boolean(ACCESS_POLICY.exportPolicies[permission.exportPolicy]), `${role} references missing export policy ${permission.exportPolicy}`);
    }
  }
}

const telemetrySensitiveKeys = new Set(TELEMETRY_POLICY.sensitiveKeys.map((key) => key.replace(/[\s_-]/g, '').toLowerCase()));
for (const key of requiredSensitiveKeys) {
  check(telemetrySensitiveKeys.has(key.replace(/[\s_-]/g, '').toLowerCase()), `sensitive key ${key} is not blocked`);
}

for (const [policyName, exportPolicy] of Object.entries(ACCESS_POLICY.exportPolicies)) {
  check(exportPolicy.unknownField === 'drop', `${policyName} must drop unknown export fields`);
  check(Array.isArray(exportPolicy.allowedRoles) && exportPolicy.allowedRoles.length > 0, `${policyName} must declare allowed roles`);
  check(['self', 'tenant'].includes(exportPolicy.scope), `${policyName} has an invalid scope`);
  for (const [field, strategy] of Object.entries(exportPolicy.fields)) {
    check(MASK_STRATEGIES.has(strategy), `${policyName}.${field} has invalid masking strategy ${strategy}`);
    if (isSensitiveKeyName(field) || telemetrySensitiveKeys.has(field.replace(/[\s_-]/g, '').toLowerCase())) {
      check(strategy === 'drop', `${policyName}.${field} must be dropped`);
    }
  }
}

const requiredEnvelopeFields = ['eventId', 'eventName', 'eventVersion', 'occurredAt', 'requestId', 'traceId', 'correlationId', 'actorId', 'tenantId', 'payload'];
check(includesAll(TELEMETRY_POLICY.envelope.required, requiredEnvelopeFields), 'telemetry envelope is missing a required correlation field');
check(includesAll(TELEMETRY_SCHEMA.required, requiredEnvelopeFields), 'telemetry JSON schema is missing a required correlation field');

for (const [eventName, eventDefinition] of Object.entries(TELEMETRY_POLICY.events)) {
  check(new RegExp(TELEMETRY_POLICY.eventNamePattern).test(eventName), `${eventName} does not follow domain.action.vN`);
  for (const [version, versionDefinition] of Object.entries(eventDefinition.versions)) {
    check(new RegExp(TELEMETRY_POLICY.eventVersionPattern).test(version), `${eventName}@${version} is not semver`);
    check(versionDefinition.required.includes('schema'), `${eventName}@${version} must require payload.schema`);
    check(versionDefinition.required.every((field) => versionDefinition.allowed.includes(field)), `${eventName}@${version} required field is not allowed`);
    for (const field of versionDefinition.allowed) {
      check(!isSensitiveKeyName(field), `${eventName}@${version} allows a sensitive payload field ${field}`);
    }
  }
}

if (failures.length > 0) {
  console.error(`B0 policy verification failed (${failures.length}):`);
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exitCode = 1;
} else {
  console.log(`B0 policy verification passed: ${Object.keys(ACCESS_POLICY.roles).length} roles, ${Object.keys(TELEMETRY_POLICY.events).length} event names, ${Object.keys(ACCESS_POLICY.exportPolicies).length} export policies.`);
}

// Keep this import visible to the checker so a malformed policy file fails during startup.
readFileSync(new URL('../../packages/telemetry/policies/access-control.json', import.meta.url), 'utf8');
