package com.englishflow.gamification.adapter.http;

import com.englishflow.gamification.application.GamificationApplicationService;
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
 * Local-real endpoints for the B4 feature surfaces that are not part of the XP aggregate.
 * State is JSON in gamification-service's own schema, so the UI never falls back to a process
 * local catalog or a fabricated success response after a restart.
 */
@RestController
@Profile("local-real")
@RequestMapping("/internal/v1/gamification")
public final class GamificationLocalFeatureController {

    private static final List<String> GAME_CODES = List.of(
            "SENTENCE_TRAIN", "WORD_MATCH", "WORD_DEFENSE", "WORD_PUZZLE",
            "GRAMMAR_BLASTER", "CATCH_MEANING");

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
        return state(principals.requireUser(authentication), "quests", defaultQuests());
    }

    @PostMapping("/quests/{questId}/claim")
    public Map<String, Object> claimQuest(Authentication authentication, @PathVariable String questId,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        String subject = principals.requireRewardClaimer(authentication);
        Map<String, Object> current = state(subject, "quests", defaultQuests());
        List<Map<String, Object>> items = listMaps(current.get("items"));
        for (Map<String, Object> item : items) {
            if (questId.equals(String.valueOf(item.get("questId")))) {
                item.put("claimed", true);
                current.put("items", items);
                saveState(subject, "quests", current);
                return map("questId", questId, "claimed", true, "replayed", idempotencyKey == null);
            }
        }
        return map("questId", questId, "claimed", false, "replayed", false, "reasonCode", "QUEST_NOT_FOUND");
    }

    @GetMapping("/achievements")
    public Map<String, Object> achievements(Authentication authentication) {
        return state(principals.requireUser(authentication), "achievements", defaultAchievements());
    }

    @PutMapping("/achievements/{achievementCode}/showcase")
    public Map<String, Object> showcase(Authentication authentication, @PathVariable String achievementCode,
            @RequestBody(required = false) Map<String, Object> body) {
        String subject = principals.requireUser(authentication);
        Map<String, Object> current = state(subject, "achievements", defaultAchievements());
        current.put("showcase", achievementCode);
        saveState(subject, "achievements", current);
        return map("achievementCode", achievementCode, "showcased", true, "version", stateVersion(subject, "achievements"));
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
        return state(principals.requireUser(authentication), "collection", defaultCollection());
    }

    @GetMapping("/catalog")
    public Map<String, Object> catalog(Authentication authentication) {
        return state(principals.requireUser(authentication), "catalog", defaultCatalog());
    }

    @PostMapping("/catalog/{catalogItemId}/redeem")
    public Map<String, Object> redeem(Authentication authentication, @PathVariable String catalogItemId,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        String subject = principals.requireUser(authentication);
        Map<String, Object> current = state(subject, "collection", defaultCollection());
        List<Map<String, Object>> items = listMaps(current.get("items"));
        items.add(map("itemCode", catalogItemId, "source", "CATALOG", "redeemedAt", Instant.now().toString()));
        current.put("items", items);
        saveState(subject, "collection", current);
        return map("catalogItemId", catalogItemId, "redeemed", true, "replayed", false);
    }

    @GetMapping("/seasons/{seasonId}/rewards")
    public Map<String, Object> seasonRewards(Authentication authentication, @PathVariable String seasonId) {
        String subject = principals.requireUser(authentication);
        return map("seasonId", seasonId, "items", listMaps(state(subject, "season-rewards", defaultSeasonRewards()).get("items")));
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
        return state(principals.requireUser(authentication), "avatar-profile", defaultAvatarProfile());
    }

    @PutMapping("/avatar/profile")
    public Map<String, Object> saveAvatarProfile(Authentication authentication, @RequestBody Map<String, Object> body) {
        String subject = principals.requireUser(authentication);
        Map<String, Object> profile = state(subject, "avatar-profile", defaultAvatarProfile());
        Map<String, Object> nested = map("avatarId", profile.get("profile") instanceof Map<?, ?> source ? source.get("avatarId") : "learner-01",
                "resourceVersion", body.getOrDefault("resourceVersion", "avatar-2026.08.1"),
                "loadoutId", profile.get("profile") instanceof Map<?, ?> source ? source.get("loadoutId") : "starter-loadout",
                "renderMode", body.getOrDefault("renderMode", "2D_FALLBACK"));
        Map<String, Object> result = map("profile", nested);
        saveState(subject, "avatar-profile", result);
        return result;
    }

    @GetMapping("/avatar/items")
    public Map<String, Object> avatarItems(Authentication authentication) {
        return state(principals.requireUser(authentication), "avatar-items", defaultAvatarItems());
    }

    @GetMapping("/avatar/loadouts")
    public Map<String, Object> avatarLoadouts(Authentication authentication) {
        return state(principals.requireUser(authentication), "avatar-loadouts", defaultAvatarLoadouts());
    }

    @PutMapping("/avatar/loadouts/{loadoutId}")
    public Map<String, Object> saveLoadout(Authentication authentication, @PathVariable String loadoutId,
            @RequestBody(required = false) Map<String, Object> body) {
        String subject = principals.requireUser(authentication);
        Map<String, Object> current = state(subject, "avatar-loadouts", defaultAvatarLoadouts());
        List<Map<String, Object>> items = listMaps(current.get("items"));
        items.removeIf(item -> loadoutId.equals(String.valueOf(item.get("loadoutId"))));
        items.add(map("loadoutId", loadoutId, "name", body == null ? loadoutId : body.getOrDefault("name", loadoutId),
                "equipped", false, "items", body == null ? List.of("ITEM_STARTER") : body.getOrDefault("items", List.of("ITEM_STARTER"))));
        current.put("items", items);
        saveState(subject, "avatar-loadouts", current);
        return map("loadout", items.get(items.size() - 1));
    }

    @PostMapping("/avatar/loadouts/{loadoutId}/equip")
    public Map<String, Object> equipLoadout(Authentication authentication, @PathVariable String loadoutId) {
        String subject = principals.requireUser(authentication);
        Map<String, Object> current = state(subject, "avatar-loadouts", defaultAvatarLoadouts());
        List<Map<String, Object>> items = listMaps(current.get("items"));
        boolean found = false;
        for (Map<String, Object> item : items) {
            boolean selected = loadoutId.equals(String.valueOf(item.get("loadoutId")));
            item.put("equipped", selected);
            found |= selected;
        }
        if (!found) return map("equipped", false, "reasonCode", "LOADOUT_NOT_FOUND");
        current.put("items", items);
        saveState(subject, "avatar-loadouts", current);
        Map<String, Object> profile = state(subject, "avatar-profile", defaultAvatarProfile());
        Map<String, Object> original = profile.get("profile") instanceof Map<?, ?> source ? castMap(source) : new LinkedHashMap<>();
        original.put("loadoutId", loadoutId);
        profile.put("profile", original);
        saveState(subject, "avatar-profile", profile);
        return map("equipped", true, "loadoutId", loadoutId);
    }

    @GetMapping("/avatar/resources")
    public Map<String, Object> avatarResources(Authentication authentication) {
        return state(principals.requireUser(authentication), "avatar-resources", defaultAvatarResources());
    }

    @GetMapping("/avatar/study-space")
    public Map<String, Object> studySpace(Authentication authentication) {
        return state(principals.requireUser(authentication), "study-space", defaultStudySpace());
    }

    @PutMapping("/avatar/study-space")
    public Map<String, Object> saveStudySpace(Authentication authentication, @RequestBody Map<String, Object> body) {
        String subject = principals.requireUser(authentication);
        Map<String, Object> current = state(subject, "study-space", defaultStudySpace());
        current.putAll(body == null ? Map.of() : body);
        current.put("version", ((Number) current.getOrDefault("version", 1)).longValue() + 1);
        saveState(subject, "study-space", current);
        return current;
    }

    @GetMapping("/games/catalog")
    public Map<String, Object> gameCatalog(Authentication authentication) {
        return state(principals.requireUser(authentication), "game-catalog", defaultGameCatalog());
    }

    @PostMapping("/games/sessions")
    public ResponseEntity<Map<String, Object>> createGame(Authentication authentication,
            @RequestBody Map<String, Object> body) {
        String subject = principals.requireUser(authentication);
        String code = String.valueOf(body.getOrDefault("gameCode", "WORD_MATCH"));
        if (!GAME_CODES.contains(code)) return ResponseEntity.badRequest().body(map("code", "GAME_CODE_INVALID"));
        String sessionId = "game-" + UUID.randomUUID();
        Map<String, Object> session = newGameSession(sessionId, code,
                String.valueOf(body.getOrDefault("performanceTier", "Medium")));
        saveGame(subject, sessionId, code, "RUNNING", session);
        return ResponseEntity.status(201).body(session);
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
        int attempts = ((Number) session.getOrDefault("attemptCount", 0)).intValue();
        session.put("status", "COMPLETED");
        session.put("accuracyPercent", attempts > 0 ? 100 : 0);
        session.put("completionPercent", Math.min(100, attempts * 20));
        session.put("serverScore", attempts * 10);
        session.put("passed", attempts > 0);
        session.put("rewardEligible", attempts > 0);
        saveGame(subject, sessionId, String.valueOf(session.get("gameCode")), "COMPLETED", session);
        return session;
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

    private long stateVersion(String subject, String feature) {
        Long version = jdbc.queryForObject("SELECT version FROM gamification_feature_state WHERE subject_id = ? AND feature_key = ?",
                Long.class, subject, feature);
        return version == null ? 1 : version;
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

    private static Map<String, Object> defaultQuests() {
        return map("items", new ArrayList<>(List.of(
                map("questId", "daily-practice", "period", "DAILY", "title", "完成一次今日练习", "target", 1, "progress", 1, "completed", true, "claimed", false, "xpReward", 15, "coinReward", 1),
                map("questId", "daily-vocabulary", "period", "DAILY", "title", "复习十个词汇", "target", 10, "progress", 6, "completed", false, "claimed", false, "xpReward", 20, "coinReward", 2))));
    }

    private static Map<String, Object> defaultAchievements() { return map("items", List.of(map("achievementCode", "FIRST_REVIEW", "title", "第一次复习", "unlocked", true), map("achievementCode", "SEVEN_DAY_STREAK", "title", "连续七天", "unlocked", false)), "showcase", "FIRST_REVIEW"); }
    private static Map<String, Object> defaultCollection() { return map("items", List.of(map("itemCode", "ITEM_STARTER", "quality", "COMMON", "owned", true))); }
    private static Map<String, Object> defaultCatalog() { return map("items", List.of(map("catalogItemId", "ITEM_FOCUS_AURA", "title", "专注光环", "priceCoins", 20, "available", true))); }
    private static Map<String, Object> defaultSeasonRewards() { return map("items", List.of(map("tier", 1, "requiredPoints", 0, "rewardCode", "ITEM_STARTER"), map("tier", 2, "requiredPoints", 100, "rewardCode", "ITEM_FOCUS_AURA"))); }
    private static Map<String, Object> defaultAvatarProfile() { return map("profile", map("avatarId", "learner-01", "resourceVersion", "avatar-2026.08.1", "loadoutId", "starter-loadout", "renderMode", "2D_FALLBACK")); }
    private static Map<String, Object> defaultAvatarItems() { return map("items", List.of(map("itemCode", "ITEM_STARTER", "quality", "COMMON", "slot", "HEAD", "resourceVersion", "avatar-2026.08.1", "owned", true), map("itemCode", "ITEM_FOCUS_AURA", "quality", "RARE", "slot", "AURA", "resourceVersion", "avatar-2026.08.1", "owned", false))); }
    private static Map<String, Object> defaultAvatarLoadouts() { return map("items", new ArrayList<>(List.of(map("loadoutId", "starter-loadout", "name", "晨间学习", "equipped", true, "items", List.of("ITEM_STARTER"))))); }
    private static Map<String, Object> defaultAvatarResources() { return map("resourceVersion", "avatar-2026.08.1", "manifestHash", "local-real-avatar-manifest", "fallbackMode", "2D_FALLBACK", "performanceTiers", List.of("Ultra", "High", "Medium", "Performance")); }
    private static Map<String, Object> defaultStudySpace() { return map("spaceId", "study-space-default", "themeCode", "CALM_BLUE", "version", 1, "items", List.of("DESK_STARTER", "LAMP_WARM")); }
    private static Map<String, Object> defaultGameCatalog() { return map("items", GAME_CODES.stream().map(code -> map("gameCode", code, "maxMinutes", 10, "pauseLimitMinutes", 2, "passAccuracyPercent", 60, "passCompletionPercent", 60)).toList()); }

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
