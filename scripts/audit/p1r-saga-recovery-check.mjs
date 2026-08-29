import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const defaultRoot = path.resolve(import.meta.dirname, "..", "..");

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function add(errors, condition, message) {
  if (!condition) errors.push(message);
}

function hasAll(actual, expected) {
  return (
    Array.isArray(actual) && expected.every((item) => actual.includes(item))
  );
}

function hasExactKeys(value, expected, label, errors) {
  if (!isRecord(value)) {
    errors.push(`${label} must be an object`);
    return;
  }
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (
    actual.length !== wanted.length ||
    actual.some((key, index) => key !== wanted[index])
  ) {
    errors.push(`${label} has unknown or missing keys`);
  }
}

function stringList(value, label, errors) {
  add(
    errors,
    Array.isArray(value) &&
      value.every((item) => typeof item === "string" && item.length > 0),
    `${label} must be a non-empty string list`,
  );
  add(
    errors,
    Array.isArray(value) && new Set(value).size === value.length,
    `${label} must not contain duplicates`,
  );
}

export function transitionKey(transition) {
  return `${transition?.from}->${transition?.to}`;
}

function validateTransitionList(list, states, label, errors) {
  add(errors, Array.isArray(list), `${label} must be an array`);
  if (!Array.isArray(list)) return;
  const knownStates = Array.isArray(states) ? states : [];
  const seen = new Set();
  for (const transition of list) {
    hasExactKeys(transition, ["from", "to"], `${label} transition`, errors);
    add(
      errors,
      knownStates.includes(transition?.from),
      `${label} has an unknown from state`,
    );
    add(
      errors,
      knownStates.includes(transition?.to),
      `${label} has an unknown to state`,
    );
    const key = transitionKey(transition);
    add(errors, !seen.has(key), `${label} has duplicate transition ${key}`);
    seen.add(key);
  }
}

function validateMachine(machine, label, errors, options = {}) {
  const { extraKeys = [], requireForbidden = false } = options;
  const expectedKeys = [
    "recordRequiredFields",
    "states",
    "initialState",
    "terminalStates",
    "transitions",
    ...extraKeys,
  ];
  if (requireForbidden) expectedKeys.push("forbiddenTransitions");
  hasExactKeys(machine, expectedKeys, label, errors);
  stringList(
    machine?.recordRequiredFields,
    `${label}.recordRequiredFields`,
    errors,
  );
  stringList(machine?.states, `${label}.states`, errors);
  stringList(machine?.terminalStates, `${label}.terminalStates`, errors);
  const states = Array.isArray(machine?.states) ? machine.states : [];
  const terminalStates = Array.isArray(machine?.terminalStates)
    ? machine.terminalStates
    : [];
  add(
    errors,
    states.includes(machine?.initialState),
    `${label}.initialState must be a declared state`,
  );
  add(
    errors,
    terminalStates.every((state) => states.includes(state)),
    `${label}.terminalStates must be declared`,
  );
  validateTransitionList(
    machine?.transitions,
    states,
    `${label}.transitions`,
    errors,
  );
  for (const transition of machine?.transitions ?? []) {
    add(
      errors,
      !terminalStates.includes(transition.from),
      `${label} terminal state ${transition.from} cannot transition`,
    );
  }
  if (!requireForbidden) return;
  validateTransitionList(
    machine?.forbiddenTransitions,
    states,
    `${label}.forbiddenTransitions`,
    errors,
  );
  const permitted = new Set((machine?.transitions ?? []).map(transitionKey));
  for (const transition of machine?.forbiddenTransitions ?? []) {
    add(
      errors,
      !permitted.has(transitionKey(transition)),
      `${label} forbidden transition ${transitionKey(transition)} is permitted`,
    );
  }
}

export function validateApprovalDecision(approvalPolicy, decision, errors) {
  hasExactKeys(
    decision,
    [
      "recoveryId",
      "recoveryRevision",
      "actionDigest",
      "rootEventId",
      "aggregateId",
      "sourceOwnerService",
      "policyVersion",
      "requesterPrincipalRef",
      "approverPrincipalRef",
      "decision",
      "decidedAt",
      "expiresAt",
      "requestId",
      "traceId",
      "auditId",
    ],
    "approval decision",
    errors,
  );
  add(
    errors,
    decision?.requesterPrincipalRef !== decision?.approverPrincipalRef,
    "approval requester and approver must be different principals",
  );
  add(
    errors,
    approvalPolicy?.decisions?.includes(decision?.decision),
    "approval decision must use a declared decision",
  );
  add(
    errors,
    typeof decision?.expiresAt === "string" && decision.expiresAt.length > 0,
    "approval decision requires expiry",
  );
  add(
    errors,
    typeof decision?.auditId === "string" && decision.auditId.length > 0,
    "approval decision requires auditId",
  );
}

