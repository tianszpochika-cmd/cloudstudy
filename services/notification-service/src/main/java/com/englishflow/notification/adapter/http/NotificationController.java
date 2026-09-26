package com.englishflow.notification.adapter.http;

import com.englishflow.notification.application.DeliveryResult;
import com.englishflow.notification.application.NotificationApplicationService;
import com.englishflow.notification.application.QueueNotificationCommand;
import com.englishflow.notification.application.RequestMetadata;
import com.englishflow.notification.application.UpdatePreferenceCommand;
import com.englishflow.notification.domain.DeliveryAttempt;
import com.englishflow.notification.domain.IdempotencyKey;
import com.englishflow.notification.domain.NotificationChannel;
import com.englishflow.notification.domain.NotificationCategory;
import com.englishflow.notification.domain.NotificationDndWindow;
import com.englishflow.notification.domain.NotificationFrequencyPolicy;
import com.englishflow.notification.domain.NotificationMessage;
import com.englishflow.notification.domain.NotificationPrincipalContext;
import com.englishflow.notification.domain.NotificationPreference;
import com.englishflow.notification.domain.NotificationDomainException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.ZoneId;
import java.util.Base64;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;

@RestController
@RequestMapping("/internal/v1/notifications")
public final class NotificationController {

    private static final int DEFAULT_PREFERENCE_PAGE_SIZE = 20;
    private static final int MAX_PREFERENCE_PAGE_SIZE = 100;
    private static final Base64.Encoder CURSOR_ENCODER = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder CURSOR_DECODER = Base64.getUrlDecoder();
    private static final java.util.regex.Pattern REQUEST_ID_PATTERN = java.util.regex.Pattern
            .compile("^[A-Za-z][A-Za-z0-9._-]{7,127}$");
    private static final java.util.regex.Pattern TRACE_ID_PATTERN = java.util.regex.Pattern.compile("^[a-f0-9]{32}$");
    private static final java.util.regex.Pattern TRACEPARENT_PATTERN = java.util.regex.Pattern.compile(
            "^00-([a-f0-9]{32})-[a-f0-9]{16}-[a-f0-9]{2}$");
    private static final Comparator<NotificationPreference> PREFERENCE_ORDER = Comparator
            .comparing((NotificationPreference value) -> value.category().name())
            .thenComparing(value -> value.channel().name());

    private final NotificationApplicationService service;
    private final NotificationPrincipalResolver principals;
    private final String preferenceTimeZone;
    private final Clock clock;

    public NotificationController(NotificationApplicationService service,
            NotificationPrincipalResolver principals,
            @Value("${notification.preference.timezone:Asia/Shanghai}") String preferenceTimeZone,
            Clock clock) {
        this.service = service;
        this.principals = principals;
        this.preferenceTimeZone = ZoneId.of(preferenceTimeZone).getId();
        this.clock = clock;
    }

    @GetMapping("/preferences")
    public ResponseEntity<Map<String, Object>> preferences(Authentication authentication,
            @RequestParam(required = false) String cursor,
            @RequestParam(required = false) Integer pageSize,
            @RequestHeader HttpHeaders headers) {
        List<NotificationPreference> preferences = service.preferences(principals.require(authentication)).stream()
                .sorted(PREFERENCE_ORDER).toList();
        int requestedSize = pageSize == null ? DEFAULT_PREFERENCE_PAGE_SIZE : pageSize;
        if (requestedSize < 1) {
            throw NotificationDomainException.invalid("pageSize must be positive");
        }
        int boundedSize = Math.min(requestedSize, MAX_PREFERENCE_PAGE_SIZE);
        PreferenceCursor after = decodeCursor(cursor);
        if (after != null && preferences.stream().noneMatch(value -> compare(value, after) == 0)) {
            throw NotificationDomainException.invalid("cursor is invalid");
        }
        List<NotificationPreference> remaining = preferences.stream()
                .filter(value -> after == null || compare(value, after) > 0).toList();
        boolean hasMore = remaining.size() > boundedSize;
        List<Map<String, Object>> items = remaining.stream().limit(boundedSize)
                .map(preference -> preferenceView(preference, preferenceTimeZone)).toList();
        String nextCursor = hasMore ? encodeCursor(remaining.get(boundedSize - 1)) : null;
        return cursorPage(items, hasMore, nextCursor, boundedSize, responseContext(headers));
    }

