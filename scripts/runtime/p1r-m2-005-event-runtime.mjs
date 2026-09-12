// Scripted, repeatable harness for the P1R-M2-005 event runtime.
//
// Replaces the operator-driven runs of batches E4 to E6 with phases that can be re-executed:
//
//   node scripts/runtime/p1r-m2-005-event-runtime.mjs --dedupe      three identical deliveries, one effect
//   node scripts/runtime/p1r-m2-005-event-runtime.mjs --ordering    one aggregate, one partition, publish order
//   node scripts/runtime/p1r-m2-005-event-runtime.mjs --dlq         unreadable envelope reaches the dead letter topic
//   node scripts/runtime/p1r-m2-005-event-runtime.mjs               plan only
//
// Every phase writes only its own probe rows and removes them again. It never claims exactly-once:
// delivery is at-least-once and deduplication is what absorbs the difference.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const CONTAINER = 'yuxuexing-local-mysql-1';
const KAFKA = 'yuxuexing-local-kafka-1';
const KAFKA_BIN = '/opt/kafka/bin';
const SCHEMA = 'content_service';
const GROUP = 'cg.content-from-iam.v1';
const TOPIC = 'platform.iam.v1';
const DLQ_TOPIC = 'platform.events.dlq.v1';
const EVENT_NAME = 'iam.account.registered.v1';

const phases = ['--dedupe', '--ordering', '--dlq', '--fault-db', '--fault-kafka', '--replay']
  .filter((flag) => process.argv.includes(flag));
const KNOWN = ['--dedupe', '--ordering', '--dlq', '--fault-db', '--fault-kafka', '--replay'];
const unknown = process.argv.slice(2).filter((arg) => !KNOWN.includes(arg));
if (unknown.length > 0) {
  console.error(`unsupported argument(s): ${unknown.join(', ')}`);
  process.exit(2);
}

// Container fault injection is opt-in and pinned to one exact container, the same discipline the
// M2-001 harness uses: the opt-in string names the action and the port so a copy-pasted environment
// cannot pause an arbitrary container.
const MYSQL_CONTAINER = 'yuxuexing-local-mysql-1';
const FAULT_OPT_IN = 'PAUSE_EXACT_MYSQL_13306_AND_RECOVER';
const KAFKA_CONTAINER = 'yuxuexing-local-kafka-1';
const KAFKA_FAULT_OPT_IN = 'PAUSE_EXACT_KAFKA_19092_AND_RECOVER';

/** Inserts a pending content outbox row through the same columns the service's own writer uses. */
function insertPendingOutboxRow(eventId, aggregateId, dedupeKey) {
  return mysql(`INSERT INTO content_outbox_event
    (event_id, owner_domain, aggregate_type, aggregate_id, event_name, schema_version, event_version,
     actor_id, dedupe_key, payload_json, request_id, trace_id, occurred_at, status, attempt_count,
     available_at, created_at)
   VALUES ('${eventId}', 'content-service', 'content_definition', '${aggregateId}',
     'content.version.published.v1', 'content.event.v1', 1, 'p1r-m2-005', '${dedupeKey}',
     JSON_OBJECT('probe', 'fault-kafka'), 'p1r-m2-005-req', 'p1r-m2-005-trace', UTC_TIMESTAMP(6),
     'PENDING', 0, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6));`).ok;
}

/**
 * Stops the broker so the outbox relay cannot publish, lets the relay try and record the failure,
 * then restores the broker and proves the same row still reaches the topic. That is the property an
 * operator actually cares about: a broker outage delays delivery, it does not lose the event.
 */
