import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { assertMaterialDirectory, defaultMaterialDir, prepareIamTls } from './prepare-iam-tls.mjs';

test('refuses to write TLS material into the repository tree', () => {
  assert.throws(() => assertMaterialDirectory(path.join(process.cwd(), 'scripts', 'redesign', 'r3-local-https')), /refusing/);
  assert.equal(path.basename(defaultMaterialDir()), 'r3-iam-tls');
});

test('generates a loopback certificate and keeps passwords out of public.json', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'r3-iam-tls-'));
  try {
    const first = prepareIamTls({ directory, days: 1 });
    assert.equal(first.created, true);
    assert.match(first.spki, /^[A-Za-z0-9+/]+=*$/);
    const second = prepareIamTls({ directory, days: 1 });
    assert.equal(second.created, false);
    assert.equal(second.spki, first.spki);
    const published = readFileSync(path.join(directory, 'public.json'), 'utf8');
    assert.equal(published.includes(first.keystorePassword), false);
    assert.equal(published.includes(first.truststorePassword), false);
    assert.equal(published.includes('PRIVATE KEY'), false);
    const secret = readFileSync(path.join(directory, 'local.env'), 'utf8');
    assert.match(secret, /^KEYSTORE_PASSWORD=[0-9a-f]+\nTRUSTSTORE_PASSWORD=[0-9a-f]+\n$/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
