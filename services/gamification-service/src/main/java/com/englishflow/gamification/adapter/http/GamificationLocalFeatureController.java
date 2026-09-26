package com.englishflow.gamification.adapter.http;

import com.englishflow.gamification.application.GamificationApplicationService;
import com.englishflow.gamification.domain.GameCatalog;
import com.englishflow.gamification.domain.GameCatalog.GameDefinition;
import com.englishflow.gamification.domain.GamificationDomainException;
import com.englishflow.gamification.domain.RewardClaimReceipt;
import com.englishflow.gamification.domain.RewardGrantView;
import com.englishflow.gamification.domain.RewardListView;
import com.englishflow.gamification.domain.RewardProbabilityDisclosure;
import java.time.Instant;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;

/**
 * Local-real endpoints for B4 feature surfaces outside the XP aggregate. Historical JSON
 * snapshots remain in this service's schema, but they are not item entitlement facts.
 */
@RestController
@Profile("local-real")
@RequestMapping("/internal/v1/gamification")
public final class GamificationLocalFeatureController {

    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    private final GamificationPrincipalResolver principals;
    private final GamificationApplicationService service;

    public GamificationLocalFeatureController(JdbcTemplate jdbc, ObjectMapper mapper,
            GamificationPrincipalResolver principals, GamificationApplicationService service) {
        this.jdbc = jdbc;
        this.mapper = mapper;
        this.principals = principals;
        this.service = service;
    }

    @GetMapping("/quests")
    public Map<String, Object> quests(Authentication authentication) {
        principals.requireUser(authentication);
        // A static task counter or legacy JSON cannot establish a trusted learning fact.
        return map("items", List.of());
    }

    @PostMapping("/quests/{questId}/claim")
    public Map<String, Object> claimQuest(Authentication authentication, @PathVariable String questId,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        principals.requireRewardClaimer(authentication);
        // No verified completion -> reward ledger transaction or idempotent replay exists.
        throw GamificationDomainException.entitlementUnavailable();
    }

    @GetMapping("/achievements")
    public Map<String, Object> achievements(Authentication authentication) {
        principals.requireUser(authentication);
        return map("items", List.of());
    }

    @PutMapping("/achievements/{achievementCode}/showcase")
    public Map<String, Object> showcase(Authentication authentication, @PathVariable String achievementCode,
            @RequestBody(required = false) Map<String, Object> body) {
        principals.requireUser(authentication);
        throw GamificationDomainException.entitlementUnavailable();
    }

    @GetMapping("/chests")
    public Map<String, Object> chests(Authentication authentication) {
        String subject = principals.requireUser(authentication);
        RewardListView rewards = service.rewards(subject);
        List<Map<String, Object>> items = rewards.grants().stream().map(this::chest).toList();
        return map("items", items);
    }

    @GetMapping("/chests/{chestGrantId}/probability")
    public Map<String, Object> chestProbability(Authentication authentication,
            @PathVariable String chestGrantId) {
        String subject = principals.requireUser(authentication);
        RewardProbabilityDisclosure disclosure = service.rewardProbability(subject, chestGrantId);
        List<Map<String, Object>> tiers = disclosure.outcomes().stream()
                .map(item -> map("tierCode", item.outcomeCode(),
                        "weightBps", item.probability().movePointRight(4).intValue(),
                        "itemProbabilityMode", "SERVER_POOL"))
                .toList();
        return map("probability", map("chestGrantId", chestGrantId, "chestType", "LEARNING_REWARD",
                "probabilityVersion", disclosure.probabilityVersion(), "algorithmVersion", "SHA-256-DETERMINISTIC-V1",
                "tiers", tiers, "totalWeightBps", 10_000, "disclosedBeforeClaim", true));
    }

