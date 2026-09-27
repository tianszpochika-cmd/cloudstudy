package com.englishflow.assessment.adapter.content;

import com.englishflow.assessment.domain.ContentSnapshot;
import com.englishflow.assessment.domain.P1PlacementScorer;
import com.englishflow.assessment.domain.QuestionType;
import com.englishflow.assessment.port.P1PlacementSourcePort;
import com.englishflow.assessment.web.AssessmentHttpPrincipals.VerifiedAssessmentPrincipal;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * HTTP placement source: assessment never invents pins or question masters.
 *
 * <p>The sealed ten-item bank comes from content-service
 * ({@code GET /internal/v1/content/placement-bank/sealed}) and the active
 * target fact comes from the canonical learner owner read
 * ({@code GET /api/v1/learner/targets}, which carries the real numeric
 * {@code targetId} and {@code stateVersion}). Phase 1 forwards the incoming
 * verified learner JWT on both calls until validated workload identity lands;
 * a future internal target-pin twin can move the learner leg to
 * {@code /internal/v1} without changing pin semantics. Every transport, shape
 * or pin problem fails closed with 503: the controller never substitutes the
 * B25 two-question legacy set for the P1 ten-item snapshot.
 *
 * <p>Target pin semantics: {@code targetId}/{@code targetVersion} are the
 * learner owner's identifiers verbatim; {@code targetSnapshotDigest} is the
 * SHA-256 of the canonical target fields, so any goal change yields a fresh
 * pin set and a fresh placement session instead of reusing a stale result.
 */
public final class HttpPlacementBankPort implements P1PlacementSourcePort {

    private static final String BANK = "P1_PLACEMENT_V1";
    private static final String COMPLETION_RULE = "P1_PLACEMENT_V1";

    private final ObjectMapper mapper;
    private final HttpClient http;
    private final URI sealedUri;
    private final URI targetUri;
    private final Duration timeout;

