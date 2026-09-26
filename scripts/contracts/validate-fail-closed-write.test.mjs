import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { validateOpenApi } from './validate-contracts.mjs';

const openApiUrl = new URL('../../packages/contracts/openapi/v1/openapi.json', import.meta.url);
const uploadRoute = '/api/v1/media/assets/{assetId}/upload-url';

function catalog() {
  return JSON.parse(readFileSync(openApiUrl, 'utf8'));
}

test('only the exact media upload failure can omit a write idempotency declaration', () => {
  const document = catalog();
  assert.doesNotThrow(() => validateOpenApi(document));

  const forgedSuccess = catalog();
  forgedSuccess.paths[uploadRoute].post.responses['200'] = { description: 'False success' };
  assert.throws(() => validateOpenApi(forgedSuccess), /without a success response/);

  const forgedReceipt = catalog();
  forgedReceipt.paths[uploadRoute].post['x-idempotency'] = {
    strategy: 'invented', replayBehavior: 'invented',
  };
  assert.throws(() => validateOpenApi(forgedReceipt), /cannot claim durable idempotency/);

  const missingBoundary = catalog();
  delete missingBoundary.paths[uploadRoute].post['x-fail-closed'];
  assert.throws(() => validateOpenApi(missingBoundary), /needs x-idempotency declaration/);

  const widenedException = catalog();
  widenedException.paths['/api/v1/media/assets'].post['x-fail-closed'] =
    widenedException.paths[uploadRoute].post['x-fail-closed'];
  assert.throws(() => validateOpenApi(widenedException), /cannot claim a fail-closed write exception/);
});
