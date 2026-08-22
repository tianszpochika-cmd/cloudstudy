package com.englishflow.adminops.support;

public record SupportTicketResult(
        SupportTicketView ticket,
        boolean replayed,
        String auditId) {
}
