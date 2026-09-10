package com.englishflow.social.security;

import com.englishflow.social.domain.SocialException;
import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Service-side PEP contract: verified identity facts first, then tenant/owner/permission.
 * Missing facts deny with a stable code instead of degrading into an empty result.
 */
class SocialPepTest {

    private static final String SUBJECT = "prn_social00000001";
    private static final String TENANT = SocialPrincipal.PLATFORM_TENANT;
    private static final String RESOURCE_OWNER = SUBJECT;

    private final SocialPep pep = new SocialPep();

    private static SocialPrincipal principal() {
        return SocialPrincipal.phaseOne(SUBJECT);
    }

    // --- identity ---

    @Test
    void nullPrincipalIsUnauthenticated() {
        assertThatThrownBy(() -> pep.requireIdentity(null))
                .satisfies(t -> {
                    SocialException e = (SocialException) t;
                    assertThat(e.code()).isEqualTo("UNAUTHENTICATED");
                    assertThat(e.status()).isEqualTo(401);
                    assertThat(e.retryable()).isFalse();
                });
    }

    @Test
    void inactivePrincipalIsForbiddenAndNotUnauthenticated() {
        SocialPrincipal inactive = new SocialPrincipal(
                SUBJECT, TENANT, SocialPrincipal.PHASE_ONE, true, false, false, Set.of(), Set.of());

        assertThatThrownBy(() -> pep.requireIdentity(inactive))
                .satisfies(t -> {
                    SocialException e = (SocialException) t;
                    assertThat(e.code()).isEqualTo("SOCIAL_PRINCIPAL_INACTIVE");
                    assertThat(e.status()).isEqualTo(403);
                });
    }

    @Test
    void revokedPrincipalIsForbidden() {
        SocialPrincipal revoked = new SocialPrincipal(
                SUBJECT, TENANT, SocialPrincipal.PHASE_ONE, true, true, true, Set.of(), Set.of());

        assertThatThrownBy(() -> pep.requireIdentity(revoked))
                .satisfies(t -> assertThat(((SocialException) t).code()).isEqualTo("SOCIAL_PRINCIPAL_INACTIVE"));
    }

    @Test
    void principalWithoutConsentIsForbidden() {
        SocialPrincipal noConsent = new SocialPrincipal(
                SUBJECT, TENANT, SocialPrincipal.PHASE_ONE, false, true, false, Set.of(), Set.of());

        assertThatThrownBy(() -> pep.requireIdentity(noConsent))
                .satisfies(t -> assertThat(((SocialException) t).code()).isEqualTo("SOCIAL_PRINCIPAL_INACTIVE"));
    }

    @Test
    void nonPhaseOnePrincipalIsForbidden() {
        SocialPrincipal otherPhase = new SocialPrincipal(
                SUBJECT, TENANT, "phase-2", true, true, false, Set.of(), Set.of());

        assertThatThrownBy(() -> pep.requireIdentity(otherPhase))
                .satisfies(t -> assertThat(((SocialException) t).code()).isEqualTo("SOCIAL_PRINCIPAL_INACTIVE"));
    }

    @Test
    void usablePhaseOnePrincipalPassesIdentity() {
        assertThatCode(() -> pep.requireIdentity(principal())).doesNotThrowAnyException();
    }

    // --- permission ---

    @Test
    void missingPermissionIsDenied() {
        SocialPrincipal p = principal();

        assertThatThrownBy(() -> pep.requirePermission(p, "social.moderation.review"))
                .satisfies(t -> {
                    SocialException e = (SocialException) t;
                    assertThat(e.code()).isEqualTo("SOCIAL_PERMISSION_DENIED");
                    assertThat(e.status()).isEqualTo(403);
                });
    }

    @Test
    void nullOrBlankPermissionIsDeniedEvenForPrivilegedPrincipal() {
        SocialPrincipal privileged = SocialPrincipal.phaseOne(SUBJECT, TENANT, Set.of("*"));

        assertThatThrownBy(() -> pep.requirePermission(privileged, null))
                .isInstanceOf(SocialException.class);
        assertThatThrownBy(() -> pep.requirePermission(privileged, "   "))
                .isInstanceOf(SocialException.class);
    }

