package com.englishflow.social.security;

import org.junit.jupiter.api.Test;

import java.util.LinkedHashSet;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Identity facts produced by a verified IAM token. Clients never construct this from bodies.
 */
class SocialPrincipalTest {

    private static final String SUBJECT = "prn_social00000001";
    private static final String TENANT = "platform";

    @Test
    void subjectAndTenantAreRequired() {
        assertThatThrownBy(() -> new SocialPrincipal(null, TENANT, "phase-1", true, true, false, Set.of(), Set.of()))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new SocialPrincipal("  ", TENANT, "phase-1", true, true, false, Set.of(), Set.of()))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new SocialPrincipal(SUBJECT, null, "phase-1", true, true, false, Set.of(), Set.of()))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new SocialPrincipal(SUBJECT, " ", "phase-1", true, true, false, Set.of(), Set.of()))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void nullOrEmptyPermissionAndRoleSetsNormalizeToEmptyImmutableSets() {
        SocialPrincipal principal = new SocialPrincipal(SUBJECT, TENANT, "phase-1", true, true, false, null, null);

        assertThat(principal.permissions()).isEmpty();
        assertThat(principal.roles()).isEmpty();
        assertThatThrownBy(() -> principal.permissions().add("x"))
                .isInstanceOf(UnsupportedOperationException.class);
    }

    @Test
    void permissionSetsAreCopiedNotAliased() {
        Set<String> mutable = new LinkedHashSet<>();
        mutable.add("social.room.read");

        SocialPrincipal principal = new SocialPrincipal(SUBJECT, TENANT, "phase-1", true, true, false, mutable, Set.of());
        mutable.add("social.moderation.review");

        assertThat(principal.permissions()).containsExactly("social.room.read");
    }

    @Test
    void permissionSetIsUnmodifiable() {
        SocialPrincipal principal = SocialPrincipal.phaseOne(SUBJECT);

        assertThatThrownBy(() -> principal.permissions().add("social.moderation.review"))
                .isInstanceOf(UnsupportedOperationException.class);
    }

    @Test
    void hasPermissionMatchesExactValue() {
        SocialPrincipal principal = SocialPrincipal.phaseOne(SUBJECT);

        assertThat(principal.hasPermission("social.room.read")).isTrue();
        assertThat(principal.hasPermission("social.moderation.review")).isFalse();
    }

    @Test
    void wildcardPermissionAllowsEverything() {
        SocialPrincipal wildcard = SocialPrincipal.phaseOne(SUBJECT, TENANT, Set.of("*"));

        assertThat(wildcard.hasPermission("social.moderation.review")).isTrue();
        assertThat(wildcard.hasPermission("anything.at.all")).isTrue();
    }

    @Test
    void phaseOneFactoryProducesUsablePrincipal() {
        SocialPrincipal principal = SocialPrincipal.phaseOne(SUBJECT);

        assertThat(principal.subjectId()).isEqualTo(SUBJECT);
        assertThat(principal.tenantId()).isEqualTo(SocialPrincipal.PLATFORM_TENANT);
        assertThat(principal.phase()).isEqualTo(SocialPrincipal.PHASE_ONE);
        assertThat(principal.isUsablePhaseOne()).isTrue();
    }

    @Test
    void usabilityRequiresActiveAndNotRevokedAndConsent() {
        assertThat(new SocialPrincipal(SUBJECT, TENANT, "phase-1", true, false, false, Set.of(), Set.of())
                .isUsablePhaseOne()).isFalse();
        assertThat(new SocialPrincipal(SUBJECT, TENANT, "phase-1", true, true, true, Set.of(), Set.of())
                .isUsablePhaseOne()).isFalse();
        assertThat(new SocialPrincipal(SUBJECT, TENANT, "phase-1", false, true, false, Set.of(), Set.of())
                .isUsablePhaseOne()).isFalse();
        assertThat(new SocialPrincipal(SUBJECT, TENANT, "phase-2", true, true, false, Set.of(), Set.of())
                .isUsablePhaseOne()).isFalse();
    }

    @Test
    void servicePrincipalCarriesServiceRole() {
        SocialPrincipal service = SocialPrincipal.servicePrincipal("social-service", TENANT, Set.of("social.events.consume"));

        assertThat(service.roles()).contains("SERVICE");
        assertThat(service.hasPermission("social.events.consume")).isTrue();
        assertThat(service.isUsablePhaseOne()).isTrue();
    }
}
