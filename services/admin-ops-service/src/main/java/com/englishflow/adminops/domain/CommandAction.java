package com.englishflow.adminops.domain;

public enum CommandAction {
    CONTENT_SUBMIT_REVIEW(Domain.CONTENT, AdminPermission.CONTENT_EDIT, false),
    CONTENT_REVIEW_FIRST(Domain.CONTENT, AdminPermission.CONTENT_REVIEW_L1, true),
    CONTENT_REVIEW_FINAL(Domain.CONTENT, AdminPermission.CONTENT_REVIEW_L2, true),
    CONTENT_PUBLISH(Domain.CONTENT, AdminPermission.CONTENT_PUBLISH, true),
    COMMERCE_REFUND(Domain.COMMERCE, AdminPermission.COMMERCE_REFUND, true),
    LEARNER_SUSPEND(Domain.LEARNER, AdminPermission.LEARNER_RISK_WRITE, true),
    AUDIT_EXPORT(Domain.SUPPORT, AdminPermission.AUDIT_EXPORT, true),
    SUPPORT_NOTIFY(Domain.NOTIFICATION, AdminPermission.SUPPORT_TICKET_MANAGE, false),
    SUPPORT_RESOLVE(Domain.SUPPORT, AdminPermission.SUPPORT_TICKET_MANAGE, true),
    SUPPORT_CLOSE(Domain.SUPPORT, AdminPermission.SUPPORT_TICKET_MANAGE, true);

    private final Domain domain;
    private final String permission;
    private final boolean requiresConfirmation;

    CommandAction(Domain domain, String permission, boolean requiresConfirmation) {
        this.domain = domain;
        this.permission = permission;
        this.requiresConfirmation = requiresConfirmation;
    }

    public Domain domain() {
        return domain;
    }

    public String permission() {
        return permission;
    }

    public boolean requiresConfirmation() {
        return requiresConfirmation;
    }
}
