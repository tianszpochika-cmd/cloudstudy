package com.englishflow.platform.template.reliability;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Pattern;

/**
 * Dependency-free reliability metadata ledger for v2 services.
 *
 * <p>The ledger is deliberately a local state-machine seam. A copied service can replace the
 * maps with its own repository/transactional adapter without changing the event, retry, cursor,
 * DLQ, replay, or Saga contracts. It does not publish to a broker, perform remote-call
 * coordination, coordinate a distributed transaction, or store an event payload. Event handlers receive metadata and must
 * read service-owned facts themselves.</p>
 *
 * <p>Every mutation is synchronized to make the in-memory implementation deterministic for pure
 * smoke tests. Production adapters must preserve the same invariants with an atomic receipt and
 * cursor write in the service's own schema.</p>
 */
public final class B14ReliabilityLedger {

    private static final int MAX_TOKEN_LENGTH = 128;
    private static final int MAX_REASON_LENGTH = 100;
    private static final long FIRST_SEQUENCE = 1L;
    private static final Pattern SAFE_TOKEN = Pattern.compile("[A-Za-z0-9][A-Za-z0-9._:-]{0,127}");
    private static final Pattern EVENT_TYPE = Pattern.compile("[a-z][a-z0-9]*(\\.[a-z0-9_-]+)+\\.v[0-9]+");
    private static final Pattern NAMED_SCHEMA = Pattern.compile("[a-z][a-z0-9_.-]{2,63}\\.v[0-9]+");
    private static final Pattern SEMVER = Pattern.compile("[0-9]+\\.[0-9]+\\.[0-9]+");
    private static final Pattern FINGERPRINT = Pattern.compile("[0-9a-f]{64}");

    private final int partitionCount;
    private final RetryPolicy retryPolicy;
    private final Clock clock;
    private final Map<ReceiptKey, ReceiptState> receipts = new LinkedHashMap<>();
    private final Map<ReceiptKey, EventRecord> events = new LinkedHashMap<>();
    private final Map<CursorKey, Long> cursors = new LinkedHashMap<>();
    private final Map<CursorKey, Long> observedCursors = new LinkedHashMap<>();
    private final Map<ReceiptKey, DeadLetter> deadLetters = new LinkedHashMap<>();
    private final Map<String, SchemaWindow> schemaWindows = new LinkedHashMap<>();
    private final Map<String, ReplayResult> replayOperations = new LinkedHashMap<>();
    private final Map<String, String> replayOperationFingerprints = new LinkedHashMap<>();
    private final Map<String, ManualRecoveryResult> manualRecoveryOperations = new LinkedHashMap<>();
    private final Map<String, String> manualRecoveryFingerprints = new LinkedHashMap<>();
    private final Map<String, IdempotencyReceipt> idempotencyOperations = new LinkedHashMap<>();
    private final Map<String, SagaStateRecord> sagas = new LinkedHashMap<>();
    private final Map<String, SagaSnapshot> sagaOperations = new LinkedHashMap<>();
    private final Map<String, String> sagaOperationFingerprints = new LinkedHashMap<>();

    public B14ReliabilityLedger(int partitionCount, RetryPolicy retryPolicy) {
        this(partitionCount, retryPolicy, Clock.systemUTC());
    }