    public HttpPlacementBankPort(ObjectMapper mapper, String contentBaseUrl, String learnerBaseUrl,
                                 Duration timeout) {
        this.mapper = mapper;
        this.http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2)).build();
        this.sealedUri = URI.create(normalize(contentBaseUrl) + "/internal/v1/content/placement-bank/sealed");
        this.targetUri = URI.create(normalize(learnerBaseUrl) + "/api/v1/learner/targets");
        this.timeout = timeout == null || timeout.isNegative() || timeout.isZero()
                ? Duration.ofSeconds(5) : timeout;
    }

    @Override
    public Resolved resolve(VerifiedAssessmentPrincipal principal) {
        String bearer = bearerToken();
        Map<String, Object> bank = getData(sealedUri, bearer, "placement bank");
        if (bank == null) {
            throw unavailable("placement bank snapshot is unavailable");
        }
        Map<String, Object> goal = activeGoal(bearer);
        return new Resolved(targetPin(goal), contentPin(bank), answerRulePin(bank),
                sealedItems(bank), true, true, true, true, true);
    }

    private Map<String, Object> activeGoal(String bearer) {
        Map<String, Object> data = getData(targetUri, bearer, "learner target");
        if (data == null) {
            throw unavailable("learner target pin is unavailable");
        }
        if (!"ACTIVE".equals(String.valueOf(data.get("status")))) {
            throw unavailable("learner target pin is unavailable: no ACTIVE goal");
        }
        if (!(data.get("targetId") instanceof Number targetId) || targetId.longValue() < 1
                || String.valueOf(data.get("goalCode")).isBlank()
                || String.valueOf(data.get("targetLevel")).isBlank()
                || !(data.get("stateVersion") instanceof Number)) {
            throw unavailable("learner target pin is incomplete");
        }
        return data;
    }

    private Map<String, Object> targetPin(Map<String, Object> goal) {
        long targetId = ((Number) goal.get("targetId")).longValue();
        long targetVersion = ((Number) goal.get("stateVersion")).longValue();
        if (targetVersion < 1) {
            throw unavailable("learner target pin version is invalid");
        }
        String digest = sha256("p1-target-pin|" + targetId + "|"
                + goal.get("goalCode") + "|" + goal.get("targetLevel") + "|"
                + goal.get("dailyQuotaMinutes") + "|" + goal.get("status") + "|"
                + targetVersion + "|" + goal.get("updatedAt"));
        Map<String, Object> pin = new LinkedHashMap<>();
        pin.put("targetId", targetId);
        pin.put("targetVersion", targetVersion);
        pin.put("targetSnapshotDigest", digest);
        return pin;
    }

    private Map<String, Object> contentPin(Map<String, Object> bank) {
        requireBank(bank);
        Map<String, Object> pin = new LinkedHashMap<>();
        pin.put("contentVersionId", positiveLong(bank.get("contentVersionId"), "bank content version"));
        pin.put("contentEpoch", nonNegativeLong(bank.get("contentEpoch"), "bank content epoch"));
        pin.put("snapshotId", token(bank.get("snapshotId"), "bank snapshot id"));
        pin.put("snapshotHash", digest(bank.get("snapshotHash"), "bank snapshot hash"));
        return pin;
    }

    private Map<String, Object> answerRulePin(Map<String, Object> bank) {
        requireBank(bank);
        Map<String, Object> pin = new LinkedHashMap<>();
        pin.put("answerRuleSetVersion", text(bank.get("answerRuleSetVersion"), "bank rule set version"));
        pin.put("answerRuleVersion", text(bank.get("answerRuleVersion"), "bank rule version"));
        pin.put("ruleDigest", digest(bank.get("ruleDigest"), "bank rule digest"));
        pin.put("completionRuleVersion", COMPLETION_RULE);
        return pin;
    }

    private List<SealedItem> sealedItems(Map<String, Object> bank) {
        requireBank(bank);
        Object rawItems = bank.get("items");
        if (!(rawItems instanceof List<?> values) || values.size() != 10) {
            throw unavailable("placement bank must expose exactly ten sealed items");
        }
        long contentVersionId = positiveLong(bank.get("contentVersionId"), "bank content version");
        String scoringVersion = text(bank.get("answerRuleVersion"), "bank rule version");
        List<SealedItem> items = new ArrayList<>(10);
        for (Object rawItem : values) {
            if (!(rawItem instanceof Map<?, ?> raw)) {
                throw unavailable("placement bank item is invalid");
            }
            @SuppressWarnings("unchecked")
            Map<String, Object> item = (Map<String, Object>) raw;
            long itemId = positiveLong(item.get("itemId"), "bank item id");
            P1PlacementScorer.Dimension dimension = dimension(item.get("dimension"));
            Map<String, Object> learnerItem = learnerItem(item, itemId);
            Map<String, Object> answerRule = answerRule(item);
            int maxScore = maxScore(item);
            ContentSnapshot snapshot = new ContentSnapshot(
                    String.valueOf(item.get("contentCode")),
                    positiveLong(item.get("contentVersionId"), "bank item content version"),
                    itemId, itemId, QuestionType.CHOICE,
                    Map.of("stem", String.valueOf(item.get("stem")), "options", learnerItem.get("options")),
                    answerRule, scoringVersion, maxScore, true);
            if (snapshot.contentVersionId() != contentVersionId
                    || !snapshot.scoringVersion().equals(scoringVersion)) {
                throw unavailable("placement bank item does not match the bank pin");
            }
            items.add(new SealedItem(itemId, dimension, learnerItem, snapshot));
        }
        return List.copyOf(items);
    }

    private Map<String, Object> learnerItem(Map<String, Object> item, long itemId) {
        if (!(item.get("displayOrder") instanceof Number order)) {
            throw unavailable("bank item display order is invalid");
        }
        Map<String, Object> learner = new LinkedHashMap<>();
        learner.put("itemId", itemId);
        learner.put("itemCode", String.valueOf(item.get("itemCode")));
        learner.put("itemType", String.valueOf(item.get("itemType")));
        learner.put("stem", String.valueOf(item.get("stem")));
        learner.put("options", item.get("options"));
        learner.put("displayOrder", order.intValue());
        return learner;
    }

    private Map<String, Object> answerRule(Map<String, Object> item) {
        if (!(item.get("answerRule") instanceof Map<?, ?> rule)
                || !(rule.get("correctOption") instanceof String correct)
                || correct.isBlank()) {
            throw unavailable("placement bank answer rule is invalid");
        }
        Map<String, Object> answerRules = new HashMap<>();
        answerRules.put("correctOption", correct);
        return answerRules;
    }

    private void requireBank(Map<String, Object> bank) {
        if (bank == null || !BANK.equals(bank.get("bankCode"))) {
            throw unavailable("placement bank snapshot is unavailable");
        }
    }

    private Map<String, Object> getData(URI uri, String bearer, String what) {
        HttpRequest request = HttpRequest.newBuilder(uri).timeout(timeout)
                .header("Authorization", "Bearer " + bearer)
                .header("Accept", "application/json").GET().build();
        HttpResponse<String> response;
        try {
            response = http.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        } catch (IOException | InterruptedException failed) {
            if (failed instanceof InterruptedException) Thread.currentThread().interrupt();
            throw unavailable(what + " is unreachable");
        }
        if (response.statusCode() == 404) return null;
        if (response.statusCode() != 200) {
            throw unavailable(what + " answered " + response.statusCode());
        }
        try {
            Object decoded = mapper.readValue(response.body(), Object.class);
            // Both upstreams wrap facts in a {data} envelope; a missing or
            // non-object data member is never treated as an empty bank/goal.
            if (decoded instanceof Map<?, ?> envelope && envelope.get("data") instanceof Map<?, ?> data) {
                @SuppressWarnings("unchecked")
                Map<String, Object> result = (Map<String, Object>) data;
                return result;
            }
        } catch (ResponseStatusException expected) {
            throw expected;
        } catch (Exception invalid) {
            throw unavailable(what + " payload is invalid");
        }
        throw unavailable(what + " payload has no data");
    }

    private String bearerToken() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication instanceof JwtAuthenticationToken jwt && jwt.isAuthenticated()) {
            String token = jwt.getToken().getTokenValue();
            if (token != null && !token.isBlank()) return token;
        }
        throw unavailable("placement source requires the verified caller JWT");
    }

    private static P1PlacementScorer.Dimension dimension(Object value) {
        try {
            return P1PlacementScorer.Dimension.valueOf(String.valueOf(value));
        } catch (IllegalArgumentException unknown) {
            throw unavailable("placement bank dimension is unknown");
        }
    }

    private static long positiveLong(Object value, String what) {
        if (value instanceof Number number && number.longValue() > 0) return number.longValue();
        throw unavailable(what + " is invalid");
    }

    private static int maxScore(Object item) {
        if (item instanceof Map<?, ?> map && map.get("maxScore") instanceof Number number
                && number.intValue() >= 1 && number.intValue() <= 100) {
            return number.intValue();
        }
        throw unavailable("bank item max score is invalid");
    }

    private static long nonNegativeLong(Object value, String what) {
        if (value instanceof Number number && number.longValue() >= 0) return number.longValue();
        throw unavailable(what + " is invalid");
    }

    private static String text(Object value, String what) {
        if (value instanceof String text && !text.isBlank() && text.length() <= 96) return text;
        throw unavailable(what + " is invalid");
    }

    private static String token(Object value, String what) {
        if (value instanceof String text && !text.isBlank()) return text;
        throw unavailable(what + " is invalid");
    }

    private static String digest(Object value, String what) {
        if (value instanceof String text && text.matches("[a-f0-9]{64}")) return text;
        throw unavailable(what + " is invalid");
    }

    private static String normalize(String baseUrl) {
        if (baseUrl == null || baseUrl.isBlank()) throw unavailable("placement bank base URL is not configured");
        String normalized = baseUrl.trim();
        while (normalized.endsWith("/")) normalized = normalized.substring(0, normalized.length() - 1);
        if (!normalized.matches("https?://[^\\s]+")) throw unavailable("placement bank base URL is invalid");
        return normalized;
    }

    private static String sha256(String value) {
        return HexFormat.of().formatHex(sha256Bytes(value));
    }

    private static byte[] sha256Bytes(String value) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException(impossible);
        }
    }

    private static ResponseStatusException unavailable(String message) {
        return new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                "P1_PLACEMENT_SOURCE_UNAVAILABLE: " + message);
    }
}
