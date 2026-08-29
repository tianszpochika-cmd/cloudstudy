import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  readSagaRecoveryPolicy,
  transitionKey,
  validateApprovalDecision,
  validateCausationRecord,
  validateSagaRecoveryData,
} from "../../scripts/audit/p1r-saga-recovery-check.mjs";

const root = path.resolve(import.meta.dirname, "..", "..");
const baseline = readSagaRecoveryPolicy({ root });

function evaluate(mutate) {
  const input = structuredClone(baseline);
  mutate(input);
  return validateSagaRecoveryData(input);
}

function assertMutationFails(mutate, expected) {
  const report = evaluate(mutate);
  assert.equal(report.result, "FAIL", report.errors.join("\n"));
  assert.match(report.errors.join("\n"), expected);
}

test("Saga and manual recovery policy is a static D2 contract with B26 and M2 boundaries intact", () => {
  const report = validateSagaRecoveryData(structuredClone(baseline));
  assert.equal(report.result, "PASS", report.errors.join("\n"));
  assert.deepEqual(report.summary, {
    maturity: "D2_CONTRACT_READY",
    runtimeStatus: "NOT_RUNTIME_VERIFIED",
    sagaStates: 7,
    sagaStepStates: 8,
    compensationStates: 4,
    recoveryStates: 10,
    receiptFields: 22,
    retryBudget: 5,
  });
});

test("unknown policy fields and P2 promotion fail closed", () => {
  assertMutationFails((input) => {
    input.policy.runtimeProof = "PASS";
  }, /unknown or missing keys/);
  assertMutationFails((input) => {
    input.policy.manualRecovery.approval.liveApprovalEndpoint =
      "https://example.invalid";
  }, /unknown or missing keys/);
  assertMutationFails((input) => {
    input.policy.phase = "P2";
  }, /phase must remain P1/);
});

test("Saga and recovery illegal transitions cannot bypass compensation, review or reconciliation", () => {
  assertMutationFails((input) => {
    input.policy.saga.transitions.push({
      from: "FORWARD_COMPLETED",
      to: "FORWARD_RUNNING",
    });
  }, /terminal state FORWARD_COMPLETED cannot transition|forbidden transition FORWARD_COMPLETED->FORWARD_RUNNING is permitted/);
  assertMutationFails((input) => {
    input.policy.manualRecovery.transitions.push({
      from: "APPROVED",
      to: "CLOSED",
    });
  }, /forbidden transition APPROVED->CLOSED is permitted|manual recovery required transitions are incomplete/);
  assertMutationFails((input) => {
    input.policy.manualRecovery.forbiddenTransitions =
      input.policy.manualRecovery.forbiddenTransitions.filter(
        (entry) => transitionKey(entry) !== "EXECUTING->CLOSED",
      );
  }, /direct-close and re-execution transitions must be forbidden/);
});

test("root-event causation preserves source lineage and rejects rewritten roots", () => {
  const originalErrors = [];
  validateCausationRecord(
    baseline.policy.correlation,
    {
      eventId: "evt-origin-01",
      rootEventId: "evt-origin-01",
      causationEventId: "evt-origin-01",
      aggregateType: "assessment_attempt",
      aggregateId: "attempt-01",
      schemaVersion: "assessment.event.v1",
      requestId: "request-0001",
      traceId: "trace-0001",
      dedupeKey: "dedupe-0001",
      kind: "ORIGINAL_FACT",
      sourceRootEventId: "evt-origin-01",
    },
    originalErrors,
  );
  assert.deepEqual(originalErrors, []);

  const derivedErrors = [];
  validateCausationRecord(
    baseline.policy.correlation,
    {
      eventId: "evt-recovery-01",
      rootEventId: "evt-origin-01",
      causationEventId: "evt-delivery-failed-01",
      aggregateType: "assessment_attempt",
      aggregateId: "attempt-01",
      schemaVersion: "workflow.saga.v1",
      requestId: "request-0002",
      traceId: "trace-0002",
      dedupeKey: "dedupe-0002",
      kind: "DERIVED_CONTROL_EVENT",
      sourceRootEventId: "evt-origin-01",
    },
    derivedErrors,
  );
  assert.deepEqual(derivedErrors, []);

  const rewrittenRootErrors = [];
  validateCausationRecord(
    baseline.policy.correlation,
    {
      eventId: "evt-recovery-01",
      rootEventId: "evt-attacker-rewrite",
      causationEventId: "evt-delivery-failed-01",
      aggregateType: "assessment_attempt",
      aggregateId: "attempt-01",
      schemaVersion: "workflow.saga.v1",
      requestId: "request-0002",
      traceId: "trace-0002",
      dedupeKey: "dedupe-0002",
      kind: "DERIVED_CONTROL_EVENT",
      sourceRootEventId: "evt-origin-01",
    },
    rewrittenRootErrors,
  );
  assert.match(rewrittenRootErrors.join("\n"), /preserve source rootEventId/);
});

