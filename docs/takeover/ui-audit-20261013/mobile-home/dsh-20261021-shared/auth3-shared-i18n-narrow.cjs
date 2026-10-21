'use strict'
// AUTH3 shared narrow smoke on the shared runtime — PREPARED ONLY; Root runs it; DSH did not launch.
// Same 3 pages x 5 named checks, real login/register/reset HTTP errors and page-copy scope as the signed
// auth3 script. Root supplies the current five candidate hashes (home/i18n/store/runtime/learn) after the
// L1 freeze; auth and assessment sources stay fixed. No candidate value is pinned in this file.
// Transport only (method+path; no headers/body/token/storage); unknown 501 FAILS.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto')
const ROOT = path.resolve(__dirname, '../../../../..'), BASE = 'http://127.0.0.1:18183'
const REFRESH = '/api/v1/auth/token/refresh', RUN_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/i
const VALUE = { identifier: 'ui-pointer-synthetic', password: 'SyntheticOnly123!', confirm: 'SyntheticOnly123!', newPassword: 'SyntheticOnly123!', token: 'ui-fixture-' + 'x'.repeat(32) }
const FIXED = {
  'apps/mobile/src/pages/login/login.vue': '0c5fb5cd346d9e86271eaf65638cf2ffabbc9b466fb3d6cd1079e4fbc9a55460', 'apps/mobile/src/pages/register/register.vue': '9258cb03e36c97d53d2e88521ba29f95aaf81de794657c8c72689fa50bd66baf',
  'apps/mobile/src/pages/reset-password/reset-password.vue': 'c9a6da864e9ce8933cb5a42b6743ff99551fa433eafe701ea470c760d88cc936', 'apps/mobile/src/platform/pointer-feedback.ts': '24a1f9b26ad6797fc9a61a16cb43559d116230cd7e9cd66c1dd4d9a563d94a6c',
  'apps/mobile/src/stores/session.ts': 'd944c9e84617af5ad553d2fbc1fd0c07120ce790411dbe02603f9338333f8931', 'apps/mobile/src/pages/assessment/assessment.vue': '41e1670146621e532921a8916b2c81ea4954d880b2373c7bcc9945d6576d7e86',
}
const CANDIDATES = {
  home: ['apps/mobile/src/pages/home/home.vue', 'EXPECTED_HOME_SHA'],
  i18n: ['packages/i18n/src/mobile-experience.ts', 'EXPECTED_I18N_SHA'],
  store: ['apps/mobile/src/stores/learner-content.ts', 'EXPECTED_STORE_SHA'],
  runtime: ['apps/mobile/src/platform/uni-runtime.ts', 'EXPECTED_RUNTIME_SHA'],
  learn: ['apps/mobile/src/pages/learn/learn.vue', 'EXPECTED_LEARN_SHA'],
}
const DEPS = { 'apps/mobile/package.json': '484382c73929055cc4ecd9a83679f8bab72388dd8069f71a056b3bbc595c0078', 'pnpm-lock.yaml': 'd57a87ca84985549fd53c69b1fe1d59db0b136036f2f7bf640d3b30c0a106624' }
const CASES = {
  login: { route: 'login/login', h1: '#mobile-login-title', h1Text: 'Welcome back', labels: '.login-label', labelTexts: ['Account', 'Password'],
    first: '#mobile-login-identifier', button: '.login-submit', empty: '.login-error[role="alert"]', alert: '.login-error[role="alert"]',
    fields: ['identifier', 'password'], path: '/api/v1/auth/login', status: 401, code: 'iam.credentials.invalid', emptyCopy: 'Enter your account and password.', named: 'Your account or password is incorrect. Try again.' },
  register: { route: 'register/register', h1: '#mobile-register-title', h1Text: 'Create account', labels: '.register-label', labelTexts: ['Account', 'Password', 'Confirm password'],
    first: '#mobile-register-identifier', button: '.register-submit', empty: '#mobile-register-identifier-error', alert: '.register-server-error',
    fields: ['identifier', 'password', 'confirm'], path: '/api/v1/auth/register', status: 409, code: 'iam.account.already_exists', emptyCopy: 'Enter your account.', named: 'Registration did not complete. Try signing in or resetting your password.' },
  reset: { route: 'reset-password/reset-password', h1: '#mobile-reset-title', h1Text: 'Set a new password', labels: '.reset-label', labelTexts: ['Account', 'Reset code', 'New password'],
    first: '#mobile-reset-identifier', button: '.reset-submit', empty: '#mobile-reset-identifier-error', alert: '.reset-server-error',
    fields: ['identifier', 'token', 'newPassword'], path: '/api/v1/auth/password-reset/confirm', status: 401, code: 'iam.password_reset.invalid', emptyCopy: 'Enter your account.', named: 'The reset code is invalid or expired. Request a new one.', enter: '.reset-step-button' },
}
const bare = (v) => /^(?:[a-z][\w-]*\.)+[a-z][\w-]*$/i.test(String(v || '').trim())
const keyed = (v) => /\b(?:mobile|auth)\.[a-z][\w]*(?:\.[\w]+)+/i.test(String(v || ''))
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, f))).digest('hex')
const ALL = [...Object.keys(FIXED), ...Object.values(CANDIDATES).map(([file]) => file)]
function refuse(why, extra) { console.error('REFUSED: ' + why); if (extra) console.error(JSON.stringify(extra, null, 2)); process.exit(2) }
function envExpected() {
  const sources = { ...FIXED }, missing = []
  for (const [file, name] of Object.values(CANDIDATES)) {
    const value = String(process.env[name] || '').trim().toLowerCase()
    if (!/^[a-f0-9]{64}$/.test(value)) missing.push({ env: name, file, actual: sha(file) })
    else sources[file] = value
  }
  if (missing.length) refuse('EXPECTED_HOME_SHA / EXPECTED_I18N_SHA / EXPECTED_STORE_SHA / EXPECTED_RUNTIME_SHA / EXPECTED_LEARN_SHA must be the five 64-hex values Root reviews after the L1 freeze; candidates are never auto-adopted', { missing })
  return sources
}
function readAll() {
  const sources = {}, deps = {}
  for (const f of ALL) sources[f] = sha(f)
  for (const f of Object.keys(DEPS)) deps[f] = sha(f)
  return { sources, deps }
}
function drift(actual, expected) {
  const cmp = (wanted, got) => Object.keys(wanted).filter((f) => got[f] !== wanted[f]).map((f) => ({ file: f, expected: wanted[f], actual: got[f] }))
  return [...cmp(expected, actual.sources), ...cmp(DEPS, actual.deps)]
}
async function until(fn, ms = 4000) { const end = Date.now() + ms
  while (Date.now() < end) { try { if (await fn()) return true } catch { /* transient */ } await new Promise((r) => setTimeout(r, 50)) } return false }
