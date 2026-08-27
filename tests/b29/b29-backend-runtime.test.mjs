import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import {
  readB29Inputs,
  validateB29BackendRuntime,
  validateB29RuntimeEvidence,
} from '../../scripts/runtime/validate-b29-backend-runtime.mjs';

const root = process.cwd();
const inputs = readB29Inputs(root);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function expectedSchema(serviceId) {
  if (serviceId === 'iam-service') return 'iam_service';
  if (serviceId === 'core-api') return 'legacy_compatibility';
  return inputs.ownerManifest.services.find((service) => service.id === serviceId)?.schema;
}

function buildRuntimeEvidence(overrides = {}) {
  const requestId = 'req-b29-runtime-0001';
  const traceId = 'a'.repeat(32);
  const services = inputs.runtimeManifest.services.map((service, index) => {
    const port = inputs.localPorts.services[service.portKey].port;
    const pid = 42000 + index;
    const version = '2.0.0-b29';
    const javaVersion = '25.0.1';
    const process = {
      pid,
      status: 'RUNNING',
      command: `java -jar ${service.id}.jar --spring.profiles.active=local-real`,
      artifact: `services/${service.id}/target/${service.id}.jar`,
      version,
      jvmVersion: javaVersion,
      profile: service.profile,
      mainClass: service.mainClass,
      port,
      host: '127.0.0.1',
    };
    const isGateway = service.id === 'api-gateway';
    const isFailClosed = inputs.config.persistencePolicy.localRealFailClosedServices.includes(service.id);
    const persistence = isGateway
      ? {
        mode: 'none',
        factSource: 'none',
        domainFactsOwned: false,
        failClosedOnUnavailable: true,
        memoryFactsUsed: false,
        mockUsed: false,
        fallbackUsed: false,
      }
      : isFailClosed
        ? {
        mode: 'fail-closed',
        factSource: 'none',
        connectionStatus: 'VERIFIED',
        mysqlReachable: true,
        ownerSchema: expectedSchema(service.id),
        schemaEvidenceRef: `mysql/${service.id}/owner-schema.json`,
        restartReadBack: true,
        failClosedOnUnavailable: true,
        memoryFactsUsed: false,
        mockUsed: false,
        fallbackUsed: false,
        domainFactsOwned: false,
      }
        : {
        mode: 'jdbc',
        factSource: 'mysql',
        connectionStatus: 'VERIFIED',
        mysqlReachable: true,
        ownerSchema: expectedSchema(service.id),
        schemaEvidenceRef: `mysql/${service.id}/owner-schema.json`,
        restartReadBack: true,
        failClosedOnUnavailable: true,
        memoryFactsUsed: false,
        mockUsed: false,
        fallbackUsed: false,
        ...(service.id === 'core-api'
          ? { ownerType: 'legacy-compatibility', v2DomainFactsWritten: false }
          : {}),
      };
    return {
      id: service.id,
      process,
      portBinding: { host: '127.0.0.1', port, listening: true },
      listening: true,
      health: {
        path: `${service.healthBasePath ?? ''}${service.healthPath}`,
        status: 'UP',
        httpStatus: 200,
        evidenceRef: `health/${service.id}.json`,
      },
      readiness: {
        path: `${service.healthBasePath ?? ''}${service.healthPath}`,
        status: 'UP',
        httpStatus: 200,
        evidenceRef: `readiness/${service.id}.json`,
      },
      liveness: {
        path: service.profile === 'v2'
          ? '/actuator/health/liveness'
          : `${service.healthBasePath ?? ''}${service.healthPath}`,
        status: 'UP',
        httpStatus: 200,
        evidenceRef: `liveness/${service.id}.json`,
      },
      observability: {
        requestId,
        traceId,
        serviceId: service.id,
        serviceVersion: version,
        processId: pid,
        jvmVersion: javaVersion,
        profile: service.profile,
        structuredLog: true,
        logEvidenceRef: `logs/${service.id}.jsonl`,
        propagation: 'W3C',
      },
      persistence,
    };
  });

  return {
    batch: 'B29',
    runId: 'b29-runtime-20260824-0001',
    sourceRevision: 'abc1234-dirty',
    environment: {
      profile: 'local-real',
      host: '127.0.0.1',
      collector: 'external-b29-runtime-runner',
    },
    capturedAt: '2026-08-24T13:00:00.000Z',
    mode: 'local-real',
    status: 'PASS',
    evidenceClass: 'runtime-external',
    provenance: {
      external: true,
      producer: 'external-b29-runtime-runner',
      source: 'executed-local-runtime',
      synthetic: false,
    },
    correlation: {
      requestId,
      traceId,
      propagation: 'W3C',
      serviceIds: inputs.runtimeManifest.services.map((service) => service.id),
    },
    services,
    gateway: {
      externalIngress: {
        serviceId: 'api-gateway',
        host: '127.0.0.1',
        port: 18070,
        path: '/api/v1/learner/profile',
        reachable: true,
        throughGateway: true,
        httpStatus: 401,
        responseHeaders: {
          'X-Request-Id': requestId,
          'X-Trace-Id': traceId,
        },
        evidenceRef: 'gateway/external-ingress.json',
      },
      unauthenticatedProtectedRequest: {
        authenticated: false,
        httpStatus: 401,
        evidenceRef: 'gateway/unauthenticated-401.json',
      },
      directServiceAccess: {
        clientPath: false,
        denied: true,
        evidenceRef: 'gateway/direct-service-boundary.json',
      },
    },
    checks: inputs.config.runtimeGate.requiredEvidenceChecks.map((id) => ({
      id,
      status: 'PASS',
      evidenceRef: `checks/${id}.json`,
    })),
    ...overrides,
  };
}