    @PostMapping("/chests/{chestGrantId}/open")
    public Map<String, Object> openChest(Authentication authentication, @PathVariable String chestGrantId,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        String subject = principals.requireRewardClaimer(authentication);
        RewardClaimReceipt claim = service.claimReward(subject, chestGrantId,
                idempotencyKey == null || idempotencyKey.isBlank() ? "local-chest-" + chestGrantId : idempotencyKey);
        return map("result", map("chestGrantId", chestGrantId, "opened", claim.claimed(),
                "replayed", claim.replayed(), "tierCode", claim.outcomeCode(),
                "probabilityVersion", claim.probabilityVersion()));
    }

    @GetMapping("/collection")
    public Map<String, Object> collection(Authentication authentication) {
        principals.requireUser(authentication);
        // Legacy feature JSON and a reward tier are not item ownership facts.
        return map("items", List.of());
    }

    @GetMapping("/catalog")
    public Map<String, Object> catalog(Authentication authentication) {
        principals.requireUser(authentication);
        return map("items", List.of());
    }

    @PostMapping("/catalog/{catalogItemId}/redeem")
    public Map<String, Object> redeem(Authentication authentication, @PathVariable String catalogItemId,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        principals.requireRewardClaimer(authentication);
        // There is no versioned price or atomic coin-debit -> item-grant binding yet.
        throw GamificationDomainException.entitlementUnavailable();
    }

    @GetMapping("/seasons/{seasonId}/rewards")
    public Map<String, Object> seasonRewards(Authentication authentication, @PathVariable String seasonId) {
        principals.requireUser(authentication);
        return map("seasonId", seasonId, "items", List.of());
    }

    @PutMapping("/streak/settings")
    public Map<String, Object> streakSettings(Authentication authentication, @RequestBody Map<String, Object> body) {
        String subject = principals.requireUser(authentication);
        String zone = String.valueOf(body == null ? "Asia/Shanghai" : body.getOrDefault("timeZone", "Asia/Shanghai"));
        ZoneId.of(zone);
        jdbc.update("INSERT INTO gamification_user_timezone(subject_id, time_zone, updated_at) VALUES (?, ?, UTC_TIMESTAMP(6)) "
                        + "ON DUPLICATE KEY UPDATE time_zone = VALUES(time_zone), updated_at = VALUES(updated_at)", subject, zone);
        saveState(subject, "streak-settings", map("timeZone", zone,
                "weekendProtectionEnabled", body != null && Boolean.TRUE.equals(body.get("weekendProtectionEnabled"))));
        return streak(subject, true, "SETTINGS_SAVED");
    }

    @PostMapping("/streak/rescue")
    public Map<String, Object> rescue(Authentication authentication, @RequestBody(required = false) Map<String, Object> body) {
        String subject = principals.requireUser(authentication);
        return streak(subject, false, "STREAK_NOT_BROKEN");
    }

    @GetMapping("/avatar/profile")
    public Map<String, Object> avatarProfile(Authentication authentication) {
        principals.requireUser(authentication);
        // Historical profile JSON is display data, not an owned avatar or loadout.
        return map("profile", map("renderMode", "2D_FALLBACK"));
    }

    @PutMapping("/avatar/profile")
    public Map<String, Object> saveAvatarProfile(Authentication authentication, @RequestBody Map<String, Object> body,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        principals.requireUser(authentication);
        // This path has no transactionally bound Idempotency-Key replay or
        // verified resource ownership. Keep old JSON untouched; device quality
        // remains a client-side preference until that owner chain is complete.
        throw GamificationDomainException.entitlementUnavailable();
    }

    @GetMapping("/avatar/items")
    public Map<String, Object> avatarItems(Authentication authentication) {
        principals.requireUser(authentication);
        return map("items", List.of());
    }

    @GetMapping("/avatar/loadouts")
    public Map<String, Object> avatarLoadouts(Authentication authentication) {
        principals.requireUser(authentication);
        return map("items", List.of());
    }

