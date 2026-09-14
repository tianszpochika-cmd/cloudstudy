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

    public ManualRecoveryService(RecoveryStore store) {
        this.store = store;
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

    /** Executes an approved request. Refused unless it was approved first. */
    public RecoveryView execute(String recoveryId, String executor) {
        StoredRecovery stored = load(recoveryId);
        stored.request().execute();
        store.update(stored.request());
        // The receipt names the executor as well as the two people who decided, so the trail survives the
        // request row being archived.
        store.recordReceipt(stored.request(), executor);
        return RecoveryView.of(stored.request(), stored.subjectType(), stored.subjectId(), stored.action(), stored.reason());
    }

    private StoredRecovery load(String recoveryId) {
        return store.find(recoveryId).orElseThrow(() -> new ManualRecoveryRequest.RecoveryNotAllowed(
                "no recovery request " + recoveryId));
    }

    /** What a caller sees. */
    public record RecoveryView(String recoveryId, String status, String requestedBy, String approvedBy,
                               String subjectType, String subjectId, String action, String reason,
                               String failureMessage) {

        static RecoveryView of(ManualRecoveryRequest request, String subjectType, String subjectId,
                               String action, String reason) {
            return new RecoveryView(request.recoveryId(), request.status().name(), request.requestedBy(),
                    request.approvedBy(), subjectType, subjectId, action, reason, request.failureMessage());
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
