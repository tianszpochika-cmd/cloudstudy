package com.englishflow.iam.domain;

import com.englishflow.iam.config.IamServiceProperties;

import java.security.SecureRandom;
import java.time.Clock;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/** Owns opaque refresh sessions, rotation, replay detection and revocation. */
public final class SessionService {
    private final SessionStore sessions;
    private final AuditFactPort audit;
    private final Clock clock;
    private final java.time.Duration refreshTtl;
    private final java.time.Duration accessTtl;
    private final SecureRandom random = new SecureRandom();
    private final ConcurrentHashMap<SessionId, Object> locks = new ConcurrentHashMap<>();

    public SessionService(SessionStore sessions, AuditFactPort audit, Clock clock, IamServiceProperties properties) {
        this.sessions = Objects.requireNonNull(sessions, "sessions");
        this.audit = Objects.requireNonNull(audit, "audit");
        this.clock = Objects.requireNonNull(clock, "clock");
        this.refreshTtl = positive(properties.getJwt().getRefreshTokenTtl(), java.time.Duration.ofDays(30));
        this.accessTtl = positive(properties.getJwt().getAccessTokenTtl(), java.time.Duration.ofMinutes(15));
    }

    public SessionCreation open(ServerPrincipalContext context, DeviceId deviceId) {
        String token = randomToken();
        Instant now = Instant.now(clock);
        SessionRecord session = new SessionRecord(SessionId.random(), context.principalId(), context.scope(), deviceId,
                UUID.randomUUID().toString(), SecretDigests.sha256Hex(token), 0, SessionStatus.ACTIVE,
                now, now, now.plus(refreshTtl), null, null);
        SessionRecord saved = sessions.save(session);
        appendAudit(saved.scope(), IamDecisionCode.SESSION_OPENED, "session_opened", true);
        return new SessionCreation(saved, token);
    }

    /** Test/helper seam for deterministic tokens; HTTP callers use {@link #open}. */
    public SessionRecord openWithRefreshToken(ServerPrincipalContext context, DeviceId deviceId, String token) {
        if (token == null || token.isBlank()) throw new IllegalArgumentException("refresh token is blank");
        Instant now = Instant.now(clock);
        SessionRecord session = new SessionRecord(SessionId.random(), context.principalId(), context.scope(), deviceId,
                UUID.randomUUID().toString(), SecretDigests.sha256Hex(token), 0, SessionStatus.ACTIVE,
                now, now, now.plus(refreshTtl), null, null);
        SessionRecord saved = sessions.save(session);
        appendAudit(saved.scope(), IamDecisionCode.SESSION_OPENED, "session_opened", true);
        return saved;
    }

    public SessionRotationResult rotate(SessionId sessionId, String presentedRefreshToken) {
        if (presentedRefreshToken == null || presentedRefreshToken.isBlank()) throw invalidRefresh();
        synchronized (locks.computeIfAbsent(sessionId, ignored -> new Object())) {
            SessionRecord current = sessions.find(sessionId).orElseThrow(() -> new IamPolicyException(
                    IamDecisionCode.SESSION_NOT_FOUND, "iam.session.not_found"));
            Instant now = Instant.now(clock);
            if (current.status() != SessionStatus.ACTIVE) throw new IamPolicyException(IamDecisionCode.SESSION_REVOKED, "iam.session.revoked");
            if (!current.expiresAt().isAfter(now)) {
                revokeLocally(current, "refresh_expired");
                throw new IamPolicyException(IamDecisionCode.SESSION_EXPIRED, "iam.session.expired");
            }
            String presentedDigest = SecretDigests.sha256Hex(presentedRefreshToken);
            if (!SecretDigests.constantTimeEquals(current.refreshTokenDigest(), presentedDigest)) {
                revokeLocally(current, "refresh_replay");
                appendAudit(current.scope(), IamDecisionCode.SESSION_REPLAY, "session_replay", false);
                throw new IamPolicyException(IamDecisionCode.SESSION_REPLAY, "iam.session.replay");
            }
            String nextToken = randomToken();
            SessionRecord next = current.rotate(SecretDigests.sha256Hex(nextToken), now);
            SessionRecord persisted;
            try {
                persisted = sessions.replaceIfCurrent(current.sessionId(), current.rotation(), current.refreshTokenDigest(), next)
                        .orElseThrow(() -> new IamPolicyException(IamDecisionCode.SESSION_REPLAY, "iam.session.replay"));
            } catch (IamPolicyException exception) {
                revokeLocally(current, "rotation_compare_and_set_conflict");
                appendAudit(current.scope(), IamDecisionCode.SESSION_REPLAY, "session_replay", false);
                throw exception;
            } catch (RuntimeException exception) {
                revokeLocally(current, "session_store_unavailable");
                throw new IamPolicyException(IamDecisionCode.SESSION_STORE_UNAVAILABLE, "iam.session.store_unavailable");
            }
            appendAudit(persisted.scope(), IamDecisionCode.SESSION_ROTATED, "session_rotated", true);
            return new SessionRotationResult(persisted.sessionId(), persisted.principalId(), persisted.deviceId(),
                    persisted.rotation(), nextToken, now.plus(accessTtl));
        }
    }

