package com.englishflow.adminops.risk;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import com.englishflow.adminops.domain.AdminOpsException;
import tools.jackson.databind.ObjectMapper;

/**
 * ACCOUNT_LOCKOUT facts over HTTP from iam-service's locked-accounts read.
 * The staff caller's bearer is forwarded unchanged (the caller's own
 * admin.risk.read is the authority; this adapter mints nothing). Any
 * transport or shape failure is fail-closed: rules file nothing on doubt.
 */
public final class HttpIamLockoutPort implements IamLockoutPort {

    private final ObjectMapper mapper;
    private final HttpClient http;
    private final URI lockedUri;
    private final Duration timeout;

    public HttpIamLockoutPort(ObjectMapper mapper, String iamBaseUrl) {
        this.mapper = mapper;
        this.http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2)).build();
        String base = iamBaseUrl == null ? "" : iamBaseUrl.trim();
        while (base.endsWith("/")) {
            base = base.substring(0, base.length() - 1);
        }
        if (!base.matches("https?://[^\\s]+")) {
            throw new AdminOpsException("RISK_IAM_UNAVAILABLE", "IAM base URL is invalid", 503, true);
        }
        this.lockedUri = URI.create(base + "/api/v1/iam/accounts/locked");
        this.timeout = Duration.ofSeconds(5);
    }

    @Override
    public List<LockedAccount> lockedAccounts(String bearer, int limit) {
        if (bearer == null || bearer.isBlank()) {
            throw new AdminOpsException("RISK_IAM_UNAVAILABLE", "caller bearer is required", 503, true);
        }
        int bound = Math.max(1, Math.min(limit <= 0 ? 50 : limit, 100));
        HttpRequest request = HttpRequest.newBuilder(
                        URI.create(lockedUri + "?pageSize=" + bound)).timeout(timeout)
                .header("Authorization", "Bearer " + bearer)
                .header("Accept", "application/json").GET().build();
        HttpResponse<String> response;
        try {
            response = http.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        } catch (IOException | InterruptedException failed) {
            if (failed instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            throw new AdminOpsException("RISK_IAM_UNAVAILABLE", "iam-service is unreachable", 503, true);
        }
        if (response.statusCode() != 200) {
            throw new AdminOpsException("RISK_IAM_UNAVAILABLE",
                    "iam-service answered " + response.statusCode(), 503, true);
        }
        try {
            Object decoded = mapper.readValue(response.body(), Object.class);
            if (!(decoded instanceof Map<?, ?> envelope) || !(envelope.get("data") instanceof Map<?, ?> data)
                    || !(data.get("items") instanceof List<?> items)) {
                throw new AdminOpsException("RISK_IAM_UNAVAILABLE", "IAM lockout payload has no items", 503, true);
            }
            List<LockedAccount> result = new ArrayList<>();
            for (Object raw : items) {
                if (raw instanceof Map<?, ?> row) {
                    result.add(new LockedAccount(
                            String.valueOf(row.get("subjectRef")),
                            row.get("failedAttempts") instanceof Number number ? number.intValue() : 0,
                            row.get("lockedUntil") == null ? null : Instant.parse(String.valueOf(row.get("lockedUntil"))),
                            row.get("updatedAt") == null ? null : Instant.parse(String.valueOf(row.get("updatedAt")))));
                }
            }
            return List.copyOf(result);
        } catch (AdminOpsException failure) {
            throw failure;
        } catch (Exception invalid) {
            throw new AdminOpsException("RISK_IAM_UNAVAILABLE", "IAM lockout payload is invalid", 503, true);
        }
    }
}
