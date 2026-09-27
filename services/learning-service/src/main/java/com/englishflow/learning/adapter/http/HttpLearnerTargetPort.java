package com.englishflow.learning.adapter.http;

import com.englishflow.learning.domain.DailyQuotaMinutes;
import com.englishflow.learning.domain.LearningPrincipalContext;
import com.englishflow.learning.port.LearnerTargetPort;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

/**
 * Learner target over HTTP from learner-service canonical reads.
 *
 * <p>Target identity and quota come from the V2 target; the timezone comes
 * from the V2 profile; the content pin ({@code contentVersionId}) is served
 * by learner-service itself after plans:ensure pins the verified placement
 * content onto the target ("定级完成自动 pin 定级内容"). This adapter never
 * invents pins: an unpinned target yields empty and plan creation stays
 * honestly unavailable. Goal codes are normalized to the lowercase port
 * pattern (ZERO_BASIS becomes zero_basis).
 */
public final class HttpLearnerTargetPort implements LearnerTargetPort {

    private final ObjectMapper mapper;
    private final HttpClient http;
    private final URI targetsUri;
    private final URI profileUri;
    private final Duration timeout;

    public HttpLearnerTargetPort(ObjectMapper mapper, String learnerBaseUrl) {
        this.mapper = mapper;
        this.http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2)).build();
        this.targetsUri = URI.create(normalize(learnerBaseUrl) + "/api/v1/learner/targets");
        this.profileUri = URI.create(normalize(learnerBaseUrl) + "/api/v1/learner/profile");
        this.timeout = Duration.ofSeconds(5);
    }

    @Override
    public Optional<LearnerTargetSnapshot> findTarget(LearningPrincipalContext principal, long targetId) {
        if (targetId < 1) return Optional.empty();
        String bearer = BearerTokens.current();
        if (bearer == null) return Optional.empty();
        Map<String, Object> target = get(targetsUri, bearer);
        Map<String, Object> profile = get(profileUri, bearer);
        if (target == null || profile == null) return Optional.empty();
        try {
            if (!(target.get("targetId") instanceof Number id) || id.longValue() != targetId) {
                return Optional.empty();
            }
            if (!"ACTIVE".equals(String.valueOf(target.get("status")))) return Optional.empty();
            if (!(target.get("stateVersion") instanceof Number version) || version.longValue() < 1) {
                return Optional.empty();
            }
            String goalCode = String.valueOf(target.get("goalCode")).toLowerCase(Locale.ROOT);
            if (!goalCode.matches("[a-z][a-z0-9._-]{1,63}")) return Optional.empty();
            if (!(target.get("dailyQuotaMinutes") instanceof Number minutes)) return Optional.empty();
            DailyQuotaMinutes.require(minutes.intValue());
            String timezone = String.valueOf(profile.get("timezone"));
            if (timezone == null || timezone.isBlank()) return Optional.empty();
            Object pin = target.get("pinnedContentVersionId");
            if (!(pin instanceof Number contentVersion) || contentVersion.longValue() < 1) {
                // Unpinned target: the placement pin has not landed yet.
                return Optional.empty();
            }
            return Optional.of(new LearnerTargetSnapshot(
                    principal.scope(), targetId, goalCode, minutes.intValue(), timezone,
                    contentVersion.longValue(), version.longValue()));
        } catch (IllegalArgumentException invalid) {
            return Optional.empty();
        }
    }

    private Map<String, Object> get(URI uri, String bearer) {
        HttpRequest request = HttpRequest.newBuilder(uri).timeout(timeout)
                .header("Authorization", "Bearer " + bearer)
                .header("Accept", "application/json").GET().build();
        HttpResponse<String> response;
        try {
            response = http.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        } catch (IOException | InterruptedException failed) {
            if (failed instanceof InterruptedException) Thread.currentThread().interrupt();
            throw unavailable("learner-service is unreachable");
        }
        if (response.statusCode() == 404) return null;
        if (response.statusCode() != 200) throw unavailable("learner-service answered " + response.statusCode());
        try {
            Object decoded = mapper.readValue(response.body(), Object.class);
            if (decoded instanceof Map<?, ?> envelope && envelope.get("data") instanceof Map<?, ?> data) {
                @SuppressWarnings("unchecked")
                Map<String, Object> result = (Map<String, Object>) data;
                return result;
            }
        } catch (Exception invalid) {
            throw unavailable("learner-service payload is invalid");
        }
        throw unavailable("learner-service payload has no data");
    }

    private static String normalize(String baseUrl) {
        if (baseUrl == null || baseUrl.isBlank()) throw unavailable("learner base URL is not configured");
        String normalized = baseUrl.trim();
        while (normalized.endsWith("/")) normalized = normalized.substring(0, normalized.length() - 1);
        if (!normalized.matches("https?://[^\\s]+")) throw unavailable("learner base URL is invalid");
        return normalized;
    }

    private static ResponseStatusException unavailable(String message) {
        return new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                "LEARNER_TARGET_UNAVAILABLE: " + message);
    }
}
