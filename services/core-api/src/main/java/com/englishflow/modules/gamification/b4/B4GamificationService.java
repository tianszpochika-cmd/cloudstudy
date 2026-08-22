package com.englishflow.modules.gamification.b4;

import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.DateTimeException;
import java.time.DayOfWeek;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Supplier;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import com.englishflow.modules.b4.B4DurableRepository;
import com.englishflow.modules.b4.B4Exception;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/**
 * B4 gamification application service.
 *
 * <p>The repository boundary intentionally only exposes append/list facts in this
 * branch. The service therefore keeps a synchronized projection for request-time
 * decisions and rehydrates it from immutable B4 facts on first access. Every
 * economic or learning decision is still written as a fact before the projection
 * is changed. This keeps the local adapter useful for tests while making the
 * source/event identifiers explicit for the JDBC adapter.</p>
 */
@Service
public final class B4GamificationService {
    public static final String RULE_VERSION = "GAM_RULE_2026_08_20_01";
    private static final String STAR_COIN = "STAR_COIN";
    private static final String STAR_DUST = "STAR_DUST";
    private static final String STREAK_FREEZE = "STREAK_FREEZE";
    private static final long SERVER_CONTENT_VERSION = 301L;
    private static final String AVATAR_RESOURCE_VERSION = "AVATAR_RES_2026_08";
    private static final String CURRENT_SEASON = "SEASON_2026_Q3";
    private static final String CHEST_ALGORITHM = "PRNG-HMAC-SHA256-v1";

    private static final Set<String> CLIENT_LEARNING_FIELDS = Set.of("sourceType", "sourceEventId", "resultCode");
    private static final Set<String> EFFECTIVE_LEARNING_SOURCES = Set.of(
            "LESSON_COMPLETE", "REVIEW_BATCH_COMPLETE", "READING_COMPLETE", "LISTENING_COMPLETE",
            "WRITING_SUBMISSION", "CHECKPOINT_PASS", "GAME_SESSION_QUALIFIED", "DAILY_GOAL_REACHED");
    private static final Set<String> LEARNING_SOURCES = Set.of(
            "LESSON_COMPLETE", "REVIEW_BATCH_COMPLETE", "READING_COMPLETE", "LISTENING_COMPLETE",
            "WRITING_SUBMISSION", "CHECKPOINT_PASS", "GAME_SESSION_QUALIFIED", "DAILY_GOAL_REACHED",
            "QUEST_COMPLETED", "ACHIEVEMENT_UNLOCKED", "STREAK_MILESTONE");

    private static final Map<String, RewardRule> REWARD_RULES = createRewardRules();
    private static final Map<String, GameDefinition> GAME_DEFINITIONS = createGameDefinitions();
    private static final Map<String, ItemDefinition> ITEM_DEFINITIONS = createItemDefinitions();
    private static final Map<String, Integer> CATALOG_PRICES = Map.of(
            "STREAK_FREEZE_CARD", 100,
            "COMMON_ITEM", 300,
            "RARE_ITEM", 600,
            "EPIC_ITEM", 1200,
            "LEGENDARY_ITEM", 3000,
            "SOUND_THEME_PACK", 500);
    private static final Map<String, Integer> DUPLICATE_DUST = Map.of(
            "COMMON", 12,
            "RARE", 30,
            "EPIC", 80,
            "LEGENDARY", 200,
            "COLLECTOR", 500);
    private static final List<QuestDefinition> QUEST_DEFINITIONS = List.of(
            new QuestDefinition("DAILY_20_MIN", "DAILY", "完成 20 个有效学习对象", 20, 40, 5),
            new QuestDefinition("DAILY_REVIEW_10", "DAILY", "完成 10 个复习对象", 10, 40, 5),
            new QuestDefinition("WEEKLY_FOCUS_5", "WEEKLY", "完成 5 次有效学习", 5, 100, 15));
    private static final List<AchievementDefinition> ACHIEVEMENT_DEFINITIONS = createAchievementDefinitions();

    private final Clock clock;
    private final B4DurableRepository durableRepository;
    private final Map<String, Boolean> flags;
    private final Map<Long, AccountState> accounts = new HashMap<>();
    private final Map<Long, StreakState> streakStates = new HashMap<>();
    private final Map<Long, Map<String, QuestState>> questStates = new HashMap<>();
    private final Map<Long, Map<String, AchievementState>> achievementStates = new HashMap<>();
    private final Map<Long, Map<String, Integer>> achievementCounters = new HashMap<>();
    private final Map<Long, Set<String>> triedGames = new HashMap<>();
    private final Map<Long, Integer> wonGames = new HashMap<>();
    private final Map<Long, Set<String>> showcasedAchievements = new HashMap<>();
    private final Map<String, ChestGrant> chestGrants = new LinkedHashMap<>();
    private final Map<String, GameSession> gameSessions = new LinkedHashMap<>();
    private final Map<Long, Map<String, Loadout>> loadouts = new HashMap<>();
    private final Map<Long, AvatarState> avatarStates = new HashMap<>();
    private final Map<Long, StudySpaceState> studySpaces = new HashMap<>();
    private final Map<Long, GalaxyState> galaxyStates = new HashMap<>();
    private final Map<String, Map<String, Object>> idempotencyResponses = new HashMap<>();
    private final Map<String, String> idempotencyFingerprints = new HashMap<>();
    private final Set<Long> hydratedUsers = new HashSet<>();

    public B4GamificationService() {
        this(Clock.systemUTC(), new com.englishflow.modules.b4.InMemoryB4DurableRepository());
    }

    @Autowired
    public B4GamificationService(B4DurableRepository durableRepository) {
        this(Clock.systemUTC(), durableRepository);
    }

    public B4GamificationService(Clock clock, B4DurableRepository durableRepository) {
        this(clock, durableRepository, defaultFlags());
    }

    /** Constructor used by rule tests to exercise feature flag gates. */
    public B4GamificationService(Clock clock, B4DurableRepository durableRepository, Map<String, Boolean> featureFlags) {
        if (clock == null || durableRepository == null) throw new IllegalArgumentException("clock and repository are required");
        this.clock = clock;
        this.durableRepository = durableRepository;
        this.flags = new LinkedHashMap<>(defaultFlags());
        if (featureFlags != null) this.flags.putAll(featureFlags);
    }

    public synchronized Map<String, Object> profile(long userId) {
        AccountState account = account(userId);
        return success(map("profile", profileView(userId, account), "featureFlags", featureFlagsView(),
                "growth", galaxyView(userId), "metrics", dashboardView(userId), "ruleVersion", RULE_VERSION));
    }

    public synchronized Map<String, Object> ledger(long userId, int limit) {
        AccountState account = account(userId);
        int requested = safeLimit(limit);
        List<Map<String, Object>> items = account.xpLedger.stream()
                .sorted(Comparator.comparing(item -> text(item.get("occurredAt"), ""), Comparator.reverseOrder()))
                .limit(requested).map(item -> (Map<String, Object>) new LinkedHashMap<String, Object>(item)).toList();
        return success(map("items", items, "nextCursor", null, "hasMore", account.xpLedger.size() > requested));
    }

    public synchronized Map<String, Object> settleLearningEvent(long userId, Map<String, Object> request, String idempotencyKey) {
        requireUser(userId);
        requireKey(idempotencyKey);
        Map<String, Object> body = safeBody(request);
        rejectUnknownFields(body, CLIENT_LEARNING_FIELDS);
        rejectClientOwnedFields(body, Set.of("deltaXp", "deltaCoins", "score", "randomSeed", "probabilityVersion", "finalScore", "ruleVersion"));
        return idempotent(userId, "settle", idempotencyKey, body, () -> {
            String sourceType = requiredText(body, "sourceType", 1, 64);
            String sourceEventId = requiredText(body, "sourceEventId", 8, 128);
            if (!LEARNING_SOURCES.contains(sourceType)) throw error("GAM_SOURCE_INVALID", "learning source is not eligible", 400, false);
            AccountState account = account(userId);
            Map<String, Object> existing = existingSettlement(account, sourceEventId);
            if (existing != null) return success(map("accepted", true, "replayed", true,
                    "settlementId", existing.get("settlementId"), "sourceType", sourceType,
                    "sourceEventId", sourceEventId, "xp", existing.get("deltaXp"),
                    "coins", existing.get("deltaCoins"), "profile", profileView(userId, account),
                    "ruleVersion", RULE_VERSION));
            if (!flag("gamification")) return success(map("accepted", false, "reasonCode", "FEATURE_DISABLED",
                    "sourceType", sourceType, "sourceEventId", sourceEventId, "ruleVersion", RULE_VERSION));
            RewardRule rule = REWARD_RULES.get(sourceType);
            if (rule == null) throw error("GAM_SOURCE_INVALID", "learning source has no published rule", 400, false);
            enforceDailyRewardCap(userId, sourceType, rule);
            String settlementId = "SETTLE-" + UUID.randomUUID();
            String requestId = newRequestId();
            applyAssets(userId, settlementId, sourceEventId, rule.reasonCode(), rule.xp(), rule.coins(), idempotencyKey, requestId);
            incrementDailyCounter(account, today(userId), sourceType);
            onAcceptedLearningEvent(userId, sourceType, sourceEventId, rule.xp());
            grantChestForLearningEvent(userId, sourceType, sourceEventId, idempotencyKey, requestId);
            Map<String, Object> data = map("accepted", true, "replayed", false, "settlementId", settlementId,
                    "sourceType", sourceType, "sourceEventId", sourceEventId, "xp", rule.xp(), "coins", rule.coins(),
                    "balanceAfter", balanceView(account), "profile", profileView(userId, account), "ruleVersion", RULE_VERSION);
            appendFact("GAM_REWARD_SETTLEMENT", settlementId, userId, idempotencyKey, requestId,
                    "gamification.profile.updated.v1", map("status", "ACCEPTED", "sourceType", sourceType,
                            "sourceEventId", sourceEventId, "settlementId", settlementId,
                            "deltaXp", rule.xp(), "deltaCoins", rule.coins()));
            return envelope(requestId, data);
        });
    }

    public synchronized Map<String, Object> streak(long userId) {
        StreakState state = streak(userId, true);
        return success(map("currentStreak", state.currentStreak, "maxStreak", state.maxStreak,
                "lastValidDate", state.lastValidDate, "timeZone", state.timeZone.getId(),
                "weekendProtectionEnabled", state.weekendProtectionEnabled, "status", streakStatus(userId, state),
                "calendar", streakCalendar(userId, state), "rescue", map("missingDate", findMissingDate(userId, state),
                        "windowOpen", rescueWindowOpen(userId, state))));
    }

    public synchronized Map<String, Object> saveStreakSettings(long userId, Map<String, Object> request, String idempotencyKey) {
        requireUser(userId);
        requireKey(idempotencyKey);
        Map<String, Object> body = safeBody(request);
        rejectUnknownFields(body, Set.of("timeZone", "weekendProtectionEnabled"));
        return idempotent(userId, "streak-settings", idempotencyKey, body, () -> {
            StreakState state = streak(userId, true);
            String zoneText = requiredText(body, "timeZone", 1, 64);
            ZoneId zone;
            try { zone = ZoneId.of(zoneText); } catch (DateTimeException exception) { throw error("GAM_TIME_ZONE_INVALID", "timeZone must be an IANA zone", 400, false); }
            Object protectionValue = body.get("weekendProtectionEnabled");
            if (protectionValue != null && !(protectionValue instanceof Boolean)) throw error("GAM_SCHEMA_INVALID", "weekendProtectionEnabled must be boolean", 400, false);
            if (!zone.equals(state.timeZone) && state.timeZoneChangedAt != null && Duration.between(state.timeZoneChangedAt, clock.instant()).toHours() < 24) {
                throw error("GAM_TIME_ZONE_COOLDOWN", "timeZone can only change once per 24 hours", 409, false);
            }
            boolean protection = Boolean.TRUE.equals(protectionValue);
            String requestId = newRequestId();
            state.timeZone = zone; state.weekendProtectionEnabled = protection; state.timeZoneChangedAt = clock.instant();
            appendFact("GAM_STREAK_SETTING", String.valueOf(userId), userId, idempotencyKey, requestId,
                    "gamification.streak.protection_updated.v1", map("status", "ACTIVE", "timeZone", zone.getId(),
                            "weekendProtectionEnabled", protection, "effectiveAt", clock.instant().toString()));
            return envelope(requestId, map("timeZone", zone.getId(), "weekendProtectionEnabled", protection,
                    "streak", streak(userId).get("data")));
        });
    }

    public synchronized Map<String, Object> rescueStreak(long userId, Map<String, Object> request, String idempotencyKey) {
        requireUser(userId);
        requireKey(idempotencyKey);
        Map<String, Object> body = safeBody(request);
        rejectUnknownFields(body, Set.of("rescueMethod"));
        return idempotent(userId, "streak-rescue", idempotencyKey, body, () -> {
            StreakState state = streak(userId, true);
            LocalDate missingDate = findMissingDate(userId, state);
            if (missingDate == null || !rescueWindowOpen(userId, state)) throw error("STREAK_RESCUE_EXPIRED", "there is no open streak rescue window", 409, false);
            String method = text(body.get("rescueMethod"), "CARD");
            if (!Set.of("CARD", "CHALLENGE").contains(method)) throw error("GAM_SCHEMA_INVALID", "rescueMethod must be CARD or CHALLENGE", 400, false);
            if ("CHALLENGE".equals(method)) throw error("GAM_RESCUE_CHALLENGE_UNVERIFIED", "the rescue challenge must be completed by the learning service", 409, true);
            AccountState account = account(userId);
            if (balance(account, STREAK_FREEZE) < 1) throw error("INSUFFICIENT_FREEZE_CARD", "one streak freeze card is required", 409, false);
            String requestId = newRequestId();
            String rescueId = "RESCUE-" + UUID.randomUUID();
            applyCurrency(userId, rescueId, rescueId, "STREAK_RESCUE_CARD", STREAK_FREEZE, -1, idempotencyKey, requestId);
            state.rescuedDates.add(missingDate); state.lastRescueDate = missingDate;
            appendFact("GAM_STREAK_RESCUE", rescueId, userId, idempotencyKey, requestId,
                    "gamification.streak.rescue_completed.v1", map("status", "RESCUED", "rescueId", rescueId,
                            "missingDate", missingDate, "rescueMethod", method, "settlementId", rescueId));
            return envelope(requestId, map("rescued", true, "missingDate", missingDate, "rescueMethod", method,
                    "currentStreak", state.currentStreak, "status", streakStatus(userId, state), "streak", streak(userId).get("data")));
        });
    }

