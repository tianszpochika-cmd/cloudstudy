# B10 compatibility adapter contract

> This document is the contract boundary for `V2-B10-MIG-007`. It defines the migration adapter only; it does not make `core-api` a v2 domain owner.

## Scope

The adapter may read the B2/B3 legacy behavior fixtures and the target service read projections, normalize both into a comparison record, and expose a controlled read mode. It may write only `cmp_b10_reconciliation`, `cmp_b10_route_control` and `cmp_b10_rollback_ledger` in its own adapter schema.

It must not:

- write `content-service`, `assessment-service` or `learning-service` tables;
- join legacy tables with target tables through SQL;
- accept client-provided tenant, owner, role or permission facts;
- turn Kafka into RPC or use an event as a transaction coordinator;
- delete or rewrite an assessment, report, content pin, SRS state or mastery fact during rollback.

## Internal contract

The OpenAPI source is `packages/contracts/fragments/b10/b10-compatibility.openapi.json`:

- `GET /internal/v1/compatibility/b10/read-shadow` returns a read-only comparison for a synthetic B2/B3 fixture or a normalized subject reference hash.
- `POST /internal/v1/compatibility/b10/reconciliations` records the comparison status, version/hash pair, mismatch codes and `safeToCutover` gate.
- `POST /internal/v1/compatibility/b10/route-decisions` changes the adapter mode only after a successful reconciliation and records a bounded rollback window.
- `POST /internal/v1/compatibility/b10/rollbacks` returns reads to `LEGACY_READ` or `FALLBACK_READ` (or a verified `TARGET_READ`) without changing domain facts.

The permitted modes are:

| Mode | Behavior | Write authority |
|---|---|---|
| `LEGACY_READ` | Read the old compatibility source only | none |
| `SHADOW_READ` | Serve the configured source and compare the other source asynchronously | adapter ledger only |
| `TARGET_READ` | Read the target service projection after the reconciliation gate | target service owns its facts |
| `FALLBACK_READ` | Serve the last safe read source while the target or event path is degraded | adapter ledger only |

The adapter must keep `fixtureVersion`, `legacyVersion`, `targetVersion`, `legacySnapshotHash`, `targetSnapshotHash`, `comparisonStatus`, `differenceCodes`, `traceId` and the rollback window. `MATCH` is not enough by itself: the route decision must also verify that the target projection is available and that the rollback window is still open.

## B2/B3 mapping

The fixture inputs remain synthetic and are not copied as answer-bearing events:

- B2 learning flow maps daily stream, mastery transitions and idempotency cases to `learning-service` read projections and the assessment submission boundary.
- B2 assessment maps public question fields to the content snapshot; candidate response stays in the protected assessment boundary and is represented downstream by a digest and score/mistake summary.
- B3 grammar, reading, writing, listening and phonetics map to content item type and `contentVersionId`; media/recording bytes are outside this B10 contract and remain media-service work.
- B3 sync `serverVersion`/change cases map to the target projection version and adapter reconciliation status; no cross-service table write is allowed.

## Rollback and recovery

Rollback is a route decision, not a destructive data migration. A pinned assessment/report continues to use its immutable `contentSnapshotId`, `contentVersionId`, `contentEpoch` and `snapshotHash`. If a version is unpublished, content recovery may return the immutable snapshot; a safe fallback is valid only for future reads and must set `mustNotRegrade=true` for historical attempts.

The OpenAPI makes this split explicit. `B10AssessmentSession`, `B10Attempt`, `B10AssessmentReport` and `B10MasteryProjection` use the closed `B10ActiveSessionAttemptPin`: it aligns with the B9 learner pin by returning only `AVAILABLE`, or `UNAVAILABLE` with an emergency rights/security/legal reason and an explicit alternative action; it never carries `fallbackVersionId`. `B10ContentVersionPin` remains the read-only future-read or unstarted-task model used by snapshots and queue planning, but its five states are an exact `oneOf`: `PINNED` has `NONE` and no fallback, pending/unavailable states require an allowed reason and no fallback, and `RECOVERED` carries the complete fallback version/epoch/snapshot/hash identity. Permanent rights/security/legal removal cannot be labeled recovered. The existing recovery operation is machine-bound to `FUTURE_READ_ONLY` and rejects active-session/attempt use; `SAFE_FUTURE_FALLBACK` requires explicit replacement version/snapshot identifiers. Active unavailability is returned through the active pin owned by the session/attempt record, so no caller-supplied scope can rewrite an already-started session, attempt, report or mastery fact.

Event failures are handled by the B10 Outbox, consumer-dedupe, DLQ/replay and Saga contracts. Replay preserves the original trace correlation, creates a new replay event identity, and applies the consumer idempotency key before any projection write. Compensation marks a projection for retry, reopens a queue item, or creates a manual recovery task; it never edits the assessment source fact.

## Required evidence before cutover

The main Agent must run the root merge/generation commands, then compare the generated OpenAPI and event catalog. Cutover requires matching B2/B3 synthetic fixtures, no answer-bearing event fields, zero duplicate application on repeated delivery, DLQ replay evidence, Saga compensation evidence, and a rollback command that changes only adapter route state.
