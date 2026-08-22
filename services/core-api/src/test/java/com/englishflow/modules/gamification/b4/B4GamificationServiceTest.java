package com.englishflow.modules.gamification.b4;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.function.Executable;

import com.englishflow.modules.b4.B4Exception;
import com.englishflow.modules.b4.InMemoryB4DurableRepository;

class B4GamificationServiceTest {
    private static final long USER_ID = 42L;
    private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-08-22T00:00:00Z"), ZoneOffset.UTC);
    private static final String CHEST_SECRET_PROPERTY = "englishflow.b4.chest.hmac-secret";

    private InMemoryB4DurableRepository repository;
    private B4GamificationService service;
    private String previousChestSecret;

    @BeforeEach
    void setUp() {
        repository = new InMemoryB4DurableRepository();
        service = new B4GamificationService(CLOCK, repository);
        previousChestSecret = System.getProperty(CHEST_SECRET_PROPERTY);
        System.setProperty(CHEST_SECRET_PROPERTY, "unit-test-b4-chest-secret");
    }

    @AfterEach
    void restoreChestSecret() {
        if (previousChestSecret == null) {
            System.clearProperty(CHEST_SECRET_PROPERTY);
        } else {
            System.setProperty(CHEST_SECRET_PROPERTY, previousChestSecret);
        }
    }

    @Test
    void learningEventReplayDoesNotDoubleSettleXpOrCoins() {
        Map<String, Object> request = Map.of(
                "sourceType", "LESSON_COMPLETE",
                "sourceEventId", "lesson-event-001");

        Map<String, Object> first = service.settleLearningEvent(USER_ID, request, "learning-key-001");
        Map<String, Object> sameKeyReplay = service.settleLearningEvent(USER_ID, request, "learning-key-001");
        Map<String, Object> sourceEventReplay = service.settleLearningEvent(USER_ID, request, "learning-key-002");

        assertSame(first, sameKeyReplay);
        Map<String, Object> firstData = data(first);
        Map<String, Object> replayData = data(sourceEventReplay);
        assertFalse((Boolean) firstData.get("replayed"));
        assertTrue((Boolean) replayData.get("replayed"));
        assertEquals(firstData.get("settlementId"), replayData.get("settlementId"));
        assertEquals(20, ((Number) firstData.get("xp")).intValue());
        assertEquals(1, ((Number) firstData.get("coins")).intValue());

        Map<String, Object> firstProfile = profile(firstData);
        Map<String, Object> profile = profile(data(service.profile(USER_ID)));
        assertEquals(firstProfile.get("xp"), profile.get("xp"));
        assertEquals(firstProfile.get("coins"), profile.get("coins"));
        assertEquals(1L, repository.list("GAM_XP", USER_ID).stream()
                .filter(fact -> "lesson-event-001".equals(fact.payload().get("sourceEventId"))).count());
        assertEquals(1L, repository.list("GAM_CURRENCY", USER_ID).stream()
                .filter(fact -> "lesson-event-001".equals(fact.payload().get("sourceEventId"))).count());
    }

    @Test
    void idempotencyKeyCannotBeReusedForDifferentLearningEvent() {
        service.settleLearningEvent(USER_ID,
                Map.of("sourceType", "LESSON_COMPLETE", "sourceEventId", "lesson-event-002"),
                "learning-key-003");

        B4Exception exception = assertB4Exception("IDEMPOTENCY_CONFLICT", () -> service.settleLearningEvent(
                USER_ID,
                Map.of("sourceType", "READING_COMPLETE", "sourceEventId", "reading-event-002"),
                "learning-key-003"));

        assertEquals(409, exception.status());
        assertFalse(exception.retryable());
    }

    @Test
    void xpAndStarCoinBalancesCannotBecomeNegative() {
        B4Exception exception = assertB4Exception("INSUFFICIENT_BALANCE",
                () -> service.redeem(USER_ID, "COMMON_ITEM", "redeem-key-001"));

        assertEquals(409, exception.status());
        Map<String, Object> initialProfile = profile(data(service.profile(USER_ID)));
        assertEquals(0L, ((Number) initialProfile.get("xp")).longValue());
        assertEquals(0L, ((Number) initialProfile.get("coins")).longValue());

        service.settleLearningEvent(USER_ID,
                Map.of("sourceType", "WRITING_SUBMISSION", "sourceEventId", "writing-event-001"),
                "learning-key-004");
        Map<String, Object> settledProfile = profile(data(service.profile(USER_ID)));
        assertTrue(((Number) settledProfile.get("xp")).longValue() >= 0L);
        assertTrue(((Number) settledProfile.get("coins")).longValue() >= 0L);
    }

