package com.englishflow.iam.domain;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Prevents a persistence-enabled IAM process from falling back to non-durable policy facts. */
public final class FailClosedPolicyStore implements PolicyStore {
    private static IamPolicyException unavailable() {
        return new IamPolicyException(IamDecisionCode.IAM_PERSISTENCE_UNAVAILABLE,
                "iam.policy.store_unavailable");
    }
    @Override public PolicyVersionRecord create(PolicyVersionRecord record, PolicyAuditRecord audit) { throw unavailable(); }
    @Override public Optional<PolicyVersionRecord> find(UUID policyVersionId) { throw unavailable(); }
    @Override public List<PolicyVersionRecord> list(String tenantId) { throw unavailable(); }
    @Override public List<PolicyAuditRecord> audits(UUID policyVersionId) { throw unavailable(); }
    @Override public PolicyVersionRecord compareAndSet(PolicyVersionRecord previous, PolicyVersionRecord next,
                                                       PolicyAuditRecord audit, boolean addActorAsContributor) { throw unavailable(); }
    @Override public Optional<PolicyVersionRecord> active(String tenantId) { throw unavailable(); }
    @Override public Optional<PolicyVersionRecord> lockActive(String tenantId) { throw unavailable(); }
    @Override public void setActive(String tenantId, UUID policyVersionId) { throw unavailable(); }
    @Override public void clearActive(String tenantId, UUID expectedPolicyVersionId) { throw unavailable(); }
}
