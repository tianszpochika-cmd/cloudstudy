import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '../..');
const seedPath = path.join(root, 'scripts/database/seed-local-real-learning-world.mjs');
const cleanupPath = path.join(root, 'scripts/database/unpublish-local-placeholder-site-facets.mjs');
const coveragePath = path.join(root, 'scripts/database/check-local-real-data-coverage.mjs');
const contractPath = path.join(root, 'packages/contracts/fragments/b9/b9-content.openapi.json');

test('B9 contract requires a public HTTPS URL only for available download channels', () => {
  const contract = JSON.parse(readFileSync(contractPath, 'utf8'));
  const schema = contract.components.schemas.B9DownloadChannel;
  const available = schema.oneOf.find((variant) => variant.title === 'AvailableDownloadChannel');
  const unavailable = schema.oneOf.find((variant) => variant.title === 'UnavailableDownloadChannel');

  assert.ok(available.required.includes('downloadUrl'));
  assert.ok(!unavailable.required.includes('downloadUrl'));
  assert.equal(schema.properties.downloadUrl.pattern, '^https://');
  assert.equal(schema.properties.downloadUrl['x-public-target-validation'].rejectLocalOrPrivateTargets, true);
  assert.equal(schema.properties.downloadUrl['x-public-target-validation'].publisherMustVerifyDnsResolvesOnlyToPublicAddresses, true);
});

test('local site seed does not claim an unverified Web URL or publish unapproved notices', () => {
  const seed = readFileSync(seedPath, 'utf8');

  for (const locale of ['zh-CN', 'en-US']) {
    assert.match(seed, new RegExp(`\\('download-learner-web', '${locale}', 'DOWNLOAD', 'PUBLISHED',[\\s\\S]*?'status', 'UNAVAILABLE'\\)`));
    assert.match(seed, new RegExp(`\\('compliance-privacy-data', '${locale}', 'COMPLIANCE', 'UNPUBLISHED'`));
    assert.match(seed, new RegExp(`\\('compliance-adult-phase-boundary', '${locale}', 'COMPLIANCE', 'UNPUBLISHED'`));
  }
  assert.doesNotMatch(seed, /downloadUrl'\s*,\s*'http:\/\/(?:127\.|localhost)/i);
});

test('site-facet cleanup safely downgrades only the known local placeholders', () => {
  const cleanup = readFileSync(cleanupPath, 'utf8');
  assert.match(cleanup, /compliance-privacy-data/);
  assert.match(cleanup, /compliance-adult-phase-boundary/);
  assert.match(cleanup, /download-learner-web/);
  assert.match(cleanup, /JSON_REMOVE\(JSON_SET\(payload_json, '\$\.status', 'UNAVAILABLE'\), '\$\.downloadUrl'\)/);
  assert.match(cleanup, /const apply = process\.argv\.includes\('--apply'\)/);
  assert.match(cleanup, /if \(!apply \|\| before\.length === 0\) process\.exit\(0\)/);
});

test('local data coverage checks the unavailable Web fact and unpublished seed notices', () => {
  const coverage = readFileSync(coveragePath, 'utf8');
  assert.match(coverage, /content\.public-site-web-unavailable/);
  assert.match(coverage, /content\.public-site-unapproved-facts/);
  assert.match(coverage, /content\.public-site-unapproved-facts=\$\{unapprovedPublicSiteFacts\} > 0/);
});
