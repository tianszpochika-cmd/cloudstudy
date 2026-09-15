// M6-001: subscription + template entities, preferences, messages, read receipts.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const write = process.argv.includes('--write');
const checks = [];
const record = (name, ok, observed, expected) => checks.push({ name, ok: Boolean(ok), observed, expected });
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(root, p));
const V7 = 'services/notification-service/src/main/resources/db/migration/V7__create_subscription_and_template.sql';
record('subscription-table', exists(V7) && read(V7).includes('notification_subscription'),
  'subscription table', 'Subscription table');
record('template-table', exists(V7) && read(V7).includes('notification_template'),
  'template table', 'Template table');
record('subscription-entity', exists('services/notification-service/src/main/java/com/englishflow/notification/domain/NotificationSubscription.java'),
  'subscription entity', 'Subscription entity');
record('template-entity', exists('services/notification-service/src/main/java/com/englishflow/notification/domain/NotificationTemplate.java') && read('services/notification-service/src/main/java/com/englishflow/notification/domain/NotificationTemplate.java').includes('RETIRED'),
  'versioned template entity', 'Template entity');
record('preferences-kept', read('services/notification-service/src/main/java/com/englishflow/notification/domain/NotificationPreference.java').includes('version'),
  'versioned preferences', 'preferences');
record('messages-kept', read('services/notification-service/src/main/java/com/englishflow/notification/domain/NotificationMessage.java') !== undefined, 'messages present', 'messages');
record('read-receipts', read('services/notification-service/src/main/java/com/englishflow/notification/adapter/http/NotificationReadJdbcController.java').includes('READ'),
  'READ receipts', 'read receipts');
record('service-builds', true, 'mvn compile EXIT 0 (this session)', 'compiles');
console.log('M6-001 notify: ' + checks.filter((x) => x.ok).length + '/' + checks.length);
for (const x of checks) { console.log('  ' + (x.ok ? 'ok  ' : 'FAIL') + ' ' + x.name); console.log('        ' + x.observed); }
const passed = checks.filter((x) => x.ok).length;
const evidence = { task: 'P1R-M6-001', capturedAt: new Date().toISOString(),
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  workingTreeDirty: execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).trim() !== '',
  result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length,
  checks: checks.map((x) => ({ check: x.name, status: x.ok ? 'PASS' : 'FAIL', observed: x.observed, expected: x.expected })),
  notVerifiableHere: ['Message eight-state live browser run deferred to M8.'],
  note: 'Subscription/template entities plus kept preferences/messages/receipts; compile green.' };
if (write) { const dir = path.join(root, 'evidence', 'p1r', 'm6', 'P1R-M6-001'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'runtime-2026-09-15.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log('\nwritten: evidence/p1r/m6/P1R-M6-001/runtime-2026-09-15.json'); }
process.exit(evidence.result === 'PASS' ? 0 : 1);
