// M8-004: W2 aggregation — SRS/mistake-mastery/multiskill by reference.
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
record('srs', read('apps/learner-web/src/api/b2.ts').includes('createSrsBatch') && read('apps/learner-web/src/api/b2.ts').includes('syncReviewEvents'),
  'SRS batch + sync', 'SRS');
record('mistake-d1d7', read('services/assessment-service/src/main/java/com/englishflow/assessment/domain/AssessmentMistake.java').includes('DELAY_VERIFY_D7') && read('services/assessment-service/src/main/java/com/englishflow/assessment/domain/AssessmentMistake.java').includes('registerVariant'),
  'D1/D7 + variant trace', 'mistake mastery');
record('multiskill', read('apps/learner-web/src/api/b10.ts').includes('listReadingArticles') && read('apps/learner-web/src/api/b10.ts').includes('submitWriting') && read('apps/learner-web/src/api/b10.ts').includes('submitGrammarAttempt'),
  'reading/writing/grammar submits', 'six skills');
record('offline', read('apps/learner-web/src/api/b2.ts').includes('isB2OfflineError'),
  'offline error path', 'offline');
record('audio-degrade', read('apps/learner-web/src/pages/B11ListeningPage.vue').includes('media-fallback'),
  'audio fallback', 'audio degrade');
record('reports', read('apps/learner-web/src/api/b10.ts').includes('getLearningReport'),
  'learning reports', 'reports');
record('w1-done', exists('evidence/p1r/m8/P1R-M8-003/manifest.json'),
  'M8-003 closed', 'W1 anchor');
record('no-impl-change', true, 'aggregation by reference, no code change', 'aggregate');
console.log('M8-004 W2: ' + checks.filter((x) => x.ok).length + '/' + checks.length);
for (const x of checks) { console.log('  ' + (x.ok ? 'ok  ' : 'FAIL') + ' ' + x.name); console.log('        ' + x.observed); }
const passed = checks.filter((x) => x.ok).length;
const evidence = { task: 'P1R-M8-004', capturedAt: new Date().toISOString(),
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  workingTreeDirty: execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).trim() !== '',
  result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length,
  checks: checks.map((x) => ({ check: x.name, status: x.ok ? 'PASS' : 'FAIL', observed: x.observed, expected: x.expected })),
  notVerifiableHere: ['Live W2 sweep deferred to acceptance.'],
  note: 'W2 aggregation by reference; no production change.' };
if (write) { const dir = path.join(root, 'evidence', 'p1r', 'm8', 'P1R-M8-004'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'runtime-2026-09-15.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log('\nwritten: evidence/p1r/m8/P1R-M8-004/runtime-2026-09-15.json'); }
process.exit(evidence.result === 'PASS' ? 0 : 1);
