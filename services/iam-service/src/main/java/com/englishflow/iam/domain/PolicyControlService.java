package com.englishflow.iam.domain;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.security.MessageDigest;
import java.time.Clock;
import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Owns the P1 immutable policy lifecycle and serializes ACTIVE-policy switches. This service
 * deliberately stores receipts only; reliable cross-service propagation is the later M2-005
 * outbox/event task and is not claimed here.
 */
public final class PolicyControlService {
    private static final int BUNDLE_TTL_SECONDS = 60;

    private final PolicyStore store;
    private final AuditFactPort audit;
    private final IamTransactionRunner transactions;
    private final ObjectMapper objectMapper;
    private final Clock clock;

    public PolicyControlService(PolicyStore store, AuditFactPort audit, IamTransactionRunner transactions,
                                ObjectMapper objectMapper, Clock clock) {
        this.store = Objects.requireNonNull(store, "store");
        this.audit = Objects.requireNonNull(audit, "audit");
        this.transactions = Objects.requireNonNull(transactions, "transactions");
        this.objectMapper = Objects.requireNonNull(objectMapper, "objectMapper");
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    public synchronized PolicyMutation create(PolicyActor actor, PolicyDocument document, String reason,
                                               String requestId, String traceId) {
        return transactions.execute(() -> {
            actor.require("iam.policy.draft.create");
            requireReason(reason);
            Instant now = Instant.now(clock);
            UUID id = UUID.randomUUID();
            PolicyVersionRecord record = new PolicyVersionRecord(id, "p1-" + id,
                    PolicyLifecycleStatus.DRAFT, 1, actor.tenantId(), document, digestDocument(document),
                    now, now, actor.principalId(), Set.of(), null, null, null, null, null, null,
                    PolicyCacheInvalidationReceipt.notRequired(now));
            PolicyAuditRecord policyAudit = audit(record, actor, "iam.policy.draft.created.v1", reason,
                    requestId, traceId, now);
            PolicyVersionRecord saved = store.create(record, policyAudit);
            appendControlAudit(policyAudit, IamDecisionCode.POLICY_DRAFT_CREATED, true);
            return new PolicyMutation(saved, policyAudit, saved.cacheInvalidation());
        });
    }

    public synchronized PolicyMutation update(UUID policyVersionId, int expectedRevision, PolicyDocument document,
                                               String reason, PolicyActor actor, String requestId, String traceId) {
        return transactions.execute(() -> {
            actor.require("iam.policy.draft.update");
            requireReason(reason);
            PolicyVersionRecord current = requirePolicy(policyVersionId);
            requireState(current, PolicyLifecycleStatus.DRAFT);
            requireRevision(current, expectedRevision);
            Instant now = Instant.now(clock);
            Set<PrincipalId> contributors = contributorsWith(current, actor.principalId());
            PolicyVersionRecord next = copy(current, PolicyLifecycleStatus.DRAFT, current.revision() + 1,
                    document, digestDocument(document), now, contributors, null, null, null, null,
                    null, null, PolicyCacheInvalidationReceipt.notRequired(now));
            PolicyAuditRecord policyAudit = audit(next, actor, "iam.policy.draft.updated.v1", reason,
                    requestId, traceId, now);
            PolicyVersionRecord saved = store.compareAndSet(current, next, policyAudit, true);
            appendControlAudit(policyAudit, IamDecisionCode.POLICY_DRAFT_UPDATED, true);
            return new PolicyMutation(saved, policyAudit, saved.cacheInvalidation());
        });
    }

    public synchronized PolicyMutation submit(UUID policyVersionId, int expectedRevision, String reason,
                                               PolicyActor actor, String requestId, String traceId) {
        return transactions.execute(() -> {
            actor.require("iam.policy.submit");
            requireReason(reason);
            PolicyVersionRecord current = requirePolicy(policyVersionId);
            requireState(current, PolicyLifecycleStatus.DRAFT);
            requireRevision(current, expectedRevision);
            Instant now = Instant.now(clock);
            PolicyVersionRecord next = copy(current, PolicyLifecycleStatus.SUBMITTED, current.revision() + 1,
                    current.document(), current.artifactDigest(), now, current.contributors(), actor.principalId(),
                    null, null, null, null, null, PolicyCacheInvalidationReceipt.notRequired(now));
            PolicyAuditRecord policyAudit = audit(next, actor, "iam.policy.version.submitted.v1", reason,
                    requestId, traceId, now);
            PolicyVersionRecord saved = store.compareAndSet(current, next, policyAudit, false);
            appendControlAudit(policyAudit, IamDecisionCode.POLICY_SUBMITTED, true);
            return new PolicyMutation(saved, policyAudit, saved.cacheInvalidation());
        });
    }

    public synchronized PolicyMutation approve(UUID policyVersionId, int expectedRevision, String reason,
                                                PolicyActor actor, String requestId, String traceId) {
        try {
            return transactions.execute(() -> {
                actor.require("iam.policy.approve");
                requireReason(reason);
                PolicyVersionRecord current = requirePolicy(policyVersionId);
                requireState(current, PolicyLifecycleStatus.SUBMITTED);
                requireRevision(current, expectedRevision);
                if (current.authorOrContributor(actor.principalId()) || actor.principalId().equals(current.submittedBy())) {
                    throw new IamPolicyException(IamDecisionCode.POLICY_SEPARATION_OF_DUTIES,
                            "iam.policy.separation_of_duties_required");
                }
                Instant now = Instant.now(clock);
                PolicyVersionRecord next = copy(current, PolicyLifecycleStatus.APPROVED, current.revision() + 1,
                        current.document(), current.artifactDigest(), now, current.contributors(), current.submittedBy(),
                        actor.principalId(), null, null, null, null, PolicyCacheInvalidationReceipt.notRequired(now));
                PolicyAuditRecord policyAudit = audit(next, actor, "iam.policy.version.independently_approved.v1", reason,
                        requestId, traceId, now);
                PolicyVersionRecord saved = store.compareAndSet(current, next, policyAudit, false);
                appendControlAudit(policyAudit, IamDecisionCode.POLICY_APPROVED, true);
                return new PolicyMutation(saved, policyAudit, saved.cacheInvalidation());
            });
        } catch (IamPolicyException exception) {
            if (exception.code() != IamDecisionCode.POLICY_SEPARATION_OF_DUTIES) throw exception;
            // The rejected lifecycle transaction rolls back. Persist the denial in a new,
            // successful transaction and only then rethrow; otherwise the security audit
            // would be rolled back together with the forbidden approval attempt.
            transactions.execute(() -> {
                appendDeniedAudit(actor, policyVersionId, "iam.policy.version.approval_denied.v1", requestId, traceId,
                        IamDecisionCode.POLICY_SEPARATION_OF_DUTIES);
                return null;
            });
            throw exception;
        }
    }

    public synchronized PolicyMutation activate(UUID policyVersionId, int expectedRevision, String reason,
                                                 PolicyActor actor, String requestId, String traceId) {
        return transactions.execute(() -> {
            actor.require("iam.policy.activate");
            requireReason(reason);
            PolicyVersionRecord current = requirePolicy(policyVersionId);
            requireState(current, PolicyLifecycleStatus.APPROVED);
            requireRevision(current, expectedRevision);
            Instant now = Instant.now(clock);
            Optional<PolicyVersionRecord> priorActive = store.lockActive(current.tenantId());
            if (priorActive.isPresent() && !priorActive.get().policyVersionId().equals(current.policyVersionId())) {
                PolicyVersionRecord prior = priorActive.get();
                if (prior.status() != PolicyLifecycleStatus.ACTIVE) {
                    throw new IamPolicyException(IamDecisionCode.POLICY_UNAVAILABLE, "iam.policy.active_slot_invalid");
                }
                PolicyVersionRecord superseded = copy(prior, PolicyLifecycleStatus.REVOKED, prior.revision() + 1,
                        prior.document(), prior.artifactDigest(), now, prior.contributors(), prior.submittedBy(),
                        prior.approvedBy(), prior.activatedBy(), actor.principalId(), prior.activatedAt(), now,
                        PolicyCacheInvalidationReceipt.pendingRevocation(now));
                PolicyAuditRecord priorAudit = audit(superseded, actor, "iam.policy.version.superseded.v1", reason,
                        requestId, traceId, now);
                store.compareAndSet(prior, superseded, priorAudit, false);
                appendControlAudit(priorAudit, IamDecisionCode.POLICY_REVOKED, true);
            }
            PolicyVersionRecord next = copy(current, PolicyLifecycleStatus.ACTIVE, current.revision() + 1,
                    current.document(), current.artifactDigest(), now, current.contributors(), current.submittedBy(),
                    current.approvedBy(), actor.principalId(), null, now, null,
                    PolicyCacheInvalidationReceipt.pendingActivation(now));
            PolicyAuditRecord policyAudit = audit(next, actor, "iam.policy.version.activated.v1", reason,
                    requestId, traceId, now);
            PolicyVersionRecord saved = store.compareAndSet(current, next, policyAudit, false);
            store.setActive(current.tenantId(), saved.policyVersionId());
            appendControlAudit(policyAudit, IamDecisionCode.POLICY_ACTIVATED, true);
            return new PolicyMutation(saved, policyAudit, saved.cacheInvalidation());
        });
    }

    public synchronized PolicyMutation revoke(UUID policyVersionId, int expectedRevision, String reason,
                                               PolicyActor actor, String requestId, String traceId) {
        return transactions.execute(() -> {
            actor.require("iam.policy.revoke");
            requireReason(reason);
            PolicyVersionRecord current = requirePolicy(policyVersionId);
            requireState(current, PolicyLifecycleStatus.ACTIVE);
            requireRevision(current, expectedRevision);
            Optional<PolicyVersionRecord> slot = store.lockActive(current.tenantId());
            if (slot.isEmpty() || !slot.get().policyVersionId().equals(current.policyVersionId())) {
                throw new IamPolicyException(IamDecisionCode.POLICY_REVISION_CONFLICT,
                        "iam.policy.active_slot_conflict");
            }
            Instant now = Instant.now(clock);
            PolicyVersionRecord next = copy(current, PolicyLifecycleStatus.REVOKED, current.revision() + 1,
                    current.document(), current.artifactDigest(), now, current.contributors(), current.submittedBy(),
                    current.approvedBy(), current.activatedBy(), actor.principalId(), current.activatedAt(), now,
                    PolicyCacheInvalidationReceipt.pendingRevocation(now));
            PolicyAuditRecord policyAudit = audit(next, actor, "iam.policy.version.revoked.v1", reason,
                    requestId, traceId, now);
            PolicyVersionRecord saved = store.compareAndSet(current, next, policyAudit, false);
            store.clearActive(current.tenantId(), saved.policyVersionId());
            appendControlAudit(policyAudit, IamDecisionCode.POLICY_REVOKED, true);
            return new PolicyMutation(saved, policyAudit, saved.cacheInvalidation());
        });
    }

    public PolicyVersionRecord get(UUID policyVersionId, PolicyActor actor) {
        actor.require("iam.policy.read");
        PolicyVersionRecord record = requirePolicy(policyVersionId);
        ensureTenant(record, actor);
        return record;
    }

    public List<PolicyVersionRecord> list(PolicyActor actor) {
        actor.require("iam.policy.read");
        return store.list(actor.tenantId());
    }

    public List<PolicyAuditRecord> audits(UUID policyVersionId, PolicyActor actor) {
        get(policyVersionId, actor);
        return store.audits(policyVersionId);
    }

    public PolicyBundle activeBundle() {
        PolicyVersionRecord active = requireActive();
        Instant now = Instant.now(clock);
        return new PolicyBundle(UUID.randomUUID(), active, now, now.plusSeconds(BUNDLE_TTL_SECONDS), BUNDLE_TTL_SECONDS);
    }

    public PolicyVersionRecord activePolicy() { return requireActive(); }

    private PolicyVersionRecord requireActive() {
        PolicyVersionRecord active = store.active(TenantScope.PLATFORM_TENANT).orElseThrow(() ->
                new IamPolicyException(IamDecisionCode.POLICY_UNAVAILABLE, "iam.policy.active_unavailable"));
        if (active.status() != PolicyLifecycleStatus.ACTIVE || active.activatedAt() == null) {
            throw new IamPolicyException(IamDecisionCode.POLICY_UNAVAILABLE, "iam.policy.active_unavailable");
        }
        return active;
    }

    private PolicyVersionRecord requirePolicy(UUID id) {
        if (id == null) throw new IamPolicyException(IamDecisionCode.POLICY_NOT_FOUND, "iam.policy.not_found");
        return store.find(id).orElseThrow(() -> new IamPolicyException(IamDecisionCode.POLICY_NOT_FOUND,
                "iam.policy.not_found"));
    }

    private static void ensureTenant(PolicyVersionRecord record, PolicyActor actor) {
        if (!record.tenantId().equals(actor.tenantId())) {
            throw new IamPolicyException(IamDecisionCode.CLIENT_TRUSTED_INPUT_REJECTED,
                    "iam.policy.tenant_not_server_derived");
        }
    }

    private static void requireState(PolicyVersionRecord record, PolicyLifecycleStatus expected) {
        if (record.status() != expected) {
            throw new IamPolicyException(IamDecisionCode.POLICY_LIFECYCLE_INVALID,
                    "iam.policy.lifecycle_invalid");
        }
    }

    private static void requireRevision(PolicyVersionRecord record, int expectedRevision) {
        if (expectedRevision < 1 || record.revision() != expectedRevision) {
            throw new IamPolicyException(IamDecisionCode.POLICY_REVISION_CONFLICT,
                    "iam.policy.revision_conflict");
        }
    }

    private static void requireReason(String reason) {
        if (reason == null || reason.isBlank() || reason.length() > 1000
                || reason.chars().anyMatch(Character::isISOControl)) {
            throw new IamPolicyException(IamDecisionCode.POLICY_DOCUMENT_INVALID, "iam.policy.reason_invalid");
        }
    }

    private PolicyVersionRecord copy(PolicyVersionRecord current, PolicyLifecycleStatus status, int revision,
                                     PolicyDocument document, String digest, Instant now, Set<PrincipalId> contributors,
                                     PrincipalId submittedBy, PrincipalId approvedBy, PrincipalId activatedBy,
                                     PrincipalId revokedBy, Instant activatedAt, Instant revokedAt,
                                     PolicyCacheInvalidationReceipt receipt) {
        return new PolicyVersionRecord(current.policyVersionId(), current.version(), status, revision,
                current.tenantId(), document, digest, current.createdAt(), now, current.createdBy(), contributors,
                submittedBy, approvedBy, activatedBy, revokedBy, activatedAt, revokedAt, receipt);
    }

    private static Set<PrincipalId> contributorsWith(PolicyVersionRecord current, PrincipalId actor) {
        Set<PrincipalId> contributors = new LinkedHashSet<>(current.contributors());
        if (!current.createdBy().equals(actor)) contributors.add(actor);
        return Set.copyOf(contributors);
    }

    private PolicyAuditRecord audit(PolicyVersionRecord policy, PolicyActor actor, String event, String reason,
                                    String requestId, String traceId, Instant now) {
        return new PolicyAuditRecord(UUID.randomUUID(), policy.policyVersionId(), policy.revision(), event,
                actor.principalId(), actor.tenantId(), correlation(requestId), correlation(traceId),
                SecretDigests.sha256Hex("policy-reason:" + reason), now);
    }

    private void appendControlAudit(PolicyAuditRecord event, IamDecisionCode code, boolean allowed) {
        try {
            audit.append(new AuditDecision(event.auditId(), event.eventType(), code, allowed, event.actor(),
                    event.tenantId(), event.recordedAt(), Set.of("policy.lifecycle"), Set.of(),
                    java.util.Map.of("policy.version", event.policyVersionId().toString())));
        } catch (IamPolicyException exception) {
            throw exception;
        } catch (RuntimeException exception) {
            throw new IamPolicyException(IamDecisionCode.AUDIT_UNAVAILABLE, "iam.audit.unavailable");
        }
    }

    private void appendDeniedAudit(PolicyActor actor, UUID policyVersionId, String event, String requestId,
                                   String traceId, IamDecisionCode code) {
        Instant now = Instant.now(clock);
        PolicyAuditRecord denied = new PolicyAuditRecord(UUID.randomUUID(), policyVersionId == null
                ? UUID.randomUUID() : policyVersionId, 1, event, actor.principalId(), actor.tenantId(),
                correlation(requestId), correlation(traceId), SecretDigests.sha256Hex("policy-denied:" + code.name()), now);
        appendControlAudit(denied, code, false);
    }

    private String digestDocument(PolicyDocument document) {
        try {
            return java.util.HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(objectMapper.writeValueAsBytes(document)));
        } catch (JsonProcessingException | java.security.NoSuchAlgorithmException exception) {
            throw new IamPolicyException(IamDecisionCode.POLICY_DOCUMENT_INVALID, "iam.policy.document_invalid");
        }
    }

    private static String correlation(String value) {
        if (value == null || value.isBlank() || value.length() > 128 || value.chars().anyMatch(Character::isISOControl)) {
            return UUID.randomUUID().toString();
        }
        return value;
    }
}