    @PutMapping("/preferences/{notificationType}/{channel}")
    public ResponseEntity<Map<String, Object>> updatePreference(Authentication authentication,
            @PathVariable String notificationType,
            @PathVariable NotificationChannel channel,
            @Valid @RequestBody UpdatePreferenceRequest request,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestHeader(value = "X-Request-Id", required = false) String requestId,
            @RequestHeader(value = "X-Trace-Id", required = false) String traceId,
            @RequestHeader(value = "traceparent", required = false) String traceparent) {
        ApiRequestContext responseContext = responseContext(requestId, traceId, traceparent);
        NotificationPrincipalContext context = principals.require(authentication);
        NotificationPreference preference = service.updatePreference(context,
                new UpdatePreferenceCommand(notificationType, request.category(), channel, request.enabled(),
                        request.locale(), request.consentVersion(),
                        NotificationDndWindow.parse(request.dndWindow().startLocalTime(),
                                request.dndWindow().endLocalTime()),
                        request.frequencyPolicy(), request.expectedVersion()),
                new IdempotencyKey(idempotencyKey), responseContext.requestMetadata());
        return successEnvelope(preferenceView(preference, preferenceTimeZone), responseContext);
    }

    @GetMapping("/messages")
    public List<Map<String, Object>> messages(Authentication authentication,
            @RequestParam(defaultValue = "50") int limit) {
        return service.messages(principals.require(authentication), limit).stream()
                .map(NotificationController::messageView).toList();
    }

    @PostMapping("/messages")
    public NotificationMessage queue(Authentication authentication,
            @Valid @RequestBody QueueNotificationRequest request,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestHeader(value = "X-Request-Id", required = false) String requestId,
            @RequestHeader(value = "traceparent", required = false) String traceparent) {
        NotificationPrincipalContext context = principals.require(authentication);
        return service.queue(context, new QueueNotificationCommand(request.notificationType(), request.channel(),
                request.templateKey(), request.templateVersion(), request.title(), request.safeBody(),
                request.contentVersion()), new IdempotencyKey(idempotencyKey), metadata(requestId, traceparent));
    }

    @PostMapping("/messages/{messageId}/delivery")
    public DeliveryResult deliver(Authentication authentication, @PathVariable String messageId,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestHeader(value = "X-Request-Id", required = false) String requestId,
            @RequestHeader(value = "traceparent", required = false) String traceparent) {
        return service.deliver(principals.require(authentication), messageId,
                new IdempotencyKey(idempotencyKey), metadata(requestId, traceparent));
    }

    @GetMapping("/messages/{messageId}/delivery-attempts")
    public List<DeliveryAttempt> deliveryAttempts(Authentication authentication, @PathVariable String messageId) {
        return service.deliveryAttempts(principals.require(authentication), messageId);
    }

    private static RequestMetadata metadata(String requestId, String traceparent) {
        RequestMetadata generated = RequestMetadata.generated();
        return new RequestMetadata(requestId == null || requestId.isBlank() ? generated.requestId() : requestId,
                traceparent == null || traceparent.isBlank() ? generated.traceId() : traceparent);
    }

    private ResponseEntity<Map<String, Object>> successEnvelope(Object data, ApiRequestContext context) {
        return enveloped(data, responseMeta(context));
    }

    private ResponseEntity<Map<String, Object>> cursorPage(List<Map<String, Object>> data,
            boolean hasMore, String nextCursor, int pageSize, ApiRequestContext context) {
        Map<String, Object> meta = responseMeta(context);
        meta.put("hasMore", hasMore);
        meta.put("pageSize", pageSize);
        meta.put("nextCursor", nextCursor);
        return enveloped(data, meta);
    }

    private Map<String, Object> responseMeta(ApiRequestContext context) {
        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("requestId", context.requestId());
        meta.put("traceId", context.traceId());
        meta.put("apiVersion", "v1");
        meta.put("schemaVersion", "1.0.0");
        meta.put("serverTime", clock.instant());
        return meta;
    }

