package com.englishflow.gamification;

import com.englishflow.gamification.adapter.memory.InMemoryGamificationFactStore;
import com.englishflow.gamification.adapter.memory.InMemoryUserTimeZonePort;
import com.englishflow.gamification.application.GamificationApplicationService;
import com.englishflow.gamification.domain.CompletionRuleCatalog;
import com.englishflow.gamification.domain.EventConsumptionReceipt;
import com.englishflow.gamification.domain.GamificationDomainException;
import com.englishflow.gamification.domain.GamificationSummary;
import com.englishflow.gamification.domain.LedgerEntry;
import com.englishflow.gamification.domain.RewardClaimReceipt;
import com.englishflow.gamification.domain.RewardProbabilityCatalog;
import com.englishflow.gamification.domain.RewardProbabilityDisclosure;
import com.englishflow.gamification.domain.TrustedCompletionEvent;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.Map;

/** Dependency-free B12-GAM-001 smoke; no Spring, database, Kafka or login provider. */
public final class GamificationServiceSmoke {

    private static final Instant NOW = Instant.parse("2026-08-22T12:00:00Z");

    private GamificationServiceSmoke() {
    }

    public static void main(String[] args) {
        run();
        System.out.println("gamification-service B12-GAM-001 smoke: PASS");
    }

    public static void run() {
        InMemoryGamificationFactStore store = new InMemoryGamificationFactStore();
        InMemoryUserTimeZonePort zones = new InMemoryUserTimeZonePort(ZoneId.of("Asia/Shanghai"));
        GamificationApplicationService service = new GamificationApplicationService(store, zones,
                Clock.fixed(NOW, ZoneOffset.UTC), new CompletionRuleCatalog(),
                new RewardProbabilityCatalog(), true);

        String user = "user-gam-001";
        EventConsumptionReceipt first = service.consumeTrustedEvent(
                event(user, "learning-event-001", "2026-08-20T23:30:00Z"),
                "idem-event-001", "learning-service");
        check(first.applied() && first.xpDelta() == 20 && first.coinDelta() == 1,
                "trusted event is server-settled");
        check(first.activeDate().toString().equals("2026-08-21"),
                "streak uses the user timezone rather than UTC date");

        EventConsumptionReceipt duplicate = service.consumeTrustedEvent(
                event(user, "learning-event-001", "2026-08-20T23:30:00Z"),
                "idem-event-002", "learning-service");
        check(duplicate.replayed() && duplicate.rewardGrantId().equals(first.rewardGrantId()),
                "duplicate event replays one settlement and one reward grant");

        EventConsumptionReceipt nextDay = service.consumeTrustedEvent(
                event(user, "learning-event-002", "2026-08-21T23:30:00Z"),
                "idem-event-003", "learning-service");
        check(nextDay.currentStreak() == 2 && nextDay.seasonPoints() == 10,
                "consecutive local dates update streak and season facts");

        GamificationSummary summary = service.summary(user);
        check(summary.xp() == 40 && summary.coins() == 2 && summary.level().level() == 1,
                "level projection follows XP balance");
        check(summary.streak().currentStreak() == 2 && summary.season().factCount() == 2,
                "summary exposes streak and season facts");
        check(summary.ledgerConserved(), "ledger conservation is true");
        long xpSum = service.ledger(user, 100).xp().stream().mapToLong(LedgerEntry::delta).sum();
        long coinSum = service.ledger(user, 100).coins().stream().mapToLong(LedgerEntry::delta).sum();
        check(xpSum == summary.xp() && coinSum == summary.coins(),
                "ledger entries sum to balances");

        RewardProbabilityDisclosure disclosure = service.rewardProbability(user, first.rewardGrantId());
        check(disclosure.disclosedBeforeClaim() && !disclosure.cashReward()
                && disclosure.cashValueMinor() == 0
                && disclosure.totalProbability().compareTo(new java.math.BigDecimal("1.00")) == 0,
                "non-cash reward probabilities are disclosed before claim");
        RewardClaimReceipt claim = service.claimReward(user, first.rewardGrantId(), "idem-claim-001");
        RewardClaimReceipt claimReplay = service.claimReward(user, first.rewardGrantId(), "idem-claim-002");
        check(claim.claimed() && !claim.replayed() && claimReplay.replayed()
                && claim.outcomeCode().equals(claimReplay.outcomeCode()),
                "duplicate reward claim does not grant twice");
        check(service.rewards(user).grants().size() == 2, "duplicate event created one grant only");

        String timezoneUser = "user-gam-timezone";
        zones.setZone(timezoneUser, ZoneId.of("America/Los_Angeles"));
        EventConsumptionReceipt timezoneEvent = service.consumeTrustedEvent(
                event(timezoneUser, "learning-event-zone", "2026-08-22T00:30:00Z"),
                "idem-event-zone", "learning-service");
        check(timezoneEvent.activeDate().toString().equals("2026-08-21"),
                "each user gets a timezone-derived active date");

        expect(GamificationDomainException.Code.UNTRUSTED_FIELD, () -> {
            Map<String, Object> payload = eventMap("user-gam-reject", "learning-event-reject",
                    "2026-08-22T00:00:00Z");
            payload.put("xp", 9);
            TrustedCompletionEvent.from(payload);
        });
        expect(GamificationDomainException.Code.UNTRUSTED_FIELD, () -> {
            Map<String, Object> payload = eventMap("user-gam-reject", "learning-event-role",
                    "2026-08-22T00:00:00Z");
            payload.put("tenantId", "client-tenant");
            TrustedCompletionEvent.from(payload);
        });

        InMemoryGamificationFactStore disabledStore = new InMemoryGamificationFactStore();
        GamificationApplicationService disabled = new GamificationApplicationService(disabledStore, zones,
                Clock.fixed(NOW, ZoneOffset.UTC), new CompletionRuleCatalog(),
                new RewardProbabilityCatalog(), false);
        EventConsumptionReceipt disabledReceipt = disabled.consumeTrustedEvent(
                event("user-gam-disabled", "learning-event-disabled", "2026-08-22T00:00:00Z"),
                "idem-event-disabled", "learning-service");
        check(disabledReceipt.accepted() && !disabledReceipt.applied()
                && disabledReceipt.reasonCode().equals("FEATURE_DISABLED")
                && disabled.summary("user-gam-disabled").xp() == 0
                && disabled.rewards("user-gam-disabled").grants().isEmpty(),
                "feature-off acknowledges learning event without gamification writes");
    }

    private static TrustedCompletionEvent event(String user, String eventId, String occurredAt) {
        return TrustedCompletionEvent.from(eventMap(user, eventId, occurredAt));
    }

    private static Map<String, Object> eventMap(String user, String eventId, String occurredAt) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("sourceService", "learning-service");
        payload.put("eventId", eventId);
        payload.put("traceId", "trace-" + eventId);
        payload.put("schemaVersion", "v1");
        payload.put("occurredAt", occurredAt);
        payload.put("subject", user);
        payload.put("aggregateId", "task-" + eventId);
        payload.put("ruleVersion", TrustedCompletionEvent.RULE_VERSION);
        payload.put("eventType", "learning.lesson.completed.v1");
        return payload;
    }

    private static void expect(GamificationDomainException.Code expected, Runnable action) {
        try {
            action.run();
        } catch (GamificationDomainException exception) {
            check(exception.code() == expected, "expected " + expected + " but got " + exception.code());
            return;
        }
        throw new AssertionError("expected " + expected);
    }

    private static void check(boolean condition, String message) {
        if (!condition) {
            throw new AssertionError(message);
        }
    }
}
