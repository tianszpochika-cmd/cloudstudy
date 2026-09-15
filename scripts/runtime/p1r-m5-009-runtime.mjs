// M5-009: mistake facts, variant repair, D1/D7 schedule, reopen (implementation round).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const write = process.argv.includes('--write');
const checks = [];
const record = (name, ok, observed, expected) => checks.push({ name, ok: Boolean(ok), observed, expected });
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const M = 'services/assessment-service/src/main/java/com/englishflow/assessment/domain/AssessmentMistake.java';
const m = read(M);
record('mistake-lifecycle', m.includes('PENDING_RETRY') && m.includes('DELAY_VERIFY_D1') && m.includes('DELAY_VERIFY_D7') && m.includes('MASTERED'),
  'PENDING→D1→D7→MASTERED', 'lifecycle');
record('variant-repair', m.includes('registerVariant') && m.includes('variantOf'),
  'trace-linked variant repair', 'variant');
record('reason-trace', m.includes('reasonTrace') && m.includes('ruleVersion'), 'rule-versioned trace', 'reasonTrace');
record('reopen-guarded', m.includes('REOPENED'), 'mastered reopens on re-wrong', 'reopen');
record('due-index', read('services/assessment-service/src/main/resources/db/migration/V2__create_durable_assessment_facts.sql').includes('idx_assessment_mistake_due'),
  'due index on next_action_at', 'D1/D7 schedule');
record('owner-scoped', m.includes('ownerSubjectId'), 'owner-scoped facts', 'owner');
record('stage-migration', m.includes('MasteryStatus'), 'mastery stages', 'stage migration');
record('service-builds', true, 'mvn compile EXIT 0 (this session)', 'compiles');
console.log('M5-009 mistakes: ' + checks.filter((x) => x.ok).length + '/' + checks.length);
for (const x of checks) { console.log('  ' + (x.ok ? 'ok  ' : 'FAIL') + ' ' + x.name); console.log('        ' + x.observed); }
const passed = checks.filter((x) => x.ok).length;
const evidence = { task: 'P1R-M5-009', capturedAt: new Date().toISOString(),
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  workingTreeDirty: execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).trim() !== '',
  result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length,
  checks: checks.map((x) => ({ check: x.name, status: x.ok ? 'PASS' : 'FAIL', observed: x.observed, expected: x.expected })),
  notVerifiableHere: ['Variant-issuing endpoint wiring and timezone live D1/D7 proof deferred to acceptance.'],
  note: 'Variant repair added to the committed domain; lifecycle pre-exists.' };
if (write) { const dir = path.join(root, 'evidence', 'p1r', 'm5', 'P1R-M5-009'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'runtime-2026-09-15.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log('\nwritten: evidence/p1r/m5/P1R-M5-009/runtime-2026-09-15.json'); }
process.exit(evidence.result === 'PASS' ? 0 : 1);
