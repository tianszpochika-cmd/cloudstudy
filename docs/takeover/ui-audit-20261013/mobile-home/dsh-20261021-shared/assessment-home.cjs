'use strict'
// MB007 shared narrow H5 (current C7 home): home ready -> assessment guide -> signed C8 home exit ->
// fresh home DOM/GETs. PREPARED ONLY; author did not run. Reuses ../dsh-20261021-qa/fixture.cjs by
// relative require; that QA file is never modified. No start/respond/retest/ensure/consent write, no
// guard bypass, unknown 501 FAILS.
const fs = require('node:fs'), path = require('node:path')
const fixture = require(path.join(__dirname, '..', 'dsh-20261021-qa', 'fixture.cjs'))
const RUNS = path.join(__dirname, 'runs'), RUN_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/i
const ASSESSMENT = 'apps/mobile/src/pages/assessment/assessment.vue'
const RUNTIME = 'apps/mobile/src/platform/uni-runtime.ts'
const LEARN = 'apps/mobile/src/pages/learn/learn.vue'
const FIXED = {
  [ASSESSMENT]: '41e1670146621e532921a8916b2c81ea4954d880b2373c7bcc9945d6576d7e86',
  'apps/mobile/src/api/learner-content.ts': '43ce2ad5d6519b5fab7e38867d1349b569d08b6153b74c87e5c96f11e24e1ae6',
  'apps/mobile/src/stores/session.ts': 'd944c9e84617af5ad553d2fbc1fd0c07120ce790411dbe02603f9338333f8931',
  'apps/mobile/src/auth/navigation.ts': '7365fec07c55857445fdb1d87b60659734e9e94dc06cfb65afabcb3e8863a4b5',
}
const CANDIDATES = {
  home: [fixture.PAGE, 'EXPECTED_HOME_SHA'], i18n: [fixture.I18N, 'EXPECTED_I18N_SHA'],
  store: [fixture.STORE, 'EXPECTED_STORE_SHA'], runtime: [RUNTIME, 'EXPECTED_RUNTIME_SHA'],
  learn: [LEARN, 'EXPECTED_LEARN_SHA'],
}
const DEPS = { 'apps/mobile/package.json': '484382c73929055cc4ecd9a83679f8bab72388dd8069f71a056b3bbc595c0078', 'pnpm-lock.yaml': 'd57a87ca84985549fd53c69b1fe1d59db0b136036f2f7bf640d3b30c0a106624' }
const FORBIDDEN = ['/api/v1/assessment/placement/sessions', '/api/v1/learning/plans:ensure', '/api/v1/learning/plans:replan']
const keyed = (v) => /\b(?:mobile|auth)\.[a-z][\w]*(?:\.[\w]+)+/i.test(String(v || ''))
const isForbidden = (r) => r.method !== 'GET' && r.method !== 'OPTIONS' && (FORBIDDEN.includes(r.path) || r.path.endsWith('/responses') || r.path.endsWith('/retest'))
function refuse(why, extra) { console.error('REFUSED: ' + why); if (extra) console.error(JSON.stringify(extra, null, 2)); process.exit(2) }
function envExpected() {
  const expected = { ...FIXED, ...DEPS }, missing = []
  for (const [file, name] of Object.values(CANDIDATES)) {
    const value = String(process.env[name] || '').trim().toLowerCase()
    if (!/^[a-f0-9]{64}$/.test(value)) missing.push({ env: name, file, actual: fixture.hash(file) })
    else expected[file] = value
  }
  if (missing.length) refuse('EXPECTED_HOME_SHA / EXPECTED_I18N_SHA / EXPECTED_STORE_SHA / EXPECTED_RUNTIME_SHA / EXPECTED_LEARN_SHA must be the five 64-hex values Root reviews after the L1 freeze; candidates are never auto-adopted', { missing })
  return expected
}
function snapshot() { return { ...fixture.hashes(), [ASSESSMENT]: fixture.hash(ASSESSMENT), [LEARN]: fixture.hash(LEARN) } }
async function until(fn, ms = 4000) { const end = Date.now() + ms
  while (Date.now() < end) { try { if (await fn()) return true } catch { /* transient */ } await new Promise((r) => setTimeout(r, 50)) } return false }