export function validateCausationRecord(correlationPolicy, record, errors) {
  hasExactKeys(
    record,
    [
      "eventId",
      "rootEventId",
      "causationEventId",
      "aggregateType",
      "aggregateId",
      "schemaVersion",
      "requestId",
      "traceId",
      "dedupeKey",
      "kind",
      "sourceRootEventId",
    ],
    "causation record",
    errors,
  );
  for (const key of correlationPolicy?.requiredFields ?? []) {
    add(
      errors,
      typeof record?.[key] === "string" && record[key].length > 0,
      `causation record requires ${key}`,
    );
  }
  if (record?.kind === "ORIGINAL_FACT") {
    add(
      errors,
      record.rootEventId === record.eventId,
      "original fact rootEventId must equal eventId",
    );
  }
  if (record?.kind === "DERIVED_CONTROL_EVENT") {
    add(
      errors,
      record.rootEventId === record.sourceRootEventId,
      "derived control event must preserve source rootEventId",
    );
    add(
      errors,
      typeof record.causationEventId === "string" &&
        record.causationEventId.length > 0,
      "derived control event requires causationEventId",
    );
  }
}

function checkExactObjects(policy, errors) {
  hasExactKeys(
    policy,
    [
      "policyVersion",
      "schema",
      "task",
      "phase",
      "maturity",
      "runtimeStatus",
      "scope",
      "sourceBoundaries",
      "correlation",
      "owners",
      "saga",
      "compensation",
      "manualRecovery",
      "receipt",
      "audit",
      "errorRouting",
      "runtimeBoundary",
      "prohibitions",
    ],
    "policy",
    errors,
  );
  hasExactKeys(
    policy?.sourceBoundaries,
    ["m1_006", "b26", "catalogInteraction"],
    "sourceBoundaries",
    errors,
  );
  hasExactKeys(
    policy?.sourceBoundaries?.m1_006,
    ["task", "runtimeStatus", "catalogRole"],
    "sourceBoundaries.m1_006",
    errors,
  );
  hasExactKeys(
    policy?.sourceBoundaries?.b26,
    [
      "path",
      "mode",
      "runtimeStatus",
      "defaultDecision",
      "classification",
      "mayNotBePromotedByThisPolicy",
    ],
    "sourceBoundaries.b26",
    errors,
  );
  hasExactKeys(
    policy?.sourceBoundaries?.catalogInteraction,
    [
      "frozenM1_006Catalog",
      "rootEventProjection",
      "mayNotMutateB26PayloadOrCanonicalEnvelope",
    ],
    "sourceBoundaries.catalogInteraction",
    errors,
  );
  hasExactKeys(
    policy?.correlation,
    [
      "requiredFields",
      "serverDerivedFields",
      "forbiddenClientAuthorityFields",
      "rootEventRule",
    ],
    "correlation",
    errors,
  );
  hasExactKeys(
    policy?.correlation?.rootEventRule,
    ["originalFact", "derivedControlEvent", "immutable"],
    "correlation.rootEventRule",
    errors,
  );
  hasExactKeys(
    policy?.owners,
    ["workflow", "audit", "domain", "authorization"],
    "owners",
    errors,
  );
  hasExactKeys(
    policy?.owners?.workflow,
    [
      "service",
      "role",
      "factWriteBoundary",
      "mayWriteForeignDomainSchema",
      "commands",
      "kafkaRpc",
      "twoPhaseCommit",
    ],
    "owners.workflow",
    errors,
  );
  hasExactKeys(
    policy?.owners?.audit,
    [
      "service",
      "role",
      "factWriteBoundary",
      "mayWriteForeignDomainSchema",
      "immutable",
    ],
    "owners.audit",
    errors,
  );
  hasExactKeys(
    policy?.owners?.domain,
    [
      "serviceSelector",
      "factWriteBoundary",
      "compensationExecution",
      "mustReturnReceipt",
    ],
    "owners.domain",
    errors,
  );
  hasExactKeys(
    policy?.owners?.authorization,
    ["service", "actorAndTenant", "decisionFailure"],
    "owners.authorization",
    errors,
  );
  hasExactKeys(
    policy?.saga,
    [
      "recordRequiredFields",
      "states",
      "initialState",
      "terminalStates",
      "transitions",
      "forbiddenTransitions",
      "step",
    ],
    "saga",
    errors,
  );
  hasExactKeys(
    policy?.saga?.step,
    [
      "recordRequiredFields",
      "states",
      "initialState",
      "terminalStates",
      "transitions",
      "compensationDispositions",
    ],
    "saga.step",
    errors,
  );
  hasExactKeys(
    policy?.compensation,
    [
      "recordRequiredFields",
      "states",
      "initialState",
      "terminalStates",
      "transitions",
      "execution",
    ],
    "compensation",
    errors,
  );
  hasExactKeys(
    policy?.compensation?.execution,
    [
      "idempotent",
      "versioned",
      "idempotencyScope",
      "foreignSchemaWrite",
      "sourceFactRollback",
      "transport",
      "kafkaRpc",
      "twoPhaseCommit",
      "ownerReceiptRequiredBeforeApplied",
    ],
    "compensation.execution",
    errors,
  );
  hasExactKeys(
    policy?.manualRecovery,
    [
      "recordRequiredFields",
      "states",
      "initialState",
      "terminalStates",
      "transitions",
      "forbiddenTransitions",
      "approval",
      "reconciliation",
      "closure",
      "clientTriggered",
      "directDomainWrite",
    ],
    "manualRecovery",
    errors,
  );
  hasExactKeys(
    policy?.manualRecovery?.approval,
    [
      "mode",
      "distinctPrincipalCount",
      "independentApproverCount",
      "requesterMayApprove",
      "serverDerivedFields",
      "forbiddenClientAuthorityFields",
      "recordRequiredFields",
      "decisions",
      "bindingFields",
      "idempotency",
      "auditRequired",
    ],
    "manualRecovery.approval",
    errors,
  );
  hasExactKeys(
    policy?.manualRecovery?.reconciliation,
    [
      "recordRequiredFields",
      "statuses",
      "closeRequiresPostcheckStatus",
      "ticketOrDlqCloseIsNotReconciliation",
    ],
    "manualRecovery.reconciliation",
    errors,
  );
  hasExactKeys(
    policy?.manualRecovery?.closure,
    [
      "requiredEvidence",
      "closeOnlyFrom",
      "requiredPostcheckStatus",
      "missingEvidenceAction",
    ],
    "manualRecovery.closure",
    errors,
  );
  hasExactKeys(
    policy?.receipt,
    [
      "types",
      "outcomes",
      "requiredFields",
      "immutableAfterIssue",
      "sensitivePayloadAllowed",
    ],
    "receipt",
    errors,
  );
  hasExactKeys(
    policy?.audit,
    [
      "service",
      "immutable",
      "requiredCorrelation",
      "auditUnavailableBlocksClose",
    ],
    "audit",
    errors,
  );
  hasExactKeys(
    policy?.errorRouting,
    ["retryBudget", "errors"],
    "errorRouting",
    errors,
  );
  hasExactKeys(
    policy?.errorRouting?.retryBudget,
    [
      "bounded",
      "maxAttempts",
      "backoff",
      "baseDelayMs",
      "maxDelayMs",
      "source",
    ],
    "errorRouting.retryBudget",
    errors,
  );
  hasExactKeys(
    policy?.runtimeBoundary,
    [
      "thisPolicy",
      "prohibitedClaims",
      "m2_005",
      "m2_006",
      "m8RecoveryEvidence",
    ],
    "runtimeBoundary",
    errors,
  );
  for (const [key, label] of [
    ["m2_005", "runtimeBoundary.m2_005"],
    ["m2_006", "runtimeBoundary.m2_006"],
    ["m8RecoveryEvidence", "runtimeBoundary.m8RecoveryEvidence"],
  ]) {
    hasExactKeys(
      policy?.runtimeBoundary?.[key],
      ["task", "status", "responsibility"],
      label,
      errors,
    );
  }
}

