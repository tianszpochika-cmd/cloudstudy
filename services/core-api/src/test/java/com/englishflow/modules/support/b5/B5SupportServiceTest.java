package com.englishflow.modules.support.b5;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Map;

import org.junit.jupiter.api.Test;

class B5SupportServiceTest {
    @Test
    void supportStoresHashesAndRedactsTicketView() {
        B5SupportService service = new B5SupportService();
        Map<String, Object> created = service.create(42L, Map.of("ticketType", "CONTENT_CORRECTION", "resourceRef", "content-1", "descriptionHash", "hash-only"), "b5-ticket-create-001");
        String ticketId = String.valueOf(created.get("ticketId"));
        assertEquals(true, created.get("redacted"));
        Map<String, Object> message = service.addMessage(42L, ticketId, Map.of("messageHash", "message-hash", "clientMessageRef", "m-001"), "b5-ticket-message-001");
        assertEquals("APPENDED", message.get("status"));
        Map<String, Object> detail = service.getMine(42L, ticketId);
        assertTrue(detail.containsKey("descriptionHash"));
        assertTrue(detail.containsKey("messages"));
        assertEquals(1, ((java.util.List<?>) detail.get("messages")).size());
    }
}
