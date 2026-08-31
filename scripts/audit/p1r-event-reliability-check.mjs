import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateFrozenEventCatalogPolicy } from "../contracts/event-catalog-policy.mjs";
import { validateB26EventRuntime } from "../runtime/validate-b26-event-runtime.mjs";
import {
  listEventFragments,
  validateEventGovernanceData,
} from "./p1r-event-governance-check.mjs";
import { validateSagaRecoveryData } from "./p1r-saga-recovery-check.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const defaultRoot = path.resolve(path.dirname(scriptPath), "..", "..");

export const DEFAULT_RELIABILITY_POLICY =
  "packages/contracts/events/v1/reliability-policy.json";
export const DEFAULT_SAGA_POLICY = "config/p1r-saga-recovery.v1.json";

const CANONICAL_EVENTS = [
  "assessment.item.assessed.v2",
  "assessment.placement.completed.v1",
  "commerce.entitlement.activated.v2",
  "commerce.entitlement.revoked.v2",
  "commerce.order.created.v2",
  "commerce.payment.callback_received.v2",
  "commerce.payment.requested.v2",
  "commerce.payment.verified.v2",
  "commerce.reconciliation.discrepancy_recorded.v2",
  "commerce.reconciliation.recovery_receipted.v2",
  "commerce.refund.settled.v2",
  "content.version.published.v1",
  "content.version.reviewed.v1",
  "content.version.rolled_back.v1",
  "content.version.submitted.v1",
  "content.version.unpublished.v1",
  "gamification.reward.granted.v2",
  "gamification.xp.ledger_posted.v2",
  "leaderboard.snapshot_published.v2",
  "learner.target.updated.v1",
  "learning.mastery.projected.v2",
  "learning.review.scheduled.v2",
  "learning.task.completed.v2",
  "social.report.created.v2",
  "study_room.focus_started.v2",
  "study_room.seat_joined.v2",
  "study_room.seat_left.v2",
  "workflow.event.dead_lettered.v1",
  "workflow.event.delivery_failed.v1",
  "workflow.event.ordering_deferred.v1",
  "workflow.event.replay_requested.v1",
  "workflow.outbox.published.v1",
  "workflow.saga.compensation_requested.v1",
  "workflow.saga.manual_recovery_requested.v1",
];
const CONTEXT_FIELDS = [
  "eventId",
  "rootEventId",
  "causationEventId",
  "eventName",
  "aggregateType",
  "aggregateId",
  "aggregateVersion",
  "schemaVersion",
  "requestId",
  "traceId",
  "dedupeKey",
];
const REQUIRED_SCHEMAS = [
  "platform.event.consumer-effect-receipt.v1",
  "platform.event.dlq-record.v1",
  "platform.event.outbox-record.v1",
  "platform.event.publish-receipt.v1",
  "platform.event.reliability-context.v1",
  "platform.event.replay-request.v1",
  "platform.workflow.recovery-closure-receipt.v1",
  "platform.workflow.recovery-task.v1",
];
const SOURCE_REFS = [
  "requirements/backlog/v2-phase1-rebaseline/execution/P1R-M1-007.md",
  "requirements/backlog/v2-phase1-rebaseline/02-编号任务台账.md#P1R-M1-007",
  "docs/06-design/v2-980plus/phase1-business-operation/06-业务联调矩阵.md#INT-P1-017",
  "docs/02-architecture/v2-microservices-architecture.md",
  "packages/contracts/events/v1/catalog.json",
  DEFAULT_SAGA_POLICY,
];
const SCHEMA_DIGESTS = {
  "platform.event.consumer-effect-receipt.v1":
    "ff898e2ecc52f4274c58a1ab9f52828fbeab58f05ed82375a1d63e7206ee6d79",
  "platform.event.dlq-record.v1":
    "a03717a3dcaee8b2f35b3b356763bfba09f010c79db119ed0836a3a9e64341b6",
  "platform.event.outbox-record.v1":
    "629800a219cf9d7a815dc89003d236dc2e059dbbd6f65a6f6b565321a6ce16d9",
  "platform.event.publish-receipt.v1":
    "1f0622efe86fe06c89001c0fdac2db7bdf9c4dd225ca1fffb7db0387645bba04",
  "platform.event.reliability-context.v1":
    "9b9e05104b9035bf3b5cbc125139a4fea5977cb637b1d223b73644bb7a4bec5f",
  "platform.event.replay-request.v1":
    "6629d3a027235408da98b043da0aee23baa6fdf73fa420671657d8fe5920e12e",
  "platform.workflow.recovery-closure-receipt.v1":
    "02f1e5b0feb65772e6d52c5549d4b76ed351711e81db68203139b3a7096b34f8",
  "platform.workflow.recovery-task.v1":
    "cc0d3c826a5831f9c2bd518573a840d652c51eaa9c884941c9ca8c95679ed49c",
};
const RETRYABLE_CODES = [
  "CONFLICT_RETRYABLE",
  "TEMPORARY_UNAVAILABLE",
  "TIMEOUT",
];
const NON_RETRYABLE_CODES = [
  "FORBIDDEN",
  "OWNER_MISMATCH",
  "SCHEMA_INVALID",
  "STALE_VERSION",
];
const SENSITIVE_FIELD =
  /password|secret|token|authorization|cookie|rawaudio|recordingbytes|paymentcredential|jws|answerkey|rawanswer/i;

