package com.englishflow.iam.web;

import com.englishflow.iam.domain.AccountRecord;
import com.englishflow.iam.domain.AccountStore;
import com.englishflow.iam.domain.IamPolicyException;
import com.englishflow.iam.domain.PolicyAccessAuthenticationVerifier;
import com.englishflow.iam.domain.PolicyActor;
import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Objects;

/**
 * Staff security reads over IAM-owned account facts.
 *
 * <p>Minimal disclosure by construction: lockout rows expose only an opaque
 * stable subject reference plus lock state. Raw identity, identifiers and
 * credential material never leave IAM. Callers authenticate with their own
 * staff access JWT (verified + current-permission recheck, same discipline as
 * the policy control plane); service-token transport is a future hardening
 * step, not a silent fallback.
 */
@RestController
@RequestMapping("/api/v1/iam/accounts")
public final class IamAccountSecurityController {

    private static final String REQUIRED_PERMISSION = "admin.risk.read";

    private final AccountStore accounts;
    private final PolicyAccessAuthenticationVerifier accessVerifier;
    private final Clock clock;

    public IamAccountSecurityController(AccountStore accounts,
                                        PolicyAccessAuthenticationVerifier accessVerifier,
                                        Clock clock) {
        this.accounts = Objects.requireNonNull(accounts, "accounts");
        this.accessVerifier = Objects.requireNonNull(accessVerifier, "accessVerifier");
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    @GetMapping("/locked")
    public ResponseEntity<IamPolicyControlController.CursorEnvelope<LockedListResponse>> locked(
            Authentication authentication,
            @RequestParam(value = "cursor", required = false) String cursor,
            @RequestParam(value = "pageSize", required = false) Integer pageSize) {
        PolicyActor actor = accessVerifier.verify(authentication);
        actor.require(REQUIRED_PERMISSION);
        int size = pageSize == null ? 50 : pageSize;
        if (size < 1 || size > 100) {
            throw IamPolicyControlController.invalid();
        }
        int offset = decodeCursor(cursor);
        // Over-read by one to derive hasMore without a count query.
        List<AccountRecord> rows = accounts.findLocked(Instant.now(clock), offset + size + 1);
        if (offset > rows.size()) {
            throw IamPolicyControlController.invalid();
        }
        int end = Math.min(rows.size(), offset + size);
        Instant now = Instant.now(clock);
        List<LockedAccountResponse> items = rows.subList(offset, end).stream()
                .map(account -> new LockedAccountResponse(
                        subjectRef(account.principalId().value()),
                        account.failedAttempts(),
                        account.lockedUntil(),
                        account.updatedAt()))
                .toList();
        IamPolicyControlController.Meta meta = IamPolicyControlController.meta();
        IamPolicyControlController.PageMeta page = new IamPolicyControlController.PageMeta(
                meta.requestId(), meta.traceId(), meta.apiVersion(), meta.schemaVersion(), now,
                end < rows.size() ? encodeCursor(end) : null, now, end < rows.size(), size);
        return ResponseEntity.status(HttpStatus.OK).cacheControl(CacheControl.noStore())
                .header("X-Request-Id", meta.requestId()).header("X-Trace-Id", meta.traceId())
                .header("X-API-Version", meta.apiVersion())
                .body(new IamPolicyControlController.CursorEnvelope<>(new LockedListResponse(items), page));
    }

    static String subjectRef(java.util.UUID principalId) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(("iam-locked:" + principalId).getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (java.security.NoSuchAlgorithmException impossible) {
            throw new IllegalStateException(impossible);
        }
    }

    private static int decodeCursor(String cursor) {
        if (cursor == null || cursor.isBlank()) {
            return 0;
        }
        try {
            int offset = Integer.parseInt(
                    new String(Base64.getUrlDecoder().decode(cursor), StandardCharsets.UTF_8));
            if (offset < 0) {
                throw IamPolicyControlController.invalid();
            }
            return offset;
        } catch (IllegalArgumentException exception) {
            throw IamPolicyControlController.invalid();
        }
    }

    private static String encodeCursor(int offset) {
        return Base64.getUrlEncoder().withoutPadding()
                .encodeToString(Integer.toString(offset).getBytes(StandardCharsets.UTF_8));
    }

    @ExceptionHandler(IamPolicyException.class)
    public ResponseEntity<IamPolicyControlController.ErrorEnvelope> policyError(
            IamPolicyException exception, HttpServletRequest request) {
        return IamPolicyControlController.errorResponse(exception);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<IamPolicyControlController.ErrorEnvelope> invalidBody(HttpServletRequest request) {
        return IamPolicyControlController.errorResponse(IamPolicyControlController.invalid());
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record LockedListResponse(List<LockedAccountResponse> items) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record LockedAccountResponse(String subjectRef, int failedAttempts, Instant lockedUntil, Instant updatedAt) {}
}
