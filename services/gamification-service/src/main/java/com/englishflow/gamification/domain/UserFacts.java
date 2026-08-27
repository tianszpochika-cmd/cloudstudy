package com.englishflow.gamification.domain;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/** Service-owned aggregate state. A durable adapter may persist these facts transactionally. */
public final class UserFacts {

    private final String subjectId;
    private long xpBalance;
    private long coinBalance;
    private final List<LedgerEntry> xpLedger = new ArrayList<>();
    private final List<LedgerEntry> coinLedger = new ArrayList<>();
    private final Map<String, EventRecord> events = new LinkedHashMap<>();
    private final Map<String, IdempotencyRecord> idempotencies = new LinkedHashMap<>();
    private final Map<String, RewardGrant> rewardGrants = new LinkedHashMap<>();
    private final List<SeasonFact> seasonFacts = new ArrayList<>();
    private final Set<LocalDate> activeDates = new LinkedHashSet<>();

    public UserFacts(String subjectId) {
        this.subjectId = subjectId;
    }

    public String subjectId() {
        return subjectId;
    }

    public long xpBalance() {
        return xpBalance;
    }

    public long coinBalance() {
        return coinBalance;
    }

    public Optional<EventRecord> event(String eventId) {
        return Optional.ofNullable(events.get(eventId));
    }

    public Optional<IdempotencyRecord> idempotency(String key) {
        return Optional.ofNullable(idempotencies.get(key));
    }

    /** Durable adapters use a snapshot to persist the aggregate's append-only facts. */
    public Map<String, EventRecord> events() {
        return Map.copyOf(events);
    }

    /** Durable adapters use a snapshot to persist idempotent write receipts. */
    public Map<String, IdempotencyRecord> idempotencies() {
        return Map.copyOf(idempotencies);
    }

    public void recordEvent(String eventId, String fingerprint, EventConsumptionReceipt receipt) {
        events.put(eventId, new EventRecord(fingerprint, receipt));
    }

    public void recordIdempotency(String key, String fingerprint, Object response) {
        idempotencies.put(key, new IdempotencyRecord(fingerprint, response));
    }

    public LedgerEntry appendXp(String entryId, long delta, String sourceEventId, String reasonCode,
            String traceId, String ruleVersion, Instant occurredAt, Instant postedAt) {
        long nextBalance = checkedAdd(xpBalance, delta, "XP");
        LedgerEntry entry = new LedgerEntry(entryId, "XP", delta, nextBalance, sourceEventId, reasonCode,
                traceId, ruleVersion, occurredAt, postedAt);
        xpBalance = nextBalance;
        xpLedger.add(entry);
        assertConservation();
        return entry;
    }

    public LedgerEntry appendCoins(String entryId, long delta, String sourceEventId, String reasonCode,
            String traceId, String ruleVersion, Instant occurredAt, Instant postedAt) {
        long nextBalance = checkedAdd(coinBalance, delta, "COIN");
        LedgerEntry entry = new LedgerEntry(entryId, "COIN", delta, nextBalance, sourceEventId, reasonCode,
                traceId, ruleVersion, occurredAt, postedAt);
        coinBalance = nextBalance;
        coinLedger.add(entry);
        assertConservation();
        return entry;
    }

    /** Appends both positive completion entries after validating both next balances. */
    public void appendCompletion(String xpEntryId, long xpDelta, String coinEntryId, long coinDelta,
            String sourceEventId, String reasonCode, String traceId, String ruleVersion,
            Instant occurredAt, Instant postedAt) {
        long nextXp = checkedAdd(xpBalance, xpDelta, "XP");
        long nextCoins = checkedAdd(coinBalance, coinDelta, "COIN");
        LedgerEntry xpEntry = new LedgerEntry(xpEntryId, "XP", xpDelta, nextXp, sourceEventId, reasonCode,
                traceId, ruleVersion, occurredAt, postedAt);
        LedgerEntry coinEntry = new LedgerEntry(coinEntryId, "COIN", coinDelta, nextCoins, sourceEventId,
                reasonCode, traceId, ruleVersion, occurredAt, postedAt);
        xpBalance = nextXp;
        coinBalance = nextCoins;
        xpLedger.add(xpEntry);
        coinLedger.add(coinEntry);
        assertConservation();
    }

    public void addActiveDate(LocalDate date) {
        activeDates.add(date);
    }

    public Set<LocalDate> activeDates() {
        return Set.copyOf(activeDates);
    }

    public void addSeasonFact(SeasonFact fact) {
        seasonFacts.add(fact);
    }

    public List<SeasonFact> seasonFacts() {
        return List.copyOf(seasonFacts);
    }

    public void addReward(RewardGrant grant) {
        if (rewardGrants.putIfAbsent(grant.grantId(), grant) != null) {
            throw new GamificationDomainException(GamificationDomainException.Code.EVENT_CONFLICT,
                    "reward grant already exists");
        }
    }

    public Optional<RewardGrant> reward(String grantId) {
        return Optional.ofNullable(rewardGrants.get(grantId));
    }

    public List<RewardGrantView> rewardViews() {
        List<RewardGrantView> result = new ArrayList<>();
        for (RewardGrant grant : rewardGrants.values()) {
            result.add(grant.view());
        }
        return List.copyOf(result);
    }

    public List<LedgerEntry> xpLedger() {
        return List.copyOf(xpLedger);
    }

    public List<LedgerEntry> coinLedger() {
        return List.copyOf(coinLedger);
    }

    public boolean isConserved() {
        return sum(xpLedger) == xpBalance && sum(coinLedger) == coinBalance
                && xpBalance >= 0 && coinBalance >= 0;
    }

    public void assertConservation() {
        if (!isConserved()) {
            throw new GamificationDomainException(GamificationDomainException.Code.LEDGER_INVARIANT,
                    "ledger conservation invariant failed");
        }
    }

    private static long checkedAdd(long current, long delta, String ledgerName) {
        if (delta <= 0) {
            throw new GamificationDomainException(GamificationDomainException.Code.LEDGER_INVARIANT,
                    ledgerName + " ledger accepts only positive server settlements");
        }
        try {
            return Math.addExact(current, delta);
        } catch (ArithmeticException exception) {
            throw new GamificationDomainException(GamificationDomainException.Code.LEDGER_INVARIANT,
                    ledgerName + " ledger overflow");
        }
    }

    private static long sum(List<LedgerEntry> entries) {
        long result = 0;
        for (LedgerEntry entry : entries) {
            result = Math.addExact(result, entry.delta());
        }
        return result;
    }

    public record EventRecord(String fingerprint, EventConsumptionReceipt receipt) {
    }

    public record IdempotencyRecord(String fingerprint, Object response) {
    }
}
