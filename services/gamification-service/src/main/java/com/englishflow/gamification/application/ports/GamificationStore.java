package com.englishflow.gamification.application.ports;

import java.time.ZoneId;
import java.util.List;
import java.util.Optional;

import com.englishflow.gamification.domain.CompletionSettlement;
import com.englishflow.gamification.domain.IdempotencyRecord;
import com.englishflow.gamification.domain.LedgerCurrency;
import com.englishflow.gamification.domain.LedgerEntry;
import com.englishflow.gamification.domain.ProcessedEvent;
import com.englishflow.gamification.domain.RewardClaim;
import com.englishflow.gamification.domain.RewardGrant;
import com.englishflow.gamification.domain.SeasonFact;
import com.englishflow.gamification.domain.StreakProjection;

/**
 * GAM facts/projections port. A durable implementation must preserve append-only fact semantics
 * and enforce the same uniqueness constraints as this in-memory smoke adapter.
 */
public interface GamificationStore {

    Optional<ProcessedEvent> findProcessedEvent(String dedupeKey);

    void appendProcessedEvent(ProcessedEvent processedEvent);

    Optional<IdempotencyRecord> findIdempotency(String scope, String subject, String key);

    void saveIdempotency(IdempotencyRecord record);

    List<LedgerEntry> ledger(String subject, LedgerCurrency currency);

    void appendLedger(LedgerEntry entry);

    List<SeasonFact> seasonFacts(String subject, String seasonId);

    void appendSeasonFact(SeasonFact fact);

    StreakProjection streak(String subject, ZoneId defaultZone);

    void saveStreak(StreakProjection projection);

    ZoneId userTimeZone(String subject, ZoneId defaultZone);

    boolean hasExplicitTimeZone(String subject);

    void saveUserTimeZone(String subject, ZoneId zone);

    void appendRewardGrant(RewardGrant grant);

    List<RewardGrant> rewardGrants(String subject);

    Optional<RewardGrant> rewardGrant(String subject, String grantId);

    boolean claimReward(RewardGrant claimedGrant, RewardClaim claim);

    List<RewardClaim> rewardClaims(String subject);

    boolean ledgerConserved(String subject);

    long balance(String subject, LedgerCurrency currency);
}
