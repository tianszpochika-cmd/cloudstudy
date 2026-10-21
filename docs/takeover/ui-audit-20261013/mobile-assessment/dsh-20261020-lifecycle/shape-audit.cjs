// Import-only helper shape audit. No browser, no page, no network, no writes outside
// this audit's stdout. Catches the class of defect that node --check cannot:
// a driver calling an item method that fixture.cjs does not expose.
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const dir = __dirname;
const read = (name) => fs.readFileSync(path.join(dir, name), 'utf8');
const fixture = require('./fixture.cjs');
const lib = require('./lifecycle-lib.cjs');

const checks = [];
function check(name, ok, detail) {
  checks.push({ name, result: ok ? 'PASS' : 'FAIL', ...(detail === undefined ? {} : { detail }) });
}

const fixtureSource = read('fixture.cjs');
const driverSource = read('lifecycle-get.cjs');
const libSource = read('lifecycle-lib.cjs');

const exportsWanted = ['BASE', 'sources', 'report', 'hash', 'hashes', 'freeze', 'frozen', 'init', 'close', 'fresh'];
check('fixture-exports-required-helpers', exportsWanted.every((key) => key in fixture), { missing: exportsWanted.filter((key) => !(key in fixture)) });

const itemStart = fixtureSource.indexOf('const item = {');
const itemEnd = fixtureSource.indexOf('live.add(item)');
const itemBlock = itemStart >= 0 && itemEnd > itemStart ? fixtureSource.slice(itemStart, itemEnd) : '';
function topLevelKeys(block) {
  // Split the item literal on depth-0 commas, then take the key of each segment.
  // Handles shorthand keys (page, state, release, hold) as well as key: value forms.
  let s = block.replace(/const item = \{/, '').replace(/\};\s*$/, '').replace(/\/\/[^\n]*/g, '');
  const parts = [];
  let depth = 0, quote = null, cur = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quote) { cur += ch; if (ch === quote && s[i - 1] !== '\\') quote = null; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; cur += ch; continue; }
    if ('{[('.includes(ch)) depth++;
    if ('}])'.includes(ch)) depth--;
    if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) parts.push(cur);
  const keys = [];
  for (const part of parts) {
    const m = part.trim().match(/^([A-Za-z_$][\w$]*)\s*(?::|$)/);
    if (m) keys.push(m[1]);
  }
  return keys;
}
const itemKeys = topLevelKeys(itemBlock);
check('fixture-item-block-found', itemBlock.length > 0 && itemKeys.length > 0, { itemKeys });
for (const required of ['page', 'state', 'projection', 'release', 'hold', 'pending', 'login', 'close']) {
  check('fixture-item-has-' + required, itemKeys.includes(required), { itemKeys });
}

const calls = [...driverSource.matchAll(/current\.([A-Za-z_$][\w$]*)\s*\(/g)].map((m) => m[1]);
const uniqueCalls = [...new Set(calls)];
check('driver-item-calls-nonempty', uniqueCalls.length > 0, { uniqueCalls });
for (const name of uniqueCalls) check('driver-call-exists-on-item-' + name, itemKeys.includes(name), { call: name, itemKeys });

check('no-state-pending-misuse', !/\.state\.pending\s*\(/.test(driverSource), { matches: (driverSource.match(/\.state\.pending\s*\(/g) || []).length });
check('driver-uses-item-pending', /current\.pending\s*\(/.test(driverSource));

const freeze = lib.verifyFreeze();
check('source-freeze-8-and-matching', freeze.ok && Object.keys(freeze.actual).length === 8, { ok: freeze.ok, files: Object.keys(freeze.actual), drift: freeze.drift });

check('lib-execute-assigns-outcome-and-returns', /outcome = \{ code, report \}/.test(libSource) && /return outcome;/.test(libSource) && !/return \{ code, report \};/.test(libSource));
check('driver-aggregates-explicit-exit', /process\.exitCode = worst/.test(driverSource) && /PASS_EXECUTED_CHECKS/.test(driverSource) && /code = 2/.test(driverSource));
check('driver-catches-runner-error', /catch \(error\)[\s\S]{0,200}code = 2/.test(driverSource));

const failed = checks.filter((c) => c.result === 'FAIL');
const result = failed.length === 0 ? 'PASS' : 'FAIL';
console.log(JSON.stringify({ audit: 'MB006_LIFECYCLE_HELPER_SHAPE_IMPORT_ONLY', result, checks, failed }, null, 2));
process.exitCode = result === 'PASS' ? 0 : 1;