    public synchronized Map<String, Object> quests(long userId) {
        requireUser(userId);
        List<Map<String, Object>> items = new ArrayList<>();
        for (QuestDefinition definition : QUEST_DEFINITIONS) items.add(questState(userId, definition).view(definition));
        return success(map("items", items, "serverTime", clock.instant().toString(), "ruleVersion", RULE_VERSION));
    }

    public synchronized Map<String, Object> claimQuest(long userId, String questId, String idempotencyKey) {
        requireUser(userId); requireKey(idempotencyKey);
        QuestDefinition definition = questDefinition(questId);
        return idempotent(userId, "quest-claim:" + questId, idempotencyKey, map("questId", questId), () -> {
            QuestState state = questState(userId, definition);
            if (!state.completed(definition)) throw error("GAM_QUEST_NOT_COMPLETED", "quest is not completed", 409, false);
            if (state.claimed) return success(map("claimed", false, "reasonCode", "ALREADY_CLAIMED", "questId", questId));
            String requestId = newRequestId();
            String settlementId = "QUEST-" + questId + "-" + state.periodStart;
            applyAssets(userId, settlementId, settlementId, "WEEKLY".equals(definition.period()) ? "WEEKLY_QUEST" : "DAILY_QUEST",
                    definition.xpReward(), definition.coinReward(), idempotencyKey, requestId);
            state.claimed = true;
            appendFact("GAM_QUEST_CLAIM", questId, userId, idempotencyKey, requestId, "gamification.quest.claimed.v1",
                    map("status", "CLAIMED", "questId", questId, "periodStart", state.periodStart,
                            "deltaXp", definition.xpReward(), "deltaCoins", definition.coinReward(), "settlementId", settlementId));
            if (allDailyQuestsClaimed(userId, state.periodStart)) grantChest(userId, "BRONZE", "DAILY_QUESTS:" + state.periodStart, idempotencyKey, requestId);
            return envelope(requestId, map("claimed", true, "questId", questId, "periodStart", state.periodStart,
                    "profile", profileView(userId, account(userId)), "ruleVersion", RULE_VERSION));
        });
    }

    public synchronized Map<String, Object> achievements(long userId) {
        requireUser(userId);
        List<Map<String, Object>> items = new ArrayList<>();
        for (AchievementDefinition definition : ACHIEVEMENT_DEFINITIONS) {
            AchievementState state = achievementState(userId, definition.code());
            state.progress = Math.max(state.progress, achievementProgress(userId, definition));
            items.add(state.view(definition));
        }
        return success(map("items", items, "total", items.size(), "ruleVersion", RULE_VERSION));
    }

    public synchronized Map<String, Object> showcaseAchievement(long userId, String code, Map<String, Object> request, String idempotencyKey) {
        requireUser(userId); requireKey(idempotencyKey);
        Map<String, Object> body = safeBody(request); rejectUnknownFields(body, Set.of("showcased"));
        AchievementDefinition definition = achievementDefinition(code);
        return idempotent(userId, "achievement-showcase:" + code, idempotencyKey, body, () -> {
            AchievementState state = achievementState(userId, definition.code());
            if (!state.unlocked) throw error("GAM_ACHIEVEMENT_LOCKED", "achievement is not unlocked", 409, false);
            boolean visible = booleanField(body, "showcased", false);
            showcasedAchievements.computeIfAbsent(userId, ignored -> new LinkedHashSet<>());
            if (visible) showcasedAchievements.get(userId).add(code); else showcasedAchievements.get(userId).remove(code);
            state.showcased = visible;
            String requestId = newRequestId();
            appendFact("GAM_ACHIEVEMENT", code, userId, idempotencyKey, requestId,
                    "gamification.achievement.showcase_updated.v1", map("status", "SHOWCASE_UPDATED", "achievementCode", code, "showcased", visible));
            return envelope(requestId, map("achievementCode", code, "showcased", visible, "ruleVersion", RULE_VERSION));
        });
    }

    public synchronized Map<String, Object> chests(long userId) {
        requireUser(userId);
        List<Map<String, Object>> items = chestGrants.values().stream().filter(grant -> grant.userId == userId)
                .sorted(Comparator.comparing(grant -> grant.createdAt, Comparator.reverseOrder())).map(ChestGrant::view).toList();
        return success(map("items", items, "pity", map("enabled", false, "reason", "fixed_probability_baseline"), "ruleVersion", RULE_VERSION));
    }

    public synchronized Map<String, Object> chestProbability(long userId, String chestGrantId) {
        requireUser(userId);
        ChestGrant grant = ownedChest(userId, chestGrantId);
        Map<String, Integer> weights = chestWeights(grant.chestType);
        List<Map<String, Object>> tiers = weights.entrySet().stream().map(entry -> map("tierCode", entry.getKey(), "weightBps", entry.getValue(), "itemProbabilityMode", "PUBLISHED_TIER_POOL")).toList();
        return success(map("chestGrantId", chestGrantId, "chestType", grant.chestType, "probabilityVersion", grant.probabilityVersion,
                "algorithmVersion", CHEST_ALGORITHM, "tiers", tiers, "totalWeightBps", weights.values().stream().mapToInt(Integer::intValue).sum(),
                "probabilitySnapshotHash", probabilityHash(grant.chestType), "pityEnabled", false));
    }

    public synchronized Map<String, Object> openChest(long userId, String chestGrantId, String idempotencyKey) {
        requireUser(userId); requireKey(idempotencyKey);
        return idempotent(userId, "chest-open:" + chestGrantId, idempotencyKey, map("chestGrantId", chestGrantId), () -> {
            if (!flag("chest")) throw error("GAM_FEATURE_DISABLED", "chest feature is disabled", 409, false);
            ChestGrant grant = ownedChest(userId, chestGrantId);
            if (grant.opened) return success(map("opened", false, "replayed", true, "reasonCode", "ALREADY_OPENED", "auditId", grant.auditId,
                    "tierCode", grant.tierCode, "itemCode", grant.itemCode, "duplicateConverted", grant.duplicateConverted,
                    "shardAmount", grant.shardAmount, "probabilityVersion", grant.probabilityVersion));
            if (!"GRANTED".equals(grant.status)) throw error("GAM_CHEST_NOT_OPENABLE", "chest grant is not openable", 409, false);
            String secret = chestSecret();
            int randomBps = hmacBps(secret, grant.probabilityVersion, grant.id, 0);
            String tier = tierFor(grant.chestType, randomBps);
            String itemCode = itemForTier(tier);
            AccountState account = account(userId); InventoryState inventory = inventory(userId);
            boolean duplicate = inventory.quantity(itemCode) > 0;
            String requestId = newRequestId();
            int shardAmount = duplicate ? DUPLICATE_DUST.getOrDefault(ITEM_DEFINITIONS.get(itemCode).quality(), 0) : 0;
            if (duplicate) applyCurrency(userId, grant.id, grant.id, "CHEST_DUPLICATE", STAR_DUST, shardAmount, idempotencyKey, requestId);
            else grantInventory(userId, itemCode, 1, grant.id, "CHEST_REWARD", idempotencyKey, requestId);
            String auditId = "CHEST-AUDIT-" + UUID.randomUUID();
            grant.opened = true; grant.status = "OPENED"; grant.tierCode = tier; grant.itemCode = itemCode;
            grant.duplicateConverted = duplicate; grant.shardAmount = shardAmount; grant.auditId = auditId;
            grant.seedCommit = sha256Hex(hmacBytes(secret, grant.probabilityVersion + "|" + grant.id + "|seed"));
            appendFact("GAM_CHEST_OPEN", grant.id, userId, idempotencyKey, requestId, "gamification.chest.opened.v1",
                    map("status", "OPENED", "auditId", auditId, "chestGrantId", grant.id, "probabilityVersion", grant.probabilityVersion,
                            "algorithmVersion", CHEST_ALGORITHM, "seedCommit", grant.seedCommit, "probabilitySnapshotHash", probabilityHash(grant.chestType),
                            "randomBps", randomBps, "tierCode", tier, "itemCode", itemCode, "duplicateConverted", duplicate,
                            "shardAmount", shardAmount, "sourceEventId", grant.sourceEventId));
            return envelope(requestId, map("opened", true, "replayed", false, "auditId", auditId, "chestGrantId", grant.id,
                    "chestType", grant.chestType, "tierCode", tier, "itemCode", itemCode, "duplicateConverted", duplicate,
                    "shardAmount", shardAmount, "probabilityVersion", grant.probabilityVersion, "probabilitySnapshotHash", probabilityHash(grant.chestType),
                    "balanceAfter", balanceView(account), "ruleVersion", RULE_VERSION));
        });
    }

    public synchronized Map<String, Object> collection(long userId) {
        requireUser(userId);
        InventoryState inventory = inventory(userId);
        List<Map<String, Object>> owned = inventory.items.entrySet().stream().filter(entry -> ITEM_DEFINITIONS.containsKey(entry.getKey()))
                .map(entry -> map("itemCode", entry.getKey(), "quantity", entry.getValue(), "quality", ITEM_DEFINITIONS.get(entry.getKey()).quality())).toList();
        return success(map("ownedItems", owned, "dustBalance", balance(account(userId), STAR_DUST),
                "sets", List.of(map("setCode", "STAR_BADGES", "collected", inventory.items.size(), "total", 5)), "ruleVersion", RULE_VERSION));
    }

    public synchronized Map<String, Object> catalog(long userId) {
        requireUser(userId);
        return success(map("catalogVersion", "CATALOG_2026_08_20_01", "items", CATALOG_PRICES.entrySet().stream()
                .map(entry -> map("catalogItemId", entry.getKey(), "priceCoins", entry.getValue(), "currencyCode", STAR_COIN,
                        "kind", entry.getKey().endsWith("ITEM") ? "COSMETIC" : "UTILITY", "randomized", false, "status", "PUBLISHED")).toList(), "ruleVersion", RULE_VERSION));
    }

    public synchronized Map<String, Object> redeem(long userId, String catalogItemId, String idempotencyKey) {
        requireUser(userId); requireKey(idempotencyKey);
        return idempotent(userId, "catalog-redeem:" + catalogItemId, idempotencyKey, map("catalogItemId", catalogItemId), () -> {
            requireFeature("gamification");
            Integer price = CATALOG_PRICES.get(catalogItemId);
            if (price == null) throw error("GAM_CATALOG_NOT_FOUND", "catalog item does not exist", 404, false);
            AccountState account = account(userId);
            if (balance(account, STAR_COIN) < price) throw error("INSUFFICIENT_BALANCE", "not enough star coins", 409, false);
            String requestId = newRequestId(); String settlementId = "REDEEM-" + UUID.randomUUID();
            applyCurrency(userId, settlementId, settlementId, "CATALOG_REDEEM", STAR_COIN, -price, idempotencyKey, requestId);
            if ("STREAK_FREEZE_CARD".equals(catalogItemId)) applyCurrency(userId, settlementId, settlementId + ":freeze", "CATALOG_REDEEM", STREAK_FREEZE, 1, idempotencyKey, requestId);
            else if (ITEM_DEFINITIONS.containsKey(catalogItemId)) grantInventory(userId, catalogItemId, 1, settlementId, "CATALOG_REDEEM", idempotencyKey, requestId);
            appendFact("GAM_CATALOG_REDEEM", settlementId, userId, idempotencyKey, requestId, "gamification.currency.ledger_appended.v1",
                    map("status", "REDEEMED", "catalogItemId", catalogItemId, "catalogVersion", "CATALOG_2026_08_20_01", "priceCoins", price, "settlementId", settlementId));
            return envelope(requestId, map("redeemed", true, "catalogItemId", catalogItemId, "catalogVersion", "CATALOG_2026_08_20_01",
                    "balanceAfter", balanceView(account), "profile", profileView(userId, account), "ruleVersion", RULE_VERSION));
        });
    }

    public synchronized Map<String, Object> currentSeason(long userId) {
        requireUser(userId); AccountState account = account(userId);
        return success(map("seasonId", CURRENT_SEASON, "title", "星尘航线", "status", "ACTIVE", "points", account.seasonPoints,
                "ruleVersion", RULE_VERSION, "tiers", List.of(map("tier", 1, "requiredPoints", 0), map("tier", 2, "requiredPoints", 500),
                        map("tier", 3, "requiredPoints", 1000), map("tier", 4, "requiredPoints", 2000))));
    }

    public synchronized Map<String, Object> seasonRewards(long userId, String seasonId) {
        requireUser(userId);
        if (!CURRENT_SEASON.equals(seasonId)) throw error("GAM_SEASON_NOT_FOUND", "season does not exist", 404, false);
        return success(map("seasonId", seasonId, "items", List.of(map("tier", 1, "rewardCode", "COMMON_ITEM", "randomized", false),
                map("tier", 2, "rewardCode", "RARE_ITEM", "randomized", false), map("tier", 3, "rewardCode", "EPIC_ITEM", "randomized", false))));
    }

    public synchronized Map<String, Object> avatarProfile(long userId) {
        requireUser(userId); return success(map("profile", avatar(userId).profile, "featureEnabled", flag("avatar"), "ruleVersion", RULE_VERSION));
    }

