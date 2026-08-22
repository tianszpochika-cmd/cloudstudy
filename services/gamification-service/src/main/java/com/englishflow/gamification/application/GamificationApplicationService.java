package com.englishflow.gamification.application;

import com.englishflow.gamification.domain.CompletionRule;
import com.englishflow.gamification.domain.CompletionRuleCatalog;
import com.englishflow.gamification.domain.EventConsumptionReceipt;
import com.englishflow.gamification.domain.GamificationDomainException;
import com.englishflow.gamification.domain.GamificationSummary;
import com.englishflow.gamification.domain.LedgerEntry;
import com.englishflow.gamification.domain.LedgerView;
import com.englishflow.gamification.domain.LevelProjection;
import com.englishflow.gamification.domain.RewardClaimReceipt;
import com.englishflow.gamification.domain.RewardGrant;
import com.englishflow.gamification.domain.RewardListView;
import com.englishflow.gamification.domain.RewardProbabilityCatalog;
import com.englishflow.gamification.domain.RewardProbabilityDisclosure;
import com.englishflow.gamification.domain.SeasonFact;
import com.englishflow.gamification.domain.SeasonProjection;
import com.englishflow.gamification.domain.StreakProjection;
import com.englishflow.gamification.domain.TrustedCompletionEvent;
import com.englishflow.gamification.domain.UserFacts;
import com.englishflow.gamification.port.GamificationFactStore;
import com.englishflow.gamification.port.UserTimeZonePort;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;

/** Use cases for trusted settlement and owner-scoped reads/claims. */
public final class GamificationApplicationService {

    private static final Duration FUTURE_SKEW = Duration.ofMinutes(5);

    private final GamificationFactStore store;
    private final UserTimeZonePort timeZones;
    private final Clock clock;
    private final CompletionRuleCatalog rules;
    private final RewardProbabilityCatalog probabilities;
    private final boolean featureEnabled;

    public GamificationApplicationService(GamificationFactStore store, UserTimeZonePort timeZones,
            Clock clock, CompletionRuleCatalog rules, RewardProbabilityCatalog probabilities,
            boolean featureEnabled) {
        this.store = Objects.requireNonNull(store, "store");
        this.timeZones = Objects.requireNonNull(timeZones, "timeZones");
        this.clock = Objects.requireNonNull(clock, "clock");
        this.rules = Objects.requireNonNull(rules, "rules");
        this.probabilities = Objects.requireNonNull(probabilities, "probabilities");
        this.featureEnabled = featureEnabled;
    }

    public EventConsumptionReceipt consumeTrustedEvent(TrustedCompletionEvent event,
            String idempotencyKey, String verifiedSourceService) {
        Objects.requireNonNull(event, "event");
        requireIdempotencyKey(idempotencyKey);
        if (!event.sourceService().equals(verifiedSourceService)) {
            throw GamificationDomainException.forbidden();
        }
        Instant now = clock.instant();
        if (event.occurredAt().isAfter(now.plus(FUTURE_SKEW))) {
            throw GamificationDomainException.invalidEvent("occurredAt is too far in the future");
        }

        return store.inUserTransaction(event.subjectId(), facts -> {
            String fingerprint = event.fingerprint();
            UserFacts.IdempotencyRecord existingKey = facts.idempotency(idempotencyKey).orElse(null);
            if (existingKey != null) {
                if (!existingKey.fingerprint().equals(fingerprint)) {
                    throw new GamificationDomainException(GamificationDomainException.Code.IDEMPOTENCY_CONFLICT,
                            "Idempotency-Key was reused for a different event");
                }
                return ((EventConsumptionReceipt) existingKey.response()).replay();
            }

            UserFacts.EventRecord existingEvent = facts.event(event.eventId()).orElse(null);
            if (existingEvent != null) {
                if (!existingEvent.fingerprint().equals(fingerprint)) {
                    throw new GamificationDomainException(GamificationDomainException.Code.EVENT_CONFLICT,
                            "eventId was reused for a different event");
                }
                EventConsumptionReceipt replay = existingEvent.receipt().replay();
                facts.recordIdempotency(idempotencyKey, fingerprint, existingEvent.receipt());
                return replay;
            }

            CompletionRule rule = rules.forEvent(event);
            EventConsumptionReceipt receipt;
            if (!featureEnabled) {
                receipt = new EventConsumptionReceipt(
                        settlementId(event), event.eventId(), event.subjectId(), true, false, false,
                        "FEATURE_DISABLED", 0, 0, facts.xpBalance(), facts.coinBalance(),
                        LevelProjection.fromXp(facts.xpBalance()).level(), null, null, 0, null, 0, now);
            } else {
                ZoneId zone = timeZones.zoneFor(event.subjectId());
                LocalDate activeDate = event.occurredAt().atZone(zone).toLocalDate();
                facts.appendCompletion(entryId("xp", event), rule.xpDelta(), entryId("coin", event),
                        rule.coinDelta(), event.eventId(), "COMPLETION_" + event.eventType(),
                        event.traceId(), event.ruleVersion(), event.occurredAt(), now);
                facts.addActiveDate(activeDate);
                StreakProjection streak = StreakProjection.from(zone, facts.activeDates());
                String seasonId = seasonId(activeDate);
                SeasonFact seasonFact = new SeasonFact(seasonId, event.eventId(), event.subjectId(),
                        rule.seasonPoints(), event.ruleVersion(), event.occurredAt(), now);
                facts.addSeasonFact(seasonFact);
                String grantId = rewardGrantId(event);
                facts.addReward(new RewardGrant(grantId, event.eventId(), event.subjectId(), rule.rewardCode(),
                        probabilities.version(), now));
                LevelProjection level = LevelProjection.fromXp(facts.xpBalance());
                receipt = new EventConsumptionReceipt(
                        settlementId(event), event.eventId(), event.subjectId(), true, true, false,
                        "SETTLED", rule.xpDelta(), rule.coinDelta(), facts.xpBalance(), facts.coinBalance(),
                        level.level(), grantId, activeDate, streak.currentStreak(), seasonId,
                        rule.seasonPoints(), now);
            }
            facts.assertConservation();
            facts.recordEvent(event.eventId(), fingerprint, receipt);
            facts.recordIdempotency(idempotencyKey, fingerprint, receipt);
            return receipt;
        });
    }