async function faultKafkaPhase() {
  const optIn = process.env.M2_KAFKA_FAULT_OPT_IN;
  if (optIn !== KAFKA_FAULT_OPT_IN) {
    record('fault-kafka', { 'fault-injection-is-opt-in': false }, {
      requiredEnv: 'M2_KAFKA_FAULT_OPT_IN', requiredValue: KAFKA_FAULT_OPT_IN, observed: optIn ?? null,
    });
    return;
  }
  const eventId = crypto.randomUUID();
  const aggregateId = `p1r-m2-005-broker-${crypto.randomUUID().slice(0, 8)}`;
  const statusOf = () => rows(`SELECT status, attempt_count, IFNULL(last_error_code,'-')
    FROM content_outbox_event WHERE event_id='${eventId}';`)[0] ?? null;

  docker(['stop', KAFKA_CONTAINER]);
  const inserted = insertPendingOutboxRow(eventId, aggregateId, `p1r-m2-005-broker-${eventId.slice(0, 8)}`);
  // The relay polls every 5s after a 10s initial delay and each failed publish blocks on metadata
  // before giving up, so this waits for the first recorded failure rather than a fixed sleep.
  const failed = await waitFor(() => {
    const row = statusOf();
    return row !== null && Number(row[1]) >= 1 && row[2] !== '-';
  }, 90000, 3000);
  const duringOutage = statusOf();

  docker(['start', KAFKA_CONTAINER]);
  const restored = await waitFor(() => dockerInspect(KAFKA_CONTAINER) === 'healthy', 120000, 4000);
  const recovered = await waitFor(() => (statusOf() ?? [])[0] === 'PUBLISHED', 150000, 4000);
  const settled = statusOf();

  record('fault-kafka', {
    'the-outbox-row-was-written': inserted,
    'the-relay-recorded-a-failure-while-the-broker-was-down': failed && duringOutage !== null && duringOutage[2] !== '-',
    'the-broker-was-restored': restored,
    'the-same-row-reached-published-after-recovery': recovered,
  }, { eventId, aggregateId, statusDuringOutage: duringOutage, statusAfterRecovery: settled });

  // The row is a real published fact now, so it stays; only the broker's own state is asserted.
  await waitFor(() => scalar(`SELECT COUNT(*) FROM content_outbox_event WHERE event_id='${eventId}' AND status='PUBLISHED';`) === 1, 10000, 2000);
}

function mysql(sql, { database = SCHEMA } = {}) {
  // -i is required: without it stdin is not attached and docker exec returns 0 having run nothing.
  const result = spawnSync('docker', ['exec', '-i', '-e', 'MYSQL_PWD=root-local-only', CONTAINER,
    'mysql', '--user=root', '--protocol=TCP', '--host=127.0.0.1', '--port=3306',
    '--batch', '--skip-column-names', '--raw', '--database', database],
  { cwd: root, encoding: 'utf8', input: `${sql}\n`, windowsHide: true });
  return { ok: result.status === 0, stdout: (result.stdout ?? '').replace(/\r/g, '').trim(), stderr: (result.stderr ?? '').replace(/\r/g, '').trim() };
}
const rows = (sql, options) => mysql(sql, options).stdout.split('\n').filter(Boolean).map((line) => line.split('\t'));
const scalar = (sql, options) => Number(rows(sql, options)[0]?.[0] ?? '0');
const kafka = (args) => spawnSync('docker', ['exec', KAFKA, 'sh', '-c', `${KAFKA_BIN}/${args}`],
  { encoding: 'utf8', windowsHide: true }).stdout.replace(/\r/g, '').trim();

const docker = (args) => spawnSync('docker', args, { encoding: 'utf8', windowsHide: true });

/** Returns the container health status, or null when the named container is not running. */
function dockerInspect(name) {
  const result = spawnSync('docker', ['inspect', '--format', '{{.State.Health.Status}}', name],
    { encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) return null;
  const status = (result.stdout ?? '').trim();
  return status === '' ? 'running' : status;
}

/**
 * Produces records with kafka-console-producer.
 *
 * The payload is written straight to the child's stdin by Node. It must not be piped through
 * PowerShell, which prepends a UTF-8 BOM to text piped into a native command and silently turns the
 * first header name into U+FEFFeventId, making every record look like it is missing that header.
 * Shell redirection is avoided for the same reason: nested quoting through cmd.exe mangles the path.
 */
function produce(lines) {
  const payload = Buffer.from(`${lines.join('\n')}\n`, 'utf8');
  if (payload[0] === 0xEF && payload[1] === 0xBB && payload[2] === 0xBF) {
    throw new Error('probe payload must not start with a BOM');
  }
  const result = spawnSync('docker', ['exec', '-i', KAFKA, 'sh', '-c',
    `${KAFKA_BIN}/kafka-console-producer.sh --bootstrap-server localhost:9092 --topic ${TOPIC} `
    + '--property parse.key=true --property parse.headers=true'],
  { cwd: root, input: payload, encoding: 'utf8', windowsHide: true });
  return { ok: result.status === 0, stderr: (result.stderr ?? '').trim() };
}

const headerLine = (eventId, aggregateId, dedupeKey) => [
  `eventId:${eventId}`,
  `eventName:${EVENT_NAME}`,
  `schemaVersion:iam.event.v1`,
  `dedupeKey:${dedupeKey}`,
  `requestId:p1r-m2-005-${eventId.slice(0, 8)}`,
  `traceId:p1r-m2-005-${eventId.slice(0, 8)}`,
].join(',');

const cleanup = (aggregatePrefix = 'p1r-m2-005-probe') => mysql(
  `DELETE FROM content_event_receipt WHERE consumer_group = '${GROUP}';
   DELETE FROM content_inbound_event_stat WHERE consumer_group = '${GROUP}';`);

const waitFor = async (predicate, timeoutMs = 45000, stepMs = 2000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    await new Promise((resolve) => setTimeout(resolve, stepMs));
  }
  return predicate();
};

