'use strict';
// PREPARED_NOT_RUN. H5 visual-matrix runner for the frozen MB006 assessment page.
// It NEVER launches in this DSH session. Root executes it in the separate audit
// environment against the existing 18183 audit service. It writes only under
// <this directory>/runs/<runId>/ and never writes a PASS verdict.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const C = require('./coverage.cjs');
const { collect, applyTextScale } = require('./measure.cjs');

const DIR = path.resolve(__dirname, '..');
const RUNS = path.join(DIR, 'runs');
const ROOT = path.resolve(__dirname, '../../../../../../');
const FIXTURE_PATH = path.resolve(__dirname, '../../20261016-review-prep/fixture.cjs');
const SUPPORTING = ['apps/mobile/package.json', 'pnpm-lock.yaml', 'packages/design-tokens/src/mobile.ts', 'packages/design-tokens/src/official-site.ts'];
const EXPECTED_SUPPORTING = {
  'apps/mobile/package.json': C.EXPECTED_MOBILE_PACKAGE_SHA256,
  'pnpm-lock.yaml': C.EXPECTED_LOCK_SHA256,
  'packages/design-tokens/src/mobile.ts': '5b3aac642d103e998ae723c6af1c72fd3d47c7929a609d47aee1e003ad2281d9',
  'packages/design-tokens/src/official-site.ts': '9d6af42d7ff255154d579729105c46fe15e2e4792ac64a4eab591108a7d03d62',
};
const PREPARED_BY = 'DSH';
const RUN_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

function nowIso() { return new Date().toISOString(); }
function sha256(rel) { return crypto.createHash('sha256').update(fs.readFileSync(path.resolve(ROOT, rel))).digest('hex'); }
function supportingHashes() { return Object.fromEntries(SUPPORTING.map(rel => [rel, sha256(rel)])); }
function supportingMismatches(hashes) {
  return Object.entries(EXPECTED_SUPPORTING)
    .filter(([rel, expected]) => hashes[rel] !== expected)
    .map(([rel, expected]) => ({ file: rel, expected, observed: hashes[rel] || null }));
}
function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const data = JSON.stringify(value, null, 2) + '\n';
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, data);
  try { fs.renameSync(tmp, file); }
  catch { fs.writeFileSync(file, data); fs.rmSync(tmp, { force: true }); }
}
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function fail(message, code = 2) { const e = new Error(message); e.exitCode = code; throw e; }

function parseArgs(argv) {
  const out = { group: 'all', resume: false, planOnly: false, maxCases: Infinity, stopFile: null, caseIds: [] };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    const eq = arg.indexOf('=');
    const key = eq === -1 ? arg : arg.slice(0, eq);
    const inline = eq === -1 ? undefined : arg.slice(eq + 1);
    const next = () => inline !== undefined ? inline : argv[++i];
    switch (key) {
      case '--run-id': out.runId = next(); break;
      case '--label': out.label = next(); break;
      case '--group': out.group = next(); break;
      case '--case-id': {
        out.caseIdSpecified = true;
        const value = String(next() || '');
        for (const part of value.split(',')) {
          const id = part.trim();
          if (id) out.caseIds.push(id);
        }
        break;
      }
      case '--max-cases': out.maxCases = Number(next()); break;
      case '--stop-file': out.stopFile = next(); break;
      case '--resume': out.resume = true; break;
      case '--plan-only': out.planOnly = true; break;
      case '--help': out.help = true; break;
      default: fail(`Unknown argument: ${arg}`, 2);
    }
  }
  out.caseIds = [...new Set(out.caseIds)];
  return out;
}

const HELP = `MB006 H5 visual matrix (PREPARED_NOT_RUN)

Usage:
  node matrix.cjs --run-id <safe-id> --label <root-label> [--group all|compact|wide|theme]
                  [--case-id <exact-plan-id>]... [--max-cases N] [--stop-file <path>] [--resume]

  node matrix.cjs --plan-only [--case-id <exact-plan-id>]...

  --case-id may repeat or be comma-separated; it must exactly match a plan id and
  takes precedence over --group. Unknown ids are refused before any browser work.
  --plan-only honors the same selection; no browser, no writes.

Hard requirements:
  * 18183 must already be the Root audit service (session 93491 / PID 40996); this script never starts it.
  * --run-id is a single safe path segment; an existing run directory is refused unless --resume.
  * --label records the Root execution label; preparedBy is always DSH.
  * Source hashes are frozen before launch and re-checked before/after every case.

Exit codes: 0 all selected cases MEASURED (all checks ok); 1 any fail/review/incomplete;
            2 refused precondition/source drift; 3 browser launch failure; 130 stopped by signal.
`;

function selectedPlan(args = {}) {
  const group = args.group || 'all';
  if (!['all', 'compact', 'wide', 'theme'].includes(group)) fail(`Unknown --group: ${group}`, 2);
  if (args.caseIdSpecified && (!args.caseIds || args.caseIds.length === 0)) fail('--case-id was given but resolved to no ids; refusing to fall back to a group run.', 2);
  const ids = [...new Set(args.caseIds || [])];
  const unknown = ids.filter(id => !C.PLAN.some(c => c.id === id));
  if (unknown.length) fail(`Unknown --case-id (must exactly match a plan id): ${unknown.join(', ')}`, 2);
  if (ids.length) return C.PLAN.filter(c => ids.includes(c.id));
  return C.PLAN.filter(c => group === 'all' || c.groups.includes(group));
}

function planOnly(args = {}) {
  if (args.group && !['all', 'compact', 'wide', 'theme'].includes(args.group)) fail(`Unknown --group: ${args.group}`, 2);
  const base = selectedPlan({ ...args, group: args.caseIds && args.caseIds.length ? 'all' : args.group });
  const groups = {};
  for (const g of ['compact', 'wide', 'theme', 'all']) {
    const selected = base.filter(c => g === 'all' || c.groups.includes(g));
    groups[g] = { contexts: selected.length, screenshots: C.plannedScreenshots(selected), ids: selected.map(c => c.id) };
  }
  process.stdout.write(JSON.stringify({
    status: 'PREPARED_NOT_RUN',
    preparedBy: PREPARED_BY,
    base: C.BASE,
    baseContexts: C.LOCALES.length * C.THEMES.length * C.WIDTHS.length,
    selection: { requestedCaseIds: args.caseIds || [], matched: base.map(c => c.id), group: args.caseIds && args.caseIds.length ? null : (args.group || 'all') },
    extraContexts: base.filter(c => c.extra).map(c => ({ id: c.id, extra: c.extra, selectionProbe: c.selectionProbe || null })),
    contexts: base.length,
    states: C.STATE_ORDER,
    baseScreenshotsPerContext: C.STATE_ORDER.length + 1,
    screenshotExtraRules: ['320-wide: +01a guide fullPage +02b question fullPage', 'text200: +05b retest confirmation fullPage', 'selected-C probe: +02c', 'system live-switch: +01b guide dark'],
    totalScreenshots: C.plannedScreenshots(base),
    groups,
    systemNamed: { darkFollow: 'zh-CN__system__390 (colorScheme dark)', liveSwitch: C.SYSTEM_SWITCH_CONTEXT },
    expectedPageSha256: C.EXPECTED_PAGE_SHA256,
    expectedI18nSha256: C.EXPECTED_I18N_SHA256,
    expectedSupportingSha256: EXPECTED_SUPPORTING,
  }, null, 2) + '\n');
  return 0;
}

