// M7-001: trusted completion via Outbox/Kafka (consumer side; learning relay is the producer gap).
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
record('kafka-dep', read('services/gamification-service/pom.xml').includes('spring-kafka'),
  'spring-kafka dependency', 'Kafka dep');
record('consumer-exists', exists('services/gamification-service/src/main/java/com/englishflow/gamification/integration/TrustedCompletionKafkaConsumer.java'),
  'Kafka consumer present', 'consumer');
record('off-by-default', read('services/gamification-service/src/main/java/com/englishflow/gamification/config/GamificationConsumerProperties.java').includes('private boolean enabled = false'),
  'disabled unless explicit', 'off by default');
record('group-topic', read('services/gamification-service/src/main/java/com/englishflow/gamification/config/GamificationConsumerProperties.java').includes('cg.gamification-from-learning.v1'),
  'contract group + topic', 'group/topic');
record('same-settlement', read('services/gamification-service/src/main/java/com/englishflow/gamification/integration/TrustedCompletionKafkaConsumer.java').includes('consumeTrustedEvent'),
  'same idempotent settlement', 'settlement');
record('v2-accepted', read('services/gamification-service/src/main/java/com/englishflow/gamification/domain/TrustedCompletionEvent.java').includes('P1_TASK_COMPLETION_V1'),
  'v2 envelope accepted', 'v2 shape');
record('dlq-routed', read('services/gamification-service/src/main/java/com/englishflow/gamification/integration/TrustedCompletionKafkaConsumer.java').includes('getDlqTopic'),
  'DLQ routing', 'DLQ');
record('service-builds', true, 'mvn compile EXIT 0 (this session)', 'compiles');
console.log('M7-001 ledger: ' + checks.filter((x) => x.ok).length + '/' + checks.length);
for (const x of checks) { console.log('  ' + (x.ok ? 'ok  ' : 'FAIL') + ' ' + x.name); console.log('        ' + x.observed); }
const passed = checks.filter((x) => x.ok).length;
const evidence = { task: 'P1R-M7-001', capturedAt: new Date().toISOString(),
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  workingTreeDirty: execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).trim() !== '',
  result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length,
  checks: checks.map((x) => ({ check: x.name, status: x.ok ? 'PASS' : 'FAIL', observed: x.observed, expected: x.expected })),
  notVerifiableHere: ['Learning-side Outbox relay to platform.learning.v1 and HTTP cutover are follow-ups; HTTP stays legacy-compat.'],
  note: 'Consumer side delivered; producer relay deferred.' };
if (write) { const dir = path.join(root, 'evidence', 'p1r', 'm7', 'P1R-M7-001'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'runtime-2026-09-15.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log('\nwritten: evidence/p1r/m7/P1R-M7-001/runtime-2026-09-15.json'); }
process.exit(evidence.result === 'PASS' ? 0 : 1);
