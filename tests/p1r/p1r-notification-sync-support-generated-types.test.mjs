import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..', '..');
const require = createRequire(import.meta.url);
const tscPath = require.resolve('typescript/bin/tsc');
const generatedOpenApiPath = path.join(root, 'packages/contracts/generated/openapi.ts');
const generatedClientPath = path.join(root, 'packages/api-client/src/generated/index.ts');
const generatedEventsPath = path.join(root, 'packages/contracts/generated/events.ts');

const REQUIRED_TYPES = [
  'M1016NotificationPreference',
  'M1016NotificationPreferenceCommand',
  'M1016NotificationMessage',
  'M1016SyncProtocolContext',
  'M1016SyncConflict',
  'M1016SupportTicket',
  'M1016SupportTicketCreateRequest',
  'M1016SupportMessageCreateRequest',
  'M1016SupportAdminCommandRequest',
];
const REQUIRED_OPERATIONS = [
  'listM1016NotificationPreferences',
  'updateM1016NotificationPreference',
  'listM1016LearningSyncReceipts',
  'recoverM1016LearningSyncConflict',
  'listM1016LearnerSupportTickets',
  'createM1016SupportTicket',
  'submitM1016SupportTicketCommand',
];

function generatedText() {
  return [generatedOpenApiPath, generatedClientPath, generatedEventsPath]
    .map((filePath) => fs.readFileSync(filePath, 'utf8'))
    .join('\n');
}

function hasCurrentProjection() {
  let text;
  try { text = generatedText(); } catch { return false; }
  return [...REQUIRED_TYPES, ...REQUIRED_OPERATIONS].every((name) => text.includes(name));
}

