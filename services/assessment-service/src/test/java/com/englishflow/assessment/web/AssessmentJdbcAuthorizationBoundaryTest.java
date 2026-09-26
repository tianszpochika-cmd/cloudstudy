package com.englishflow.assessment.web;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.function.Executable;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.server.ResponseStatusException;

import tools.jackson.databind.ObjectMapper;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;

/** Each route must check its own IAM learning permission before touching owner data. */
class AssessmentJdbcAuthorizationBoundaryTest {

    @Test
    void b25ReadsNeedReadAndMutationsNeedWriteBeforeJdbc() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        B25AssessmentJdbcController controller = new B25AssessmentJdbcController(jdbc, new ObjectMapper());
        JwtAuthenticationToken readOnly = authentication("assessment.session.read");
        JwtAuthenticationToken writeOnly = authentication("assessment.session.write");

        // This GET creates a durable session on first access, so it needs write permission.
        deniedBeforeJdbc(jdbc, () -> controller.dailyStream(readOnly, null, 10));
        deniedBeforeJdbc(jdbc, () -> controller.start(readOnly, Map.of(), "key"));
        deniedBeforeJdbc(jdbc, () -> controller.submitStep(readOnly, Map.of(), "key"));
        deniedBeforeJdbc(jdbc, () -> controller.skip(readOnly, Map.of(), "key"));
        deniedBeforeJdbc(jdbc, () -> controller.readPlacement(writeOnly, null));
        deniedBeforeJdbc(jdbc, () -> controller.report(writeOnly, "session-1"));
    }

    @Test
    void b10ReadsNeedReadAndMutationsNeedWriteBeforeJdbc() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        B10AssessmentJdbcController controller = new B10AssessmentJdbcController(jdbc, new ObjectMapper(),
                "http://127.0.0.1:18089");
        JwtAuthenticationToken readOnly = authentication("assessment.session.read");
        JwtAuthenticationToken writeOnly = authentication("assessment.session.write");

        deniedBeforeJdbc(jdbc, () -> controller.createSession(readOnly, Map.of(), "key", null));
        deniedBeforeJdbc(jdbc, () -> controller.submitAttempt(readOnly, "session-1", Map.of(), "key"));
        deniedBeforeJdbc(jdbc, () -> controller.verifyMistake(readOnly, 1L, Map.of(), "key"));
        deniedBeforeJdbc(jdbc, () -> controller.issueVariant(readOnly, 1L, Map.of(), "key"));
        deniedBeforeJdbc(jdbc, () -> controller.saveCheckpoint(readOnly, "session-1", "attempt-1", Map.of(), "key"));
        deniedBeforeJdbc(jdbc, () -> controller.readSession(writeOnly, "session-1"));
        deniedBeforeJdbc(jdbc, () -> controller.listMistakes(writeOnly));
        deniedBeforeJdbc(jdbc, () -> controller.readReport(writeOnly, "report-1"));
    }

    @Test
    void preGateOrWithdrawnConsentNeverReachJdbcEvenWithAssessmentPermission() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        B25AssessmentJdbcController b25 = new B25AssessmentJdbcController(jdbc, new ObjectMapper());
        B10AssessmentJdbcController b10 = new B10AssessmentJdbcController(jdbc, new ObjectMapper(),
                "http://127.0.0.1:18089");
        deniedBeforeJdbc(jdbc, () -> b25.dailyStream(authentication("assessment.session.write", null, null), null, 10));
        deniedBeforeJdbc(jdbc, () -> b10.listMistakes(authentication("assessment.session.read", "PASSED", "WITHDRAWN")));
    }

    private static void deniedBeforeJdbc(JdbcTemplate jdbc, Executable request) {
        ResponseStatusException failure = assertThrows(ResponseStatusException.class, request);
        assertEquals(HttpStatus.FORBIDDEN, failure.getStatusCode());
        verifyNoInteractions(jdbc);
    }

    private static JwtAuthenticationToken authentication(String permission) {
        return authentication(permission, "PASSED", "GRANTED");
    }

    private static JwtAuthenticationToken authentication(String permission, String adultGate, String consentState) {
        Instant now = Instant.parse("2026-09-23T00:00:00Z");
        Jwt.Builder builder = Jwt.withTokenValue("verified")
                .header("alg", "RS256")
                .subject("learner-1")
                .issuedAt(now)
                .expiresAt(now.plusSeconds(3600))
                .claim("tenant_id", "platform")
                .claim("roles", List.of("learner"))
                .claim("permissions", List.of(permission));
        if (adultGate != null) builder.claim("adult_gate", adultGate);
        if (consentState != null) builder.claim("consent_state", consentState);
        Jwt jwt = builder.build();
        return new JwtAuthenticationToken(jwt, Set.of(), jwt.getSubject());
    }
}
