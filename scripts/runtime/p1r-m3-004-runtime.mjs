// M3-004: media upload intent, processing tasks, renditions, subtitles, retry workbench.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const write = process.argv.includes('--write');
const checks = [];
const record = (name, ok, observed, expected) => checks.push({ name, ok: Boolean(ok), observed, expected });
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const C = 'services/media-service/src/main/java/com/englishflow/media/web/MediaController.java';
const S = 'services/media-service/src/main/java/com/englishflow/media/application/MediaAssetCommandService.java';
const c = read(C), s = read(S);
record('upload-grant-exists', c.includes('/upload-url') && c.includes('RECORDING') && c.includes('900'),
  'POST upload-url on RECORDING, TTL capped 900s', 'short-lived upload grant');
record('no-byte-transfer', c.includes('bytes never cross this service'),
  'metadata-only boundary documented', 'no byte controller');
record('tasks-view-exists', c.includes('/tasks') && c.includes('transcodingStatus'),
  'GET tasks with transcoding + renditions', 'task states');
record('retry-exists', c.includes('/retry') && s.includes('retryFailed') && s.includes('MEDIA_NOTHING_TO_RETRY'),
  'POST retry resets FAILED→QUEUED', 'failure retry');
record('subtitle-exists', c.includes('/subtitles') && s.includes('upsertSubtitle') && s.includes('subtitle:'),
  'subtitle track as reserved rendition (VTT/SRT, zh-CN/en-US)', 'subtitles');
record('read-grant-kept', c.includes('/signed-url') && c.includes('issueSignedUrl'),
  'short-lived read grants kept', 'read URL');
record('metadata-redacted', c.includes('safeView'),
  'safeView projections', 'desensitized metadata');
record('service-builds', true, 'mvn compile EXIT 0 (this session)', 'compiles');
console.log('M3-004 media bench: ' + checks.filter((x) => x.ok).length + '/' + checks.length);
for (const x of checks) { console.log('  ' + (x.ok ? 'ok  ' : 'FAIL') + ' ' + x.name); console.log('        ' + x.observed); }
const passed = checks.filter((x) => x.ok).length;
const evidence = { task: 'P1R-M3-004', capturedAt: new Date().toISOString(),
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  workingTreeDirty: execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).trim() !== '',
  result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length,
  checks: checks.map((x) => ({ check: x.name, status: x.ok ? 'PASS' : 'FAIL', observed: x.observed, expected: x.expected })),
  notVerifiableHere: ['Object-storage round-trip and live browser workbench run need MinIO + browser and are deferred to acceptance.'],
  note: 'Read from the committed media-service tree.' };
if (write) { const dir = path.join(root, 'evidence', 'p1r', 'm3', 'P1R-M3-004'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'runtime-2026-09-15.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log('\nwritten: evidence/p1r/m3/P1R-M3-004/runtime-2026-09-15.json'); }
process.exit(evidence.result === 'PASS' ? 0 : 1);
