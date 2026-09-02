package com.englishflow.iam.domain;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/** Explicit local/test policy store; production wiring never selects this adapter. */
public final class InMemoryPolicyStore implements PolicyStore {
    private final Map<UUID, PolicyVersionRecord> records = new ConcurrentHashMap<>();
    private final Map<UUID, List<PolicyAuditRecord>> audits = new ConcurrentHashMap<>();
    private final Map<String, UUID> activeByTenant = new ConcurrentHashMap<>();

    @Override
    public synchronized PolicyVersionRecord create(PolicyVersionRecord record, PolicyAuditRecord audit) {
        if (records.putIfAbsent(record.policyVersionId(), record) != null) {
            throw new IamPolicyException(IamDecisionCode.POLICY_REVISION_CONFLICT,
                    "iam.policy.version_conflict");
        }
        audits.computeIfAbsent(record.policyVersionId(), ignored -> new ArrayList<>()).add(audit);
        return record;
    }

    @Override public Optional<PolicyVersionRecord> find(UUID policyVersionId) {
        return Optional.ofNullable(records.get(policyVersionId));
    }

    @Override public List<PolicyVersionRecord> list(String tenantId) {
        return records.values().stream().filter(record -> record.tenantId().equals(tenantId))
                .sorted(Comparator.comparing(PolicyVersionRecord::updatedAt).reversed()).toList();
    }

    @Override public List<PolicyAuditRecord> audits(UUID policyVersionId) {
        synchronized (this) {
            return List.copyOf(audits.getOrDefault(policyVersionId, List.of()));
        }
    }

    @Override
    public synchronized PolicyVersionRecord compareAndSet(PolicyVersionRecord previous, PolicyVersionRecord next,
                                                            PolicyAuditRecord audit,
                                                            boolean addActorAsContributor) {
        PolicyVersionRecord current = records.get(previous.policyVersionId());
        if (current == null || current.revision() != previous.revision() || current.status() != previous.status()) {
            throw new IamPolicyException(IamDecisionCode.POLICY_REVISION_CONFLICT,
                    "iam.policy.revision_conflict");
        }
        records.put(next.policyVersionId(), next);
        audits.computeIfAbsent(next.policyVersionId(), ignored -> new ArrayList<>()).add(audit);
        return next;
    }

    @Override public Optional<PolicyVersionRecord> active(String tenantId) {
        UUID id = activeByTenant.get(tenantId);
        return id == null ? Optional.empty() : find(id);
    }

    @Override public Optional<PolicyVersionRecord> lockActive(String tenantId) {
        return active(tenantId);
    }

    @Override public synchronized void setActive(String tenantId, UUID policyVersionId) {
        if (!TenantScope.PLATFORM_TENANT.equals(tenantId)) {
            throw new IamPolicyException(IamDecisionCode.CLIENT_TRUSTED_INPUT_REJECTED,
                    "iam.policy.tenant_not_server_derived");
        }
        activeByTenant.put(tenantId, policyVersionId);
    }

    @Override public synchronized void clearActive(String tenantId, UUID expectedPolicyVersionId) {
        if (!activeByTenant.remove(tenantId, expectedPolicyVersionId)) {
            throw new IamPolicyException(IamDecisionCode.POLICY_REVISION_CONFLICT,
                    "iam.policy.active_slot_conflict");
        }
    }
}
