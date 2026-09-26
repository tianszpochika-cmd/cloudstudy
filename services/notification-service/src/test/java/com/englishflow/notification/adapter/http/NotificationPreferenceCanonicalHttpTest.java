package com.englishflow.notification.adapter.http;

import com.englishflow.notification.adapter.memory.InMemoryDeliveryTransport;
import com.englishflow.notification.adapter.memory.InMemoryNotificationAuditEventStore;
import com.englishflow.notification.adapter.memory.InMemoryNotificationFactStore;
import com.englishflow.notification.adapter.memory.InMemoryNotificationIdGenerator;
import com.englishflow.notification.adapter.memory.InMemoryOutboxEventPort;
import com.englishflow.notification.adapter.memory.InMemoryWorkflowPort;
import com.englishflow.notification.application.NotificationApplicationService;
import com.englishflow.notification.application.RequestMetadata;
import com.englishflow.notification.application.UpdatePreferenceCommand;
import com.englishflow.notification.domain.IdempotencyKey;
import com.englishflow.notification.domain.NotificationAccessPolicy;
import com.englishflow.notification.domain.NotificationCategory;
import com.englishflow.notification.domain.NotificationChannel;
import com.englishflow.notification.domain.NotificationDndWindow;
import com.englishflow.notification.domain.NotificationFrequencyPolicy;
import com.englishflow.notification.domain.NotificationPrincipalContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import tools.jackson.databind.ObjectMapper;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class NotificationPreferenceCanonicalHttpTest {

    private static final Instant NOW = Instant.parse("2026-09-25T12:00:00Z");
    private static final String TRACE_ID = "0123456789abcdef0123456789abcdef";

    private final ObjectMapper objectMapper = new ObjectMapper();
    private InMemoryNotificationFactStore facts;
    private NotificationApplicationService service;
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);
        facts = new InMemoryNotificationFactStore();
        var workflow = new InMemoryWorkflowPort();
        service = new NotificationApplicationService(facts, workflow, new InMemoryDeliveryTransport(),
                new InMemoryOutboxEventPort(), new InMemoryNotificationIdGenerator(),
                new NotificationAccessPolicy(), clock, 3, Duration.ofSeconds(30),
                new InMemoryNotificationAuditEventStore());
        var controller = new NotificationController(service, new NotificationPrincipalResolver(),
                "Asia/Shanghai", clock);
        mvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new NotificationApiExceptionHandler())
                .build();
    }

    @Test
    void preferenceGetReturnsCanonicalCursorEnvelopeAndStablePages() throws Exception {
        savePreference("REVIEW", NotificationCategory.REVIEW, NotificationChannel.PUSH, "page-review");
        savePreference("ACCOUNT", NotificationCategory.ACCOUNT, NotificationChannel.EMAIL, "page-account");
        savePreference("SYSTEM", NotificationCategory.SYSTEM, NotificationChannel.IN_APP, "page-system");

        MvcResult firstResult = mvc.perform(get("/internal/v1/notifications/preferences")
                        .param("pageSize", "2")
                        .header("X-Request-Id", "req-notification-pref-page")
                        .header("X-Trace-Id", TRACE_ID)
                        .principal(authentication()))
                .andExpect(status().isOk())
                .andReturn();
        Map<String, Object> first = readBody(firstResult);
        List<Map<String, Object>> firstItems = objectList(first.get("data"));
        Map<String, Object> firstMeta = object(first.get("meta"));

        assertEquals(Set.of("data", "meta"), first.keySet());
        assertEquals(2, firstItems.size());
        assertEquals("ACCOUNT", firstItems.get(0).get("category"));
        assertEquals("REVIEW", firstItems.get(1).get("category"));
        assertEquals(Set.of("category", "channel", "enabled", "locale", "consentVersion", "dndWindow",
                "frequencyPolicy", "version", "updatedAt"), firstItems.get(0).keySet());
        assertEquals("Asia/Shanghai", object(firstItems.get(0).get("dndWindow")).get("timezone"));
        assertEquals(Set.of("requestId", "traceId", "apiVersion", "schemaVersion", "serverTime",
                "hasMore", "pageSize", "nextCursor"), firstMeta.keySet());
        assertEquals("req-notification-pref-page", firstMeta.get("requestId"));
        assertEquals(TRACE_ID, firstMeta.get("traceId"));
        assertEquals("v1", firstMeta.get("apiVersion"));
        assertEquals("1.0.0", firstMeta.get("schemaVersion"));
        assertEquals(true, firstMeta.get("hasMore"));
        assertEquals(2, firstMeta.get("pageSize"));
        String cursor = (String) firstMeta.get("nextCursor");
        assertTrue(cursor.matches("[A-Za-z0-9_-]{8,512}"));
        assertEquals("req-notification-pref-page", firstResult.getResponse().getHeader("X-Request-Id"));
        assertEquals(TRACE_ID, firstResult.getResponse().getHeader("X-Trace-Id"));
        assertEquals("v1", firstResult.getResponse().getHeader("X-API-Version"));

        MvcResult secondResult = mvc.perform(get("/internal/v1/notifications/preferences")
                        .param("cursor", cursor)
                        .param("pageSize", "2")
                        .principal(authentication()))
                .andExpect(status().isOk())
                .andReturn();
        Map<String, Object> second = readBody(secondResult);
        List<Map<String, Object>> secondItems = objectList(second.get("data"));
        Map<String, Object> secondMeta = object(second.get("meta"));
        assertEquals(1, secondItems.size());
        assertEquals("SYSTEM", secondItems.get(0).get("category"));
        assertEquals(false, secondMeta.get("hasMore"));
        assertNull(secondMeta.get("nextCursor"));
    }

    @Test
    void preferenceGetBoundsPageSizeAndRejectsInvalidCursorOrLowerBoundary() throws Exception {
        savePreference("LEARNING", NotificationCategory.LEARNING, NotificationChannel.PUSH, "boundary-learning");

        MvcResult capped = mvc.perform(get("/internal/v1/notifications/preferences")
                        .param("pageSize", "500")
                        .principal(authentication()))
                .andExpect(status().isOk())
                .andReturn();
        assertEquals(100, object(readBody(capped).get("meta")).get("pageSize"));

        mvc.perform(get("/internal/v1/notifications/preferences")
                        .param("pageSize", "0")
                        .principal(authentication()))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/internal/v1/notifications/preferences")
                        .param("cursor", "malformed/cursor")
                        .principal(authentication()))
                .andExpect(status().isBadRequest());
        String unissuedAnchor = Base64.getUrlEncoder().withoutPadding()
                .encodeToString("MEMBERSHIP\u0000SMS".getBytes(StandardCharsets.UTF_8));
        mvc.perform(get("/internal/v1/notifications/preferences")
                        .param("cursor", unissuedAnchor)
                        .principal(authentication()))
                .andExpect(status().isBadRequest());
    }

    @Test
    void preferencePutReturnsCanonicalSuccessEnvelopeAndIdempotentReplay() throws Exception {
        String body = """
                {"category":"REVIEW","enabled":true,"locale":"zh-CN","consentVersion":7,
                 "dndWindow":{"startLocalTime":"23:00","endLocalTime":"08:00"},
                 "frequencyPolicy":"IMMEDIATE","expectedVersion":0}
                """;

        MvcResult firstResult = mvc.perform(put("/internal/v1/notifications/preferences/REVIEW/PUSH")
                        .header("Idempotency-Key", "canonical-pref-wire-1")
                        .header("X-Request-Id", "req-notification-pref-put")
                        .header("X-Trace-Id", TRACE_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body)
                        .principal(authentication()))
                .andExpect(status().isOk())
                .andReturn();
        Map<String, Object> first = readBody(firstResult);
        Map<String, Object> firstData = object(first.get("data"));
        Map<String, Object> firstMeta = object(first.get("meta"));

        assertEquals(Set.of("data", "meta"), first.keySet());
        assertEquals("REVIEW", firstData.get("category"));
        assertEquals("PUSH", firstData.get("channel"));
        assertEquals(7, firstData.get("consentVersion"));
        Map<String, Object> dndWindow = object(firstData.get("dndWindow"));
        assertEquals("23:00", dndWindow.get("startLocalTime"));
        assertEquals("08:00", dndWindow.get("endLocalTime"));
        assertEquals("Asia/Shanghai", dndWindow.get("timezone"));
        assertEquals(1, firstData.get("version"));
        assertEquals("req-notification-pref-put", firstMeta.get("requestId"));
        assertEquals(TRACE_ID, firstMeta.get("traceId"));
        assertEquals("v1", firstMeta.get("apiVersion"));
        assertEquals("1.0.0", firstMeta.get("schemaVersion"));
        assertEquals("req-notification-pref-put", firstResult.getResponse().getHeader("X-Request-Id"));
        assertEquals(TRACE_ID, firstResult.getResponse().getHeader("X-Trace-Id"));
        assertEquals("v1", firstResult.getResponse().getHeader("X-API-Version"));

        MvcResult replayResult = mvc.perform(put("/internal/v1/notifications/preferences/REVIEW/PUSH")
                        .header("Idempotency-Key", "canonical-pref-wire-1")
                        .header("X-Request-Id", "req-notification-pref-replay")
                        .header("X-Trace-Id", TRACE_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body)
                        .principal(authentication()))
                .andExpect(status().isOk())
                .andReturn();
        Map<String, Object> replay = readBody(replayResult);
        Map<String, Object> replayData = object(replay.get("data"));
        Map<String, Object> replayMeta = object(replay.get("meta"));
        assertEquals(1, replayData.get("version"));
        assertEquals("req-notification-pref-replay", replayMeta.get("requestId"));
        assertEquals(firstData.get("category"), replayData.get("category"));
        assertEquals(firstData.get("consentVersion"), replayData.get("consentVersion"));

        String changedBody = body.replace("\"enabled\":true", "\"enabled\":false");
        mvc.perform(put("/internal/v1/notifications/preferences/REVIEW/PUSH")
                        .header("Idempotency-Key", "canonical-pref-wire-1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(changedBody)
                        .principal(authentication()))
                .andExpect(status().isConflict());
    }

    private void savePreference(String pathType, NotificationCategory category, NotificationChannel channel,
            String idempotencyKey) {
        service.updatePreference(NotificationPrincipalContext.authenticated("platform", "learner", "device"),
                new UpdatePreferenceCommand(pathType, category, channel, true, "zh-CN", 4,
                        NotificationDndWindow.parse("23:00", "08:00"), NotificationFrequencyPolicy.IMMEDIATE, 0),
                new IdempotencyKey(idempotencyKey), new RequestMetadata("req-seed-notification", TRACE_ID));
    }

    private static JwtAuthenticationToken authentication() {
        Jwt jwt = Jwt.withTokenValue("mock-not-a-real-credential")
                .header("alg", "RS256")
                .subject("learner")
                .issuedAt(NOW.minusSeconds(60))
                .expiresAt(NOW.plusSeconds(60))
                .claim("tenant_id", "platform")
                .claim("device_id", "device")
                .claim("permissions", List.of("notification.preference.read.self",
                        "notification.preference.write.self"))
                .build();
        return new JwtAuthenticationToken(jwt, List.of());
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> readBody(MvcResult result) throws Exception {
        return objectMapper.readValue(result.getResponse().getContentAsString(), Map.class);
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> object(Object value) {
        return (Map<String, Object>) value;
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> objectList(Object value) {
        return (List<Map<String, Object>>) value;
    }
}