    @Test
    void wildcardPermissionAllowsAnyKnownPermission() {
        SocialPrincipal wildcard = SocialPrincipal.phaseOne(SUBJECT, TENANT, Set.of("*"));

        assertThatCode(() -> pep.requirePermission(wildcard, SocialPep.MODERATION_REVIEW))
                .doesNotThrowAnyException();
    }

    // --- any-of permission ---

    @Test
    void anyPermissionDeniesWhenNoneMatch() {
        SocialPrincipal p = principal();

        assertThatThrownBy(() -> pep.requireAnyPermission(p, Set.of("social.moderation.review", "social.events.consume")))
                .satisfies(t -> assertThat(((SocialException) t).code()).isEqualTo("SOCIAL_PERMISSION_DENIED"));
    }

    @Test
    void anyPermissionDeniesOnNullOrEmptySet() {
        SocialPrincipal p = principal();

        assertThatThrownBy(() -> pep.requireAnyPermission(p, null))
                .satisfies(t -> assertThat(((SocialException) t).code()).isEqualTo("SOCIAL_PERMISSION_DENIED"));
        assertThatThrownBy(() -> pep.requireAnyPermission(p, Set.of()))
                .satisfies(t -> assertThat(((SocialException) t).code()).isEqualTo("SOCIAL_PERMISSION_DENIED"));
    }

    @Test
    void anyPermissionPassesWhenOneMatches() {
        SocialPrincipal p = principal();

        assertThatCode(() -> pep.requireAnyPermission(p,
                Set.of("social.moderation.review", SocialPep.ROOM_READ)))
                .doesNotThrowAnyException();
    }

    // --- tenant ---

    @Test
    void tenantMismatchIsDenied() {
        SocialPrincipal p = principal();

        assertThatThrownBy(() -> pep.requireTenant(p, "other-tenant"))
                .satisfies(t -> {
                    SocialException e = (SocialException) t;
                    assertThat(e.code()).isEqualTo("SOCIAL_TENANT_FORBIDDEN");
                    assertThat(e.status()).isEqualTo(403);
                });
    }

    @Test
    void nullOrBlankTenantIsDenied() {
        SocialPrincipal p = principal();

        assertThatThrownBy(() -> pep.requireTenant(p, null))
                .satisfies(t -> assertThat(((SocialException) t).code()).isEqualTo("SOCIAL_TENANT_FORBIDDEN"));
        assertThatThrownBy(() -> pep.requireTenant(p, "  "))
                .satisfies(t -> assertThat(((SocialException) t).code()).isEqualTo("SOCIAL_TENANT_FORBIDDEN"));
    }

    @Test
    void matchingTenantPasses() {
        assertThatCode(() -> pep.requireTenant(principal(), TENANT)).doesNotThrowAnyException();
    }

    // --- owner ---

    @Test
    void ownerMismatchIsDeniedAfterPermissionAndTenantSucceed() {
        SocialPrincipal p = principal();

        assertThatThrownBy(() -> pep.requireOwner(p, TENANT, "prn_someoneelse0001", SocialPep.ROOM_WRITE))
                .satisfies(t -> {
                    SocialException e = (SocialException) t;
                    assertThat(e.code()).isEqualTo("SOCIAL_OWNER_FORBIDDEN");
                    assertThat(e.status()).isEqualTo(403);
                });
    }

    @Test
    void ownerCheckFailsFastOnMissingPermission() {
        SocialPrincipal p = principal();

        // missing moderation permission -> permission error wins over owner check
        assertThatThrownBy(() -> pep.requireOwner(p, TENANT, "prn_someoneelse0001", SocialPep.MODERATION_REVIEW))
                .satisfies(t -> assertThat(((SocialException) t).code()).isEqualTo("SOCIAL_PERMISSION_DENIED"));
    }

    @Test
    void matchingOwnerPasses() {
        assertThatCode(() -> pep.requireOwner(principal(), TENANT, RESOURCE_OWNER, SocialPep.ROOM_WRITE))
                .doesNotThrowAnyException();
    }
}