async function runCase(browser, mode, report, save) {
  const s = CASES[mode], id = (f) => '#mobile-' + mode + '-' + f
  const st = { submit: 0, hold: false, release: null }
  const headers = { 'content-type': 'application/json', 'access-control-allow-origin': BASE, 'access-control-allow-credentials': 'true', 'access-control-allow-methods': 'POST,OPTIONS', 'access-control-allow-headers': 'content-type,idempotency-key' }
  const handle = async (route) => {
    const q = route.request(), method = q.method(), p = new URL(q.url()).pathname
    let status = 501, body = '{"code":"SYNTHETIC_UNKNOWN_ROUTE"}'
    if (method === 'OPTIONS') { status = 204; body = '' }
    else if (method === 'POST' && p === REFRESH) { status = 401; body = '{"code":"iam.session.refresh_invalid"}' }
    else if (method === 'POST' && p === s.path) {
      st.submit++; status = s.status; body = JSON.stringify({ code: s.code }); report.requests.push({ mode, method, path: p, status })
      if (st.hold) await new Promise((resolve) => { st.release = resolve })
      return route.fulfill({ status, headers, body })
    } else report.unknownApi.push({ mode, method, p })
    report.requests.push({ mode, method, path: p, status }); await route.fulfill(body ? { status, headers, body } : { status, headers })
  }
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'en-US', reducedMotion: 'reduce' }); await context.route('**/*', (r) => { const u = new URL(r.request().url()); return u.hostname === '127.0.0.1' && u.port === '18183' ? r.continue() : r.abort() })
  await context.route('**/api/v1/**', handle); const page = await context.newPage(); page.setDefaultTimeout(8000)
  page.on('pageerror', (e) => report.pageErrors.push({ mode, name: e.name, message: e.message }))
  page.on('console', (m) => {
    const t = m.text(); let p = null; try { const l = m.location(); if (l && l.url) p = new URL(l.url).pathname } catch { /* no path */ }
    if (m.type() === 'warning') report.consoleWarnings.push({ mode, message: t, p })
    else if (m.type() === 'error') { const h = /status of (\d{3})/.exec(t), code = h ? Number(h[1]) : null; report.consoleErrors.push({ mode, message: t, p, named: Boolean(h) && p !== null && (p === s.path || p === REFRESH) && report.requests.some((r) => r.mode === mode && r.method === 'POST' && r.path === p && r.status === code) }) }
  })
  const loc = (x) => page.locator(x).first(), active = () => page.evaluate(() => (document.activeElement && document.activeElement.id) || '')
  const locked = async (x) => { const l = loc(x), d = await l.getAttribute('disabled'); return (await l.getAttribute('aria-disabled')) === 'true' || (d !== null && d !== 'false') || (await l.isDisabled()) || (await l.getAttribute('readonly')) !== null }
  const release = () => { const r = st.release; st.release = null; st.hold = false; if (r) r() }
  async function click(x, hold = 0) {
    const t = loc(x); await t.waitFor({ state: 'visible' }); await t.scrollIntoViewIfNeeded()
    const b = await t.boundingBox(); if (!b) throw new Error('no box for ' + x)
    const cx = b.x + b.width / 2, cy = b.y + b.height / 2; await page.mouse.move(cx, cy)
    if (hold) { await page.mouse.down(); await page.waitForTimeout(hold); await page.mouse.up() } else await page.mouse.click(cx, cy)
  }
  const check = (name, ok, detail) => { report.checks.push({ case: mode, name: mode + '-' + name, result: ok ? 'PASS' : 'FAIL', ...(detail ? { detail } : {}) }); save() }
  try {
    await page.goto(`${BASE}/#/pages/${s.route}?uiLocale=en-US&theme=light`, { waitUntil: 'networkidle' })
    await loc(s.h1).waitFor({ state: 'visible' })
    if (s.enter) { await click(s.enter); await loc('#mobile-reset-token').waitFor({ state: 'visible' }) }
    const facts = await page.evaluate(() => ({ theme: document.documentElement.dataset.theme || '', lang: document.documentElement.lang || '', body: document.body.innerText }))
    const title = await loc(s.h1).evaluate((el) => ({ text: (el.textContent || '').trim(), visible: el.getClientRects().length > 0 }))
    const labels = await page.locator(s.labels).allInnerTexts(), inputVisible = await loc(s.first).isVisible()
    check('open-390-en-US-light', facts.theme === 'light' && /^en/i.test(facts.lang) && title.visible && title.text === s.h1Text && !bare(title.text) && labels.length === s.labelTexts.length && labels.every((t, i) => t.trim() === s.labelTexts[i] && !bare(t)) && inputVisible && !keyed(facts.body), { theme: facts.theme, lang: facts.lang, title: title.text, labels, inputVisible })
    await click(s.button, 160); await loc(s.empty).waitFor({ state: 'visible' })
    const focused = await until(async () => (await active()) === 'mobile-' + mode + '-identifier'); const emptyText = (await loc(s.empty).innerText()).trim()
    check('empty-pointer160-required-focus-no-write', st.submit === 0 && focused && emptyText === s.emptyCopy && !bare(emptyText), { submit: st.submit, focused, text: emptyText })
    for (const f of s.fields) await loc(id(f)).fill(VALUE[f])
    await loc(id(s.fields[s.fields.length - 1])).blur(); st.hold = true
    await click(s.button)
    const started = await until(() => st.submit === 1), disabled = await until(() => locked(s.button))
    check('held-submit-one-request-button-disabled', started && disabled && st.submit === 1, { submit: st.submit, disabled })
    release(); await loc(s.alert).waitFor({ state: 'visible' })
    const alertText = (await loc(s.alert).innerText()).trim(), restored = await until(async () => !(await locked(s.button)))
    check('named-' + s.status + '-alert-and-button-restored', alertText === s.named && !bare(alertText) && restored, { text: alertText, restored })
    const hash = await page.evaluate(() => location.hash.split('?')[0]), h1 = (await loc(s.h1).innerText()).trim()
    const pageErrors = report.pageErrors.filter((e) => e.mode === mode), unknown = report.unknownApi.filter((e) => e.mode === mode), unnamed = report.consoleErrors.filter((e) => e.mode === mode && !e.named)
    check('same-route-no-extra-write-transport-clean', hash === '#/pages/' + s.route && h1 === s.h1Text && st.submit === 1 && pageErrors.length === 0 && unknown.length === 0 && unnamed.length === 0, { hash, submit: st.submit, pageErrors, unknown, unnamed })
  } catch (error) { report.checks.push({ case: mode, name: mode + '-case-aborted', result: 'FAIL', detail: { message: String((error && error.message) || error) } }); save() }
  finally {
    release(); try { await context.close() } catch { report.contextCloseFailed = true }; save()
  }
}
async function main() {
  const expected = envExpected()
  const before = readAll(), bad = drift(before, expected); if (bad.length) refuse('source/dependency freeze mismatch against Root-provided C5 candidates; actual hashes below', { mismatches: bad })
  const run = String(process.env.RUN || '').trim(); if (process.env.CONFIRM !== '1' || !RUN_RE.test(run)) refuse('set CONFIRM=1 and a unique RUN matching /^[a-z0-9][a-z0-9._-]{0,63}$/i.')
  const out = path.join(__dirname, 'runs', run); if (fs.existsSync(out)) refuse('run directory already exists and is never overwritten: ' + out); fs.mkdirSync(out, { recursive: true })
  const report = { scope: 'AUTH3_SHARED_MB007_NARROW_SMOKE', run, at: new Date().toISOString(), executedBy: String(process.env.EXECUTOR || 'root-review'), preparedBy: 'DSH; no browser launch', base: BASE, viewport: '390x844', uiLocale: 'en-US', theme: 'light', expected, sourcesBefore: before.sources, depsBefore: before.deps, sourcesAfter: null, depsAfter: null, sourceStable: null, depsStable: null, checks: [], requests: [], unknownApi: [], pageErrors: [], consoleErrors: [], consoleWarnings: [], closed: false, businessPass: false, nativePass: false, result: 'NOT_RUN' }
  const save = () => { report.summary = { checks: report.checks.length, failed: report.checks.filter((c) => c.result !== 'PASS').length, warnings: report.consoleWarnings.length }; fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(report, null, 2)) }
  save(); let browser, setup = false, code = 2
  try {
    const { chromium } = require('playwright'); browser = await chromium.launch()
    for (const mode of Object.keys(CASES)) await runCase(browser, mode, report, save)
  } catch (error) { setup = true; report.failure = { message: String((error && error.message) || error), stack: error && error.stack } }
  finally {
    try { if (browser) await browser.close(); report.closed = Boolean(browser) } catch { setup = true; report.closed = false }
    const after = readAll(); report.sourcesAfter = after.sources; report.depsAfter = after.deps
    report.sourceStable = JSON.stringify(before.sources) === JSON.stringify(after.sources); report.depsStable = JSON.stringify(before.deps) === JSON.stringify(after.deps)
    if (!report.sourceStable || !report.depsStable) { setup = true; report.drift = drift(after, expected) }
    if (report.contextCloseFailed) setup = true
    const failed = report.checks.some((c) => c.result !== 'PASS')
    report.result = failed ? 'FAIL' : (setup || report.checks.length === 0) ? 'SETUP_INCOMPLETE' : 'AUTH3_FIXTURE_PASS_NO_BACKEND_OR_NATIVE_PASS'
    code = failed ? 1 : (setup || report.checks.length === 0) ? 2 : 0; report.exit = code; save()
    console.log(JSON.stringify({ status: report.result, run, exit: code, checks: report.checks.length, failed: report.checks.filter((c) => c.result !== 'PASS').length, sourceStable: report.sourceStable, depsStable: report.depsStable, closed: report.closed }))
  }
  return code
}
main().then((code) => { process.exitCode = code }).catch((error) => { console.error((error && error.stack) || error); process.exitCode = 2 })
