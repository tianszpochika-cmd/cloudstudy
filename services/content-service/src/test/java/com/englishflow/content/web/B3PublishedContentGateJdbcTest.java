package com.englishflow.content.web;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.server.ResponseStatusException;

import tools.jackson.databind.ObjectMapper;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;

/** Exercises the B3 read SQL against independent content-owner tables, never a local user DB. */
public class B3PublishedContentGateJdbcTest {

    private JdbcTemplate jdbc;
    private B3ContentJdbcController controller;
    private JwtAuthenticationToken learner;

    @BeforeEach
    void setUp() {
        DriverManagerDataSource dataSource = new DriverManagerDataSource(
                "jdbc:h2:mem:b3gate_" + UUID.randomUUID().toString().replace("-", "")
                        + ";MODE=MySQL;DB_CLOSE_DELAY=-1", "sa", "");
        jdbc = new JdbcTemplate(dataSource);
        jdbc.execute("CREATE ALIAS JSON_CONTAINS FOR \"com.englishflow.content.web.B3PublishedContentGateJdbcTest.jsonContains\"");
        jdbc.execute("CREATE ALIAS JSON_EXTRACT FOR \"com.englishflow.content.web.B3PublishedContentGateJdbcTest.jsonExtract\"");
        jdbc.execute("CREATE ALIAS JSON_UNQUOTE FOR \"com.englishflow.content.web.B3PublishedContentGateJdbcTest.jsonUnquote\"");
        jdbc.execute("""
                CREATE TABLE b3_content_experience (
                    experience_id VARCHAR(96) PRIMARY KEY, tenant_id VARCHAR(64),
                    domain_code VARCHAR(32), resource_type VARCHAR(64), resource_key VARCHAR(96),
                    content_version_id BIGINT, availability VARCHAR(16), payload_json VARCHAR(1000))
                """);
        jdbc.execute("""
                CREATE TABLE content_definition (
                    content_id VARCHAR(128) PRIMARY KEY, tenant_id VARCHAR(128),
                    current_published_version_id BIGINT)
                """);
        jdbc.execute("""
                CREATE TABLE content_version (
                    content_version_id BIGINT PRIMARY KEY, content_id VARCHAR(128), status VARCHAR(32),
                    published_at TIMESTAMP, copyright_status VARCHAR(32), rights_allows_learning BOOLEAN,
                    rights_source_code VARCHAR(128), rights_license_code VARCHAR(128),
                    authorization_evidence_ref VARCHAR(128), rights_permitted_channels VARCHAR(128),
                    rights_starts_at TIMESTAMP, rights_expires_at TIMESTAMP,
                    editor VARCHAR(128), first_reviewer VARCHAR(128), final_reviewer VARCHAR(128),
                    publisher VARCHAR(128))
                """);
        jdbc.execute("""
                CREATE TABLE content_b3_item_binding (
                    binding_id BIGINT AUTO_INCREMENT PRIMARY KEY, tenant_id VARCHAR(64),
                    b3_domain VARCHAR(32), b3_resource_type VARCHAR(64), b3_resource_key VARCHAR(96),
                    b3_experience_id VARCHAR(96), content_code VARCHAR(128),
                    content_version_id BIGINT, question_item_id VARCHAR(128),
                    status VARCHAR(16) DEFAULT 'ACTIVE', created_at TIMESTAMP)
                """);
        jdbc.update("""
                INSERT INTO b3_content_experience VALUES
                ('legacy-grammar', 'platform', 'GRAMMAR', 'GRAMMAR_POINT', '3101', 301,
                 'PUBLISHED', '{"grammarPointId":3101,"contentVersionId":301}')
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
    void legacyPublishedFlagCannotExposeContentWithoutOrEvenWithUnrelatedVersion301() {
        assertEmptyAndNotFound();

        jdbc.update("INSERT INTO content_definition VALUES ('another-pack', 'platform', 301)");
        publishVersion(301, "another-pack");
        assertEmptyAndNotFound();
    }

    @Test
    void unrelatedReviewedVersion302CannotReleaseAnUnboundLegacyProjection() {
        jdbc.update("UPDATE b3_content_experience SET content_version_id = 302, "
                + "payload_json = '{\"grammarPointId\":3101,\"contentVersionId\":302}'");
        jdbc.update("INSERT INTO content_definition VALUES ('b3-pack', 'platform', 302)");
        publishVersion(302, "b3-pack");
        assertEmptyAndNotFound();

        jdbc.update("""
                INSERT INTO b3_content_experience VALUES
                ('listening', 'platform', 'LISTENING', 'LISTENING_MATERIAL', '3401', 302,
                 'PUBLISHED', '{"materialId":3401,"contentVersionId":302}'),
                ('reading', 'platform', 'READING', 'READING_ARTICLE', '3501', 302,
                 'PUBLISHED', '{"articleId":3501,"contentVersionId":302}'),
                ('writing', 'platform', 'WRITING', 'WRITING_PROMPT', '3301', 302,
                 'PUBLISHED', '{"promptId":3301,"contentVersionId":302}'),
                ('phoneme', 'platform', 'PHONETICS', 'PHONEME', '3601', 302,
                 'PUBLISHED', '{"phonemeId":3601,"contentVersionId":302}')
                """);
        assertEquals(List.of(), data(controller.listeningMaterials(learner, 20)).get("items"));
        assertEquals(List.of(), data(controller.readingArticles(learner, 20)).get("items"));
        assertEquals(List.of(), data(controller.writingPrompts(learner, 20)).get("items"));
        assertEquals(List.of(), data(controller.phonetics(learner, null, "en")).get("items"));
        ResponseStatusException listening = assertThrows(ResponseStatusException.class,
                () -> controller.listeningMaterial("3401", learner));
        assertEquals(HttpStatus.NOT_FOUND, listening.getStatusCode());
        ResponseStatusException reading = assertThrows(ResponseStatusException.class,
                () -> controller.readingArticle("3501", learner));
        assertEquals(HttpStatus.NOT_FOUND, reading.getStatusCode());
    }

    @Test
    void grammarPointsUsesCanonicalCursorEnvelopeAndKeepsLegacyRowsClosed() {
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-Request-Id", "grammar-points-request-1");
        headers.set("X-Trace-Id", "0123456789abcdef0123456789abcdef");

        Map<String, Object> response = controller.grammarPoints(learner, null, 7, "B1", headers);
        Map<String, Object> data = data(response);
        @SuppressWarnings("unchecked")
        Map<String, Object> meta = (Map<String, Object>) response.get("meta");

        assertEquals(List.of(), data.get("items"), "the legacy projection gate must remain closed");
        assertEquals("mysql", data.get("source"));
        assertEquals(Set.of("data", "meta"), response.keySet(), "cursor state belongs only in meta");
        assertEquals("grammar-points-request-1", meta.get("requestId"));
        assertEquals("0123456789abcdef0123456789abcdef", meta.get("traceId"));
        assertEquals("v1", meta.get("apiVersion"));
        assertEquals("1.0.0", meta.get("schemaVersion"));
        assertEquals(false, meta.get("hasMore"));
        assertEquals(7, meta.get("pageSize"));
        assertEquals(null, meta.get("nextCursor"));
        assertEquals(true, meta.containsKey("serverTime"));
    }

    @Test
    void grammarPointsRejectsMalformedPaginationAndRequiresLearnerReadFacts() {
        HttpHeaders headers = new HttpHeaders();
        ResponseStatusException cursor = assertThrows(ResponseStatusException.class,
                () -> controller.grammarPoints(learner, "not/a/cursor", 20, null, headers));
        assertEquals(HttpStatus.BAD_REQUEST, cursor.getStatusCode());

        ResponseStatusException pageSize = assertThrows(ResponseStatusException.class,
                () -> controller.grammarPoints(learner, null, 101, null, headers));
        assertEquals(HttpStatus.BAD_REQUEST, pageSize.getStatusCode());

        ResponseStatusException cefr = assertThrows(ResponseStatusException.class,
                () -> controller.grammarPoints(learner, null, 20, "B7", headers));
        assertEquals(HttpStatus.BAD_REQUEST, cefr.getStatusCode());

        ResponseStatusException missingPrincipal = assertThrows(ResponseStatusException.class,
                () -> controller.grammarPoints(null, null, 20, null, headers));
        assertEquals(HttpStatus.UNAUTHORIZED, missingPrincipal.getStatusCode());

        Jwt incomplete = Jwt.withTokenValue("test-token").header("alg", "RS256")
                .subject("test-learner").issuedAt(Instant.parse("2026-09-23T00:00:00Z"))
                .expiresAt(Instant.parse("2026-09-23T00:05:00Z"))
                .claim("tenant_id", "platform").claim("roles", List.of("learner"))
                .claim("permissions", List.of("content.read")).claim("adult_gate", "PASSED")
                .claim("consent_state", "REVOKED").build();
        ResponseStatusException denied = assertThrows(ResponseStatusException.class,
                () -> controller.grammarPoints(new JwtAuthenticationToken(incomplete, Set.of(), incomplete.getSubject()),
                        null, 20, null, headers));
        assertEquals(HttpStatus.FORBIDDEN, denied.getStatusCode());
    }

    @Test
    void grammarPointsCursorIsOpaqueAndKeysetReadsDoNotUnlockLegacyRows() {
        HttpHeaders headers = new HttpHeaders();
        String cursor = B3ContentJdbcController.encodeCursor("3101", "legacy-grammar");
        assertFalse(cursor.contains("3101"));
        assertEquals(List.of(), data(controller.grammarPoints(learner, cursor, 20, null, headers)).get("items"));
    }

    private void publishVersion(long id, String contentId) {
        jdbc.update("""
                INSERT INTO content_version
                (content_version_id, content_id, status, published_at, copyright_status,
                 rights_allows_learning, rights_source_code, rights_license_code,
                 authorization_evidence_ref, rights_permitted_channels,
                 editor, first_reviewer, final_reviewer, publisher)
                VALUES (?, ?, 'PUBLISHED', CURRENT_TIMESTAMP, 'ACTIVE', TRUE,
                        'publisher-source', 'licensed-use', 'approved-rights-record',
                        '["LEARNER","PUBLIC"]', 'editor-1', 'reviewer-1', 'reviewer-2', 'publisher-1')
                """, id, contentId);
    }

    private void assertEmptyAndNotFound() {
        assertEquals(List.of(), items());
        assertFalse(data(grammarPoints()).containsKey("contentVersionId"),
                "an empty projection must not claim the legacy version is published");
        assertEquals(List.of(), data(controller.grammarTree(learner)).get("nodes"));
        assertFalse(data(controller.grammarTree(learner)).containsKey("contentVersionId"));
        assertEquals(List.of(), data(controller.grammarExercises(learner, null, 20)).get("items"));
        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> controller.grammarPoint("3101", learner));
        assertEquals(HttpStatus.NOT_FOUND, error.getStatusCode());
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> items() {
        return (List<Map<String, Object>>) data(grammarPoints()).get("items");
    }

    private Map<String, Object> grammarPoints() {
        return controller.grammarPoints(learner, null, 20, null, new HttpHeaders());
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> data(Map<String, Object> response) {
        return (Map<String, Object>) response.get("data");
    }

    /** H2 bridge for the same JSON membership predicate used by MySQL in the production query. */
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
        if (json == null || path == null || !"$.cefrLevel".equals(path)) return null;
        try {
            Object value = new ObjectMapper().readValue(json, Object.class);
            Object level = value instanceof Map<?, ?> map ? map.get("cefrLevel") : null;
            return level == null ? null : new ObjectMapper().writeValueAsString(level);
        } catch (Exception ignored) {
            return null;
        }
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
