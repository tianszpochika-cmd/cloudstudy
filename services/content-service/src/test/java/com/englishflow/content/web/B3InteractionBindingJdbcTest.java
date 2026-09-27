package com.englishflow.content.web;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.server.ResponseStatusException;

import tools.jackson.databind.ObjectMapper;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * B3 rows serve stems only through an ACTIVE owner binding; rows without
 * provenance stay honestly empty and answer material never leaves the boundary.
 */
public class B3InteractionBindingJdbcTest {

    private JdbcTemplate jdbc;
    private B3ContentJdbcController controller;
    private JwtAuthenticationToken learner;

    @BeforeEach
    void setUp() {
        DriverManagerDataSource dataSource = new DriverManagerDataSource(
                "jdbc:h2:mem:b3binding_" + UUID.randomUUID().toString().replace("-", "")
                        + ";MODE=MySQL;DB_CLOSE_DELAY=-1", "sa", "");
        jdbc = new JdbcTemplate(dataSource);
        jdbc.execute("CREATE ALIAS JSON_CONTAINS FOR \"com.englishflow.content.web.B3InteractionBindingJdbcTest.jsonContains\"");
        jdbc.execute("CREATE ALIAS JSON_EXTRACT FOR \"com.englishflow.content.web.B3InteractionBindingJdbcTest.jsonExtract\"");
        jdbc.execute("CREATE ALIAS JSON_UNQUOTE FOR \"com.englishflow.content.web.B3InteractionBindingJdbcTest.jsonUnquote\"");
        jdbc.execute("""
                CREATE TABLE b3_content_experience (
                    experience_id VARCHAR(96) PRIMARY KEY, tenant_id VARCHAR(64),
                    domain_code VARCHAR(32), resource_type VARCHAR(64), resource_key VARCHAR(96),
                    content_version_id BIGINT, availability VARCHAR(16), payload_json VARCHAR(4000))
                """);
        jdbc.execute("""
                CREATE TABLE content_version (
                    content_version_id BIGINT PRIMARY KEY, content_id VARCHAR(128),
                    status VARCHAR(32), published_at TIMESTAMP, copyright_status VARCHAR(32),
                    rights_allows_learning BOOLEAN, rights_source_code VARCHAR(128),
                    rights_license_code VARCHAR(128), authorization_evidence_ref VARCHAR(128),
                    editor VARCHAR(128), first_reviewer VARCHAR(128), final_reviewer VARCHAR(128),
                    publisher VARCHAR(128), rights_starts_at TIMESTAMP, rights_expires_at TIMESTAMP,
                    rights_permitted_channels VARCHAR(256))
                """);
        jdbc.execute("""
                CREATE TABLE content_definition (
                    content_id VARCHAR(128) PRIMARY KEY, tenant_id VARCHAR(64),
                    current_published_version_id BIGINT)
                """);
        jdbc.execute("""
                CREATE TABLE content_b3_item_binding (
                    binding_id BIGINT AUTO_INCREMENT PRIMARY KEY, tenant_id VARCHAR(64),
                    b3_domain VARCHAR(32), b3_resource_type VARCHAR(64), b3_resource_key VARCHAR(96),
                    b3_experience_id VARCHAR(96), content_code VARCHAR(128),
                    content_version_id BIGINT, question_item_id VARCHAR(128),
                    status VARCHAR(16) DEFAULT 'ACTIVE', created_at TIMESTAMP)
                """);
        jdbc.update("INSERT INTO content_definition VALUES ('p1-placement-bank-v1', 'platform', 266100)");
        jdbc.update("""
                INSERT INTO content_version VALUES (266100, 'p1-placement-bank-v1', 'PUBLISHED',
                 CURRENT_TIMESTAMP, 'ACTIVE', TRUE, 'LOCAL_FIXTURE', 'LOCAL_FIXTURE', 'bank-auth',
                 'bank-editor', 'bank-reviewer-1', 'bank-reviewer-2', 'bank-publisher',
                 NULL, NULL, '["SEALED"]')
                """);
        controller = new B3ContentJdbcController(jdbc, new ObjectMapper());
        Jwt jwt = Jwt.withTokenValue("test-token").header("alg", "RS256")
                .subject("test-learner").issuedAt(Instant.parse("2026-09-23T00:00:00Z"))
                .expiresAt(Instant.parse("2026-09-23T00:05:00Z"))
                .claim("tenant_id", "platform").claim("roles", List.of("learner"))
                .claim("permissions", List.of("content.read"))
                .claim("adult_gate", "PASSED").claim("consent_state", "GRANTED").build();
        learner = new JwtAuthenticationToken(jwt, Set.of(), jwt.getSubject());
    }

