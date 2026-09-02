package com.englishflow.iam.domain;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Durable control-plane store. State changes are compare-and-set under the IAM transaction. */
public interface PolicyStore {
    PolicyVersionRecord create(PolicyVersionRecord record, PolicyAuditRecord audit);
    Optional<PolicyVersionRecord> find(UUID policyVersionId);
    List<PolicyVersionRecord> list(String tenantId);
    List<PolicyAuditRecord> audits(UUID policyVersionId);
    PolicyVersionRecord compareAndSet(PolicyVersionRecord previous, PolicyVersionRecord next,
                                      PolicyAuditRecord audit, boolean addActorAsContributor);
    Optional<PolicyVersionRecord> active(String tenantId);
    Optional<PolicyVersionRecord> lockActive(String tenantId);
    void setActive(String tenantId, UUID policyVersionId);
    void clearActive(String tenantId, UUID expectedPolicyVersionId);
}
