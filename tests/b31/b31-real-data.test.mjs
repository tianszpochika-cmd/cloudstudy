import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { repositoryRoot, validateB31Static } from '../../scripts/runtime/b31-static-check.mjs';

test('B31 static boundary closes the admin content command and local-real fail-closed paths', () => {
  const result = validateB31Static(repositoryRoot);
  assert.equal(result.result, 'PASS', result.errors.join('\n'));
});

test('B31 MySQL fixture owner rows are present and repeatable in the running database', () => {
  const result = spawnSync(process.execPath, ['scripts/database/validate-b25-data.mjs', '--mode', 'mysql', '--action', 'summary'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    windowsHide: true,
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /B25 MySQL summary check passed/);
  assert.match(result.stdout, /cnt_b25_item\s+1\s+1/);
  assert.match(result.stdout, /asm_b25_report\s+1\s+1/);
});

test('B31 Gateway denies content and admin writes without a verified session', async () => {
  for (const path of ['/api/v1/content/learner/catalog', '/api/v1/admin/content-commands']) {
    const response = await fetch(`http://127.0.0.1:18070${path}`);
    // Two statuses are both a denial, and which one appears depends on the accepted strangler
    // default rather than on authorization. With B14_STRANGLER_ENABLED false, which is the shipped
    // default and what the accepted M2-001 evidence records as default-owner-route-fail-closed, no
    // canonical route is registered and the path answers 404; with the strangler enabled the route
    // exists and answers 401. Neither may ever be a success, and that is what is asserted.
    assert.ok([401, 404].includes(response.status),
      `${path} must be denied without a token, saw ${response.status}`);
    const body = await response.json();
    assert.ok(body.error?.errorCode, `${path} must return the canonical error envelope`);
    assert.ok(body.meta?.requestId && body.meta?.traceId, `${path} must return correlation ids`);
    if (response.status === 401) assert.equal(body.error.errorCode, 'UNAUTHORIZED');
    else assert.equal(body.error.errorCode, 'NOT_FOUND');
  }
});
