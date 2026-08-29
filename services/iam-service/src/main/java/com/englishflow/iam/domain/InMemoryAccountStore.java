package com.englishflow.iam.domain;

import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/** Local development/test account store. Production must select the IAM-owned JDBC store. */
public final class InMemoryAccountStore implements AccountStore {
    private final Map<String, AccountRecord> byIdentifier = new ConcurrentHashMap<>();
    private final Map<PrincipalId, AccountRecord> byPrincipal = new ConcurrentHashMap<>();

    @Override
    public synchronized AccountRecord save(AccountRecord account) {
        String identifier = account.identifier();
        if (byIdentifier.containsKey(identifier)) {
            throw new IamPolicyException(IamDecisionCode.ACCOUNT_CONFLICT, "iam.account.already_exists");
        }
        byIdentifier.put(identifier, account);
        byPrincipal.put(account.principalId(), account);
        return account;
    }

    @Override
    public Optional<AccountRecord> findByIdentifier(String identifier) {
        return Optional.ofNullable(byIdentifier.get(AccountRecord.normalizeIdentifier(identifier)));
    }

    @Override
    public Optional<AccountRecord> findByPrincipalId(PrincipalId principalId) {
        return Optional.ofNullable(byPrincipal.get(principalId));
    }

    @Override
    public synchronized AccountRecord replace(AccountRecord account) {
        AccountRecord previous = byPrincipal.get(account.principalId());
        if (previous != null && !previous.identifier().equals(account.identifier())) {
            byIdentifier.remove(previous.identifier());
        }
        byIdentifier.put(account.identifier(), account);
        byPrincipal.put(account.principalId(), account);
        return account;
    }
}