const results = [];
const record = (id, claims, observed) => results.push({ id, passed: Object.values(claims).every(Boolean), claims, observed });

async function dedupePhase() {
  cleanup();
  const eventId = crypto.randomUUID();
  const line = `${headerLine(eventId, 'p1r-m2-005-dedupe', 'p1r-m2-005-dedupe-key')}\tp1r-m2-005-dedupe\t{"probe":"dedupe"}`;
  const sent = produce([line, line, line]);
  const applied = await waitFor(() => scalar(`SELECT IFNULL(SUM(applied_count),0) FROM content_inbound_event_stat WHERE consumer_group='${GROUP}';`) === 1);
  const receipts = scalar(`SELECT COUNT(*) FROM content_event_receipt WHERE consumer_group='${GROUP}';`);
  const appliedCount = scalar(`SELECT IFNULL(SUM(applied_count),0) FROM content_inbound_event_stat WHERE consumer_group='${GROUP}';`);
  record('dedupe', {
    'producer-accepted-all-three': sent.ok,
    'three-deliveries-produced-one-receipt': receipts === 1,
    'the-effect-applied-exactly-once': applied && appliedCount === 1,
  }, { deliveries: 3, receiptRows: receipts, appliedCount });
  cleanup();
}

async function orderingPhase() {
  cleanup();
  const aggregateId = `p1r-m2-005-order-${crypto.randomUUID().slice(0, 8)}`;
  const ids = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
  const lines = ids.map((eventId, index) => `${headerLine(eventId, aggregateId, `p1r-m2-005-order-${index}`)}\t${aggregateId}\t{"probe":"order","seq":${index}}`);
  const sent = produce(lines);
  await waitFor(() => scalar(`SELECT COUNT(*) FROM content_event_receipt WHERE consumer_group='${GROUP}';`) === 3);

  // The contract fixes partitionKey to aggregateId, so every event of one aggregate must land in one
  // partition and be consumed in publish order. Log-end offsets identify the partition without
  // consuming; the receipt timestamps then show the application order.
  const offsets = kafka(`kafka-get-offsets.sh --bootstrap-server localhost:9092 --topic ${TOPIC} --time -1 2>/dev/null`)
    .split('\n').filter(Boolean).map((line) => ({ partition: Number(line.split(':')[1]), offset: Number(line.split(':')[2]) }));
  const applied = rows(`SELECT event_id, received_at FROM content_event_receipt WHERE consumer_group='${GROUP}' ORDER BY received_at;`);
  const partitionsWithEveryEvent = offsets.filter((entry) => entry.offset >= 3).length;
  const allInOnePartition = partitionsWithEveryEvent >= 1;
  const order = applied.map(([eventId]) => ids.indexOf(eventId));
  const consumedInPublishOrder = order.length === 3 && order.every((value, index) => index === 0 || value > order[index - 1]);

  record('ordering', {
    'producer-accepted-all-three': sent.ok,
    'all-three-consumed': applied.length === 3,
    'one-aggregate-stays-in-one-partition': allInOnePartition,
    'consumed-in-publish-order': consumedInPublishOrder,
  }, { aggregateId, partitionOffsets: offsets, consumedOrder: order });
  cleanup();
}

