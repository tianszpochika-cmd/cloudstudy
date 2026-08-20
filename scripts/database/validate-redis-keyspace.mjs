import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..', '..');
const registryPath = path.join(repoRoot, 'database', 'redis', 'keyspace.registry.json');
const fixturePath = path.join(repoRoot, 'tests', 'fixtures', 'redis-keyspace.fixture.json');

const fail = (message) => { throw new Error(message); };
const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const registry = readJson(registryPath);
const fixture = readJson(fixturePath);
const entries = registry.entries;
const byId = new Map();
const literalSegmentPattern = new RegExp(registry.globalRules.literalSegmentPattern);
const parameterPattern = /^\{([a-z][A-Za-z0-9]*)\}$/;
const forbiddenRawNames = /(phone|email|token|apikey|api_key|secret|password|audio|rawip|devicefingerprint)/i;
const forbiddenPayloadFieldNames = /(answer|raw|private|note|secret|token|email|phone|ip|audio|credential|key|original|screen|capture|fingerprint|signed|transaction|renewal|payment)/i;
const allowedRedisTypes = new Set(['string', 'hash', 'set', 'zset', 'list', 'stream']);
const allowedTtlKinds = new Set(['fixed', 'sliding', 'remaining_lifetime']);
const allowedFailModes = new Set(['open_read_only', 'read_only', 'closed', 'closed_for_writes', 'closed_for_side_effects', 'closed_no_new_lease']);

if (registry.schemaVersion !== 'redis.keyspace.v1') fail('schemaVersion must be redis.keyspace.v1');
if (!registry.globalRules.allKeysMustExpire) fail('all Redis keys must have an expiry policy');
if (!Array.isArray(entries) || entries.length < 20) fail('registry must contain at least 20 entries');

const parseTemplate = (template) => {
  if (typeof template !== 'string' || template.length === 0 || template.length > registry.globalRules.keyMaxLength) fail(`invalid keyTemplate: ${template}`);
  if (/\s|\/|\\|\.\.|\$|\*/.test(template)) fail(`unsafe characters in keyTemplate: ${template}`);
  const segments = template.split(':');
  if (segments.some((segment) => segment.length === 0)) fail(`empty key segment in ${template}`);
  const placeholders = [];
  for (const segment of segments) {
    const match = segment.match(parameterPattern);
    if (match) placeholders.push(match[1]);
    else if (!literalSegmentPattern.test(segment) && !/^\d+[smhd]$/.test(segment)) fail(`invalid literal key segment '${segment}' in ${template}`);
  }
  if (new Set(placeholders).size !== placeholders.length) fail(`duplicate template parameter in ${template}`);
  return placeholders;
};

const validateTtl = (entry) => {
  const { ttl } = entry;
  if (!ttl || !allowedTtlKinds.has(ttl.kind)) fail(`${entry.id}: invalid ttl.kind`);
  const seconds = ttl.seconds ?? ttl.maxSeconds;
  if (!Number.isInteger(seconds) || seconds <= 0) fail(`${entry.id}: ttl seconds must be a positive integer`);
  if (ttl.kind === 'remaining_lifetime' && ttl.maxSeconds > 7200) fail(`${entry.id}: remaining lifetime exceeds Access token maximum`);
  if (entry.eviction?.policy === 'noeviction' || entry.eviction?.mustHaveTtl === false) fail(`${entry.id}: persistent/no-expiry eviction is forbidden`);
};

const validateSecurity = (entry, parameterNames) => {
  if (!entry.security || entry.security.rawSensitiveAllowed !== false) fail(`${entry.id}: rawSensitiveAllowed must be false`);
  if (!allowedFailModes.has(entry.security.failMode)) fail(`${entry.id}: invalid failMode`);
  for (const parameter of entry.parameters) {
    if (forbiddenRawNames.test(parameter.name) && !/(hash|id)$/i.test(parameter.name)) fail(`${entry.id}: raw-sensitive parameter name '${parameter.name}' is forbidden`);
    if (parameter.rawSensitiveAllowed !== false) fail(`${entry.id}.${parameter.name}: rawSensitiveAllowed must be false`);
  }
  for (const field of entry.security.forbiddenPayloadFields ?? []) {
    if (!forbiddenPayloadFieldNames.test(field)) fail(`${entry.id}: forbiddenPayloadFields must name sensitive fields`);
  }
  if (parameterNames.length !== entry.parameters.length) fail(`${entry.id}: parameter list/template mismatch`);
};

