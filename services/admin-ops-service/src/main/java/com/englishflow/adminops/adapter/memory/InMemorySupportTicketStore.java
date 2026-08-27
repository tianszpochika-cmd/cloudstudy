package com.englishflow.adminops.adapter.memory;

import com.englishflow.adminops.support.SupportTicketRecord;
import com.englishflow.adminops.support.SupportTicketStore;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/** Test/development store used only outside the local-real profile. */
public final class InMemorySupportTicketStore implements SupportTicketStore {

    private final Map<String, SupportTicketRecord> tickets = new LinkedHashMap<>();

    @Override
    public synchronized void create(SupportTicketRecord ticket) {
        tickets.put(ticket.ticketId(), ticket);
    }

    @Override
    public synchronized List<SupportTicketRecord> list(
            String tenantId, boolean includeAll, String requesterSubjectId) {
        return tickets.values().stream()
                .filter(ticket -> tenantId.equals(ticket.tenantId()))
                .filter(ticket -> includeAll || requesterSubjectId.equals(ticket.requesterSubjectId()))
                .toList();
    }

    @Override
    public synchronized Optional<SupportTicketRecord> find(String tenantId, String ticketId) {
        return Optional.ofNullable(tickets.get(ticketId))
                .filter(ticket -> tenantId.equals(ticket.tenantId()));
    }

    @Override
    public synchronized void update(SupportTicketRecord ticket) {
        tickets.put(ticket.ticketId(), ticket);
    }
}
