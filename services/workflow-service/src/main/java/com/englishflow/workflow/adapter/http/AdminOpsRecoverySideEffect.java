package com.englishflow.workflow.adapter.http;

import com.englishflow.workflow.application.RecoverySideEffectPort;
import com.englishflow.workflow.domain.ManualRecoveryRequest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Locale;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Executes allowlisted recoveries by calling the owner service's internal command API.
 * workflow-service never writes another service's schema: admin-ops authorises the
 * executor's token, applies the transition, and writes its own audit row. The recovery
 * id is the idempotency key, so a retry after an unknown outcome replays instead of failing.
 * Only workflow's own {@code recovery_side_effect_log} is written here.
 */
public final class AdminOpsRecoverySideEffect implements RecoverySideEffectPort {

    private static final Pattern CODE = Pattern.compile("\"code\"\\s*:\\s*\"([A-Za-z0-9_.]+)\"");

    /** Minimal transport seam so tests need no network. */
    public interface Transport {
        Response post(URI uri, String bearerToken, String idempotencyKey) throws IOException, InterruptedException;
    }

    public record Response(int status, String body) {
    }

    private final Transport transport;
    private final String baseUrl;
    private final JdbcTemplate jdbc;

    public AdminOpsRecoverySideEffect(Transport transport, String baseUrl, JdbcTemplate jdbc) {
        this.transport = transport;
        this.baseUrl = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
        this.jdbc = jdbc;
    }

    public static Transport httpTransport(Duration timeout) {
        HttpClient client = HttpClient.newBuilder().connectTimeout(timeout).build();
        return (uri, bearer, key) -> {
            HttpRequest request = HttpRequest.newBuilder(uri)
                    .timeout(timeout)
                    .header("Authorization", "Bearer " + bearer)
                    .header("Idempotency-Key", key)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString("{}"))
                    .build();
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            return new Response(response.statusCode(), response.body());
        };
    }

    @Override
    public String apply(String recoveryId, String subjectType, String subjectId, String action, String executor,
                        String bearerToken) {
        String type = subjectType == null ? "" : subjectType.trim().toUpperCase(Locale.ROOT);
        String act = action == null ? "" : action.trim().toUpperCase(Locale.ROOT);
        if (!("TICKET".equals(type) && "REOPEN".equals(act))) {
            throw new ManualRecoveryRequest.RecoveryNotAllowed(
                    "no executable recovery for " + type + "/" + act + "; supported: TICKET/REOPEN");
        }
        if (bearerToken == null || bearerToken.isBlank()) {
            throw new SideEffectUncertain("executor token unavailable; nothing was sent");
        }
        URI uri = URI.create(baseUrl + "/internal/v1/admin-ops/tickets/"
                + URLEncoder.encode(subjectId, StandardCharsets.UTF_8).replace("+", "%20") + "/recovery-reopen");
        Response response;
        try {
            response = transport.post(uri, bearerToken, "recovery-" + recoveryId);
        } catch (IOException error) {
            log(recoveryId, type, subjectId, act, executor, "UNCERTAIN", "transport: " + error.getClass().getSimpleName());
            throw new SideEffectUncertain("admin-ops unreachable; retry is safe", error);
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            log(recoveryId, type, subjectId, act, executor, "UNCERTAIN", "interrupted");
            throw new SideEffectUncertain("admin-ops call interrupted; retry is safe", error);
        }
        int status = response.status();
        String body = response.body() == null ? "" : response.body();
        if (status >= 200 && status < 300) {
            boolean replayed = body.contains("\"replayed\":true");
            String detail = "admin-ops support_ticket -> IN_PROGRESS" + (replayed ? " (replayed)" : "");
            log(recoveryId, type, subjectId, act, executor, "APPLIED", detail);
            return detail;
        }
        String code = code(body);
        if (status >= 500 || status == 429) {
            log(recoveryId, type, subjectId, act, executor, "UNCERTAIN", "admin-ops " + status + " " + code);
            throw new SideEffectUncertain("admin-ops returned " + status + " " + code + "; retry is safe");
        }
        String detail = "admin-ops refused " + status + " " + code;
        log(recoveryId, type, subjectId, act, executor, "FAILED", detail);
        throw new ManualRecoveryRequest.RecoveryNotAllowed(detail);
    }

    private static String code(String body) {
        Matcher matcher = CODE.matcher(body);
        return matcher.find() ? matcher.group(1) : "UNKNOWN";
    }

    private void log(String recoveryId, String type, String subjectId, String action, String executor,
                     String outcome, String detail) {
        if (jdbc == null) {
            return;
        }
        jdbc.update("""
                INSERT INTO recovery_side_effect_log
                    (effect_id, recovery_id, subject_type, subject_id, action, executor, outcome, detail, occurred_at)
                VALUES (?,?,?,?,?,?,?,?,UTC_TIMESTAMP(6))
                """, UUID.randomUUID().toString(), recoveryId, type, subjectId, action, executor, outcome,
                detail.length() > 512 ? detail.substring(0, 512) : detail);
    }
}