function validateIdentifiers(policy, b26, errors) {
  add(
    errors,
    policy?.policyVersion === "1.0.0",
    "policyVersion must remain 1.0.0",
  );
  add(
    errors,
    policy?.schema === "p1r.saga-recovery.policy.v1",
    "schema must remain p1r.saga-recovery.policy.v1",
  );
  add(errors, policy?.task === "P1R-M1-007", "task must remain P1R-M1-007");
  add(errors, policy?.phase === "P1", "policy phase must remain P1");
  add(
    errors,
    policy?.maturity === "D2_CONTRACT_READY",
    "policy maturity must remain D2_CONTRACT_READY",
  );
  add(
    errors,
    policy?.runtimeStatus === "NOT_RUNTIME_VERIFIED",
    "runtimeStatus must remain NOT_RUNTIME_VERIFIED",
  );
  stringList(policy?.scope, "scope", errors);
  add(
    errors,
    hasAll(policy?.scope, [
      "INT-P1-017",
      "E2E-P1-RECOVERY",
      "SAGA_AND_MANUAL_RECOVERY_CONTROL_PLANE",
    ]),
    "scope must cover INT-P1-017 and E2E-P1-RECOVERY only as a Saga/recovery control plane",
  );
  add(
    errors,
    policy?.sourceBoundaries?.m1_006?.task === "P1R-M1-006" &&
      policy.sourceBoundaries.m1_006.runtimeStatus === "NOT_RUNTIME_VERIFIED",
    "M1-006 must remain a NOT_RUNTIME_VERIFIED dependency",
  );
  add(
    errors,
    policy?.sourceBoundaries?.b26?.path === "config/b26-event-runtime.json",
    "B26 source path must remain exact",
  );
  add(
    errors,
    policy?.sourceBoundaries?.b26?.mode === "static-only" &&
      policy.sourceBoundaries.b26.runtimeStatus === "pending" &&
      policy.sourceBoundaries.b26.defaultDecision === "NO-GO",
    "B26 boundary must remain static-only, pending and NO-GO",
  );
  add(
    errors,
    policy?.sourceBoundaries?.b26?.mayNotBePromotedByThisPolicy === true,
    "B26 promotion must be prohibited",
  );
  add(
    errors,
    policy?.sourceBoundaries?.catalogInteraction?.frozenM1_006Catalog ===
      "READ_ONLY_DEPENDENCY",
    "M1-006 catalog must remain read-only",
  );
  add(
    errors,
    policy?.sourceBoundaries?.catalogInteraction
      ?.mayNotMutateB26PayloadOrCanonicalEnvelope === true,
    "M1-007 Saga policy must not mutate B26 payloads or canonical envelopes",
  );
  add(
    errors,
    b26?.mode === "static-only" &&
      b26?.runtimeStatus === "pending" &&
      b26?.defaultDecision === "NO-GO",
    "actual B26 input must remain static-only, pending and NO-GO",
  );
}

