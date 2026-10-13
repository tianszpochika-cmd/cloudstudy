package com.englishflow.workflow.application;

import com.englishflow.workflow.domain.ManualRecoveryRequest;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Manual recovery, with the two-person rule enforced by the domain type rather than by this service.
 *
 * <p>The service deliberately has no method that accepts an approver alongside a requester. If it did, a
 * caller could pass the same name twice and the rule would depend on the caller being honest; instead the
 * request is rehydrated from storage and asked to approve itself, which refuses a self-approval whatever the
 * caller intended.
 */
public class ManualRecoveryService {

    private final RecoveryStore store;
    private final RecoverySideEffectPort sideEffects;

    public ManualRecoveryService(RecoveryStore store) {
        this(store, (recoveryId, type, id, action, executor, bearer) -> {
            throw new ManualRecoveryRequest.RecoveryNotAllowed(
                    "no executable recovery for " + type + "/" + action);
        });
    }

    public ManualRecoveryService(RecoveryStore store, RecoverySideEffectPort sideEffects) {
        this.store = store;
        this.sideEffects = sideEffects;
    }

    /** Asks for a recovery, naming the requester taken from the verified token. */
    public RecoveryView request(String requestedBy, String subjectType, String subjectId, String action, String reason) {
        ManualRecoveryRequest request = ManualRecoveryRequest.requested(UUID.randomUUID().toString(), requestedBy);
        store.save(request, subjectType, subjectId, action, reason);
        return RecoveryView.of(request, subjectType, subjectId, action, reason);
    }

    /** Approves a request. The domain type refuses a self-approval. */
    public RecoveryView approve(String recoveryId, String approver) {
        StoredRecovery stored = load(recoveryId);
        stored.request().approve(approver);
        store.update(stored.request());
        return RecoveryView.of(stored.request(), stored.subjectType(), stored.subjectId(), stored.action(), stored.reason());
    }

    /** Rejects a request. */
    public RecoveryView reject(String recoveryId, String approver, String reason) {
        StoredRecovery stored = load(recoveryId);
        stored.request().reject(approver, reason);
        store.update(stored.request());
        return RecoveryView.of(stored.request(), stored.subjectType(), stored.subjectId(), stored.action(), stored.reason());
    }

    /** Executes without a forwarded token (tests / non-HTTP callers); owner calls then stay uncertain. */
    public RecoveryView execute(String recoveryId, String executor) {
        return execute(recoveryId, executor, null);
    }

    /**
     * Executes an approved request: first runs the owner-service mutation, then marks EXECUTED.
     *
     * <ul>
     *   <li>Already EXECUTED: returns the stored view; nothing runs twice.</li>
     *   <li>Owner refused definitively: marked FAILED and the refusal is rethrown.</li>
     *   <li>Outcome unknown: left APPROVED and rethrown. The owner call is idempotent on the
     *       recovery id, so a retry that finds the mutation already applied marks EXECUTED.</li>
     * </ul>
     */
    public RecoveryView execute(String recoveryId, String executor, String bearerToken) {
        StoredRecovery stored = load(recoveryId);
        if (stored.request().status() == ManualRecoveryRequest.Status.EXECUTED) {
            return RecoveryView.of(stored.request(), stored.subjectType(), stored.subjectId(),
                    stored.action(), stored.reason());
        }
        if (stored.request().status() != ManualRecoveryRequest.Status.APPROVED) {
            stored.request().execute(); // produces the precise refusal message
        }
        String detail;
        try {
            detail = sideEffects.apply(recoveryId, stored.subjectType(), stored.subjectId(), stored.action(),
                    executor, bearerToken);
        } catch (RecoverySideEffectPort.SideEffectUncertain uncertain) {
            throw uncertain;
        } catch (RuntimeException error) {
            String message = error.getMessage() == null ? error.getClass().getSimpleName() : error.getMessage();
            stored.request().fail(message);
            store.update(stored.request());
            throw error;
        }
        stored.request().execute();
        store.update(stored.request());
        store.recordReceipt(stored.request(), executor);
        return RecoveryView.of(stored.request(), stored.subjectType(), stored.subjectId(),
                stored.action(), stored.reason(), detail);
    }

    private StoredRecovery load(String recoveryId) {
        return store.find(recoveryId).orElseThrow(() -> new ManualRecoveryRequest.RecoveryNotAllowed(
                "no recovery request " + recoveryId));
    }

    /** What a caller sees. */
    public record RecoveryView(String recoveryId, String status, String requestedBy, String approvedBy,
                               String subjectType, String subjectId, String action, String reason,
                               String failureMessage, String effectDetail) {

        static RecoveryView of(ManualRecoveryRequest request, String subjectType, String subjectId,
                               String action, String reason) {
            return of(request, subjectType, subjectId, action, reason, null);
        }

        static RecoveryView of(ManualRecoveryRequest request, String subjectType, String subjectId,
                               String action, String reason, String effectDetail) {
            return new RecoveryView(request.recoveryId(), request.status().name(), request.requestedBy(),
                    request.approvedBy(), subjectType, subjectId, action, reason, request.failureMessage(),
                    effectDetail);
        }

        public Map<String, Object> toMap() {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("recoveryId", recoveryId);
            map.put("status", status);
            map.put("requestedBy", requestedBy);
            map.put("approvedBy", approvedBy);
            map.put("subjectType", subjectType);
            map.put("subjectId", subjectId);
            map.put("action", action);
            map.put("reason", reason);
            map.put("failureMessage", failureMessage);
            if (effectDetail != null) {
                map.put("effectDetail", effectDetail);
            }
            return map;
        }
    }

    /** A recovery as stored, with the request rehydrated so its rules apply again. */
    public record StoredRecovery(ManualRecoveryRequest request, String subjectType, String subjectId,
                                 String action, String reason) {
    }

    /** Where recoveries live. */
    public interface RecoveryStore {
        void save(ManualRecoveryRequest request, String subjectType, String subjectId, String action, String reason);

        void update(ManualRecoveryRequest request);

        void recordReceipt(ManualRecoveryRequest request, String executor);

        java.util.Optional<StoredRecovery> find(String recoveryId);
    }
}