    public synchronized Map<String, Object> saveAvatarProfile(long userId, Map<String, Object> request, String idempotencyKey) {
        requireUser(userId); requireKey(idempotencyKey); Map<String, Object> body = safeBody(request); rejectUnknownFields(body, Set.of("resourceVersion", "renderMode"));
        return idempotent(userId, "avatar-profile", idempotencyKey, body, () -> {
            requireFeature("avatar"); AvatarState state = avatar(userId);
            String resourceVersion = text(body.get("resourceVersion"), String.valueOf(state.profile.get("resourceVersion")));
            if (!AVATAR_RESOURCE_VERSION.equals(resourceVersion)) throw error("AVATAR_RESOURCE_VERSION_INVALID", "resource version is not published", 409, false);
            String renderMode = allowedRenderMode(text(body.get("renderMode"), "2D_FALLBACK"));
            state.configVersion++; state.profile.put("resourceVersion", resourceVersion); state.profile.put("renderMode", renderMode); state.profile.put("configVersion", state.configVersion);
            String requestId = newRequestId();
            appendFact("GAM_AVATAR_PROFILE", String.valueOf(userId), userId, idempotencyKey, requestId, "gamification.profile.updated.v1",
                    map("status", "SAVED", "resourceVersion", resourceVersion, "renderMode", renderMode, "configVersion", state.configVersion));
            return envelope(requestId, map("profile", new LinkedHashMap<>(state.profile), "saved", true, "ruleVersion", RULE_VERSION));
        });
    }

    public synchronized Map<String, Object> avatarItems(long userId) {
        requireUser(userId); InventoryState inventory = inventory(userId);
        List<Map<String, Object>> items = ITEM_DEFINITIONS.values().stream().map(item -> map("itemCode", item.itemCode(), "quality", item.quality(), "slot", item.slot(),
                "resourceVersion", item.resourceVersion(), "owned", inventory.quantity(item.itemCode()) > 0, "quantity", inventory.quantity(item.itemCode()), "status", "PUBLISHED")).toList();
        return success(map("items", items, "fallback", "2D_FALLBACK", "performanceTiers", List.of("Ultra", "High", "Medium", "Performance")));
    }

    public synchronized Map<String, Object> avatarLoadouts(long userId) {
        requireUser(userId); return success(map("items", loadouts(userId).values().stream().map(Loadout::view).toList(), "ruleVersion", RULE_VERSION));
    }

    public synchronized Map<String, Object> saveAvatarLoadout(long userId, String loadoutId, Map<String, Object> request, String idempotencyKey) {
        requireUser(userId); requireKey(idempotencyKey); Map<String, Object> body = safeBody(request); rejectUnknownFields(body, Set.of("name", "itemCodes", "resourceVersion"));
        if (loadoutId == null || loadoutId.isBlank() || loadoutId.length() > 96) throw error("GAM_SCHEMA_INVALID", "loadoutId is required", 400, false);
        return idempotent(userId, "avatar-loadout:" + loadoutId, idempotencyKey, body, () -> {
            requireFeature("avatar"); String name = text(body.get("name"), "未命名装扮");
            if (name.length() > 120) throw error("GAM_SCHEMA_INVALID", "name is too long", 400, false);
            List<String> itemCodes = stringList(body.getOrDefault("itemCodes", List.of()), 20, "itemCodes"); validateOwnedLoadout(userId, itemCodes);
            String resourceVersion = text(body.get("resourceVersion"), AVATAR_RESOURCE_VERSION);
            if (!AVATAR_RESOURCE_VERSION.equals(resourceVersion)) throw error("AVATAR_RESOURCE_VERSION_INVALID", "resource version is not published", 409, false);
            Set<String> slots = new HashSet<>();
            for (String itemCode : itemCodes) if (!slots.add(ITEM_DEFINITIONS.get(itemCode).slot())) throw error("GAM_LOADOUT_SLOT_CONFLICT", "only one item per slot is allowed", 409, false);
            Loadout loadout = loadouts(userId).computeIfAbsent(loadoutId, ignored -> new Loadout(loadoutId, userId));
            loadout.name = name; loadout.itemCodes = new ArrayList<>(itemCodes); loadout.resourceVersion = resourceVersion; loadout.versionNo++;
            String requestId = newRequestId();
            appendFact("GAM_AVATAR_LOADOUT", loadoutId, userId, idempotencyKey, requestId, "gamification.avatar.loadout_equipped.v1",
                    map("status", "SAVED", "loadoutId", loadoutId, "name", name, "itemCodes", itemCodes, "resourceVersion", resourceVersion, "versionNo", loadout.versionNo));
            return envelope(requestId, map("loadout", loadout.view(), "saved", true, "ruleVersion", RULE_VERSION));
        });
    }

    public synchronized Map<String, Object> equipAvatarLoadout(long userId, String loadoutId, String idempotencyKey) {
        requireUser(userId); requireKey(idempotencyKey);
        return idempotent(userId, "avatar-equip:" + loadoutId, idempotencyKey, map("loadoutId", loadoutId), () -> {
            requireFeature("avatar"); Loadout selected = loadouts(userId).get(loadoutId);
            if (selected == null) throw error("GAM_LOADOUT_NOT_FOUND", "loadout does not exist", 404, false);
            validateOwnedLoadout(userId, selected.itemCodes); for (Loadout loadout : loadouts(userId).values()) loadout.equipped = false; selected.equipped = true;
            AvatarState avatar = avatar(userId); avatar.profile.put("loadoutId", loadoutId); String requestId = newRequestId();
            appendFact("GAM_AVATAR_LOADOUT", loadoutId, userId, idempotencyKey, requestId, "gamification.avatar.loadout_equipped.v1",
                    map("status", "EQUIPPED", "loadoutId", loadoutId, "versionNo", selected.versionNo, "slotCount", selected.itemCodes.size(), "resourceVersion", selected.resourceVersion));
            return envelope(requestId, map("loadoutId", loadoutId, "equipped", true, "resourceVersion", selected.resourceVersion, "ruleVersion", RULE_VERSION));
        });
    }

    public synchronized Map<String, Object> avatarResources(long userId) {
        requireUser(userId); return success(map("resourceVersion", AVATAR_RESOURCE_VERSION, "manifestHash", "sha256:b4-avatar-manifest", "fallbackMode", "2D_FALLBACK",
                "performanceTiers", List.of("Ultra", "High", "Medium", "Performance"), "published", true, "ruleVersion", RULE_VERSION));
    }

    public synchronized Map<String, Object> studySpace(long userId) {
        requireUser(userId); return success(map("space", space(userId).view(), "featureEnabled", flag("avatar"), "ruleVersion", RULE_VERSION));
    }

    public synchronized Map<String, Object> saveStudySpace(long userId, Map<String, Object> request, String idempotencyKey) {
        return saveStudySpace(userId, request, idempotencyKey, null);
    }

    public synchronized Map<String, Object> saveStudySpace(long userId, Map<String, Object> request, String idempotencyKey, String ifMatch) {
        requireUser(userId); requireKey(idempotencyKey); Map<String, Object> body = safeBody(request); rejectUnknownFields(body, Set.of("renderMode", "placements"));
        return idempotent(userId, "study-space", idempotencyKey, body, () -> {
            requireFeature("avatar"); StudySpaceState state = space(userId);
            if (ifMatch != null && !ifMatch.isBlank() && parseVersion(ifMatch) != state.versionNo) throw error("VERSION_CONFLICT", "study space version changed", 409, false);
            String renderMode = allowedRenderMode(text(body.get("renderMode"), state.renderMode));
            List<Map<String, Object>> placements = validatePlacements(userId, body.getOrDefault("placements", state.placements));
            state.versionNo++; state.renderMode = renderMode; state.placements = placements; String requestId = newRequestId();
            appendFact("GAM_STUDY_SPACE", state.spaceId, userId, idempotencyKey, requestId, "gamification.profile.updated.v1",
                    map("status", "SAVED", "spaceId", state.spaceId, "versionNo", state.versionNo, "renderMode", renderMode, "placements", placements));
            return envelope(requestId, map("space", state.view(), "saved", true, "ruleVersion", RULE_VERSION));
        });
    }

    /** Profile currently carries the growth projection; this method preserves a dedicated service seam for a future contract path. */
    public synchronized Map<String, Object> galaxyProgress(long userId) { requireUser(userId); return success(galaxyView(userId)); }

    public synchronized Map<String, Object> gameCatalog(long userId) {
        requireUser(userId);
        List<Map<String, Object>> items = GAME_DEFINITIONS.values().stream().map(definition -> map("gameCode", definition.code(), "title", definition.title(),
                "enabled", gameEnabled(definition), "featureFlag", definition.featureFlag(), "requiredRounds", definition.requiredRounds(),
                "minimumRounds", definition.minimumRounds(), "maxMinutes", definition.maxMinutes(), "pauseLimitMinutes", definition.pauseLimitMinutes(),
                "passAccuracyPercent", 60, "rewardAccuracyPercent", 80)).toList();
        return success(map("items", items, "performanceTiers", List.of("Ultra", "High", "Medium", "Performance"), "ruleVersion", RULE_VERSION));
    }

    public synchronized Map<String, Object> createGameSession(long userId, Map<String, Object> request, String idempotencyKey) {
        requireUser(userId); requireKey(idempotencyKey); Map<String, Object> body = safeBody(request); rejectUnknownFields(body, Set.of("gameCode", "contentVersionId", "performanceTier"));
        return idempotent(userId, "game-create", idempotencyKey, body, () -> {
            String gameCode = requiredText(body, "gameCode", 1, 64); GameDefinition definition = GAME_DEFINITIONS.get(gameCode);
            if (definition == null) throw error("GAM_GAME_NOT_FOUND", "game does not exist", 404, false);
            if (!gameEnabled(definition)) { recordFeatureBlocked(userId, gameCode, definition.featureFlag(), idempotencyKey); throw error("GAM_FEATURE_DISABLED", "game feature is disabled", 409, false); }
            AccountState account = account(userId); String dayKey = today(userId).toString(); int starts = account.gameStartsByDate.getOrDefault(dayKey, 0);
            if (starts >= 20) throw error("GAM_GAME_START_CAP", "daily game start cap reached", 429, false);
            String performanceTier = text(body.get("performanceTier"), "Performance");
            if (!Set.of("Ultra", "High", "Medium", "Performance").contains(performanceTier)) throw error("GAM_SCHEMA_INVALID", "performanceTier is invalid", 400, false);
            String sessionId = "GAME-" + UUID.randomUUID(); GameSession session = GameSession.create(sessionId, userId, definition, performanceTier, clock.instant());
            gameSessions.put(sessionId, session); account.gameStartsByDate.put(dayKey, starts + 1); String requestId = newRequestId();
            appendFact("GAM_GAME_SESSION", sessionId, userId, idempotencyKey, requestId, "games.session.created.v1", session.factPayload("READY", null));
            return envelope(requestId, map("session", session.view(), "ruleVersion", RULE_VERSION));
        });
    }

    public synchronized Map<String, Object> gameSession(long userId, String sessionId) {
        requireUser(userId); GameSession session = ownedGame(userId, sessionId); expireIfNeeded(session, userId, "game-read");
        return success(map("session", session.view(), "ruleVersion", RULE_VERSION));
    }

    public synchronized Map<String, Object> submitGameEvent(long userId, String sessionId, Map<String, Object> request, String idempotencyKey) {
        requireUser(userId); requireKey(idempotencyKey); Map<String, Object> body = safeBody(request); rejectUnknownFields(body, Set.of("eventId", "seq", "itemCode", "responseToken"));
        return idempotent(userId, "game-event:" + sessionId + ":" + text(body.get("eventId"), "missing"), idempotencyKey, body, () -> {
            GameSession session = ownedGame(userId, sessionId); expireIfNeeded(session, userId, idempotencyKey);
            if (!("READY".equals(session.status) || "IN_PROGRESS".equals(session.status))) throw error("GAM_GAME_STATE_INVALID", "game is not accepting events", 409, false);
            String eventId = requiredText(body, "eventId", 8, 128); int seq = intValue(body.get("seq"), "seq");
            if (seq < 1 || seq != session.seq + 1) throw error("GAM_GAME_SEQUENCE_INVALID", "event sequence must increase by one", 409, false);
            String responseToken = requiredText(body, "responseToken", 1, 128); String itemCode = requiredText(body, "itemCode", 1, 128);
            String eventFingerprint = bodyFingerprint(body);
            if (session.eventFingerprints.containsKey(eventId)) {
                if (!eventFingerprint.equals(session.eventFingerprints.get(eventId))) throw error("GAM_IDEMPOTENCY_CONFLICT", "eventId was reused with a different request", 409, false);
                return session.eventResults.get(eventId);
            }
            int attemptIndex = session.attempts; boolean correct = itemCode.equals(session.itemCodes.get(attemptIndex)) && responseToken.equals(session.expectedTokens.get(attemptIndex));
            session.seq = seq; session.status = "IN_PROGRESS"; session.attempts++; session.correct += correct ? 1 : 0; session.lastEventAt = clock.instant(); session.combo = correct ? session.combo + 1 : 0;
            String requestId = newRequestId(); Map<String, Object> result = envelope(requestId, map("accepted", true, "eventId", eventId, "seq", seq,
                    "correct", correct, "attemptCount", session.attempts, "correctCount", session.correct, "combo", session.combo, "session", session.view(), "ruleVersion", RULE_VERSION));
            session.eventFingerprints.put(eventId, eventFingerprint); session.eventResults.put(eventId, result);
            appendFact("GAM_GAME_SESSION_EVENT", eventId, userId, idempotencyKey, requestId, "games.session.event_accepted.v1",
                    map("status", "ACCEPTED", "sessionId", session.id, "eventId", eventId, "seq", seq, "itemCode", itemCode, "responseHash", sha256Hex(responseToken), "correct", correct, "attemptNo", session.attempts));
            appendFact("GAM_GAME_SESSION", session.id, userId, idempotencyKey, requestId, "games.session.event_accepted.v1", session.factPayload("IN_PROGRESS", eventId));
            return result;
        });
    }

    public synchronized Map<String, Object> pauseGame(long userId, String sessionId, String idempotencyKey) {
        requireUser(userId); requireKey(idempotencyKey); return idempotent(userId, "game-pause:" + sessionId, idempotencyKey, map(), () -> transitionGame(userId, sessionId, "PAUSED", idempotencyKey));
    }

    public synchronized Map<String, Object> resumeGame(long userId, String sessionId, String idempotencyKey) {
        requireUser(userId); requireKey(idempotencyKey); return idempotent(userId, "game-resume:" + sessionId, idempotencyKey, map(), () -> transitionGame(userId, sessionId, "IN_PROGRESS", idempotencyKey));
    }