test('B29 static gate covers 14 processes, fixed ports, readiness and external Gateway policy', () => {
  const result = validateB29BackendRuntime(inputs, { runtimeRequested: false });
  assert.equal(result.result, 'PASS', result.errors.join('\n'));
  assert.equal(result.staticStatus, 'PASS');
  assert.equal(result.runtimeStatus, 'not-requested');
  assert.equal(result.runtimeGate, 'static-only');
  assert.equal(result.runtimeProcessCount, 14);
  assert.equal(result.fixedPortCount, 14);
  assert.equal(result.ownerSchemaCount, 11);
  assert.equal(result.execution.dockerInvoked, false);
  assert.equal(result.execution.databaseWritten, false);
});

test('B29 static gate rejects port drift, duplicate ports and persistence-policy widening', () => {
  const drift = clone(inputs);
  drift.runtimeManifest.services[1].portKey = 'api-gateway';
  const driftResult = validateB29BackendRuntime(drift, { runtimeRequested: false });
  assert.equal(driftResult.result, 'FAIL');
  assert.ok(driftResult.errors.some((error) => error.includes('must use its fixed port')));
  assert.ok(driftResult.errors.some((error) => error.includes('fixed port 18070 must be unique')));

  const widened = clone(inputs);
  widened.config.persistencePolicy.inMemoryFactsAllowed = true;
  const widenedResult = validateB29BackendRuntime(widened, { runtimeRequested: false });
  assert.equal(widenedResult.result, 'FAIL');
  assert.ok(widenedResult.errors.some((error) => error.includes('in-memory facts must be forbidden')));
});

test('B29 runtime gate fails closed when external evidence is missing', () => {
  const result = validateB29BackendRuntime(inputs, {
    runtimeRequested: true,
    env: {},
  });
  assert.equal(result.result, 'FAIL');
  assert.equal(result.staticStatus, 'PASS');
  assert.equal(result.runtimeStatus, 'blocked');
  assert.equal(result.runtimeGate, 'blocked');
  assert.ok(result.errors.some((error) => error.includes('B29_RUNTIME_EVIDENCE_FILE')));
  assert.equal(result.runtimeChecks.length, 0);
  assert.equal(result.execution.dockerInvoked, false);
  assert.equal(result.execution.databaseConnected, false);
  assert.equal(result.execution.runtimeEvidenceWritten, false);
});

