package com.englishflow.adminops.domain;

/** Fine-grained permissions; roles are only a transport-level grouping in IAM. */
public final class AdminPermission {

    public static final String PROJECTION_READ = "admin.projection.read";
    public static final String CONTENT_EDIT = "content.edit";
    public static final String CONTENT_REVIEW_L1 = "content.review.l1";
    public static final String CONTENT_REVIEW_L2 = "content.review.l2";
    public static final String CONTENT_PUBLISH = "content.publish";
    public static final String COMMERCE_REFUND = "commerce.refund";
    public static final String LEARNER_RISK_WRITE = "learner.risk.write";
    public static final String AUDIT_READ = "admin.audit.read";
    public static final String AUDIT_EXPORT = "audit.export";
    public static final String SUPPORT_TICKET_CREATE = "support.ticket.create";
    public static final String SUPPORT_TICKET_READ = "support.ticket.read";
    public static final String SUPPORT_TICKET_MANAGE = "support.ticket.manage";

    private AdminPermission() {
    }
}
