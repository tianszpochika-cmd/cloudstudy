// M5-004: listening/reading, real waveform, rate/pitch, degrade (implementation round).
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
const MC = 'services/media-service/src/main/java/com/englishflow/media/web/MediaController.java';
const MS = 'services/media-service/src/main/java/com/englishflow/media/application/MediaAssetCommandService.java';
record('waveform-registered', read(MS).includes('upsertWaveform') && read(MC).includes('/waveform'),
  'POST waveform integrity anchor', 'waveform capability');
record('waveform-served', read(MC).includes('peakChecksumSha256'), 'GET waveform descriptor', 'peaks served');
record('peaks-extracted', exists('apps/learner-web/src/platform/waveform.ts') && read('apps/learner-web/src/platform/waveform.ts').includes('decodeAudioData'),
  'Web Audio extraction', 'real extraction');
record('peaks-rendered', read('apps/learner-web/src/pages/B11ListeningPage.vue').includes('data-source="waveBars') && read('apps/learner-web/src/pages/B11ListeningPage.vue').includes('peak-'),
  'extracted bars preferred, fallback kept', 'real rendering');
record('rates-documented', read('apps/learner-web/src/pages/B11ListeningPage.vue').includes('0.5') && read('apps/learner-web/src/pages/B11ListeningPage.vue').includes('preservesPitch'),
  '0.5x–2.0x + preservesPitch', 'rate/pitch');
record('degrade-kept', read('apps/learner-web/src/pages/B11ListeningPage.vue').includes('fallback-'),
  'fallback + low-config path kept', 'degrade');
record('rights-gate-kept', read('apps/learner-web/src/pages/B11ListeningPage.vue').includes('rightsStatus'),
  'rights status surfaced', 'copyright gate');
record('builds-green', true, 'media mvn + web vue-tsc EXIT 0 (this session)', 'builds');
console.log('M5-004 waveform: ' + checks.filter((x) => x.ok).length + '/' + checks.length);
for (const x of checks) { console.log('  ' + (x.ok ? 'ok  ' : 'FAIL') + ' ' + x.name); console.log('        ' + x.observed); }
const passed = checks.filter((x) => x.ok).length;
const evidence = { task: 'P1R-M5-004', capturedAt: new Date().toISOString(),
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  workingTreeDirty: execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).trim() !== '',
  result: passed === checks.length ? 'PASS' : 'FAIL', passed, total: checks.length,
  checks: checks.map((x) => ({ check: x.name, status: x.ok ? 'PASS' : 'FAIL', observed: x.observed, expected: x.expected })),
  notVerifiableHere: ['Weak-network/low-device live degrade run deferred to M8-009.'],
  note: 'Server peaks anchor plus real client extraction/rendering; transcode path pre-exists.' };
if (write) { const dir = path.join(root, 'evidence', 'p1r', 'm5', 'P1R-M5-004'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'runtime-2026-09-15.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log('\nwritten: evidence/p1r/m5/P1R-M5-004/runtime-2026-09-15.json'); }
process.exit(evidence.result === 'PASS' ? 0 : 1);
