// Captures the M2-005 E6 consumer-side deduplication run as canonical evidence.
// The three deliveries were produced by hand this round; this script only observes the result.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const CONTAINER = 'yuxuexing-local-mysql-1';
const KAFKA = 'yuxuexing-local-kafka-1';
const GROUP = 'cg.content-from-iam.v1';

const mysql = (sql) => spawnSync('docker', ['exec', '-i', '-e', 'MYSQL_PWD=root-local-only', CONTAINER,
  'mysql', '--user=root', '--protocol=TCP', '--host=127.0.0.1', '--port=3306', '--batch', '--skip-column-names', '--raw',
  '--database', 'content_service'], { encoding: 'utf8', input: `${sql}\n`, windowsHide: true })
  .stdout.replace(/\r/g, '').trim();
const kafka = (args) => spawnSync('docker', ['exec', KAFKA, 'sh', '-c', `/opt/kafka/bin/${args}`],
  { encoding: 'utf8', windowsHide: true }).stdout.replace(/\r/g, '').trim();

const rows = (sql) => mysql(sql).split('\n').filter(Boolean).map((line) => line.split('\t'));
const scalar = (sql) => Number(mysql(sql).split('\n').filter(Boolean)[0] ?? '0');

const receipts = rows(`SELECT consumer_group, event_id, event_name, receipt_state
  FROM content_event_receipt WHERE consumer_group = '${GROUP}';`);
const stats = rows(`SELECT consumer_group, event_name, applied_count FROM content_inbound_event_stat
  WHERE consumer_group = '${GROUP}';`);
const lag = kafka(`kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --group ${GROUP} 2>/dev/null`)
  .split('\n').filter((line) => line.includes('platform.iam.v1'))
  .map((line) => line.trim().split(/\s+/))
  .map((parts) => ({ partition: Number(parts[2]), currentOffset: parts[3], logEndOffset: Number(parts[4]), lag: parts[5] }));
const totalLag = lag.filter((entry) => entry.lag !== '-').reduce((sum, entry) => sum + Number(entry.lag), 0);
const assigned = lag.filter((entry) => entry.currentOffset !== '-').length;

const evidence = {
  schema: 'platform.consumer.dedupe.runtime-evidence.v1',
  taskId: 'P1R-M2-005',
  batch: 'E6',
  sourceCommit: spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', windowsHide: true }).stdout.trim(),
  capturedAt: new Date().toISOString(),
  topic: 'platform.iam.v1',
  consumerGroup: GROUP,
  dlqTopic: 'platform.events.dlq.v1',
  observed: {
    deliveriesProduced: 3,
    receiptRows: receipts.length,
    appliedCount: stats.length ? Number(stats[0][2]) : 0,
    receipts: receipts.map(([group, eventId, eventName, state]) => ({ group, eventId, eventName, state })),
    partitionLag: lag,
    partitionsWithCommittedOffsets: assigned,
    totalLag,
  },
  claims: {
    'three-identical-deliveries-produced-exactly-one-receipt': receipts.length === 1,
    'the-effect-was-applied-exactly-once': stats.length === 1 && Number(stats[0][2]) === 1,
    'offsets-were-committed-after-the-effect': assigned > 0 && totalLag === 0,
  },
  harnessDefectsFoundAndFixed: [
    'the container error handler retried a malformed record forever because Spring\'s ExponentialBackOff defaults to an unlimited elapsed budget, parking the record at the head of its partition; the budget is now derived from maxAttempts and the record reaches the DLQ',
    'a record whose envelope cannot be read is now routed straight to the DLQ inside the listener instead of relying on that handler',
    'the probe producer needs parse.key=true as well as parse.headers=true, otherwise the key stays null and the key text lands in the value',
    'PowerShell prepends a UTF-8 BOM when piping a string to a native command, which corrupted the first header name into U+FEFFeventId and made every probe look like it was missing the eventId header; the probe now writes a BOM-free file',
  ],
  notVerifiedHere: [
    'out-of-order delivery was not constructed',
    'the DLQ was exercised at runtime but its operator replay path is still manual',
  ],
  sensitiveMaterial: { persisted: false, emitted: false },
};

const target = path.join(root, 'evidence/p1r/m2/P1R-M2-005');
fs.mkdirSync(target, { recursive: true });
const file = path.join(target, 'consumer-dedupe-runtime-2026-09-13.json');
fs.writeFileSync(file, `${JSON.stringify(evidence, null, 2)}\n`);
console.log(`written: ${path.relative(root, file)}`);
console.log(JSON.stringify(evidence.observed, null, 1).slice(0, 900));
console.log('claims:', JSON.stringify(evidence.claims, null, 1));
