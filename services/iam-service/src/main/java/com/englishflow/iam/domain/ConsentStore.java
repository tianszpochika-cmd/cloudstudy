package com.englishflow.iam.domain;

import java.util.Optional;
import java.util.List;

/**
 * IAM-owned consent persistence boundary. Implementations must append every decision and keep a
 * current projection separately; withdrawal must never overwrite or delete prior evidence.
 */
public interface ConsentStore {

    ConsentRecord append(ConsentRecord record);

    Optional<ConsentRecord> find(PrincipalId principalId, ConsentType type);

    List<ConsentRecord> history(PrincipalId principalId, ConsentType type);
}