    @Test
    void featureFlagBlocksDisabledRewardAndGameWithoutChangingRewardBalance() {
        B4GamificationService disabledGamification = new B4GamificationService(
                CLOCK, repository, Map.of("gamification", false));
        Map<String, Object> result = disabledGamification.settleLearningEvent(
                USER_ID,
                Map.of("sourceType", "LESSON_COMPLETE", "sourceEventId", "disabled-event-001"),
                "disabled-key-001");

        Map<String, Object> resultData = data(result);
        assertFalse((Boolean) resultData.get("accepted"));
        assertEquals("FEATURE_DISABLED", resultData.get("reasonCode"));
        assertEquals(0, repository.list("GAM_XP", USER_ID).size());

        B4Exception gameException = assertB4Exception("GAM_FEATURE_DISABLED", () -> service.createGameSession(
                USER_ID, Map.of("gameCode", "GRAMMAR_BLASTER"), "game-key-disabled-001"));
        assertEquals(409, gameException.status());
        assertEquals(1, repository.list("GAM_FEATURE_FLAG", USER_ID).size());
    }

    @Test
    void gameCatalogExposesPerformanceTiersAndPerformanceFallbackIsPersisted() {
        Map<String, Object> catalog = data(service.gameCatalog(USER_ID));
        assertEquals(List.of("Ultra", "High", "Medium", "Performance"), catalog.get("performanceTiers"));

        List<?> items = listValue(catalog, "items");
        Map<String, Object> grammarBlaster = items.stream()
                .map(item -> (Map<String, Object>) item)
                .filter(item -> "GRAMMAR_BLASTER".equals(item.get("gameCode")))
                .findFirst()
                .orElseThrow();
        assertEquals(false, grammarBlaster.get("enabled"));

        Map<String, Object> created = service.createGameSession(
                USER_ID,
                Map.of("gameCode", "WORD_MATCH", "performanceTier", "Performance"),
                "game-key-performance-001");
        Map<String, Object> session = mapValue(data(created), "session");
        assertEquals("READY", session.get("status"));
        assertEquals("Performance", session.get("performanceTier"));

        Map<String, Object> avatar = data(service.saveAvatarProfile(
                USER_ID,
                Map.of("resourceVersion", "AVATAR_RES_2026_08", "renderMode", "2D_FALLBACK"),
                "avatar-key-performance-001"));
        assertEquals("2D_FALLBACK", mapValue(avatar, "profile").get("renderMode"));
        Map<String, Object> resources = data(service.avatarResources(USER_ID));
        assertEquals("2D_FALLBACK", resources.get("fallbackMode"));
        assertEquals(List.of("Ultra", "High", "Medium", "Performance"), resources.get("performanceTiers"));
    }

    @Test
    void gameSessionTransitionsThroughPauseResumeAndFinishStates() {
        Map<String, Object> created = data(service.createGameSession(
                USER_ID,
                Map.of("gameCode", "SENTENCE_TRAIN", "performanceTier", "High"),
                "game-key-state-001"));
        Map<String, Object> session = mapValue(created, "session");
        String sessionId = (String) session.get("sessionId");
        assertEquals("READY", session.get("status"));

        Map<String, Object> firstEvent = submitCorrectRound(sessionId, session, 0, 1);
        session = mapValue(firstEvent, "session");
        assertEquals("IN_PROGRESS", session.get("status"));

        Map<String, Object> paused = data(service.pauseGame(USER_ID, sessionId, "game-key-pause-001"));
        session = mapValue(paused, "session");
        assertEquals("PAUSED", session.get("status"));

        Map<String, Object> resumed = data(service.resumeGame(USER_ID, sessionId, "game-key-resume-001"));
        session = mapValue(resumed, "session");
        assertEquals("IN_PROGRESS", session.get("status"));

        for (int round = 1; round < 5; round++) {
            session = mapValue(submitCorrectRound(sessionId, session, round, round + 1), "session");
        }

        Map<String, Object> finished = data(service.finishGame(USER_ID, sessionId, "game-key-finish-001"));
        assertEquals("COMPLETED", finished.get("status"));
        assertEquals(true, finished.get("passed"));
        assertEquals(true, finished.get("rewardEligible"));
        assertEquals(100, finished.get("completionPercent"));
        assertEquals(100, finished.get("accuracyPercent"));

        B4Exception pauseAfterFinish = assertB4Exception("GAM_GAME_STATE_INVALID",
                () -> service.pauseGame(USER_ID, sessionId, "game-key-pause-002"));
        assertEquals(409, pauseAfterFinish.status());
    }

