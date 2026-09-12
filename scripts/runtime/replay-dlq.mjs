// Operator replay entry for the event runtime's dead letter topic.
//
// The contract marks the DLQ as operatorOnly and forbids an application from writing domain facts on
// its own authority, so replaying a dead letter is an explicit operator action rather than something
// a service does at boot.
//
//   node scripts/runtime/replay-dlq.mjs                     plan only (default)
//   node scripts/runtime/replay-dlq.mjs --apply             republish every recoverable record
//   node scripts/runtime/replay-dlq.mjs --apply --event-id X  republish one record
//   node scripts/runtime/replay-dlq.mjs --apply --limit 5    republish at most five
//
// Replaying cannot double-apply an effect: the consumer's receipt is keyed on
// (consumerGroup, eventId), so a record that already took effect is acknowledged as a duplicate.
// That property is what makes replay safe to run more than once.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const KAFKA = 'yuxuexing-local-kafka-1';
const KAFKA_BIN = '/opt/kafka/bin';
const DLQ_TOPIC = process.env.DLQ_TOPIC ?? 'platform.events.dlq.v1';

const apply = process.argv.includes('--apply');
const eventIdFilter = process.argv[process.argv.indexOf('--event-id') + 1];
const hasEventId = process.argv.includes('--event-id');
const limitIndex = process.argv.indexOf('--limit');
const limit = limitIndex === -1 ? Number.POSITIVE_INFINITY : Number(process.argv[limitIndex + 1]);
const known = new Set(['--apply', '--event-id', '--limit']);
const unknown = process.argv.slice(2).filter((arg, index, all) => !known.has(arg)
  && !(index > 0 && (all[index - 1] === '--event-id' || all[index - 1] === '--limit')));
if (unknown.length > 0) {
  console.error(`unsupported argument(s): ${unknown.join(', ')}`);
  process.exit(2);
}
if (hasEventId && (!eventIdFilter || eventIdFilter.startsWith('--'))) {
  console.error('--event-id needs a value');
  process.exit(2);
}

function kafka(args, input) {
  const result = spawnSync('docker', ['exec', '-i', KAFKA, 'sh', '-c', `${KAFKA_BIN}/${args}`],
    { cwd: root, input, encoding: 'utf8', windowsHide: true });
  return { ok: result.status === 0, stdout: (result.stdout ?? '').replace(/\r/g, ''), stderr: (result.stderr ?? '').replace(/\r/g, '').trim() };
}

// Read the dead letters without a consumer group, so an operator replay never disturbs a service's
// committed offsets on the DLQ. The console consumer only understands \t and \n escapes, so the
// default tab delimiters are used: header values are comma separated and payloads are JSON, so no
// tab can occur inside a field and the split is unambiguous.
const drain = kafka(`kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic ${DLQ_TOPIC} `
  + '--from-beginning --timeout-ms 8000 --property print.headers=true --property print.key=true');

function parseLine(line) {
  const [headerSection = '', key = '', value = ''] = line.split('\t');
  const headers = {};
  for (const pair of headerSection.split(',')) {
    const index = pair.indexOf(':');
    if (index > 0) headers[pair.slice(0, index).trim()] = pair.slice(index + 1);
  }
  return { headers, key, value };
}

const records = drain.stdout.split('\n').filter((line) => line.trim() !== '').map(parseLine);
const recoverable = records.filter((record) => {
  const topic = record.headers.originalTopic ?? record.headers['kafka_dlt-original-topic'];
  const readable = Boolean(record.headers.eventId && record.headers.eventName
    && record.headers.schemaVersion && record.headers.dedupeKey);
  return Boolean(topic) && readable;
});
const unrecoverable = records.filter((record) => !recoverable.includes(record));
const selected = recoverable
  .filter((record) => !hasEventId || record.headers.eventId === eventIdFilter)
  .slice(0, limit === Number.POSITIVE_INFINITY ? undefined : limit);

const replayed = [];
const failures = [];
if (apply) {
  for (const record of selected) {
    const topic = record.headers.originalTopic ?? record.headers['kafka_dlt-original-topic'];
    // Only the envelope travels back. The DLQ's own failure fields describe the dead letter, not the
    // event, and forwarding them would put the previous failure into the replayed record.
    const envelope = ['eventId', 'eventName', 'schemaVersion', 'eventVersion', 'dedupeKey', 'requestId', 'traceId']
      .filter((name) => record.headers[name])
      .map((name) => `${name}:${record.headers[name]}`)
      .join(',');
    const payload = Buffer.from(`${envelope}\t${record.key}\t${record.value}\n`, 'utf8');
    if (payload[0] === 0xEF && payload[1] === 0xBB && payload[2] === 0xBF) {
      throw new Error('replay payload must not start with a BOM');
    }
    const result = kafka(`kafka-console-producer.sh --bootstrap-server localhost:9092 --topic ${topic} `
      + '--property parse.key=true --property parse.headers=true', payload);
    if (result.ok) replayed.push({ eventId: record.headers.eventId, topic });
    else failures.push({ eventId: record.headers.eventId, topic, error: result.stderr.split('\n')[0] });
  }
}

const evidence = {
  schema: 'platform.event-runtime.dlq-replay.v1',
  taskId: 'P1R-M2-005',
  mode: apply ? 'apply' : 'plan',
  dlqTopic: DLQ_TOPIC,
  sourceCommit: spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', windowsHide: true }).stdout.trim(),
  capturedAt: new Date().toISOString(),
  deadLettersSeen: records.length,
  recoverable: recoverable.map((record) => ({
    eventId: record.headers.eventId,
    topic: record.headers.originalTopic ?? record.headers['kafka_dlt-original-topic'],
    consumerGroup: record.headers.consumerGroup ?? null,
    failureCode: record.headers.failureCode ?? null,
    recoveryState: record.headers.recoveryState ?? null,
  })),
  unrecoverable: unrecoverable.map((record) => ({
    // A record whose envelope cannot be read cannot be replayed; it stays in the DLQ and is
    // reported rather than dropped, so the loss is visible to an operator.
    reason: 'envelope missing or origin topic unknown',
    eventId: record.headers.eventId ?? null,
    recoveryState: record.headers.recoveryState ?? null,
  })),
  selected: selected.length,
  replayed,
  failures,
  note: 'replaying is safe to repeat: the consumer receipt on (consumerGroup, eventId) absorbs a duplicate',
  sensitiveMaterial: { persisted: false, emitted: false },
};

const target = path.join(root, 'evidence/p1r/m2/P1R-M2-005');
fs.mkdirSync(target, { recursive: true });
const file = path.join(target, `dlq-replay-${apply ? 'apply' : 'plan'}-${new Date().toISOString().slice(0, 10)}.json`);
fs.writeFileSync(file, `${JSON.stringify(evidence, null, 2)}\n`);
console.log(`written: ${path.relative(root, file)}`);
console.log(`  mode            : ${evidence.mode}`);
console.log(`  dead letters    : ${evidence.deadLettersSeen} (recoverable ${recoverable.length}, unrecoverable ${unrecoverable.length})`);
console.log(`  selected        : ${selected.length}`);
if (apply) console.log(`  replayed        : ${replayed.length} (failed ${failures.length})`);
else selected.forEach((record) => console.log(`  would replay    : ${record.headers.eventId} -> ${record.headers.originalTopic ?? record.headers['kafka_dlt-original-topic']}`));
process.exitCode = failures.length === 0 ? 0 : 1;