function validateCorrelationAndOwners(policy, errors) {
  for (const [value, label] of [
    [policy?.correlation?.requiredFields, "correlation.requiredFields"],
    [
      policy?.correlation?.serverDerivedFields,
      "correlation.serverDerivedFields",
    ],
    [
      policy?.correlation?.forbiddenClientAuthorityFields,
      "correlation.forbiddenClientAuthorityFields",
    ],
  ]) {
    stringList(value, label, errors);
  }
  add(
    errors,
    hasAll(policy?.correlation?.requiredFields, [
      "eventId",
      "rootEventId",
      "aggregateId",
      "schemaVersion",
    ]),
    "correlation must require eventId/rootEventId/aggregateId/schemaVersion",
  );
  add(
    errors,
    hasAll(policy?.correlation?.serverDerivedFields, [
      "eventId",
      "rootEventId",
      "causationEventId",
      "actorRef",
      "tenantRef",
    ]),
    "correlation identities must be server-derived",
  );
  add(
    errors,
    hasAll(policy?.correlation?.forbiddenClientAuthorityFields, [
      "eventId",
      "rootEventId",
      "actorRef",
      "tenantRef",
      "approverRef",
    ]),
    "client authority injection must be forbidden",
  );
  add(
    errors,
    policy?.correlation?.rootEventRule?.originalFact ===
      "rootEventId-equals-eventId" &&
      policy.correlation.rootEventRule?.immutable === true,
    "root event inheritance must be immutable",
  );
  add(
    errors,
    policy?.owners?.workflow?.service === "workflow-service" &&
      policy.owners.workflow.mayWriteForeignDomainSchema === false,
    "workflow-service must coordinate without foreign schema writes",
  );
  add(
    errors,
    policy?.owners?.workflow?.commands ===
      "VERSIONED_OWNER_API_OR_EVENT_ONLY" &&
      policy.owners.workflow.kafkaRpc === false &&
      policy.owners.workflow.twoPhaseCommit === false,
    "workflow-service must use versioned owner operations without Kafka RPC or 2PC",
  );
  add(
    errors,
    policy?.owners?.audit?.service === "audit-service" &&
      policy.owners.audit.immutable === true &&
      policy.owners.audit.mayWriteForeignDomainSchema === false,
    "audit-service must own immutable audit only",
  );
  add(
    errors,
    policy?.owners?.domain?.serviceSelector === "SOURCE_DOMAIN_OWNER" &&
      policy.owners.domain.factWriteBoundary === "own-schema-only" &&
      policy.owners.domain.mustReturnReceipt === true,
    "domain owner receipt and own-schema boundary are required",
  );
  add(
    errors,
    policy?.owners?.authorization?.service === "iam-service" &&
      policy.owners.authorization.actorAndTenant === "SERVER_DERIVED" &&
      policy.owners.authorization.decisionFailure === "FAIL_CLOSED",
    "approval authority must be IAM server-derived and fail closed",
  );
}

