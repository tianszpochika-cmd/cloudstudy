package com.englishflow.iam.web;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.server.ResponseStatusException;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;

class IamAccountDeletionSafetyBoundaryTest {

    @Test
    void newRequestDoesNotCreateADeletionWithoutReauthenticationAndOwnerOrchestration() {
        ObjectProvider<JdbcTemplate> jdbc = jdbcProvider();
        IamAccountDeletionController controller = new IamAccountDeletionController(jdbc);

        ResponseStatusException failure = assertThrows(ResponseStatusException.class,
                () -> controller.request(Map.of(
                        "reauthenticationRef", "reauth_12345678",
                        "confirmation", "DELETE_ACCOUNT",
                        "reasonCode", "USER_REQUEST"), "request-1", accessPrincipal()));

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, failure.getStatusCode());
        verifyNoInteractions(jdbc);
    }

    @Test
    void workloadCannotMarkAnAccountDeletedWithoutOwnerReceipts() {
        ObjectProvider<JdbcTemplate> jdbc = jdbcProvider();
        IamAccountDeletionController controller = new IamAccountDeletionController(jdbc);

        ResponseStatusException failure = assertThrows(ResponseStatusException.class,
                () -> controller.execute("del_test", servicePrincipal()));

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, failure.getStatusCode());
        verifyNoInteractions(jdbc);
    }

    @SuppressWarnings("unchecked")
    private static ObjectProvider<JdbcTemplate> jdbcProvider() {
        return mock(ObjectProvider.class);
    }

    private static JwtAuthenticationToken accessPrincipal() {
        Jwt jwt = Jwt.withTokenValue("test-access")
                .header("alg", "none")
                .subject("synthetic-learner")
                .claim("tenant_id", "platform")
                .build();
        return new JwtAuthenticationToken(jwt, List.of());
    }

    private static JwtAuthenticationToken servicePrincipal() {
        Jwt jwt = Jwt.withTokenValue("test-service")
                .header("alg", "none")
                .subject("synthetic-workflow")
                .build();
        return new JwtAuthenticationToken(jwt,
                List.of(new SimpleGrantedAuthority("TOKEN_TYPE_service")));
    }
}
