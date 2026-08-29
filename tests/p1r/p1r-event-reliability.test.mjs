import assert from "node:assert/strict";
import test from "node:test";
import {
  readEventReliabilityInputs,
  validateEventReliabilityData,
} from "../../scripts/audit/p1r-event-reliability-check.mjs";

const baseline = readEventReliabilityInputs();

function cloneInputs() {
  return structuredClone(baseline);
}

test("canonical M1-007 reliability policy passes without runtime promotion", function () {
  const report = validateEventReliabilityData(cloneInputs());
  assert.equal(report.result, "PASS", report.errors.join("\n"));
  assert.equal(report.summary.taskId, "P1R-M1-007");
  assert.equal(report.summary.maturity, "D2_CONTRACT_READY");
  assert.equal(report.summary.runtimeStatus, "NOT_RUNTIME_VERIFIED");
  assert.equal(report.summary.canonicalEvents, 7);
  assert.equal(report.summary.reliabilitySchemas, 8);
  assert.equal(report.summary.retryMaxAttempts, 5);
  assert.equal(report.summary.b26Mode, "static-only");
  assert.equal(report.summary.b26RuntimeStatus, "pending");
  assert.equal(report.summary.b26Decision, "NO-GO");
  assert.equal(report.summary.sagaRuntimeStatus, "NOT_RUNTIME_VERIFIED");
});

