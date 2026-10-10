import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..', '..');
const read = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
const openApi = read('packages/contracts/openapi/v1/openapi.json');
const gateway = read('packages/contracts/fragments/p1r-gateway-boundary.openapi.json');
const iam = fs.readFileSync(path.join(root,
  'services/iam-service/src/main/java/com/englishflow/iam/domain/PasswordAccountService.java'), 'utf8');

// These are the finite assessment-domain Gateway projections whose owner Controller
// currently enforces the learner's verified JWT permission. Canonical paths without
// a projection are deliberately absent from this runtime parity list.
const executable = [
  ['GET', '/api/v1/assessment/placement/start', 'read', false],
  ['POST', '/api/v1/assessment/placement/submit-step', 'write', true],
  ['POST', '/api/v1/assessment/placement/skip', 'write', true],
  ['GET', '/api/v1/assessment/placement/report/{sessionId}', 'read', false],
  ['POST', '/api/v1/assessment/sessions', 'write', true],
  ['GET', '/api/v1/assessment/sessions/{sessionId}', 'read', false],
  ['POST', '/api/v1/assessment/sessions/{sessionId}/attempts', 'write', true],
  ['PUT', '/api/v1/assessment/sessions/{sessionId}/attempts/{attemptId}/checkpoint', 'write', true],
  ['GET', '/api/v1/assessment/reports/{reportId}', 'read', false],
  ['GET', '/api/v1/assessment/mistakes', 'read', false],
  ['POST', '/api/v1/assessment/mistakes/{mistakeId}/variant', 'write', true],
  ['POST', '/api/v1/assessment/mistakes/{mistakeId}/verify', 'write', true],
];

test('12 executable assessment operations agree on owner, JWT permission, and write effect', () => {
  const projections = gateway['x-p1r-gateway-boundary'].routeExecutions.find(
    (rule) => rule.ruleId === 'assessment-domain').projections;
  assert.match(iam, /"assessment\.session\.read"/);
  assert.match(iam, /"assessment\.session\.write"/);
  assert.equal(executable.length, 12);
  const start = projections.find((item) => item.publicPathTemplate === '/api/v1/assessment/placement/start');
  assert.deepEqual(start.methods, ['GET']);
  assert.equal(openApi.paths['/api/v1/assessment/placement/start'].post?.deprecated, true);
  for (const [method, route, access, write] of executable) {
    const operation = openApi.paths[route]?.[method.toLowerCase()];
    assert.ok(operation, `${method} ${route} must exist`);
    assert.equal(operation['x-owner'], 'assessment-service', `${method} ${route} owner`);
    assert.equal(operation['x-contract']?.owner, 'assessment-service', `${method} ${route} contract owner`);
    assert.equal(operation['x-contract']?.write, write, `${method} ${route} write effect`);
    assert.equal(operation['x-authorization']?.requiredPermission,
      `assessment.session.${access}`, `${method} ${route} permission`);
    assert.equal(operation['x-authorization']?.defaultDecision, 'DENY');
    assert.equal(operation['x-authorization']?.serviceSidePepRequired, true);
    const projection = projections.find((item) => item.publicPathTemplate === route);
    assert.ok(projection?.methods.includes(method), `${method} ${route} Gateway projection`);
    assert.equal(projection.upstreamOwner, 'assessment-service');
  }
});

test('daily-stream design/runtime split remains explicit until its read-only adapter is fixed', () => {
  const operation = openApi.paths['/api/v1/assessment/daily-stream'].get;
  const divergence = operation['x-current-runtime-divergence'];
  assert.equal(operation['x-owner'], 'learning-service');
  assert.equal(operation['x-contract']?.write, false);
  assert.equal(divergence?.owner, 'assessment-service');
  assert.equal(divergence?.requiredPermission, 'assessment.session.write');
  assert.equal(divergence?.writesAssessmentSessionOnFirstRead, true);
});
