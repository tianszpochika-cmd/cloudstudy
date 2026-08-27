import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CONFIG_PATH = path.join(ROOT, 'config', 'b26-journey.json');

function readConfig() {
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

function digest(value) {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 24);
}

function requiredText(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${field} is required`);
  return value.trim();
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function ensureStaticConfig(config) {
  if (config.batch !== 'B26' || config.scope !== 'V2-B26-EVT-003') throw new Error('unexpected B26 journey scope');
  if (config.mode !== 'preview-static' || config.runtimeStatus !== 'pending') throw new Error('B26 journey must remain preview-static and runtime-pending');
  if (config.execution.writesDatabase || config.execution.publishesKafka || config.execution.networkCalls || config.execution.mintsJwt || config.execution.usesProvidedJwt) {
    throw new Error('static preview cannot write, publish, call the network or use a JWT');
  }
  if (config.dataOwnership.allowKafkaRpc || config.eventTransport.rpc || config.eventTransport.requestReply) throw new Error('Kafka RPC is forbidden');
}

function correlationFor({ runId, traceId, step, eventName }) {
  const requestId = `req-b26-${step.id}-${digest(`${runId}:request:${step.id}`)}`;
  const dedupeKey = `b26:evt003:${step.id}:${digest(`${runId}:dedupe:${step.id}`)}`;
  const eventId = eventName ? `evt-b26-preview-${digest(`${traceId}:${eventName}:${step.id}`)}` : null;
  return Object.freeze({
    eventId,
    requestId,
    traceId,
    dedupeKey,
    eventIdStatus: eventName ? 'planned-static-id-not-emitted' : 'not-applicable',
    requestIdStatus: 'preview-static-id-not-sent',
    traceIdStatus: 'preview-static-root-not-sent',
    dedupeKeyStatus: 'preview-static-key-not-recorded'
  });
}

function previewEvent(step, correlation) {
  if (!step.event.required) {
    return Object.freeze({
      required: false,
      name: null,
      address: null,
      eventId: null,
      producerService: step.event.producerService,
      consumerServices: [],
      emissionStatus: 'not-applicable',
      rpc: false
    });
  }
  return Object.freeze({
    required: true,
    name: step.event.name,
    address: step.event.address,
    eventId: correlation.eventId,
    eventIdStatus: 'planned-static-id-not-emitted',
    producerService: step.event.producerService,
    consumerServices: [...step.event.consumerServices],
    outboxTable: step.event.outboxTable,
    emissionStatus: 'planned-not-emitted',
    transport: 'kafka-outbox-at-least-once-runtime-pending',
    rpc: false,
    payloadPolicy: step.event.payloadPolicy
  });
}

function buildStep({ runId, traceId, step }) {
  const eventName = step.event.required ? step.event.name : null;
  const correlation = correlationFor({ runId, traceId, step, eventName });
  const event = previewEvent(step, correlation);
  const api = clone(step.api);
  for (const call of [...(api.gateway ?? []), ...(api.owner ?? [])]) {
    call.requestId = correlation.requestId;
    call.traceId = correlation.traceId;
    call.authorization = 'not-supplied-static-preview';
  }
  return Object.freeze({
    index: step.index,
    id: step.id,
    label: step.label,
    kind: step.kind,
    status: 'preview-only-not-executed',
    owner: clone(step.owner),
    api,
    correlation,
    writeSet: [...step.writeSet],
    readSet: [...step.readSet],
    event,
    secondaryEvent: step.secondaryEvent ? { ...step.secondaryEvent, eventId: `evt-b26-preview-${digest(`${traceId}:${step.secondaryEvent.name}:${step.id}`)}`, eventIdStatus: 'planned-static-id-not-emitted' } : null,
    consumes: step.consumes ? clone(step.consumes) : null,
    reconciliation: clone(step.reconciliation)
  });
}

export function loadB26JourneyConfig() {
  const config = readConfig();
  ensureStaticConfig(config);
  return config;
}

export function createB26JourneyPreview(input = {}) {
  const config = loadB26JourneyConfig();
  if (input.accessToken !== undefined || input.jwt !== undefined || input.authorization !== undefined) {
    throw new Error('B26 static preview rejects supplied JWT or authorization material');
  }
  const runId = input.runId ?? 'run-b26-evt003-preview-001';
  const traceId = input.traceId ?? `trace-b26-evt003-${digest(runId)}`;
  const subjectRef = input.subjectRef ?? 'external-oidc-subject-runtime-only';
  requiredText(runId, 'runId');
  requiredText(traceId, 'traceId');
  requiredText(subjectRef, 'subjectRef');
  const steps = config.steps.map((step) => buildStep({ runId, traceId, step }));
  const eventSteps = steps.filter((step) => step.event.required);
  return Object.freeze({
    schemaVersion: config.schemaVersion,
    batch: config.batch,
    scope: config.scope,
    phase: config.phase,
    mode: 'preview-static',
    status: 'static-foundation',
    runtimeStatus: 'pending',
    decision: 'DENY_RUNTIME_CLAIM',
    run: Object.freeze({ runId, traceId, subjectRef, startedAt: null, finishedAt: null }),
    auth: Object.freeze({
      protocol: config.authBoundary.protocol,
      tokenSource: config.authBoundary.tokenSource,
      tokenProvided: false,
      syntheticJwt: false,
      tenantSource: config.authBoundary.tenantSource,
      principalSource: config.authBoundary.principalSource
    }),
    correlation: Object.freeze({
      traceId,
      fields: [...config.correlation.requiredFields],
      previewOnly: true
    }),
    steps,
    events: eventSteps.map((step) => ({
      stepId: step.id,
      eventId: step.event.eventId,
      eventName: step.event.name,
      producerService: step.event.producerService,
      consumerServices: step.event.consumerServices,
      emissionStatus: step.event.emissionStatus,
      rpc: false
    })),
    reconciliation: Object.freeze({
      api: 'pending-no-network-request',
      db: 'pending-no-database-write',
      kafka: 'pending-no-publish-or-consume',
      blockers: [...config.execution.blockers]
    }),
    counters: Object.freeze({ networkRequests: 0, databaseWrites: 0, kafkaPublishes: 0, kafkaConsumes: 0 }),
    runtimeEvidence: null,
    blockers: [...config.execution.blockers]
  });
}

export function replayB26Journey(input = {}) {
  return createB26JourneyPreview(input);
}

function printUsage() {
  console.log('B26 V2-B26-EVT-003: default mode is preview/static; no JWT, database write, network call or Kafka publish is performed.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const mode = process.argv.find((arg) => arg.startsWith('--mode='))?.split('=', 2)[1] ?? 'preview';
  const summary = process.argv.includes('--summary');
  if (!['preview', 'static'].includes(mode)) {
    console.log(JSON.stringify({ batch: 'B26', scope: 'V2-B26-EVT-003', mode, runtimeStatus: 'pending', decision: 'DENY_RUNTIME_CLAIM', blocker: 'only preview/static is implemented; runtime requires external evidence' }, null, 2));
    process.exitCode = 2;
  } else {
    printUsage();
    const result = replayB26Journey({});
    if (summary) {
      console.log(JSON.stringify({
        batch: result.batch,
        scope: result.scope,
        mode: result.mode,
        status: result.status,
        runtimeStatus: result.runtimeStatus,
        decision: result.decision,
        stepCount: result.steps.length,
        eventCount: result.events.length,
        counters: result.counters,
        blockers: result.blockers,
      }, null, 2));
    } else {
      console.log(JSON.stringify(result, null, 2));
    }
  }
}