    public synchronized Map<String, Object> finishGame(long userId, String sessionId, String idempotencyKey) {
        requireUser(userId); requireKey(idempotencyKey);
        return idempotent(userId, "game-finish:" + sessionId, idempotencyKey, map(), () -> {
            GameSession session = ownedGame(userId, sessionId); expireIfNeeded(session, userId, idempotencyKey);
            if ("COMPLETED".equals(session.status) || "ABORTED".equals(session.status)) return session.finishResult == null ? success(map("sessionId", session.id, "status", session.status)) : session.finishResult;
            if (!("READY".equals(session.status) || "IN_PROGRESS".equals(session.status) || "PAUSED".equals(session.status))) throw error("GAM_GAME_STATE_INVALID", "game cannot be finished", 409, false);
            int completion = session.requiredRounds == 0 ? 0 : Math.min(100, session.attempts * 100 / session.requiredRounds); int accuracy = session.attempts == 0 ? 0 : session.correct * 100 / session.attempts;
            boolean completedEnough = completion >= 80; boolean passed = completedEnough && accuracy >= 60; boolean rewardEligible = completedEnough && accuracy >= 80;
            if (session.attempts < session.minimumRounds) { session.status = "ABORTED"; passed = false; rewardEligible = false; } else session.status = "COMPLETED";
            int serverScore = (int) Math.round(accuracy * 0.7d + completion * 0.3d); String requestId = newRequestId();
            Map<String, Object> reward = map("accepted", false, "reasonCode", "NOT_ELIGIBLE");
            if (rewardEligible) reward = settleGameReward(userId, session, idempotencyKey, requestId);
            if (passed) onAcceptedLearningEvent(userId, "GAME_SESSION_QUALIFIED", session.id, 0);
            if (rewardEligible) triedGames.computeIfAbsent(userId, ignored -> new LinkedHashSet<>()).add(session.gameCode);
            if (rewardEligible) wonGames.merge(userId, 1, Integer::sum);
            Map<String, Object> data = map("sessionId", session.id, "gameCode", session.gameCode, "status", session.status, "passed", passed, "accuracyPercent", accuracy,
                    "completionPercent", completion, "serverScore", serverScore, "rewardEligible", rewardEligible, "reward", reward, "scoringMode", "SERVER_ACCURACY_COMPLETION", "ruleVersion", RULE_VERSION);
            session.finishData = data; session.finishResult = envelope(requestId, data);
            appendFact("GAM_GAME_SESSION", session.id, userId, idempotencyKey, requestId, "games.session.completed.v1", session.factPayload(session.status, null,
                    map("passed", passed, "accuracyPercent", accuracy, "completionPercent", completion, "serverScore", serverScore, "rewardEligible", rewardEligible, "rewardAccepted", booleanField(reward, "accepted", false))));
            if (passed) updateGameAchievements(userId, session, rewardEligible);
            return session.finishResult;
        });
    }

    public static long threshold(int level) { if (level <= 1) return 0; return 100L * (level - 1) * level / 2; }

    public static int levelFor(long xp) {
        if (xp < 0) throw new IllegalArgumentException("xp cannot be negative"); int level = 1; while (level < 100 && xp >= threshold(level + 1)) level++; return level;
    }

    public static String rankFor(int level) {
        if (level < 1) throw new IllegalArgumentException("level must be positive"); return level <= 10 ? "STAR_DUST_APPRENTICE" : level <= 30 ? "ORBIT_EXPLORER" : level <= 60 ? "STELLAR_NAVIGATOR" : "GALAXY_MASTER";
    }

    private void onAcceptedLearningEvent(long userId, String sourceType, String sourceEventId, int earnedXp) {
        AccountState account = account(userId);
        if (EFFECTIVE_LEARNING_SOURCES.contains(sourceType)) recordLearningDay(userId, today(userId), sourceEventId);
        if (Set.of("LESSON_COMPLETE", "READING_COMPLETE", "LISTENING_COMPLETE", "WRITING_SUBMISSION", "CHECKPOINT_PASS", "DAILY_GOAL_REACHED", "GAME_SESSION_QUALIFIED").contains(sourceType)) incrementAchievementCounter(userId, "LEARNING", 1);
        incrementAchievementCounter(userId, sourceType, 1); progressQuests(userId, sourceType, sourceEventId); updateSeasonPoints(userId, sourceEventId, earnedXp); updateGalaxy(userId, sourceType, sourceEventId); evaluateAchievements(userId); account.seasonJoined = true;
    }

    private void recordLearningDay(long userId, LocalDate day, String sourceEventId) {
        StreakState state = streak(userId, true); if (!state.validDates.add(day)) return;
        if (state.lastValidDate == null) state.currentStreak = 1;
        else if (day.isAfter(state.lastValidDate)) {
            boolean requiredGap = false; for (LocalDate cursor = state.lastValidDate.plusDays(1); cursor.isBefore(day); cursor = cursor.plusDays(1)) if (!isNonRequiredDate(state, cursor)) { requiredGap = true; break; }
            state.currentStreak = requiredGap ? 1 : state.currentStreak + 1;
        }
        if (state.lastValidDate == null || day.isAfter(state.lastValidDate)) state.lastValidDate = day;
        state.maxStreak = Math.max(state.maxStreak, state.currentStreak); state.rescuedDates.removeIf(date -> state.lastValidDate != null && date.isBefore(state.lastValidDate));
        String requestId = newRequestId();
        appendFact("GAM_STREAK_DAY", userId + ":" + day, userId, sourceEventId, requestId, "gamification.streak.day_validated.v1",
                map("status", "QUALIFIED", "localDate", day, "sourceEventId", sourceEventId, "timeZone", state.timeZone.getId(), "currentStreak", state.currentStreak, "maxStreak", state.maxStreak));
    }

    private void progressQuests(long userId, String sourceType, String sourceEventId) {
        for (QuestDefinition definition : QUEST_DEFINITIONS) {
            QuestState state = questState(userId, definition); if (!state.progressEventIds.add(sourceEventId)) continue;
            int delta = switch (definition.id()) { case "DAILY_20_MIN" -> EFFECTIVE_LEARNING_SOURCES.contains(sourceType) ? 1 : 0; case "DAILY_REVIEW_10" -> "REVIEW_BATCH_COMPLETE".equals(sourceType) ? 5 : 0; case "WEEKLY_FOCUS_5" -> EFFECTIVE_LEARNING_SOURCES.contains(sourceType) ? 1 : 0; default -> 0; };
            if (delta <= 0) continue; state.progress = Math.min(definition.target(), state.progress + delta);
            appendFact("GAM_QUEST_PROGRESS", definition.id(), userId, sourceEventId, newRequestId(), "gamification.quest.progressed.v1",
                    map("status", state.completed(definition) ? "COMPLETED" : "IN_PROGRESS", "questId", definition.id(), "periodStart", state.periodStart, "sourceEventId", sourceEventId, "progressDelta", delta, "progressAfter", state.progress));
        }
    }

    private void updateSeasonPoints(long userId, String sourceEventId, int earnedXp) {
        if (earnedXp <= 0) return; AccountState account = account(userId); LocalDate today = today(userId); String day = today.toString(); int used = account.seasonPointsByDate.getOrDefault(day, 0); int delta = Math.min(earnedXp, Math.max(0, 200 - used)); if (delta == 0) return;
        account.seasonPoints += delta; account.seasonPointsByDate.put(day, used + delta);
        appendFact("GAM_SEASON", CURRENT_SEASON, userId, sourceEventId, newRequestId(), "gamification.season.points_updated.v1", map("status", "ACTIVE", "seasonId", CURRENT_SEASON, "sourceEventId", sourceEventId, "deltaPoints", delta, "pointsAfter", account.seasonPoints));
    }

    private void updateGalaxy(long userId, String sourceType, String sourceEventId) {
        if (!flag("galaxy")) return; GalaxyState state = galaxyStates.computeIfAbsent(userId, ignored -> new GalaxyState()); String nodeCode = nodeForSource(sourceType); int progress = state.nodeProgress.merge(nodeCode, 1, Integer::sum); int required = nodeRequirement(nodeCode); if (progress >= required) state.unlocked.add(nodeCode); state.lastSourceEventId = sourceEventId;
        appendFact("GAM_GALAXY_PROGRESS", nodeCode, userId, sourceEventId, newRequestId(), "gamification.profile.updated.v1", map("status", state.unlocked.contains(nodeCode) ? "UNLOCKED" : "IN_PROGRESS", "nodeCode", nodeCode, "sourceType", sourceType, "sourceEventId", sourceEventId, "progressAfter", progress, "requiredProgress", required, "unlocked", state.unlocked.contains(nodeCode)));
    }

    private void evaluateAchievements(long userId) {
        for (AchievementDefinition definition : ACHIEVEMENT_DEFINITIONS) {
            AchievementState state = achievementState(userId, definition.code()); state.progress = Math.max(state.progress, achievementProgress(userId, definition)); if (state.unlocked || state.progress < definition.target()) continue;
            state.unlocked = true; state.unlockedAt = clock.instant(); String requestId = newRequestId(); String settlementId = "ACHIEVEMENT-" + definition.code();
            applyAssets(userId, settlementId, settlementId, "ACHIEVEMENT_REWARD", definition.xpReward(), definition.coinReward(), "achievement-" + definition.code(), requestId);
            appendFact("GAM_ACHIEVEMENT", definition.code(), userId, settlementId, requestId, "gamification.achievement.unlocked.v1", map("status", "UNLOCKED", "achievementCode", definition.code(), "progress", state.progress, "target", definition.target(), "unlockedAt", state.unlockedAt.toString(), "deltaXp", definition.xpReward(), "deltaCoins", definition.coinReward(), "settlementId", settlementId));
        }
    }

    private void updateGameAchievements(long userId, GameSession session, boolean rewarded) {
        triedGames.computeIfAbsent(userId, ignored -> new LinkedHashSet<>()).add(session.gameCode); if (rewarded) wonGames.merge(userId, 1, Integer::sum); evaluateAchievements(userId);
    }

    private Map<String, Object> settleGameReward(long userId, GameSession session, String idempotencyKey, String requestId) {
        AccountState account = account(userId); String day = today(userId).toString(); int count = account.gameRewardCountByDate.getOrDefault(day, 0); if (count >= 3) return map("accepted", false, "reasonCode", "DAILY_GAME_REWARD_CAP", "ruleVersion", RULE_VERSION);
        RewardRule rule = REWARD_RULES.get("GAME_SESSION_QUALIFIED"); String settlementId = "GAME-REWARD-" + session.id; applyAssets(userId, settlementId, session.id, rule.reasonCode(), rule.xp(), rule.coins(), idempotencyKey, requestId); account.gameRewardCountByDate.put(day, count + 1);
        return map("accepted", true, "settlementId", settlementId, "deltaXp", rule.xp(), "deltaCoins", rule.coins(), "balanceAfter", balanceView(account), "ruleVersion", RULE_VERSION);
    }

    private void applyAssets(long userId, String settlementId, String sourceEventId, String reasonCode, int deltaXp, int deltaCoins, String idempotencyKey, String requestId) {
        if (deltaXp > 0) appendXp(userId, settlementId, sourceEventId, reasonCode, deltaXp, idempotencyKey, requestId); if (deltaCoins != 0) appendCurrency(userId, settlementId, sourceEventId, reasonCode, STAR_COIN, deltaCoins, idempotencyKey, requestId);
    }

    private void appendXp(long userId, String settlementId, String sourceEventId, String reasonCode, int deltaXp, String idempotencyKey, String requestId) {
        AccountState account = account(userId); String key = sourceEventId + "|" + reasonCode + "|" + RULE_VERSION; if (account.xpSettlementKeys.contains(key)) return; long balanceAfter = account.xp + deltaXp;
        Map<String, Object> payload = map("status", "APPENDED", "settlementId", settlementId, "sourceEventId", sourceEventId, "reasonCode", reasonCode, "deltaXp", deltaXp, "balanceAfter", balanceAfter, "ruleVersion", RULE_VERSION);
        appendFact("GAM_XP", settlementId, userId, idempotencyKey, requestId, "gamification.xp.ledger_appended.v1", payload); account.xp = balanceAfter; account.versionNo++; account.xpSettlementKeys.add(key); account.xpLedger.add(withOccurredAt(payload));
    }

    private void applyCurrency(long userId, String settlementId, String sourceEventId, String reasonCode, String currencyCode, long delta, String idempotencyKey, String requestId) { if (delta != 0) appendCurrency(userId, settlementId, sourceEventId, reasonCode, currencyCode, delta, idempotencyKey, requestId); }

    private void appendCurrency(long userId, String settlementId, String sourceEventId, String reasonCode, String currencyCode, long delta, String idempotencyKey, String requestId) {
        AccountState account = account(userId); String key = currencyCode + "|" + sourceEventId + "|" + reasonCode + "|" + RULE_VERSION; if (account.currencySettlementKeys.contains(key)) return; long before = balance(account, currencyCode); long after = before + delta; if (after < 0) throw error("INSUFFICIENT_BALANCE", "currency balance cannot be negative", 409, false);
        Map<String, Object> payload = map("status", "APPENDED", "settlementId", settlementId, "sourceEventId", sourceEventId, "reasonCode", reasonCode, "currencyCode", currencyCode, "amountDelta", delta, "deltaCoins", STAR_COIN.equals(currencyCode) ? delta : 0, "balanceAfter", after, "ruleVersion", RULE_VERSION);
        appendFact("GAM_CURRENCY", settlementId + ":" + currencyCode, userId, idempotencyKey, requestId, delta < 0 ? "gamification.coins.spent.v1" : "gamification.currency.ledger_appended.v1", payload); account.balances.put(currencyCode, after); account.versionNo++; account.currencySettlementKeys.add(key); account.currencyLedger.add(withOccurredAt(payload));
    }

