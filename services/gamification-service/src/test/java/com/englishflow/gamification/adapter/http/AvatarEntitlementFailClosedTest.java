package com.englishflow.gamification.adapter.http;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.englishflow.gamification.application.GamificationAccessPolicy;
import com.englishflow.gamification.application.GamificationApplicationService;
import com.englishflow.gamification.domain.GamificationDomainException;
import com.englishflow.gamification.domain.RewardGrantView;
import com.englishflow.gamification.domain.RewardListView;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import tools.jackson.databind.ObjectMapper;

class AvatarEntitlementFailClosedTest {

    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final GamificationApplicationService service = mock(GamificationApplicationService.class);
    private final GamificationLocalFeatureController controller = new GamificationLocalFeatureController(
            jdbc, new ObjectMapper(), new GamificationPrincipalResolver(new GamificationAccessPolicy()), service);

    @Test
    void anonymousAndWrongTenantCannotReadOrWriteAvatarFacts() {
        assertEquals("UNAUTHORIZED", code(() -> controller.avatarItems(null)));
        assertEquals("UNAUTHORIZED", code(() -> controller.equipLoadout(null, "old-loadout")));
        assertEquals("FORBIDDEN", code(() -> controller.collection(user("alice", "other", "gamification.read"))));
        assertEquals("FORBIDDEN", code(() -> controller.redeem(
                user("alice", "other", "gamification.rewards.claim"), "ITEM_STARTER", "key")));
        verifyNoInteractions(jdbc, service);
    }

    @Test
    void legacyOwnedAndEquippedJsonCannotBeReadBackAsEntitlement() {
        // Old gamification_feature_state rows may claim owned=true and equipped=true.
        // None is a service-issued itemCode grant, so the endpoints do not read them.
        JwtAuthenticationToken alice = user("alice", "platform", "gamification.read");
        assertEquals(List.of(), controller.collection(alice).get("items"));
        assertEquals(List.of(), controller.avatarItems(alice).get("items"));
        assertEquals(List.of(), controller.avatarLoadouts(alice).get("items"));
        assertEquals(List.of(), controller.catalog(alice).get("items"));
        assertEquals(List.of(), controller.studySpace(alice).get("items"));
        assertEquals(List.of(), controller.studySpace(alice).get("placements"));
        assertFalse(controller.avatarResources(alice).containsKey("manifestHash"));
        verifyNoInteractions(jdbc, service);
    }

    @Test
    void claimedTierAndClientItemsCannotCreateOrEquipAnItem() {
        JwtAuthenticationToken reader = user("alice", "platform", "gamification.read");
        JwtAuthenticationToken claimer = user("alice", "platform", "gamification.rewards.claim");
        when(service.rewards("alice")).thenReturn(new RewardListView("alice", List.of(
                new RewardGrantView("grant-1", "event-1", "alice", "LEARNING_REWARD", "CLAIMED",
                        "probability-v1", "RARE", false, 0,
                        Instant.parse("2026-09-23T00:00:00Z"), Instant.parse("2026-09-23T00:01:00Z")))));
        assertEquals(List.of(), controller.collection(reader).get("items"));
        assertEquals(List.of(), controller.avatarItems(reader).get("items"));
        assertEquals("ENTITLEMENT_UNAVAILABLE", code(() -> controller.redeem(
                claimer, "ITEM_STARTER", "redeem-1")));
        assertEquals("ENTITLEMENT_UNAVAILABLE", code(() -> controller.saveLoadout(
                reader, "old-loadout", Map.of("items", List.of("ITEM_STARTER")))));
        assertEquals("ENTITLEMENT_UNAVAILABLE", code(() -> controller.equipLoadout(reader, "old-loadout")));
        assertEquals("ENTITLEMENT_UNAVAILABLE", code(() -> controller.saveStudySpace(
                reader, Map.of("placements", List.of(Map.of("itemCode", "DESK_STARTER"))))));
        // Even a CLAIMED reward_grant has only a tier outcome, never an itemCode.
        verifyNoInteractions(jdbc, service);
        assertEquals(503, new GamificationApiExceptionHandler()
                .handle(GamificationDomainException.entitlementUnavailable(), null).getStatusCode().value());
    }

    @Test
    void oldAvatarProfileCannotBeReadBackAcrossOrWithinAccounts() {
        // A legacy row may contain avatarId/resourceVersion/loadoutId and renderMode=3D.
        // The endpoint does not read that row for either subject.
        Map<String, Object> aliceProfile = profile(controller.avatarProfile(user("alice", "platform", "gamification.read")));
        Map<String, Object> bobProfile = profile(controller.avatarProfile(user("bob", "platform", "gamification.read")));
        assertEquals(Map.of("renderMode", "2D_FALLBACK"), aliceProfile);
        assertEquals(Map.of("renderMode", "2D_FALLBACK"), bobProfile);
        verifyNoInteractions(jdbc, service);
    }

    @Test
    void profilePutWithSameKeyOrDifferentPayloadNeverWrites() {
        JwtAuthenticationToken alice = user("alice", "platform", "gamification.read");
        String key = "avatar-profile-1";
        assertEquals("ENTITLEMENT_UNAVAILABLE", code(() -> controller.saveAvatarProfile(
                alice, Map.of("renderMode", "3D", "resourceVersion", "forged-manifest"), key)));
        assertEquals("ENTITLEMENT_UNAVAILABLE", code(() -> controller.saveAvatarProfile(
                alice, Map.of("renderMode", "3D", "resourceVersion", "forged-manifest"), key)));
        assertEquals("ENTITLEMENT_UNAVAILABLE", code(() -> controller.saveAvatarProfile(
                alice, Map.of("renderMode", "2D_FALLBACK", "loadoutId", "forged-loadout"), key)));
        assertEquals("ENTITLEMENT_UNAVAILABLE", code(() -> controller.saveAvatarProfile(
                user("bob", "platform", "gamification.read"), Map.of("renderMode", "3D"), key)));
        verifyNoInteractions(jdbc, service);
    }

    private static Map<String, Object> profile(Map<String, Object> response) {
        @SuppressWarnings("unchecked")
        Map<String, Object> result = (Map<String, Object>) response.get("profile");
        return result;
    }

    private static JwtAuthenticationToken user(String subject, String tenant, String permission) {
        Jwt jwt = Jwt.withTokenValue("token")
                .header("alg", "RS256")
                .subject(subject)
                .issuedAt(Instant.parse("2026-09-23T00:00:00Z"))
                .expiresAt(Instant.parse("2026-09-23T01:00:00Z"))
                .claim("tenant_id", tenant)
                .claim("permissions", List.of(permission))
                .build();
        return new JwtAuthenticationToken(jwt, Set.of(), subject);
    }

    private static String code(Runnable action) {
        return assertThrows(GamificationDomainException.class, action::run).code().name();
    }
}