    @Test
    void openingOneChestTwiceOnlyCreatesOneOpenAudit() {
        service.settleLearningEvent(
                USER_ID,
                Map.of("sourceType", "DAILY_GOAL_REACHED", "sourceEventId", "daily-goal-001"),
                "learning-key-chest-001");

        List<?> chestItems = listValue(data(service.chests(USER_ID)), "items");
        assertEquals(1, chestItems.size());
        Map<String, Object> chest = (Map<String, Object>) chestItems.get(0);
        String chestGrantId = (String) chest.get("chestGrantId");
        assertEquals("GRANTED", chest.get("status"));

        Map<String, Object> firstOpen = data(service.openChest(USER_ID, chestGrantId, "chest-key-open-001"));
        Map<String, Object> replayOpen = data(service.openChest(USER_ID, chestGrantId, "chest-key-open-002"));

        assertEquals(true, firstOpen.get("opened"));
        assertEquals(false, firstOpen.get("replayed"));
        assertEquals(false, replayOpen.get("opened"));
        assertEquals(true, replayOpen.get("replayed"));
        assertNotNull(firstOpen.get("auditId"));
        assertEquals(firstOpen.get("auditId"), replayOpen.get("auditId"));
        assertEquals(1, repository.list("GAM_CHEST_OPEN", USER_ID).size());
        Map<?, ?> refreshedChest = (Map<?, ?>) listValue(data(service.chests(USER_ID)), "items").get(0);
        assertEquals("OPENED", refreshedChest.get("status"));
    }

    @Test
    void levelThresholdsAreMonotonicAndNonNegative() {
        assertEquals(0L, B4GamificationService.threshold(1));
        assertEquals(100L, B4GamificationService.threshold(2));
        assertEquals(300L, B4GamificationService.threshold(3));
        assertEquals(1, B4GamificationService.levelFor(0));
        assertEquals(2, B4GamificationService.levelFor(100));
        assertEquals(3, B4GamificationService.levelFor(300));
        assertTrue(B4GamificationService.levelFor(0) <= B4GamificationService.levelFor(300));
        assertTrue(B4GamificationService.threshold(3) >= 0L);
    }

    private Map<String, Object> submitCorrectRound(
            String sessionId, Map<String, Object> session, int zeroBasedRound, int sequence) {
        Map<?, ?> challenge = (Map<?, ?>) listValue(session, "challenges").get(zeroBasedRound);
        Map<String, Object> request = Map.of(
                "eventId", "game-event-" + sequence,
                "seq", sequence,
                "itemCode", challenge.get("itemCode"),
                "responseToken", challenge.get("challengeToken"));
        return data(service.submitGameEvent(USER_ID, sessionId, request, "game-event-key-" + sequence));
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> data(Map<String, Object> envelope) {
        return (Map<String, Object>) envelope.get("data");
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> profile(Map<String, Object> data) {
        return (Map<String, Object>) data.get("profile");
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> mapValue(Map<?, ?> source, String key) {
        return (Map<String, Object>) source.get(key);
    }

    @SuppressWarnings("unchecked")
    private static List<?> listValue(Map<?, ?> source, String key) {
        return (List<?>) source.get(key);
    }

    private static B4Exception assertB4Exception(String expectedCode, Executable executable) {
        B4Exception exception = assertThrows(B4Exception.class, executable);
        assertEquals(expectedCode, exception.code());
        return exception;
    }
}
