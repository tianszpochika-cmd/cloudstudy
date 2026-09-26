import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

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
      priority: rules.get(entry.ruleId)?.priority,
      matchType: rules.get(entry.ruleId)?.match?.type,
      methods: rules.get(entry.ruleId)?.match?.methods ?? [],
      path: rules.get(entry.ruleId)?.match?.path,
      owner: rules.get(entry.ruleId)?.upstreamOwner,
      reason: entry.defaultReason,
    }))
    .filter((entry) => typeof entry.path === 'string');
}

function availableExactOverrides(withheldRule) {
  const contract = JSON.parse(fs.readFileSync(
    path.join(root, 'packages/contracts/fragments/p1r-gateway-boundary.openapi.json'), 'utf8'));
  const boundary = contract['x-p1r-gateway-boundary'];
  const rules = new Map(boundary.routeRules.map((rule) => [rule.ruleId, rule]));
  return boundary.routeExecutions.flatMap((execution) => {
    const rule = rules.get(execution.ruleId);
    const overlaps = withheldRule.matchType === 'PREFIX'
      ? rule?.match?.path?.startsWith(`${withheldRule.path}/`)
      : rule?.match?.path === withheldRule.path;
    const hasHigherPriority = Number.isInteger(rule?.priority) && rule.priority > withheldRule.priority;
    const sharesMethod = rule?.match?.methods?.some((method) => withheldRule.methods.includes(method));
    if (rule?.match?.type !== 'EXACT' || !overlaps || !hasHigherPriority || !sharesMethod) return [];
    return execution.projections
      .filter((projection) => projection.status === 'AVAILABLE'
        && projection.publicPathTemplate === rule.match.path
        && projection.methods.every((method) => rule.match.methods.includes(method)))
      .map((projection) => projection.publicPathTemplate);
  });
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
  return files.map((file) => {
    const source = { file: path.relative(root, file).replaceAll('\\', '/'), text: fs.readFileSync(file, 'utf8') };
    return { ...source, literals: stringLiterals(source) };
  });
}

function stringLiterals(source) {
  const scripts = source.file.endsWith('.vue')
    ? [...source.text.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gu)].map((match) => match[1])
    : [source.text];
  const literals = [];
  for (const script of scripts) {
    const syntaxTree = ts.createSourceFile(source.file, script, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const visit = (node) => {
      if (ts.isStringLiteralLike(node)) literals.push(node.text);
      if (ts.isTemplateExpression(node)) literals.push(node.head.text);
      ts.forEachChild(node, visit);
    };
    visit(syntaxTree);
  }
  return literals;
}

function callsWithheldRoute(source, routePath, exactOverrides = []) {
  const paths = [routePath];
  // The three app API clients append relative paths to a /api/v1 Gateway base URL.
  // Keep the relative-path check inside API modules to avoid mistaking page routes for requests.
  if (source.file.includes('/src/api/') && routePath.startsWith('/api/v1/')) {
    paths.push(routePath.slice('/api/v1'.length));
  }
  const literals = source.literals ?? stringLiterals(source);
  const isExactOverrideCall = (literal) => exactOverrides.some((override) => {
    const variants = [override];
    if (source.file.includes('/src/api/') && override.startsWith('/api/v1/')) {
      variants.push(override.slice('/api/v1'.length));
    }
    return variants.some((route) => literal === route || literal.startsWith(`${route}?`));
  });
  return literals.some((literal) => !isExactOverrideCall(literal) && paths.some((prefix) =>
    literal === prefix || literal.startsWith(`${prefix}/`) || literal.startsWith(`${prefix}?`)));
}

test('no frontend calls a route the Gateway withholds', () => {
  const withheld = withheldRules();
  assert.ok(withheld.length > 0, 'the fragment must still declare its unavailable executions');
  const sources = handWrittenSources();
  assert.ok(sources.length > 100, 'the scan must actually find the frontend sources');

  const offenders = [];
  for (const entry of withheld) {
    const exactOverrides = availableExactOverrides(entry);
    for (const source of sources) {
      if (callsWithheldRoute(source, entry.path, exactOverrides)) {
        offenders.push(`${source.file} calls ${entry.path} (rule ${entry.ruleId}, owner ${entry.owner}, withheld because ${entry.reason})`);
      }
    }
  }
  assert.deepEqual(offenders, [],
    'a caller of a withheld route gets a 404 for an operation the contract declares; either give the rule a projection or stop calling it');
});

test('withheld-route scan recognizes Gateway-relative API paths without reading comments or page routes', () => {
  assert.equal(callsWithheldRoute({ file: 'apps/learner-web/src/api/b3.ts', text: "apiClient.get('/grammar/points?limit=20')" }, '/api/v1/grammar'), true);
  assert.equal(callsWithheldRoute({ file: 'apps/mobile/src/api/b3.ts', text: 'mobileApiClient.request(`/phonetics/catalog${query}`)' }, '/api/v1/phonetics'), true);
  assert.equal(callsWithheldRoute({ file: 'apps/admin-web/src/api/phonetics.ts', text: '// /api/v1/phonetics is withheld\nadminClient.request(`/phonetics/catalog${query}`)' }, '/api/v1/phonetics'), true);
  assert.equal(callsWithheldRoute({ file: 'apps/learner-web/src/router/index.ts', text: "{ path: '/grammar' }" }, '/api/v1/grammar'), false);
  assert.equal(callsWithheldRoute({ file: 'apps/admin-web/src/api/phonetics.ts', text: '// /api/v1/phonetics is withheld' }, '/api/v1/phonetics'), false);
  assert.equal(callsWithheldRoute({ file: 'apps/learner-web/src/api/b3.ts', text: "apiClient.get('/grammar/points?pageSize=20')" }, '/api/v1/grammar', ['/api/v1/grammar/points']), false);
  assert.equal(callsWithheldRoute({ file: 'apps/learner-web/src/api/b3.ts', text: "apiClient.get('/grammar/points/3101')" }, '/api/v1/grammar', ['/api/v1/grammar/points']), true);
});

test('every withheld rule names why it is withheld', () => {
  for (const entry of withheldRules()) {
    assert.ok(typeof entry.reason === 'string' && entry.reason.length > 0,
      `${entry.ruleId} must record why its execution is unavailable`);
    assert.ok(typeof entry.owner === 'string' && entry.owner.length > 0,
      `${entry.ruleId} must still declare its canonical owner`);
  }
});
