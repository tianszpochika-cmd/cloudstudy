package com.englishflow.adminops.support;

public enum SupportAction {
    ASSIGN,
    ACKNOWLEDGE,
    START,
    WAIT_CUSTOMER,
    RESOLVE,
    CLOSE,
    REOPEN;

    public boolean requiresConfirmation() {
        return this == RESOLVE || this == CLOSE;
    }
}
