package com.englishflow.adminops.support;

import java.util.List;
import java.util.Optional;

/** Owner boundary for admin-ops support tickets. */
public interface SupportTicketStore {

    void create(SupportTicketRecord ticket);

    List<SupportTicketRecord> list(String tenantId, boolean includeAll, String requesterSubjectId);

    Optional<SupportTicketRecord> find(String tenantId, String ticketId);

    /** Compare-and-swap prevents two operators from overwriting the same ticket version. */
    void update(SupportTicketRecord ticket, long expectedVersion);
}