    public B14ReliabilityLedger(int partitionCount, RetryPolicy retryPolicy, Clock clock) {
        if (partitionCount < 1 || partitionCount > 32_768) {
            throw new IllegalArgumentException("partitionCount must be between 1 and 32768");
        }
        this.partitionCount = partitionCount;
        this.retryPolicy = Objects.requireNonNull(retryPolicy, "retryPolicy");
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    public static RetryPolicy defaultRetryPolicy() {
        return new RetryPolicy(3, Duration.ofSeconds(1), Duration.ofMinutes(5));
    }

    /** Returns a SHA-256 fingerprint; callers must never pass this method's input to storage. */
    public static String sha256(String metadataForFingerprint) {
        Objects.requireNonNull(metadataForFingerprint, "metadataForFingerprint");
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(metadataForFingerprint.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }

    public static EventRecord event(String eventId, String eventType, String schemaVersion,
            String aggregateType, String aggregateId, long sequence, String fingerprint,
            Instant occurredAt, String traceId, int partitionCount) {
        String normalizedAggregateType = normalizeToken(aggregateType, "aggregateType");
        String normalizedAggregateId = normalizeToken(aggregateId, "aggregateId");
        return new EventRecord(normalizeToken(eventId, "eventId"), normalizeEventType(eventType),
                normalizeSchemaVersion(schemaVersion), normalizedAggregateType, normalizedAggregateId,
                partitionFor(normalizedAggregateType, normalizedAggregateId, partitionCount), sequence,
                normalizeFingerprint(fingerprint), Objects.requireNonNull(occurredAt, "occurredAt"),
                normalizeOptionalToken(traceId, "traceId"));
    }

    public static EventRecord event(String eventId, String eventType, String schemaVersion,
            String aggregateType, String aggregateId, long sequence, String fingerprint,
            Instant occurredAt, int partitionCount) {
        return event(eventId, eventType, schemaVersion, aggregateType, aggregateId, sequence,
                fingerprint, occurredAt, null, partitionCount);
    }

    public static int partitionFor(String aggregateType, String aggregateId, int partitionCount) {
        if (partitionCount < 1) {
            throw new IllegalArgumentException("partitionCount must be positive");
        }
        String type = normalizeToken(aggregateType, "aggregateType");
        String id = normalizeToken(aggregateId, "aggregateId");
        byte[] digest = digest((type + '\u001f' + id).getBytes(StandardCharsets.UTF_8));
        int value = ((digest[0] & 0xff) << 24) | ((digest[1] & 0xff) << 16)
                | ((digest[2] & 0xff) << 8) | (digest[3] & 0xff);
        return Math.floorMod(value, partitionCount);
    }

    public static String normalizeEventId(String eventId) {
        return normalizeToken(eventId, "eventId");
    }

    public static String normalizeSchemaVersion(String schemaVersion) {
        Objects.requireNonNull(schemaVersion, "schemaVersion");
        String value = schemaVersion.trim().toLowerCase(Locale.ROOT);
        if (NAMED_SCHEMA.matcher(value).matches()) {
            int suffixIndex = value.lastIndexOf(".v");
            String prefix = value.substring(0, suffixIndex);
            long version = parsePositiveVersion(value.substring(suffixIndex + 2), "schemaVersion");
            return prefix + ".v" + version;
        }
        if (SEMVER.matcher(value).matches()) {
            return value;
        }
        throw new IllegalArgumentException("schemaVersion must use domain.event.vN or semantic versioning");
    }

    public static String normalizeAggregateType(String aggregateType) {
        return normalizeToken(aggregateType, "aggregateType");
    }

    public static String normalizeAggregateId(String aggregateId) {
        return normalizeToken(aggregateId, "aggregateId");
    }

    /** Registers a current event schema and the old versions accepted during a compatibility window. */
    public synchronized SchemaWindow registerSchemaWindow(String eventType, String currentSchemaVersion,
            Set<String> compatibleSchemaVersions) {
        String type = normalizeEventType(eventType);
        String current = normalizeSchemaVersion(currentSchemaVersion);
        Set<String> accepted = new TreeSet<>();
        accepted.add(current);
        if (compatibleSchemaVersions != null) {
            for (String version : compatibleSchemaVersions) {
                accepted.add(normalizeSchemaVersion(version));
            }
        }
        SchemaWindow window = new SchemaWindow(type, current, accepted);
        schemaWindows.put(type, window);
        return window;
    }

    public synchronized SchemaWindow schemaWindow(String eventType) {
        return schemaWindows.get(normalizeEventType(eventType));
    }

    /**
     * Processes one metadata-only event. A future sequence is buffered, a duplicate is replayed
     * from its receipt, and only the contiguous cursor sequence is handed to the service handler.
     * Consumer dedupe is keyed by the normalized consumer name and eventId; a fingerprint conflict
     * is rejected instead of silently treating a reused identifier as a duplicate.
     */
    public synchronized ProcessingResult process(String consumerName, EventRecord rawEvent,
            EventHandler handler) {
        return process(consumerName, rawEvent, handler, clock.instant());
    }

    public synchronized ProcessingResult process(String consumerName, EventRecord rawEvent,
            EventHandler handler, Instant now) {
        String consumer = normalizeToken(consumerName, "consumerName");
        Objects.requireNonNull(handler, "handler");
        Instant timestamp = Objects.requireNonNull(now, "now");
        EventRecord event = normalizeEvent(rawEvent);
        validateSchema(event);
        CursorKey cursorKey = new CursorKey(consumer, event.partition());
        observedCursors.merge(cursorKey, safeNextSequence(event.sequence()), Math::max);

        ReceiptKey key = new ReceiptKey(consumer, event.eventId());
        ReceiptState state = receipts.get(key);
        if (state != null && !state.fingerprint.equals(event.fingerprint())) {
            throw new ReliabilityConflictException("eventId was reused with a different metadata fingerprint");
        }
        if (state == null) {
            state = new ReceiptState(consumer, event, timestamp);
            receipts.put(key, state);
            events.put(key, event);
        }

        if (state.status == ReceiptStatus.APPLIED) {
            return result(ProcessingStatus.DUPLICATE, consumer, event, state, timestamp, false, null);
        }
        if (state.status == ReceiptStatus.DEAD_LETTER) {
            return result(ProcessingStatus.DEAD_LETTER, consumer, event, state, timestamp, false,
                    deadLetters.get(key) == null ? null : deadLetters.get(key).dlqId());
        }
        if (state.status == ReceiptStatus.MANUAL_RECOVERY) {
            return result(ProcessingStatus.MANUAL_RECOVERY_REQUIRED, consumer, event, state, timestamp,
                    false, deadLetters.get(key) == null ? null : deadLetters.get(key).dlqId());
        }
        if (state.status == ReceiptStatus.RETRY_SCHEDULED && state.nextAttemptAt != null
                && timestamp.isBefore(state.nextAttemptAt)) {
            return result(ProcessingStatus.RETRY_NOT_DUE, consumer, event, state, timestamp, false, null);
        }

        long nextSequence = cursors.getOrDefault(cursorKey, FIRST_SEQUENCE);
        if (event.sequence() > nextSequence) {
            state.status = ReceiptStatus.BUFFERED;
            state.updatedAt = timestamp;
            state.reasonCode = "WAITING_FOR_SEQUENCE_" + nextSequence;
            return result(ProcessingStatus.BUFFERED, consumer, event, state, timestamp, false, null);
        }
        if (event.sequence() < nextSequence) {
            state.status = ReceiptStatus.STALE;
            state.updatedAt = timestamp;
            state.reasonCode = "SEQUENCE_ALREADY_CHECKPOINTED";
            return result(ProcessingStatus.STALE, consumer, event, state, timestamp, false, null);
        }

        boolean replayed = state.status == ReceiptStatus.REPLAY_QUEUED;
        int attempt = state.attempt + 1;
        state.attempt = attempt;
        state.updatedAt = timestamp;
        state.nextAttemptAt = null;
        try {
            handler.handle(event);
            state.status = ReceiptStatus.APPLIED;
            state.reasonCode = null;
            cursors.put(cursorKey, nextSequence + 1);
            deadLetters.remove(key);
            return result(ProcessingStatus.APPLIED, consumer, event, state, timestamp, replayed, null);
        } catch (ProcessingFailure failure) {
            return handleFailure(consumer, event, state, timestamp, failure, replayed);
        } catch (Exception failure) {
            return handleFailure(consumer, event, state, timestamp,
                    ProcessingFailure.retryable("UNEXPECTED_HANDLER_FAILURE"), replayed);
        }
    }

    /** Processes all already-buffered contiguous events for a partition in sequence order. */
    public synchronized List<ProcessingResult> drain(String consumerName, int partition,
            EventHandler handler, Instant now) {
        String consumer = normalizeToken(consumerName, "consumerName");
        if (partition < 0 || partition >= partitionCount) {
            throw new IllegalArgumentException("partition is outside this ledger");
        }
        List<ProcessingResult> results = new ArrayList<>();
        while (true) {
            long next = cursors.getOrDefault(new CursorKey(consumer, partition), FIRST_SEQUENCE);
            ReceiptState ready = receipts.values().stream()
                    .filter(value -> value.event.partition() == partition
                            && value.event.sequence() == next
                            && value.consumerName.equals(consumer)
                            && value.status == ReceiptStatus.BUFFERED)
                    .findFirst().orElse(null);
            if (ready == null) {
                return List.copyOf(results);
            }
            results.add(process(consumer, ready.event, handler, now));
            ProcessingResult last = results.get(results.size() - 1);
            if (last.status() != ProcessingStatus.APPLIED) {
                return List.copyOf(results);
            }
        }
    }

    public synchronized EventReceipt receipt(String consumerName, String eventId) {
        ReceiptState state = receipts.get(new ReceiptKey(normalizeToken(consumerName, "consumerName"),
                normalizeToken(eventId, "eventId")));
        return state == null ? null : state.snapshot();
    }

    public synchronized Cursor cursor(String consumerName, int partition) {
        String consumer = normalizeToken(consumerName, "consumerName");
        if (partition < 0 || partition >= partitionCount) {
            throw new IllegalArgumentException("partition is outside this ledger");
        }
        long next = cursors.getOrDefault(new CursorKey(consumer, partition), FIRST_SEQUENCE);
        return new Cursor(consumer, partition, next, clock.instant());
    }

    /** Transport-observation checkpoint; it never authorizes a domain projection write. */
    public synchronized Cursor observedCursor(String consumerName, int partition) {
        String consumer = normalizeToken(consumerName, "consumerName");
        if (partition < 0 || partition >= partitionCount) {
            throw new IllegalArgumentException("partition is outside this ledger");
        }
        long next = observedCursors.getOrDefault(new CursorKey(consumer, partition), FIRST_SEQUENCE);
        return new Cursor(consumer, partition, next, clock.instant());
    }

    public synchronized List<DeadLetter> deadLetters() {
        return List.copyOf(deadLetters.values());
    }

    /**
     * Begins a service-local idempotency operation. Only a request fingerprint and a bounded
     * result code are retained; response bodies and user data are deliberately outside this API.
     */
    public synchronized IdempotencyReceipt beginIdempotency(String scope, String idempotencyKey,
            String requestFingerprint, Instant now) {
        String operationScope = normalizeToken(scope, "scope");
        String key = normalizeToken(idempotencyKey, "idempotencyKey");
        String fingerprint = normalizeFingerprint(requestFingerprint);
        String operationKey = operationScope + '|' + key;
        IdempotencyReceipt previous = idempotencyOperations.get(operationKey);
        if (previous != null) {
            if (!previous.requestFingerprint().equals(fingerprint)) {
                throw new ReliabilityConflictException("idempotency key was reused with a different request fingerprint");
            }
            return previous.asIdempotentReplay();
        }
        IdempotencyReceipt created = new IdempotencyReceipt(operationScope, key, fingerprint,
                IdempotencyStatus.PROCESSING, null, Objects.requireNonNull(now, "now"), false);
        idempotencyOperations.put(operationKey, created);
        return created;
    }

    public synchronized IdempotencyReceipt completeIdempotency(String scope, String idempotencyKey,
            String requestFingerprint, String resultCode, Instant now) {
        return finishIdempotency(scope, idempotencyKey, requestFingerprint, resultCode,
                IdempotencyStatus.COMPLETED, now);
    }

    public synchronized IdempotencyReceipt failIdempotency(String scope, String idempotencyKey,
            String requestFingerprint, String resultCode, Instant now) {
        return finishIdempotency(scope, idempotencyKey, requestFingerprint, resultCode,
                IdempotencyStatus.FAILED, now);
    }

    /** Moves a DLQ receipt to manual recovery without copying any event payload. */
    public synchronized ManualRecoveryResult requestManualRecovery(String consumerName, String eventId,
            String operatorId, String recoveryKey, String reasonCode, Instant now) {
        String consumer = normalizeToken(consumerName, "consumerName");
        String normalizedEventId = normalizeToken(eventId, "eventId");
        String operator = normalizeToken(operatorId, "operatorId");
        String operation = normalizeToken(recoveryKey, "recoveryKey");
        String reason = normalizeReason(reasonCode);
        ReceiptKey key = new ReceiptKey(consumer, normalizedEventId);
        String operationKey = "event-manual-recovery|" + consumer + '|' + operation;
        String fingerprint = consumer + '|' + normalizedEventId + '|' + operator + '|' + reason;
        ManualRecoveryResult previous = manualRecoveryOperations.get(operationKey);
        if (previous != null) {
            assertSameOperation(manualRecoveryFingerprints.get(operationKey), fingerprint);
            return previous.asIdempotentReplay();
        }
        ReceiptState state = requireReceipt(key);
        if (state.status != ReceiptStatus.DEAD_LETTER && state.status != ReceiptStatus.RETRY_SCHEDULED) {
            throw new ReliabilityStateException("only failed event receipts can enter manual recovery");
        }
        state.status = ReceiptStatus.MANUAL_RECOVERY;
        state.reasonCode = reason;
        state.updatedAt = Objects.requireNonNull(now, "now");
        DeadLetter dlq = deadLetters.get(key);
        ManualRecoveryResult result = new ManualRecoveryResult(consumer, normalizedEventId, operator,
                operation, reason, state.updatedAt, dlq == null ? null : dlq.dlqId(), false);
        manualRecoveryOperations.put(operationKey, result);
        manualRecoveryFingerprints.put(operationKey, fingerprint);
        return result;
    }

    public synchronized ReplayResult requestReplay(String consumerName, String eventId, String replayKey,
            String reasonCode, Instant now) {
        String consumer = normalizeToken(consumerName, "consumerName");
        String normalizedEventId = normalizeToken(eventId, "eventId");
        String operation = normalizeToken(replayKey, "replayKey");
        String reason = normalizeReason(reasonCode);
        String operationKey = "event-replay|" + consumer + '|' + operation;
        String fingerprint = consumer + '|' + normalizedEventId + '|' + reason;
        ReplayResult previous = replayOperations.get(operationKey);
        if (previous != null) {
            assertSameOperation(replayOperationFingerprints.get(operationKey), fingerprint);
            return previous.asIdempotentReplay();
        }
        ReceiptKey key = new ReceiptKey(consumer, normalizedEventId);
        ReceiptState state = requireReceipt(key);
        if (state.status != ReceiptStatus.DEAD_LETTER && state.status != ReceiptStatus.MANUAL_RECOVERY) {
            throw new ReliabilityStateException("only DLQ or manual-recovery events can be replayed");
        }
        Instant timestamp = Objects.requireNonNull(now, "now");
        String replayId = "replay-" + sha256(operationKey).substring(0, 24);
        state.status = ReceiptStatus.REPLAY_QUEUED;
        state.attempt = 0;
        state.replayCount++;
        state.nextAttemptAt = timestamp;
        state.reasonCode = reason;
        state.replayId = replayId;
        state.updatedAt = timestamp;
        deadLetters.remove(key);
        ReplayResult result = new ReplayResult(replayId, consumer, normalizedEventId, operation, reason,
                state.replayCount, timestamp, false);
        replayOperations.put(operationKey, result);
        replayOperationFingerprints.put(operationKey, fingerprint);
        return result;
    }

    public synchronized SagaSnapshot startSaga(String sagaId, String aggregateType, String aggregateId,
            List<SagaStep> steps, String idempotencyKey, Instant now) {
        String id = normalizeToken(sagaId, "sagaId");
        String type = normalizeToken(aggregateType, "aggregateType");
        String aggregate = normalizeToken(aggregateId, "aggregateId");
        String operation = normalizeToken(idempotencyKey, "idempotencyKey");
        List<SagaStep> normalizedSteps = normalizeSteps(steps);
        String operationKey = "saga-start|" + operation;
        String fingerprint = id + '|' + type + '|' + aggregate + '|' + normalizedSteps;
        SagaSnapshot previous = sagaOperations.get(operationKey);
        if (previous != null) {
            assertSameOperation(sagaOperationFingerprints.get(operationKey), fingerprint);
            return previous;
        }
        SagaStateRecord existing = sagas.get(id);
        if (existing != null) {
            if (!existing.fingerprint.equals(fingerprint)) {
                throw new ReliabilityConflictException("sagaId was reused with different metadata");
            }
            SagaSnapshot snapshot = existing.snapshot();
            sagaOperations.put(operationKey, snapshot);
            sagaOperationFingerprints.put(operationKey, fingerprint);
            return snapshot;
        }
        Instant timestamp = Objects.requireNonNull(now, "now");
        SagaStateRecord state = new SagaStateRecord(id, type, aggregate, normalizedSteps, fingerprint, timestamp);
        sagas.put(id, state);
        SagaSnapshot snapshot = state.snapshot();
        sagaOperations.put(operationKey, snapshot);
        sagaOperationFingerprints.put(operationKey, fingerprint);
        return snapshot;
    }

    public synchronized SagaSnapshot markSagaStepApplied(String sagaId, String stepId, Instant now) {
        SagaStateRecord state = requireSaga(sagaId);
        SagaStepState current = state.steps.get(normalizeToken(stepId, "stepId"));
        if (current == null) {
            throw new ReliabilityStateException("saga step was not found");
        }
        if (current == SagaStepState.APPLIED) {
            return state.snapshot();
        }
        if (state.state != SagaState.RUNNING || current != SagaStepState.PENDING) {
            throw new ReliabilityStateException("saga step cannot be marked applied in the current state");
        }
        state.steps.put(normalizeToken(stepId, "stepId"), SagaStepState.APPLIED);
        state.updatedAt = Objects.requireNonNull(now, "now");
        return state.snapshot();
    }

    public synchronized SagaSnapshot completeSaga(String sagaId, Instant now) {
        SagaStateRecord state = requireSaga(sagaId);
        if (state.state == SagaState.COMPLETED) {
            return state.snapshot();
        }
        if (state.state != SagaState.RUNNING || state.steps.values().stream()
                .anyMatch(step -> step != SagaStepState.APPLIED)) {
            throw new ReliabilityStateException("saga cannot complete before all steps are applied");
        }
        state.state = SagaState.COMPLETED;
        state.updatedAt = Objects.requireNonNull(now, "now");
        return state.snapshot();
    }

    public synchronized SagaSnapshot requestCompensation(String sagaId, String compensationKey,
            String reasonCode, Instant now) {
        SagaStateRecord state = requireSaga(sagaId);
        String key = normalizeToken(compensationKey, "compensationKey");
        String operationKey = "saga-compensation|" + key;
        String fingerprint = state.sagaId + '|' + normalizeReason(reasonCode);
        SagaSnapshot previous = sagaOperations.get(operationKey);
        if (previous != null) {
            assertSameOperation(sagaOperationFingerprints.get(operationKey), fingerprint);
            return previous;
        }
        if (state.state != SagaState.RUNNING && state.state != SagaState.COMPLETED
                && state.state != SagaState.FAILED && state.state != SagaState.MANUAL_RECOVERY) {
            throw new ReliabilityStateException("saga cannot enter compensation from the current state");
        }
        state.state = SagaState.COMPENSATING;
        state.reasonCode = normalizeReason(reasonCode);
        state.updatedAt = Objects.requireNonNull(now, "now");
        state.steps.replaceAll((step, stepState) -> stepState == SagaStepState.APPLIED
                ? SagaStepState.COMPENSATING : stepState);
        if (state.steps.values().stream().noneMatch(step -> step == SagaStepState.COMPENSATING)) {
            state.state = SagaState.COMPENSATED;
        }
        SagaSnapshot snapshot = state.snapshot();
        sagaOperations.put(operationKey, snapshot);
        sagaOperationFingerprints.put(operationKey, fingerprint);
        return snapshot;
    }

    public synchronized SagaSnapshot markSagaStepCompensated(String sagaId, String stepId, Instant now) {
        SagaStateRecord state = requireSaga(sagaId);
        String id = normalizeToken(stepId, "stepId");
        SagaStepState current = state.steps.get(id);
        if (current == SagaStepState.COMPENSATED) {
            return state.snapshot();
        }
        if (state.state != SagaState.COMPENSATING || current != SagaStepState.COMPENSATING) {
            throw new ReliabilityStateException("saga step cannot be compensated in the current state");
        }
        if (!isNextCompensationStep(state, id)) {
            throw new ReliabilityStateException("Saga compensation must proceed in reverse step order");
        }
        state.steps.put(id, SagaStepState.COMPENSATED);
        state.updatedAt = Objects.requireNonNull(now, "now");
        if (state.steps.values().stream().noneMatch(step -> step == SagaStepState.COMPENSATING)) {
            state.state = SagaState.COMPENSATED;
        }
        return state.snapshot();
    }

    public synchronized SagaSnapshot requestSagaManualRecovery(String sagaId, String recoveryKey,
            String reasonCode, Instant now) {
        SagaStateRecord state = requireSaga(sagaId);
        String key = normalizeToken(recoveryKey, "recoveryKey");
        String operationKey = "saga-manual-recovery|" + key;
        String fingerprint = state.sagaId + '|' + normalizeReason(reasonCode);
        SagaSnapshot previous = sagaOperations.get(operationKey);
        if (previous != null) {
            assertSameOperation(sagaOperationFingerprints.get(operationKey), fingerprint);
            return previous;
        }
        if (state.state == SagaState.COMPLETED || state.state == SagaState.COMPENSATED) {
            throw new ReliabilityStateException("terminal saga state cannot require manual recovery");
        }
        state.state = SagaState.MANUAL_RECOVERY;
        state.reasonCode = normalizeReason(reasonCode);
        state.updatedAt = Objects.requireNonNull(now, "now");
        SagaSnapshot snapshot = state.snapshot();
        sagaOperations.put(operationKey, snapshot);
        sagaOperationFingerprints.put(operationKey, fingerprint);
        return snapshot;
    }

    public synchronized SagaSnapshot saga(String sagaId) {
        SagaStateRecord state = sagas.get(normalizeToken(sagaId, "sagaId"));
        return state == null ? null : state.snapshot();
    }

    public int partitionCount() {
        return partitionCount;
    }

    public RetryPolicy retryPolicy() {
        return retryPolicy;
    }

    private ProcessingResult handleFailure(String consumer, EventRecord event, ReceiptState state,
            Instant now, ProcessingFailure failure, boolean replayed) {
        String reason = normalizeReason(failure.reasonCode());
        state.reasonCode = reason;
        state.updatedAt = now;
        if (!failure.retryable() || state.attempt >= retryPolicy.maxAttempts()) {
            state.status = ReceiptStatus.DEAD_LETTER;
            state.nextAttemptAt = null;
            DeadLetter dlq = new DeadLetter(dlqId(consumer, event.eventId()), consumer, event.eventId(),
                    event.eventType(), event.schemaVersion(), event.aggregateType(), event.aggregateId(),
                    event.partition(), event.sequence(), state.attempt, reason, event.fingerprint(), now);
            deadLetters.put(new ReceiptKey(consumer, event.eventId()), dlq);
            return result(ProcessingStatus.DEAD_LETTER, consumer, event, state, now, replayed, dlq.dlqId());
        }
        state.status = ReceiptStatus.RETRY_SCHEDULED;
        state.nextAttemptAt = now.plus(retryPolicy.backoffFor(state.attempt));
        return result(ProcessingStatus.RETRY_SCHEDULED, consumer, event, state, now, replayed, null);
    }

    private ProcessingResult result(ProcessingStatus status, String consumer, EventRecord event,
            ReceiptState state, Instant now, boolean replayed, String dlqId) {
        long next = cursors.getOrDefault(new CursorKey(consumer, event.partition()), FIRST_SEQUENCE);
        return new ProcessingResult(status, consumer, event.eventId(), event.partition(), event.sequence(),
                state.attempt, next, state.nextAttemptAt, state.reasonCode, replayed, state.replayId, dlqId, now);
    }

    private IdempotencyReceipt finishIdempotency(String scope, String idempotencyKey,
            String requestFingerprint, String resultCode, IdempotencyStatus status, Instant now) {
        String operationScope = normalizeToken(scope, "scope");
        String key = normalizeToken(idempotencyKey, "idempotencyKey");
        String fingerprint = normalizeFingerprint(requestFingerprint);
        String operationKey = operationScope + '|' + key;
        IdempotencyReceipt previous = idempotencyOperations.get(operationKey);
        if (previous == null) {
            throw new ReliabilityStateException("idempotency operation was not started");
        }
        if (!previous.requestFingerprint().equals(fingerprint)) {
            throw new ReliabilityConflictException("idempotency key was reused with a different request fingerprint");
        }
        if (previous.status() == status && Objects.equals(previous.resultCode(), normalizeReason(resultCode))) {
            return previous.asIdempotentReplay();
        }
        if (previous.status() != IdempotencyStatus.PROCESSING) {
            throw new ReliabilityStateException("idempotency operation is already terminal");
        }
        IdempotencyReceipt completed = new IdempotencyReceipt(operationScope, key, fingerprint, status,
                normalizeReason(resultCode), Objects.requireNonNull(now, "now"), false);
        idempotencyOperations.put(operationKey, completed);
        return completed;
    }

    private static boolean isNextCompensationStep(SagaStateRecord state, String stepId) {
        List<String> ids = new ArrayList<>(state.definitions.keySet());
        Collections.reverse(ids);
        for (String id : ids) {
            SagaStepState stepState = state.steps.get(id);
            if (stepState == SagaStepState.COMPENSATING) {
                return id.equals(stepId);
            }
        }
        return false;
    }

    private static long safeNextSequence(long sequence) {
        return sequence == Long.MAX_VALUE ? Long.MAX_VALUE : sequence + 1;
    }

    private EventRecord normalizeEvent(EventRecord event) {
        Objects.requireNonNull(event, "event");
        String aggregateType = normalizeToken(event.aggregateType(), "aggregateType");
        String aggregateId = normalizeToken(event.aggregateId(), "aggregateId");
        int partition = partitionFor(aggregateType, aggregateId, partitionCount);
        if (event.partition() != partition) {
            throw new ReliabilityConflictException("client-supplied aggregate partition does not match the ledger");
        }
        return new EventRecord(normalizeToken(event.eventId(), "eventId"), normalizeEventType(event.eventType()),
                normalizeSchemaVersion(event.schemaVersion()), aggregateType, aggregateId, partition,
                event.sequence(), normalizeFingerprint(event.fingerprint()), event.occurredAt(),
                normalizeOptionalToken(event.traceId(), "traceId"));
    }

    private void validateSchema(EventRecord event) {
        SchemaWindow window = schemaWindows.get(event.eventType());
        if (window != null && !window.acceptedSchemaVersions().contains(event.schemaVersion())) {
            throw new ReliabilitySchemaException("schemaVersion is outside the compatibility window");
        }
    }

    private ReceiptState requireReceipt(ReceiptKey key) {
        ReceiptState state = receipts.get(key);
        if (state == null) {
            throw new ReliabilityStateException("event receipt was not found");
        }
        return state;
    }

    private SagaStateRecord requireSaga(String sagaId) {
        SagaStateRecord state = sagas.get(normalizeToken(sagaId, "sagaId"));
        if (state == null) {
            throw new ReliabilityStateException("saga was not found");
        }
        return state;
    }

    private static List<SagaStep> normalizeSteps(List<SagaStep> steps) {
        if (steps == null || steps.isEmpty() || steps.size() > 64) {
            throw new IllegalArgumentException("a saga must have between 1 and 64 steps");
        }
        Set<String> ids = new LinkedHashSet<>();
        List<SagaStep> normalized = new ArrayList<>();
        for (SagaStep step : steps) {
            SagaStep value = Objects.requireNonNull(step, "saga step");
            SagaStep canonical = new SagaStep(normalizeToken(value.stepId(), "stepId"),
                    normalizeToken(value.action(), "action"), normalizeToken(value.compensationAction(),
                            "compensationAction"));
            if (!ids.add(canonical.stepId())) {
                throw new IllegalArgumentException("saga step ids must be unique");
            }
            normalized.add(canonical);
        }
        return List.copyOf(normalized);
    }

    private static String dlqId(String consumerName, String eventId) {
        return "dlq-" + sha256(consumerName + '|' + eventId).substring(0, 24);
    }

    private static String normalizeEventType(String value) {
        Objects.requireNonNull(value, "eventType");
        String normalized = value.trim().toLowerCase(Locale.ROOT);
        if (!EVENT_TYPE.matcher(normalized).matches()) {
            throw new IllegalArgumentException("eventType must use domain.action.vN");
        }
        return normalized;
    }

    private static String normalizeToken(String value, String field) {
        Objects.requireNonNull(value, field);
        String normalized = value.trim().toLowerCase(Locale.ROOT);
        if (normalized.isEmpty() || normalized.length() > MAX_TOKEN_LENGTH || !SAFE_TOKEN.matcher(normalized).matches()) {
            throw new IllegalArgumentException(field + " has an unsafe format");
        }
        return normalized;
    }

    private static String normalizeOptionalToken(String value, String field) {
        return value == null || value.isBlank() ? null : normalizeToken(value, field);
    }

    private static String normalizeFingerprint(String value) {
        Objects.requireNonNull(value, "fingerprint");
        String normalized = value.trim().toLowerCase(Locale.ROOT);
        if (!FINGERPRINT.matcher(normalized).matches()) {
            throw new IllegalArgumentException("fingerprint must be a SHA-256 hex digest");
        }
        return normalized;
    }

    private static String normalizeReason(String value) {
        String normalized = value == null || value.isBlank() ? "UNSPECIFIED" : value.trim().toUpperCase(Locale.ROOT);
        if (normalized.length() > MAX_REASON_LENGTH || !normalized.matches("[A-Z0-9._:-]+")) {
            throw new IllegalArgumentException("reasonCode has an unsafe format");
        }
        return normalized;
    }

    private static long parsePositiveVersion(String value, String field) {
        try {
            long parsed = Long.parseLong(value);
            if (parsed < 1) throw new NumberFormatException();
            return parsed;
        } catch (NumberFormatException exception) {
            throw new IllegalArgumentException(field + " version must be positive", exception);
        }
    }

    private static byte[] digest(byte[] bytes) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(bytes);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }

    private static void assertSameOperation(String expected, String actual) {
        if (!Objects.equals(expected, actual)) {
            throw new ReliabilityConflictException("idempotency key was reused with different metadata");
        }
    }

    @FunctionalInterface
    public interface EventHandler {
        void handle(EventRecord event) throws Exception;
    }

    public static final class ProcessingFailure extends RuntimeException {
        private static final long serialVersionUID = 1L;
        private final boolean retryable;
        private final String reasonCode;

        private ProcessingFailure(boolean retryable, String reasonCode) {
            super(reasonCode);
            this.retryable = retryable;
            this.reasonCode = normalizeReason(reasonCode);
        }

        public static ProcessingFailure retryable(String reasonCode) {
            return new ProcessingFailure(true, reasonCode);
        }

        public static ProcessingFailure terminal(String reasonCode) {
            return new ProcessingFailure(false, reasonCode);
        }

        public boolean retryable() {
            return retryable;
        }

        public String reasonCode() {
            return reasonCode;
        }
    }

    public record RetryPolicy(int maxAttempts, Duration initialBackoff, Duration maxBackoff) {
        public RetryPolicy {
            if (maxAttempts < 1 || maxAttempts > 20 || initialBackoff == null || maxBackoff == null
                    || initialBackoff.isNegative() || initialBackoff.isZero() || maxBackoff.isNegative()
                    || maxBackoff.compareTo(initialBackoff) < 0) {
                throw new IllegalArgumentException("retry policy is invalid or unbounded");
            }
        }

        public Duration backoffFor(int attempt) {
            if (attempt < 1) throw new IllegalArgumentException("attempt must be positive");
            long multiplier = 1L << Math.min(attempt - 1, 30);
            Duration candidate;
            try {
                candidate = initialBackoff.multipliedBy(multiplier);
            } catch (ArithmeticException exception) {
                candidate = maxBackoff;
            }
            return candidate.compareTo(maxBackoff) > 0 ? maxBackoff : candidate;
        }
    }

    public record EventRecord(String eventId, String eventType, String schemaVersion, String aggregateType,
            String aggregateId, int partition, long sequence, String fingerprint, Instant occurredAt,
            String traceId) {
        public EventRecord {
            eventId = normalizeToken(eventId, "eventId");
            eventType = normalizeEventType(eventType);
            schemaVersion = normalizeSchemaVersion(schemaVersion);
            aggregateType = normalizeToken(aggregateType, "aggregateType");
            aggregateId = normalizeToken(aggregateId, "aggregateId");
            if (partition < 0 || sequence < FIRST_SEQUENCE) {
                throw new IllegalArgumentException("partition and sequence are invalid");
            }
            fingerprint = normalizeFingerprint(fingerprint);
            occurredAt = Objects.requireNonNull(occurredAt, "occurredAt");
            traceId = normalizeOptionalToken(traceId, "traceId");
        }
    }

    public enum ProcessingStatus {
        APPLIED,
        BUFFERED,
        DUPLICATE,
        STALE,
        RETRY_SCHEDULED,
        RETRY_NOT_DUE,
        DEAD_LETTER,
        MANUAL_RECOVERY_REQUIRED
    }

    public enum ReceiptStatus {
        BUFFERED,
        RETRY_SCHEDULED,
        REPLAY_QUEUED,
        APPLIED,
        STALE,
        DEAD_LETTER,
        MANUAL_RECOVERY
    }

    public enum SagaState {
        RUNNING,
        COMPLETED,
        COMPENSATING,
        COMPENSATED,
        FAILED,
        MANUAL_RECOVERY
    }

    public enum SagaStepState {
        PENDING,
        APPLIED,
        COMPENSATING,
        COMPENSATED
    }

    public record Cursor(String consumerName, int partition, long nextSequence, Instant updatedAt) {
        public Cursor {
            consumerName = normalizeToken(consumerName, "consumerName");
            if (partition < 0 || nextSequence < FIRST_SEQUENCE) {
                throw new IllegalArgumentException("cursor is invalid");
            }
            updatedAt = Objects.requireNonNull(updatedAt, "updatedAt");
        }
    }

    public record EventReceipt(String consumerName, String eventId, String eventType, String schemaVersion,
            String aggregateType, String aggregateId, int partition, long sequence, ReceiptStatus status,
            int attempt, int replayCount, Instant nextAttemptAt, String reasonCode, String fingerprint,
            String replayId, Instant firstSeenAt, Instant updatedAt) {
        public EventReceipt {
            consumerName = normalizeToken(consumerName, "consumerName");
            eventId = normalizeToken(eventId, "eventId");
            eventType = normalizeEventType(eventType);
            schemaVersion = normalizeSchemaVersion(schemaVersion);
            aggregateType = normalizeToken(aggregateType, "aggregateType");
            aggregateId = normalizeToken(aggregateId, "aggregateId");
            if (partition < 0 || sequence < FIRST_SEQUENCE || status == null || attempt < 0 || replayCount < 0) {
                throw new IllegalArgumentException("event receipt is invalid");
            }
            fingerprint = normalizeFingerprint(fingerprint);
            replayId = replayId == null ? null : normalizeToken(replayId, "replayId");
            firstSeenAt = Objects.requireNonNull(firstSeenAt, "firstSeenAt");
            updatedAt = Objects.requireNonNull(updatedAt, "updatedAt");
        }
    }

    public record ProcessingResult(ProcessingStatus status, String consumerName, String eventId, int partition,
            long sequence, int attempt, long nextSequence, Instant nextAttemptAt, String reasonCode,
            boolean replayed, String replayId, String dlqId, Instant processedAt) {
        public ProcessingResult {
            if (status == null || partition < 0 || sequence < FIRST_SEQUENCE || attempt < 0
                    || nextSequence < FIRST_SEQUENCE) {
                throw new IllegalArgumentException("processing result is invalid");
            }
            consumerName = normalizeToken(consumerName, "consumerName");
            eventId = normalizeToken(eventId, "eventId");
            reasonCode = reasonCode == null ? null : normalizeReason(reasonCode);
            replayId = replayId == null ? null : normalizeToken(replayId, "replayId");
            processedAt = Objects.requireNonNull(processedAt, "processedAt");
        }
    }

    public record DeadLetter(String dlqId, String consumerName, String eventId, String eventType,
            String schemaVersion, String aggregateType, String aggregateId, int partition, long sequence,
            int attempts, String reasonCode, String fingerprint, Instant failedAt) {
        public DeadLetter {
            dlqId = normalizeToken(dlqId, "dlqId");
            consumerName = normalizeToken(consumerName, "consumerName");
            eventId = normalizeToken(eventId, "eventId");
            eventType = normalizeEventType(eventType);
            schemaVersion = normalizeSchemaVersion(schemaVersion);
            aggregateType = normalizeToken(aggregateType, "aggregateType");
            aggregateId = normalizeToken(aggregateId, "aggregateId");
            if (partition < 0 || sequence < FIRST_SEQUENCE || attempts < 1) {
                throw new IllegalArgumentException("dead letter is invalid");
            }
            reasonCode = normalizeReason(reasonCode);
            fingerprint = normalizeFingerprint(fingerprint);
            failedAt = Objects.requireNonNull(failedAt, "failedAt");
        }
    }

    public record SchemaWindow(String eventType, String currentSchemaVersion,
            Set<String> acceptedSchemaVersions) {
        public SchemaWindow {
            eventType = normalizeEventType(eventType);
            currentSchemaVersion = normalizeSchemaVersion(currentSchemaVersion);
            acceptedSchemaVersions = Collections.unmodifiableSet(new TreeSet<>(acceptedSchemaVersions));
            if (!acceptedSchemaVersions.contains(currentSchemaVersion)) {
                throw new IllegalArgumentException("schema window must accept its current schema");
            }
        }
    }

    public record ReplayResult(String replayId, String consumerName, String eventId, String replayKey,
            String reasonCode, int replayCount, Instant queuedAt, boolean idempotentReplay) {
        public ReplayResult {
            replayId = normalizeToken(replayId, "replayId");
            consumerName = normalizeToken(consumerName, "consumerName");
            eventId = normalizeToken(eventId, "eventId");
            replayKey = normalizeToken(replayKey, "replayKey");
            reasonCode = normalizeReason(reasonCode);
            if (replayCount < 1) throw new IllegalArgumentException("replayCount must be positive");
            queuedAt = Objects.requireNonNull(queuedAt, "queuedAt");
        }

        private ReplayResult asIdempotentReplay() {
            return new ReplayResult(replayId, consumerName, eventId, replayKey, reasonCode, replayCount,
                    queuedAt, true);
        }
    }

    public enum IdempotencyStatus {
        PROCESSING,
        COMPLETED,
        FAILED
    }

    public record IdempotencyReceipt(String scope, String idempotencyKey, String requestFingerprint,
            IdempotencyStatus status, String resultCode, Instant updatedAt, boolean idempotentReplay) {
        public IdempotencyReceipt {
            scope = normalizeToken(scope, "scope");
            idempotencyKey = normalizeToken(idempotencyKey, "idempotencyKey");
            requestFingerprint = normalizeFingerprint(requestFingerprint);
            Objects.requireNonNull(status, "status");
            resultCode = resultCode == null ? null : normalizeReason(resultCode);
            updatedAt = Objects.requireNonNull(updatedAt, "updatedAt");
            if (status != IdempotencyStatus.PROCESSING && resultCode == null) {
                throw new IllegalArgumentException("terminal idempotency receipt requires a result code");
            }
        }

        private IdempotencyReceipt asIdempotentReplay() {
            return new IdempotencyReceipt(scope, idempotencyKey, requestFingerprint, status, resultCode,
                    updatedAt, true);
        }
    }

    public record ManualRecoveryResult(String consumerName, String eventId, String operatorId,
            String recoveryKey, String reasonCode, Instant requestedAt, String dlqId,
            boolean idempotentReplay) {
        public ManualRecoveryResult {
            consumerName = normalizeToken(consumerName, "consumerName");
            eventId = normalizeToken(eventId, "eventId");
            operatorId = normalizeToken(operatorId, "operatorId");
            recoveryKey = normalizeToken(recoveryKey, "recoveryKey");
            reasonCode = normalizeReason(reasonCode);
            requestedAt = Objects.requireNonNull(requestedAt, "requestedAt");
        }

        private ManualRecoveryResult asIdempotentReplay() {
            return new ManualRecoveryResult(consumerName, eventId, operatorId, recoveryKey, reasonCode,
                    requestedAt, dlqId, true);
        }
    }

    public record SagaStep(String stepId, String action, String compensationAction) {
        public SagaStep {
            stepId = normalizeToken(stepId, "stepId");
            action = normalizeToken(action, "action");
            compensationAction = normalizeToken(compensationAction, "compensationAction");
        }
    }

    public record SagaStepSnapshot(String stepId, String action, String compensationAction, SagaStepState state) {
        public SagaStepSnapshot {
            stepId = normalizeToken(stepId, "stepId");
            action = normalizeToken(action, "action");
            compensationAction = normalizeToken(compensationAction, "compensationAction");
            Objects.requireNonNull(state, "state");
        }
    }

    public record SagaSnapshot(String sagaId, String aggregateType, String aggregateId, SagaState state,
            List<SagaStepSnapshot> steps, String reasonCode, Instant updatedAt) {
        public SagaSnapshot {
            sagaId = normalizeToken(sagaId, "sagaId");
            aggregateType = normalizeToken(aggregateType, "aggregateType");
            aggregateId = normalizeToken(aggregateId, "aggregateId");
            Objects.requireNonNull(state, "state");
            steps = List.copyOf(steps);
            reasonCode = reasonCode == null ? null : normalizeReason(reasonCode);
            updatedAt = Objects.requireNonNull(updatedAt, "updatedAt");
        }
    }

    public static class ReliabilityException extends RuntimeException {
        private static final long serialVersionUID = 1L;

        protected ReliabilityException(String message) {
            super(message);
        }
    }

    public static final class ReliabilityConflictException extends ReliabilityException {
        private static final long serialVersionUID = 1L;

        public ReliabilityConflictException(String message) {
            super(message);
        }
    }

    public static final class ReliabilityStateException extends ReliabilityException {
        private static final long serialVersionUID = 1L;

        public ReliabilityStateException(String message) {
            super(message);
        }
    }

    public static final class ReliabilitySchemaException extends ReliabilityException {
        private static final long serialVersionUID = 1L;

        public ReliabilitySchemaException(String message) {
            super(message);
        }
    }

    private static final class ReceiptState {
        private final String consumerName;
        private final EventRecord event;
        private final String fingerprint;
        private final Instant firstSeenAt;
        private ReceiptStatus status = ReceiptStatus.BUFFERED;
        private int attempt;
        private int replayCount;
        private Instant nextAttemptAt;
        private String reasonCode;
        private String replayId;
        private Instant updatedAt;

        private ReceiptState(String consumerName, EventRecord event, Instant firstSeenAt) {
            this.consumerName = consumerName;
            this.event = event;
            this.fingerprint = event.fingerprint();
            this.firstSeenAt = firstSeenAt;
            this.updatedAt = firstSeenAt;
        }

        private EventReceipt snapshot() {
            return new EventReceipt(consumerName, event.eventId(),
                    event.eventType(), event.schemaVersion(), event.aggregateType(), event.aggregateId(),
                    event.partition(), event.sequence(), status, attempt, replayCount, nextAttemptAt,
                    reasonCode, fingerprint, replayId, firstSeenAt, updatedAt);
        }
    }

    private static final class SagaStateRecord {
        private final String sagaId;
        private final String aggregateType;
        private final String aggregateId;
        private final String fingerprint;
        private final LinkedHashMap<String, SagaStep> definitions = new LinkedHashMap<>();
        private final LinkedHashMap<String, SagaStepState> steps = new LinkedHashMap<>();
        private SagaState state = SagaState.RUNNING;
        private String reasonCode;
        private Instant updatedAt;

        private SagaStateRecord(String sagaId, String aggregateType, String aggregateId,
                List<SagaStep> values, String fingerprint, Instant updatedAt) {
            this.sagaId = sagaId;
            this.aggregateType = aggregateType;
            this.aggregateId = aggregateId;
            this.fingerprint = fingerprint;
            this.updatedAt = updatedAt;
            for (SagaStep step : values) {
                definitions.put(step.stepId(), step);
                steps.put(step.stepId(), SagaStepState.PENDING);
            }
        }

        private SagaSnapshot snapshot() {
            List<SagaStepSnapshot> snapshots = new ArrayList<>();
            for (Map.Entry<String, SagaStep> entry : definitions.entrySet()) {
                SagaStep definition = entry.getValue();
                snapshots.add(new SagaStepSnapshot(definition.stepId(), definition.action(),
                        definition.compensationAction(), steps.get(entry.getKey())));
            }
            return new SagaSnapshot(sagaId, aggregateType, aggregateId, state, snapshots, reasonCode, updatedAt);
        }
    }

    private record ReceiptKey(String consumerName, String eventId) {
    }

    private record CursorKey(String consumerName, int partition) {
    }
}