    private void grantInventory(long userId, String itemCode, int quantity, String sourceEventId, String reasonCode, String idempotencyKey, String requestId) {
        if (!ITEM_DEFINITIONS.containsKey(itemCode)) throw error("GAM_ITEM_NOT_FOUND", "item does not exist", 404, false); InventoryState inventory = inventory(userId); int after = inventory.quantity(itemCode) + quantity; inventory.items.put(itemCode, after);
        appendFact("GAM_INVENTORY", itemCode, userId, idempotencyKey, requestId, "gamification.profile.updated.v1", map("status", "GRANTED", "itemCode", itemCode, "quantityDelta", quantity, "quantityAfter", after, "sourceEventId", sourceEventId, "reasonCode", reasonCode, "quality", ITEM_DEFINITIONS.get(itemCode).quality()));
    }

    private void grantChestForLearningEvent(long userId, String sourceType, String sourceEventId, String idempotencyKey, String requestId) {
        String type = switch (sourceType) { case "DAILY_GOAL_REACHED", "QUEST_COMPLETED" -> "BRONZE"; case "CHECKPOINT_PASS", "STREAK_MILESTONE" -> "SILVER"; default -> null; };
        if (type != null && flag("chest")) grantChest(userId, type, sourceEventId, idempotencyKey, requestId);
    }

    private ChestGrant grantChest(long userId, String chestType, String sourceEventId, String idempotencyKey, String requestId) {
        for (ChestGrant existing : chestGrants.values()) { if (existing.userId == userId && existing.sourceEventId.equals(sourceEventId)) return existing; if (existing.userId == userId && existing.chestType.equals(chestType) && Duration.between(existing.createdAt, clock.instant()).toHours() < 24) return existing; }
        String id = "CHEST-" + UUID.randomUUID(); ChestGrant grant = new ChestGrant(id, userId, chestType, sourceEventId, "CHEST_PROB_2026_08_20_01", clock.instant()); chestGrants.put(id, grant);
        appendFact("GAM_CHEST_GRANT", id, userId, idempotencyKey, requestId, "gamification.chest.granted.v1", map("status", "GRANTED", "chestGrantId", id, "chestType", chestType, "sourceType", sourceEventId.contains(":") ? "QUEST_COMPLETED" : "LEARNING_EVENT", "sourceEventId", sourceEventId, "probabilityVersion", grant.probabilityVersion, "freeOnly", true));
        return grant;
    }

    private void enforceDailyRewardCap(long userId, String sourceType, RewardRule rule) {
        AccountState account = account(userId); int count = account.dailyCounters.getOrDefault(today(userId) + ":" + sourceType, 0);
        if ("GAME_SESSION_QUALIFIED".equals(sourceType) && count >= 3) throw error("GAM_DAILY_GAME_REWARD_CAP", "daily game reward cap reached", 429, false);
        if (rule.dailyCap() > 0 && count >= rule.dailyCap()) throw error("GAM_DAILY_REWARD_CAP", "daily reward cap reached", 429, false);
    }

    private void incrementDailyCounter(AccountState account, LocalDate date, String sourceType) { account.dailyCounters.merge(date + ":" + sourceType, 1, Integer::sum); }

    private void recordFeatureBlocked(long userId, String featureCode, String flagKey, String idempotencyKey) { appendFact("GAM_FEATURE_FLAG", featureCode, userId, idempotencyKey, newRequestId(), "game.extension.feature_flag_blocked.v1", map("status", "BLOCKED", "gameCode", featureCode, "flagKey", flagKey)); }

    private Map<String, Object> transitionGame(long userId, String sessionId, String target, String idempotencyKey) {
        GameSession session = ownedGame(userId, sessionId); expireIfNeeded(session, userId, idempotencyKey);
        if ("PAUSED".equals(target)) { if (!"IN_PROGRESS".equals(session.status)) throw error("GAM_GAME_STATE_INVALID", "game cannot be paused", 409, false); session.status = "PAUSED"; session.pausedAt = clock.instant(); }
        else { if (!"PAUSED".equals(session.status)) throw error("GAM_GAME_STATE_INVALID", "game cannot be resumed", 409, false); if (session.pausedAt == null || Duration.between(session.pausedAt, clock.instant()).toMinutes() > session.pauseLimitMinutes) { session.status = "EXPIRED"; throw error("GAM_GAME_SESSION_EXPIRED", "paused game session expired", 409, false); } session.status = "IN_PROGRESS"; session.pausedAt = null; }
        String requestId = newRequestId(); appendFact("GAM_GAME_SESSION", session.id, userId, idempotencyKey, requestId, "games.session.event_accepted.v1", session.factPayload(target, null)); return envelope(requestId, map("session", session.view(), "ruleVersion", RULE_VERSION));
    }

    private void expireIfNeeded(GameSession session, long userId, String idempotencyKey) {
        if (Set.of("COMPLETED", "ABORTED", "EXPIRED").contains(session.status)) return; Instant now = clock.instant();
        if (now.isAfter(session.createdAt.plusSeconds(session.maxMinutes * 60L)) || (session.pausedAt != null && now.isAfter(session.pausedAt.plusSeconds(session.pauseLimitMinutes * 60L)))) { session.status = "EXPIRED"; appendFact("GAM_GAME_SESSION", session.id, userId, idempotencyKey, newRequestId(), "games.session.completed.v1", session.factPayload("EXPIRED", null)); throw error("GAM_GAME_SESSION_EXPIRED", "game session expired", 409, false); }
    }

    private GameSession ownedGame(long userId, String sessionId) { GameSession session = gameSessions.get(sessionId); if (session == null || session.userId != userId) throw error("GAM_GAME_SESSION_NOT_FOUND", "game session does not exist", 404, false); return session; }

    private AccountState account(long userId) { requireUser(userId); hydrateUser(userId); return accounts.computeIfAbsent(userId, ignored -> new AccountState()); }
    private StreakState streak(long userId, boolean ignored) { account(userId); return streakStates.computeIfAbsent(userId, ignoredUser -> new StreakState()); }
    private AvatarState avatar(long userId) { account(userId); return avatarStates.computeIfAbsent(userId, ignored -> new AvatarState()); }
    private InventoryState inventory(long userId) { return account(userId).inventory; }

    private Map<String, Loadout> loadouts(long userId) { account(userId); Map<String, Loadout> result = loadouts.computeIfAbsent(userId, ignored -> new LinkedHashMap<>()); result.computeIfAbsent("LOADOUT_DEFAULT", ignored -> Loadout.defaultLoadout(userId)); return result; }
    private StudySpaceState space(long userId) { account(userId); return studySpaces.computeIfAbsent(userId, ignored -> new StudySpaceState(userId)); }

    private void hydrateUser(long userId) {
        if (!hydratedUsers.add(userId)) return; AccountState account = accounts.computeIfAbsent(userId, ignored -> new AccountState());
        replayXp(userId, account); replayCurrency(userId, account); replayInventory(userId, account.inventory); replayStreak(userId); replayChest(userId); replayGames(userId, account); replayAvatar(userId); replayGalaxy(userId); replayQuests(userId); replayAchievements(userId);
    }

    private void replayXp(long userId, AccountState account) {
        for (B4DurableRepository.Fact fact : durableRepository.list("GAM_XP", userId)) { Map<String, Object> payload = fact.payload(); String key = text(payload.get("sourceEventId"), fact.aggregateId()) + "|" + text(payload.get("reasonCode"), "UNKNOWN") + "|" + text(payload.get("ruleVersion"), RULE_VERSION); if (!account.xpSettlementKeys.add(key)) continue; account.xp += intValue(payload.getOrDefault("deltaXp", 0), "deltaXp"); account.xpLedger.add(withOccurredAt(payload, fact.occurredAt())); }
    }

    private void replayCurrency(long userId, AccountState account) {
        for (B4DurableRepository.Fact fact : durableRepository.list("GAM_CURRENCY", userId)) { Map<String, Object> payload = fact.payload(); String currency = text(payload.get("currencyCode"), STAR_COIN); String key = currency + "|" + text(payload.get("sourceEventId"), fact.aggregateId()) + "|" + text(payload.get("reasonCode"), "UNKNOWN") + "|" + text(payload.get("ruleVersion"), RULE_VERSION); if (!account.currencySettlementKeys.add(key)) continue; long delta = longValue(payload.containsKey("amountDelta") ? payload.get("amountDelta") : payload.get("deltaCoins"), 0); account.balances.put(currency, balance(account, currency) + delta); account.currencyLedger.add(withOccurredAt(payload, fact.occurredAt())); }
    }

    private void replayInventory(long userId, InventoryState inventory) { for (B4DurableRepository.Fact fact : durableRepository.list("GAM_INVENTORY", userId)) { Map<String, Object> payload = fact.payload(); String itemCode = text(payload.get("itemCode"), fact.aggregateId()); int delta = intValue(payload.getOrDefault("quantityDelta", 0), "quantityDelta"); inventory.items.put(itemCode, Math.max(0, inventory.quantity(itemCode) + delta)); } }

    private void replayStreak(long userId) {
        StreakState state = streakStates.computeIfAbsent(userId, ignored -> new StreakState());
        for (B4DurableRepository.Fact fact : durableRepository.list("GAM_STREAK_SETTING", userId)) { Map<String, Object> payload = fact.payload(); String zone = text(payload.get("timeZone"), state.timeZone.getId()); try { state.timeZone = ZoneId.of(zone); } catch (DateTimeException ignored) { } state.weekendProtectionEnabled = booleanField(payload, "weekendProtectionEnabled", false); state.timeZoneChangedAt = fact.occurredAt(); }
        for (B4DurableRepository.Fact fact : durableRepository.list("GAM_STREAK_DAY", userId)) { Map<String, Object> payload = fact.payload(); LocalDate date = localDate(payload.get("localDate")); if (date == null) continue; state.validDates.add(date); if (state.lastValidDate == null || date.isAfter(state.lastValidDate)) { state.lastValidDate = date; state.currentStreak = intValue(payload.getOrDefault("currentStreak", state.currentStreak), "currentStreak"); state.maxStreak = Math.max(state.maxStreak, intValue(payload.getOrDefault("maxStreak", state.currentStreak), "maxStreak")); } }
        for (B4DurableRepository.Fact fact : durableRepository.list("GAM_STREAK_RESCUE", userId)) { LocalDate date = localDate(fact.payload().get("missingDate")); if (date != null) state.rescuedDates.add(date); }
    }

    private void replayChest(long userId) {
        for (B4DurableRepository.Fact fact : durableRepository.list("GAM_CHEST_GRANT", userId)) { Map<String, Object> payload = fact.payload(); String id = text(payload.get("chestGrantId"), fact.aggregateId()); ChestGrant grant = chestGrants.computeIfAbsent(id, ignored -> new ChestGrant(id, userId, text(payload.get("chestType"), "BRONZE"), text(payload.get("sourceEventId"), "unknown"), text(payload.get("probabilityVersion"), "CHEST_PROB_2026_08_20_01"), fact.occurredAt())); grant.seedCommit = text(payload.get("seedCommit"), grant.seedCommit); }
        for (B4DurableRepository.Fact fact : durableRepository.list("GAM_CHEST_OPEN", userId)) { Map<String, Object> payload = fact.payload(); ChestGrant grant = chestGrants.get(fact.aggregateId()); if (grant == null) continue; grant.status = "OPENED"; grant.opened = true; grant.auditId = text(payload.get("auditId"), grant.auditId); grant.seedCommit = text(payload.get("seedCommit"), grant.seedCommit); grant.tierCode = text(payload.get("tierCode"), grant.tierCode); grant.itemCode = text(payload.get("itemCode"), grant.itemCode); grant.duplicateConverted = booleanField(payload, "duplicateConverted", false); grant.shardAmount = intValue(payload.getOrDefault("shardAmount", 0), "shardAmount"); }
    }

    private void replayGames(long userId, AccountState account) {
        for (B4DurableRepository.Fact fact : durableRepository.list("GAM_GAME_SESSION", userId)) { Map<String, Object> payload = fact.payload(); String id = text(payload.get("sessionId"), fact.aggregateId()); GameDefinition definition = GAME_DEFINITIONS.get(text(payload.get("gameCode"), "SENTENCE_TRAIN")); if (definition == null) continue; GameSession session = gameSessions.computeIfAbsent(id, ignored -> GameSession.restore(id, userId, definition, payload, fact.occurredAt())); session.restore(payload); }
        for (B4DurableRepository.Fact fact : durableRepository.list("GAM_GAME_SESSION_EVENT", userId)) { String sessionId = text(fact.payload().get("sessionId"), ""); GameSession session = gameSessions.get(sessionId); if (session != null) session.seq = Math.max(session.seq, intValue(fact.payload().getOrDefault("seq", 0), "seq")); }
        for (GameSession session : gameSessions.values()) if (session.userId == userId) { account.gameStartsByDate.merge(session.createdAt.atZone(todayZone(userId)).toLocalDate().toString(), 1, Integer::sum); if ("COMPLETED".equals(session.status) && booleanField(session.finishData, "rewardEligible", false)) account.gameRewardCountByDate.merge(session.createdAt.atZone(todayZone(userId)).toLocalDate().toString(), 1, Integer::sum); }
    }

    private void replayAvatar(long userId) {
        AvatarState avatar = avatarStates.computeIfAbsent(userId, ignored -> new AvatarState());
        for (B4DurableRepository.Fact fact : durableRepository.list("GAM_AVATAR_PROFILE", userId)) { Map<String, Object> payload = fact.payload(); avatar.profile.put("resourceVersion", text(payload.get("resourceVersion"), AVATAR_RESOURCE_VERSION)); avatar.profile.put("renderMode", allowedRenderMode(text(payload.get("renderMode"), "2D_FALLBACK"))); avatar.configVersion = intValue(payload.getOrDefault("configVersion", avatar.configVersion), "configVersion"); avatar.profile.put("configVersion", avatar.configVersion); }
        for (B4DurableRepository.Fact fact : durableRepository.list("GAM_AVATAR_LOADOUT", userId)) { Map<String, Object> payload = fact.payload(); String id = text(payload.get("loadoutId"), fact.aggregateId()); Loadout loadout = loadouts(userId).computeIfAbsent(id, ignored -> new Loadout(id, userId)); loadout.name = text(payload.get("name"), loadout.name); loadout.itemCodes = stringList(payload.getOrDefault("itemCodes", List.of()), 20, "itemCodes"); loadout.resourceVersion = text(payload.get("resourceVersion"), AVATAR_RESOURCE_VERSION); loadout.versionNo = intValue(payload.getOrDefault("versionNo", loadout.versionNo), "versionNo"); if ("EQUIPPED".equals(payload.get("status"))) loadout.equipped = true; }
        for (Loadout loadout : loadouts(userId).values()) if (loadout.equipped) avatar.profile.put("loadoutId", loadout.id);
    }