function validateSagaAndCompensation(policy, errors) {
  const sagaMachine = { ...policy?.saga };
  delete sagaMachine.step;
  validateMachine(sagaMachine, "saga", errors, { requireForbidden: true });
  add(
    errors,
    hasAll(policy?.saga?.recordRequiredFields, [
      "sagaId",
      "rootEventId",
      "sourceEventId",
      "aggregateId",
      "state",
      "auditId",
    ]),
    "saga record must retain identity, root, state and audit fields",
  );
  add(
    errors,
    policy?.saga?.initialState === "NEW",
    "saga initial state must be NEW",
  );
  add(
    errors,
    hasAll(policy?.saga?.terminalStates, [
      "FORWARD_COMPLETED",
      "COMPENSATED",
      "MANUAL_RECOVERY_REQUIRED",
    ]),
    "saga terminal states are incomplete",
  );
  const sagaTransitions = new Set(
    (policy?.saga?.transitions ?? []).map(transitionKey),
  );
  add(
    errors,
    hasAll(
      [...sagaTransitions],
      [
        "NEW->FORWARD_RUNNING",
        "FORWARD_RUNNING->COMPENSATION_PENDING",
        "COMPENSATING->COMPENSATED",
      ],
    ),
    "saga required transitions are incomplete",
  );
  const sagaForbidden = new Set(
    (policy?.saga?.forbiddenTransitions ?? []).map(transitionKey),
  );
  add(
    errors,
    hasAll(
      [...sagaForbidden],
      [
        "NEW->FORWARD_COMPLETED",
        "FORWARD_COMPLETED->FORWARD_RUNNING",
        "COMPENSATED->FORWARD_COMPLETED",
        "MANUAL_RECOVERY_REQUIRED->FORWARD_RUNNING",
      ],
    ),
    "saga forbidden transitions are incomplete",
  );

  validateMachine(policy?.saga?.step, "saga.step", errors, {
    extraKeys: ["compensationDispositions"],
  });
  add(
    errors,
    hasAll(policy?.saga?.step?.recordRequiredFields, [
      "stepId",
      "sagaId",
      "ownerService",
      "idempotencyKey",
      "expectedAggregateVersion",
      "rootEventId",
      "compensationDisposition",
      "auditId",
    ]),
    "saga step required fields are incomplete",
  );
  add(
    errors,
    hasAll(policy?.saga?.step?.compensationDispositions, [
      "NOT_REQUIRED",
      "REQUIRED",
    ]),
    "saga step must decide compensation disposition",
  );

  validateMachine(policy?.compensation, "compensation", errors, {
    extraKeys: ["execution"],
  });
  stringList(
    policy?.compensation?.execution?.idempotencyScope,
    "compensation.execution.idempotencyScope",
    errors,
  );
  add(
    errors,
    hasAll(policy?.compensation?.recordRequiredFields, [
      "compensationId",
      "sagaId",
      "stepId",
      "compensationKey",
      "ownerService",
      "idempotencyKey",
      "rootEventId",
      "state",
      "auditId",
    ]),
    "compensation record fields are incomplete",
  );
  add(
    errors,
    policy?.compensation?.execution?.idempotent === true &&
      policy.compensation.execution.versioned === true,
    "compensation must be idempotent and versioned",
  );
  add(
    errors,
    hasAll(policy?.compensation?.execution?.idempotencyScope, [
      "sagaId",
      "stepId",
      "compensationKey",
      "ownerService",
    ]),
    "compensation idempotency scope is incomplete",
  );
  add(
    errors,
    policy?.compensation?.execution?.foreignSchemaWrite === "PROHIBITED" &&
      policy.compensation.execution.sourceFactRollback === "PROHIBITED",
    "compensation cannot write foreign schemas or roll back immutable source facts",
  );
  add(
    errors,
    policy?.compensation?.execution?.transport ===
      "VERSIONED_OWNER_API_OR_EVENT" &&
      policy.compensation.execution.kafkaRpc === false &&
      policy.compensation.execution.twoPhaseCommit === false,
    "compensation transport must not use Kafka RPC or 2PC",
  );
  add(
    errors,
    policy?.compensation?.execution?.ownerReceiptRequiredBeforeApplied === true,
    "compensation may be APPLIED only with an owner receipt",
  );
}