    @PutMapping("/avatar/loadouts/{loadoutId}")
    public Map<String, Object> saveLoadout(Authentication authentication, @PathVariable String loadoutId,
            @RequestBody(required = false) Map<String, Object> body) {
        principals.requireUser(authentication);
        throw GamificationDomainException.entitlementUnavailable();
    }

    @PostMapping("/avatar/loadouts/{loadoutId}/equip")
    public Map<String, Object> equipLoadout(Authentication authentication, @PathVariable String loadoutId) {
        principals.requireUser(authentication);
        throw GamificationDomainException.entitlementUnavailable();
    }

    @GetMapping("/avatar/resources")
    public Map<String, Object> avatarResources(Authentication authentication) {
        principals.requireUser(authentication);
        // No verified resource manifest is attached to the current local catalog.
        return map("fallbackMode", "2D_FALLBACK", "performanceTiers",
                List.of("Ultra", "High", "Medium", "Performance"));
    }

    @GetMapping("/avatar/study-space")
    public Map<String, Object> studySpace(Authentication authentication) {
        principals.requireUser(authentication);
        return map("items", List.of(), "placements", List.of());
    }

    @PutMapping("/avatar/study-space")
    public Map<String, Object> saveStudySpace(Authentication authentication, @RequestBody Map<String, Object> body) {
        principals.requireUser(authentication);
        throw GamificationDomainException.entitlementUnavailable();
    }

    @GetMapping("/games/catalog")
    public Map<String, Object> gameCatalog(Authentication authentication) {
        String subject = principals.requireUser(authentication);
        Map<String, Object> current = state(subject, "game-catalog", defaultGameCatalog());
        // A persisted snapshot may predate the release gate.  Server-owned
        // registry facts always win over that snapshot.
        current.put("items", GameCatalog.entries().stream().map(this::gameCatalogItem).toList());
        return current;
    }

    @PostMapping("/games/sessions")
    public ResponseEntity<Map<String, Object>> createGame(Authentication authentication,
            @RequestBody Map<String, Object> body) {
        String subject = principals.requireUser(authentication);
        Object rawCode = body == null ? null : body.get("gameCode");
        if (!(rawCode instanceof String value) || value.isBlank()) {
            return gameError(HttpStatus.BAD_REQUEST, "GAME_CODE_INVALID", "gameCode is required", null);
        }
        String code = value.trim();
        GameDefinition definition;
        try {
            definition = GameCatalog.requireEnabled(code);
        } catch (GameCatalog.InvalidGameCodeException exception) {
            return gameError(HttpStatus.BAD_REQUEST, "GAME_CODE_INVALID", "gameCode is not in the B4 registry", null);
        } catch (GameCatalog.GameNotAvailableException exception) {
            return gameError(HttpStatus.CONFLICT, "GAME_NOT_AVAILABLE",
                    "game is not enabled for its release phase", exception.definition().releasePhase().name());
        }
        String sessionId = "game-" + UUID.randomUUID();
        Map<String, Object> session = newGameSession(sessionId, code,
                body.get("performanceTier") == null ? "Medium" : String.valueOf(body.get("performanceTier")));
        saveGame(subject, sessionId, code, "RUNNING", session);
        return ResponseEntity.status(201).body(session);
    }

    private static ResponseEntity<Map<String, Object>> gameError(HttpStatus status, String code,
            String message, String releasePhase) {
        return ResponseEntity.status(status).body(map("code", code, "message", message,
                "retryable", false, "releasePhase", releasePhase));
    }

    @GetMapping("/games/sessions/{sessionId}")
    public Map<String, Object> getGame(Authentication authentication, @PathVariable String sessionId) {
        return loadGame(principals.requireUser(authentication), sessionId);
    }

