package com.englishflow.iam.domain;

public enum AccountStatus {
    ACTIVE,
    LOCKED,
    DISABLED,
    /** Terminal state written by account-deletion execute; logins deny as invalid credentials. */
    DELETED
}