function validateRecoveryAndReceipt(policy, errors) {
  const recoveryMachine = {
    recordRequiredFields: policy?.manualRecovery?.recordRequiredFields,
    states: policy?.manualRecovery?.states,
    initialState: policy?.manualRecovery?.initialState,
    terminalStates: policy?.manualRecovery?.terminalStates,
    transitions: policy?.manualRecovery?.transitions,
    forbiddenTransitions: policy?.manualRecovery?.forbiddenTransitions,
  };
  validateMachine(recoveryMachine, "manualRecovery", errors, {
    requireForbidden: true,
  });
  add(
    errors,
    hasAll(policy?.manualRecovery?.recordRequiredFields, [
      "recoveryId",
      "recoveryRevision",
      "rootEventId",
      "sourceOwnerService",
      "retryCount",
      "lastErrorCode",
      "nextAction",
      "auditId",
    ]),
    "manual recovery record fields are incomplete",
  );
  add(
    errors,
    policy?.manualRecovery?.initialState === "OPEN",
    "manual recovery must begin OPEN",
  );
  const transitions = new Set(
    (policy?.manualRecovery?.transitions ?? []).map(transitionKey),
  );
  add(
    errors,
    hasAll(
      [...transitions],
      [
        "OPEN->PRECHECK_RECONCILING",
        "PRECHECK_RECONCILING->PENDING_TWO_PERSON_REVIEW",
        "PENDING_TWO_PERSON_REVIEW->APPROVED",
        "APPROVED->EXECUTING",
        "EXECUTING->POSTCHECK_RECONCILING",
        "POSTCHECK_RECONCILING->CLOSED",
      ],
    ),
    "manual recovery required transitions are incomplete",
  );
  const forbidden = new Set(
    (policy?.manualRecovery?.forbiddenTransitions ?? []).map(transitionKey),
  );
  add(
    errors,
    hasAll(
      [...forbidden],
      [
        "OPEN->APPROVED",
        "PENDING_TWO_PERSON_REVIEW->EXECUTING",
        "APPROVED->CLOSED",
        "EXECUTING->CLOSED",
        "CLOSED->EXECUTING",
      ],
    ),
    "manual recovery direct-close and re-execution transitions must be forbidden",
  );
  add(
    errors,
    policy?.manualRecovery?.clientTriggered === false &&
      policy.manualRecovery.directDomainWrite === false,
    "manual recovery must be operator-controlled and cannot directly write domain facts",
  );

  const approval = policy?.manualRecovery?.approval;
  for (const [value, label] of [
    [
      approval?.serverDerivedFields,
      "manualRecovery.approval.serverDerivedFields",
    ],
    [
      approval?.forbiddenClientAuthorityFields,
      "manualRecovery.approval.forbiddenClientAuthorityFields",
    ],
    [
      approval?.recordRequiredFields,
      "manualRecovery.approval.recordRequiredFields",
    ],
    [approval?.decisions, "manualRecovery.approval.decisions"],
    [approval?.bindingFields, "manualRecovery.approval.bindingFields"],
  ]) {
    stringList(value, label, errors);
  }
  add(
    errors,
    approval?.mode === "REQUESTER_PLUS_ONE_INDEPENDENT_APPROVER" &&
      approval.distinctPrincipalCount === 2 &&
      approval.independentApproverCount === 1 &&
      approval.requesterMayApprove === false,
    "two-person review must be requester plus one independent approver",
  );
  add(
    errors,
    hasAll(approval?.serverDerivedFields, [
      "requesterPrincipalRef",
      "approverPrincipalRef",
      "tenantRef",
      "roles",
      "permissions",
      "policyVersion",
    ]),
    "approval identities and authorization facts must be server-derived",
  );
  add(
    errors,
    hasAll(approval?.forbiddenClientAuthorityFields, [
      "requesterPrincipalRef",
      "approverPrincipalRef",
      "tenantRef",
      "roles",
      "permissions",
    ]),
    "client approval authority fields must be forbidden",
  );
  add(
    errors,
    hasAll(approval?.recordRequiredFields, [
      "approvalId",
      "recoveryId",
      "recoveryRevision",
      "actionDigest",
      "rootEventId",
      "requesterPrincipalRef",
      "approverPrincipalRef",
      "policyVersion",
      "decision",
      "expiresAt",
      "auditId",
    ]),
    "approval record fields are incomplete",
  );
  add(
    errors,
    hasAll(approval?.bindingFields, [
      "recoveryId",
      "recoveryRevision",
      "actionDigest",
      "rootEventId",
      "aggregateId",
      "sourceOwnerService",
      "policyVersion",
    ]),
    "approval must bind the exact recovery action and policy",
  );
  add(
    errors,
    approval?.auditRequired === true,
    "approval requires immutable audit correlation",
  );

  const reconciliation = policy?.manualRecovery?.reconciliation;
  stringList(
    reconciliation?.recordRequiredFields,
    "manualRecovery.reconciliation.recordRequiredFields",
    errors,
  );
  stringList(
    reconciliation?.statuses,
    "manualRecovery.reconciliation.statuses",
    errors,
  );
  add(
    errors,
    hasAll(reconciliation?.recordRequiredFields, [
      "reconciliationId",
      "recoveryId",
      "ownerService",
      "aggregateId",
      "expectedStateDigest",
      "actualStateDigest",
      "status",
      "auditId",
    ]),
    "reconciliation record fields are incomplete",
  );
  add(
    errors,
    reconciliation?.closeRequiresPostcheckStatus === "MATCHED" &&
      reconciliation.ticketOrDlqCloseIsNotReconciliation === true,
    "a ticket or DLQ close cannot substitute for matched reconciliation",
  );
  stringList(
    policy?.manualRecovery?.closure?.requiredEvidence,
    "manualRecovery.closure.requiredEvidence",
    errors,
  );
  add(
    errors,
    hasAll(policy?.manualRecovery?.closure?.requiredEvidence, [
      "precheckReconciliationId",
      "postcheckReconciliationId",
      "ownerReceiptIds",
      "closureReceiptId",
      "auditId",
    ]),
    "manual recovery closure evidence is incomplete",
  );
  add(
    errors,
    policy?.manualRecovery?.closure?.closeOnlyFrom ===
      "POSTCHECK_RECONCILING" &&
      policy.manualRecovery.closure.requiredPostcheckStatus === "MATCHED" &&
      policy.manualRecovery.closure.missingEvidenceAction === "ESCALATED",
    "manual recovery closure must require matched postcheck and escalate missing evidence",
  );

  stringList(policy?.receipt?.types, "receipt.types", errors);
  stringList(policy?.receipt?.outcomes, "receipt.outcomes", errors);
  stringList(policy?.receipt?.requiredFields, "receipt.requiredFields", errors);
  add(
    errors,
    hasAll(policy?.receipt?.types, [
      "OWNER_ACTION",
      "COMPENSATION",
      "RECOVERY_CLOSURE",
    ]),
    "receipt types are incomplete",
  );
  add(
    errors,
    hasAll(policy?.receipt?.requiredFields, [
      "receiptId",
      "receiptType",
      "schemaVersion",
      "issuedAt",
      "ownerService",
      "recoveryId",
      "sagaId",
      "stepId",
      "eventId",
      "rootEventId",
      "aggregateId",
      "actionDigest",
      "idempotencyKey",
      "outcome",
      "resultDigest",
      "reconciliationId",
      "approvalId",
      "auditId",
      "requestId",
      "traceId",
    ]),
    "receipt required fields are incomplete",
  );
  add(
    errors,
    policy?.receipt?.immutableAfterIssue === true &&
      policy.receipt.sensitivePayloadAllowed === false,
    "receipt must be immutable and contain no sensitive payload",
  );
  stringList(
    policy?.audit?.requiredCorrelation,
    "audit.requiredCorrelation",
    errors,
  );
  add(
    errors,
    policy?.audit?.service === "audit-service" &&
      policy.audit.immutable === true &&
      policy.audit.auditUnavailableBlocksClose === true,
    "audit must be immutable and block closure when unavailable",
  );
  add(
    errors,
    hasAll(policy?.audit?.requiredCorrelation, [
      "requestId",
      "traceId",
      "eventId",
      "rootEventId",
      "sagaId",
      "recoveryId",
      "receiptId",
    ]),
    "audit correlation fields are incomplete",
  );
}

