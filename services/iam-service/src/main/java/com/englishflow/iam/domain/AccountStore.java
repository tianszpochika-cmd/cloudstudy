package com.englishflow.iam.domain;

import java.util.Optional;

/** IAM-owned account persistence boundary. */
public interface AccountStore {
    AccountRecord save(AccountRecord account);
    Optional<AccountRecord> findByIdentifier(String identifier);
    Optional<AccountRecord> findByPrincipalId(PrincipalId principalId);
    AccountRecord replace(AccountRecord account);
}