function compileFixture(source) {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'p1r-notification-sync-support-generated-types-'));
  try {
    const fixturePath = path.join(temporaryRoot, 'fixture.ts');
    const tsconfigPath = path.join(temporaryRoot, 'tsconfig.json');
    fs.writeFileSync(fixturePath, source, 'utf8');
    fs.writeFileSync(tsconfigPath, `${JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        lib: ['ES2022', 'DOM'],
        module: 'ESNext',
        moduleResolution: 'Bundler',
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        baseUrl: root,
        paths: {
          '@englishflow/contracts': ['packages/contracts/generated/index.ts'],
          '@englishflow/api-client': ['packages/api-client/src/index.ts'],
        },
      },
      files: [fixturePath],
    }, null, 2)}\n`, 'utf8');
    return spawnSync(process.execPath, [tscPath, '--pretty', 'false', '--project', tsconfigPath], {
      cwd: root,
      encoding: 'utf8',
      windowsHide: true,
    });
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

test('M1-016 generated OpenAPI/client/event projections are current', () => {
  assert.equal(
    hasCurrentProjection(),
    true,
    'M1-016 generated OpenAPI/client/event outputs are stale or missing; run contracts:generate before accepting the contract',
  );
});

test('M1-016 generated types preserve replay facts, server authority, and support command unions', (t) => {
  if (!hasCurrentProjection()) {
    t.skip('generated M1-016 projection is stale; the preceding evidence test identifies the missing regeneration');
    return;
  }

  const result = compileFixture(`
import type {
  M1016NotificationPreferenceCommand,
  M1016SyncProtocolContext,
  M1016SupportAdminCommandRequest,
  M1016SupportMessageCreateRequest,
  M1016SupportTicket,
  M1016SupportTicketCreateRequest,
} from '@englishflow/contracts';
import type { GeneratedApiOperationRegistry } from '@englishflow/api-client';

type Assert<T extends true> = T;
type RequiredKey<T, K extends keyof T> = {} extends Pick<T, K> ? false : true;
type SyncRequired = Assert<
  RequiredKey<M1016SyncProtocolContext, 'clientEventId'> extends true
    ? RequiredKey<M1016SyncProtocolContext, 'clientSeq'> extends true
      ? RequiredKey<M1016SyncProtocolContext, 'baseVersion'> extends true
        ? RequiredKey<M1016SyncProtocolContext, 'contentVersionId'> extends true
          ? RequiredKey<M1016SyncProtocolContext, 'payloadHash'> extends true
            ? RequiredKey<M1016SyncProtocolContext, 'idempotencyKey'> extends true ? true : false
            : false
          : false
        : false
      : false
    : false
>;
type NoClientAuthority = Assert<
  Extract<keyof M1016SupportTicketCreateRequest, 'tenant' | 'tenantId' | 'subject' | 'owner' | 'state' | 'priority' | 'assignment' | 'sla' | 'legalHold'> extends never ? true : false
>;
type NotificationCas = Assert<RequiredKey<M1016NotificationPreferenceCommand, 'expectedVersion'>>;
type SupportCommandIsClosedUnion = Assert<
  M1016SupportAdminCommandRequest extends { command: infer Command; expectedVersion: number }
    ? Command extends object ? true : false
    : false
>;
type RegistryOperations = Assert<
  'updateM1016NotificationPreference' extends keyof GeneratedApiOperationRegistry
    ? 'recoverM1016LearningSyncConflict' extends keyof GeneratedApiOperationRegistry
      ? 'submitM1016SupportTicketCommand' extends keyof GeneratedApiOperationRegistry ? true : false
      : false
    : false
>;

const preference = {
  category: 'SECURITY', enabled: true, locale: 'zh-CN', consentVersion: 1,
  dndWindow: { startLocalTime: '22:00', endLocalTime: '08:00' },
  frequencyPolicy: 'IMMEDIATE', expectedVersion: 2,
} satisfies M1016NotificationPreferenceCommand;
const sync = {
  clientEventId: 'client-event-1', clientSeq: 1, baseVersion: 3,
  contentVersionId: 'content-version-1', payloadHash: 'a'.repeat(64),
  entityType: 'learning.progress', entityId: 'entity-1', operation: 'UPSERT',
  occurredAt: '2026-08-31T00:00:00Z', idempotencyKey: 'idempotency-1',
} satisfies M1016SyncProtocolContext;
const ticket = {
  categoryCode: 'LEARNING_SYNC', resourceRef: 'safe-ref', descriptionContentRef: {
    contentRefId: 'content-ref-1', sha256: 'a'.repeat(64), redactionVersion: 1,
    scanStatus: 'CLEAN', objectVersion: 1, safePreviewRef: 'preview-1',
  }, idempotencyKey: 'idempotency-2',
} satisfies M1016SupportTicketCreateRequest;
const message = {
  clientMessageRef: 'message-1', bodyContentRef: {
    contentRefId: 'content-ref-2', sha256: 'b'.repeat(64), redactionVersion: 1,
    scanStatus: 'CLEAN', objectVersion: 1, safePreviewRef: 'preview-2',
  }, expectedVersion: 1, idempotencyKey: 'idempotency-3',
} satisfies M1016SupportMessageCreateRequest;
const assign = {
  command: { commandType: 'ASSIGN', queueId: 'queue-1', assigneeRef: 'agent-1', reasonCode: 'ROUTING' },
  expectedVersion: 1,
} satisfies M1016SupportAdminCommandRequest;
const transition = {
  command: { commandType: 'TRANSITION', toState: 'WAITING_USER', reasonCode: 'NEED_INFO' },
  expectedVersion: 2,
} satisfies M1016SupportAdminCommandRequest;
// @ts-expect-error support create requests cannot accept client authority fields.
const forgedTicket = { ...ticket, priority: 'P0' } satisfies M1016SupportTicketCreateRequest;
// @ts-expect-error replay facts are mandatory, so an arbitrary partial sync event is not assignable.
const incompleteSync: M1016SyncProtocolContext = { clientEventId: 'event-only' };
// @ts-expect-error command branches must use the generated discriminator, not an arbitrary writer command.
const forgedCommand = { command: { commandType: 'DELETE_ALL' }, expectedVersion: 1 } satisfies M1016SupportAdminCommandRequest;
// @ts-expect-error server-owned support ticket state cannot be forged in a response type.
const forgedTicketState: M1016SupportTicket = { ...ticket, state: 'OPEN' };
void preference; void sync; void ticket; void message; void assign; void transition;
void forgedTicket; void incompleteSync; void forgedCommand; void forgedTicketState;
type _Keep = SyncRequired | NoClientAuthority | NotificationCas | SupportCommandIsClosedUnion | RegistryOperations;
`);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});
