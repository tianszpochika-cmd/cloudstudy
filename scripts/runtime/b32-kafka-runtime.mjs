import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const runId = process.env.B32_KAFKA_RUN_ID ?? `b32-kafka-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`;
const container = process.env.KAFKA_CONTAINER ?? 'yuxuexing-local-kafka-1';
const broker = process.env.KAFKA_BOOTSTRAP ?? '127.0.0.1:19092';
const mysqlContainer = process.env.MYSQL_CONTAINER ?? 'yuxuexing-local-mysql-1';
const eventRuntime = JSON.parse(readFileSync('config/b26-event-runtime.json', 'utf8'));
const topics = eventRuntime.topics.map(topic => ({
  name: topic.name,
  partitions: topic.localRuntimeOverride?.partitions ?? Math.min(topic.partitions, 3),
}));
const topicByOwner = new Map([
  ['content-service', 'platform.content.v1'],
  ['notification-service', 'platform.notification.v1'],
]);

function fail(message, details = undefined) {
  const error = new Error(message);
  error.details = details;
  throw error;
}

function docker(args, input = undefined, timeout = 30000) {
  const result = spawnSync('docker', ['exec', ...(input === undefined ? [] : ['-i']), container, ...args], {
    input, encoding: 'utf8', windowsHide: true, timeout,
  });
  if (result.error || result.status !== 0) {
    fail('Kafka command failed', { command: args[0], stderr: (result.stderr ?? '').trim().slice(0, 500) });
  }
  return (result.stdout ?? '').trim();
}

function dockerAllowConsumerTimeout(args, timeout = 20000) {
  return spawnSync('docker', ['exec', container, ...args], {
    encoding: 'utf8', windowsHide: true, timeout,
  });
}

function mysql(schema, sql) {
  const result = spawnSync('docker', [
    'exec', mysqlContainer, 'mysql', '-uroot', '-proot-local-only', schema,
    '--batch', '--skip-column-names', '-e', sql,
  ], { encoding: 'utf8', windowsHide: true });
  if (result.error || result.status !== 0) {
    fail(`MySQL outbox query failed: ${schema}`, (result.stderr ?? '').trim().slice(0, 500));
  }
  return (result.stdout ?? '').trim();
}

function queryLatestOutbox(schema, table, source) {
  const actor = source === 'content-service' ? "COALESCE(actor_id, 'service-owner')" : "'notification-service'";
  const sql = `SELECT event_id, event_name, aggregate_id, schema_version, dedupe_key,
      ${actor}, COALESCE(request_id, ''), COALESCE(trace_id, ''), JSON_UNQUOTE(payload_json)
    FROM ${table} ORDER BY created_at DESC LIMIT 1`;
  const line = mysql(schema, sql).split(/\r?\n/).filter(Boolean)[0];
  if (!line) fail(`No durable ${source} outbox row exists`);
  const fields = line.split('\t');
  if (fields.length < 9) fail(`Malformed ${source} outbox row`);
  let payload;
  try { payload = JSON.parse(fields.slice(8).join('\t')); } catch { fail(`Outbox payload is not JSON: ${source}`); }
  return {
    source, eventId: fields[0], eventName: fields[1], aggregateId: fields[2],
    schemaVersion: fields[3], dedupeKey: fields[4], actorId: fields[5],
    requestId: fields[6], traceId: fields[7], payload,
  };
}

function envelope(row, topic) {
  const traceId = /^[a-f0-9]{32}$/i.test(row.traceId)
    ? row.traceId : crypto.createHash('sha256').update(`${runId}:${row.eventId}`).digest('hex').slice(0, 32);
  return {
    eventId: row.eventId,
    eventName: row.eventName,
    schema: 'platform.integration.v1',
    version: 1,
    occurredAt: new Date().toISOString(),
    aggregateType: row.source === 'content-service' ? 'content' : 'notification',
    aggregateId: row.aggregateId,
    actorId: row.actorId,
    tenantId: row.payload?.tenantId ?? 'platform',
    requestId: row.requestId || `${runId}-${row.eventId}`,
    traceId,
    schemaVersion: row.schemaVersion,
    dedupeKey: row.dedupeKey,
    payload: row.payload,
    topic,
  };
}

function createTopics() {
  for (const topic of topics) {
    docker(['/opt/kafka/bin/kafka-topics.sh', '--bootstrap-server', broker, '--create', '--if-not-exists',
      '--topic', topic.name, '--partitions', String(topic.partitions), '--replication-factor', '1']);
  }
  const listed = docker(['/opt/kafka/bin/kafka-topics.sh', '--bootstrap-server', broker, '--list'])
    .split(/\r?\n/).filter(Boolean);
  for (const topic of topics) if (!listed.includes(topic.name)) fail(`Kafka topic was not created: ${topic.name}`);
  return listed.filter(name => topics.some(topic => topic.name === name));
}

function produce(topic, messages) {
  const input = messages.map(message => `${message.aggregateId}|${JSON.stringify(message)}`).join('\n') + '\n';
  docker(['/opt/kafka/bin/kafka-console-producer.sh', '--bootstrap-server', broker, '--topic', topic,
    '--property', 'parse.key=true', '--property', 'key.separator=|'], input);
}