const POLICY_SHAPES = {
  "": [
    "$schema",
    "schemaVersion",
    "taskId",
    "phase",
    "maturity",
    "runtimeStatus",
    "sourceOfTruth",
    "sourceRefs",
    "catalog",
    "historicalCandidate",
    "identityAndLineage",
    "outbox",
    "consumer",
    "retryBudget",
    "deadLetter",
    "replay",
    "ordering",
    "sagaRecovery",
    "reliabilitySchemaRegistry",
    "prohibitions",
    "runtimeEvidenceBoundary",
  ],
  catalog: [
    "path",
    "governanceSchemaVersion",
    "applicationScope",
    "currentCanonicalEvents",
    "wireContractMutation",
    "reliabilityContext",
  ],
  historicalCandidate: [
    "path",
    "authority",
    "mode",
    "runtimeStatus",
    "defaultDecision",
    "missingRootEventId",
    "sequenceSource",
    "canonicalSequenceField",
    "migrationRule",
  ],
  identityAndLineage: [
    "schemaRef",
    "requiredFields",
    "serverOwnedFields",
    "rootEvent",
    "derivedEvent",
    "retry",
    "replay",
    "clientMaySupplyIdentity",
  ],
  "identityAndLineage.rootEvent": ["rootEventId", "causationEventId"],
  "identityAndLineage.derivedEvent": [
    "eventId",
    "rootEventId",
    "causationEventId",
  ],
  "identityAndLineage.retry": [
    "eventId",
    "rootEventId",
    "causationEventId",
    "aggregateVersion",
    "schemaVersion",
    "dedupeKey",
  ],
  "identityAndLineage.replay": [
    "sourceEventId",
    "rootEventId",
    "eventName",
    "aggregateType",
    "aggregateId",
    "aggregateVersion",
    "schemaVersion",
    "dedupeKey",
    "topic",
    "partitionKey",
    "payloadDigest",
    "replayRunId",
    "controlEventId",
  ],
  outbox: [
    "owner",
    "storage",
    "recordSchemaRef",
    "publishReceiptSchemaRef",
    "aggregateAndOutboxSameTransaction",
    "eventImmutableAfterCommit",
    "delivery",
    "exactlyOnceClaim",
    "claim",
    "states",
    "transitions",
    "ackRule",
    "crashAfterAckRule",
    "terminalStates",
    "runtimeVerificationTask",
  ],
  "outbox.claim": [
    "strategy",
    "leaseDurationMs",
    "leaseOwnerRequired",
    "expiredLeaseMayBeReclaimed",
    "concurrentOwnerRequired",
  ],
  consumer: [
    "owner",
    "receiptSchemaRef",
    "delivery",
    "deduplication",
    "states",
    "transitions",
    "terminalStates",
    "runtimeVerificationTask",
  ],
  "consumer.deduplication": [
    "primaryUniqueKey",
    "secondaryKey",
    "sameDedupeKeyDifferentEventId",
    "effectAndReceiptSameOwnerTransaction",
    "duplicateDomainEffect",
    "offsetCommit",
  ],
  retryBudget: [
    "bounded",
    "attemptIncludesInitialDelivery",
    "maxAttempts",
    "backoff",
    "baseDelayMs",
    "maxDelayMs",
    "retryableFailureCodes",
    "nonRetryableFailureCodes",
    "unknownFailureCode",
    "exhaustedAction",
  ],
  deadLetter: [
    "recordSchemaRef",
    "owner",
    "sourceRecordImmutable",
    "preserveIdentityFields",
    "requiredFailureFields",
    "domainFactsDirectWrite",
    "rawAuthorizationOrSecrets",
  ],
  replay: [
    "requestSchemaRef",
    "source",
    "sameConsumerGroup",
    "sameConsumerPath",
    "sameSchemaVersion",
    "dedupeRemainsEnabled",
    "orderingChecksRemainEnabled",
    "clientTriggered",
    "operatorPermission",
    "approvalPermission",
    "requesterMustDifferFromApprover",
    "approvalAndAuditRequired",
    "maxBatchSize",
    "runtimeVerificationTask",
  ],
  ordering: [
    "partitionKey",
    "sequenceField",
    "sameAggregateOrdered",
    "crossAggregateOrder",
    "outOfOrderPolicy",
    "maxBufferSize",
    "maxWaitMs",
    "staleEventPolicy",
    "gapOwner",
    "runtimeVerificationTask",
  ],
  sagaRecovery: [
    "policyRef",
    "coordinator",
    "auditOwner",
    "domainCommandOwner",
    "workflowMayWriteForeignDomainFacts",
    "auditMayWriteForeignDomainFacts",
    "compensationTransport",
    "twoPhaseCommit",
    "kafkaRpc",
    "runtimeVerificationTask",
  ],
  reliabilitySchemaRegistry: [
    "path",
    "requiredSchemas",
    "unknownFields",
    "sensitivePayloadOrCredentialFields",
    "runtimeRecordPresenceClaim",
  ],
  runtimeEvidenceBoundary: [
    "contractResult",
    "currentRuntimeResult",
    "b26MustRemain",
    "m2RequiredTasks",
    "cannotBeSatisfiedBy",
    "requiredRuntimeEvidence",
  ],
};