    @Test
    @SuppressWarnings("unchecked")
    void boundRowServesStemWithoutAnswersAndWithPracticeRef() {
        jdbc.update("INSERT INTO b3_content_experience VALUES ('p1-b3-grammar-01', 'platform',"
                + " 'GRAMMAR', 'GRAMMAR_EXERCISE', 'p1-b3-grammar-01', 266100, 'PUBLISHED',"
                + " '{\"exerciseId\":1,\"promptText\":\"She ___ to school.\","
                + "\"options\":[{\"optionCode\":\"a\",\"label\":\"go\"},{\"optionCode\":\"b\",\"label\":\"goes\"}],"
                + "\"correctOption\":\"b\",\"answerRules\":{\"correctOption\":\"b\"},\"contentVersionId\":266100}')");
        jdbc.update("INSERT INTO content_b3_item_binding (tenant_id, b3_domain, b3_resource_type,"
                + " b3_resource_key, b3_experience_id, content_code, content_version_id,"
                + " question_item_id, status) VALUES ('platform', 'GRAMMAR', 'GRAMMAR_EXERCISE',"
                + " 'p1-b3-grammar-01', 'p1-b3-grammar-01', 'p1.placement.v1', 266100, '266004', 'ACTIVE')");
        Map<String, Object> data = (Map<String, Object>) controller
                .grammarExercises(learner, null, 20).get("data");
        List<Map<String, Object>> items = (List<Map<String, Object>>) data.get("items");
        assertEquals(1, items.size());
        String flat = items.getFirst().toString().toLowerCase();
        assertTrue(!flat.contains("correctoption") && !flat.contains("answerrule"),
                "answer material must not leave the B3 boundary: " + flat);
        assertTrue(flat.contains("she ___ to school."));
        Map<String, Object> practiceRef = (Map<String, Object>) items.getFirst().get("practiceRef");
        assertEquals("p1.placement.v1", practiceRef.get("contentCode"));
        assertEquals(266100L, ((Number) practiceRef.get("contentVersionId")).longValue());
        assertEquals("266004", practiceRef.get("questionItemId"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void rowWithoutBindingStaysHonestlyEmpty() {
        jdbc.update("INSERT INTO b3_content_experience VALUES ('legacy-3701', 'platform',"
                + " 'GRAMMAR', 'GRAMMAR_EXERCISE', '3701', 266100, 'PUBLISHED',"
                + " '{\"exerciseId\":3701,\"promptText\":\"Legacy?\",\"contentVersionId\":266100}')");
        Map<String, Object> data = (Map<String, Object>) controller
                .grammarExercises(learner, null, 20).get("data");
        assertTrue(((List<?>) data.get("items")).isEmpty());
        ResponseStatusException missing = assertThrows(ResponseStatusException.class,
                () -> controller.sentence("nope", learner));
        assertEquals(HttpStatus.NOT_FOUND, missing.getStatusCode());
    }

    @Test
    @SuppressWarnings("unchecked")
    void revokedOrMismatchedBindingStaysEmpty() {
        jdbc.update("INSERT INTO b3_content_experience VALUES ('p1-b3-grammar-09', 'platform',"
                + " 'GRAMMAR', 'GRAMMAR_EXERCISE', 'p1-b3-grammar-09', 266100, 'PUBLISHED',"
                + " '{\"exerciseId\":9,\"promptText\":\"Revoked?\",\"contentVersionId\":266100}')");
        jdbc.update("INSERT INTO content_b3_item_binding (tenant_id, b3_domain, b3_resource_type,"
                + " b3_resource_key, b3_experience_id, content_code, content_version_id,"
                + " question_item_id, status) VALUES ('platform', 'GRAMMAR', 'GRAMMAR_EXERCISE',"
                + " 'p1-b3-grammar-09', 'p1-b3-grammar-09', 'p1.placement.v1', 266100, '266004', 'REVOKED')");
        jdbc.update("INSERT INTO b3_content_experience VALUES ('p1-b3-grammar-10', 'platform',"
                + " 'GRAMMAR', 'GRAMMAR_EXERCISE', 'p1-b3-grammar-10', 266100, 'PUBLISHED',"
                + " '{\"exerciseId\":10,\"promptText\":\"Mismatch?\",\"contentVersionId\":266100}')");
        jdbc.update("INSERT INTO content_b3_item_binding (tenant_id, b3_domain, b3_resource_type,"
                + " b3_resource_key, b3_experience_id, content_code, content_version_id,"
                + " question_item_id, status) VALUES ('platform', 'GRAMMAR', 'GRAMMAR_EXERCISE',"
                + " 'p1-b3-grammar-10', 'p1-b3-grammar-10', 'p1.placement.v1', 999999, '266004', 'ACTIVE')");
        Map<String, Object> data = (Map<String, Object>) controller
                .grammarExercises(learner, null, 20).get("data");
        assertTrue(((List<?>) data.get("items")).isEmpty());
    }

    public static boolean jsonContains(String json, String candidate) {
        if (json == null || candidate == null) return false;
        try {
            Object parsed = new ObjectMapper().readValue(json, Object.class);
            Object value = new ObjectMapper().readValue(candidate, Object.class);
            return parsed instanceof List<?> values && values.contains(value);
        } catch (Exception ignored) {
            return false;
        }
    }

    public static String jsonExtract(String json, String path) {
        return null;
    }

    public static String jsonUnquote(String json) {
        if (json == null) return null;
        try {
            Object value = new ObjectMapper().readValue(json, Object.class);
            return value instanceof String text ? text : json;
        } catch (Exception ignored) {
            return json;
        }
    }
}