    private void replayGalaxy(long userId) { GalaxyState state = galaxyStates.computeIfAbsent(userId, ignored -> new GalaxyState()); for (B4DurableRepository.Fact fact : durableRepository.list("GAM_GALAXY_PROGRESS", userId)) { Map<String, Object> payload = fact.payload(); String node = text(payload.get("nodeCode"), "ORIGIN"); int progress = intValue(payload.getOrDefault("progressAfter", 0), "progressAfter"); state.nodeProgress.put(node, Math.max(state.nodeProgress.getOrDefault(node, 0), progress)); if (booleanField(payload, "unlocked", false)) state.unlocked.add(node); state.lastSourceEventId = text(payload.get("sourceEventId"), state.lastSourceEventId); } }

    private void replayQuests(long userId) { for (B4DurableRepository.Fact fact : durableRepository.list("GAM_QUEST_PROGRESS", userId)) { Map<String, Object> payload = fact.payload(); QuestDefinition definition = questDefinitionOrNull(text(payload.get("questId"), "")); if (definition == null) continue; QuestState state = questState(userId, definition); state.progress = Math.max(state.progress, intValue(payload.getOrDefault("progressAfter", 0), "progressAfter")); state.progressEventIds.add(text(payload.get("sourceEventId"), fact.aggregateId())); } for (B4DurableRepository.Fact fact : durableRepository.list("GAM_QUEST_CLAIM", userId)) { QuestDefinition definition = questDefinitionOrNull(fact.aggregateId()); if (definition != null) questState(userId, definition).claimed = true; } }

    private void replayAchievements(long userId) { for (B4DurableRepository.Fact fact : durableRepository.list("GAM_ACHIEVEMENT", userId)) { String code = text(fact.payload().get("achievementCode"), fact.aggregateId()); AchievementState state = achievementState(userId, code); if ("UNLOCKED".equals(fact.payload().get("status"))) { state.unlocked = true; state.progress = Math.max(state.progress, intValue(fact.payload().getOrDefault("progress", 0), "progress")); String unlockedAt = text(fact.payload().get("unlockedAt"), null); state.unlockedAt = unlockedAt == null ? fact.occurredAt() : Instant.parse(unlockedAt); } if (fact.payload().containsKey("showcased")) state.showcased = booleanField(fact.payload(), "showcased", false); } }

    private Map<String, Object> existingSettlement(AccountState account, String sourceEventId) { for (Map<String, Object> entry : account.xpLedger) if (sourceEventId.equals(text(entry.get("sourceEventId"), ""))) return entry; return null; }

    private Map<String, Object> profileView(long userId, AccountState account) {
        int level = levelFor(account.xp); Map<String, Object> profile = new LinkedHashMap<>(); profile.put("userId", userId); profile.put("xp", account.xp); profile.put("level", level); profile.put("rank", rankFor(level)); profile.put("coins", balance(account, STAR_COIN)); profile.put("starDust", balance(account, STAR_DUST)); profile.put("streakFreezeCards", balance(account, STREAK_FREEZE)); profile.put("nextLevelXp", level >= 100 ? null : threshold(level + 1)); profile.put("levelProgressXp", account.xp - threshold(level)); profile.put("levelProgressTotalXp", level >= 100 ? null : threshold(level + 1) - threshold(level)); profile.put("streak", streakStates.getOrDefault(userId, new StreakState()).currentStreak); profile.put("dailyRewardCount", dailyRewardCount(account, userId)); profile.put("balanceVersion", account.versionNo); profile.put("ruleVersion", RULE_VERSION); return profile;
    }

    private long dailyRewardCount(AccountState account, long userId) { String prefix = today(userId) + ":"; return account.dailyCounters.entrySet().stream().filter(entry -> entry.getKey().startsWith(prefix)).mapToInt(Map.Entry::getValue).sum(); }
    private Map<String, Object> balanceView(AccountState account) { return map("xp", account.xp, "coins", balance(account, STAR_COIN), "starDust", balance(account, STAR_DUST), "streakFreezeCards", balance(account, STREAK_FREEZE), "versionNo", account.versionNo); }
    private long balance(AccountState account, String currency) { return account.balances.getOrDefault(currency, 0L); }

    private Map<String, Object> dashboardView(long userId) { AccountState account = account(userId); long opened = chestGrants.values().stream().filter(grant -> grant.userId == userId && grant.opened).count(); long completed = gameSessions.values().stream().filter(session -> session.userId == userId && "COMPLETED".equals(session.status)).count(); return map("xpLedgerEntries", account.xpLedger.size(), "currencyLedgerEntries", account.currencyLedger.size(), "gameSessionsCompleted", completed, "chestsOpened", opened, "ownedItemCount", account.inventory.items.size(), "seasonPoints", account.seasonPoints, "lastLearningEventId", galaxyStates.getOrDefault(userId, new GalaxyState()).lastSourceEventId); }

    private Map<String, Object> galaxyView(long userId) {
        if (!flag("galaxy")) return map("enabled", false, "nodes", List.of(), "trajectory", List.of()); AccountState account = account(userId); GalaxyState state = galaxyStates.computeIfAbsent(userId, ignored -> new GalaxyState()); List<Map<String, Object>> nodes = new ArrayList<>();
        for (String node : List.of("ORIGIN", "VOCAB_ORBIT", "GRAMMAR_NEBULA", "LISTENING_MOON", "SPEAKING_STAR", "GALAXY_GATE")) { int progress = state.nodeProgress.getOrDefault(node, 0); int required = nodeRequirement(node); nodes.add(map("nodeCode", node, "status", state.unlocked.contains(node) ? "UNLOCKED" : "LOCKED", "progress", progress, "requiredProgress", required, "progressPercent", Math.min(100, progress * 100 / required), "featureFlag", "galaxy")); }
        return map("enabled", true, "totalXp", account.xp, "nodes", nodes, "trajectory", List.of(map("sourceEventId", state.lastSourceEventId, "updatedAt", clock.instant().toString())), "ruleVersion", RULE_VERSION);
    }