function statusRank(s) { return { ok: 0, info: 0, review: 1, 'not-measured': 2, fail: 3 }[s] ?? 3; }
function check(id, status, detail) { return { id, status, detail }; }
function aggregate(checks) {
  const worst = checks.reduce((acc, c) => Math.max(acc, statusRank(c.status)), 0);
  return ['MEASURED', 'REVIEW', 'INCOMPLETE', 'FAILED'][worst];
}

function textScaleChecks(result) {
  if (!result) return [check('text-scale-harness', 'fail', { error: 'no harness result' })];
  const harness = check('text-scale-harness', result.ok === true ? 'ok' : 'fail', {
    requestedPercent: result.requestedPercent,
    effectiveFactor: result.effectiveFactor,
    applied: result.applied,
    before: result.before,
    after: result.after,
    strategy: result.strategy,
    error: result.error || null,
    accepted: result.accepted || null,
  });
  if (result.ok !== true) return [harness];
  const samples = result.samples || [];
  const bad = samples.filter(item => Math.abs(item.after - item.baseline * result.effectiveFactor) > 0.6);
  const h1 = samples.find(item => item.label === 'h1_28');
  const option = samples.find(item => item.label === 'option_16');
  const note = samples.find(item => item.label === 'note_14');
  const h1ok = Boolean(h1 && Math.abs(h1.baseline - 28) <= 0.6 && Math.abs(h1.after - 56) <= 0.6);
  const optionok = !option || (Math.abs(option.baseline - 16) <= 0.6 && Math.abs(option.after - 32) <= 0.6);
  const noteok = !note || (Math.abs(note.baseline - 14) <= 0.6 && Math.abs(note.after - 28) <= 0.6);
  return [
    harness,
    check('text-scale-sanity', bad.length === 0 && h1ok && optionok && noteok ? 'ok' : 'fail', {
      samples, bad, h1ok, optionok, noteok,
      expectations: { h1_28: '28 -> 56', option_16: '16 -> 32', note_14: '14 -> 28' },
    }),
  ];
}

function paletteCheck(raw, resolved) {
  const expected = C.PALETTE[resolved];
  if (!raw || !raw.palette) return check('theme-palette', 'not-measured', 'palette not collected');
  const mismatches = [];
  for (const [name, rgb] of Object.entries(expected)) {
    const actual = raw.palette[name];
    if (!actual || !actual.rgb) { mismatches.push({ name, expected: rgb, actual: null }); continue; }
    if (actual.rgb.length < 3 || actual.rgb[0] !== rgb[0] || actual.rgb[1] !== rgb[1] || actual.rgb[2] !== rgb[2]) {
      mismatches.push({ name, expected: rgb, actual: actual.rgb, raw: actual.raw });
    }
  }
  return check('theme-palette', mismatches.length ? 'fail' : 'ok', { resolved, mismatches });
}

