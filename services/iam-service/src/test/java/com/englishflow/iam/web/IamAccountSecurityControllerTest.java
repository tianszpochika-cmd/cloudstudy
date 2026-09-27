package com.englishflow.iam.web;

import com.englishflow.iam.domain.AccountRecord;
import com.englishflow.iam.domain.AccountStatus;
import com.englishflow.iam.domain.IamDecisionCode;
import com.englishflow.iam.domain.IamPolicyException;
import com.englishflow.iam.domain.InMemoryAccountStore;
import com.englishflow.iam.domain.PolicyAccessAuthenticationVerifier;
import com.englishflow.iam.domain.PolicyActor;
import com.englishflow.iam.domain.PrincipalId;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class IamAccountSecurityControllerTest {

    private static final Instant NOW = Instant.parse("2026-09-28T00:00:00Z");

    private InMemoryAccountStore accounts;
    private PolicyAccessAuthenticationVerifier verifier;
    private IamAccountSecurityController controller;
    private PrincipalId staff;
    private PrincipalId victim;

    @BeforeEach
    void setUp() {
        accounts = new InMemoryAccountStore();
        verifier = mock(PolicyAccessAuthenticationVerifier.class);
        controller = new IamAccountSecurityController(
                accounts, verifier, Clock.fixed(NOW, ZoneOffset.UTC));
        staff = new PrincipalId(UUID.randomUUID());
        victim = new PrincipalId(UUID.randomUUID());
        when(verifier.verify(any(Authentication.class)))
                .thenReturn(new PolicyActor(staff, "platform", Set.of("admin.risk.read")));
    }

    private void locked(PrincipalId principal, String identifier, int attempts, Instant until) {
        accounts.save(new AccountRecord(principal, identifier,
                "$2a$12$.....................................", Set.of("learner"), Set.of(),
                AccountStatus.LOCKED, attempts, until, NOW.minusSeconds(3600), NOW.minusSeconds(60)));
    }

    @Test
    void lockedAccountsExposeOpaqueRefsOnly() {
        locked(victim, "victim-risk-1@local.invalid", 5, NOW.plusSeconds(900));

        var response = controller.locked(mock(Authentication.class), null, null);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        var items = response.getBody().data().items();
        assertEquals(1, items.size());
        assertEquals(5, items.get(0).failedAttempts());
        assertEquals(NOW.plusSeconds(900), items.get(0).lockedUntil());
        assertEquals(64, items.get(0).subjectRef().length());
        assertFalse(items.get(0).subjectRef().contains(victim.value().toString()));
        assertFalse(response.getBody().meta().hasMore());
    }

    @Test
    void expiredLocksStayInvisible() {
        locked(victim, "victim-risk-2@local.invalid", 5, NOW.minusSeconds(10));

        var response = controller.locked(mock(Authentication.class), null, null);

        assertTrue(response.getBody().data().items().isEmpty());
    }

    @Test
    void missingRiskPermissionIsDenied() {
        when(verifier.verify(any(Authentication.class)))
                .thenReturn(new PolicyActor(staff, "platform", Set.of("learner")));
        locked(victim, "victim-risk-3@local.invalid", 5, NOW.plusSeconds(900));

        IamPolicyException denied = assertThrows(IamPolicyException.class,
                () -> controller.locked(mock(Authentication.class), null, null));
        assertEquals(IamDecisionCode.POLICY_PERMISSION_DENIED, denied.code());
    }

    @Test
    void pageSizeBoundsAreRejected() {
        assertThrows(IamPolicyException.class,
                () -> controller.locked(mock(Authentication.class), null, 0));
        assertThrows(IamPolicyException.class,
                () -> controller.locked(mock(Authentication.class), null, 101));
    }

    @Test
    void subjectRefsAreStablePerPrincipal() {
        locked(victim, "victim-risk-4@local.invalid", 5, NOW.plusSeconds(900));
        String first = controller.locked(mock(Authentication.class), null, null)
                .getBody().data().items().get(0).subjectRef();
        String second = controller.locked(mock(Authentication.class), null, null)
                .getBody().data().items().get(0).subjectRef();
        assertEquals(first, second);
        assertEquals(first, IamAccountSecurityController.subjectRef(victim.value()));
    }
}