for (const entry of entries) {
  if (!entry.id || byId.has(entry.id)) fail(`duplicate/missing entry id: ${entry.id}`);
  byId.set(entry.id, entry);
  const templateParameters = parseTemplate(entry.keyTemplate);
  if (!allowedRedisTypes.has(entry.redisType)) fail(`${entry.id}: invalid redisType`);
  if (!entry.owner || !entry.purpose || !entry.sourceOfTruth || !Array.isArray(entry.sourceRefs) || entry.sourceRefs.length === 0) fail(`${entry.id}: missing ownership/source metadata`);
  if (entry.rebuildable !== true) fail(`${entry.id}: Redis entry must be rebuildable`);
  if (!Array.isArray(entry.parameters)) fail(`${entry.id}: parameters must be an array`);
  const parameterNames = entry.parameters.map((parameter) => parameter.name);
  if (new Set(parameterNames).size !== parameterNames.length || templateParameters.some((name) => !parameterNames.includes(name)) || parameterNames.some((name) => !templateParameters.includes(name))) fail(`${entry.id}: template parameters must exactly match metadata`);
  validateTtl(entry);
  validateSecurity(entry, parameterNames);
  if (!entry.eviction?.policy || !entry.atomicity?.strategy || !Array.isArray(entry.atomicity.operations)) fail(`${entry.id}: eviction and atomicity metadata are required`);
  if (/lock|lease/i.test(entry.id) && !/set_nx|lua|compare/i.test(entry.atomicity.strategy)) fail(`${entry.id}: lock/lease must use an atomic mutual-exclusion strategy`);
  if (/rate/i.test(entry.id) && !/counter|atomic/i.test(entry.atomicity.strategy)) fail(`${entry.id}: rate key must use atomic counter semantics`);
  if (/dedupe|idempotency/i.test(entry.id) && !/nx|unique|dedupe/i.test(entry.atomicity.strategy)) fail(`${entry.id}: dedupe/idempotency key must use SET NX or durable unique semantics`);
  for (const alias of entry.aliases ?? []) parseTemplate(alias);
}

const render = (template, values, entryId) => template.replace(/\{([a-z][A-Za-z0-9]*)\}/g, (_, name) => {
  if (!(name in values)) fail(`${entryId}: fixture missing value for ${name}`);
  const value = String(values[name]);
  if (!value || /\s|\/|\\|\.\.|\$|\*/.test(value)) fail(`${entryId}: unsafe fixture value for ${name}`);
  if (forbiddenRawNames.test(name) && !/(hash|id)$/i.test(name)) fail(`${entryId}: fixture uses raw-sensitive parameter ${name}`);
  return value;
});

if (fixture.registry !== 'database/redis/keyspace.registry.json' || !Array.isArray(fixture.samples)) fail('fixture metadata is invalid');
for (const sample of fixture.samples) {
  const entry = byId.get(sample.entryId);
  if (!entry) fail(`fixture references unknown entry ${sample.entryId}`);
  const key = render(entry.keyTemplate, sample.values, sample.entryId);
  if (key.length > registry.globalRules.keyMaxLength || key.split(':').some((segment) => segment.length === 0)) fail(`${sample.entryId}: rendered key is invalid`);
  if (/[A-Z]/.test(key.split(':').filter((segment) => !segment.includes('test_')).join(':'))) fail(`${sample.entryId}: literal key naming must be lowercase`);
}

console.log(`Redis keyspace validation passed: ${entries.length} entries, ${fixture.samples.length} synthetic samples, Redis ${registry.redisVersion}.`);
