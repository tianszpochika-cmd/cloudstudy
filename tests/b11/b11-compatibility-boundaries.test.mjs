import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const adapterPath = path.join(root, 'services/core-api/src/main/java/com/englishflow/modules/learning/b11/B11MediaOfflineCompatibilityAdapter.java');
const smokePath = path.join(root, 'services/core-api/src/test/java/com/englishflow/modules/learning/b11/B11MediaOfflineCompatibilityAdapterSmoke.java');

test('B11 compatibility stays read-only, hash-based and fail-closed', () => {
  assert.ok(fs.existsSync(adapterPath));
  assert.ok(fs.existsSync(smokePath));
  const source = fs.readFileSync(adapterPath, 'utf8');
  assert.match(source, /domainFactsUntouched/);
  assert.match(source, /B11_MEDIA_UNAUTHORIZED|B11_MEDIA_REVOKED/);
  assert.match(source, /MigrationStatus\.FALLBACK/);
  assert.doesNotMatch(source, /rawAudio|audioBytes|recordingBytes|answerText|tokenText|objectKey|payload/i);
});