test('B29 accepts a complete external runtime evidence set and consumes it without generating evidence', () => {
  const evidence = buildRuntimeEvidence();
  const directValidation = validateB29RuntimeEvidence(inputs, evidence);
  assert.equal(directValidation.result, 'PASS', directValidation.errors.join('\n'));
  assert.equal(directValidation.runtimeProcessCount, 14);
  assert.equal(directValidation.fixedPortCount, 14);

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'b29-runtime-evidence-'));
  try {
    const evidencePath = path.join(tempRoot, 'evidence', 'b29', 'external.json');
    fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
    fs.writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
    const runtimeInputs = { ...inputs, root: tempRoot };
    const result = validateB29BackendRuntime(runtimeInputs, {
      runtimeRequested: true,
      env: { B29_RUNTIME_EVIDENCE_FILE: 'evidence/b29/external.json' },
    });
    assert.equal(result.result, 'PASS', result.errors.join('\n'));
    assert.equal(result.runtimeStatus, 'PASS');
    assert.equal(result.runtimeGate, 'runtime-verified');
    assert.equal(result.evidenceRunId, evidence.runId);
    assert.equal(result.execution.runtimeEvidenceWritten, false);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('B29 runtime evidence rejects memory facts, missing observability and non-external producers', () => {
  const memoryEvidence = buildRuntimeEvidence();
  memoryEvidence.services.find((service) => service.id === 'content-service').persistence.mode = 'memory';
  memoryEvidence.services.find((service) => service.id === 'content-service').persistence.memoryFactsUsed = true;
  const memoryResult = validateB29RuntimeEvidence(inputs, memoryEvidence);
  assert.equal(memoryResult.result, 'FAIL');
  assert.ok(memoryResult.errors.some((error) => error.includes('content-service persistence.mode')));
  assert.ok(memoryResult.errors.some((error) => error.includes('memoryFactsUsed')));

  const observationEvidence = buildRuntimeEvidence();
  delete observationEvidence.services[0].observability.traceId;
  const observationResult = validateB29RuntimeEvidence(inputs, observationEvidence);
  assert.equal(observationResult.result, 'FAIL');
  assert.ok(observationResult.errors.some((error) => error.includes('observability 缺少 traceId')));

  const validatorEvidence = buildRuntimeEvidence();
  validatorEvidence.provenance.producer = 'b29-validator';
  const validatorResult = validateB29RuntimeEvidence(inputs, validatorEvidence);
  assert.equal(validatorResult.result, 'FAIL');
  assert.ok(validatorResult.errors.some((error) => error.includes('不能是 B29')));
});

test('B29 runtime evidence rejects path traversal and static-only evidence labels', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'b29-runtime-boundary-'));
  try {
    const outsidePath = path.join(tempRoot, 'outside.json');
    fs.writeFileSync(outsidePath, '{}', 'utf8');
    const runtimeInputs = { ...inputs, root: tempRoot };
    const traversal = validateB29BackendRuntime(runtimeInputs, {
      runtimeRequested: true,
      env: { B29_RUNTIME_EVIDENCE_FILE: '../outside.json' },
    });
    assert.equal(traversal.result, 'FAIL');
    assert.ok(traversal.errors.some((error) => error.includes('拒绝越界证据')));

    const staticEvidence = buildRuntimeEvidence();
    staticEvidence.provenance.source = 'static-only';
    const staticResult = validateB29RuntimeEvidence(inputs, staticEvidence);
    assert.equal(staticResult.result, 'FAIL');
    assert.ok(staticResult.errors.some((error) => error.includes('provenance.source')));
    staticEvidence.provenance.source = 'executed-local-runtime';
    staticEvidence.staticOnly = true;
    const promotedResult = validateB29RuntimeEvidence(inputs, staticEvidence);
    assert.equal(promotedResult.result, 'FAIL');
    assert.ok(promotedResult.errors.some((error) => error.includes('static/mock/fake')));
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('B29 static CLI is read-only and rejects ambiguous runtime mode flags', () => {
  const staticRun = spawnSync(process.execPath, [
    path.join(root, 'scripts/runtime/validate-b29-backend-runtime.mjs'),
    '--static-only',
  ], { cwd: root, encoding: 'utf8', windowsHide: true });
  assert.equal(staticRun.status, 0, `${staticRun.stdout}\n${staticRun.stderr}`);
  assert.match(staticRun.stdout, /B29 backend runtime validation passed \(static\)/);
  assert.doesNotMatch(`${staticRun.stdout}\n${staticRun.stderr}`, /docker compose.*\b(up|down|restart)\b/i);
  assert.doesNotMatch(`${staticRun.stdout}\n${staticRun.stderr}`, /DROP DATABASE|TRUNCATE TABLE|CREATE DATABASE/i);

  const ambiguousRun = spawnSync(process.execPath, [
    path.join(root, 'scripts/runtime/validate-b29-backend-runtime.mjs'),
    '--static-only',
    '--require-runtime',
  ], { cwd: root, encoding: 'utf8', windowsHide: true });
  assert.equal(ambiguousRun.status, 2);
  assert.match(`${ambiguousRun.stdout}\n${ambiguousRun.stderr}`, /Usage:/);
});