function consume(topic, group, maxMessages) {
  const result = dockerAllowConsumerTimeout(['/opt/kafka/bin/kafka-console-consumer.sh', '--bootstrap-server', broker, '--topic', topic,
    '--group', group, '--from-beginning', '--max-messages', String(maxMessages), '--timeout-ms', '10000',
    '--property', 'print.key=true', '--property', 'key.separator=|']);
  if (result.error && !result.stdout) fail('Kafka consumer failed', (result.stderr ?? '').trim().slice(0, 500));
  if (result.status !== 0 && !(result.stdout ?? '').trim()) fail('Kafka consumer failed', (result.stderr ?? '').trim().slice(0, 500));
  const output = (result.stdout ?? '').trim();
  const messages = [];
  for (const line of output.split(/\r?\n/).filter(Boolean)) {
    const separator = line.indexOf('|');
    const value = separator >= 0 ? line.slice(separator + 1) : line;
    try { messages.push(JSON.parse(value)); } catch { /* console consumer may emit a non-message status line */ }
  }
  return messages;
}

function describeOffset(topic, group) {
  const output = docker(['/opt/kafka/bin/kafka-consumer-groups.sh', '--bootstrap-server', broker,
    '--describe', '--group', group]);
  const rows = output.split(/\r?\n/).map(line => line.trim().split(/\s+/))
    .filter(fields => fields[1] === topic && /^\d+$/.test(fields[2] ?? '') && /^\d+$/.test(fields[3] ?? ''));
  if (rows.length === 0) return null;
  return { partitions: rows.map(fields => Number(fields[2])),
    currentOffset: rows.reduce((sum, fields) => sum + Number(fields[3]), 0),
    logEndOffset: rows.reduce((sum, fields) => sum + Number(fields[4]), 0),
    lag: rows.reduce((sum, fields) => sum + Number(fields[5]), 0) };
}

function main() {
  const topicList = createTopics();
  const rows = [
    queryLatestOutbox('content_service', 'content_outbox_event', 'content-service'),
    queryLatestOutbox('notification_service', 'notification_outbox_event', 'notification-service'),
  ];
  const published = rows.map(row => envelope(row, topicByOwner.get(row.source)));
  const byTopic = new Map();
  for (const event of published) byTopic.set(event.topic, [...(byTopic.get(event.topic) ?? []), event]);
  // A second identical publish is intentional: it is the at-least-once/replay input.
  for (const [topic, events] of byTopic) produce(topic, [...events, ...events]);

  const dlqEventId = `dlq-${runId}`;
  const dlq = {
    eventId: dlqEventId, eventName: 'platform.runtime.invalid.v1', schema: 'platform.integration.v1', version: 1,
    occurredAt: new Date().toISOString(), aggregateType: 'runtime-test', aggregateId: `${runId}-aggregate`,
    actorId: 'workflow-runtime-test', tenantId: 'platform', requestId: `${runId}-dlq`,
    traceId: crypto.createHash('sha256').update(`${runId}:dlq`).digest('hex').slice(0, 32), schemaVersion: 'platform.integration.v1',
    dedupeKey: `${runId}:dlq`, payload: { failureCode: 'SCHEMA_INVALID', attempt: 1, recoveryState: 'DLQ' },
    consumerGroup: 'cg.workflow-manual-recovery-dlq.v1', failureCode: 'SCHEMA_INVALID', attempt: 1,
    failedAt: new Date().toISOString(), recoveryState: 'DLQ',
  };
  produce('platform.events.dlq.v1', [dlq]);

  const consumed = {};
  for (const [topic, events] of byTopic) {
    const group = `cg.b32-runtime-${topic.replaceAll('.', '-')}-${runId}`;
    const received = consume(topic, group, 1000);
    const expectedIds = new Set(events.map(event => event.eventId));
    const relevant = received.filter(event => expectedIds.has(event.eventId));
    const uniqueIds = new Set(relevant.map(event => event.eventId));
    if (relevant.length < events.length * 2 || uniqueIds.size !== events.length) {
      fail(`Kafka duplicate/replay evidence is incomplete for ${topic}`, { received: relevant.length, unique: uniqueIds.size });
    }
    consumed[topic] = {
      group, received: relevant.length, uniqueEventIds: uniqueIds.size,
      duplicateDeliveries: relevant.length - uniqueIds.size, offset: describeOffset(topic, group),
    };
  }
  const dlqGroup = `cg.b32-runtime-dlq-${runId}`;
  const dlqReceived = consume('platform.events.dlq.v1', dlqGroup, 1000).filter(event => event.eventId === dlqEventId);
  if (dlqReceived.length !== 1 || dlqReceived[0].failureCode !== 'SCHEMA_INVALID') fail('Kafka DLQ evidence is incomplete');
  consumed['platform.events.dlq.v1'] = { group: dlqGroup, received: 1, failureCode: dlqReceived[0].failureCode, offset: describeOffset('platform.events.dlq.v1', dlqGroup) };

  console.log(JSON.stringify({ result: 'PASS', runId, topicCount: topicList.length,
    topics: topicList, sourceOutboxRows: rows.map(row => ({ source: row.source, eventId: row.eventId,
      eventName: row.eventName, aggregateId: row.aggregateId, hasDedupeKey: Boolean(row.dedupeKey),
      hasTraceId: Boolean(row.traceId), payloadEmitted: true })), consumed, credentialsPersisted: false,
    tokenValuesEmitted: false, sourceRowsMutated: false }, null, 2));
}

try { main(); } catch (error) {
  console.error(JSON.stringify({ result: 'FAIL', runId, message: error.message, details: error.details ?? null }, null, 2));
  process.exitCode = 1;
}
