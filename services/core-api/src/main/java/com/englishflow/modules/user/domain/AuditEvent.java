package com.englishflow.modules.user.domain;

import java.time.Instant;
import java.util.Map;

/** Append-only audit projection containing only hashes and safe metadata. */
public final class AuditEvent {

    private final String auditId;
    private final String requestId;
    private final String tenantId;
    private final String actorSubjectHash;
    private final long actorUserId;
    private final String actionCode;
    private final String resourceType;
    private final String resourceId;
    private final String resultCode;
    private final String reasonCode;
    private final Map<String, String> metadata;
    private final Instant occurredAt;

    public AuditEvent(
            String auditId,
            String requestId,
            String tenantId,
            String actorSubjectHash,
            long actorUserId,
            String actionCode,
            String resourceType,
            String resourceId,
            String resultCode,
            String reasonCode,
            Map<String, String> metadata,
            Instant occurredAt
    ) {
        this.auditId = auditId;
        this.requestId = requestId;
        this.tenantId = tenantId;
        this.actorSubjectHash = actorSubjectHash;
        this.actorUserId = actorUserId;
        this.actionCode = actionCode;
        this.resourceType = resourceType;
        this.resourceId = resourceId;
        this.resultCode = resultCode;
        this.reasonCode = reasonCode;
        this.metadata = Map.copyOf(metadata);
        this.occurredAt = occurredAt;
    }

    public String auditId() { return auditId; }
    public String requestId() { return requestId; }
    public String tenantId() { return tenantId; }
    public String actorSubjectHash() { return actorSubjectHash; }
    public long actorUserId() { return actorUserId; }
    public String actionCode() { return actionCode; }
    public String resourceType() { return resourceType; }
    public String resourceId() { return resourceId; }
    public String resultCode() { return resultCode; }
    public String reasonCode() { return reasonCode; }
    public Map<String, String> metadata() { return metadata; }
    public Instant occurredAt() { return occurredAt; }

    @Override
    public String toString() {
        return "AuditEvent{" +
                "auditId='" + auditId + '\'' +
                ", requestId='" + requestId + '\'' +
                ", tenantId='" + tenantId + '\'' +
                ", actorSubjectHash='" + actorSubjectHash + '\'' +
                ", actorUserId=" + actorUserId +
                ", actionCode='" + actionCode + '\'' +
                ", resourceType='" + resourceType + '\'' +
                ", resourceId='" + resourceId + '\'' +
                ", resultCode='" + resultCode + '\'' +
                ", reasonCode='" + reasonCode + '\'' +
                ", metadataKeys=" + metadata.keySet() +
                ", occurredAt=" + occurredAt +
                '}';
    }
}
