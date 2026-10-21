// Import-only shape audit. NO browser, NO page, NO network. Catches driver/case
// wiring and fixture-extension mistakes that node --check cannot.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const lib = require('./states-lib.cjs');
const fixture = require('./fixture.cjs');

const driver = fs.readFileSync(path.join(__dirname, 'states-verify.cjs'), 'utf8');
const fixtureSource = fs.readFileSync(path.join(__dirname, 'fixture.cjs'), 'utf8');
const checks = [];
function check(name, ok, detail) { checks.push({ name, result: ok ? 'PASS' : 'FAIL', ...(detail === undefined ? {} : { detail }) }); }

check('case-ids-exactly-four', lib.CASE_IDS.length === 4, { ids: lib.CASE_IDS });
check('driver-registers-each-case', lib.CASE_IDS.every((id) => driver.includes(`'${id}':`)), { ids: lib.CASE_IDS });
check('driver-preflight-before-fixture', driver.indexOf('const config = lib.preflight()') < driver.indexOf("const f = require('./fixture.cjs')"));
check('driver-exit-codes-documented', /0 non-empty executed PASS/.test(driver) && /1 measured FAIL/.test(driver) && /2 setup\/refusal\/drift/.test(driver));
check('fixture-exports-required', ['fresh', 'init', 'close', 'hash', 'hashes', 'freeze', 'frozen'].every((key) => key in fixture), { keys: Object.keys(fixture) });
check('fixture-console-warnings-array', Array.isArray(fixture.report.consoleWarnings));
check('fixture-skipped-reads-array', Array.isArray(fixture.report.skippedReads));
check('fixture-refresh-status-present', fixtureSource.includes('refreshStatus') && fixtureSource.includes("injected('refreshStatus'"));
check('fixture-skipped-projection-no-report-id', /function skippedProjection[\s\S]{0,700}currentItem: null/.test(fixtureSource) && /function skippedProjection[\s\S]{0,700}finalResult: \{ resultKind: 'SKIPPED' \}/.test(fixtureSource));
check('fixture-unknown-route-501-retained', fixtureSource.includes('status = 501') && fixtureSource.includes('report.unexpected.push'));
check('driver-no-storage-or-token-injection', !/localStorage|sessionStorage|Authorization|setItem|addInitScript|document\.cookie/i.test(driver));
check('helper-no-default-page-hash', !/719cc0ce/.test(fs.readFileSync(path.join(__dirname, 'states-lib.cjs'), 'utf8')));
check('helper-has-source-and-dependency-before-after', /sourceHashesBefore/.test(fs.readFileSync(path.join(__dirname, 'states-lib.cjs'), 'utf8')) && /dependenciesStable/.test(fs.readFileSync(path.join(__dirname, 'states-lib.cjs'), 'utf8')));

const syntheticConsole = {
  pageErrors: [],
  consoleWarnings: [{ id: 1, message: 'planned warning', path: null }],
  consoleErrors: [
    { id: 1, message: 'Failed to load resource: the server responded with a status of 401 (Unauthorized)', path: '/api/v1/auth/token/refresh' },
    { id: 1, message: 'Failed to load resource: the server responded with a status of 501 (Not Implemented)', path: '/api/v1/unexpected/route' },
  ],
  injectedFailures: [{ id: 1, method: 'POST', path: '/api/v1/auth/token/refresh', status: 401, injection: 'refreshStatus' }],
};
const classified = lib.caseErrors(syntheticConsole, 1);
check('console-classifier-keeps-unknown-501', classified.consoleErrors.length === 1 && /501/.test(classified.consoleErrors[0].message) && classified.consoleWarnings.length === 1, { kept: classified.consoleErrors, excluded: classified.excluded, warnings: classified.consoleWarnings });

const failClass = lib.classifyRun({ measuredFail: true, setup: false, totalChecks: 1 });
const setupClass = lib.classifyRun({ measuredFail: false, setup: true, totalChecks: 1 });
const passClass = lib.classifyRun({ measuredFail: false, setup: false, totalChecks: 1 });
const emptyClass = lib.classifyRun({ measuredFail: false, setup: false, totalChecks: 0 });
check('classify-executed-fail-is-FAIL-exit1', failClass.result === 'FAIL' && failClass.code === 1, { failClass });
check('classify-real-setup-is-SETUP-exit2', setupClass.result === 'SETUP_INCOMPLETE' && setupClass.code === 2, { setupClass });
check('classify-nonempty-pass-is-PASS-exit0', passClass.result === 'PASS_EXECUTED_CHECKS' && passClass.code === 0, { passClass });
check('classify-empty-is-SETUP-exit2', emptyClass.result === 'SETUP_INCOMPLETE' && emptyClass.code === 2, { emptyClass });
check('driver-attach-uses-report-not-module', !/attachFixture\(f\s*,/.test(driver) && /attachFixture\(fixtureModule\.report/.test(driver) && /function finishCase/.test(driver));
check('driver-has-generic-transport-audit', /reporter\.auditTransport\(fixtureModule\.report/.test(driver));

const failed = checks.filter((c) => c.result !== 'PASS');
console.log(JSON.stringify({ audit: 'MB006_STATES_IMPORT_ONLY_SHAPE', result: failed.length ? 'FAIL' : 'PASS', checks, failed }, null, 2));
process.exitCode = failed.length ? 1 : 0;