    @PostMapping("/games/sessions/{sessionId}/events")
    public Map<String, Object> gameEvent(Authentication authentication, @PathVariable String sessionId,
            @RequestBody Map<String, Object> body) {
        String subject = principals.requireUser(authentication);
        Map<String, Object> session = loadGame(subject, sessionId);
        int seq = ((Number) session.getOrDefault("seq", 0)).intValue() + 1;
        session.put("seq", seq);
        session.put("attemptCount", ((Number) session.getOrDefault("attemptCount", 0)).intValue() + 1);
        session.put("lastItemCode", body.get("itemCode"));
        saveGame(subject, sessionId, String.valueOf(session.get("gameCode")), "RUNNING", session);
        return session;
    }

    @PostMapping("/games/sessions/{sessionId}/pause")
    public Map<String, Object> pauseGame(Authentication authentication, @PathVariable String sessionId) {
        return changeGame(principals.requireUser(authentication), sessionId, "PAUSED");
    }

    @PostMapping("/games/sessions/{sessionId}/resume")
    public Map<String, Object> resumeGame(Authentication authentication, @PathVariable String sessionId) {
        return changeGame(principals.requireUser(authentication), sessionId, "RUNNING");
    }

    @PostMapping("/games/sessions/{sessionId}/finish")
    public Map<String, Object> finishGame(Authentication authentication, @PathVariable String sessionId) {
        String subject = principals.requireUser(authentication);
        Map<String, Object> session = loadGame(subject, sessionId);
        // Legacy sessions may contain client-submitted events, but no verified
        // answer fact. A counter cannot establish accuracy or reward eligibility.
        markUnverifiedGameFinish(session);
        saveGame(subject, sessionId, String.valueOf(session.get("gameCode")), "COMPLETED", session);
        return session;
    }

    static void markUnverifiedGameFinish(Map<String, Object> session) {
        session.put("status", "COMPLETED");
        session.put("accuracyPercent", 0);
        session.put("completionPercent", 0);
        session.put("serverScore", 0);
        session.put("passed", false);
        session.put("rewardEligible", false);
    }

    private Map<String, Object> changeGame(String subject, String sessionId, String state) {
        Map<String, Object> session = loadGame(subject, sessionId);
        session.put("status", state);
        saveGame(subject, sessionId, String.valueOf(session.get("gameCode")), state, session);
        return session;
    }

    private Map<String, Object> loadGame(String subject, String sessionId) {
        String json = jdbc.queryForObject("SELECT session_json FROM gamification_game_session WHERE subject_id = ? AND session_id = ?",
                String.class, subject, sessionId);
        return decodeMap(json);
    }

    private void saveGame(String subject, String sessionId, String code, String state, Map<String, Object> session) {
        String json = encode(session);
        jdbc.update("INSERT INTO gamification_game_session(session_id, subject_id, game_code, state, session_json, created_at, updated_at) "
                        + "VALUES (?, ?, ?, ?, ?, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)) "
                        + "ON DUPLICATE KEY UPDATE state = VALUES(state), session_json = VALUES(session_json), updated_at = UTC_TIMESTAMP(6)",
                sessionId, subject, code, state, json);
    }

    private Map<String, Object> streak(String subject, boolean settingsSaved, String reason) {
        var streak = service.streak(subject);
        return map("timeZone", streak.timeZone(), "latestActiveDate", streak.latestActiveDate(),
                "currentStreak", streak.currentStreak(), "longestStreak", streak.longestStreak(),
                "activeDateCount", streak.activeDateCount(), "weekendProtectionEnabled", false,
                "status", settingsSaved ? "ACTIVE" : reason);
    }

    private Map<String, Object> state(String subject, String feature, Map<String, Object> fallback) {
        try {
            String json = jdbc.queryForObject("SELECT state_json FROM gamification_feature_state WHERE subject_id = ? AND feature_key = ?",
                    String.class, subject, feature);
            return decodeMap(json);
        } catch (org.springframework.dao.EmptyResultDataAccessException ignored) {
            saveState(subject, feature, fallback);
            return fallback;
        }
    }

