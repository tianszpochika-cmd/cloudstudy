package com.englishflow.modules.support.b5;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

import com.englishflow.modules.b5.B5Exception;
import org.springframework.stereotype.Service;

/** Customer correction/support tickets with hash-only message storage. */
@Service
public final class B5SupportService {
    private final ConcurrentMap<String, Ticket> tickets = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, Map<String, Object>> idempotentResults = new ConcurrentHashMap<>();

    public synchronized Map<String, Object> create(long userId, Map<String, Object> body, String key) {
        requireKey(key);
        String replayKey = "ticket:" + userId + ":" + key;
        if (idempotentResults.containsKey(replayKey)) return idempotentResults.get(replayKey);
        Ticket ticket = new Ticket("tkt_" + UUID.randomUUID(), userId, required(body, "ticketType"), required(body, "resourceRef"), required(body, "descriptionHash"));
        tickets.put(ticket.id, ticket);
        Map<String, Object> result = reply(ticket.view());
        idempotentResults.put(replayKey, result);
        return result;
    }

    public Map<String, Object> listMine(long userId) {
        return reply(Map.of("items", tickets.values().stream().filter(ticket -> ticket.requesterId == userId).map(Ticket::view).toList()));
    }

    public Map<String, Object> getMine(long userId, String ticketId) {
        Ticket ticket = require(ticketId);
        if (ticket.requesterId != userId) throw notFound("SUPPORT_TICKET_NOT_FOUND", "ticket does not belong to current user");
        return reply(ticket.detail());
    }

    public synchronized Map<String, Object> addMessage(long userId, String ticketId, Map<String, Object> body, String key) {
        requireKey(key);
        Ticket ticket = require(ticketId);
        if (ticket.requesterId != userId) throw notFound("SUPPORT_TICKET_NOT_FOUND", "ticket does not belong to current user");
        String clientRef = required(body, "clientMessageRef");
        if (ticket.messageRefs.contains(clientRef)) return reply(Map.of("ticketId", ticketId, "clientMessageRef", clientRef, "status", "REPLAYED"));
        ticket.messageRefs.add(clientRef);
        ticket.messages.add(Map.of("messageId", "msg_" + UUID.randomUUID(), "clientMessageRef", clientRef, "messageHash", required(body, "messageHash"), "createdAt", Instant.now().toString(), "redacted", true));
        return reply(Map.of("ticketId", ticketId, "clientMessageRef", clientRef, "status", "APPENDED", "messageCount", ticket.messages.size()));
    }

    public Map<String, Object> listAll() { return reply(Map.of("items", tickets.values().stream().map(Ticket::view).toList())); }

    public synchronized Map<String, Object> resolve(String ticketId, Map<String, Object> body, long actorId) {
        Ticket ticket = require(ticketId);
        String decision = required(body, "decisionCode");
        ticket.status = "RESOLVED";
        ticket.resolutionCode = decision;
        ticket.assigneeId = actorId;
        ticket.resolvedAt = Instant.now();
        return reply(ticket.detail());
    }

    private Ticket require(String ticketId) { Ticket ticket = tickets.get(ticketId); if (ticket == null) throw notFound("SUPPORT_TICKET_NOT_FOUND", "ticket does not exist"); return ticket; }
    private static String required(Map<String, Object> body, String key) { String value = body == null || body.get(key) == null ? null : String.valueOf(body.get(key)).trim(); if (value == null || value.isBlank()) throw new B5Exception("SUPPORT_SCHEMA_INVALID", key + " is required", 400, false); return value; }
    private static void requireKey(String key) { if (key == null || key.trim().length() < 8) throw new B5Exception("IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key is required", 400, false); }
    private static Map<String, Object> reply(Map<String, Object> data) { Map<String, Object> result = new LinkedHashMap<>(); result.put("requestId", "req_b5_support"); result.put("data", data); result.putAll(data); return result; }
    private static B5Exception notFound(String code, String message) { return new B5Exception(code, message, 404, false); }

    private static final class Ticket {
        final String id, type, resourceRef, descriptionHash;
        final long requesterId;
        final Instant createdAt = Instant.now();
        final Instant slaDueAt = createdAt.plus(Duration.ofHours(48));
        final List<String> messageRefs = new ArrayList<>();
        final List<Map<String, Object>> messages = new ArrayList<>();
        String status = "OPEN", resolutionCode = "";
        long assigneeId;
        Instant resolvedAt;
        Ticket(String id, long requesterId, String type, String resourceRef, String descriptionHash) { this.id = id; this.requesterId = requesterId; this.type = type; this.resourceRef = resourceRef; this.descriptionHash = descriptionHash; }
        Map<String, Object> view() { return Map.of("ticketId", id, "requesterId", requesterId, "ticketType", type, "resourceRef", resourceRef, "status", status, "slaDueAt", slaDueAt.toString(), "resolutionCode", resolutionCode, "redacted", true); }
        Map<String, Object> detail() { Map<String, Object> value = new LinkedHashMap<>(view()); value.put("descriptionHash", descriptionHash); value.put("assigneeId", assigneeId); value.put("resolvedAt", resolvedAt == null ? "" : resolvedAt.toString()); value.put("messages", List.copyOf(messages)); return value; }
    }
}