function validateErrorsAndRuntimeBoundary(policy, errors) {
  const retryBudget = policy?.errorRouting?.retryBudget;
  add(
    errors,
    retryBudget?.bounded === true &&
      retryBudget.maxAttempts === 5 &&
      retryBudget.backoff === "EXPONENTIAL_WITH_JITTER" &&
      retryBudget.baseDelayMs === 1000 &&
      retryBudget.maxDelayMs === 60000 &&
      retryBudget.source === "B26_STATIC_CANDIDATE_ONLY",
    "retry budget must remain the B26 static candidate profile",
  );
  add(
    errors,
    Array.isArray(policy?.errorRouting?.errors),
    "errorRouting.errors must be an array",
  );
  const errorMap = new Map();
  for (const entry of policy?.errorRouting?.errors ?? []) {
    hasExactKeys(
      entry,
      ["code", "classification", "action"],
      "errorRouting error",
      errors,
    );
    add(
      errors,
      !errorMap.has(entry?.code),
      `errorRouting has duplicate code ${entry?.code}`,
    );
    errorMap.set(entry?.code, entry);
  }
  for (const code of [
    "TIMEOUT",
    "TEMPORARY_UNAVAILABLE",
    "CONFLICT_RETRYABLE",
  ]) {
    const entry = errorMap.get(code);
    add(
      errors,
      entry?.classification === "RETRYABLE" && entry?.action === "RETRY",
      `${code} must be retryable only`,
    );
  }
  for (const code of ["SCHEMA_INVALID", "FORBIDDEN", "OWNER_MISMATCH"]) {
    const entry = errorMap.get(code);
    add(
      errors,
      entry?.classification === "NON_RETRYABLE" &&
        entry?.action === "DLQ_AND_MANUAL_REVIEW",
      `${code} must not be retried`,
    );
  }
  add(
    errors,
    errorMap.get("RETRY_BUDGET_EXHAUSTED")?.action === "DLQ",
    "retry budget exhaustion must route to DLQ",
  );
  add(
    errors,
    errorMap.get("COMPENSATION_FAILED")?.action === "MANUAL_RECOVERY" &&
      errorMap.get("RECONCILIATION_MISMATCH")?.action === "MANUAL_RECOVERY",
    "compensation and reconciliation failures require manual recovery",
  );
  add(
    errors,
    errorMap.get("UNKNOWN_FAILURE")?.classification === "NON_RETRYABLE" &&
      errorMap.get("UNKNOWN_FAILURE")?.action === "DLQ_AND_MANUAL_REVIEW",
    "unknown failures must not retry automatically",
  );

  stringList(
    policy?.runtimeBoundary?.prohibitedClaims,
    "runtimeBoundary.prohibitedClaims",
    errors,
  );
  add(
    errors,
    policy?.runtimeBoundary?.thisPolicy === "STATIC_D2_CONTRACT_ONLY",
    "policy must remain a static D2 contract",
  );
  add(
    errors,
    hasAll(policy?.runtimeBoundary?.prohibitedClaims, [
      "broker-topic-or-acl-created",
      "outbox-transaction-or-publisher-executed",
      "consumer-deduplication-or-offset-commit-executed",
      "dlq-or-replay-executed",
      "compensation-or-manual-recovery-executed",
      "approval-or-audit-runtime-evidence-captured",
    ]),
    "runtime prohibited claims are incomplete",
  );
  add(
    errors,
    policy?.runtimeBoundary?.m2_005?.task === "P1R-M2-005" &&
      policy.runtimeBoundary.m2_005.status === "PLANNED",
    "M2-005 must retain real transport responsibility",
  );
  add(
    errors,
    policy?.runtimeBoundary?.m2_006?.task === "P1R-M2-006" &&
      policy.runtimeBoundary.m2_006.status === "PLANNED",
    "M2-006 must retain actual Saga/recovery runtime responsibility",
  );
  add(
    errors,
    policy?.runtimeBoundary?.m8RecoveryEvidence?.task ===
      "P1R-M8-006/011/012" &&
      policy.runtimeBoundary.m8RecoveryEvidence.status === "PLANNED",
    "M8 must retain end-to-end recovery evidence responsibility",
  );
  stringList(policy?.prohibitions, "prohibitions", errors);
  add(
    errors,
    hasAll(policy?.prohibitions, [
      "workflow-service-direct-foreign-domain-write",
      "audit-service-direct-domain-write",
      "kafka-rpc",
      "distributed-two-phase-commit",
      "client-triggered-replay-or-manual-recovery",
      "client-supplied-actor-tenant-or-approver-authority",
      "closing-dlq-or-ticket-as-reconciliation",
      "mutable-root-event-or-receipt",
      "runtime-promotion-from-static-policy",
    ]),
    "prohibitions are incomplete",
  );
}

