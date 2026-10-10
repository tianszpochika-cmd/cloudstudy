package com.englishflow.learner.web;

import java.io.IOException;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Set;

import com.englishflow.learner.config.LearnerServiceProperties;
import com.englishflow.learner.domain.AuthorizationDecision;
import com.englishflow.learner.domain.ConsentState;
import com.englishflow.learner.domain.LearnerAccessPolicy;
import com.englishflow.learner.domain.LearnerAuthorizationException;
import com.englishflow.learner.domain.LearnerDecisionCode;
import com.englishflow.learner.domain.LearnerPrincipalContext;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.server.ResponseStatusException;

import tools.jackson.databind.ObjectMapper;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class LearningConsentRecheckTest {

    private static final String SUBJECT = "3f8b1c42-9d2e-4a7b-8c1d-5e6f7a8b9c0d";

    @Test
    void staleGrantedTokenIsDeniedWhenLiveFactIsWithdrawn() {
        LearningConsentRecheck withdrawn = principalId -> false;
        ResponseStatusException denied = assertThrows(ResponseStatusException.class, () ->
                LearnerHttpPrincipals.requireLearningAccess(grantedToken(), "learner.profile.read", withdrawn));
        assertEquals(HttpStatus.FORBIDDEN, denied.getStatusCode());
    }

    @Test
    void liveGrantStillAllowsTheMatchingPermission() {
        assertEquals(SUBJECT, LearnerHttpPrincipals.requireLearningAccess(
                grantedToken(), "learner.profile.read", principalId -> true).subject());
    }

    @Test
    void unreadableLiveFactFailsClosed() {
        LearningConsentRecheck unavailable = principalId -> {
            throw new IllegalStateException("iam unavailable");
        };
        assertEquals(HttpStatus.FORBIDDEN, assertThrows(ResponseStatusException.class, () ->
                LearnerHttpPrincipals.requireLearningAccess(grantedToken(), "learner.profile.read", unavailable))
                .getStatusCode());
    }

    @Test
    void withdrawnLiveFactIsForbiddenAsConsentRequired() {
        LearnerPrincipalContext context = factory(principalId -> false).from(grantedToken());
        AuthorizationDecision decision = new LearnerAccessPolicy(Clock.fixed(Instant.parse("2026-10-09T00:00:00Z"), ZoneOffset.UTC))
                .authorize(context, "learner.profile.read", "learner-profile", SUBJECT, "platform", SUBJECT);
        assertFalse(decision.allowed());
        assertEquals(LearnerDecisionCode.CONSENT_REQUIRED, decision.code());

        ResponseEntity<Map<String, Object>> response = new LearnerHttpExceptionHandler()
                .authorization(new LearnerAuthorizationException(decision.code()));
        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
        @SuppressWarnings("unchecked")
        Map<String, Object> error = (Map<String, Object>) response.getBody().get("error");
        assertEquals("CONSENT_REQUIRED", error.get("code"));
    }

    @Test
    void factoryReplacesStaleGrantedClaim() {
        VerifiedLearnerPrincipalFactory factory = factory(principalId -> false);
        assertEquals(ConsentState.WITHDRAWN, factory.from(grantedToken()).consent());
        assertEquals(ConsentState.GRANTED, factory(principalId -> true).from(grantedToken()).consent());
    }

    @Test
    void responseParserAcceptsOnlyExplicitGrant() throws Exception {
        ObjectMapper json = new ObjectMapper();
        assertTrue(IamLearningConsentRecheck.granted(json.readTree(
                "{\"data\":{\"learningConsent\":\"GRANTED\",\"learningAccess\":\"ELIGIBLE\"}}")));
        assertFalse(IamLearningConsentRecheck.granted(json.readTree(
                "{\"data\":{\"learningConsent\":\"WITHDRAWN\",\"learningAccess\":\"RESTRICTED\"}}")));
        assertFalse(IamLearningConsentRecheck.granted(json.readTree(
                "{\"error\":\"GRANTED\"}")));
    }

    @Test
    void iamUnreachableOrNonGrantIsNotALearningGrant() throws Exception {
        LearnerServiceProperties.ConsentRecheckProperties properties = recheckProperties();
        HttpClient down = mock(HttpClient.class);
        when(down.send(any(HttpRequest.class), any())).thenThrow(new IOException("iam unreachable"));
        assertFalse(new IamLearningConsentRecheck(properties, down).currentlyGranted(SUBJECT));

        HttpResponse<String> withdrawnToken = httpResponse(200, "{\"accessToken\":\"svc\"}");
        HttpResponse<String> withdrawnFact = httpResponse(200,
                "{\"data\":{\"learningConsent\":\"WITHDRAWN\",\"learningAccess\":\"RESTRICTED\"}}");
        HttpResponse<String> grantedToken = httpResponse(200, "{\"accessToken\":\"svc\"}");
        HttpResponse<String> grantedFact = httpResponse(200,
                "{\"data\":{\"learningConsent\":\"GRANTED\",\"learningAccess\":\"ELIGIBLE\"}}");
        HttpResponse<String> unavailableToken = httpResponse(200, "{\"accessToken\":\"svc\"}");
        HttpResponse<String> unavailableFact = httpResponse(503, "");

        HttpClient withdrawn = mock(HttpClient.class);
        doReturn(withdrawnToken).doReturn(withdrawnFact)
                .when(withdrawn).send(any(HttpRequest.class), any());
        assertFalse(new IamLearningConsentRecheck(properties, withdrawn).currentlyGranted(SUBJECT));

        HttpClient granted = mock(HttpClient.class);
        doReturn(grantedToken).doReturn(grantedFact)
                .when(granted).send(any(HttpRequest.class), any());
        assertTrue(new IamLearningConsentRecheck(properties, granted).currentlyGranted(SUBJECT));

        HttpClient unavailable = mock(HttpClient.class);
        doReturn(unavailableToken).doReturn(unavailableFact)
                .when(unavailable).send(any(HttpRequest.class), any());
        assertFalse(new IamLearningConsentRecheck(properties, unavailable).currentlyGranted(SUBJECT));
    }

    @Test
    void shippedConfigRechecksLearningConsentUnlessExplicitlyDisabled() throws IOException {
        try (var input = LearningConsentRecheckTest.class.getResourceAsStream("/application.yml")) {
            assertNotNull(input);
            String yaml = new String(input.readAllBytes(), StandardCharsets.UTF_8);
            int block = yaml.indexOf("  consent-recheck:\n");
            int persistence = yaml.indexOf("\n  persistence:", block);
            int enabled = yaml.indexOf("enabled: ${LEARNER_CONSENT_RECHECK_ENABLED:true}", block);
            assertTrue(block >= 0 && enabled > block && enabled < persistence);
        }
        assertTrue(new LearnerServiceProperties.ConsentRecheckProperties().isEnabled());
    }

    private static LearnerServiceProperties.ConsentRecheckProperties recheckProperties() {
        LearnerServiceProperties.ConsentRecheckProperties properties =
                new LearnerServiceProperties.ConsentRecheckProperties();
        properties.setIamBaseUrl("https://127.0.0.1:18087");
        properties.setClientId("learner-service");
        properties.setClientSecret("local-test-secret");
        return properties;
    }

    @SuppressWarnings("unchecked")
    private static HttpResponse<String> httpResponse(int status, String body) {
        HttpResponse<String> response = mock(HttpResponse.class);
        when(response.statusCode()).thenReturn(status);
        when(response.body()).thenReturn(body);
        return response;
    }

    private static VerifiedLearnerPrincipalFactory factory(LearningConsentRecheck recheck) {
        LearnerServiceProperties properties = new LearnerServiceProperties();
        properties.setPhase("phase-1");
        return new VerifiedLearnerPrincipalFactory(properties, recheck);
    }

    private static JwtAuthenticationToken grantedToken() {
        Jwt jwt = Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .subject(SUBJECT)
                .issuedAt(Instant.parse("2026-10-09T00:00:00Z"))
                .expiresAt(Instant.parse("2026-10-09T00:15:00Z"))
                .claim("tenant_id", "platform")
                .claim("roles", List.of("learner"))
                .claim("permissions", List.of("learner.profile.read"))
                .claim("adult_gate", "PASSED")
                .claim("consent_state", "GRANTED")
                .build();
        return new JwtAuthenticationToken(jwt, Set.of(), jwt.getSubject());
    }
}
