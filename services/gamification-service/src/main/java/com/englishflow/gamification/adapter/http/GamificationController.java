package com.englishflow.gamification.adapter.http;

import com.englishflow.gamification.application.GamificationApplicationService;
import com.englishflow.gamification.domain.EventConsumptionReceipt;
import com.englishflow.gamification.domain.GamificationSummary;
import com.englishflow.gamification.domain.LedgerView;
import com.englishflow.gamification.domain.RewardClaimReceipt;
import com.englishflow.gamification.domain.RewardListView;
import com.englishflow.gamification.domain.RewardProbabilityDisclosure;
import com.englishflow.gamification.domain.SeasonProjection;
import com.englishflow.gamification.domain.StreakProjection;
import com.englishflow.gamification.domain.TrustedCompletionEvent;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/internal/v1/gamification")
public final class GamificationController {

    private final GamificationApplicationService service;
    private final GamificationPrincipalResolver principals;

    public GamificationController(GamificationApplicationService service,
            GamificationPrincipalResolver principals) {
        this.service = service;
        this.principals = principals;
    }

    @PostMapping("/trusted-events/completions")
    public Map<String, Object> consumeCompletion(
            Authentication authentication,
            @RequestBody Map<String, Object> body,
            @RequestHeader("Idempotency-Key") String idempotencyKey) {
        String sourceService = principals.requireTrustedEventConsumer(authentication);
        EventConsumptionReceipt receipt = service.consumeTrustedEvent(
                TrustedCompletionEvent.from(body), idempotencyKey, sourceService);
        return map("eventId", receipt.eventId(),
                "settlementState", receipt.replayed() ? "DUPLICATE" : receipt.applied() ? "APPLIED" : "REJECTED",
                "ledgerEntryId", receipt.settlementId(), "replayed", receipt.replayed());
    }

    @GetMapping("/summary")
    public Map<String, Object> summary(Authentication authentication) {
        GamificationSummary summary = service.summary(principals.requireUser(authentication));
        return map("subjectRef", summary.subjectId(), "level", summary.level().level(),
                "serverScore", summary.xp(), "streakDays", summary.streak().currentStreak(),
                "currentSeason", summary.season().seasonId(), "featureEnabled", true);
    }

    @GetMapping("/ledger")
    public Map<String, Object> ledger(Authentication authentication,
            @RequestParam(defaultValue = "50") int limit) {
        LedgerView ledger = service.ledger(principals.requireUser(authentication), limit);
        List<Map<String, Object>> entries = new ArrayList<>();
        ledger.xp().forEach(entry -> entries.add(ledgerEntry(entry, "SCORE")));
        ledger.coins().forEach(entry -> entries.add(ledgerEntry(entry, "CURRENCY")));
        return map("items", entries, "nextCursor", "", "conserved", ledger.conserved());
    }

    @GetMapping("/rewards")
    public Map<String, Object> rewards(Authentication authentication) {
        RewardListView rewards = service.rewards(principals.requireUser(authentication));
        List<Map<String, Object>> items = rewards.grants().stream().map(grant -> map(
                "grantId", grant.grantId(), "rewardCode", grant.rewardCode(),
                "state", "CLAIMED".equals(grant.status()) ? "CLAIMED" : "AVAILABLE",
                "probabilityVersion", grant.probabilityVersion(), "issuedAt", grant.grantedAt(),
                "expiresAt", null)).toList();
        return map("items", items);
    }

    @GetMapping("/rewards/{grantId}/probability")
    public Map<String, Object> rewardProbability(Authentication authentication,
            @PathVariable String grantId) {
        RewardProbabilityDisclosure disclosure = service.rewardProbability(
                principals.requireUser(authentication), grantId);
        List<Map<String, Object>> tiers = disclosure.outcomes().stream().map(outcome -> map(
                "tierCode", outcome.outcomeCode(),
                "basisPoints", outcome.probability().multiply(java.math.BigDecimal.valueOf(10_000))
                        .setScale(0, RoundingMode.HALF_UP).intValue())).toList();
        return map("probabilityVersion", disclosure.probabilityVersion(), "tiers", tiers,
                "disclosedAt", Instant.now());
    }

    @PostMapping("/rewards/{grantId}/claim")
    public Map<String, Object> claimReward(Authentication authentication,
            @PathVariable String grantId,
            @RequestHeader("Idempotency-Key") String idempotencyKey) {
        RewardClaimReceipt claim = service.claimReward(
                principals.requireRewardClaimer(authentication), grantId, idempotencyKey);
        return map("grantId", claim.grantId(), "state", claim.replayed() ? "ALREADY_CLAIMED" : "CLAIMED",
                "claimId", claim.grantId() + ":" + claim.claimedAt().toString(),
                "replayed", claim.replayed(), "outcomeCode", claim.outcomeCode(),
                "probabilityVersion", claim.probabilityVersion());
    }

    @GetMapping("/streak")
    public StreakProjection streak(Authentication authentication) {
        return service.streak(principals.requireUser(authentication));
    }

    @GetMapping("/season")
    public SeasonProjection season(Authentication authentication) {
        return service.season(principals.requireUser(authentication));
    }

    private static Map<String, Object> ledgerEntry(
            com.englishflow.gamification.domain.LedgerEntry entry, String kind) {
        return map("entryId", entry.entryId(), "kind", kind, "amount", entry.delta(),
                "ruleVersion", entry.ruleVersion(), "occurredAt", entry.occurredAt(),
                "sourceEventId", entry.sourceEventId());
    }

    private static Map<String, Object> map(Object... pairs) {
        Map<String, Object> result = new LinkedHashMap<>();
        for (int index = 0; index < pairs.length; index += 2) {
            result.put(String.valueOf(pairs[index]), pairs[index + 1]);
        }
        return result;
    }
}
