package com.englishflow.assessment.adapter.content;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.ObjectMapper;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Bank practice rows come from the sealed delivery and never copy the answer. */
class BankPracticeRuleProviderTest {

    private final ObjectMapper mapper = new ObjectMapper();
    private HttpServer server;
    private String baseUrl;
    private volatile int status = 200;
    private volatile String body;

    @BeforeEach
    void setUp() throws Exception {
        body = mapper.writeValueAsString(Map.of("data", bank()));
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/internal/v1/content/placement-bank/sealed", exchange -> {
            byte[] payload = (status == 200 ? body : "{\"error\":\"down\"}")
                    .getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(status, payload.length);
            exchange.getResponseBody().write(payload);
            exchange.close();
        });
        server.start();
        baseUrl = "http://127.0.0.1:" + server.getAddress().getPort();
    }

    @AfterEach
    void tearDown() {
        if (server != null) server.stop(0);
    }

    @Test
    void sealedBankBecomesScoreGradedRowsWithoutTheCorrectOption() {
        BankPracticeRuleProvider provider = new BankPracticeRuleProvider(mapper, baseUrl);
        BankPracticeRuleProvider.BankRules rules = provider.fetch("p1.placement.v1", 266100, "Bearer t");
        assertNotNull(rules);
        assertEquals(10, rules.rows().size());
        assertEquals(266100L, rules.contentVersionId());
        assertTrue(rules.snapshotHash().matches("[a-f0-9]{64}"));
        Map<String, Object> grammar = rules.rows().stream()
                .filter(row -> "266004".equals(row.get("item_id"))).findFirst().orElseThrow();
        assertEquals("GRAMMAR", grammar.get("dimension"));
        assertEquals("PLACEMENT_SCORE", sneakyRead(grammar.get("answer_rule_json")).get("grader"));
        String stored = String.valueOf(grammar.get("answer_rule_json"));
        assertTrue(!stored.contains("correctOption") && !stored.contains("\"answer\""));
    }

    @Test
    void sealedDeliveryWithoutAnswerRuleStillOpensPracticeRows() throws Exception {
        Map<String, Object> delivered = new LinkedHashMap<>(bank());
        @SuppressWarnings("unchecked")
        List<Object> items = new ArrayList<>((List<Object>) delivered.get("items"));
        List<Object> stripped = new ArrayList<>();
        for (Object raw : items) {
            @SuppressWarnings("unchecked")
            Map<String, Object> item = new LinkedHashMap<>((Map<String, Object>) raw);
            item.remove("answerRule");
            stripped.add(item);
        }
        delivered.put("items", stripped);
        body = mapper.writeValueAsString(Map.of("data", delivered));
        BankPracticeRuleProvider provider = new BankPracticeRuleProvider(mapper, baseUrl);
        BankPracticeRuleProvider.BankRules rules = provider.fetch("p1.placement.v1", 266100, "Bearer t");
        assertNotNull(rules);
        assertEquals(10, rules.rows().size());
        assertEquals("PLACEMENT_SCORE", sneakyRead(rules.rows().getFirst().get("answer_rule_json")).get("grader"));
    }

    @Test
    void versionMismatchStaysNull() {
        BankPracticeRuleProvider provider = new BankPracticeRuleProvider(mapper, baseUrl);
        assertNull(provider.fetch("p1.placement.v1", 25001, "Bearer t"));
    }

    @Test
    void nonBankCodeNeverFetches() {
        BankPracticeRuleProvider provider = new BankPracticeRuleProvider(mapper, "http://127.0.0.1:9");
        assertNull(provider.fetch("course-b25-basics", 25001, "Bearer t"));
        assertNull(provider.fetch("p1.placement.v1", 266100, " "));
    }

    @Test
    void bankOutageStaysNull() {
        status = 500;
        BankPracticeRuleProvider provider = new BankPracticeRuleProvider(mapper, baseUrl);
        assertNull(provider.fetch("p1.placement.v1", 266100, "Bearer t"));
    }

    @Test
    void driftedBankShapeStaysNull() throws Exception {
        Map<String, Object> drifted = new LinkedHashMap<>(bank());
        @SuppressWarnings("unchecked")
        List<Object> items = new ArrayList<>((List<Object>) drifted.get("items"));
        @SuppressWarnings("unchecked")
        Map<String, Object> first = new LinkedHashMap<>((Map<String, Object>) items.getFirst());
        first.remove("stem");
        items.set(0, first);
        drifted.put("items", items);
        body = mapper.writeValueAsString(Map.of("data", drifted));
        BankPracticeRuleProvider provider = new BankPracticeRuleProvider(mapper, baseUrl);
        assertNull(provider.fetch("p1.placement.v1", 266100, "Bearer t"));
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> sneakyRead(Object raw) {
        try {
            return (Map<String, Object>) new ObjectMapper().readValue(String.valueOf(raw), Object.class);
        } catch (Exception invalid) {
            throw new IllegalStateException(invalid);
        }
    }

    private static Map<String, Object> bank() {
        String[] dimensions = {"VOCABULARY", "VOCABULARY", "VOCABULARY",
                "BASIC_GRAMMAR", "BASIC_GRAMMAR", "BASIC_GRAMMAR",
                "READING", "READING", "LISTENING", "LISTENING"};
        String[] types = {"VOCABULARY", "VOCABULARY", "VOCABULARY",
                "GRAMMAR", "GRAMMAR", "GRAMMAR",
                "READING", "READING", "LISTENING", "LISTENING"};
        List<Map<String, Object>> items = new ArrayList<>();
        for (int index = 0; index < 10; index++) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("itemId", 266001 + index);
            item.put("itemCode", "p1.place.test." + index);
            item.put("itemType", types[index]);
            item.put("dimension", dimensions[index]);
            item.put("displayOrder", index + 1);
            item.put("stem", "Stem " + index + "?");
            item.put("options", List.of(Map.of("optionId", "a", "label", "alpha"),
                    Map.of("optionId", "b", "label", "beta")));
            item.put("questionType", "CHOICE");
            item.put("scoringVersion", "p1-choice-v1");
            item.put("maxScore", 10);
            item.put("contentCode", "p1.placement.v1");
            item.put("contentVersionId", 266100);
            item.put("answerRule", Map.of("correctOption", index == 3 ? "b" : "a"));
            items.add(item);
        }
        Map<String, Object> bank = new LinkedHashMap<>();
        bank.put("bankCode", "P1_PLACEMENT_V1");
        bank.put("contentVersionId", 266100);
        bank.put("contentEpoch", 1);
        bank.put("snapshotId", "snap_p1.placement.v1-266100");
        bank.put("snapshotHash", "a".repeat(64));
        bank.put("answerRuleSetVersion", "p1-placement-bank-v1");
        bank.put("answerRuleVersion", "p1-choice-v1");
        bank.put("ruleDigest", "b".repeat(64));
        bank.put("items", items);
        return bank;
    }
}