    private static ResponseEntity<Map<String, Object>> enveloped(Object data, Map<String, Object> meta) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("data", data);
        body.put("meta", meta);
        return ResponseEntity.ok()
                .header("X-Request-Id", (String) meta.get("requestId"))
                .header("X-Trace-Id", (String) meta.get("traceId"))
                .header("X-API-Version", "v1")
                .body(body);
    }

    private static ApiRequestContext responseContext(HttpHeaders headers) {
        return responseContext(headers.getFirst("X-Request-Id"), headers.getFirst("X-Trace-Id"),
                headers.getFirst("traceparent"));
    }

    private static ApiRequestContext responseContext(String requestId, String traceId, String traceparent) {
        RequestMetadata generated = RequestMetadata.generated();
        String resolvedRequestId = requestId != null && REQUEST_ID_PATTERN.matcher(requestId.trim()).matches()
                ? requestId.trim() : generated.requestId();
        String resolvedTraceId = traceId == null ? "" : traceId.trim().toLowerCase(java.util.Locale.ROOT);
        if (!TRACE_ID_PATTERN.matcher(resolvedTraceId).matches()) {
            Matcher parent = traceparent == null ? null : TRACEPARENT_PATTERN.matcher(traceparent.trim());
            resolvedTraceId = parent != null && parent.matches() && !isZeroTraceId(parent.group(1))
                    ? parent.group(1) : generated.traceId();
        }
        return new ApiRequestContext(resolvedRequestId, resolvedTraceId);
    }

    private static boolean isZeroTraceId(String traceId) {
        return "00000000000000000000000000000000".equals(traceId);
    }

    private static String encodeCursor(NotificationPreference preference) {
        String position = preference.category().name() + '\u0000' + preference.channel().name();
        return CURSOR_ENCODER.encodeToString(position.getBytes(StandardCharsets.UTF_8));
    }

    private static PreferenceCursor decodeCursor(String cursor) {
        if (cursor == null) return null;
        if (!cursor.matches("[A-Za-z0-9_-]{8,512}")) {
            throw NotificationDomainException.invalid("cursor is invalid");
        }
        try {
            byte[] bytes = CURSOR_DECODER.decode(cursor);
            String position = new String(bytes, StandardCharsets.UTF_8);
            int separator = position.indexOf('\u0000');
            if (bytes.length == 0 || bytes.length > 80 || separator <= 0
                    || separator != position.lastIndexOf('\u0000')
                    || !java.util.Arrays.equals(bytes, position.getBytes(StandardCharsets.UTF_8))) {
                throw NotificationDomainException.invalid("cursor is invalid");
            }
            PreferenceCursor decoded = new PreferenceCursor(
                    NotificationCategory.valueOf(position.substring(0, separator)),
                    NotificationChannel.valueOf(position.substring(separator + 1)));
            if (!encodeCursor(decoded).equals(cursor)) {
                throw NotificationDomainException.invalid("cursor is invalid");
            }
            return decoded;
        } catch (IllegalArgumentException exception) {
            throw NotificationDomainException.invalid("cursor is invalid");
        }
    }

    private static String encodeCursor(PreferenceCursor cursor) {
        String position = cursor.category().name() + '\u0000' + cursor.channel().name();
        return CURSOR_ENCODER.encodeToString(position.getBytes(StandardCharsets.UTF_8));
    }

    private static int compare(NotificationPreference value, PreferenceCursor cursor) {
        int category = value.category().name().compareTo(cursor.category().name());
        return category == 0 ? value.channel().name().compareTo(cursor.channel().name()) : category;
    }

    private record PreferenceCursor(NotificationCategory category, NotificationChannel channel) {
    }

    private record ApiRequestContext(String requestId, String traceId) {
        RequestMetadata requestMetadata() {
            return new RequestMetadata(requestId, traceId);
        }
    }

    public record UpdatePreferenceRequest(
            @NotNull NotificationCategory category,
            @NotNull Boolean enabled,
            @NotBlank @Size(max = 20) String locale,
            @NotNull @Min(1) Integer consentVersion,
            @NotNull @Valid DndWindowRequest dndWindow,
            @NotNull NotificationFrequencyPolicy frequencyPolicy,
            @NotNull @Min(0) Long expectedVersion) {
    }

    public record DndWindowRequest(
            @NotBlank @Pattern(regexp = "^(?:[01][0-9]|2[0-3]):[0-5][0-9]$") String startLocalTime,
            @NotBlank @Pattern(regexp = "^(?:[01][0-9]|2[0-3]):[0-5][0-9]$") String endLocalTime) {
    }

    public record QueueNotificationRequest(
            @NotBlank @Size(max = 80) String notificationType,
            @NotNull NotificationChannel channel,
            @NotBlank @Size(max = 120) String templateKey,
            @NotBlank @Size(max = 40) String templateVersion,
            @NotBlank @Size(max = 160) String title,
            @NotBlank @Size(max = 4000) String safeBody,
            @NotBlank @Size(max = 80) String contentVersion) {
    }

    private static Map<String, Object> preferenceView(NotificationPreference preference, String timezone) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("category", preference.category());
        result.put("channel", preference.channel());
        result.put("enabled", preference.enabled());
        result.put("locale", preference.locale());
        result.put("consentVersion", preference.consentVersion());
        result.put("dndWindow", Map.of(
                "startLocalTime", preference.dndWindow().startWireValue(),
                "endLocalTime", preference.dndWindow().endWireValue(),
                "timezone", timezone));
        result.put("frequencyPolicy", preference.frequencyPolicy());
        result.put("version", preference.version());
        result.put("updatedAt", preference.updatedAt());
        return result;
    }

    private static Map<String, Object> messageView(NotificationMessage message) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("messageId", message.messageId());
        result.put("notificationType", message.notificationType());
        result.put("channel", message.channel());
        result.put("title", message.title());
        result.put("safeBody", message.safeBody());
        result.put("contentVersion", message.contentVersion());
        result.put("createdAt", message.createdAt());
        result.put("read", message.isRead());
        return result;
    }
}
