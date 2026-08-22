package com.englishflow.iam.domain;

public interface ConsentPolicyPort {

    ConsentVersion currentVersion(ConsentType type);
}