    private void saveState(String subject, String feature, Map<String, Object> value) {
        jdbc.update("INSERT INTO gamification_feature_state(subject_id, feature_key, version, state_json, updated_at) "
                        + "VALUES (?, ?, 1, ?, UTC_TIMESTAMP(6)) "
                        + "ON DUPLICATE KEY UPDATE version = version + 1, state_json = VALUES(state_json), updated_at = UTC_TIMESTAMP(6)",
                subject, feature, encode(value));
    }

    private Map<String, Object> decodeMap(String json) {
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> decoded = (Map<String, Object>) mapper.readValue(json, Map.class);
            return new LinkedHashMap<>(decoded);
        } catch (JacksonException | ClassCastException exception) {
            throw new IllegalStateException("gamification feature state is invalid", exception);
        }
    }

    private String encode(Object value) {
        try {
            return mapper.writeValueAsString(value);
        } catch (JacksonException exception) {
            throw new IllegalStateException("gamification feature state could not be encoded", exception);
        }
    }

    private static List<Map<String, Object>> listMaps(Object value) {
        if (!(value instanceof List<?> list)) return new ArrayList<>();
        List<Map<String, Object>> result = new ArrayList<>();
        for (Object item : list) if (item instanceof Map<?, ?> source) result.add(castMap(source));
        return result;
    }

    private static Map<String, Object> castMap(Map<?, ?> source) {
        Map<String, Object> result = new LinkedHashMap<>();
        source.forEach((key, value) -> result.put(String.valueOf(key), value));
        return result;
    }

    private static Map<String, Object> map(Object... values) {
        Map<String, Object> result = new LinkedHashMap<>();
        for (int index = 0; index < values.length; index += 2) result.put(String.valueOf(values[index]), values[index + 1]);
        return result;
    }

    private Map<String, Object> chest(RewardGrantView grant) {
        return map("chestGrantId", grant.grantId(), "chestType", "LEARNING_REWARD", "kind", "FREE_LEARNING_REWARD",
                "status", "CLAIMED".equals(grant.status()) ? "OPENED" : "GRANTED", "probabilityVersion", grant.probabilityVersion(),
                "createdAt", grant.grantedAt());
    }

    private static Map<String, Object> defaultGameCatalog() {
        return map("items", GameCatalog.entries().stream().map(entry -> map(
                "gameCode", entry.gameCode(), "releasePhase", entry.releasePhase().name(),
                "enabled", entry.enabled(), "maxMinutes", entry.maxMinutes(),
                "pauseLimitMinutes", entry.pauseLimitMinutes(),
                "passAccuracyPercent", entry.passAccuracyPercent(),
                "passCompletionPercent", entry.passCompletionPercent())).toList());
    }

    private Map<String, Object> gameCatalogItem(GameDefinition entry) {
        return map("gameCode", entry.gameCode(), "releasePhase", entry.releasePhase().name(),
                "enabled", entry.enabled(), "maxMinutes", entry.maxMinutes(),
                "pauseLimitMinutes", entry.pauseLimitMinutes(),
                "passAccuracyPercent", entry.passAccuracyPercent(),
                "passCompletionPercent", entry.passCompletionPercent());
    }

    private static Map<String, Object> newGameSession(String sessionId, String gameCode, String performanceTier) {
        List<Map<String, Object>> challenges = List.of(
                map("roundNo", 1, "itemCode", "vocab-foundation-001", "challengeToken", "local-token-001"),
                map("roundNo", 2, "itemCode", "vocab-foundation-002", "challengeToken", "local-token-002"),
                map("roundNo", 3, "itemCode", "vocab-foundation-003", "challengeToken", "local-token-003"));
        return map("sessionId", sessionId, "gameCode", gameCode, "performanceTier", performanceTier,
                "status", "RUNNING", "seq", 0, "attemptCount", 0, "createdAt", Instant.now().toString(),
                "maxMinutes", 10, "pauseLimitMinutes", 2, "challenges", challenges);
    }
}