test("two-person approval requires a server-derived independent approver and immutable action binding", () => {
  const validErrors = [];
  validateApprovalDecision(
    baseline.policy.manualRecovery.approval,
    {
      recoveryId: "recovery-01",
      recoveryRevision: 1,
      actionDigest: "sha256:action-01",
      rootEventId: "evt-origin-01",
      aggregateId: "attempt-01",
      sourceOwnerService: "assessment-service",
      policyVersion: "iam.policy.v1",
      requesterPrincipalRef: "principal-requester",
      approverPrincipalRef: "principal-approver",
      decision: "APPROVED",
      decidedAt: "2029-12-31T23:00:00Z",
      expiresAt: "2030-01-01T00:00:00Z",
      requestId: "request-approval-01",
      traceId: "trace-approval-01",
      auditId: "audit-approval-01",
    },
    validErrors,
  );
  assert.deepEqual(validErrors, []);

  const selfApprovalErrors = [];
  validateApprovalDecision(
    baseline.policy.manualRecovery.approval,
    {
      recoveryId: "recovery-01",
      recoveryRevision: 1,
      actionDigest: "sha256:action-01",
      rootEventId: "evt-origin-01",
      aggregateId: "attempt-01",
      sourceOwnerService: "assessment-service",
      policyVersion: "iam.policy.v1",
      requesterPrincipalRef: "principal-requester",
      approverPrincipalRef: "principal-requester",
      decision: "APPROVED",
      decidedAt: "2029-12-31T23:00:00Z",
      expiresAt: "2030-01-01T00:00:00Z",
      requestId: "request-approval-01",
      traceId: "trace-approval-01",
      auditId: "audit-approval-01",
    },
    selfApprovalErrors,
  );
  assert.match(selfApprovalErrors.join("\n"), /different principals/);
  assertMutationFails((input) => {
    input.policy.manualRecovery.approval.requesterMayApprove = true;
  }, /two-person review must be requester plus one independent approver/);
  assertMutationFails((input) => {
    input.policy.manualRecovery.approval.forbiddenClientAuthorityFields = [];
  }, /client approval authority fields must be forbidden/);
});

test("cross-owner writes, RPC/2PC, source rollback and direct client recovery fail closed", () => {
  assertMutationFails((input) => {
    input.policy.owners.workflow.mayWriteForeignDomainSchema = true;
  }, /workflow-service must coordinate without foreign schema writes/);
  assertMutationFails((input) => {
    input.policy.compensation.execution.foreignSchemaWrite = "ALLOWED";
  }, /cannot write foreign schemas/);
  assertMutationFails((input) => {
    input.policy.compensation.execution.kafkaRpc = true;
  }, /must not use Kafka RPC or 2PC/);
  assertMutationFails((input) => {
    input.policy.compensation.execution.sourceFactRollback = "ALLOWED";
  }, /cannot write foreign schemas or roll back immutable source facts/);
  assertMutationFails((input) => {
    input.policy.manualRecovery.directDomainWrite = true;
  }, /cannot directly write domain facts/);
});

test("receipt, reconciliation and error routing cannot close a ticket or retry unsafe failures", () => {
  assertMutationFails((input) => {
    input.policy.receipt.requiredFields =
      input.policy.receipt.requiredFields.filter(
        (field) => field !== "rootEventId",
      );
  }, /receipt required fields are incomplete/);
  assertMutationFails((input) => {
    input.policy.manualRecovery.reconciliation.ticketOrDlqCloseIsNotReconciliation = false;
  }, /ticket or DLQ close cannot substitute/);
  assertMutationFails((input) => {
    input.policy.manualRecovery.closure.requiredPostcheckStatus = "MISMATCH";
  }, /closure must require matched postcheck/);
  assertMutationFails((input) => {
    input.policy.errorRouting.errors.find(
      (entry) => entry.code === "SCHEMA_INVALID",
    ).action = "RETRY";
  }, /SCHEMA_INVALID must not be retried/);
  assertMutationFails((input) => {
    input.policy.errorRouting.errors.find(
      (entry) => entry.code === "UNKNOWN_FAILURE",
    ).classification = "RETRYABLE";
  }, /unknown failures must not retry automatically/);
});

test("B26 and this policy cannot be promoted to runtime evidence by static fields", () => {
  assertMutationFails((input) => {
    input.policy.runtimeStatus = "RUNTIME_VERIFIED";
  }, /runtimeStatus must remain NOT_RUNTIME_VERIFIED/);
  assertMutationFails((input) => {
    input.policy.sourceBoundaries.b26.mode = "runtime";
  }, /B26 boundary must remain static-only, pending and NO-GO/);
  assertMutationFails((input) => {
    input.b26.runtimeStatus = "PASS";
  }, /actual B26 input must remain static-only, pending and NO-GO/);
  assertMutationFails((input) => {
    input.policy.runtimeBoundary.m2_006.status = "PASS";
  }, /M2-006 must retain actual Saga\/recovery runtime responsibility/);
});
