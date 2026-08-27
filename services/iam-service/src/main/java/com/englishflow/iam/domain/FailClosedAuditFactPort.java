package com.englishflow.iam.domain;

/** No security fact may be accepted when the durable IAM audit sink is unavailable. */
public final class FailClosedAuditFactPort implements AuditFactPort {

    @Override
    public void append(AuditDecision decision) {
        throw new IamPolicyException(
                IamDecisionCode.AUDIT_UNAVAILABLE,
                "iam.audit.unavailable");
    }
}
