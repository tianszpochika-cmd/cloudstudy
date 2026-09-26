import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const b3 = JSON.parse(fs.readFileSync(
  path.join(root, 'packages/contracts/fragments/b3-multimodal.openapi.json'), 'utf8'));
const gateway = JSON.parse(fs.readFileSync(
  path.join(root, 'packages/contracts/fragments/p1r-gateway-boundary.openapi.json'), 'utf8'))['x-p1r-gateway-boundary'];

test('B3 grammar points declares its protected content owner and preserves the cursor response contract', () => {
  const operation = b3.paths['/api/v1/grammar/points'].get;
  assert.equal(operation.operationId, 'listB3GrammarPoints');
  assert.deepEqual(operation.security, [{ bearerAuth: [] }]);
  assert.equal(operation['x-owner'], 'content-service');
  assert.equal(operation['x-permission'], 'content.read');
  assert.equal(operation['x-authorization'].requiredPermission, 'content.read');
  assert.equal(operation['x-authorization'].defaultDecision, 'DENY');
  assert.equal(operation['x-authorization'].serviceSidePepRequired, true);
  assert.equal(operation['x-contract'].legacyEligibility, 'CLOSED_UNTIL_CANONICAL_VERSION_BINDING');

  const parameterRefs = operation.parameters.map((parameter) => parameter.$ref).filter(Boolean);
  assert.ok(parameterRefs.includes('#/components/parameters/Cursor'));
  assert.ok(parameterRefs.includes('#/components/parameters/PageSize'));
  assert.deepEqual(operation['x-pagination'], {
    mode: 'cursor',
    cursorParameter: '#/components/parameters/Cursor',
    pageSizeParameter: '#/components/parameters/PageSize',
    responseMeta: '#/components/schemas/ApiCursorPageMeta',
  });

  const response = operation.responses['200'].content['application/json'].schema;
  assert.ok(response.allOf.some((part) => part.$ref === '#/components/schemas/ApiCursorPageEnvelope'));
  const data = response.allOf.find((part) => part.properties?.data)?.properties.data;
  assert.equal(data.type, 'object');
  assert.equal(data.additionalProperties, true);
  assert.equal(data.required, undefined);
  assert.deepEqual(Object.keys(operation.responses), ['200']);
});

test('Gateway exact GET projection is content-owned while the broad assessment grammar rule remains unchanged', () => {
  const exact = gateway.routeRules.find((rule) => rule.ruleId === 'grammar-points-read');
  assert.ok(exact);
  assert.deepEqual(exact.match, {
    type: 'EXACT',
    path: '/api/v1/grammar/points',
    methods: ['GET'],
  });
  assert.equal(exact.priority, 850);
  assert.equal(exact.upstreamOwner, 'content-service');
  assert.equal(exact.authClass, 'AUTHENTICATED_READ');

  const broad = gateway.routeRules.find((rule) => rule.ruleId === 'grammar-domain');
  assert.deepEqual(broad.match, {
    type: 'PREFIX',
    path: '/api/v1/grammar',
    methods: ['GET', 'POST'],
  });
  assert.equal(broad.upstreamOwner, 'assessment-service');
  assert.equal(broad.authClass, 'AUTHENTICATED_WRITE');

  const execution = gateway.routeExecutions.find((entry) => entry.ruleId === 'grammar-points-read');
  assert.equal(execution.defaultStatus, 'UNAVAILABLE');
  assert.equal(execution.projections.length, 1);
  assert.deepEqual(execution.projections[0], {
    projectionId: 'grammar-points-read.list',
    status: 'AVAILABLE',
    publicPathTemplate: '/api/v1/grammar/points',
    methods: ['GET'],
    executionKind: 'UPSTREAM',
    upstreamOwner: 'content-service',
    targetUriConfig: 'gateway.b14.service-base-urls.content',
    pathStrategy: 'REWRITE_PATH',
    targetPathTemplate: '/internal/v1/content/learner/grammar/points',
    controllerEvidence: {
      sourcePath: 'services/content-service/src/main/java/com/englishflow/content/web/B3ContentJdbcController.java',
      requestMapping: '/internal/v1/content/learner',
    },
  });
  assert.deepEqual(gateway.routeExecutions.find((entry) => entry.ruleId === 'grammar-domain').projections, []);
});

test('learner Web and mobile callers use the contracted pageSize parameter for grammar points', () => {
  const callers = [
    ['apps/learner-web/src/api/b3.ts', /\/grammar\/points\?pageSize=20/u],
    ['apps/mobile/src/api/b3.ts', /\/grammar\/points\?pageSize=20/u],
    ['apps/learner-web/src/api/b10.ts', /grammarPoints\}\$\{query\(\{ pageSize: 50 \}\)\}/u],
    ['apps/mobile/src/api/b10.ts', /grammarPoints, \{ pageSize: 50 \}\)/u],
  ];
  for (const [relative, pattern] of callers) {
    const source = fs.readFileSync(path.join(root, relative), 'utf8');
    assert.match(source, pattern, `${relative} must use the canonical pageSize query`);
  }
  const mobile = fs.readFileSync(path.join(root, 'apps/mobile/src/api/b10.ts'), 'utf8');
  const method = mobile.match(/async listGrammarPoints\(context: B10RequestContext\): Promise<B10GrammarPoint\[\]> \{([\s\S]*?)\n  \},/u)?.[1];
  assert.ok(method);
  assert.doesNotMatch(method, /contentLocale/u, 'grammar points currently has no locale parameter in its contract');
});