function stateChecks(raw, cfg, state, opts = {}) {
  const checks = [];
  const resolved = opts.resolved || C.expectedResolved(cfg.theme, cfg.colorScheme);
  const copy = C.COPY[cfg.locale];
  const expectedTitle = opts.expectedTitle || C.TITLES[state][cfg.locale];

  checks.push(check('collector', raw && !raw.fatal && Array.isArray(raw.errors) && raw.errors.length === 0 ? 'ok' : 'fail', { fatal: raw && raw.fatal, errors: raw && raw.errors }));

  checks.push(check('route', raw.url && raw.url.origin === C.BASE && String(raw.url.hash).startsWith('#/pages/assessment/assessment') ? 'ok' : 'fail', raw.url));
  checks.push(check('dev-overlay', raw.overlay === false ? 'ok' : 'fail', { overlay: raw.overlay }));
  checks.push(check('locale', raw.document && raw.document.htmlLang === cfg.locale ? 'ok' : 'fail', { actual: raw.document && raw.document.htmlLang, expected: cfg.locale, datasetUiLocale: raw.document && raw.document.datasetUiLocale }));
  checks.push(check('resolved-theme', raw.document && raw.document.datasetTheme === resolved ? 'ok' : 'fail', { actual: raw.document && raw.document.datasetTheme, expected: resolved, requested: cfg.theme, colorScheme: cfg.colorScheme }));
  checks.push(paletteCheck(raw, resolved));

  const h1 = raw.h1;
  const h1Min = cfg.textScale === 200 ? 55 : 27.5;
  checks.push(check('h1', h1 && h1.text === expectedTitle && h1.visible && h1.rect.width > 0 && h1.rect.height > 0 && h1.fontSize >= h1Min && h1.role === 'heading' && h1.ariaLevel === '1' ? 'ok' : 'fail', h1));

  const expectedIds = C.CONTROL_IDS[state];
  if (raw.controls) {
    const exact = raw.controls.count === expectedIds.length && raw.controls.missing.length === 0 && raw.controls.extra.length === 0 && raw.controls.host === 'uni-button';
    checks.push(check('controls-exact', exact ? 'ok' : 'fail', { host: raw.controls.host, count: raw.controls.count, expected: expectedIds.length, missing: raw.controls.missing, extra: raw.controls.extra, plainButtonCount: raw.controls.plainButtonCount }));
    const bad = [];
    for (const c of raw.controls.list) {
      const isPrimary = /assessment-primary/.test(c.classes);
      const minH = isPrimary ? 48 : 44;
      if (c.rect.width < 44 || c.rect.height < minH) bad.push({ id: c.id, width: c.rect.width, height: c.rect.height, minHeight: minH, primary: isPrimary });
    }
    checks.push(check('controls-target-size', raw.controls.list.length > 0 && bad.length === 0 ? 'ok' : 'fail', { violations: bad }));
    const copyBad = [];
    const byId = Object.fromEntries(raw.controls.list.map(c => [c.id, c]));
    if (state === 'guide' && byId['assessment-start'] && byId['assessment-start'].text !== copy.start) copyBad.push({ id: 'assessment-start', actual: byId['assessment-start'].text, expected: copy.start });
    if (state === 'question' && byId['assessment-submit'] && byId['assessment-submit'].text !== copy.submit) copyBad.push({ id: 'assessment-submit', actual: byId['assessment-submit'].text, expected: copy.submit });
    const copyApplicable = state === 'guide' || state === 'question';
    if (copyApplicable) checks.push(check('copy-locale', copyBad.length === 0 ? 'ok' : 'fail', copyBad));
  } else {
    checks.push(check('controls-exact', 'not-measured', 'uni-button hosts missing'));
    checks.push(check('controls-target-size', 'not-measured', 'uni-button hosts missing'));
    checks.push(check('copy-locale', 'not-measured', 'uni-button hosts missing'));
  }

  const optionBad = state === 'question' && raw.options
    ? raw.options.list.filter(o => o.fontSize < 15.8 || o.rect.height < 44 || !o.text)
    : [];
  if (state === 'question') {
    checks.push(check('option-typography', raw.options && raw.options.count === 4 && raw.options.list.length === 4 && optionBad.length === 0 ? 'ok' : 'fail', { count: raw.options && raw.options.count, violations: optionBad }));
  }

  const sizeBad = (raw.typography ? raw.typography.sizeViolations : []).filter(v => !v.disabled);
  checks.push(check('body-typography', raw.typography && raw.typography.sampleCount >= 5 && sizeBad.length === 0 ? 'ok' : 'fail', { sampleCount: raw.typography && raw.typography.sampleCount, violations: sizeBad }));

  checks.push(check('horizontal-overflow', raw.overflow && !raw.overflow.documentHorizontal && raw.overflow.elements.length === 0 ? 'ok' : 'fail', raw.overflow));
  checks.push(check('clipping', raw.clipping && raw.clipping.length === 0 ? 'ok' : 'fail', raw.clipping));
  checks.push(check('glyph-overflow', raw.textOverflow && raw.textOverflow.length > 0 ? 'info' : 'ok', raw.textOverflow || []));
  // Ink extent leaving a line box is informational; real clipping is measured
  // separately by `clipping` and real occlusion by `overlap`.
  checks.push(check('text-outside-box', raw.textOutside && raw.textOutside.length > 0 ? 'info' : 'ok', raw.textOutside || []));
  if (raw.offscreen && raw.offscreen.length > 0) {
    checks.push(check('viewport-offscreen', 'info', raw.offscreen));
  }
  checks.push(check('overlap', raw.overlaps && raw.overlaps.length === 0 ? 'ok' : 'fail', raw.overlaps));
  checks.push(check('word-split', raw.wordSplits && raw.wordSplits.length === 0 ? 'ok' : 'fail', raw.wordSplits));

  const contrast = raw.contrast || {};
  const textViolations = (contrast.textViolations || []).filter(v => !v.disabled);
  checks.push(check('contrast-text', contrast.textMeasured >= 5 && textViolations.length === 0 ? 'ok' : (contrast.textMeasured >= 5 ? 'fail' : 'not-measured'), { measured: contrast.textMeasured, violations: textViolations, minRatio: raw.typography && raw.typography.minRatio }));
  checks.push(check('contrast-border', (contrast.borderSamples || []).length > 0 && (contrast.borderViolations || []).length === 0 ? 'ok' : 'fail', { measured: (contrast.borderSamples || []).length, violations: contrast.borderViolations || [] }));

  if (state === 'question') {
    const s = raw.selected;
    checks.push(check('selected-noncolor', s && s.ariaPressed === 'true' && s.classSelected && s.label === copy.selected && s.iconCount > 0 ? 'ok' : 'fail', s));
    const p = raw.progress;
    checks.push(check('progress-from-accepted', p && p.ariaMin === '0' && p.ariaMax === '10' && p.ariaNow === 0 && p.fillWidth !== null && Math.abs(p.fillWidth) <= 1 ? 'ok' : 'fail', p));
  }
  if (state === 'report' || state === 'retest-confirm' || state === 'retest-cancelled') {
    const fb = raw.feedback;
    checks.push(check('status-copy', !fb ? 'review' : (fb.text && fb.role === 'status' ? 'ok' : 'fail'), fb));
    checks.push(check('complete-signal', raw.complete && raw.complete.text && raw.complete.iconCount > 0 ? 'ok' : 'fail', raw.complete));
  }
  if (state === 'retest-confirm') {
    const conf = raw.confirmation || {};
    const ok = raw.report && raw.report.retestDialog && conf.role === 'alertdialog' && conf.title === copy.retestTitle && conf.confirm === copy.retestConfirm;
    checks.push(check('retest-dialog', ok ? 'ok' : 'fail', { dialog: raw.report && raw.report.retestDialog, confirmation: conf }));
  }
  checks.push(check('inputs', raw.inputs && raw.inputs.count === 0 ? 'ok' : 'fail', raw.inputs));

  if (cfg.width >= 600) {
    checks.push(check('content-column', raw.shell && raw.shell.width <= 560.5 && raw.shell.centeredDelta <= 1.5 ? 'ok' : 'fail', raw.shell));
  }
  return checks;
}

function safeUrl(raw) {
  try {
    const url = new URL(String(raw));
    return `${url.origin}${url.pathname}`;
  } catch {
    return String(raw || '').split('?')[0].split('#')[0];
  }
}

function urlParts(raw) {
  try {
    const url = new URL(String(raw));
    return { origin: url.origin, path: url.pathname };
  } catch {
    return { origin: null, path: safeUrl(raw) };
  }
}

// The shared fixture records every synthetic API request it fulfils in
// report.requests as {id, locale, theme, origin, method, path}. A non-18183
// response is fixture transport only when it matches that ledger exactly; a
// different origin/path/method for the same case is not a match.
function ledgerMatch(fixture, caseId, method, rawUrl) {
  const { origin, path } = urlParts(rawUrl);
  return (fixture.report.requests || []).some(entry => entry.id === caseId && entry.method === method && entry.origin === origin && entry.path === path);
}