    private List<Map<String, Object>> streakCalendar(long userId, StreakState state) { LocalDate today = today(userId); LocalDate monday = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)); List<Map<String, Object>> result = new ArrayList<>(); for (int i = 0; i < 7; i++) { LocalDate date = monday.plusDays(i); String status = state.validDates.contains(date) ? "QUALIFIED" : isNonRequiredDate(state, date) ? "PROTECTED" : "PENDING"; result.add(map("date", date, "dayOfWeek", date.getDayOfWeek().name(), "status", status)); } return result; }

    private String streakStatus(long userId, StreakState state) { if (state.lastValidDate == null) return "EMPTY"; LocalDate today = today(userId); if (state.validDates.contains(today)) return "ACTIVE"; if (isNonRequiredDate(state, today)) return "PROTECTED"; LocalDate missing = findMissingDate(userId, state); if (missing != null) return rescueWindowOpen(userId, state) ? "FROZEN" : "BROKEN"; return "AT_RISK"; }

    private LocalDate findMissingDate(long userId, StreakState state) { if (state.lastValidDate == null) return null; LocalDate today = today(userId); for (LocalDate cursor = state.lastValidDate.plusDays(1); cursor.isBefore(today); cursor = cursor.plusDays(1)) if (!isNonRequiredDate(state, cursor) && !state.validDates.contains(cursor)) return cursor; if (today.isAfter(state.lastValidDate) && !isNonRequiredDate(state, today) && !state.validDates.contains(today)) return today; return null; }
    private boolean rescueWindowOpen(long userId, StreakState state) { LocalDate missing = findMissingDate(userId, state); return missing != null && !today(userId).isAfter(missing.plusDays(2)); }
    private boolean isNonRequiredDate(StreakState state, LocalDate date) { return state.rescuedDates.contains(date) || (state.weekendProtectionEnabled && (date.getDayOfWeek() == DayOfWeek.SATURDAY || date.getDayOfWeek() == DayOfWeek.SUNDAY)); }
    private LocalDate today(long userId) { return LocalDate.now(todayZone(userId)); }
    private ZoneId todayZone(long userId) { return streakStates.getOrDefault(userId, new StreakState()).timeZone; }

    private QuestState questState(long userId, QuestDefinition definition) { Map<String, QuestState> states = questStates.computeIfAbsent(userId, ignored -> new LinkedHashMap<>()); LocalDate periodStart = periodStart(userId, definition.period()); QuestState current = states.get(definition.id()); if (current == null || !periodStart.equals(current.periodStart)) { current = new QuestState(periodStart); states.put(definition.id(), current); } return current; }
    private LocalDate periodStart(long userId, String period) { LocalDate date = today(userId); return "WEEKLY".equals(period) ? date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)) : date; }
    private boolean allDailyQuestsClaimed(long userId, LocalDate periodStart) { return QUEST_DEFINITIONS.stream().filter(definition -> "DAILY".equals(definition.period())).allMatch(definition -> questState(userId, definition).periodStart.equals(periodStart) && questState(userId, definition).claimed); }

    private AchievementState achievementState(long userId, String code) { return achievementStates.computeIfAbsent(userId, ignored -> new LinkedHashMap<>()).computeIfAbsent(code, ignored -> new AchievementState()); }
    private AchievementDefinition achievementDefinition(String code) { AchievementDefinition result = achievementDefinitionOrNull(code); if (result == null) throw error("GAM_ACHIEVEMENT_NOT_FOUND", "achievement does not exist", 404, false); return result; }
    private AchievementDefinition achievementDefinitionOrNull(String code) { return ACHIEVEMENT_DEFINITIONS.stream().filter(definition -> definition.code().equals(code)).findFirst().orElse(null); }
    private int achievementProgress(long userId, AchievementDefinition definition) { if (definition.code().startsWith("STREAK_")) return streakStates.getOrDefault(userId, new StreakState()).maxStreak; if ("GAME_ALL_6_TRIED".equals(definition.code())) return triedGames.getOrDefault(userId, Set.of()).size(); if (definition.code().startsWith("GAME_")) return wonGames.getOrDefault(userId, 0); if ("SEASON_TIER_10".equals(definition.code())) return account(userId).seasonPoints >= 2000 ? 10 : 0; if ("SEASON_JOIN".equals(definition.code())) return account(userId).seasonJoined ? 1 : 0; return achievementCounters.getOrDefault(userId, Map.of()).getOrDefault(definition.category(), 0); }

    private void incrementAchievementCounter(long userId, String code, int amount) { achievementCounters.computeIfAbsent(userId, ignored -> new LinkedHashMap<>()).merge(code, amount, Integer::sum); String category = switch (code) { case "LESSON_COMPLETE" -> "VOCAB"; case "REVIEW_BATCH_COMPLETE" -> "REVIEW"; case "READING_COMPLETE" -> "READING"; case "LISTENING_COMPLETE" -> "LISTENING"; case "WRITING_SUBMISSION" -> "WRITING"; case "CHECKPOINT_PASS" -> "CHECKPOINT"; default -> null; }; if (category != null) achievementCounters.get(userId).merge(category, amount, Integer::sum); }
    private QuestDefinition questDefinition(String id) { QuestDefinition definition = questDefinitionOrNull(id); if (definition == null) throw error("GAM_QUEST_NOT_FOUND", "quest does not exist", 404, false); return definition; }
    private QuestDefinition questDefinitionOrNull(String id) { return QUEST_DEFINITIONS.stream().filter(definition -> definition.id().equals(id)).findFirst().orElse(null); }

    private void validateOwnedLoadout(long userId, List<String> itemCodes) { InventoryState inventory = inventory(userId); for (String itemCode : itemCodes) { if (!ITEM_DEFINITIONS.containsKey(itemCode)) throw error("GAM_ITEM_NOT_FOUND", "item does not exist", 404, false); if (inventory.quantity(itemCode) <= 0) throw error("ITEM_NOT_OWNED", "item is not owned", 409, false); } }

    private List<Map<String, Object>> validatePlacements(long userId, Object value) { if (!(value instanceof Collection<?> collection)) throw error("GAM_SCHEMA_INVALID", "placements must be an array", 400, false); if (collection.size() > 100) throw error("GAM_SCHEMA_INVALID", "placements cannot contain more than 100 items", 400, false); InventoryState inventory = inventory(userId); List<Map<String, Object>> result = new ArrayList<>(); for (Object entry : collection) { if (!(entry instanceof Map<?, ?> raw)) throw error("GAM_SCHEMA_INVALID", "placement must be an object", 400, false); String placementId = requiredText(raw, "placementId", 1, 96); String itemCode = requiredText(raw, "itemCode", 1, 96); if (!ITEM_DEFINITIONS.containsKey(itemCode) || inventory.quantity(itemCode) <= 0) throw error("ITEM_NOT_OWNED", "space item is not owned", 409, false); String positionCode = text(raw.get("positionCode"), "CENTER"); if (positionCode.length() > 64) throw error("GAM_SCHEMA_INVALID", "positionCode is too long", 400, false); result.add(map("placementId", placementId, "itemCode", itemCode, "positionCode", positionCode)); } return result; }

    private ChestGrant ownedChest(long userId, String chestGrantId) { ChestGrant grant = chestGrants.get(chestGrantId); if (grant == null || grant.userId != userId) throw error("GAM_CHEST_NOT_FOUND", "chest grant does not exist", 404, false); return grant; }

    private Map<String, Integer> chestWeights(String chestType) { Map<String, Integer> result = new LinkedHashMap<>(); switch (chestType) { case "BRONZE" -> { result.put("COMMON", 6500); result.put("RARE", 2700); result.put("EPIC", 800); } case "SILVER" -> { result.put("COMMON", 4500); result.put("RARE", 4000); result.put("EPIC", 1300); result.put("LEGENDARY", 200); } case "GOLD" -> { result.put("COMMON", 2000); result.put("RARE", 4500); result.put("EPIC", 2800); result.put("LEGENDARY", 700); } case "GALAXY" -> { result.put("RARE", 3000); result.put("EPIC", 4500); result.put("LEGENDARY", 2000); result.put("COLLECTOR", 500); } default -> throw error("GAM_CHEST_TYPE_INVALID", "chest type is invalid", 400, false); } return result; }
    private String tierFor(String chestType, int randomBps) { int cursor = 0; for (Map.Entry<String, Integer> entry : chestWeights(chestType).entrySet()) { cursor += entry.getValue(); if (randomBps < cursor) return entry.getKey(); } return chestWeights(chestType).keySet().iterator().next(); }
    private String itemForTier(String tier) { return switch (tier) { case "COMMON" -> "COMMON_ITEM"; case "RARE" -> "RARE_ITEM"; case "EPIC" -> "EPIC_ITEM"; case "LEGENDARY" -> "LEGENDARY_ITEM"; case "COLLECTOR" -> "COLLECTOR_ITEM"; default -> throw error("GAM_CHEST_DROP_INVALID", "tier has no published item", 500, true); }; }
    private String probabilityHash(String chestType) { return sha256Hex(chestWeights(chestType).toString()); }

    private String chestSecret() { String value = System.getProperty("englishflow.b4.chest.hmac-secret"); if (value == null || value.isBlank()) value = System.getenv("B4_CHEST_HMAC_SECRET"); if (value == null || value.isBlank()) throw error("GAM_CHEST_RANDOM_FAILED", "auditable random source is not configured", 503, true); return value; }
    private static byte[] hmacBytes(String secret, String value) { try { Mac mac = Mac.getInstance("HmacSHA256"); mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256")); return mac.doFinal(value.getBytes(StandardCharsets.UTF_8)); } catch (NoSuchAlgorithmException | InvalidKeyException exception) { throw error("GAM_CHEST_RANDOM_FAILED", "auditable random source unavailable", 500, true); } }
    private int hmacBps(String secret, String probabilityVersion, String grantId, int ordinal) { byte[] digest = hmacBytes(secret, probabilityVersion + "|" + grantId + "|" + ordinal); int candidate = ((digest[0] & 0xff) << 8) | (digest[1] & 0xff); if (candidate < 60000) return candidate % 10000; return (((digest[2] & 0xff) << 8) | (digest[3] & 0xff)) % 10000; }
    private static String sha256Hex(byte[] bytes) { try { MessageDigest digest = MessageDigest.getInstance("SHA-256"); byte[] value = digest.digest(bytes); StringBuilder result = new StringBuilder(value.length * 2); for (byte item : value) result.append(String.format("%02x", item)); return result.toString(); } catch (NoSuchAlgorithmException exception) { throw error("GAM_HASH_FAILED", "hash algorithm unavailable", 500, true); } }
    private static String sha256Hex(String value) { return sha256Hex(value.getBytes(StandardCharsets.UTF_8)); }

    private Map<String, Object> idempotent(long userId, String scope, String key, Map<String, Object> body, Supplier<Map<String, Object>> action) { String identity = userId + ":" + scope + ":" + key; String fingerprint = bodyFingerprint(body); Map<String, Object> previous = idempotencyResponses.get(identity); if (previous != null) { if (!fingerprint.equals(idempotencyFingerprints.get(identity))) throw error("IDEMPOTENCY_CONFLICT", "Idempotency-Key was reused with a different request", 409, false); return previous; } Map<String, Object> result = action.get(); idempotencyResponses.put(identity, result); idempotencyFingerprints.put(identity, fingerprint); return result; }

    private void appendFact(String aggregateType, String aggregateId, long userId, String idempotencyKey, String requestId, String eventName, Map<String, Object> data) { Map<String, Object> payload = new LinkedHashMap<>(); payload.put("schema", eventName); payload.put("eventName", eventName); payload.put("aggregateId", aggregateId); payload.put("userId", userId); payload.put("ruleVersion", RULE_VERSION); payload.put("occurredAt", clock.instant().toString()); payload.put("requestId", requestId); if (data != null) payload.putAll(data); durableRepository.append(new B4DurableRepository.Fact(aggregateType, aggregateId, userId, requestId, idempotencyKey == null ? "internal" : idempotencyKey, clock.instant(), payload)); }
    private static Map<String, Object> withOccurredAt(Map<String, Object> source) { return withOccurredAt(source, null); }
    private static Map<String, Object> withOccurredAt(Map<String, Object> source, Instant occurredAt) { Map<String, Object> result = new LinkedHashMap<>(source); if (occurredAt != null) result.putIfAbsent("occurredAt", occurredAt.toString()); return result; }
    private Map<String, Object> envelope(String requestId, Map<String, Object> data) { return map("requestId", requestId, "serverTime", clock.instant().toString(), "data", data); }
    private Map<String, Object> success(Map<String, Object> data) { return envelope(newRequestId(), data); }
    private String newRequestId() { return "req_b4_" + UUID.randomUUID(); }

    private static Map<String, Object> safeBody(Map<String, Object> body) { return body == null ? new LinkedHashMap<>() : new LinkedHashMap<>(body); }
    private static void requireUser(long userId) { if (userId <= 0) throw error("B4_USER_INVALID", "userId must be positive", 400, false); }
    private static void requireKey(String key) { if (key == null || key.isBlank() || key.length() < 8 || key.length() > 96) throw error("GAM_IDEMPOTENCY_REQUIRED", "Idempotency-Key must contain 8-96 characters", 400, false); }
    private static void rejectUnknownFields(Map<String, Object> body, Set<String> allowed) { for (String field : body.keySet()) if (!allowed.contains(field)) throw error("GAM_SCHEMA_INVALID", "unknown field: " + field, 400, false); }
    private static void rejectClientOwnedFields(Map<String, Object> body, Set<String> fields) { for (String field : fields) if (body.containsKey(field)) throw error("GAM_CLIENT_FIELD_FORBIDDEN", field + " is server-owned", 400, false); }
    private static String requiredText(Map<?, ?> body, String field, int min, int max) { String value = text(body.get(field), ""); if (value.isBlank() || value.length() < min || value.length() > max) throw error("GAM_SCHEMA_INVALID", field + " is required or out of range", 400, false); return value; }
    private static int intValue(Object value, String field) { if (value instanceof Number number) return number.intValue(); try { return Integer.parseInt(String.valueOf(value)); } catch (Exception exception) { throw error("GAM_SCHEMA_INVALID", field + " must be an integer", 400, false); } }
    private static long longValue(Object value, long fallback) { if (value == null) return fallback; if (value instanceof Number number) return number.longValue(); try { return Long.parseLong(String.valueOf(value)); } catch (Exception ignored) { return fallback; } }
    private static String text(Object value, String fallback) { return value == null ? fallback : String.valueOf(value); }
    private static boolean booleanField(Map<?, ?> body, String field, boolean fallback) { Object value = body.get(field); return value == null ? fallback : value instanceof Boolean bool ? bool : Boolean.parseBoolean(String.valueOf(value)); }
    private static int safeLimit(int limit) { return Math.max(1, Math.min(limit <= 0 ? 20 : limit, 100)); }
    private static long parseVersion(String value) { String normalized = value.replace("\"", "").trim(); try { return Long.parseLong(normalized); } catch (NumberFormatException exception) { throw error("GAM_SCHEMA_INVALID", "If-Match must be a version number", 400, false); } }
    private static String allowedRenderMode(String value) { if (!Set.of("3D", "2D_FALLBACK").contains(value)) throw error("GAM_RENDER_MODE_INVALID", "renderMode must be 3D or 2D_FALLBACK", 400, false); return value; }
    private static List<String> stringList(Object value, int max, String field) { if (!(value instanceof Collection<?> collection) || collection.size() > max) throw error("GAM_SCHEMA_INVALID", field + " must be an array within its limit", 400, false); List<String> result = new ArrayList<>(); for (Object item : collection) { if (!(item instanceof String string) || string.isBlank() || string.length() > 128) throw error("GAM_SCHEMA_INVALID", field + " contains an invalid string", 400, false); result.add(string); } return result; }
    private static LocalDate localDate(Object value) { if (value instanceof LocalDate date) return date; if (value == null) return null; try { return LocalDate.parse(String.valueOf(value)); } catch (DateTimeParseException ignored) { return null; } }
    private static Map<String, Object> map(Object... values) { Map<String, Object> result = new LinkedHashMap<>(); for (int i = 0; i + 1 < values.length; i += 2) if (values[i + 1] != null) result.put(String.valueOf(values[i]), values[i + 1]); return result; }
    private static B4Exception error(String code, String message, int status, boolean retryable) { return new B4Exception(code, message, status, retryable); }
    private static String bodyFingerprint(Map<String, Object> body) { return sha256Hex(canonical(body)); }
    private static String canonical(Object value) { if (value == null) return "null"; if (value instanceof Map<?, ?> raw) return raw.entrySet().stream().sorted(Comparator.comparing(entry -> String.valueOf(entry.getKey()))).map(entry -> canonical(String.valueOf(entry.getKey())) + ":" + canonical(entry.getValue())).collect(java.util.stream.Collectors.joining(",", "{", "}")); if (value instanceof Collection<?> collection) return collection.stream().map(B4GamificationService::canonical).collect(java.util.stream.Collectors.joining(",", "[", "]")); if (value.getClass().isArray()) return canonical(Arrays.asList((Object[]) value)); return String.valueOf(value); }
    private void requireFeature(String feature) { if (!flag(feature)) throw error("GAM_FEATURE_DISABLED", feature + " feature is disabled", 409, false); }
    private boolean flag(String feature) { return flags.getOrDefault(feature, false); }
    private Map<String, Boolean> featureFlagsView() { return new LinkedHashMap<>(flags); }

    private static Map<String, Boolean> defaultFlags() { Map<String, Boolean> result = new LinkedHashMap<>(); result.put("gamification", true); result.put("games", true); result.put("games.grammarBlaster", false); result.put("games.catchMeaning", false); result.put("avatar", true); result.put("chest", true); result.put("galaxy", true); result.put("season", true); result.put("chest.minorRestricted", true); return result; }
    private boolean gameEnabled(GameDefinition definition) { return flag("games") && flag(definition.featureFlag()); }

    private static Map<String, RewardRule> createRewardRules() { Map<String, RewardRule> result = new LinkedHashMap<>(); result.put("LESSON_COMPLETE", new RewardRule("LESSON_COMPLETE", 20, 1, 60)); result.put("REVIEW_BATCH_COMPLETE", new RewardRule("REVIEW_BATCH_COMPLETE", 15, 1, 60)); result.put("READING_COMPLETE", new RewardRule("READING_COMPLETE", 20, 1, 60)); result.put("LISTENING_COMPLETE", new RewardRule("LISTENING_COMPLETE", 20, 1, 60)); result.put("WRITING_SUBMISSION", new RewardRule("WRITING_SUBMISSION", 25, 2, 60)); result.put("CHECKPOINT_PASS", new RewardRule("CHECKPOINT_PASS", 200, 30, 0)); result.put("GAME_SESSION_QUALIFIED", new RewardRule("GAME_SESSION_BONUS", 10, 0, 3)); result.put("DAILY_GOAL_REACHED", new RewardRule("DAILY_GOAL_BONUS", 50, 20, 1)); result.put("QUEST_COMPLETED", new RewardRule("QUEST_COMPLETED", 40, 5, 0)); result.put("ACHIEVEMENT_UNLOCKED", new RewardRule("ACHIEVEMENT_REWARD", 50, 10, 0)); result.put("STREAK_MILESTONE", new RewardRule("STREAK_MILESTONE", 50, 10, 0)); return Collections.unmodifiableMap(result); }
    private static Map<String, GameDefinition> createGameDefinitions() { Map<String, GameDefinition> result = new LinkedHashMap<>(); result.put("SENTENCE_TRAIN", new GameDefinition("SENTENCE_TRAIN", "拼句小火车", 5, 5, "games", 15, 10)); result.put("WORD_MATCH", new GameDefinition("WORD_MATCH", "单词消消乐", 8, 6, "games", 15, 10)); result.put("WORD_DEFENSE", new GameDefinition("WORD_DEFENSE", "单词保卫战", 10, 8, "games", 15, 10)); result.put("WORD_PUZZLE", new GameDefinition("WORD_PUZZLE", "拼图解谜", 8, 5, "games", 15, 10)); result.put("GRAMMAR_BLASTER", new GameDefinition("GRAMMAR_BLASTER", "语法射击", 5, 5, "games.grammarBlaster", 15, 10)); result.put("CATCH_MEANING", new GameDefinition("CATCH_MEANING", "词义捕手", 5, 5, "games.catchMeaning", 15, 10)); return Collections.unmodifiableMap(result); }
    private static Map<String, ItemDefinition> createItemDefinitions() { Map<String, ItemDefinition> result = new LinkedHashMap<>(); result.put("COMMON_ITEM", new ItemDefinition("COMMON_ITEM", "COMMON", "BODY", AVATAR_RESOURCE_VERSION)); result.put("RARE_ITEM", new ItemDefinition("RARE_ITEM", "RARE", "ACCESSORY", AVATAR_RESOURCE_VERSION)); result.put("EPIC_ITEM", new ItemDefinition("EPIC_ITEM", "EPIC", "EFFECT", AVATAR_RESOURCE_VERSION)); result.put("LEGENDARY_ITEM", new ItemDefinition("LEGENDARY_ITEM", "LEGENDARY", "SCENE", AVATAR_RESOURCE_VERSION)); result.put("COLLECTOR_ITEM", new ItemDefinition("COLLECTOR_ITEM", "COLLECTOR", "TROPHY", AVATAR_RESOURCE_VERSION)); return Collections.unmodifiableMap(result); }

    private static List<AchievementDefinition> createAchievementDefinitions() { List<AchievementDefinition> result = new ArrayList<>(); addAchievements(result, new String[]{"STREAK_7", "STREAK_30", "STREAK_100", "STREAK_365"}, new int[]{7, 30, 100, 365}, "STREAK", 50, 10); addAchievements(result, new String[]{"VOCAB_100", "VOCAB_500", "VOCAB_1000", "VOCAB_5000", "VOCAB_10000"}, new int[]{100, 500, 1000, 5000, 10000}, "VOCAB", 20, 5); addAchievements(result, new String[]{"REVIEW_100", "REVIEW_1000", "REVIEW_5000", "MASTERED_100", "MASTERED_1000"}, new int[]{100, 1000, 5000, 100, 1000}, "REVIEW", 20, 5); addAchievements(result, new String[]{"READING_1", "READING_10", "READING_50", "READING_100"}, new int[]{1, 10, 50, 100}, "READING", 20, 5); addAchievements(result, new String[]{"LISTENING_1", "LISTENING_10", "LISTENING_50", "LISTENING_100"}, new int[]{1, 10, 50, 100}, "LISTENING", 20, 5); addAchievements(result, new String[]{"WRITING_1", "WRITING_10", "WRITING_50", "WRITING_100"}, new int[]{1, 10, 50, 100}, "WRITING", 20, 5); addAchievements(result, new String[]{"GRAMMAR_10", "GRAMMAR_50", "GRAMMAR_100", "GRAMMAR_300"}, new int[]{10, 50, 100, 300}, "GRAMMAR", 20, 5); addAchievements(result, new String[]{"CHECKPOINT_FIRST", "MOCK_IMPROVE_5", "MOCK_IMPROVE_10", "MOCK_PERFECT"}, new int[]{1, 5, 10, 1}, "CHECKPOINT", 20, 5); addAchievements(result, new String[]{"GAME_ALL_6_TRIED", "GAME_10_WINS", "GAME_50_WINS", "GAME_100_WINS", "GAME_PERFECT", "GAME_NO_HINT"}, new int[]{6, 10, 50, 100, 1, 1}, "GAME", 20, 5); addAchievements(result, new String[]{"ALL_MODULES_DAY", "ALL_MODULES_WEEK", "LEARNING_FLOW_7", "CHECKPOINT_10", "REVIEW_REPAIR_7"}, new int[]{1, 1, 7, 10, 7}, "LEARNING", 20, 5); addAchievements(result, new String[]{"EARLY_BIRD_5", "NIGHT_OWL_5", "FOCUS_7", "FOCUS_30"}, new int[]{5, 5, 7, 30}, "LEARNING", 20, 5); addAchievements(result, new String[]{"COLLECTION_SET_1", "COLLECTION_SET_3", "COLLECTION_SET_5", "COLLECTION_COMMON_COMPLETE"}, new int[]{1, 3, 5, 1}, "COLLECTION", 20, 5); addAchievements(result, new String[]{"SEASON_JOIN", "SEASON_TIER_10", "SEASON_FINISH"}, new int[]{1, 10, 1}, "SEASON", 20, 5); return Collections.unmodifiableList(result); }
    private static void addAchievements(List<AchievementDefinition> result, String[] codes, int[] targets, String category, int xp, int coins) { for (int i = 0; i < codes.length; i++) result.add(new AchievementDefinition(codes[i], targets[i], category, xp, coins)); }

    private static String nodeForSource(String sourceType) { return switch (sourceType) { case "LESSON_COMPLETE", "REVIEW_BATCH_COMPLETE" -> "VOCAB_ORBIT"; case "READING_COMPLETE", "CHECKPOINT_PASS" -> "GRAMMAR_NEBULA"; case "LISTENING_COMPLETE" -> "LISTENING_MOON"; case "WRITING_SUBMISSION", "GAME_SESSION_QUALIFIED" -> "SPEAKING_STAR"; case "DAILY_GOAL_REACHED" -> "GALAXY_GATE"; default -> "ORIGIN"; }; }
    private static int nodeRequirement(String nodeCode) { return switch (nodeCode) { case "ORIGIN" -> 1; case "VOCAB_ORBIT", "GRAMMAR_NEBULA", "LISTENING_MOON", "SPEAKING_STAR" -> 5; case "GALAXY_GATE" -> 10; default -> 1; }; }

    private static final class AccountState { long xp; long versionNo; long seasonPoints; boolean seasonJoined; final Map<String, Long> balances = new LinkedHashMap<>(); final Set<String> xpSettlementKeys = new LinkedHashSet<>(); final Set<String> currencySettlementKeys = new LinkedHashSet<>(); final List<Map<String, Object>> xpLedger = new ArrayList<>(); final List<Map<String, Object>> currencyLedger = new ArrayList<>(); final Map<String, Integer> dailyCounters = new HashMap<>(); final Map<String, Integer> gameStartsByDate = new HashMap<>(); final Map<String, Integer> gameRewardCountByDate = new HashMap<>(); final Map<String, Integer> seasonPointsByDate = new HashMap<>(); final InventoryState inventory = new InventoryState(); }
    private static final class StreakState { ZoneId timeZone = ZoneId.of("Asia/Shanghai"); boolean weekendProtectionEnabled; Instant timeZoneChangedAt; LocalDate lastValidDate; LocalDate lastRescueDate; int currentStreak; int maxStreak; final Set<LocalDate> validDates = new LinkedHashSet<>(); final Set<LocalDate> rescuedDates = new LinkedHashSet<>(); }
    private static final class InventoryState { final Map<String, Integer> items = new LinkedHashMap<>(); int quantity(String itemCode) { return items.getOrDefault(itemCode, 0); } }
    private static final class AvatarState { int configVersion; final Map<String, Object> profile = new LinkedHashMap<>(map("avatarId", "AVATAR_DEFAULT", "resourceVersion", AVATAR_RESOURCE_VERSION, "renderMode", "2D_FALLBACK", "loadoutId", "LOADOUT_DEFAULT", "configVersion", 0)); }
    private static final class StudySpaceState { final String spaceId; int versionNo; String renderMode = "2D_FALLBACK"; List<Map<String, Object>> placements = new ArrayList<>(); StudySpaceState(long userId) { this.spaceId = "SPACE-" + userId; } Map<String, Object> view() { return map("spaceId", spaceId, "version", versionNo, "versionNo", versionNo, "placements", placements, "renderMode", renderMode, "privacy", "PRIVATE"); } }
    private static final class GalaxyState { final Map<String, Integer> nodeProgress = new LinkedHashMap<>(); final Set<String> unlocked = new LinkedHashSet<>(); String lastSourceEventId; }
    private static final class QuestState { LocalDate periodStart; int progress; boolean claimed; final Set<String> progressEventIds = new LinkedHashSet<>(); QuestState(LocalDate periodStart) { this.periodStart = periodStart; } boolean completed(QuestDefinition definition) { return progress >= definition.target(); } Map<String, Object> view(QuestDefinition definition) { return map("questId", definition.id(), "period", definition.period(), "periodStart", periodStart, "title", definition.title(), "target", definition.target(), "progress", progress, "completed", completed(definition), "claimed", claimed, "xpReward", definition.xpReward(), "coinReward", definition.coinReward(), "ruleVersion", RULE_VERSION); } }
    private static final class AchievementState { int progress; boolean unlocked; boolean showcased; Instant unlockedAt; Map<String, Object> view(AchievementDefinition definition) { return map("achievementCode", definition.code(), "target", definition.target(), "progress", progress, "status", unlocked ? "UNLOCKED" : "LOCKED", "showcased", showcased, "unlockedAt", unlockedAt, "xpReward", definition.xpReward(), "coinReward", definition.coinReward(), "ruleVersion", RULE_VERSION); } }
    private static final class ChestGrant { final String id; final long userId; final String chestType; final String sourceEventId; final String probabilityVersion; final Instant createdAt; String status = "GRANTED"; boolean opened; String auditId; String seedCommit; String tierCode; String itemCode; boolean duplicateConverted; int shardAmount; ChestGrant(String id, long userId, String chestType, String sourceEventId, String probabilityVersion, Instant createdAt) { this.id = id; this.userId = userId; this.chestType = chestType; this.sourceEventId = sourceEventId; this.probabilityVersion = probabilityVersion; this.createdAt = createdAt; } Map<String, Object> view() { return map("chestGrantId", id, "chestType", chestType, "kind", "FREE_LEARNING_REWARD", "sourceEventId", sourceEventId, "status", status, "probabilityVersion", probabilityVersion, "auditId", auditId, "tierCode", tierCode, "itemCode", itemCode, "duplicateConverted", duplicateConverted, "shardAmount", shardAmount, "createdAt", createdAt.toString(), "freeOnly", true); } }
    private static final class Loadout { final String id; final long userId; String name = "未命名装扮"; String resourceVersion = AVATAR_RESOURCE_VERSION; List<String> itemCodes = new ArrayList<>(); int versionNo; boolean equipped; Loadout(String id, long userId) { this.id = id; this.userId = userId; } static Loadout defaultLoadout(long userId) { Loadout result = new Loadout("LOADOUT_DEFAULT", userId); result.name = "默认装扮"; result.equipped = true; return result; } Map<String, Object> view() { return map("loadoutId", id, "name", name, "equipped", equipped, "itemCodes", itemCodes, "resourceVersion", resourceVersion, "versionNo", versionNo); } }

    private static final class GameSession {
        final String id; final long userId; final String gameCode; final String performanceTier; final int requiredRounds; final int minimumRounds; final int maxMinutes; final int pauseLimitMinutes; final Instant createdAt; String serverNonceHash; final List<String> itemCodes = new ArrayList<>(); final List<String> expectedTokens = new ArrayList<>(); final Map<String, String> eventFingerprints = new LinkedHashMap<>(); final Map<String, Map<String, Object>> eventResults = new LinkedHashMap<>(); String status = "READY"; int seq; int attempts; int correct; int combo; Instant pausedAt; Instant lastEventAt; Map<String, Object> finishResult; Map<String, Object> finishData = Map.of();
        private GameSession(String id, long userId, GameDefinition definition, String performanceTier, Instant createdAt) { this.id = id; this.userId = userId; this.gameCode = definition.code(); this.performanceTier = performanceTier; this.requiredRounds = definition.requiredRounds(); this.minimumRounds = definition.minimumRounds(); this.maxMinutes = definition.maxMinutes(); this.pauseLimitMinutes = definition.pauseLimitMinutes(); this.createdAt = createdAt; this.serverNonceHash = sha256Hex(id + "|" + createdAt + "|" + UUID.randomUUID()); buildChallenges(); }
        private void buildChallenges() { itemCodes.clear(); expectedTokens.clear(); for (int i = 0; i < requiredRounds; i++) { itemCodes.add(gameCode + "-ITEM-" + (i + 1)); expectedTokens.add(sha256Hex(serverNonceHash + "|" + (i + 1))); } }
        static GameSession create(String id, long userId, GameDefinition definition, String performanceTier, Instant createdAt) { return new GameSession(id, userId, definition, performanceTier, createdAt); }
        static GameSession restore(String id, long userId, GameDefinition definition, Map<String, Object> payload, Instant occurredAt) { Instant created = parseInstant(payload.get("createdAt"), occurredAt); GameSession result = new GameSession(id, userId, definition, text(payload.get("performanceTier"), "Performance"), created); result.serverNonceHash = text(payload.get("serverNonceHash"), result.serverNonceHash); result.buildChallenges(); return result; }
        void restore(Map<String, Object> payload) { status = text(payload.get("status"), status); seq = Math.max(seq, intValue(payload.getOrDefault("seq", 0), "seq")); attempts = Math.max(attempts, intValue(payload.getOrDefault("attempts", 0), "attempts")); correct = Math.max(correct, intValue(payload.getOrDefault("correct", 0), "correct")); combo = intValue(payload.getOrDefault("combo", combo), "combo"); String paused = text(payload.get("pausedAt"), null); if (paused != null) pausedAt = Instant.parse(paused); if (payload.get("finishData") instanceof Map<?, ?> value) finishData = castMap(value); }
        Map<String, Object> factPayload(String targetStatus, String eventId) { return factPayload(targetStatus, eventId, Map.of()); }
        Map<String, Object> factPayload(String targetStatus, String eventId, Map<String, Object> extra) { Map<String, Object> payload = new LinkedHashMap<>(map("status", targetStatus, "sessionId", id, "gameCode", gameCode, "contentVersionId", SERVER_CONTENT_VERSION, "performanceTier", performanceTier, "serverNonceHash", serverNonceHash, "seq", seq, "attempts", attempts, "correct", correct, "combo", combo, "requiredRounds", requiredRounds, "minimumRounds", minimumRounds, "createdAt", createdAt.toString(), "pausedAt", pausedAt == null ? null : pausedAt.toString(), "eventId", eventId, "finishData", finishData)); payload.putAll(extra); return payload; }
        Map<String, Object> view() { List<Map<String, Object>> challenges = new ArrayList<>(); for (int i = 0; i < itemCodes.size(); i++) challenges.add(map("roundNo", i + 1, "itemCode", itemCodes.get(i), "challengeToken", expectedTokens.get(i))); return map("sessionId", id, "gameCode", gameCode, "status", status, "performanceTier", performanceTier, "contentVersionId", SERVER_CONTENT_VERSION, "serverNonceHash", serverNonceHash, "seq", seq, "attemptCount", attempts, "correctCount", correct, "combo", combo, "requiredRounds", requiredRounds, "minimumRounds", minimumRounds, "createdAt", createdAt.toString(), "expiresAt", createdAt.plusSeconds(maxMinutes * 60L).toString(), "pauseLimitMinutes", pauseLimitMinutes, "challenges", challenges); }
    }

    private record RewardRule(String reasonCode, int xp, int coins, int dailyCap) {}
    private record GameDefinition(String code, String title, int requiredRounds, int minimumRounds, String featureFlag, int maxMinutes, int pauseLimitMinutes) {}
    private record ItemDefinition(String itemCode, String quality, String slot, String resourceVersion) {}
    private record QuestDefinition(String id, String period, String title, int target, int xpReward, int coinReward) {}
    private record AchievementDefinition(String code, int target, String category, int xpReward, int coinReward) {}

    private static Instant parseInstant(Object value, Instant fallback) { if (value == null) return fallback; try { return Instant.parse(String.valueOf(value)); } catch (DateTimeParseException ignored) { return fallback; } }
    private static Map<String, Object> castMap(Map<?, ?> value) { Map<String, Object> result = new LinkedHashMap<>(); for (Map.Entry<?, ?> entry : value.entrySet()) result.put(String.valueOf(entry.getKey()), entry.getValue()); return result; }
}
