import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

// A route the Gateway withholds fails closed on purpose: the canonical owner and the controller that
// would serve it do not agree yet, so GatewayRouteExecutionPolicy refuses to register it. That is
// correct and harmless while nothing calls the route. It stops being harmless the moment a frontend
// starts calling it, because the caller gets a 404 for an operation the contract says exists. That
// is exactly what happened to the public site projection, which the official site's SSR consumed
// while the route was withheld.
//
// So this is a tripwire, not a freeze: it does not forbid a withheld route from existing, and it
// stops applying to a rule as soon as that rule gains a projection. It fails when a hand-written
// caller appears for a route that cannot yet answer.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function withheldRules() {
  const contract = JSON.parse(fs.readFileSync(
    path.join(root, 'packages/contracts/fragments/p1r-gateway-boundary.openapi.json'), 'utf8'));
  const boundary = contract['x-p1r-gateway-boundary'];
  const rules = new Map(boundary.routeRules.map((rule) => [rule.ruleId, rule]));
  return boundary.routeExecutions
    .filter((entry) => entry.projections.length === 0)
    .map((entry) => ({
      ruleId: entry.ruleId,
      path: rules.get(entry.ruleId)?.match?.path,
      owner: rules.get(entry.ruleId)?.upstreamOwner,
      reason: entry.defaultReason,
    }))
    .filter((entry) => typeof entry.path === 'string');
}

function handWrittenSources() {
  const files = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (['node_modules', '.nuxt', '.output', 'dist', 'generated'].includes(entry.name)) continue;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (/\.(ts|vue|js|mjs)$/u.test(entry.name)) files.push(absolute);
    }
  };
  for (const app of fs.readdirSync(path.join(root, 'apps'))) {
    const directory = path.join(root, 'apps', app);
    if (fs.statSync(directory).isDirectory()) visit(directory);
  }
  for (const shared of ['api-client', 'contracts']) {
    const directory = path.join(root, 'packages', shared, 'src');
    if (fs.existsSync(directory)) visit(directory);
  }
  return files.map((file) => ({ file: path.relative(root, file).replaceAll('\\', '/'), text: fs.readFileSync(file, 'utf8') }));
}

test('no frontend calls a route the Gateway withholds', () => {
  const withheld = withheldRules();
  assert.ok(withheld.length > 0, 'the fragment must still declare its unavailable executions');
  const sources = handWrittenSources();
  assert.ok(sources.length > 100, 'the scan must actually find the frontend sources');

  const offenders = [];
  for (const entry of withheld) {
    for (const source of sources) {
      if (source.text.includes(entry.path)) {
        offenders.push(`${source.file} calls ${entry.path} (rule ${entry.ruleId}, owner ${entry.owner}, withheld because ${entry.reason})`);
      }
    }
  }
  assert.deepEqual(offenders, [],
    'a caller of a withheld route gets a 404 for an operation the contract declares; either give the rule a projection or stop calling it');
});

test('every withheld rule names why it is withheld', () => {
  for (const entry of withheldRules()) {
    assert.ok(typeof entry.reason === 'string' && entry.reason.length > 0,
      `${entry.ruleId} must record why its execution is unavailable`);
    assert.ok(typeof entry.owner === 'string' && entry.owner.length > 0,
      `${entry.ruleId} must still declare its canonical owner`);
  }
});
