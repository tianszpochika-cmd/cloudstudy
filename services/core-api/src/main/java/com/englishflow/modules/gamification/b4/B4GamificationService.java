package com.englishflow.modules.gamification.b4;

import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.DateTimeException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import com.englishflow.modules.b4.B4DurableRepository;
import com.englishflow.modules.b4.B4Exception;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public final class B4GamificationService {
    private static final String RULE_VERSION = "GAM_RULE_2026_08_20_01";
    private static final Set<String> LEARNING_SOURCES = Set.of(
            "LESSON_COMPLETE", "REVIEW_BATCH_COMPLETE", "READING_COMPLETE", "LISTENING_COMPLETE",
            "WRITING_SUBMISSION", "CHECKPOINT_PASS", "GAME_SESSION_QUALIFIED", "DAILY_GOAL_REACHED",
            "QUEST_COMPLETED", "ACHIEVEMENT_UNLOCKED", "STREAK_MILESTONE");
    private static final List<String> GAME_CODES = List.of(
            "SENTENCE_TRAIN", "WORD_MATCH", "WORD_DEFENSE", "WORD_PUZZLE", "GRAMMAR_BLASTER", "CATCH_MEANING");
    private static final List<String> CHEST_TIERS = List.of("COMMON", "RARE", "EPIC", "LEGENDARY");
    private static final Map<String, Integer> XP_REWARDS = Map.ofEntries(
            Map.entry("LESSON_COMPLETE", 20), Map.entry("REVIEW_BATCH_COMPLETE", 15), Map.entry("READING_COMPLETE", 20),
            Map.entry("LISTENING_COMPLETE", 20), Map.entry("WRITING_SUBMISSION", 25), Map.entry("CHECKPOINT_PASS", 200),
            Map.entry("GAME_SESSION_QUALIFIED", 10), Map.entry("DAILY_GOAL_REACHED", 50), Map.entry("QUEST_COMPLETED", 40),
            Map.entry("ACHIEVEMENT_UNLOCKED", 50), Map.entry("STREAK_MILESTONE", 50));
    private static final Map<String, Integer> COIN_REWARDS = Map.ofEntries(
            Map.entry("LESSON_COMPLETE", 1), Map.entry("REVIEW_BATCH_COMPLETE", 1), Map.entry("READING_COMPLETE", 1),
            Map.entry("LISTENING_COMPLETE", 1), Map.entry("WRITING_SUBMISSION", 2), Map.entry("CHECKPOINT_PASS", 20),
            Map.entry("GAME_SESSION_QUALIFIED", 2), Map.entry("DAILY_GOAL_REACHED", 5), Map.entry("QUEST_COMPLETED", 4),
            Map.entry("ACHIEVEMENT_UNLOCKED", 5), Map.entry("STREAK_MILESTONE", 10));

    private final Clock clock;
    private final B4DurableRepository durableRepository;
    private final Map<Long, Account> accounts = new ConcurrentHashMap<>();
    private final Map<Long, ZoneId> timeZones = new ConcurrentHashMap<>();
    private final Map<Long, Boolean> weekendProtection = new ConcurrentHashMap<>();
    private final Map<Long, LocalDate> lastLearningDay = new ConcurrentHashMap<>();
    private final Map<Long, Integer> streaks = new ConcurrentHashMap<>();
    private final Map<String, Integer> dailyCounters = new ConcurrentHashMap<>();
    private final Map<String, Map<String, Object>> idempotency = new ConcurrentHashMap<>();
    private final Map<String, String> idempotencyFingerprints = new ConcurrentHashMap<>();
    private final Map<String, Map<String, Object>> questStates = new ConcurrentHashMap<>();
    private final Map<Long, Set<String>> showcasedAchievements = new ConcurrentHashMap<>();
    private final Map<String, ChestGrant> chestGrants = new ConcurrentHashMap<>();
    private final Map<String, GameSession> gameSessions = new ConcurrentHashMap<>();
    private final Map<Long, Integer> gameStartsToday = new ConcurrentHashMap<>();
    private final Map<Long, Set<String>> ownedItems = new ConcurrentHashMap<>();
    private final Map<Long, Map<String, Object>> avatarProfiles = new ConcurrentHashMap<>();
    private final Map<Long, Map<String, Object>> studySpaces = new ConcurrentHashMap<>();

    public B4GamificationService() {
        this(Clock.systemUTC(), new com.englishflow.modules.b4.InMemoryB4DurableRepository());
    }

    @Autowired
    public B4GamificationService(B4DurableRepository durableRepository) {
        this(Clock.systemUTC(), durableRepository);
    }

    public B4GamificationService(Clock clock, B4DurableRepository durableRepository) {
        this.clock = clock;
        this.durableRepository = durableRepository;
    }

    public synchronized Map<String, Object> profile(long userId) {
        Account account = account(userId);
        ensureChest(userId);
        return envelope(map("profile", profileView(userId, account), "featureFlags", featureFlags(),
                "ruleVersion", RULE_VERSION));
    }

    public synchronized Map<String, Object> ledger(long userId, int limit) {
        List<Map<String, Object>> entries = durableRepository.list("GAM_XP", userId).stream()
                .limit(safeLimit(limit)).<Map<String, Object>>map(fact -> new LinkedHashMap<>(fact.payload())).toList();
        return envelope(map("items", entries, "nextCursor", null, "hasMore", false));
    }

    public synchronized Map<String, Object> settleLearningEvent(long userId, Map<String, Object> body, String key) {
        requireKey(key);
        rejectClientOwnedFields(body, Set.of("deltaXp", "deltaCoins", "score", "randomSeed", "probabilityVersion", "finalScore"));
        return idempotent(userId, "settle", key, body, () -> {
            String sourceType = requiredText(body, "sourceType");
            if (!LEARNING_SOURCES.contains(sourceType)) throw error("GAM_SOURCE_INVALID", "learning source is not eligible", 400, false);
            String eventId = requiredText(body, "sourceEventId");
            String sourceKey = userId + ":source:" + eventId;
            if (idempotency.containsKey(sourceKey)) return idempotency.get(sourceKey);
            String counterKey = userId + ":" + today(userId) + ":" + sourceType;
            int currentCount = dailyCounters.getOrDefault(counterKey, 0);
            if ("GAME_SESSION_QUALIFIED".equals(sourceType) && currentCount >= 3) {
                return envelope(map("accepted", false, "reasonCode", "DAILY_GAME_REWARD_CAP", "ruleVersion", RULE_VERSION));
            }
            if (currentCount >= 60 && !"CHECKPOINT_PASS".equals(sourceType)) {
                return envelope(map("accepted", false, "reasonCode", "DAILY_REWARD_CAP", "ruleVersion", RULE_VERSION));
            }
            int deltaXp = XP_REWARDS.getOrDefault(sourceType, 0);
            int deltaCoins = COIN_REWARDS.getOrDefault(sourceType, 0);
            Account account = account(userId);
            account.xp += deltaXp;
            account.coins += deltaCoins;
            dailyCounters.put(counterKey, currentCount + 1);
            markLearningDay(userId, today(userId));
            Map<String, Object> result = envelope(map("accepted", true, "sourceType", sourceType,
                    "sourceEventId", eventId, "xp", deltaXp, "coins", deltaCoins,
                    "profile", profileView(userId, account), "ruleVersion", RULE_VERSION));
            idempotency.put(sourceKey, result);
            durableRepository.append(new B4DurableRepository.Fact("GAM_XP", eventId, userId,
                    requestId(result), key, clock.instant(), map("sourceType", sourceType, "sourceEventId", eventId,
                    "deltaXp", deltaXp, "deltaCoins", deltaCoins, "ruleVersion", RULE_VERSION)));
            durableRepository.append(new B4DurableRepository.Fact("GAM_CURRENCY", eventId, userId,
                    requestId(result), key, clock.instant(), map("sourceType", sourceType, "sourceEventId", eventId,
                    "deltaCoins", deltaCoins, "ruleVersion", RULE_VERSION)));
            return result;
        });
    }

    public synchronized Map<String, Object> streak(long userId) {
        return envelope(map("currentStreak", streaks.getOrDefault(userId, 0), "lastValidDate", lastLearningDay.get(userId),
                "timeZone", timeZones.getOrDefault(userId, ZoneId.of("Asia/Shanghai")).getId(),
                "weekendProtectionEnabled", weekendProtection.getOrDefault(userId, false),
                "status", streakStatus(userId)));
    }

    public synchronized Map<String, Object> saveStreakSettings(long userId, Map<String, Object> body, String key) {
        requireKey(key);
        return idempotent(userId, "streak-settings", key, body, () -> {
            String zone = text(body.get("timeZone"), "Asia/Shanghai");
            try { timeZones.put(userId, ZoneId.of(zone)); }
            catch (DateTimeException exception) { throw error("GAM_TIME_ZONE_INVALID", "timeZone must be an IANA zone", 400, false); }
            Object protection = body.get("weekendProtectionEnabled");
            if (protection != null && !(protection instanceof Boolean)) throw error("GAM_SCHEMA_INVALID", "weekendProtectionEnabled must be boolean", 400, false);
            weekendProtection.put(userId, Boolean.TRUE.equals(protection));
            durableRepository.append(new B4DurableRepository.Fact("GAM_STREAK_SETTING", String.valueOf(userId), userId,
                    "req_" + UUID.randomUUID(), key, clock.instant(), map("timeZone", zone, "weekendProtectionEnabled", weekendProtection.get(userId))));
            return streak(userId);
        });
    }

    public synchronized Map<String, Object> rescueStreak(long userId, Map<String, Object> body, String key) {
        requireKey(key);
        return idempotent(userId, "streak-rescue", key, body, () -> {
            if (streaks.getOrDefault(userId, 0) == 0) throw error("GAM_STREAK_NOT_RESCUABLE", "there is no recent streak to rescue", 409, false);
            markLearningDay(userId, today(userId));
            return envelope(map("rescued", true, "rescueMethod", text(body.get("rescueMethod"), "CHALLENGE"), "streak", streak(userId).get("data")));
        });
    }

    public synchronized Map<String, Object> quests(long userId) {
        List<Map<String, Object>> items = new ArrayList<>();
        items.add(quest(userId, "DAILY_20_MIN", "DAILY", "完成 20 分钟学习", 20, 20, 40));
        items.add(quest(userId, "DAILY_REVIEW_10", "DAILY", "完成 10 个复习对象", 10, 10, 40));
        items.add(quest(userId, "WEEKLY_FOCUS_5", "WEEKLY", "完成 5 次专注学习", 5, 5, 100));
        return envelope(map("items", items, "serverTime", clock.instant().toString()));
    }

    public synchronized Map<String, Object> claimQuest(long userId, String questId, String key) {
        requireKey(key);
        return idempotent(userId, "quest-claim:" + questId, key, map("questId", questId), () -> {
            Map<String, Object> state = questStates.get(userId + ":" + questId);
            if (state == null || !Boolean.TRUE.equals(state.get("completed"))) throw error("GAM_QUEST_NOT_COMPLETED", "quest is not completed", 409, false);
            if (Boolean.TRUE.equals(state.get("claimed"))) return envelope(map("claimed", false, "reasonCode", "ALREADY_CLAIMED"));
            state.put("claimed", true);
            Account account = account(userId);
            account.xp += intValue(state.get("xpReward"), "xpReward");
            account.coins += intValue(state.get("coinReward"), "coinReward");
            return envelope(map("claimed", true, "questId", questId, "profile", profileView(userId, account)));
        });
    }

    public synchronized Map<String, Object> achievements(long userId) {
        List<Map<String, Object>> items = new ArrayList<>();
        for (int index = 1; index <= 56; index++) {
            String code = "ACH_%02d".formatted(index);
            items.add(map("achievementCode", code, "title", "星际成就 " + index,
                    "status", index == 1 || account(userId).xp >= index * 100 ? "UNLOCKED" : "LOCKED",
                    "showcased", showcasedAchievements.getOrDefault(userId, Set.of()).contains(code)));
        }
        return envelope(map("items", items, "total", items.size()));
    }

    public synchronized Map<String, Object> showcaseAchievement(long userId, String code, Map<String, Object> body, String key) {
        requireKey(key);
        if (!code.matches("ACH_[0-9]{2}")) throw error("GAM_ACHIEVEMENT_NOT_FOUND", "achievement does not exist", 404, false);
        return idempotent(userId, "achievement-showcase:" + code, key, body, () -> {
            boolean visible = Boolean.TRUE.equals(body.get("showcased"));
            showcasedAchievements.computeIfAbsent(userId, ignored -> new LinkedHashSet<>());
            if (visible) showcasedAchievements.get(userId).add(code); else showcasedAchievements.get(userId).remove(code);
            return envelope(map("achievementCode", code, "showcased", visible));
        });
    }

    public synchronized Map<String, Object> chests(long userId) {
        ensureChest(userId);
        return envelope(map("items", chestGrants.values().stream().filter(grant -> grant.userId == userId)
                .map(ChestGrant::view).toList(), "probabilityVersion", "CHEST_PROB_2026_08_20_01"));
    }

    public synchronized Map<String, Object> chestProbability(long userId, String chestGrantId) {
        ChestGrant grant = ownedChest(userId, chestGrantId);
        return envelope(map("chestGrantId", chestGrantId, "probabilityVersion", grant.probabilityVersion,
                "tiers", List.of(map("tierCode", "COMMON", "weightBps", 7000), map("tierCode", "RARE", "weightBps", 2000),
                        map("tierCode", "EPIC", "weightBps", 800), map("tierCode", "LEGENDARY", "weightBps", 200)),
                "totalWeightBps", 10000));
    }

    public synchronized Map<String, Object> openChest(long userId, String chestGrantId, String key) {
        requireKey(key);
        return idempotent(userId, "chest-open:" + chestGrantId, key, map("chestGrantId", chestGrantId), () -> {
            ChestGrant grant = ownedChest(userId, chestGrantId);
            if (grant.opened) return envelope(map("opened", false, "reasonCode", "ALREADY_OPENED", "itemCode", grant.itemCode));
            int roll = hmacRoll(userId + ":" + chestGrantId + ":" + key);
            String tier = roll < 7000 ? "COMMON" : roll < 9000 ? "RARE" : roll < 9800 ? "EPIC" : "LEGENDARY";
            String itemCode = tier + "_STAR_BADGE";
            Set<String> inventory = ownedItems.computeIfAbsent(userId, ignored -> new LinkedHashSet<>());
            boolean duplicate = !inventory.add(itemCode);
            grant.opened = true;
            grant.itemCode = duplicate ? "COLLECTION_DUST_" + tier : itemCode;
            durableRepository.append(new B4DurableRepository.Fact("GAM_CHEST_OPEN", chestGrantId, userId,
                    "req_" + UUID.randomUUID(), key, clock.instant(), map("probabilityVersion", grant.probabilityVersion,
                    "tierCode", tier, "itemCode", grant.itemCode, "duplicateConverted", duplicate)));
            return envelope(map("opened", true, "tierCode", tier, "itemCode", grant.itemCode,
                    "duplicateConverted", duplicate, "probabilityVersion", grant.probabilityVersion));
        });
    }

    public synchronized Map<String, Object> collection(long userId) {
        return envelope(map("ownedItems", new ArrayList<>(ownedItems.getOrDefault(userId, Set.of())), "dustBalance", 0,
                "sets", List.of(map("setCode", "STAR_BADGES", "collected", ownedItems.getOrDefault(userId, Set.of()).size(), "total", 4))));
    }

    public synchronized Map<String, Object> catalog(long userId) {
        return envelope(map("items", List.of(
                map("catalogItemId", "STREAK_FREEZE_CARD", "priceCoins", 100, "kind", "UTILITY"),
                map("catalogItemId", "COMMON_ITEM", "priceCoins", 300, "kind", "COSMETIC"),
                map("catalogItemId", "RARE_ITEM", "priceCoins", 600, "kind", "COSMETIC"),
                map("catalogItemId", "SOUND_THEME_PACK", "priceCoins", 500, "kind", "COSMETIC"))));
    }

    public synchronized Map<String, Object> redeem(long userId, String catalogItemId, String key) {
        requireKey(key);
        Map<String, Integer> prices = Map.of("STREAK_FREEZE_CARD", 100, "COMMON_ITEM", 300, "RARE_ITEM", 600, "SOUND_THEME_PACK", 500);
        return idempotent(userId, "catalog-redeem:" + catalogItemId, key, map("catalogItemId", catalogItemId), () -> {
            Integer price = prices.get(catalogItemId);
            if (price == null) throw error("GAM_CATALOG_NOT_FOUND", "catalog item does not exist", 404, false);
            Account account = account(userId);
            if (account.coins < price) throw error("GAM_COIN_BALANCE_INSUFFICIENT", "not enough coins", 409, false);
            account.coins -= price;
            return envelope(map("redeemed", true, "catalogItemId", catalogItemId, "profile", profileView(userId, account)));
        });
    }

    public synchronized Map<String, Object> currentSeason(long userId) {
        return envelope(map("seasonId", "SEASON_2026_Q3", "title", "星尘航线", "status", "ACTIVE",
                "points", account(userId).xp, "tiers", List.of(map("tier", 1, "requiredPoints", 0), map("tier", 2, "requiredPoints", 500))));
    }

    public synchronized Map<String, Object> seasonRewards(long userId, String seasonId) {
        if (!"SEASON_2026_Q3".equals(seasonId)) throw error("GAM_SEASON_NOT_FOUND", "season does not exist", 404, false);
        return envelope(map("seasonId", seasonId, "items", List.of(map("tier", 1, "rewardCode", "COMMON_ITEM"), map("tier", 2, "rewardCode", "RARE_ITEM"))));
    }

    public synchronized Map<String, Object> avatarProfile(long userId) {
        return envelope(map("profile", avatarProfiles.computeIfAbsent(userId, ignored -> defaultAvatar())));
    }

    public synchronized Map<String, Object> saveAvatarProfile(long userId, Map<String, Object> body, String key) {
        requireKey(key);
        return idempotent(userId, "avatar-profile", key, body, () -> {
            Map<String, Object> profile = avatarProfiles.computeIfAbsent(userId, ignored -> defaultAvatar());
            if (body.containsKey("resourceVersion")) profile.put("resourceVersion", requiredText(body, "resourceVersion"));
            if (body.containsKey("renderMode")) profile.put("renderMode", allowedRenderMode(text(body.get("renderMode"), "2D_FALLBACK")));
            return avatarProfile(userId);
        });
    }

    public synchronized Map<String, Object> avatarItems(long userId) {
        return envelope(map("items", List.of(
                map("itemCode", "COMMON_ITEM", "quality", "COMMON", "slot", "BODY", "resourceVersion", "AVATAR_RES_2026_08"),
                map("itemCode", "RARE_ITEM", "quality", "RARE", "slot", "ACCESSORY", "resourceVersion", "AVATAR_RES_2026_08"),
                map("itemCode", "EPIC_ITEM", "quality", "EPIC", "slot", "EFFECT", "resourceVersion", "AVATAR_RES_2026_08")),
                "ownedItems", new ArrayList<>(ownedItems.getOrDefault(userId, Set.of())), "fallback", "2D_FALLBACK"));
    }

    public synchronized Map<String, Object> avatarLoadouts(long userId) {
        return envelope(map("items", List.of(map("loadoutId", "LOADOUT_DEFAULT", "name", "默认装扮", "equipped", true, "items", List.of()))));
    }

    public synchronized Map<String, Object> saveAvatarLoadout(long userId, String loadoutId, Map<String, Object> body, String key) {
        requireKey(key);
        rejectClientOwnedFields(body, Set.of("priceCoins", "quality", "resourceUrl"));
        return idempotent(userId, "avatar-loadout:" + loadoutId, key, body, () -> envelope(map("loadoutId", loadoutId, "saved", true, "version", 1)));
    }

    public synchronized Map<String, Object> equipAvatarLoadout(long userId, String loadoutId, String key) {
        requireKey(key);
        return idempotent(userId, "avatar-equip:" + loadoutId, key, map("loadoutId", loadoutId), () -> envelope(map("loadoutId", loadoutId, "equipped", true, "resourceVersion", "AVATAR_RES_2026_08")));
    }

    public synchronized Map<String, Object> avatarResources(long userId) {
        return envelope(map("resourceVersion", "AVATAR_RES_2026_08", "manifestHash", "sha256:b4-avatar-manifest", "fallbackMode", "2D_FALLBACK",
                "performanceTiers", List.of("Ultra", "High", "Medium", "Performance")));
    }

    public synchronized Map<String, Object> studySpace(long userId) {
        return envelope(map("space", studySpaces.computeIfAbsent(userId, ignored -> map("spaceId", "SPACE-" + userId, "version", 1, "placements", List.of(), "renderMode", "2D_FALLBACK"))));
    }

    public synchronized Map<String, Object> saveStudySpace(long userId, Map<String, Object> body, String key) {
        requireKey(key);
        rejectClientOwnedFields(body, Set.of("xp", "coins", "rarity"));
        return idempotent(userId, "study-space", key, body, () -> {
            Map<String, Object> space = studySpaces.computeIfAbsent(userId, ignored -> new LinkedHashMap<>());
            space.put("spaceId", "SPACE-" + userId);
            space.put("version", intValue(space.getOrDefault("version", 0), "version") + 1);
            space.put("placements", body.getOrDefault("placements", List.of()));
            space.put("renderMode", allowedRenderMode(text(body.get("renderMode"), "2D_FALLBACK")));
            return studySpace(userId);
        });
    }

    public synchronized Map<String, Object> gameCatalog(long userId) {
        return envelope(map("items", GAME_CODES.stream().map(code -> map("gameCode", code, "maxMinutes", 15,
                "pauseLimitMinutes", 10, "passAccuracyPercent", 60, "passCompletionPercent", 80)).toList(),
                "performanceTiers", List.of("Ultra", "High", "Medium", "Performance")));
    }

    public synchronized Map<String, Object> createGameSession(long userId, Map<String, Object> body, String key) {
        requireKey(key);
        String code = requiredText(body, "gameCode");
        if (!GAME_CODES.contains(code)) throw error("GAM_GAME_NOT_FOUND", "game does not exist", 404, false);
        int starts = gameStartsToday.getOrDefault(userId, 0);
        if (starts >= 20) throw error("GAM_GAME_START_CAP", "daily game start cap reached", 429, false);
        return idempotent(userId, "game-create:" + code, key, body, () -> {
            gameStartsToday.put(userId, starts + 1);
            String id = "GAME-" + UUID.randomUUID();
            GameSession session = new GameSession(id, userId, code);
            gameSessions.put(id, session);
            durableRepository.append(new B4DurableRepository.Fact("GAM_GAME_SESSION", id, userId,
                    "req_" + UUID.randomUUID(), key, clock.instant(), map("gameCode", code, "status", session.status)));
            return envelope(map("session", session.view()));
        });
    }

    public synchronized Map<String, Object> gameSession(long userId, String sessionId) {
        return envelope(map("session", ownedGame(userId, sessionId).view()));
    }

    public synchronized Map<String, Object> submitGameEvent(long userId, String sessionId, Map<String, Object> body, String key) {
        requireKey(key);
        rejectClientOwnedFields(body, Set.of("score", "finalScore", "deltaXp", "randomSeed", "probabilityVersion", "correct"));
        return idempotent(userId, "game-event:" + sessionId + ":" + text(body.get("eventId"), "missing"), key, body, () -> {
            GameSession session = ownedGame(userId, sessionId);
            if (!("READY".equals(session.status) || "IN_PROGRESS".equals(session.status))) throw error("GAM_GAME_STATE_INVALID", "game is not accepting events", 409, false);
            int seq = intValue(body.get("seq"), "seq");
            if (seq <= session.seq) throw error("GAM_GAME_SEQUENCE_INVALID", "event sequence must increase", 409, false);
            session.seq = seq;
            session.status = "IN_PROGRESS";
            String responseToken = requiredText(body, "responseToken");
            boolean correct = responseToken.equals(session.expectedTokens.get(session.attempts % session.expectedTokens.size()));
            session.attempts++;
            if (correct) session.correct++;
            return envelope(map("accepted", true, "seq", seq, "eventId", requiredText(body, "eventId"), "session", session.view()));
        });
    }

    public synchronized Map<String, Object> pauseGame(long userId, String sessionId, String key) {
        requireKey(key);
        return idempotent(userId, "game-pause:" + sessionId, key, map(), () -> transitionGame(userId, sessionId, "PAUSED"));
    }

    public synchronized Map<String, Object> resumeGame(long userId, String sessionId, String key) {
        requireKey(key);
        return idempotent(userId, "game-resume:" + sessionId, key, map(), () -> transitionGame(userId, sessionId, "IN_PROGRESS"));
    }

    public synchronized Map<String, Object> finishGame(long userId, String sessionId, String key) {
        requireKey(key);
        return idempotent(userId, "game-finish:" + sessionId, key, map(), () -> {
            GameSession session = ownedGame(userId, sessionId);
            if (!("IN_PROGRESS".equals(session.status) || "PAUSED".equals(session.status))) throw error("GAM_GAME_STATE_INVALID", "game cannot be finished", 409, false);
            session.status = "COMPLETED";
            int accuracy = session.attempts == 0 ? 0 : session.correct * 100 / session.attempts;
            int completion = Math.min(100, session.attempts * 20);
            boolean passed = completion >= 80 && accuracy >= 60;
            int serverScore = session.correct * 100;
            return envelope(map("sessionId", session.id, "status", session.status, "passed", passed,
                    "accuracyPercent", accuracy, "completionPercent", completion, "serverScore", serverScore,
                    "rewardEligible", passed));
        });
    }

    private Map<String, Object> quest(long userId, String id, String period, String title, int target, int progress, int reward) {
        Map<String, Object> state = questStates.computeIfAbsent(userId + ":" + id, ignored -> new LinkedHashMap<>(map(
                "questId", id, "period", period, "title", title, "target", target, "progress", progress >= target ? target : 0,
                "completed", progress >= target, "claimed", false, "xpReward", reward, "coinReward", reward / 10)));
        return new LinkedHashMap<>(state);
    }

    private void markLearningDay(long userId, LocalDate day) {
        LocalDate previous = lastLearningDay.put(userId, day);
        if (previous == null) streaks.put(userId, 1);
        else if (previous.plusDays(1).equals(day)) streaks.compute(userId, (ignored, value) -> (value == null ? 0 : value) + 1);
        else if (!previous.equals(day) && !Boolean.TRUE.equals(weekendProtection.getOrDefault(userId, false))) streaks.put(userId, 1);
        else if (previous.equals(day)) streaks.putIfAbsent(userId, 1);
    }

    private LocalDate today(long userId) { return LocalDate.now(timeZones.getOrDefault(userId, ZoneId.of("Asia/Shanghai"))); }

    private String streakStatus(long userId) {
        LocalDate last = lastLearningDay.get(userId);
        if (last == null) return "NEW";
        LocalDate today = today(userId);
        if (last.equals(today)) return "ACTIVE";
        if (last.plusDays(1).equals(today)) return "AT_RISK";
        return "BROKEN";
    }

    private Account account(long userId) { return accounts.computeIfAbsent(userId, ignored -> new Account()); }

    private Map<String, Object> profileView(long userId, Account account) {
        int level = levelFor(account.xp);
        return map("userId", userId, "xp", account.xp, "level", level, "rank", rankFor(level), "coins", account.coins,
                "nextLevelXp", level >= 100 ? account.xp : threshold(level + 1), "streak", streaks.getOrDefault(userId, 0),
                "dailyRewardCount", dailyRewardCount(userId), "ruleVersion", RULE_VERSION);
    }

    private Map<String, Boolean> featureFlags() {
        return Map.of("gamification", true, "games", true, "avatar", true, "chest", true, "season", true, "socialRooms", true, "offlineSync", true);
    }

    private int dailyRewardCount(long userId) {
        return dailyCounters.entrySet().stream().filter(entry -> entry.getKey().startsWith(userId + ":" + today(userId))).mapToInt(Map.Entry::getValue).sum();
    }

    public static long threshold(int level) { return 100L * (level - 1) * level / 2; }

    public static int levelFor(long xp) {
        int level = 1;
        while (level < 100 && xp >= threshold(level + 1)) level++;
        return level;
    }

    public static String rankFor(int level) {
        return level <= 10 ? "STAR_DUST_APPRENTICE" : level <= 30 ? "ORBIT_EXPLORER" : level <= 60 ? "STELLAR_NAVIGATOR" : "GALAXY_MASTER";
    }

    private ChestGrant ensureChest(long userId) { return chestGrants.computeIfAbsent("CHEST-" + userId + "-001", ignored -> new ChestGrant("CHEST-" + userId + "-001", userId)); }

    private ChestGrant ownedChest(long userId, String chestGrantId) {
        ChestGrant grant = chestGrants.get(chestGrantId);
        if (grant == null || grant.userId != userId) throw error("GAM_CHEST_NOT_FOUND", "chest grant does not exist", 404, false);
        return grant;
    }

    private int hmacRoll(String value) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec("englishflow-b4-server-secret".getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] digest = mac.doFinal(value.getBytes(StandardCharsets.UTF_8));
            return ((digest[0] & 0xff) << 8 | (digest[1] & 0xff)) % 10000;
        } catch (NoSuchAlgorithmException | InvalidKeyException exception) { throw error("GAM_CHEST_RANDOM_FAILED", "auditable random source unavailable", 500, true); }
    }

    private GameSession ownedGame(long userId, String sessionId) {
        GameSession session = gameSessions.get(sessionId);
        if (session == null || session.userId != userId) throw error("GAM_GAME_SESSION_NOT_FOUND", "game session does not exist", 404, false);
        return session;
    }

    private Map<String, Object> transitionGame(long userId, String sessionId, String status) {
        GameSession session = ownedGame(userId, sessionId);
        if ("PAUSED".equals(status) && !"IN_PROGRESS".equals(session.status)) throw error("GAM_GAME_STATE_INVALID", "game cannot be paused", 409, false);
        if ("IN_PROGRESS".equals(status) && !"PAUSED".equals(session.status) && !"READY".equals(session.status)) throw error("GAM_GAME_STATE_INVALID", "game cannot be resumed", 409, false);
        session.status = status;
        return envelope(map("session", session.view()));
    }

    private <T> Map<String, Object> idempotent(long userId, String scope, String key, Map<String, Object> body, Supplier<Map<String, Object>> action) {
        String identity = userId + ":" + scope + ":" + key;
        String fingerprint = bodyFingerprint(body);
        Map<String, Object> previous = idempotency.get(identity);
        if (previous != null) {
            if (!fingerprint.equals(idempotencyFingerprints.get(identity))) throw error("GAM_IDEMPOTENCY_CONFLICT", "Idempotency-Key was reused with a different request", 409, false);
            return previous;
        }
        Map<String, Object> result = action.get();
        idempotency.put(identity, result);
        idempotencyFingerprints.put(identity, fingerprint);
        return result;
    }

    private void rejectClientOwnedFields(Map<String, Object> body, Set<String> fields) {
        for (String field : fields) if (body.containsKey(field)) throw error("GAM_CLIENT_FIELD_FORBIDDEN", field + " is server-owned", 400, false);
    }

    private static void requireKey(String key) { if (key == null || key.isBlank() || key.length() < 8 || key.length() > 96) throw error("GAM_IDEMPOTENCY_REQUIRED", "Idempotency-Key must contain 8-96 characters", 400, false); }
    private static String requiredText(Map<String, Object> body, String field) { String value = text(body.get(field), ""); if (value.isBlank()) throw error("GAM_SCHEMA_INVALID", field + " is required", 400, false); return value; }
    private static String text(Object value, String fallback) { return value == null ? fallback : String.valueOf(value); }
    private static int intValue(Object value, String field) { if (value instanceof Number number) return number.intValue(); try { return Integer.parseInt(String.valueOf(value)); } catch (Exception exception) { throw error("GAM_SCHEMA_INVALID", field + " is required", 400, false); } }
    private static int safeLimit(int limit) { return Math.max(1, Math.min(limit <= 0 ? 20 : limit, 100)); }
    private static String requestId(Map<String, Object> envelope) { return text(envelope.get("requestId"), "req_b4"); }
    private static Map<String, Object> map(Object... values) { Map<String, Object> result = new LinkedHashMap<>(); for (int i = 0; i + 1 < values.length; i += 2) if (values[i + 1] != null) result.put(String.valueOf(values[i]), values[i + 1]); return result; }
    private Map<String, Object> envelope(Map<String, Object> data) { return map("requestId", "req_b4_" + UUID.randomUUID(), "serverTime", clock.instant().toString(), "data", data); }
    private static B4Exception error(String code, String message, int status, boolean retryable) { return new B4Exception(code, message, status, retryable); }
    private static String bodyFingerprint(Map<String, Object> body) { return Integer.toHexString(body == null ? 0 : body.toString().hashCode()); }
    private static String allowedRenderMode(String value) { return Set.of("3D", "2D_FALLBACK").contains(value) ? value : "2D_FALLBACK"; }
    private static Map<String, Object> defaultAvatar() { return map("avatarId", "AVATAR_DEFAULT", "resourceVersion", "AVATAR_RES_2026_08", "renderMode", "2D_FALLBACK", "loadoutId", "LOADOUT_DEFAULT"); }

    private static final class Account { long xp; long coins; }
    private static final class ChestGrant {
        final String id; final long userId; final String probabilityVersion = "CHEST_PROB_2026_08_20_01"; boolean opened; String itemCode;
        ChestGrant(String id, long userId) { this.id = id; this.userId = userId; }
        Map<String, Object> view() { return map("chestGrantId", id, "kind", "FREE_LEARNING_REWARD", "status", opened ? "OPENED" : "AVAILABLE", "probabilityVersion", probabilityVersion, "itemCode", itemCode); }
    }
    private static final class GameSession {
        final String id; final long userId; final String gameCode; final Instant createdAt = Instant.now(); final List<String> expectedTokens = List.of("A1", "B2", "C3", "D4", "E5");
        String status = "READY"; int seq; int attempts; int correct;
        GameSession(String id, long userId, String gameCode) { this.id = id; this.userId = userId; this.gameCode = gameCode; }
        Map<String, Object> view() { return map("sessionId", id, "gameCode", gameCode, "status", status, "seq", seq, "attemptCount", attempts, "createdAt", createdAt.toString(), "maxMinutes", 15, "pauseLimitMinutes", 10); }
    }
}