const SCHEMA_REQUIRED = {
  "platform.event.reliability-context.v1": CONTEXT_FIELDS,
  "platform.event.outbox-record.v1": [
    "outboxId",
    "ownerService",
    "eventId",
    "rootEventId",
    "causationEventId",
    "eventName",
    "aggregateType",
    "aggregateId",
    "aggregateVersion",
    "schemaVersion",
    "requestId",
    "traceId",
    "dedupeKey",
    "topic",
    "partitionKey",
    "payload",
    "payloadDigest",
    "state",
    "attempt",
    "leaseOwner",
    "leaseExpiresAt",
    "nextAttemptAt",
    "lastFailureCode",
    "createdAt",
    "updatedAt",
    "publishedAt",
  ],
  "platform.event.publish-receipt.v1": [
    "receiptId",
    "outboxId",
    "producerService",
    "eventId",
    "rootEventId",
    "eventName",
    "aggregateType",
    "aggregateId",
    "aggregateVersion",
    "schemaVersion",
    "dedupeKey",
    "requestId",
    "traceId",
    "topic",
    "partitionKey",
    "payloadDigest",
    "attempt",
    "state",
    "failureCode",
    "brokerPartition",
    "brokerOffset",
    "acknowledgedAt",
    "recordedAt",
  ],
  "platform.event.consumer-effect-receipt.v1": [
    "receiptId",
    "consumerGroup",
    "consumerService",
    "eventId",
    "rootEventId",
    "eventName",
    "aggregateType",
    "dedupeKey",
    "aggregateId",
    "aggregateVersion",
    "schemaVersion",
    "requestId",
    "traceId",
    "topic",
    "partitionKey",
    "payloadDigest",
    "effectType",
    "effectId",
    "effectDigest",
    "attempt",
    "outcome",
    "auditRef",
    "processedAt",
  ],
  "platform.event.dlq-record.v1": [
    "dlqRecordId",
    "eventId",
    "rootEventId",
    "eventName",
    "aggregateType",
    "aggregateId",
    "aggregateVersion",
    "schemaVersion",
    "dedupeKey",
    "requestId",
    "traceId",
    "topic",
    "partitionKey",
    "payloadDigest",
    "consumerGroup",
    "failureCode",
    "attempt",
    "failedAt",
    "recoveryState",
    "auditId",
  ],
  "platform.event.replay-request.v1": [
    "replayRunId",
    "controlEventId",
    "sourceDlqRecordId",
    "sourceEventId",
    "rootEventId",
    "eventName",
    "aggregateType",
    "aggregateId",
    "aggregateVersion",
    "schemaVersion",
    "dedupeKey",
    "topic",
    "partitionKey",
    "payloadDigest",
    "consumerGroup",
    "sourceOwnerService",
    "requestedByRef",
    "approvedByRef",
    "actionDigest",
    "policyVersion",
    "reasonCode",
    "mode",
    "state",
    "requestedAt",
    "approvedAt",
    "requestId",
    "traceId",
    "auditRef",
  ],
  "platform.workflow.recovery-task.v1": [
    "taskId",
    "recoveryId",
    "recoveryRevision",
    "sagaId",
    "sourceBusinessId",
    "sourceEventId",
    "rootEventId",
    "aggregateType",
    "aggregateId",
    "sourceOwnerService",
    "currentStage",
    "retryCount",
    "lastErrorCode",
    "nextAction",
    "ownerService",
    "state",
    "requestId",
    "traceId",
    "auditId",
    "createdAt",
    "updatedAt",
  ],
  "platform.workflow.recovery-closure-receipt.v1": [
    "receiptId",
    "receiptType",
    "schemaVersion",
    "issuedAt",
    "ownerService",
    "taskId",
    "recoveryId",
    "recoveryRevision",
    "sagaId",
    "sourceBusinessId",
    "sourceEventId",
    "rootEventId",
    "aggregateType",
    "aggregateId",
    "actionRef",
    "actionDigest",
    "idempotencyKey",
    "outcome",
    "recoveryState",
    "resultDigest",
    "precheckReconciliationId",
    "postcheckReconciliationId",
    "postcheckStatus",
    "domainReceiptRefs",
    "approvalId",
    "approvalDecision",
    "auditId",
    "requestId",
    "traceId",
    "closedByRef",
  ],
};

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function stableJson(value) {
  if (Array.isArray(value)) return "[" + value.map(stableJson).join(",") + "]";
  if (isRecord(value)) {
    return (
      "{" +
      Object.keys(value)
        .sort()
        .map(function (key) {
          return JSON.stringify(key) + ":" + stableJson(value[key]);
        })
        .join(",") +
      "}"
    );
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return crypto.createHash("sha256").update(stableJson(value)).digest("hex");
}

function add(errors, condition, message) {
  if (!condition) errors.push(message);
}

function exact(errors, actual, expected, message) {
  add(errors, stableJson(actual) === stableJson(expected), message);
}

function unique(errors, values, label) {
  if (!Array.isArray(values)) {
    errors.push(label + " must be an array");
    return;
  }
  add(
    errors,
    new Set(values).size === values.length,
    label + " must not contain duplicates",
  );
}

function atPath(value, location) {
  if (location === "") return value;
  return location.split(".").reduce(function (current, key) {
    return current == null ? undefined : current[key];
  }, value);
}

function exactKeys(errors, value, expected, label) {
  add(errors, isRecord(value), label + " must be an object");
  if (!isRecord(value)) return;
  exact(
    errors,
    Object.keys(value).sort(),
    expected.slice().sort(),
    label + " has unknown or missing keys",
  );
}

function checkPolicyShape(policy, errors) {
  for (const entry of Object.entries(POLICY_SHAPES)) {
    exactKeys(
      errors,
      atPath(policy, entry[0]),
      entry[1],
      entry[0] === "" ? "reliability policy" : "policy." + entry[0],
    );
  }
  for (const section of ["outbox", "consumer"]) {
    for (const [index, transition] of (
      policy[section]?.transitions ?? []
    ).entries()) {
      exactKeys(
        errors,
        transition,
        ["from", "action", "to"],
        "policy." + section + ".transitions[" + index + "]",
      );
    }
  }
}

function transitionKeys(transitions) {
  return (transitions ?? []).map(function (item) {
    return item.from + "|" + item.action + "|" + item.to;
  });
}

function checkMachine(
  errors,
  label,
  machine,
  states,
  transitions,
  terminalStates,
) {
  exact(errors, machine?.states, states, label + " states drifted");
  unique(errors, machine?.states, label + " states");
  const actualTransitions = transitionKeys(machine?.transitions);
  exact(errors, actualTransitions, transitions, label + " transitions drifted");
  unique(errors, actualTransitions, label + " transitions");
  exact(
    errors,
    machine?.terminalStates,
    terminalStates,
    label + " terminal states drifted",
  );
  for (const transition of machine?.transitions ?? []) {
    add(
      errors,
      machine.states.includes(transition.from) &&
        machine.states.includes(transition.to),
      label + " transition references an unknown state",
    );
    add(
      errors,
      !terminalStates.includes(transition.from),
      label + " terminal state has an outgoing transition",
    );
  }
}

function checkPolicy(policy, errors) {
  checkPolicyShape(policy, errors);
  add(
    errors,
    policy.$schema === "p1r.event-reliability.v1" &&
      policy.schemaVersion === "p1r.event-reliability.v1",
    "reliability policy identity is invalid",
  );
  add(
    errors,
    policy.taskId === "P1R-M1-007" && policy.phase === "PHASE_1",
    "reliability policy task or phase is invalid",
  );
  add(
    errors,
    policy.maturity === "D2_CONTRACT_READY" &&
      policy.runtimeStatus === "NOT_RUNTIME_VERIFIED",
    "reliability policy must remain D2 and NOT_RUNTIME_VERIFIED",
  );
  add(
    errors,
    policy.sourceOfTruth === DEFAULT_RELIABILITY_POLICY,
    "reliability sourceOfTruth is invalid",
  );
  exact(errors, policy.sourceRefs, SOURCE_REFS, "policy sourceRefs drifted");
  add(
    errors,
    policy.catalog?.path === "packages/contracts/events/v1/catalog.json",
    "event catalog source path is invalid",
  );
  exact(
    errors,
    policy.catalog?.currentCanonicalEvents,
    CANONICAL_EVENTS,
    "canonical event set or order drifted",
  );
  add(
    errors,
    policy.catalog?.governanceSchemaVersion === "p1r.event-governance.v1",
    "event governance version is invalid",
  );
  add(
    errors,
    policy.catalog?.applicationScope ===
      "ALL_CURRENT_AND_FUTURE_CANONICAL_D2_EVENTS",
    "reliability scope is invalid",
  );
  add(
    errors,
    policy.catalog?.wireContractMutation === "PROHIBITED",
    "M1-007 cannot mutate the M1-006 wire contract",
  );
  add(
    errors,
    policy.catalog?.reliabilityContext ===
      "OWNER_LOCAL_OUTBOX_BOUNDARY_SUPPLEMENT",
    "reliability context boundary is invalid",
  );
  exact(
    errors,
    policy.historicalCandidate,
    {
      path: "config/b26-event-runtime.json",
      authority: "STATIC_CROSS_CHECK_ONLY",
      mode: "static-only",
      runtimeStatus: "pending",
      defaultDecision: "NO-GO",
      missingRootEventId: true,
      sequenceSource: "payload.aggregateVersion",
      canonicalSequenceField: "aggregateVersion",
      migrationRule:
        "OWNER_ADAPTER_MUST_POPULATE_RELIABILITY_CONTEXT_BEFORE_M2_RUNTIME",
    },
    "B26 candidate boundary or known-gap mapping drifted",
  );

  exact(
    errors,
    policy.identityAndLineage?.requiredFields,
    CONTEXT_FIELDS,
    "reliability context fields drifted",
  );
  add(
    errors,
    policy.identityAndLineage?.schemaRef ===
      "platform.event.reliability-context.v1",
    "reliability context schema reference is invalid",
  );
  exact(
    errors,
    policy.identityAndLineage?.serverOwnedFields,
    [
      "eventId",
      "rootEventId",
      "causationEventId",
      "aggregateVersion",
      "schemaVersion",
      "requestId",
      "traceId",
      "dedupeKey",
    ],
    "server-owned identity fields drifted",
  );
  exact(
    errors,
    policy.identityAndLineage?.rootEvent,
    { rootEventId: "MUST_EQUAL_EVENT_ID", causationEventId: "MUST_BE_NULL" },
    "root event lineage is invalid",
  );
  exact(
    errors,
    policy.identityAndLineage?.derivedEvent,
    {
      eventId: "NEW_SERVER_GENERATED_ID",
      rootEventId: "INHERIT_SOURCE_ROOT_EVENT_ID",
      causationEventId: "MUST_EQUAL_SOURCE_EVENT_ID",
    },
    "derived event lineage is invalid",
  );
  add(
    errors,
    Object.values(policy.identityAndLineage?.retry ?? {}).every(
      function (value) {
        return value === "PRESERVE";
      },
    ),
    "retry must preserve the event identity",
  );
  for (const field of [
    "sourceEventId",
    "rootEventId",
    "eventName",
    "aggregateType",
    "aggregateId",
    "aggregateVersion",
    "schemaVersion",
    "dedupeKey",
    "topic",
    "partitionKey",
    "payloadDigest",
  ]) {
    add(
      errors,
      policy.identityAndLineage?.replay?.[field] === "PRESERVE",
      "replay must preserve " + field,
    );
  }
  add(
    errors,
    policy.identityAndLineage?.replay?.replayRunId ===
      "NEW_SERVER_GENERATED_OPERATION_ID",
    "replayRunId must be server-generated",
  );
  add(
    errors,
    policy.identityAndLineage?.replay?.controlEventId ===
      "NEW_SERVER_GENERATED_EVENT_ID",
    "replay controlEventId must be server-generated",
  );
  add(
    errors,
    policy.identityAndLineage?.clientMaySupplyIdentity === false,
    "client-supplied event identity must be forbidden",
  );

  checkMachine(
    errors,
    "outbox",
    policy.outbox,
    ["PENDING", "PUBLISHING", "PUBLISHED", "RETRY_WAIT", "DLQ"],
    [
      "PENDING|CLAIM|PUBLISHING",
      "PUBLISHING|BROKER_ACK|PUBLISHED",
      "PUBLISHING|RETRYABLE_FAILURE_UNDER_BUDGET|RETRY_WAIT",
      "PUBLISHING|NON_RETRYABLE_OR_BUDGET_EXHAUSTED|DLQ",
      "RETRY_WAIT|DUE_AND_LEASE_ACQUIRED|PUBLISHING",
    ],
    ["PUBLISHED", "DLQ"],
  );
  add(
    errors,
    policy.outbox?.owner === "EVENT_DATA_OWNER_SERVICE" &&
      policy.outbox?.storage === "OWNER_SERVICE_MYSQL_SCHEMA",
    "Outbox must be owner-local",
  );
  add(
    errors,
    policy.outbox?.recordSchemaRef === "platform.event.outbox-record.v1" &&
      policy.outbox?.publishReceiptSchemaRef ===
        "platform.event.publish-receipt.v1",
    "Outbox schema references are invalid",
  );
  add(
    errors,
    policy.outbox?.aggregateAndOutboxSameTransaction === true &&
      policy.outbox?.eventImmutableAfterCommit === true,
    "aggregate and immutable Outbox event must commit atomically",
  );
  add(
    errors,
    policy.outbox?.delivery === "AT_LEAST_ONCE" &&
      policy.outbox?.exactlyOnceClaim === false,
    "Outbox delivery semantics are invalid",
  );
  exact(
    errors,
    policy.outbox?.claim,
    {
      strategy: "ROW_LOCK_SKIP_LOCKED_WITH_LEASE",
      leaseDurationMs: 30000,
      leaseOwnerRequired: true,
      expiredLeaseMayBeReclaimed: true,
      concurrentOwnerRequired: true,
    },
    "Outbox lease policy drifted",
  );
  add(
    errors,
    policy.outbox?.ackRule === "BROKER_ACK_BEFORE_PUBLISHED",
    "Outbox PUBLISHED must require broker ack",
  );
  add(
    errors,
    policy.outbox?.crashAfterAckRule ===
      "RETRY_WITH_SAME_EVENT_ID_AND_CONSUMER_DEDUPE",
    "crash-after-ack rule is invalid",
  );
  add(
    errors,
    policy.outbox?.runtimeVerificationTask === "P1R-M2-005",
    "Outbox runtime owner must remain M2-005",
  );

  checkMachine(
    errors,
    "consumer",
    policy.consumer,
    [
      "RECEIVED",
      "PROCESSING",
      "APPLIED",
      "DUPLICATE_SKIPPED",
      "RETRY_WAIT",
      "DLQ",
    ],
    [
      "RECEIVED|CLAIM|PROCESSING",
      "PROCESSING|EFFECT_AND_RECEIPT_COMMITTED|APPLIED",
      "PROCESSING|EXISTING_APPLIED_RECEIPT|DUPLICATE_SKIPPED",
      "PROCESSING|RETRYABLE_FAILURE_UNDER_BUDGET|RETRY_WAIT",
      "PROCESSING|NON_RETRYABLE_OR_BUDGET_EXHAUSTED|DLQ",
      "RETRY_WAIT|DUE_AND_LEASE_ACQUIRED|PROCESSING",
    ],
    ["APPLIED", "DUPLICATE_SKIPPED", "DLQ"],
  );
  add(
    errors,
    policy.consumer?.owner === "CONSUMER_SERVICE" &&
      policy.consumer?.receiptSchemaRef ===
        "platform.event.consumer-effect-receipt.v1" &&
      policy.consumer?.delivery === "AT_LEAST_ONCE",
    "consumer owner, receipt, or delivery boundary is invalid",
  );
  exact(
    errors,
    policy.consumer?.deduplication?.primaryUniqueKey,
    ["consumerGroup", "eventId"],
    "consumer dedupe key is invalid",
  );
  add(
    errors,
    policy.consumer?.deduplication?.secondaryKey === "dedupeKey" &&
      policy.consumer?.deduplication?.sameDedupeKeyDifferentEventId ===
        "REJECT_AND_AUDIT",
    "secondary dedupe collision must reject and audit",
  );
  add(
    errors,
    policy.consumer?.deduplication?.effectAndReceiptSameOwnerTransaction ===
      true,
    "consumer effect and receipt must be atomic",
  );
  add(
    errors,
    policy.consumer?.deduplication?.duplicateDomainEffect === "PROHIBITED",
    "duplicate domain effects must be prohibited",
  );
  add(
    errors,
    policy.consumer?.deduplication?.offsetCommit ===
      "AFTER_EFFECT_AND_RECEIPT_COMMIT",
    "offset commit must follow effect and receipt",
  );
  add(
    errors,
    policy.consumer?.runtimeVerificationTask === "P1R-M2-005",
    "consumer runtime owner must remain M2-005",
  );

  exact(
    errors,
    policy.retryBudget,
    {
      bounded: true,
      attemptIncludesInitialDelivery: true,
      maxAttempts: 5,
      backoff: "EXPONENTIAL_WITH_JITTER",
      baseDelayMs: 1000,
      maxDelayMs: 60000,
      retryableFailureCodes: RETRYABLE_CODES,
      nonRetryableFailureCodes: NON_RETRYABLE_CODES,
      unknownFailureCode: "NON_RETRYABLE_FAIL_CLOSED",
      exhaustedAction: "ROUTE_TO_DLQ",
    },
    "retry budget drifted",
  );
  add(
    errors,
    policy.deadLetter?.recordSchemaRef === "platform.event.dlq-record.v1" &&
      policy.deadLetter?.owner === "WORKFLOW_SERVICE" &&
      policy.deadLetter?.sourceRecordImmutable === true,
    "DLQ source must be immutable and workflow-owned",
  );
  exact(
    errors,
    policy.deadLetter?.preserveIdentityFields,
    [
      "eventId",
      "rootEventId",
      "aggregateId",
      "aggregateVersion",
      "schemaVersion",
      "dedupeKey",
      "requestId",
      "traceId",
    ],
    "DLQ identity fields drifted",
  );
  exact(
    errors,
    policy.deadLetter?.requiredFailureFields,
    ["consumerGroup", "failureCode", "attempt", "failedAt", "recoveryState"],
    "DLQ failure fields drifted",
  );
  add(
    errors,
    policy.deadLetter?.domainFactsDirectWrite === "PROHIBITED" &&
      policy.deadLetter?.rawAuthorizationOrSecrets === "PROHIBITED",
    "DLQ security boundary is invalid",
  );

  for (const key of [
    "sameConsumerGroup",
    "sameConsumerPath",
    "sameSchemaVersion",
    "dedupeRemainsEnabled",
    "orderingChecksRemainEnabled",
    "requesterMustDifferFromApprover",
    "approvalAndAuditRequired",
  ]) {
    add(
      errors,
      policy.replay?.[key] === true,
      "replay " + key + " must remain true",
    );
  }
  add(
    errors,
    policy.replay?.requestSchemaRef === "platform.event.replay-request.v1" &&
      policy.replay?.source === "IMMUTABLE_OUTBOX_OR_DLQ_RECORD" &&
      policy.replay?.clientTriggered === false,
    "replay source or client boundary is invalid",
  );
  add(
    errors,
    policy.replay?.operatorPermission === "event.replay.request" &&
      policy.replay?.approvalPermission === "event.replay.approve",
    "replay permissions are invalid",
  );
  add(
    errors,
    policy.replay?.maxBatchSize === 1000 &&
      policy.replay?.runtimeVerificationTask === "P1R-M2-005",
    "replay batch/runtime boundary is invalid",
  );
  exact(
    errors,
    policy.ordering,
    {
      partitionKey: "aggregateId",
      sequenceField: "aggregateVersion",
      sameAggregateOrdered: true,
      crossAggregateOrder: "NOT_GUARANTEED",
      outOfOrderPolicy: "BOUNDED_HOLD_THEN_DLQ",
      maxBufferSize: 100,
      maxWaitMs: 30000,
      staleEventPolicy: "DEDUPE_AUDIT_AND_SKIP",
      gapOwner: "workflow-service",
      runtimeVerificationTask: "P1R-M2-005",
    },
    "ordering policy drifted",
  );
  exact(
    errors,
    policy.sagaRecovery,
    {
      policyRef: DEFAULT_SAGA_POLICY,
      coordinator: "workflow-service",
      auditOwner: "audit-service",
      domainCommandOwner: "TARGET_DOMAIN_OWNER",
      workflowMayWriteForeignDomainFacts: false,
      auditMayWriteForeignDomainFacts: false,
      compensationTransport: "VERSIONED_DOMAIN_API_OR_CANONICAL_EVENT",
      twoPhaseCommit: false,
      kafkaRpc: false,
      runtimeVerificationTask: "P1R-M2-006",
    },
    "Saga recovery boundary drifted",
  );

  exact(
    errors,
    policy.reliabilitySchemaRegistry?.requiredSchemas,
    REQUIRED_SCHEMAS,
    "reliability schema set or order drifted",
  );
  add(
    errors,
    policy.reliabilitySchemaRegistry?.path ===
      "packages/contracts/schemas/v1/registry.json" &&
      policy.reliabilitySchemaRegistry?.unknownFields === "REJECT",
    "reliability schema registry boundary is invalid",
  );
  add(
    errors,
    policy.reliabilitySchemaRegistry?.sensitivePayloadOrCredentialFields ===
      "PROHIBITED" &&
      policy.reliabilitySchemaRegistry?.runtimeRecordPresenceClaim ===
        "PROHIBITED_IN_D2_EVIDENCE",
    "reliability record safety/runtime boundary is invalid",
  );
  exact(
    errors,
    policy.prohibitions,
    [
      "CLIENT_SUPPLIED_EVENT_IDENTITY",
      "CROSS_SERVICE_DATABASE_WRITE",
      "DISTRIBUTED_TWO_PHASE_COMMIT",
      "EXACTLY_ONCE_DELIVERY_CLAIM",
      "KAFKA_AS_RPC_OR_TRANSACTION_COORDINATOR",
      "REPLAY_BYPASSING_CONSUMER_PATH",
      "REPLAY_WITHOUT_INDEPENDENT_APPROVAL",
      "RETRY_WITH_NEW_EVENT_ID",
      "STATIC_OR_SYNTHETIC_EVIDENCE_AS_RUNTIME_PROOF",
      "UI_TELEMETRY_LOG_OR_METRIC_AS_DOMAIN_EVENT",
    ],
    "reliability prohibitions drifted",
  );
  add(
    errors,
    policy.runtimeEvidenceBoundary?.contractResult === "D2_CONTRACT_READY" &&
      policy.runtimeEvidenceBoundary?.currentRuntimeResult ===
        "NOT_RUNTIME_VERIFIED",
    "runtime evidence status is invalid",
  );
  add(
    errors,
    policy.runtimeEvidenceBoundary?.b26MustRemain ===
      "STATIC_ONLY_PENDING_NO_GO",
    "B26 runtime evidence boundary is invalid",
  );
  exact(
    errors,
    policy.runtimeEvidenceBoundary?.m2RequiredTasks,
    ["P1R-M2-004", "P1R-M2-005", "P1R-M2-006"],
    "M2 runtime ownership drifted",
  );
  exact(
    errors,
    policy.runtimeEvidenceBoundary?.cannotBeSatisfiedBy,
    [
      "EMPTY_TOPIC",
      "HEALTH_HTTP_200",
      "IN_MEMORY_ADAPTER",
      "SAME_PROCESS_TEST_DOUBLE",
      "STATIC_MANIFEST",
      "SYNTHETIC_RECEIPT",
      "UNIT_TEST",
    ],
    "runtime evidence exclusions drifted",
  );
  exact(
    errors,
    policy.runtimeEvidenceBoundary?.requiredRuntimeEvidence,
    [
      "OWNER_MYSQL_TRANSACTION_AND_LEASE",
      "BROKER_TOPIC_ACL_AND_ACK",
      "PUBLISHER_CRASH_AFTER_ACK_RECOVERY",
      "CONSUMER_DUPLICATE_OUT_OF_ORDER_AND_REBALANCE",
      "DLQ_APPROVAL_REPLAY_WITHOUT_DUPLICATE_EFFECT",
      "SAGA_COMPENSATION_AND_MANUAL_RECOVERY_AUDIT",
    ],
    "required runtime evidence drifted",
  );
}

function checkCatalog(policy, catalog, errors) {
  for (const error of validateFrozenEventCatalogPolicy(catalog))
    errors.push("event catalog: " + error);
  const governance = catalog?.["x-p1r-event-governance"];
  add(
    errors,
    governance?.schemaVersion === policy.catalog?.governanceSchemaVersion,
    "catalog governance version differs from reliability policy",
  );
  add(
    errors,
    governance?.runtimeStatus === "NOT_RUNTIME_VERIFIED",
    "event catalog must remain NOT_RUNTIME_VERIFIED",
  );
  const canonical = (catalog?.events ?? [])
    .filter(function (event) {
      return event?.status === "CANONICAL_D2";
    })
    .map(function (event) {
      return event.eventName;
    })
    .sort();
  exact(
    errors,
    canonical,
    CANONICAL_EVENTS,
    "catalog canonical events differ from reliability policy",
  );
  for (const event of (catalog?.events ?? []).filter(function (item) {
    return item?.status === "CANONICAL_D2";
  })) {
    add(
      errors,
      event?.["x-p1r-governance"]?.runtimeStatus === "NOT_RUNTIME_VERIFIED",
      event.eventName + " must remain NOT_RUNTIME_VERIFIED",
    );
    add(
      errors,
      event?.["x-p1r-governance"]?.producer?.outboxRequired === true,
      event.eventName + " must require Outbox",
    );
    add(
      errors,
      event?.["x-p1r-governance"]?.transport?.delivery === "at-least-once",
      event.eventName + " must use at-least-once delivery",
    );
    add(
      errors,
      event?.["x-p1r-governance"]?.transport?.partitionKey === "aggregateId",
      event.eventName + " must partition by aggregateId",
    );
  }
}

function checkB26(policy, b26Runtime, b26Fragment, catalog, errors) {
  const report = validateB26EventRuntime(b26Runtime, b26Fragment, {
    catalog: catalog,
  });
  for (const error of report.errors ?? [])
    errors.push("B26 static candidate: " + error);
  add(
    errors,
    b26Runtime?.mode === "static-only" &&
      b26Runtime?.runtimeStatus === "pending" &&
      b26Runtime?.defaultDecision === "NO-GO",
    "B26 must remain static-only, pending and NO-GO",
  );
  add(
    errors,
    b26Runtime?.outbox?.publisher?.leaseMs ===
      policy.outbox?.claim?.leaseDurationMs,
    "B26 lease differs from canonical policy",
  );
  add(
    errors,
    b26Runtime?.outbox?.publisher?.publishConfirmation ===
      "broker-ack-before-mark-published",
    "B26 publish acknowledgement rule drifted",
  );
  add(
    errors,
    b26Runtime?.consumerReliability?.retry?.maxAttempts ===
      policy.retryBudget?.maxAttempts,
    "B26 retry attempts differ from canonical policy",
  );
  add(
    errors,
    b26Runtime?.consumerReliability?.retry?.baseDelayMs ===
      policy.retryBudget?.baseDelayMs &&
      b26Runtime?.consumerReliability?.retry?.maxDelayMs ===
        policy.retryBudget?.maxDelayMs,
    "B26 retry timing differs from canonical policy",
  );
  exact(
    errors,
    (b26Runtime?.consumerReliability?.retry?.retryableFailureCodes ?? [])
      .slice()
      .sort(),
    RETRYABLE_CODES,
    "B26 retryable codes differ from canonical policy",
  );
  exact(
    errors,
    (b26Runtime?.consumerReliability?.retry?.nonRetryableFailureCodes ?? [])
      .slice()
      .sort(),
    NON_RETRYABLE_CODES,
    "B26 non-retryable codes differ from canonical policy",
  );
  add(
    errors,
    b26Runtime?.consumerReliability?.ordering?.sequenceField ===
      policy.historicalCandidate?.sequenceSource,
    "B26 sequence gap mapping drifted",
  );
}

function checkSchemas(registry, policy, sagaPolicy, errors) {
  exactKeys(
    errors,
    registry,
    ["registryVersion", "schema", "schemas"],
    "schema registry",
  );
  add(
    errors,
    registry?.registryVersion === "1.0.0" &&
      registry?.schema === "platform.json-schema.registry.v1",
    "schema registry identity is invalid",
  );
  add(
    errors,
    isRecord(registry?.schemas),
    "schema registry must contain schemas",
  );
  const ids = [];
  for (const name of REQUIRED_SCHEMAS) {
    const schema = registry?.schemas?.[name];
    add(errors, isRecord(schema), "schema registry is missing " + name);
    if (!isRecord(schema)) continue;
    ids.push(schema.$id);
    add(
      errors,
      schema.$schema === "https://json-schema.org/draft/2020-12/schema",
      name + " must use JSON Schema 2020-12",
    );
    add(
      errors,
      schema.type === "object" && schema.additionalProperties === false,
      name + " must be a closed object schema",
    );
    exact(
      errors,
      schema.required,
      SCHEMA_REQUIRED[name],
      name + " required fields or order drifted",
    );
    unique(errors, schema.required, name + " required fields");
    for (const field of schema.required ?? [])
      add(
        errors,
        Object.hasOwn(schema.properties ?? {}, field),
        name + " is missing property " + field,
      );
    for (const field of Object.keys(schema.properties ?? {}))
      add(
        errors,
        !SENSITIVE_FIELD.test(field),
        name + " contains forbidden sensitive field " + field,
      );
    add(
      errors,
      sha256(schema) === SCHEMA_DIGESTS[name],
      name + " structure drifted from the frozen D2 contract",
    );
  }
  unique(errors, ids, "reliability schema IDs");
  const outboxSchema = registry?.schemas?.["platform.event.outbox-record.v1"];
  exact(
    errors,
    outboxSchema?.properties?.state?.enum,
    policy?.outbox?.states,
    "Outbox record states differ from the reliability policy",
  );
  add(
    errors,
    outboxSchema?.properties?.attempt?.minimum === 0 &&
      outboxSchema?.properties?.attempt?.maximum ===
        policy?.retryBudget?.maxAttempts,
    "Outbox record attempt budget is invalid",
  );
  add(
    errors,
    outboxSchema?.properties?.partitionKey?.const ===
      policy?.ordering?.partitionKey,
    "Outbox record partition key differs from the reliability policy",
  );
  add(
    errors,
    outboxSchema?.allOf?.length === 5,
    "Outbox record must bind lease, retry, publish and DLQ state evidence",
  );
  const publishedStateRule = outboxSchema?.allOf?.find(function (rule) {
    return rule?.if?.properties?.state?.const === "PUBLISHED";
  });
  add(
    errors,
    publishedStateRule?.then?.properties?.attempt?.minimum === 1 &&
      publishedStateRule?.then?.properties?.attempt?.maximum ===
        policy?.retryBudget?.maxAttempts,
    "Outbox PUBLISHED state must require attempt 1 through the retry budget",
  );
  add(
    errors,
    registry?.schemas?.["platform.event.publish-receipt.v1"]?.properties
      ?.attempt?.maximum === 5,
    "publish receipt attempt must be bounded at 5",
  );
  add(
    errors,
    registry?.schemas?.["platform.event.publish-receipt.v1"]?.allOf?.length ===
      2,
    "publish receipt must bind failureCode to PUBLISHED/DLQ state",
  );
  add(
    errors,
    registry?.schemas?.["platform.event.consumer-effect-receipt.v1"]?.properties
      ?.attempt?.maximum === 5,
    "consumer receipt attempt must be bounded at 5",
  );
  add(
    errors,
    registry?.schemas?.["platform.event.replay-request.v1"]?.properties?.state
      ?.const === "APPROVED",
    "replay request schema must require approved state",
  );
  add(
    errors,
    registry?.schemas?.["platform.workflow.recovery-task.v1"]?.properties
      ?.ownerService?.const === "workflow-service",
    "recovery task must be workflow-owned",
  );
  exact(
    errors,
    registry?.schemas?.["platform.workflow.recovery-task.v1"]?.properties?.state
      ?.enum,
    sagaPolicy?.manualRecovery?.states,
    "recovery task states differ from the Saga recovery policy",
  );
  add(
    errors,
    registry?.schemas?.["platform.workflow.recovery-closure-receipt.v1"]
      ?.properties?.domainReceiptRefs?.minItems === 1,
    "recovery closure must include owner receipts",
  );
  add(
    errors,
    registry?.schemas?.["platform.workflow.recovery-closure-receipt.v1"]
      ?.properties?.ownerService?.const === "workflow-service" &&
      registry?.schemas?.["platform.workflow.recovery-closure-receipt.v1"]
        ?.properties?.receiptType?.const === "RECOVERY_CLOSURE",
    "recovery closure must be a workflow-owned closure receipt",
  );
  const closureRequired =
    registry?.schemas?.["platform.workflow.recovery-closure-receipt.v1"]
      ?.required ?? [];
  for (const field of [
    "precheckReconciliationId",
    "postcheckReconciliationId",
    "domainReceiptRefs",
    "approvalId",
    "approvalDecision",
    "recoveryState",
    "postcheckStatus",
    "auditId",
  ])
    add(
      errors,
      closureRequired.includes(field),
      "recovery closure is missing required evidence " + field,
    );
  add(
    errors,
    registry?.schemas?.["platform.workflow.recovery-closure-receipt.v1"]
      ?.properties?.recoveryState?.const === "CLOSED" &&
      registry?.schemas?.["platform.workflow.recovery-closure-receipt.v1"]
        ?.properties?.postcheckStatus?.const === "MATCHED" &&
      registry?.schemas?.["platform.workflow.recovery-closure-receipt.v1"]
        ?.properties?.approvalDecision?.const === "APPROVED",
    "recovery closure must bind CLOSED to matched postcheck and approval",
  );
}

export function validateEventReliabilityData(input = {}) {
  const errors = [];
  const policy = input.policy;
  add(errors, isRecord(policy), "reliability policy must be an object");
  add(errors, isRecord(input.catalog), "event catalog must be an object");
  add(
    errors,
    isRecord(input.b26Runtime),
    "B26 static candidate must be an object",
  );
  add(
    errors,
    isRecord(input.b26Fragment),
    "B26 event fragment must be an object",
  );
  add(errors, isRecord(input.registry), "schema registry must be an object");
  add(
    errors,
    isRecord(input.sagaPolicy),
    "Saga recovery policy must be an object",
  );
  add(
    errors,
    isRecord(input.ownerPolicy),
    "data ownership policy must be an object",
  );
  add(
    errors,
    Array.isArray(input.eventFragments),
    "event fragments must be an array",
  );
  if (errors.length === 0) {
    checkPolicy(policy, errors);
    checkCatalog(policy, input.catalog, errors);
    try {
      const governanceReport = validateEventGovernanceData({
        catalog: input.catalog,
        ownerPolicy: input.ownerPolicy,
        b26Runtime: input.b26Runtime,
        fragments: input.eventFragments,
      });
      for (const error of governanceReport.errors ?? []) {
        errors.push("event governance: " + error);
      }
    } catch (error) {
      errors.push(
        "event governance validation failed: " +
          (error instanceof Error ? error.message : String(error)),
      );
    }
    checkB26(
      policy,
      input.b26Runtime,
      input.b26Fragment,
      input.catalog,
      errors,
    );
    checkSchemas(input.registry, policy, input.sagaPolicy, errors);
    const sagaReport = validateSagaRecoveryData({
      policy: input.sagaPolicy,
      b26: input.b26Runtime,
    });
    for (const error of sagaReport.errors ?? [])
      errors.push("Saga recovery policy: " + error);
  }
  return {
    result: errors.length === 0 ? "PASS" : "FAIL",
    summary: {
      taskId: policy?.taskId,
      maturity: policy?.maturity,
      runtimeStatus: policy?.runtimeStatus,
      canonicalEvents: policy?.catalog?.currentCanonicalEvents?.length ?? 0,
      reliabilitySchemas:
        policy?.reliabilitySchemaRegistry?.requiredSchemas?.length ?? 0,
      outboxStates: policy?.outbox?.states?.length ?? 0,
      consumerStates: policy?.consumer?.states?.length ?? 0,
      retryMaxAttempts: policy?.retryBudget?.maxAttempts,
      b26Mode: input.b26Runtime?.mode,
      b26RuntimeStatus: input.b26Runtime?.runtimeStatus,
      b26Decision: input.b26Runtime?.defaultDecision,
      sagaRuntimeStatus: input.sagaPolicy?.runtimeStatus,
    },
    errors: errors,
  };
}

function readJson(root, relativePath) {
  return JSON.parse(
    fs.readFileSync(path.join(root, ...relativePath.split("/")), "utf8"),
  );
}

export function readEventReliabilityInputs(options = {}) {
  const root = options.root ?? defaultRoot;
  return {
    policy: readJson(root, DEFAULT_RELIABILITY_POLICY),
    catalog: readJson(root, "packages/contracts/events/v1/catalog.json"),
    b26Runtime: readJson(root, "config/b26-event-runtime.json"),
    b26Fragment: readJson(
      root,
      "packages/contracts/events/v1/fragments/b26-reliability.events.json",
    ),
    registry: readJson(root, "packages/contracts/schemas/v1/registry.json"),
    sagaPolicy: readJson(root, DEFAULT_SAGA_POLICY),
    ownerPolicy: readJson(root, "config/p1r-data-ownership.v1.json"),
    eventFragments: listEventFragments(root),
  };
}

export function validateEventReliability(options = {}) {
  return validateEventReliabilityData(readEventReliabilityInputs(options));
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(scriptPath)
) {
  try {
    const report = validateEventReliability();
    if (process.argv.includes("--json"))
      console.log(JSON.stringify(report, null, 2));
    else {
      console.log(
        "P1R event reliability D2 " +
          report.result +
          " (" +
          report.summary.canonicalEvents +
          " canonical events, " +
          report.summary.reliabilitySchemas +
          " reliability schemas, retry=" +
          report.summary.retryMaxAttempts +
          ", runtimeStatus=" +
          report.summary.runtimeStatus +
          ").",
      );
      for (const error of report.errors) console.error("- " + error);
    }
    if (report.result !== "PASS") process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