    public SessionRotationResult rotateByRefreshToken(String presentedRefreshToken) {
        if (presentedRefreshToken == null || presentedRefreshToken.isBlank()) throw invalidRefresh();
        String digest = SecretDigests.sha256Hex(presentedRefreshToken);
        SessionRecord session = sessions.findByRefreshTokenDigest(digest).orElseThrow(() ->
                new IamPolicyException(IamDecisionCode.SESSION_NOT_FOUND, "iam.session.not_found"));
        return rotate(session.sessionId(), presentedRefreshToken);
    }

    public SessionRecord find(SessionId sessionId) { return sessions.find(sessionId).orElseThrow(() ->
            new IamPolicyException(IamDecisionCode.SESSION_NOT_FOUND, "iam.session.not_found")); }
    public List<SessionRecord> findByDevice(PrincipalId principalId, DeviceId deviceId) { return sessions.findByDevice(principalId, deviceId); }
    public List<SessionRecord> findByPrincipal(PrincipalId principalId) { return sessions.findByPrincipal(principalId); }

    public SessionRecord revokeOwned(PrincipalId principalId, SessionId sessionId, String reason) {
        SessionRecord current = find(sessionId);
        if (!current.principalId().equals(principalId)) throw new IamPolicyException(IamDecisionCode.SESSION_NOT_FOUND, "iam.session.not_found");
        return revoke(sessionId, reason);
    }

    public SessionRecord revoke(SessionId sessionId, String reason) {
        synchronized (locks.computeIfAbsent(sessionId, ignored -> new Object())) {
            SessionRecord current = find(sessionId);
            SessionRecord revoked = revokeLocally(current, reason);
            appendAudit(revoked.scope(), IamDecisionCode.SESSION_REVOKED, "session_revoked", true);
            return revoked;
        }
    }

    public List<SessionRecord> revokeAll(PrincipalId principalId, String reason) {
        return sessions.findByPrincipal(principalId).stream().filter(s -> s.status() == SessionStatus.ACTIVE)
                .map(s -> revoke(s.sessionId(), reason)).toList();
    }

    private SessionRecord revokeLocally(SessionRecord current, String reason) {
        return sessions.revoke(current.sessionId(), Instant.now(clock), reason).orElseGet(() -> current.revoke(Instant.now(clock), reason));
    }

    private void appendAudit(TenantScope scope, IamDecisionCode code, String type, boolean allowed) {
        try { audit.append(AuditDecision.of(type, code, allowed, scope, Instant.now(clock), Set.of(), Set.of())); }
        catch (RuntimeException exception) { throw new IamPolicyException(IamDecisionCode.AUDIT_UNAVAILABLE, "iam.audit.unavailable"); }
    }

    private String randomToken() { byte[] bytes = new byte[48]; random.nextBytes(bytes); return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes); }
    private static IamPolicyException invalidRefresh() { return new IamPolicyException(IamDecisionCode.SESSION_NOT_FOUND, "iam.session.not_found"); }
    private static java.time.Duration positive(java.time.Duration value, java.time.Duration fallback) { return value == null || value.isNegative() || value.isZero() ? fallback : value; }

    public record SessionCreation(SessionRecord session, String refreshToken) {}
}
