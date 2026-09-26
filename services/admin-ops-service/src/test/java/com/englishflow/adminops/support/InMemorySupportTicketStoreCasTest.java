package com.englishflow.adminops.support;

import com.englishflow.adminops.adapter.memory.InMemorySupportTicketStore;
import com.englishflow.adminops.domain.AdminOpsException;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class InMemorySupportTicketStoreCasTest {

    @Test
    void staleOperatorCannotOverwriteANewerVersion() {
        InMemorySupportTicketStore store = new InMemorySupportTicketStore();
        SupportTicketRecord first = ticket(1, TicketState.OPEN);
        store.create(first);
        SupportTicketRecord second = ticket(2, TicketState.IN_PROGRESS);
        store.update(second, 1);
        assertThatThrownBy(() -> store.update(ticket(2, TicketState.CLOSED), 1))
                .isInstanceOfSatisfying(AdminOpsException.class,
                        error -> assertThat(error.code()).isEqualTo("SUPPORT_VERSION_CONFLICT"));
        assertThat(store.find("tenant-1", "ticket-1").orElseThrow().state())
                .isEqualTo(TicketState.IN_PROGRESS);
    }

    private static SupportTicketRecord ticket(long version, TicketState state) {
        return new SupportTicketRecord("ticket-1", "tenant-1", "learner-1",
                TicketCategory.TECHNICAL, "general", "a".repeat(64), TicketPriority.NORMAL,
                List.of(), Instant.parse("2026-09-23T00:00:00Z"),
                Instant.parse("2026-09-24T00:00:00Z"), state, null, null, version);
    }
}
