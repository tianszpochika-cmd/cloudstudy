package com.englishflow.iam.domain;

import java.util.Optional;

public interface ConsentStore {

    ConsentRecord save(ConsentRecord record);

    Optional<ConsentRecord> find(PrincipalId principalId, ConsentType type);
}