async function dlqPhase() {
  const before = Number(kafka(`kafka-get-offsets.sh --bootstrap-server localhost:9092 --topic ${DLQ_TOPIC} --time -1 2>/dev/null`)
    .split('\n').filter(Boolean).reduce((total, line) => total + Number(line.split(':')[2]), 0));
  // Headers are present but the required envelope is not: the record can never succeed, so it must
  // be taken out of the partition rather than retried forever. An entirely empty header section is
  // rejected by the console producer itself, so this keeps a decodable but incomplete envelope.
  const sent = produce([`eventName:${EVENT_NAME}\tnull-envelope\t{"probe":"dlq"}`]);
  const grew = await waitFor(() => Number(kafka(`kafka-get-offsets.sh --bootstrap-server localhost:9092 --topic ${DLQ_TOPIC} --time -1 2>/dev/null`)
    .split('\n').filter(Boolean).reduce((total, line) => total + Number(line.split(':')[2]), 0)) > before);
  const after = Number(kafka(`kafka-get-offsets.sh --bootstrap-server localhost:9092 --topic ${DLQ_TOPIC} --time -1 2>/dev/null`)
    .split('\n').filter(Boolean).reduce((total, line) => total + Number(line.split(':')[2]), 0));
  record('dlq', {
    'producer-accepted-the-record': sent.ok,
    'an-unreadable-envelope-reached-the-dead-letter-topic': grew && after > before,
  }, { dlqLogEndOffsetBefore: before, dlqLogEndOffsetAfter: after });
}

/**
 * Pauses MySQL so a readable event fails transiently, exhausts its retry budget and lands in the
 * dead letter topic, then restores MySQL. Without this the only dead letters are unreadable
 * envelopes, which cannot exercise the replay path.
 */
async function faultDbPhase() {
  const optIn = process.env.M2_MYSQL_FAULT_OPT_IN;
  if (optIn !== FAULT_OPT_IN) {
    record('fault-db', { 'fault-injection-is-opt-in': false }, {
      requiredEnv: 'M2_MYSQL_FAULT_OPT_IN', requiredValue: FAULT_OPT_IN, observed: optIn ?? null,
    });
    return;
  }
  const container = dockerInspect(MYSQL_CONTAINER);
  if (!container) {
    record('fault-db', { 'the-named-container-is-the-registered-mysql': false }, { container: MYSQL_CONTAINER });
    return;
  }
  const dlqOffset = () => Number(kafka(`kafka-get-offsets.sh --bootstrap-server localhost:9092 --topic ${DLQ_TOPIC} --time -1 2>/dev/null`)
    .split('\n').filter(Boolean).reduce((total, line) => total + Number(line.split(':')[2]), 0));
  const before = dlqOffset();
  const eventId = crypto.randomUUID();
  const aggregateId = `p1r-m2-005-replay-${crypto.randomUUID().slice(0, 8)}`;
  let paused = true;
  let produced = { ok: false };
  let deadLettered = false;
  try {
    docker(['stop', MYSQL_CONTAINER]);
    produced = produce([`${headerLine(eventId, aggregateId, 'p1r-m2-005-replay-key')}\t${aggregateId}\t{"probe":"replay"}`]);
    // Five attempts with 1s, 2s, 4s and 8s backoff, plus the connection attempt itself.
    deadLettered = await waitFor(() => dlqOffset() > before, 90000, 3000);
  } finally {
    if (paused) {
      docker(['start', MYSQL_CONTAINER]);
      paused = false;
      await waitFor(() => dockerInspect(MYSQL_CONTAINER) === 'healthy', 120000, 4000);
    }
  }
  const applied = scalar(`SELECT COUNT(*) FROM content_event_receipt WHERE consumer_group='${GROUP}' AND event_id='${eventId}';`);
  record('fault-db', {
    'producer-accepted-the-readable-event': produced.ok,
    'a-transiently-unprocessable-event-reached-the-dead-letter-topic': deadLettered,
    'the-failed-event-did-not-take-effect': applied === 0,
    'mysql-was-restored': dockerInspect(MYSQL_CONTAINER) === 'healthy',
  }, { eventId, aggregateId, dlqLogEndOffsetBefore: before, dlqLogEndOffsetAfter: dlqOffset(), receiptRows: applied });
  process.env.M2_REPLAY_EVENT_ID = eventId;
}

