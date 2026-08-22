package com.englishflow.iam.domain;

/**
 * A structured fail-closed IAM rejection. Messages are stable localization keys, never raw
 * tokens, claims, tenant values or provider responses.
 */
public final class IamPolicyException extends RuntimeException {

    private final IamDecisionCode code;
    private final String messageKey;

    public IamPolicyException(IamDecisionCode code, String messageKey) {
        super(messageKey);
        this.code = code;
        this.messageKey = messageKey;
    }

    public IamDecisionCode code() {
        return code;
    }

    public String messageKey() {
        return messageKey;
    }
}
