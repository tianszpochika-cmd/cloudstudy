package com.englishflow.iam.domain;

import java.time.Clock;
import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.Objects;
import java.util.Set;

/**
 * Explicit local/test-only bootstrap seam. It can promote an already provisioned IAM account,
 * but never creates an account, accepts a browser command, or grants policy permissions by
 * default during registration.
 */
public final class PolicyBootstrapService {
    public static final Set<String> CONTROL_PERMISSIONS = Set.of(
            "iam.policy.read", "iam.policy.draft.create", "iam.policy.draft.update", "iam.policy.submit",
            "iam.policy.approve", "iam.policy.activate", "iam.policy.revoke");

    private final AccountStore accounts;
    private final AuditFactPort audit;
    private final Clock clock;
    private final IamTransactionRunner transactions;

    public PolicyBootstrapService(AccountStore accounts, AuditFactPort audit, Clock clock) {
        this(accounts, audit, clock, IamTransactionRunner.direct());
    }

    public PolicyBootstrapService(AccountStore accounts, AuditFactPort audit, Clock clock,
                                  IamTransactionRunner transactions) {
        this.accounts = Objects.requireNonNull(accounts, "accounts");
        this.audit = Objects.requireNonNull(audit, "audit");
        this.clock = Objects.requireNonNull(clock, "clock");
        this.transactions = Objects.requireNonNull(transactions, "transactions");
    }

    public AccountRecord grantToExistingAccount(String identifier) {
        return transactions.execute(() -> grantWithinTransaction(identifier));
    }

    private AccountRecord grantWithinTransaction(String identifier) {
        if (identifier == null || identifier.isBlank()) {
            throw new IllegalStateException("IAM policy bootstrap requires an explicit existing account identifier");
        }
        AccountRecord current = accounts.findByIdentifier(identifier).orElseThrow(() ->
                new IllegalStateException("IAM policy bootstrap account does not exist"));
        Set<String> permissions = new LinkedHashSet<>(current.permissions());
        permissions.addAll(CONTROL_PERMISSIONS);
        AccountRecord updated = current.withPermissions(Set.copyOf(permissions));
        try {
            Instant now = Instant.now(clock);
            audit.append(AuditDecision.of("iam.policy.bootstrap.applied.v1", IamDecisionCode.POLICY_ACTIVATED,
                    true, TenantScope.derive(updated.principalId()), now, Set.of("policy.bootstrap"), Set.of()));
        } catch (RuntimeException exception) {
            throw new IamPolicyException(IamDecisionCode.AUDIT_UNAVAILABLE, "iam.audit.unavailable");
        }
        return accounts.replace(updated);
    }
}