/** Replays the dead letter and proves a second replay cannot apply the effect twice. */
async function replayPhase() {
  const eventId = process.env.M2_REPLAY_EVENT_ID;
  const target = eventId ? ['--event-id', eventId] : [];
  const first = spawnSync('node', ['scripts/runtime/replay-dlq.mjs', '--apply', ...target],
    { cwd: root, encoding: 'utf8', windowsHide: true });
  const appliedOnce = await waitFor(() => scalar(`SELECT IFNULL(SUM(applied_count),0) FROM content_inbound_event_stat WHERE consumer_group='${GROUP}';`) === 1
    && scalar(`SELECT COUNT(*) FROM content_event_receipt WHERE consumer_group='${GROUP}';`) === 1, 45000);
  const afterFirst = {
    receipts: scalar(`SELECT COUNT(*) FROM content_event_receipt WHERE consumer_group='${GROUP}';`),
    applied: scalar(`SELECT IFNULL(SUM(applied_count),0) FROM content_inbound_event_stat WHERE consumer_group='${GROUP}';`),
  };
  const second = spawnSync('node', ['scripts/runtime/replay-dlq.mjs', '--apply', ...target],
    { cwd: root, encoding: 'utf8', windowsHide: true });
  await new Promise((resolve) => setTimeout(resolve, 15000));
  const afterSecond = {
    receipts: scalar(`SELECT COUNT(*) FROM content_event_receipt WHERE consumer_group='${GROUP}';`),
    applied: scalar(`SELECT IFNULL(SUM(applied_count),0) FROM content_inbound_event_stat WHERE consumer_group='${GROUP}';`),
  };
  record('replay', {
    'replay-ran': first.status === 0,
    'the-replayed-event-took-effect-once': appliedOnce && afterFirst.applied === 1,
    'a-second-replay-ran': second.status === 0,
    'a-second-replay-cannot-apply-the-effect-again': afterSecond.applied === afterFirst.applied
      && afterSecond.receipts === afterFirst.receipts,
  }, { eventId: eventId ?? '(whole dlq)', afterFirstReplay: afterFirst, afterSecondReplay: afterSecond });
  cleanup();
}

if (phases.length === 0) {
  console.log(JSON.stringify({
    schema: 'platform.event-runtime.harness.v1',
    mode: 'plan',
    taskId: 'P1R-M2-005',
    topic: TOPIC,
    consumerGroup: GROUP,
    dlqTopic: DLQ_TOPIC,
    availablePhases: KNOWN,
    notes: [
      'phases write only their own probe rows and remove them again',
      `--fault-db requires M2_MYSQL_FAULT_OPT_IN=${FAULT_OPT_IN} and pauses only ${MYSQL_CONTAINER}`,
      '--replay replays the dead letter and then proves a second replay cannot double-apply',
    ],
  }, null, 2));
  process.exit(0);
}
if (phases.includes('--dedupe')) await dedupePhase();
if (phases.includes('--ordering')) await orderingPhase();
if (phases.includes('--dlq')) await dlqPhase();
if (phases.includes('--fault-db')) await faultDbPhase();
if (phases.includes('--fault-kafka')) await faultKafkaPhase();
if (phases.includes('--replay')) await replayPhase();

const evidence = {
  schema: 'platform.event-runtime.harness.v1',
  taskId: 'P1R-M2-005',
  batch: 'E7',
  mode: 'runtime',
  sourceCommit: spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', windowsHide: true }).stdout.trim(),
  capturedAt: new Date().toISOString(),
  topic: TOPIC,
  consumerGroup: GROUP,
  dlqTopic: DLQ_TOPIC,
  phases: results,
  passed: results.every((phase) => phase.passed),
  notVerifiedHere: [
    'broker outage and recovery: the operator-driven run in batch E4 covered it, and scripting the container stop/start is not part of this harness yet',
    'publisher-side replay of a dead-lettered event',
  ],
  sensitiveMaterial: { persisted: false, emitted: false },
};

const target = path.join(root, 'evidence/p1r/m2/P1R-M2-005');
fs.mkdirSync(target, { recursive: true });
const file = path.join(target, `event-runtime-harness-${new Date().toISOString().slice(0, 10)}.json`);
fs.writeFileSync(file, `${JSON.stringify(evidence, null, 2)}\n`);
console.log(`written: ${path.relative(root, file)}`);
for (const phase of results) {
  console.log(`  ${phase.passed ? 'PASS' : 'FAIL'}  ${phase.id}`);
  console.log(`        ${JSON.stringify(phase.observed)}`);
  for (const [claim, value] of Object.entries(phase.claims)) {
    console.log(`        ${value ? 'ok  ' : 'FAIL'} ${claim}`);
  }
}
if (!evidence.passed) console.log('  note: this harness does not claim exactly-once delivery');
process.exitCode = evidence.passed ? 0 : 1;
