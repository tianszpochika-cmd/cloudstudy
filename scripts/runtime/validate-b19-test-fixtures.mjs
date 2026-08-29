import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(scriptDir, '..', '..');
export const fixturePath = path.join(repoRoot, 'config', 'b19-test-fixtures.json');

const forbiddenFixtureKeys = /^(password|secret|token|authorization|privateKey|clientSecret|credential)$/i;

function fail(message) {
  throw new Error(`[b19-fixtures] ${message}`);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    fail(`cannot read JSON ${filePath}: ${error.message}`);
  }
}

function walk(value, visitor, location = '$') {
  visitor(value, location);
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) walk(child, visitor, `${location}.${key}`);
}

function validateNoFixtureSecrets(value) {
  walk(value, (current, location) => {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return;
    for (const [key, child] of Object.entries(current)) {
      assert(!forbiddenFixtureKeys.test(key), `${location}.${key} must not contain credentials`);
      if (typeof child === 'string') {
        assert(!/^Bearer\s|^sk-|^eyJ[A-Za-z0-9_-]+\./.test(child), `${location}.${key} looks like a credential`);
      }
    }
  });
}

export function loadB19Fixtures(rootDirectory = repoRoot) {
  return readJson(path.join(rootDirectory, 'config', 'b19-test-fixtures.json'));
}

export function validateB19Fixtures({ rootDirectory = repoRoot } = {}) {
  const fixture = loadB19Fixtures(rootDirectory);
  assert(fixture.version === '1.0.0', 'version must be 1.0.0');
  assert(fixture.phase === 'phase-1', 'fixtures must stay in phase-1');
  assert(fixture.mode === 'static-and-synthetic', 'mode must be static-and-synthetic');

  const gate = fixture.runtimeGate;
  assert(gate?.staticOnlyByDefault === true, 'runtime gate must be static-only by default');
  assert(gate.requireRuntimeEnv === 'B19_REQUIRE_RUNTIME', 'runtime request env is not fixed');
  assert(gate.strictContractEnv === 'B19_STRICT_CONTRACT_ERRORS', 'strict contract env is not fixed');
  assert(Array.isArray(gate.requiredEnv) && gate.requiredEnv.length >= 4, 'runtime requiredEnv is incomplete');
  assert(new Set(gate.requiredEnv).size === gate.requiredEnv.length, 'runtime requiredEnv contains duplicates');
  for (const name of gate.requiredEnv) assert(/^B19_RUNTIME_[A-Z0-9_]+$/.test(name), `invalid runtime env ${name}`);
  assert(Array.isArray(gate.requiredEvidence) && gate.requiredEvidence.length >= 3, 'runtime evidence list is incomplete');

  const contract = fixture.contract;
  for (const key of ['openApiPath', 'eventCatalogPath', 'schemaRegistryPath', 'generatedOpenApiPath', 'generatedEventsPath', 'generatedClientPath']) {
    assert(typeof contract[key] === 'string' && fs.existsSync(path.join(rootDirectory, contract[key])), `missing contract path ${key}`);
  }
  assert(contract.openApiVersion === '3.0.3', 'OpenAPI version must be 3.0.3');
  assert(contract.apiVersion === '1.0.0', 'API version must be 1.0.0');
  assert(Array.isArray(contract.apiPathPrefixes) && contract.apiPathPrefixes.includes('/api/v1/'), 'API v1 prefix is missing');
  assert(Array.isArray(contract.requiredEventEnvelopeFields) && contract.requiredEventEnvelopeFields.includes('traceId'), 'event traceId requirement is missing');
  assert(Array.isArray(contract.errorEnvelopeSchemas) && contract.errorEnvelopeSchemas.includes(contract.canonicalErrorEnvelope), 'canonical error envelope is missing');

  const journey = fixture.journey;
  assert(JSON.stringify(journey.requiredSteps) === JSON.stringify(['login', 'target', 'learning', 'submit', 'assess', 'review', 'report', 'notification']), 'journey steps are incomplete');
  assert(Array.isArray(journey.expectedEvents) && journey.expectedEvents.length >= journey.requiredSteps.length, 'journey event list is incomplete');
  for (const eventName of [...journey.expectedEvents, journey.compensationEvent, journey.replayEvent]) {
    assert(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+\.v[0-9]+$/.test(eventName), `invalid event name ${eventName}`);
  }
  assert(journey.tenantId === 'platform', 'synthetic tenant must be server-derived platform');
  assert(Array.isArray(fixture.forbiddenClientAuthorityFields), 'forbidden client authority list is missing');
  for (const field of ['tenantId', 'ownerId', 'role', 'permissions', 'score', 'correctAnswer']) assert(fixture.forbiddenClientAuthorityFields.includes(field), `forbidden field ${field} is missing`);
  assert(Array.isArray(fixture.syntheticAccounts) && fixture.syntheticAccounts.length >= 2, 'synthetic accounts are incomplete');
  for (const account of fixture.syntheticAccounts) {
    assert(typeof account.id === 'string' && typeof account.subject === 'string', 'synthetic account identity is incomplete');
    assert(account.authenticationCenter === 'iam-service', 'synthetic account must use the platform IAM authentication center');
  }
  validateNoFixtureSecrets(fixture);
  return { fixture, rootDirectory, fixturePath: path.join(rootDirectory, 'config', 'b19-test-fixtures.json') };
}

export function inspectB19RuntimeGate(fixture, environment = process.env) {
  const missing = fixture.runtimeGate.requiredEnv.filter((name) => !environment[name]);
  return {
    mode: missing.length === 0 ? 'READY_FOR_EXTERNAL_RUNTIME' : 'STATIC_ONLY',
    runtimeRequested: environment[fixture.runtimeGate.requireRuntimeEnv] === '1',
    missing,
    executed: false,
    evidenceRequired: fixture.runtimeGate.requiredEvidence
  };
}

export function requireB19RuntimeGate(fixture, environment = process.env) {
  const gate = inspectB19RuntimeGate(fixture, environment);
  if (gate.missing.length > 0) fail(`runtime gate blocked; missing environment: ${gate.missing.join(', ')}`);
  return gate;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  try {
    const result = validateB19Fixtures();
    const gate = process.argv.includes('--require-runtime')
      ? requireB19RuntimeGate(result.fixture)
      : inspectB19RuntimeGate(result.fixture);
    const output = { fixture: result.fixturePath, status: 'VALID', runtimeGate: gate };
    console.log(process.argv.includes('--json') ? JSON.stringify(output, null, 2) : `B19 fixtures valid; runtimeGate=${gate.mode}; missing=${gate.missing.length}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