export function validateSagaRecoveryData({ policy, b26 }) {
  const errors = [];
  checkExactObjects(policy, errors);
  validateIdentifiers(policy, b26, errors);
  validateCorrelationAndOwners(policy, errors);
  validateSagaAndCompensation(policy, errors);
  validateRecoveryAndReceipt(policy, errors);
  validateErrorsAndRuntimeBoundary(policy, errors);
  return {
    result: errors.length === 0 ? "PASS" : "FAIL",
    errors,
    summary:
      errors.length === 0
        ? {
            maturity: policy.maturity,
            runtimeStatus: policy.runtimeStatus,
            sagaStates: policy.saga.states.length,
            sagaStepStates: policy.saga.step.states.length,
            compensationStates: policy.compensation.states.length,
            recoveryStates: policy.manualRecovery.states.length,
            receiptFields: policy.receipt.requiredFields.length,
            retryBudget: policy.errorRouting.retryBudget.maxAttempts,
          }
        : undefined,
  };
}

export function readSagaRecoveryPolicy({ root = defaultRoot } = {}) {
  const readJson = (relativePath) =>
    JSON.parse(
      fs.readFileSync(path.join(root, ...relativePath.split("/")), "utf8"),
    );
  return {
    policy: readJson("config/p1r-saga-recovery.v1.json"),
    b26: readJson("config/b26-event-runtime.json"),
  };
}

export function validateSagaRecovery({ root = defaultRoot } = {}) {
  return validateSagaRecoveryData(readSagaRecoveryPolicy({ root }));
}

function runCli() {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const unknown = args.filter((arg) => arg !== "--json");
  if (unknown.length > 0) {
    process.stderr.write(
      `Usage: node scripts/audit/p1r-saga-recovery-check.mjs [--json]\n`,
    );
    process.exitCode = 2;
    return;
  }
  const report = validateSagaRecovery();
  if (json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else if (report.result === "PASS") {
    process.stdout.write(
      `[p1r-saga-recovery] PASS ${report.summary.sagaStates} saga states, ${report.summary.recoveryStates} recovery states, runtime=${report.summary.runtimeStatus}\n`,
    );
  } else {
    process.stdout.write(
      `[p1r-saga-recovery] FAIL\n${report.errors.map((error) => `- ${error}`).join("\n")}\n`,
    );
  }
  process.exitCode = report.result === "PASS" ? 0 : 1;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  runCli();
}
