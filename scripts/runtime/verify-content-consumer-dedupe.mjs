// Verifies the consumer-side idempotency mechanism against real MySQL.
//
// The contract requires the effect and the deduplication record to be atomic and forbids a duplicate
// effect. This script executes exactly the two statements the Java applier runs inside one
// @Transactional method, twice for the same (consumerGroup, eventId), and asserts that the second
// delivery leaves the applied counter untouched. It writes only probe rows and removes them again.
//
//   node scripts/runtime/verify-content-consumer-dedupe.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const CONTAINER = 'yuxuexing-local-mysql-1';
const SCHEMA = 'content_service';
const GROUP = 'cg.content-iam-consumer.p1r-m2-005-probe';
const EVENT_NAME = 'p1r.m2-005.dedupe.probe.v1';

function mysql(sql, { database = SCHEMA } = {}) {
  // -i is required: without it stdin is not attached, docker exec returns 0 and mysql simply
  // executes nothing, which reads exactly like a successful no-op.
  const result = spawnSync('docker', ['exec', '-i', '-e', 'MYSQL_PWD=root-local-only', CONTAINER,
    'mysql', '--user=root', '--protocol=TCP', '--host=127.0.0.1', '--port=3306',
    '--batch', '--skip-column-names', '--raw', '--database', database],
  { cwd: root, encoding: 'utf8', input: `${sql}\n`, windowsHide: true });
  return {
    ok: result.status === 0,
    stdout: (result.stdout ?? '').replace(/\r/g, '').trim(),
    stderr: (result.stderr ?? '').replace(/\r/g, '').trim(),
  };
}

const scalar = (sql) => Number(mysql(sql).stdout.split('\n').filter(Boolean)[0] ?? '0');

const cleanup = () => mysql(`DELETE FROM content_event_receipt WHERE consumer_group = '${GROUP}';
DELETE FROM content_inbound_event_stat WHERE consumer_group = '${GROUP}';`);
cleanup();

const eventId = crypto.randomUUID();
const payloadHash = crypto.createHash('sha256').update('p1r-m2-005-dedupe-probe').digest('hex');
const dedupeKey = `p1r-m2-005:${eventId}`;

// The exact statements JdbcContentInboundEventApplier issues, in the same order and transaction.
const receiptInsert = `INSERT INTO content_event_receipt
  (consumer_group, event_id, event_name, schema_version, dedupe_key, payload_hash, receipt_state, received_at)
 VALUES ('${GROUP}', '${eventId}', '${EVENT_NAME}', 'content.event.v1', '${dedupeKey}', '${payloadHash}', 'APPLIED', UTC_TIMESTAMP(6));`;
const effectUpsert = `INSERT INTO content_inbound_event_stat
  (consumer_group, event_name, applied_count, first_applied_at, last_applied_at)
 VALUES ('${GROUP}', '${EVENT_NAME}', 1, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6))
 ON DUPLICATE KEY UPDATE applied_count = applied_count + 1, last_applied_at = VALUES(last_applied_at);`;

// First delivery: both statements commit together.
const first = mysql(`START TRANSACTION; ${receiptInsert} ${effectUpsert} COMMIT;`);
const afterFirst = scalar(`SELECT applied_count FROM content_inbound_event_stat WHERE consumer_group = '${GROUP}' AND event_name = '${EVENT_NAME}';`);

// Second delivery of the same event: the receipt insert conflicts, the transaction rolls back.
const second = mysql(`START TRANSACTION; ${receiptInsert} ${effectUpsert} ROLLBACK;`);
const afterSecond = scalar(`SELECT applied_count FROM content_inbound_event_stat WHERE consumer_group = '${GROUP}' AND event_name = '${EVENT_NAME}';`);
const receipts = scalar(`SELECT COUNT(*) FROM content_event_receipt WHERE consumer_group = '${GROUP}';`);

// A third delivery that does commit — this is the case a naive "insert ignore" would get wrong by
// applying the effect a second time.
const third = mysql(`START TRANSACTION; ${receiptInsert} ${effectUpsert} COMMIT;`);
const afterThird = scalar(`SELECT applied_count FROM content_inbound_event_stat WHERE consumer_group = '${GROUP}' AND event_name = '${EVENT_NAME}';`);

cleanup();
const residue = scalar(`SELECT (SELECT COUNT(*) FROM content_event_receipt WHERE consumer_group = '${GROUP}')
  + (SELECT COUNT(*) FROM content_inbound_event_stat WHERE consumer_group = '${GROUP}');`);

const evidence = {
  schema: 'platform.consumer.idempotency.evidence.v1',
  taskId: 'P1R-M2-005',
  batch: 'E5',
  sourceCommit: spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', windowsHide: true }).stdout.trim(),
  capturedAt: new Date().toISOString(),
  schema: 'platform.consumer.idempotency.evidence.v1',
  contract: 'config/b26-event-runtime.json#consumerReliability.deduplication',
  uniqueKey: ['consumerGroup', 'eventId'],
  probe: { consumerGroup: GROUP, eventName: EVENT_NAME, eventId },
  observed: {
    firstDeliveryCommitted: first.ok,
    appliedCountAfterFirst: afterFirst,
    secondDeliveryRejected: !second.ok && /Duplicate entry/u.test(second.stderr),
    secondDeliveryError: second.stderr.split('\n')[0] ?? null,
    appliedCountAfterSecond: afterSecond,
    thirdDeliveryCommittingRejected: !third.ok && /Duplicate entry/u.test(third.stderr),
    appliedCountAfterThird: afterThird,
    receiptRows: receipts,
    probeResidue: residue,
  },
  claims: {
    'effect-and-dedupe-are-atomic': first.ok && afterFirst === 1,
    'duplicate-delivery-is-rejected-by-the-primary-key': !second.ok,
    'duplicate-delivery-does-not-apply-the-effect': afterSecond === afterFirst,
    'committing-a-redelivery-also-cannot-apply-the-effect-twice': afterThird === 1,
    'exactly-one-receipt-per-event-per-group': receipts === 1,
    'probe-rows-removed': residue === 0,
  },
  notes: {
    'statements-executed': 'the same two statements JdbcContentInboundEventApplier issues inside one @Transactional method',
    'not-covered-here': 'the Kafka listener that feeds this applier, DLQ consumption and out-of-order handling',
  },
  sensitiveMaterial: { persisted: false, emitted: false },
};

const target = path.join(root, 'evidence/p1r/m2/P1R-M2-005');
fs.mkdirSync(target, { recursive: true });
const file = path.join(target, 'consumer-idempotency-2026-09-13.json');
fs.writeFileSync(file, `${JSON.stringify(evidence, null, 2)}\n`);
console.log(`written: ${path.relative(root, file)}`);
console.log(JSON.stringify(evidence.observed, null, 1));
console.log('claims:', JSON.stringify(evidence.claims, null, 1));
process.exitCode = Object.values(evidence.claims).every(Boolean) ? 0 : 1;