    public GamificationSummary summary(String subjectId) {
        return store.inUserTransaction(subjectId, facts -> {
            ZoneId zone = timeZones.zoneFor(subjectId);
            LevelProjection level = LevelProjection.fromXp(facts.xpBalance());
            StreakProjection streak = StreakProjection.from(zone, facts.activeDates());
            String currentSeasonId = seasonId(clock.instant().atZone(zone).toLocalDate());
            SeasonProjection season = season(facts, currentSeasonId);
            return new GamificationSummary(subjectId, facts.xpBalance(), facts.coinBalance(), level,
                    streak, season, facts.isConserved());
        });
    }

    public LedgerView ledger(String subjectId, int limit) {
        int boundedLimit = Math.min(Math.max(limit, 1), 100);
        return store.inUserTransaction(subjectId, facts -> new LedgerView(subjectId,
                tail(facts.xpLedger(), boundedLimit), tail(facts.coinLedger(), boundedLimit), facts.isConserved()));
    }

    public RewardListView rewards(String subjectId) {
        return store.inUserTransaction(subjectId, facts -> {
            List<com.englishflow.gamification.domain.RewardGrantView> grants = new ArrayList<>(facts.rewardViews());
            grants.sort(Comparator.comparing(com.englishflow.gamification.domain.RewardGrantView::grantedAt).reversed());
            return new RewardListView(subjectId, List.copyOf(grants));
        });
    }

    public RewardProbabilityDisclosure rewardProbability(String subjectId, String grantId) {
        return store.inUserTransaction(subjectId, facts -> facts.reward(grantId)
                .map(grant -> probabilities.disclosure(grantId, grant.rewardCode()))
                .orElseThrow(GamificationDomainException::notFound));
    }

    public RewardClaimReceipt claimReward(String subjectId, String grantId, String idempotencyKey) {
        requireIdempotencyKey(idempotencyKey);
        return store.inUserTransaction(subjectId, facts -> {
            String fingerprint = "reward-claim:" + grantId;
            UserFacts.IdempotencyRecord existingKey = facts.idempotency(idempotencyKey).orElse(null);
            if (existingKey != null) {
                if (!existingKey.fingerprint().equals(fingerprint)) {
                    throw new GamificationDomainException(GamificationDomainException.Code.IDEMPOTENCY_CONFLICT,
                            "Idempotency-Key was reused for a different reward operation");
                }
                return ((RewardClaimReceipt) existingKey.response()).replay();
            }
            RewardGrant grant = facts.reward(grantId).orElseThrow(GamificationDomainException::notFound);
            RewardClaimReceipt result = grant.claim(probabilities, clock.instant());
            facts.recordIdempotency(idempotencyKey, fingerprint, result);
            return result.replayed() ? result.replay() : result;
        });
    }

    public StreakProjection streak(String subjectId) {
        return store.inUserTransaction(subjectId, facts -> StreakProjection.from(
                timeZones.zoneFor(subjectId), facts.activeDates()));
    }

    public SeasonProjection season(String subjectId) {
        return store.inUserTransaction(subjectId, facts -> {
            ZoneId zone = timeZones.zoneFor(subjectId);
            return season(facts, seasonId(clock.instant().atZone(zone).toLocalDate()));
        });
    }

    public boolean featureEnabled() {
        return featureEnabled;
    }

    private static SeasonProjection season(UserFacts facts, String seasonId) {
        long points = 0;
        int count = 0;
        for (SeasonFact fact : facts.seasonFacts()) {
            if (fact.seasonId().equals(seasonId)) {
                points = Math.addExact(points, fact.points());
                count++;
            }
        }
        return new SeasonProjection(seasonId, points, count);
    }

    private static List<LedgerEntry> tail(List<LedgerEntry> entries, int limit) {
        int from = Math.max(0, entries.size() - limit);
        return List.copyOf(entries.subList(from, entries.size()));
    }

    private static String seasonId(LocalDate date) {
        int quarter = ((date.getMonthValue() - 1) / 3) + 1;
        return "SEASON_" + date.getYear() + "_Q" + quarter;
    }

    private static String settlementId(TrustedCompletionEvent event) {
        return "settle_" + event.fingerprint().substring(0, 24);
    }

    private static String rewardGrantId(TrustedCompletionEvent event) {
        return "grant_" + event.fingerprint().substring(0, 24);
    }

    private static String entryId(String prefix, TrustedCompletionEvent event) {
        return prefix + "_" + event.fingerprint().substring(0, 24);
    }

    private static void requireIdempotencyKey(String key) {
        if (key == null || key.isBlank() || key.length() > 200
                || key.chars().anyMatch(Character::isISOControl)) {
            throw GamificationDomainException.invalid("Idempotency-Key is required");
        }
    }
}
