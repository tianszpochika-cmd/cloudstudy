import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const readJson = (relativePath) => JSON.parse(read(relativePath));

test('B4 backlog is the expected 16-task slice', () => {
  const backlog = read('requirements/backlog/开发实施总纲与功能链条任务分解.md');
  const b4TaskIds = [...backlog.matchAll(/^\| (DEV-(?:08-\d{3}|09-(?:001|002|003|004|005|010|012))) \|.*\| B4 \|/gm)].map((match) => match[1]);
  assert.equal(b4TaskIds.length, 16);
  assert.equal(new Set(b4TaskIds).size, 16);
});

test('B4 OpenAPI covers gamification, social, notification and offline entry points', () => {
  const openapi = readJson('packages/contracts/openapi/v1/openapi.json');
  const requiredPaths = [
    '/api/v1/gamification/me/summary',
    '/api/v1/gamification/streak',
    '/api/v1/games/catalog',
    '/api/v1/games/sessions',
    '/api/v1/avatar/profile',
    '/api/v1/social/rooms',
    '/api/v1/social/ws-ticket',
    '/api/v1/notifications/messages',
    '/api/v1/notifications/messages/{messageId}/read',
    '/api/v1/notifications/messages/read-all',
    '/api/v1/notifications/preferences',
    '/api/v1/sync/offline-packages',
    '/api/v1/offline/sync/push',
    '/api/v1/offline/sync/pull',
  ];
  for (const route of requiredPaths) assert.ok(openapi.paths[route], `missing B4 route ${route}`);
  assert.equal(openapi.paths['/api/v1/notifications/messages'].get.operationId, 'listB12Notifications');
  assert.equal(openapi.paths['/api/v1/notifications/preferences'].get.operationId, 'listB12NotificationPreferences');
  for (const retired of ['/api/v1/gamification/profile', '/api/v1/gamification/seasons/current', '/api/v1/user/notification-preferences']) {
    assert.equal(openapi.paths[retired], undefined, `retired B4 route still present: ${retired}`);
  }
});

test('B4 event catalog and migration retain auditable facts', () => {
  const catalog = readJson('packages/contracts/events/v1/catalog.json');
  const eventNames = new Set(catalog.events.map((event) => event.eventName));
  for (const name of [
    'gamification.xp.ledger_appended.v1',
    'games.session.completed.v1',
    'social.room.joined.v1',
    'social.moderation.reported.v1',
    'notifications.message_read.v1',
    'offline.package.download_state_updated.v1',
  ]) assert.ok(eventNames.has(name), `missing B4 event ${name}`);

  const migration = read('database/mysql/migrations/V0013__create_gamification_social_offline_b4.sql');
  for (const table of [
    'gam_account_summary',
    'gam_xp_ledger',
    'gam_streak_profile',
    'gam_game_session',
    'gam_avatar_inventory',
    'gam_chest_open_audit',
    'soc_room',
    'soc_room_event',
    'soc_moderation_report',
    'soc_user_block',
    'soc_room_mute',
    'inf_notification_message',
    'inf_offline_download',
    'inf_client_event',
    'inf_sync_change_log',
  ]) assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`));
});

test('B4 contract and event schemas do not expose client-authoritative facts', () => {
  const contract = readJson('packages/contracts/fragments/b4-gamification-social.openapi.json');
  for (const schemaName of ['B4LearningEventRequest', 'B4GameEventRequest', 'B4FocusRequest', 'B4SyncRequest', 'B4CheckpointRequest']) {
    const properties = Object.keys(contract.components.schemas[schemaName].properties ?? {});
    for (const forbidden of ['score', 'deltaXp', 'deltaCoins', 'rank', 'serverDurationSeconds']) {
      assert.ok(!properties.includes(forbidden), `${schemaName} accepts client-authoritative field ${forbidden}`);
    }
  }
});

test('B4 game registry keeps all codes while gating availability by release phase', () => {
  const fragment = readJson('packages/contracts/fragments/b4-gamification-social.openapi.json');
  const requestSchema = fragment.components.schemas.B4GameSessionRequest;
  const registry = requestSchema['x-b4-game-registry'];
  const entries = registry.entries;
  assert.equal(entries.length, 6);
  assert.equal(entries.filter((entry) => entry.releasePhase === 'P0').length, 1);
  assert.equal(entries.filter((entry) => entry.releasePhase !== 'LONG_TERM').length, 4);
  assert.equal(entries.filter((entry) => entry.releasePhase === 'LONG_TERM').length, 2);
  assert.deepEqual(entries.filter((entry) => entry.enabled).map((entry) => entry.gameCode), ['SENTENCE_TRAIN']);
  assert.deepEqual(requestSchema.properties.gameCode.enum, entries.map((entry) => entry.gameCode));

  const catalogItem = fragment.components.schemas.B4GameCatalogItem;
  assert.deepEqual(catalogItem.required, ['gameCode', 'releasePhase', 'enabled']);

  const canonical = readJson('packages/contracts/openapi/v1/openapi.json');
  const canonicalSession = canonical.paths['/api/v1/games/sessions'].post;
  assert.equal(canonicalSession.responses['400'].$ref, '#/components/responses/ApiBadRequest');
  assert.equal(canonicalSession.responses['409'].$ref, '#/components/responses/ApiConflict');
  assert.deepEqual(canonical.paths['/api/v1/games/catalog'].get['x-b4-game-registry'], {
    owner: 'gamification-service',
    releasePhase: {
      P0: ['SENTENCE_TRAIN'],
      P1: ['WORD_MATCH', 'WORD_DEFENSE', 'WORD_PUZZLE'],
      LONG_TERM: ['GRAMMAR_BLASTER', 'CATCH_MEANING'],
    },
    enabledByDefault: ['SENTENCE_TRAIN'],
    enumIsRegistryOnly: true,
    disabledSessionResponse: { status: 409, code: 'GAME_NOT_AVAILABLE' },
  });
});