async function main() {
  const expected = envExpected(), before = snapshot()
  const bad = Object.entries(expected).filter(([file, want]) => before[file] !== want).map(([file, want]) => ({ file, expected: want, actual: before[file] }))
  if (bad.length) refuse('source/dependency freeze mismatch against Root-provided C5 candidates; actual hashes below', { mismatches: bad })
  if (process.env.CONFIRM !== '1') refuse('set CONFIRM=1 to run in the Root review environment.')
  const run = String(process.env.RUN || '').trim(); if (!RUN_RE.test(run)) refuse('RUN is required and must match /^[a-z0-9][a-z0-9._-]{0,63}$/i.')
  const out = path.join(RUNS, run); if (fs.existsSync(out)) refuse('run directory already exists and is never overwritten: ' + out); fs.mkdirSync(out, { recursive: true })
  const report = { scope: 'MB007_SHARED_HOME_ASSESSMENT_HOME_NARROW_H5', run, at: new Date().toISOString(), executedBy: String(process.env.EXECUTOR || 'root-review'), preparedBy: 'DSH; no browser launch', base: fixture.BASE, viewport: '390x844', locale: 'zh-CN', theme: 'light', expected, sourcesBefore: before, sourcesAfter: null, sourceStable: null, depsStable: null, checks: [], requests: [], unknown: [], pageErrors: [], consoleErrors: [], consoleWarnings: [], closed: false, businessPass: false, nativePass: false, result: 'NOT_RUN' }
  const save = () => { report.summary = { checks: report.checks.length, failed: report.checks.filter((c) => c.result !== 'PASS').length, warnings: report.consoleWarnings.length }; fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(report, null, 2)) }
  save()
  let session, setup = false, code = 2
  try {
    await fixture.init()
    session = await fixture.fresh({ mode: 'ready', locale: 'zh-CN', theme: 'light' })
    const page = session.page, state = session.state
    await until(() => state.counts.today >= 1, 20000)
    const base = { ...state.counts }, reqAt = fixture.report.requests.length
    const check = (name, ok, detail) => { report.checks.push({ name, result: ok ? 'PASS' : 'FAIL', ...(detail ? { detail } : {}) }); save() }
    const homeTitle = (await page.locator('.home-title').innerText()).trim()
    check('home-ready-390-zh-light', await page.locator('.home-page').isVisible() && homeTitle === fixture.COPY.h1[0] && state.counts.home >= 1 && state.counts.catalog >= 1 && state.counts.today >= 1, { homeTitle, counts: base })
    await page.locator('.home-text-action').filter({ hasText: fixture.COPY.assessment[0] }).first().click()
    await page.locator('#assessment-guide').waitFor({ state: 'visible', timeout: 20000 })
    const guideTitle = (await page.locator('#assessment-title').innerText()).trim()
    const points = await page.locator('.assessment-guide-point').count()
    const phase = fixture.report.requests.slice(reqAt).filter((r) => r.caseId === session.id)
    check('assessment-guide-real-dom-and-necessary-gets', await page.locator('#assessment-start').isVisible() && await page.locator('#assessment-home').isVisible() && points >= 2 && guideTitle.length > 0 && !keyed(guideTitle) && !phase.some((r) => r.status === 501), { guideTitle, points, phase })
    const writes = phase.filter((r) => r.method !== 'GET' && r.method !== 'OPTIONS'), forbidden = phase.filter(isForbidden)
    check('assessment-zero-start-respond-retest-ensure', state.counts.write === base.write && writes.length === 0 && forbidden.length === 0, { writeDelta: state.counts.write - base.write, writes, forbidden })
    await page.locator('#assessment-home').click()
    await page.waitForFunction(() => location.hash === '#/', null, { timeout: 20000 })
    await page.locator('.home-page').waitFor({ state: 'visible', timeout: 20000 })
    const fresh = await until(() => state.counts.home > base.home && state.counts.catalog > base.catalog && state.counts.today > base.today, 25000)
    const returnedTitle = (await page.locator('.home-title').innerText()).trim(), tasks = await page.locator('.home-task').count()
    check('c8-home-canonical-hash-dom-and-new-gets', (await page.evaluate(() => location.hash)) === '#/' && returnedTitle === fixture.COPY.h1[0] && tasks >= 1 && fresh, { hash: await page.evaluate(() => location.hash), returnedTitle, tasks, counts: state.counts })
    const unknown = fixture.report.unknown.filter((u) => u.caseId === session.id)
    const pageErrors = fixture.report.pageErrors.filter((e) => e.caseId === session.id)
    const consoleErrors = fixture.report.consoleErrors.filter((e) => e.caseId === session.id)
    report.requests = fixture.report.requests.filter((r) => r.caseId === session.id)
    report.unknown = unknown; report.pageErrors = pageErrors; report.consoleErrors = consoleErrors
    report.consoleWarnings = fixture.report.consoleWarnings.filter((e) => e.caseId === session.id)
    check('transport-zero-unknown-pageerror-console-error', unknown.length === 0 && pageErrors.length === 0 && consoleErrors.length === 0 && state.counts.write === base.write, { unknown, pageErrors, consoleErrors, warnings: report.consoleWarnings, writeDelta: state.counts.write - base.write })
  } catch (error) { report.failure = { message: String((error && error.message) || error), stack: error && error.stack }; if (session) report.checks.push({ name: 'case-aborted', result: 'FAIL', detail: { message: report.failure.message } }); else setup = true; save() }
  finally {
    try { if (session) await session.close(); await fixture.close(); report.closed = true } catch (error) { report.closed = false; report.closeError = String((error && error.message) || error); setup = true }
    const after = snapshot(); report.sourcesAfter = after
    report.sourceStable = JSON.stringify(before) === JSON.stringify(after)
    report.depsStable = Object.keys(DEPS).every((f) => before[f] === after[f])
    if (!report.sourceStable || !report.depsStable) { setup = true; report.drift = Object.entries(expected).filter(([f, h]) => after[f] !== h).map(([f, h]) => ({ file: f, expected: h, actual: after[f] })) }
    const failed = report.checks.some((c) => c.result !== 'PASS')
    report.result = failed ? 'FAIL' : (setup || report.checks.length === 0) ? 'SETUP_INCOMPLETE' : 'HOME_ASSESSMENT_HOME_FIXTURE_PASS_NO_BACKEND_OR_NATIVE_PASS'
    code = failed ? 1 : (setup || report.checks.length === 0) ? 2 : 0; report.exit = code; save()
    console.log(JSON.stringify({ status: report.result, run, exit: code, checks: report.checks.length, failed: report.checks.filter((c) => c.result !== 'PASS').length, sourceStable: report.sourceStable, depsStable: report.depsStable, closed: report.closed }))
  }
  return code
}
main().then((code) => { process.exitCode = code }).catch((error) => { console.error((error && error.stack) || error); process.exitCode = 2 })