function sanitizeMessage(message) {
  return String(message || '').replace(/https?:\/\/[^\s"'<>]+/g, match => safeUrl(match));
}

function flowChecks(caseResult, item, fixture, cfg) {
  const checks = [];
  const counts = { ...item.state.counts };
  checks.push(check('flow-start', counts.start === 1 ? 'ok' : 'fail', { start: counts.start }));
  checks.push(check('flow-ten-submits', counts.respond === 10 ? 'ok' : 'fail', { respond: counts.respond, submitLog: caseResult.submitLog }));
  checks.push(check('retest-zero-write', caseResult.retest.afterDialog === 0 && caseResult.retest.afterCancel === 0 ? 'ok' : 'fail', caseResult.retest));
  const fact = caseResult.reportFacts || {};
  const expectedScore = cfg.locale === 'zh-CN' ? '70 分' : '70 points';
  const count = fact.count;
  const countOk = count && count.visible === true && Boolean(count.text) && count.matched === true && count.parsed && count.parsed.full === 7 && count.parsed.total === 10;
  const factsOk = fact.level === 'A2' && fact.score === expectedScore && countOk && fact.renderedAfterTenSubmits !== false;
  checks.push(check('report-from-real-submits', factsOk ? 'ok' : 'fail', { counts: { respond: counts.respond }, fact }));
  const unknown = (fixture.report.unexpected || []).filter(u => u.id === item.state.id);
  checks.push(check('unknown-api-501', unknown.length === 0 ? 'ok' : 'fail', unknown));
  const fulfilled = caseResult.fixtureFulfilledResponses || [];
  const unclassified = caseResult.unclassifiedApiResponses || [];
  const ledgerFailures = caseResult.fixtureLedgerFailures || [];
  const externalResponses = caseResult.externalResources || [];
  const externalAttempts = caseResult.externalAttempts || [];
  checks.push(check('fixture-transport', unclassified.length === 0 && ledgerFailures.length === 0 ? 'ok' : 'fail', {
    reason: 'API responses are transport only when matched to fixture.report.requests by case id+method+origin+path',
    ledgerEntries: (caseResult.fixtureLedger || []).length,
    fixtureFulfilled: fulfilled.length,
    unclassified,
    ledgerFailures,
    localResourceFailures: caseResult.localResourceFailures || [],
  }));
  checks.push(check('external-network', externalResponses.length === 0 && externalAttempts.length === 0 ? 'ok' : 'fail', { externalResponses, externalAttempts }));
  const pageErrors = (fixture.report.pageErrors || []).filter(e => e.id === item.state.id).map(e => ({ ...e, message: sanitizeMessage(e.message) }));
  checks.push(check('page-errors', pageErrors.length === 0 ? 'ok' : 'fail', pageErrors));
  const consoleErrors = (fixture.report.consoleErrors || []).filter(e => e.id === item.state.id).map(e => ({ ...e, message: sanitizeMessage(e.message) }));
  checks.push(check('console-errors', consoleErrors.length === 0 ? 'ok' : 'review', consoleErrors));
  const freeze = caseResult.freezeCheck || { ok: false, detail: 'freeze check missing' };
  checks.push(check('source-freeze', freeze.ok ? 'ok' : 'fail', freeze.detail));
  return checks;
}


async function main() {
  const args = parseArgs(process.argv);
  if (args.help) { process.stdout.write(HELP); return 0; }
  if (args.planOnly) return planOnly(args);

  if (!args.runId || !RUN_ID_RE.test(args.runId)) fail('Missing/invalid --run-id (single safe path segment, e.g. r1-20261020-am).');
  if (/[. ]$/.test(args.runId) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(args.runId)) fail('Refusing reserved/trailing-dot --run-id on this filesystem.');
  if (!args.label || !args.label.trim()) fail('Missing --label: Root must set the execution label; this runner is preparedByDSH.');
  if (!['all', 'compact', 'wide', 'theme'].includes(args.group)) fail(`Unknown --group: ${args.group}`);
  if (!Number.isFinite(args.maxCases) || args.maxCases < 1) args.maxCases = Infinity;
  if (!C.BASE.endsWith(':18183')) fail(`Fixed port violated: ${C.BASE}`);

  const selected = selectedPlan(args);
  if (selected.length === 0) fail('Selection resolved to zero contexts; refusing an empty run.');
  const runDir = path.join(RUNS, args.runId);
  if (fs.existsSync(runDir) && !args.resume) fail(`Run directory already exists, refusing to overwrite: ${runDir}`);
  if (args.resume && fs.existsSync(runDir) && !fs.existsSync(path.join(runDir, 'manifest.json'))) fail('Refusing --resume: existing run directory has no manifest.json to verify.');

  // Freeze BEFORE any browser launch. Read-only file hashing.
  const pageHash = sha256(C.PAGE), i18nHash = sha256(C.I18N);
  if (pageHash !== C.EXPECTED_PAGE_SHA256) fail(`Frozen page hash mismatch: observed ${pageHash}, expected ${C.EXPECTED_PAGE_SHA256}. Product source changed outside this matrix task; Root must review and explicitly re-freeze before running.`);
  if (i18nHash !== C.EXPECTED_I18N_SHA256) fail(`Frozen i18n hash mismatch: observed ${i18nHash}, expected ${C.EXPECTED_I18N_SHA256}. Product source changed outside this matrix task; Root must review and explicitly re-freeze before running.`);
  const support = supportingHashes();
  const supportBad = supportingMismatches(support);
  if (supportBad.length) fail(`Frozen supporting hash mismatch; refusing before run: ${JSON.stringify(supportBad)}`);

  let fixture = null;
  let prior = null;
  if (args.resume && fs.existsSync(path.join(runDir, 'manifest.json'))) {
    prior = readJson(path.join(runDir, 'manifest.json'));
    if (prior.executionLabel !== args.label) fail(`Resume label mismatch: ${prior.executionLabel} != ${args.label}`);
    if (!args.caseIds.length && prior.group !== args.group) fail(`Resume group mismatch: ${prior.group} != ${args.group}`);
    if (args.caseIds.length && Array.isArray(prior.caseIds) && prior.caseIds.join(',') !== args.caseIds.join(',')) fail('Resume --case-id selection differs from the original manifest');
    if (JSON.stringify(prior.supportingSha256) !== JSON.stringify(support)) fail('Resume supporting-source hash mismatch');
    if (prior.pageSha256 !== pageHash || prior.i18nSha256 !== i18nHash) fail('Resume frozen product hash mismatch');
  }

  fs.mkdirSync(runDir, { recursive: true });
  const existingFreezeFile = path.join(runDir, 'source-freeze.json');
  const existingFreeze = prior && fs.existsSync(existingFreezeFile) ? readJson(existingFreezeFile) : null;
  const sourceFreeze = {
    frozenAt: existingFreeze ? existingFreeze.frozenAt : nowIso(),
    base: C.BASE,
    product: { 'page': { path: C.PAGE, sha256: pageHash, expected: C.EXPECTED_PAGE_SHA256, match: true }, 'i18n': { path: C.I18N, sha256: i18nHash, expected: C.EXPECTED_I18N_SHA256, match: true } },
    supporting: { hashes: support, expected: EXPECTED_SUPPORTING, mismatches: supportingMismatches(support) },
    measuredBy: 'dsh visual matrix runner; no PASS verdict written',
  };
  writeJson(existingFreezeFile, sourceFreeze);
  writeJson(path.join(runDir, 'plan.json'), {
    runId: args.runId, group: args.caseIds.length ? 'case-id' : args.group, caseIds: args.caseIds,
    states: C.STATE_ORDER, shots: C.SHOTS, reportFull: C.REPORT_FULL, selectionProbeShot: C.SELECTION_PROBE_SHOT,
    contexts: selected.map((c, i) => ({ index: i + 1, ...c, controlIds: Object.fromEntries(C.STATE_ORDER.map(s => [s, C.CONTROL_IDS[s]])) })),
    screenshotsPlanned: C.plannedScreenshots(selected),
  });

  const manifest = {
    runId: args.runId, preparedBy: PREPARED_BY, executionLabel: args.label, group: args.caseIds.length ? 'case-id' : args.group,
    caseIds: args.caseIds,
    startedAt: prior ? prior.startedAt : nowIso(), updatedAt: nowIso(), renderer: 'H5 uni-app in Playwright Chromium with fully synthetic API transport; NOT native/device',
    base: C.BASE, pageSha256: pageHash, i18nSha256: i18nHash, supportingSha256: support,
    expectedPageSha256: C.EXPECTED_PAGE_SHA256, expectedI18nSha256: C.EXPECTED_I18N_SHA256, expectedSupportingSha256: EXPECTED_SUPPORTING,
    node: process.version, playwrightVersion: (() => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'node_modules/playwright/package.json'), 'utf8')).version; } catch { return null; } })(),
    browserVersion: null, plannedContexts: selected.length, plannedScreenshots: C.plannedScreenshots(selected),
    policy: 'Synthetic API only; unknown API=501; non-API resources only 18183; no cookies/storage/body/header/token reads; no store/identity injection; no PASS prefill.',
  };
  writeJson(path.join(runDir, 'manifest.json'), manifest);

  fixture = require(FIXTURE_PATH);
  if (!fixture.BASE.endsWith(':18183')) fail('Fixture base is not the fixed 18183 port');
  const fixtureHashes = fixture.hashes();
  if (fixtureHashes[C.PAGE] !== pageHash || fixtureHashes[C.I18N] !== i18nHash) fail('Fixture hash view disagrees with frozen product');
  fixture.freeze();
  if (!prior) writeJson(path.join(runDir, 'source-freeze-fixture.json'), { sources: fixture.sources, hashes: fixtureHashes });

  const results = prior && fs.existsSync(path.join(runDir, 'results.json'))
    ? readJson(path.join(runDir, 'results.json'))
    : { runId: args.runId, label: args.label, preparedBy: PREPARED_BY, renderer: manifest.renderer, createdAt: nowIso(), updatedAt: nowIso(), cases: {}, summary: { measured: 0, review: 0, incomplete: 0, failed: 0, error: 0, screenshots: 0 } };
  const done = new Set(Object.keys(results.cases).filter(id => results.cases[id] && results.cases[id].resultFile));
  const checkpointFile = path.join(runDir, 'checkpoint.json');
  const checkpoint = {
    runId: args.runId, label: args.label, preparedBy: PREPARED_BY, status: 'RUNNING',
    group: manifest.group, caseIds: args.caseIds,
    startedAt: manifest.startedAt, updatedAt: nowIso(), completed: [...done], pending: selected.map(c => c.id).filter(id => !done.has(id)),
    lastCaseId: null, screenshots: results.summary.screenshots, plannedScreenshots: C.plannedScreenshots(selected),
    note: 'Resume skips any case with a written result; re-test a failed case with a NEW --run-id.',
  };
  writeJson(checkpointFile, checkpoint);

  let stopRequested = false;
  const onSignal = () => { stopRequested = true; };
  process.on('SIGINT', onSignal);
  process.on('SIGTERM', onSignal);

  let browser = null;
  let measured = 0, failures = 0, incomplete = 0, reviewed = 0, errors = 0, stopped = false, driftAbort = false;
  try {
    try {
      browser = await fixture.init();
      manifest.browserVersion = browser.version();
      writeJson(path.join(runDir, 'manifest.json'), manifest);
    } catch (error) {
      const message = String(error && error.message || error);
      if (/Frozen candidate sources changed/.test(message)) {
        checkpoint.status = 'SOURCE_DRIFT'; checkpoint.stopReason = 'source-drift'; checkpoint.updatedAt = nowIso();
        writeJson(checkpointFile, checkpoint);
        process.stderr.write(`Source drift before launch: ${message}\n`);
        return 2;
      }
      checkpoint.status = 'LAUNCH_FAILED'; checkpoint.launchError = message; checkpoint.updatedAt = nowIso();
      writeJson(checkpointFile, checkpoint);
      process.stderr.write(`Browser launch failed (EPERM in DSH is expected; run only in the Root audit environment): ${checkpoint.launchError}\n`);
      return 3;
    }

    for (const cfg of selected) {
      if (stopRequested) break;
      if (args.stopFile && fs.existsSync(args.stopFile)) { checkpoint.stopReason = 'stop-file'; break; }
      if (done.has(cfg.id)) continue;
      if (measured + failures + incomplete + reviewed + errors >= args.maxCases) { checkpoint.stopReason = 'max-cases'; break; }

      const caseDir = path.join(runDir, 'cases', cfg.id);
      fs.mkdirSync(caseDir, { recursive: true });
      const startedAt = nowIso();
      const caseResult = {
        caseId: cfg.id, config: cfg, status: 'RUNNING', startedAt, finishedAt: null,
        preparedBy: PREPARED_BY, executionLabel: args.label, sourceFrozenAt: sourceFreeze.frozenAt,
        pageSha256: pageHash, i18nSha256: i18nHash, supportingSha256: support,
        states: {}, screenshots: [], checks: [], submitLog: [], retest: {}, reportFacts: null,
        externalResources: [], externalAttempts: [], fixtureFulfilledResponses: [], unclassifiedApiResponses: [], fixtureLedgerFailures: [], fixtureLedger: [], localResourceFailures: [],
        textScaleRuns: [], textScale: null, harnessInvalid: false,
        errors: [],
      };
      let item = null;
      const shots = caseResult.screenshots;
      const caseChecks = caseResult.checks;
      const stopGuard = () => {
        if (!stopRequested) return;
        const error = new Error('STOP_REQUESTED');
        error.stopped = true;
        throw error;
      };

      const pageShot = async (name, fullPage = false) => {
        const file = path.join(caseDir, name);
        await item.page.screenshot({ path: file, fullPage, animations: 'disabled', caret: 'hide' });
        shots.push({ file: path.relative(runDir, file).replace(/\\/g, '/'), fullPage });
      };
      const snapshot = async (state, opts = {}) => {
        const checkState = opts.checkState || state;
        const storageKey = opts.storageKey || state;
        if (cfg.textScale) {
          const scaleResult = await item.page.evaluate(applyTextScale, cfg.textScale);
          caseResult.textScaleRuns.push({ ...scaleResult, state: storageKey, at: nowIso() });
          caseResult.textScale = scaleResult;
          const scaleChecks = textScaleChecks(scaleResult);
          scaleChecks.forEach(c => caseChecks.push({ ...c, state: storageKey }));
          if (scaleResult.ok !== true || scaleChecks.some(c => c.status === 'fail')) {
            const error = new Error('TEXT_SCALE_HARNESS_INVALID');
            error.harnessInvalid = true;
            throw error;
          }
        }
        // "First screen" for normal states; the retest confirmation and the
        // selected-C probe must keep their target visible.
        if (checkState === 'retest-confirm') await item.page.locator('#assessment-retest-confirmation').scrollIntoViewIfNeeded();
        else if (opts.scrollTarget) await item.page.locator(opts.scrollTarget).scrollIntoViewIfNeeded();
        else await item.page.evaluate(() => window.scrollTo(0, 0));
        await item.page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        try { await item.page.evaluate(() => (document.fonts && document.fonts.ready) || true); } catch { /* fonts API absent */ }
        const raw = await item.page.evaluate(collect, {
          state: checkState, locale: cfg.locale, theme: opts.resolved || C.expectedResolved(cfg.theme, cfg.colorScheme),
          width: cfg.width, height: cfg.height, textScale: cfg.textScale || null,
          expectedTitle: opts.expectedTitle || C.TITLES[checkState][cfg.locale],
          expectedControlIds: C.CONTROL_IDS[checkState],
        });
        const checks = stateChecks(raw, cfg, checkState, opts);
        caseResult.states[storageKey] = { raw, checks };
        checks.forEach(c => caseChecks.push({ ...c, state: storageKey }));
        writeJson(path.join(caseDir, 'result.json'), caseResult);
        return { raw, checks };
      };
      const failShot = async label => {
        if (!item || !item.page) return;
        try { await item.page.screenshot({ path: path.join(caseDir, `FAILED-${label}.png`), fullPage: false }); } catch { /* page may be gone */ }
      };

      try {
        stopGuard();
        item = await fixture.fresh({
          locale: cfg.locale, theme: cfg.theme, width: cfg.width, height: cfg.height,
          colorScheme: cfg.colorScheme, readySelector: '#assessment-page',
        });
        item.page.setDefaultTimeout(20000);
        item.page.setDefaultNavigationTimeout(30000);
        stopGuard();
        item.page.on('response', response => {
          const raw = response.url();
          if (raw.startsWith('data:') || raw.startsWith('blob:') || raw.startsWith('about:')) return;
          const { origin, path } = urlParts(raw);
          const method = response.request().method();
          const status = response.status();
          const isApi = path.startsWith('/api/v1/');
          if (isApi && ledgerMatch(fixture, item.state.id, method, raw)) {
            // Expected synthetic transport: the fixture fulfilled this exact
            // case+method+origin+path, whether the app used 18183 or its logical
            // gateway/IAM origin (e.g. 18070/18087). Kept with an explicit reason.
            caseResult.fixtureFulfilledResponses.push({
              method, origin, path, status,
              reason: 'fixture.report.requests ledger match for this case id (strict synthetic API transport; not an external network response)',
            });
            return;
          }
          if (isApi) {
            caseResult.unclassifiedApiResponses.push({ method, origin, path, status, reason: 'no matching fixture report.requests entry for this case id' });
            return;
          }
          if (origin === C.BASE) return;
          caseResult.externalResources.push({ method, origin, path, status, reason: 'non-API response outside the 18183 document origin' });
        });
        item.page.on('requestfailed', request => {
          const raw = request.url();
          if (raw.startsWith('data:') || raw.startsWith('blob:') || raw.startsWith('about:')) return;
          const { origin, path } = urlParts(raw);
          const method = request.method();
          const error = request.failure() ? request.failure().errorText : null;
          const isApi = path.startsWith('/api/v1/');
          if (isApi && ledgerMatch(fixture, item.state.id, method, raw)) {
            caseResult.fixtureLedgerFailures.push({ method, origin, path, error, reason: 'fixture ledger matched but the request failed' });
            return;
          }
          if (isApi) {
            caseResult.unclassifiedApiResponses.push({ method, origin, path, status: null, error, reason: 'unmatched API request failed' });
            return;
          }
          if (origin === C.BASE) {
            caseResult.localResourceFailures.push({ method, origin, path, error, reason: '18183 local resource failed (not external network)' });
            return;
          }
          caseResult.externalAttempts.push({ method, origin, path, error, reason: 'unmatched non-18183 network attempt' });
        });
        const originalFreshHashes = fixture.hashes();
        caseResult.sourceFreezeBefore = originalFreshHashes;

        await item.page.locator('#assessment-page').waitFor({ state: 'visible' });
        await item.page.locator('#assessment-guide').waitFor({ state: 'visible' });
        await item.page.waitForFunction(() => document.getElementById('assessment-page')?.getAttribute('aria-busy') === 'false');

        await snapshot('guide');
        await pageShot(C.SHOTS.guide);
        if (cfg.width === 320) await pageShot('01a-guide-fullpage.png', true);

        if (cfg.systemLiveSwitch) {
          const light = await item.page.evaluate(collect, {
            state: 'guide', locale: cfg.locale, theme: 'light', width: cfg.width, height: cfg.height,
            textScale: null, expectedTitle: C.TITLES.guide[cfg.locale], expectedControlIds: C.CONTROL_IDS.guide,
          });
          await item.page.emulateMedia({ colorScheme: 'dark' });
          const darkOk = await item.page.waitForFunction(() => document.documentElement.dataset.theme === 'dark', null, { timeout: 8000 }).then(() => true).catch(() => false);
          await item.page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
          const dark = await item.page.evaluate(collect, {
            state: 'guide', locale: cfg.locale, theme: 'system', width: cfg.width, height: cfg.height,
            textScale: null, expectedTitle: C.TITLES.guide[cfg.locale], expectedControlIds: C.CONTROL_IDS.guide,
          });
          const darkChecks = [
            check('system-follow-dark', darkOk && dark.document.datasetTheme === 'dark' ? 'ok' : 'fail', { resolved: dark.document.datasetTheme }),
            paletteCheck(dark, 'dark'),
            check('system-follow-light-before', light.document.datasetTheme === 'light' ? 'ok' : 'fail', { resolved: light.document.datasetTheme }),
          ];
          caseResult.states['guide-system-switch'] = { light: { theme: light.document, palette: light.palette }, dark: { theme: dark.document, palette: dark.palette }, checks: darkChecks };
          darkChecks.forEach(c => caseChecks.push({ ...c, state: 'guide-system-switch' }));
          await pageShot(C.SYSTEM_SWITCH_SHOT);
          await item.page.emulateMedia({ colorScheme: 'light' });
          const backOk = await item.page.waitForFunction(() => document.documentElement.dataset.theme === 'light', null, { timeout: 8000 }).then(() => true).catch(() => false);
          await item.page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
          const back = await item.page.evaluate(collect, {
            state: 'guide', locale: cfg.locale, theme: 'light', width: cfg.width, height: cfg.height,
            textScale: null, expectedTitle: C.TITLES.guide[cfg.locale], expectedControlIds: C.CONTROL_IDS.guide,
          });
          const backChecks = [
            check('system-follow-light-after', backOk && back.document.datasetTheme === 'light' ? 'ok' : 'fail', { resolved: back.document.datasetTheme }),
            paletteCheck(back, 'light'),
          ];
          caseResult.states['guide-system-switch'].back = { theme: back.document, palette: back.palette };
          backChecks.forEach(c => caseChecks.push({ ...c, state: 'guide-system-switch' }));
        }

        const countsBeforeStart = { ...item.state.counts };
        caseResult.countsBeforeStart = countsBeforeStart;
        stopGuard();
        await item.page.locator('#assessment-start').click();
        await item.page.locator('#assessment-question').waitFor({ state: 'visible' });
        await item.page.waitForFunction(() => document.getElementById('assessment-option-A') !== null);
        if (cfg.selectionProbe) {
          const probeKey = cfg.selectionProbe;
          await item.page.waitForFunction(() => document.getElementById('assessment-page')?.getAttribute('aria-busy') === 'false');
          // Normal pointer click, not a DOM/programmatic selection.
          await item.page.locator(`#assessment-option-${probeKey}`).click();
          await item.page.waitForFunction(k => document.getElementById(`assessment-option-${k}`)?.getAttribute('aria-pressed') === 'true', probeKey);
          const probe = await snapshot('question', { storageKey: 'question-selected-C', checkState: 'question', scrollTarget: `#assessment-option-${probeKey}` });
          const opt = ((probe.raw.options && probe.raw.options.list) || []).find(o => o.id === `assessment-option-${probeKey}`);
          const sel = probe.raw.selected;
          const probeChecks = [
            check('probe-c-selected-badge', sel && sel.id === `assessment-option-${probeKey}` && sel.ariaPressed === 'true' && sel.classSelected && sel.label === C.COPY[cfg.locale].selected && sel.iconCount > 0 ? 'ok' : 'fail', sel),
            check('probe-c-whole-words', opt && opt.text === 'reading a book' && opt.textAudit && opt.textAudit.tokens >= 3 && opt.textAudit.splits.length === 0 && opt.textAudit.outside.length === 0 ? 'ok' : 'fail', opt ? { text: opt.text, audit: opt.textAudit } : null),
            check('probe-c-layout', opt && opt.rect.width > 0 && opt.rect.height >= 44 && probe.raw.overflow && !probe.raw.overflow.documentHorizontal && probe.raw.overflow.elements.length === 0 && probe.raw.overlaps && probe.raw.overlaps.length === 0 && probe.raw.clipping && probe.raw.clipping.length === 0 ? 'ok' : 'fail', opt ? { rect: opt.rect, overflow: probe.raw.overflow, overlaps: probe.raw.overlaps, clipping: probe.raw.clipping } : null),
          ];
          probeChecks.forEach(c => caseChecks.push({ ...c, state: 'question-selected-C' }));
          await pageShot(C.SELECTION_PROBE_SHOT);
        }
        await item.page.locator('#assessment-option-A').click();
        await item.page.waitForFunction(() => document.getElementById('assessment-option-A')?.getAttribute('aria-pressed') === 'true');
        await snapshot('question');
        await pageShot(C.SHOTS.question);
        if (cfg.width === 320) await pageShot(C.QUESTION_FULL, true);

        for (let i = 1; i <= 10; i++) {
          stopGuard();
          if (i > 1) {
            await item.page.waitForFunction(() => document.getElementById('assessment-page')?.getAttribute('aria-busy') === 'false');
            await item.page.locator('#assessment-option-A').click();
            await item.page.waitForFunction(() => document.getElementById('assessment-option-A')?.getAttribute('aria-pressed') === 'true');
          }
          await item.page.waitForFunction(() => document.getElementById('assessment-page')?.getAttribute('aria-busy') === 'false');
          await item.page.locator('#assessment-submit').click();
          await item.page.waitForFunction(n => {
            if (n === 10) return !!document.getElementById('assessment-report');
            const bar = document.querySelector('[role=progressbar]');
            return !!bar && Number(bar.getAttribute('aria-valuenow')) === n;
          }, i, { timeout: 25000 });
          caseResult.submitLog.push({ i, at: nowIso(), counts: { ...item.state.counts } });
        }
        await item.page.locator('#assessment-report').waitFor({ state: 'visible' });
        await item.page.waitForFunction(() => document.getElementById('assessment-page')?.getAttribute('aria-busy') === 'false');
        stopGuard();
        const ensureUntil = Date.now() + 5000;
        while (item.state.counts.ensure === 0 && Date.now() < ensureUntil) await item.page.waitForTimeout(100);
        await item.page.waitForTimeout(200);

        await snapshot('report');
        const reportRaw = caseResult.states.report.raw;
        caseResult.reportFacts = reportRaw && reportRaw.report ? {
          level: reportRaw.report.level, score: reportRaw.report.score,
          count: reportRaw.report.count, factsRaw: reportRaw.report.countedRaw || null,
          feedback: reportRaw.report.feedback, renderedAfterTenSubmits: item.state.counts.respond === 10,
        } : { renderedAfterTenSubmits: false };
        await pageShot(C.SHOTS.report);
        await pageShot(C.REPORT_FULL, true);

        caseResult.retest.before = item.state.counts.retest;
        stopGuard();
        await item.page.locator('#assessment-retest').click();
        await item.page.locator('#assessment-retest-confirmation').waitFor({ state: 'visible' });
        await item.page.waitForTimeout(350);
        caseResult.retest.afterDialog = item.state.counts.retest;
        await snapshot('retest-confirm');
        await pageShot(C.SHOTS['retest-confirm']);
        if (cfg.textScale) await pageShot('05b-retest-confirmation-fullpage.png', true);

        await item.page.locator('#assessment-retest-cancel').click();
        await item.page.locator('#assessment-retest-confirmation').waitFor({ state: 'detached' });
        await item.page.waitForTimeout(250);
        caseResult.retest.afterCancel = item.state.counts.retest;
        caseResult.retest.countsFinal = { ...item.state.counts };
        await snapshot('retest-cancelled');
        await pageShot(C.SHOTS['retest-cancelled']);
        const fixtureHashesAfter = fixture.hashes();
        caseResult.sourceFreezeAfter = fixtureHashesAfter;
        const drift = Object.keys(fixtureHashesAfter).filter(k => fixtureHashesAfter[k] !== originalFreshHashes[k]);
        const supportAfter = supportingHashes();
        caseResult.freezeCheck = { ok: drift.length === 0 && supportingMismatches(supportAfter).length === 0, detail: { drift, supporting: supportAfter, expectedSupportingMismatches: supportingMismatches(supportAfter) } };
        caseResult.sourceFreezeAfterSupporting = supportAfter;
        caseResult.fixtureLedger = (fixture.report.requests || [])
          .filter(entry => entry.id === item.state.id)
          .map(entry => ({ method: entry.method, origin: entry.origin, path: entry.path }));
        caseChecks.push(...flowChecks(caseResult, item, fixture, cfg));
        caseResult.counts = { ...item.state.counts };
        caseResult.status = aggregate(caseChecks);
      } catch (error) {
        if (error && error.stopped) {
          caseResult.status = 'STOPPED';
          stopRequested = true;
          stopped = true;
        } else if (error && error.harnessInvalid) {
          caseResult.harnessInvalid = true;
          caseResult.errors.push({ message: sanitizeMessage(String(error && error.stack || error)), at: nowIso() });
          caseResult.status = 'ERROR';
          errors++;
          await failShot('harness');
        } else {
          caseResult.errors.push({ message: sanitizeMessage(String(error && error.stack || error)), at: nowIso() });
          caseResult.status = 'ERROR';
          errors++;
          await failShot('case');
        }
      } finally {
        if (item) { try { await item.close(); } catch { /* context already closed */ } }
        caseResult.finishedAt = nowIso();
        if (!caseResult.freezeCheck && fixture) {
          try {
            const after = fixture.hashes();
            const before = caseResult.sourceFreezeBefore || after;
            const drift = Object.keys(after).filter(k => after[k] !== before[k]);
            const supportAfter = supportingHashes();
            caseResult.freezeCheck = { ok: drift.length === 0 && supportingMismatches(supportAfter).length === 0, detail: { drift, supporting: supportAfter, expectedSupportingMismatches: supportingMismatches(supportAfter) }, final: true };
            caseResult.sourceFreezeAfter = after;
            caseResult.sourceFreezeAfterSupporting = supportAfter;
          } catch (freezeError) {
            caseResult.freezeCheck = { ok: false, detail: { error: String(freezeError && freezeError.message || freezeError) } };
          }
        }
        const checks = caseResult.checks;
        caseResult.summary = {
          ok: checks.filter(c => c.status === 'ok').length,
          info: checks.filter(c => c.status === 'info').length,
          review: checks.filter(c => c.status === 'review').length,
          fail: checks.filter(c => c.status === 'fail').length,
          notMeasured: checks.filter(c => c.status === 'not-measured').length,
        };
        writeJson(path.join(caseDir, 'result.json'), caseResult);
        results.cases[cfg.id] = {
          status: caseResult.status, dir: path.relative(runDir, caseDir).replace(/\\/g, '/'),
          resultFile: caseResult.status === 'STOPPED' ? null : path.relative(runDir, path.join(caseDir, 'result.json')).replace(/\\/g, '/'),
          partial: caseResult.status === 'STOPPED',
          summary: caseResult.summary, screenshots: caseResult.screenshots.length,
          failedChecks: checks.filter(c => c.status === 'fail').map(c => `${c.state || 'flow'}:${c.id}`),
          reviewChecks: checks.filter(c => c.status === 'review').map(c => `${c.state || 'flow'}:${c.id}`),
          infoChecks: checks.filter(c => c.status === 'info').map(c => `${c.state || 'flow'}:${c.id}`),
          harnessInvalid: caseResult.harnessInvalid === true,
        };
        results.updatedAt = nowIso();
        results.summary = {
          measured: Object.values(results.cases).filter(c => c.status === 'MEASURED').length,
          review: Object.values(results.cases).filter(c => c.status === 'REVIEW').length,
          incomplete: Object.values(results.cases).filter(c => c.status === 'INCOMPLETE').length,
          failed: Object.values(results.cases).filter(c => c.status === 'FAILED').length,
          error: Object.values(results.cases).filter(c => c.status === 'ERROR').length,
          stopped: Object.values(results.cases).filter(c => c.status === 'STOPPED').length,
          screenshots: Object.values(results.cases).reduce((n, c) => n + (c.screenshots || 0), 0),
        };
        writeJson(path.join(runDir, 'results.json'), results);
        if (caseResult.status === 'MEASURED') measured++;
        else if (caseResult.status === 'FAILED') failures++;
        else if (caseResult.status === 'INCOMPLETE') incomplete++;
        else if (caseResult.status === 'REVIEW') reviewed++;
        if (caseResult.status !== 'STOPPED') done.add(cfg.id);
        checkpoint.completed = [...done];
        checkpoint.pending = selected.map(c => c.id).filter(id => !done.has(id));
        checkpoint.lastCaseId = cfg.id;
        checkpoint.lastStatus = caseResult.status;
        checkpoint.screenshots = results.summary.screenshots;
        checkpoint.updatedAt = nowIso();
        writeJson(checkpointFile, checkpoint);
      }

      if (fixture) {
        const afterCase = fixture.hashes();
        const supportNow = supportingHashes();
        const drift = Object.keys(afterCase).some(k => afterCase[k] !== fixtureHashes[k]) || supportingMismatches(supportNow).length > 0;
        if (drift) {
          checkpoint.status = 'SOURCE_DRIFT';
          checkpoint.stopReason = 'source-drift';
          checkpoint.driftAt = nowIso();
          checkpoint.driftCase = cfg.id;
          checkpoint.updatedAt = nowIso();
          writeJson(checkpointFile, checkpoint);
          driftAbort = true;
          break;
        }
      }
    }

    if (!driftAbort) {
      checkpoint.status = (stopRequested || checkpoint.stopReason) ? 'STOPPED' : 'FINISHED';
      checkpoint.stopReason = checkpoint.stopReason || (stopRequested ? 'signal' : null);
      checkpoint.updatedAt = nowIso();
      writeJson(checkpointFile, checkpoint);
    }
    writeJson(path.join(runDir, 'run-status.json'), {
      runId: args.runId, label: args.label, preparedBy: PREPARED_BY, status: checkpoint.status,
      group: manifest.group, caseIds: args.caseIds,
      finishedAt: nowIso(), summary: results.summary, plannedContexts: selected.length,
      plannedScreenshots: C.plannedScreenshots(selected), completedScreenshots: results.summary.screenshots,
      note: 'No PASS verdict is produced by this runner; Root reviews raw measurements and screenshots.',
    });
    process.stdout.write(JSON.stringify({
      runId: args.runId, status: checkpoint.status, summary: results.summary,
      plannedContexts: selected.length, completed: checkpoint.completed.length,
      dir: path.relative(ROOT, runDir).replace(/\\/g, '/'),
    }, null, 2) + '\n');
  } finally {
    try { if (fixture) await fixture.close(); } catch { /* already closed */ }
    process.removeListener('SIGINT', onSignal);
    process.removeListener('SIGTERM', onSignal);
  }

  const anyBad = failures + incomplete + errors + reviewed > 0;
  if (driftAbort) return 2;
  if (checkpoint.status === 'STOPPED') return 130;
  return anyBad ? 1 : 0;
}

main().then(code => { process.exitCode = code; }).catch(error => {
  process.stderr.write(`REFUSED/FAILED: ${error && error.message || error}\n`);
  process.exitCode = Number.isInteger(error && error.exitCode) ? error.exitCode : 2;
});