const mutations = [
  [
    "unknown policy field",
    function (input) {
      input.policy.runtimeProof = "PASS";
    },
    /unknown or missing keys/,
  ],
  [
    "runtime promotion",
    function (input) {
      input.policy.runtimeStatus = "RUNTIME_VERIFIED";
    },
    /NOT_RUNTIME_VERIFIED/,
  ],
  [
    "maturity promotion",
    function (input) {
      input.policy.maturity = "D4_RUNTIME_VERIFIED";
    },
    /must remain D2/,
  ],
  [
    "wire contract mutation",
    function (input) {
      input.policy.catalog.wireContractMutation = "ALLOWED";
    },
    /cannot mutate/,
  ],
  [
    "canonical event deletion",
    function (input) {
      input.policy.catalog.currentCanonicalEvents.pop();
    },
    /canonical event set/,
  ],
  [
    "source reference drift",
    function (input) {
      input.policy.sourceRefs.pop();
    },
    /sourceRefs drifted/,
  ],
  [
    "B26 authority promotion",
    function (input) {
      input.policy.historicalCandidate.authority = "RUNTIME_SOURCE";
    },
    /B26 candidate boundary/,
  ],
  [
    "B26 gap hidden",
    function (input) {
      input.policy.historicalCandidate.missingRootEventId = false;
    },
    /known-gap mapping/,
  ],
  [
    "rootEventId removed",
    function (input) {
      input.policy.identityAndLineage.requiredFields.splice(1, 1);
    },
    /context fields/,
  ],
  [
    "client event identity",
    function (input) {
      input.policy.identityAndLineage.clientMaySupplyIdentity = true;
    },
    /client-supplied/,
  ],
  [
    "root lineage drift",
    function (input) {
      input.policy.identityAndLineage.rootEvent.rootEventId = "COPY_IF_PRESENT";
    },
    /root event lineage/,
  ],
  [
    "retry gets new eventId",
    function (input) {
      input.policy.identityAndLineage.retry.eventId = "NEW";
    },
    /retry must preserve/,
  ],
  [
    "replay changes source event",
    function (input) {
      input.policy.identityAndLineage.replay.sourceEventId = "NEW";
    },
    /replay must preserve sourceEventId/,
  ],
  [
    "replay control event is client supplied",
    function (input) {
      input.policy.identityAndLineage.replay.controlEventId = "PRESERVE";
    },
    /controlEventId must be server-generated/,
  ],
  [
    "Outbox cross-owner storage",
    function (input) {
      input.policy.outbox.storage = "SHARED_SCHEMA";
    },
    /owner-local/,
  ],
  [
    "Outbox record schema reference drift",
    function (input) {
      input.policy.outbox.recordSchemaRef = "platform.event.publish-receipt.v1";
    },
    /Outbox schema references/,
  ],
  [
    "Outbox transaction split",
    function (input) {
      input.policy.outbox.aggregateAndOutboxSameTransaction = false;
    },
    /commit atomically/,
  ],
  [
    "exactly-once claim",
    function (input) {
      input.policy.outbox.exactlyOnceClaim = true;
    },
    /delivery semantics/,
  ],
  [
    "publish before broker ack",
    function (input) {
      input.policy.outbox.ackRule = "MARK_BEFORE_ACK";
    },
    /broker ack/,
  ],
  [
    "illegal Outbox transition",
    function (input) {
      input.policy.outbox.transitions[0].to = "PUBLISHED";
    },
    /transitions drifted/,
  ],
  [
    "terminal Outbox transition",
    function (input) {
      input.policy.outbox.transitions.push({
        from: "PUBLISHED",
        action: "REOPEN",
        to: "PENDING",
      });
    },
    /transitions drifted|terminal state/,
  ],
  [
    "consumer dedupe key drift",
    function (input) {
      input.policy.consumer.deduplication.primaryUniqueKey = ["eventId"];
    },
    /dedupe key/,
  ],
  [
    "consumer receipt schema reference drift",
    function (input) {
      input.policy.consumer.receiptSchemaRef = "platform.event.dlq-record.v1";
    },
    /consumer owner, receipt, or delivery/,
  ],
  [
    "consumer effect not atomic",
    function (input) {
      input.policy.consumer.deduplication.effectAndReceiptSameOwnerTransaction = false;
    },
    /effect and receipt must be atomic/,
  ],
  [
    "offset commit before effect",
    function (input) {
      input.policy.consumer.deduplication.offsetCommit = "BEFORE_EFFECT";
    },
    /offset commit/,
  ],
  [
    "consumer illegal transition",
    function (input) {
      input.policy.consumer.transitions[1].to = "DLQ";
    },
    /transitions drifted/,
  ],
  [
    "unbounded retry",
    function (input) {
      input.policy.retryBudget.bounded = false;
    },
    /retry budget drifted/,
  ],
  [
    "retry over budget",
    function (input) {
      input.policy.retryBudget.maxAttempts = 99;
    },
    /retry budget drifted/,
  ],
  [
    "unknown failure becomes retryable",
    function (input) {
      input.policy.retryBudget.unknownFailureCode = "RETRY";
    },
    /retry budget drifted/,
  ],
  [
    "DLQ loses root identity",
    function (input) {
      input.policy.deadLetter.preserveIdentityFields.splice(1, 1);
    },
    /DLQ identity/,
  ],
  [
    "DLQ record schema reference drift",
    function (input) {
      input.policy.deadLetter.recordSchemaRef =
        "platform.event.publish-receipt.v1";
    },
    /DLQ source/,
  ],
  [
    "DLQ direct domain write",
    function (input) {
      input.policy.deadLetter.domainFactsDirectWrite = "ALLOWED";
    },
    /DLQ security/,
  ],
  [
    "replay bypasses consumer path",
    function (input) {
      input.policy.replay.sameConsumerPath = false;
    },
    /sameConsumerPath/,
  ],
  [
    "replay request schema reference drift",
    function (input) {
      input.policy.replay.requestSchemaRef = "platform.event.dlq-record.v1";
    },
    /replay source or client boundary/,
  ],
  [
    "replay without independent approval",
    function (input) {
      input.policy.replay.requesterMustDifferFromApprover = false;
    },
    /requesterMustDifferFromApprover/,
  ],
  [
    "client-triggered replay",
    function (input) {
      input.policy.replay.clientTriggered = true;
    },
    /replay source or client boundary/,
  ],
  [
    "ordering partition drift",
    function (input) {
      input.policy.ordering.partitionKey = "eventId";
    },
    /ordering policy/,
  ],
  [
    "workflow foreign-domain write",
    function (input) {
      input.policy.sagaRecovery.workflowMayWriteForeignDomainFacts = true;
    },
    /Saga recovery boundary/,
  ],
  [
    "distributed transaction",
    function (input) {
      input.policy.sagaRecovery.twoPhaseCommit = true;
    },
    /Saga recovery boundary/,
  ],
  [
    "reliability schema removed",
    function (input) {
      input.policy.reliabilitySchemaRegistry.requiredSchemas.pop();
    },
    /reliability schema set/,
  ],
  [
    "reliability runtime record claim",
    function (input) {
      input.policy.reliabilitySchemaRegistry.runtimeRecordPresenceClaim =
        "PASS";
    },
    /record safety/,
  ],
  [
    "runtime exclusion removed",
    function (input) {
      input.policy.runtimeEvidenceBoundary.cannotBeSatisfiedBy.pop();
    },
    /runtime evidence exclusions/,
  ],
  [
    "catalog event promotion",
    function (input) {
      input.catalog.events.find(function (event) {
        return event.status === "HISTORICAL_CANDIDATE";
      }).status = "CANONICAL_D2";
    },
    /catalog canonical events/,
  ],
  [
    "catalog unknown field",
    function (input) {
      input.catalog.runtimeProof = "PASS";
    },
    /event catalog: event catalog keys|runtimeProof/,
  ],
  [
    "catalog runtime promotion",
    function (input) {
      input.catalog["x-p1r-event-governance"].runtimeStatus =
        "RUNTIME_VERIFIED";
    },
    /catalog must remain NOT_RUNTIME_VERIFIED/,
  ],
  [
    "B26 runtime promotion",
    function (input) {
      input.b26Runtime.runtimeStatus = "PASS";
    },
    /B26 static candidate|B26 must remain/,
  ],
  [
    "B26 retry drift",
    function (input) {
      input.b26Runtime.consumerReliability.retry.maxAttempts = 7;
    },
    /B26 static candidate|B26 retry attempts/,
  ],
  [
    "schema removed",
    function (input) {
      delete input.registry.schemas["platform.event.dlq-record.v1"];
    },
    /missing platform.event.dlq-record/,
  ],
  [
    "schema allows unknown fields",
    function (input) {
      input.registry.schemas[
        "platform.event.replay-request.v1"
      ].additionalProperties = true;
    },
    /closed object schema/,
  ],
  [
    "schema required field removed",
    function (input) {
      input.registry.schemas[
        "platform.event.consumer-effect-receipt.v1"
      ].required.pop();
    },
    /required fields/,
  ],
  [
    "publish receipt loses state-failure binding",
    function (input) {
      input.registry.schemas["platform.event.publish-receipt.v1"].allOf.pop();
    },
    /bind failureCode/,
  ],
  [
    "Outbox record loses retry-state binding",
    function (input) {
      input.registry.schemas["platform.event.outbox-record.v1"].allOf.pop();
    },
    /Outbox record must bind|structure drifted/,
  ],
  [
    "Outbox record state drift",
    function (input) {
      input.registry.schemas[
        "platform.event.outbox-record.v1"
      ].properties.state.enum.pop();
    },
    /Outbox record states|structure drifted/,
  ],
  [
    "schema pattern weakened",
    function (input) {
      input.registry.schemas[
        "platform.event.reliability-context.v1"
      ].properties.eventId.pattern = ".*";
    },
    /structure drifted/,
  ],
  [
    "schema nested runtime proof",
    function (input) {
      input.registry.schemas[
        "platform.event.consumer-effect-receipt.v1"
      ].properties.effectDigest.runtimeProof = "PASS";
    },
    /structure drifted/,
  ],
  [
    "recovery task state drift",
    function (input) {
      input.registry.schemas[
        "platform.workflow.recovery-task.v1"
      ].properties.state.enum.pop();
    },
    /recovery task states|structure drifted/,
  ],
  [
    "recovery closure loses precheck evidence",
    function (input) {
      const required =
        input.registry.schemas["platform.workflow.recovery-closure-receipt.v1"]
          .required;
      required.splice(required.indexOf("precheckReconciliationId"), 1);
    },
    /required fields|missing required evidence|structure drifted/,
  ],
  [
    "recovery closure accepts rejected approval",
    function (input) {
      input.registry.schemas[
        "platform.workflow.recovery-closure-receipt.v1"
      ].properties.approvalDecision.const = "REJECTED";
    },
    /bind CLOSED|structure drifted/,
  ],
  [
    "replay loses action binding",
    function (input) {
      const required =
        input.registry.schemas["platform.event.replay-request.v1"].required;
      required.splice(required.indexOf("actionDigest"), 1);
    },
    /required fields|structure drifted/,
  ],
  [
    "sensitive receipt field",
    function (input) {
      input.registry.schemas[
        "platform.event.publish-receipt.v1"
      ].properties.authorizationToken = { type: "string" };
    },
    /forbidden sensitive field/,
  ],
  [
    "Saga runtime promotion",
    function (input) {
      input.sagaPolicy.runtimeStatus = "RUNTIME_VERIFIED";
    },
    /Saga recovery policy/,
  ],
  [
    "Saga unknown shape",
    function (input) {
      input.sagaPolicy.live = true;
    },
    /Saga recovery policy/,
  ],
  [
    "Saga requester self-approval",
    function (input) {
      input.sagaPolicy.manualRecovery.approval.requesterMayApprove = true;
    },
    /Saga recovery policy/,
  ],
  [
    "Saga foreign schema write",
    function (input) {
      input.sagaPolicy.owners.workflow.mayWriteForeignDomainSchema = true;
    },
    /Saga recovery policy/,
  ],
  [
    "Saga Kafka RPC",
    function (input) {
      input.sagaPolicy.owners.workflow.kafkaRpc = true;
    },
    /Saga recovery policy/,
  ],
  [
    "Saga closes without postcheck",
    function (input) {
      input.sagaPolicy.manualRecovery.closure.closeOnlyFrom = "EXECUTING";
    },
    /Saga recovery policy/,
  ],
];

for (const [name, mutate, expected] of mutations) {
  test("fails closed: " + name, function () {
    const input = cloneInputs();
    mutate(input);
    const report = validateEventReliabilityData(input);
    assert.equal(report.result, "FAIL", name + " unexpectedly passed");
    assert.match(report.errors.join("\n"), expected);
  });
}

test("all reliability record schemas are additive, closed and generated from the shared registry", function () {
  for (const schemaName of baseline.policy.reliabilitySchemaRegistry
    .requiredSchemas) {
    const schema = baseline.registry.schemas[schemaName];
    assert.ok(schema, schemaName);
    assert.equal(schema.additionalProperties, false, schemaName);
    assert.equal(
      new Set(schema.required).size,
      schema.required.length,
      schemaName,
    );
  }
});
