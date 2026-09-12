// Single source of truth for which services own a schema and how that schema is migrated.
// scripts/database/reconcile-owner-schemas.mjs provisions from it and
// scripts/runtime/p1r-m2-004-runtime.mjs verifies against it, so the two can no longer drift.
import fs from 'node:fs';
import path from 'node:path';

// Platform services own a schema and an independent credential but are not Phase 1 domain owners, so
// they stay out of config/b17-runtime-services.json, whose validator pins the Phase 1 domain service
// order. audit-service has no runtime Flyway, so its schema and DML-only credential are provisioned
// exactly like a domain owner's.
export const PLATFORM_OWNERS = [
  {
    id: 'audit-service',
    schema: 'audit_service',
    dbCredential: 'svc_audit',
    migrationPath: 'services/audit-service/src/main/resources/db/migration/V1__create_audit_service_schema.sql'
  }
];

// Provisioned by the service itself: iam-service runs Flyway at runtime (IAM_FLYWAY_ENABLED=true), so
// its credential keeps DDL rights and is deliberately not DML-only. It must still be scoped to
// iam_service alone, which the runtime harness asserts.
export const SELF_MIGRATING_OWNERS = [
  { id: 'iam-service', schema: 'iam_service', dbCredential: 'svc_iam' }
];

// Services the ownership policy already declares as data owners but which have no runtime yet. They
// are excluded from runtime evidence instead of being reported as failures.
export const DECLARED_NOT_BUILT = ['workflow-service'];

// The credential name follows the same derivation the runtime runner uses:
// <service id without the -service suffix, dashes to underscores>, prefixed with svc_.
export function credentialFor(serviceId) {
  return `svc_${serviceId.replace(/-service$/u, '').replaceAll('-', '_')}`;
}

export function readOwnerManifest(root) {
  const base = JSON.parse(fs.readFileSync(path.join(root, 'config/b17-runtime-services.json'), 'utf8'));
  return { ...base, services: [...base.services, ...PLATFORM_OWNERS] };
}

// Every owner that is expected to hold a schema right now, tagged with how its schema is migrated.
// The runtime harness asserts DML-only for "external" owners and scoped-DDL for "self" owners.
export function runtimeOwners(root) {
  const manifest = readOwnerManifest(root);
  const owners = manifest.services.map((service) => ({
    id: service.id,
    schema: service.schema,
    credential: service.dbCredential,
    migrationPath: service.migrationPath,
    migrationMode: 'external'
  }));
  for (const owner of SELF_MIGRATING_OWNERS) {
    owners.push({
      id: owner.id,
      schema: owner.schema,
      credential: owner.dbCredential,
      migrationPath: null,
      migrationMode: 'self'
    });
  }
  return owners.filter((owner) => !DECLARED_NOT_BUILT.includes(owner.id));
}
