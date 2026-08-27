package com.englishflow.iam.domain;

import java.net.URI;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Provider-session facade with server-side refresh rotation, replay detection and fail-closed
 * revocation. It never creates an OAuth/OIDC token.
 */
public final class SessionService {

    private final SessionStore sessions;
    private final ProviderSessionPort provider;
    private final AuditFactPort audit;
    private final Clock clock;
    private final ConcurrentHashMap<SessionId, Object> locks = new ConcurrentHashMap<>();

    public SessionService(
            SessionStore sessions,
            ProviderSessionPort provider,
            AuditFactPort audit,
            Clock clock) {
        this.sessions = Objects.requireNonNull(sessions, "sessions");
        this.provider = Objects.requireNonNull(provider, "provider");
        this.audit = Objects.requireNonNull(audit, "audit");
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    public SessionRecord open(
            ServerPrincipalContext context,
            DeviceId deviceId,
            URI providerIssuer,
            ProviderSessionReference providerSessionReference,
            String providerRefreshToken) {
        return open(context, deviceId, providerIssuer, "default", providerSessionReference,
                providerRefreshToken);
    }

    public SessionRecord open(
            ServerPrincipalContext context,
            DeviceId deviceId,
            URI providerIssuer,
            String providerClientId,
            ProviderSessionReference providerSessionReference,
            String providerRefreshToken) {
        Objects.requireNonNull(context, "context");
        Objects.requireNonNull(deviceId, "deviceId");
        requireIssuer(providerIssuer);
        Objects.requireNonNull(providerSessionReference, "providerSessionReference");
        String digest = SecretDigests.sha256Hex(providerRefreshToken);
        Instant now = Instant.now(clock);
        SessionRecord session = new SessionRecord(
                SessionId.random(),
                context.principalId(),
                context.scope(),
                deviceId,
                providerIssuer,
                providerClientId,
                providerSessionReference,
                digest,
                0,
                SessionStatus.ACTIVE,
                now,
                now,
                null,
                null);
        SessionRecord saved = sessions.save(session);
        appendAudit(context.scope(), IamDecisionCode.SESSION_OPENED, "session_opened");
        return saved;
    }

    public SessionRotationResult rotate(SessionId sessionId, String presentedRefreshToken) {
        Objects.requireNonNull(sessionId, "sessionId");
        synchronized (locks.computeIfAbsent(sessionId, ignored -> new Object())) {
            SessionRecord current = sessions.find(sessionId)
                    .orElseThrow(() -> new IamPolicyException(
                            IamDecisionCode.SESSION_NOT_FOUND,
                            "iam.session.not_found"));
            if (current.status() != SessionStatus.ACTIVE) {
                throw new IamPolicyException(IamDecisionCode.SESSION_REVOKED, "iam.session.revoked");
            }

            String presentedDigest = SecretDigests.sha256Hex(presentedRefreshToken);
            if (!SecretDigests.constantTimeEquals(current.refreshTokenDigest(), presentedDigest)) {
                revokeLocally(current, "refresh_replay");
                appendAudit(current.scope(), IamDecisionCode.SESSION_REPLAY, "session_replay");
                throw new IamPolicyException(IamDecisionCode.SESSION_REPLAY, "iam.session.replay");
            }

            ProviderRefreshRotation rotation;
            try {
                rotation = provider.rotate(
                        current.providerIssuer(),
                        current.providerClientId(),
                        current.providerSessionReference(),
                        presentedRefreshToken);
            } catch (RuntimeException exception) {
                rejectProviderRotation(current, "provider_rotation_rejected");
                throw new IamPolicyException(IamDecisionCode.SESSION_PROVIDER_REJECTED,
                        "iam.session.provider_rejected");
            }
            if (rotation == null) {
                rejectProviderRotation(current, "provider_rotation_missing");
                throw new IamPolicyException(IamDecisionCode.SESSION_PROVIDER_REJECTED,
                        "iam.session.provider_rejected");
            }
            Instant now = Instant.now(clock);
            if (SecretDigests.constantTimeEquals(rotation.nextRefreshToken(), presentedRefreshToken)
                    || !rotation.accessTokenExpiresAt().isAfter(now)) {
                rejectProviderRotation(current, "provider_rotation_invalid");
                throw new IamPolicyException(IamDecisionCode.SESSION_PROVIDER_REJECTED,
                        "iam.session.provider_rejected");
            }

            SessionRecord next = current.rotate(
                    SecretDigests.sha256Hex(rotation.nextRefreshToken()),
                    now);
            // The provider reference may rotate too; preserve it in a new immutable snapshot.
            next = new SessionRecord(
                    next.sessionId(),
                    next.principalId(),
                    next.scope(),
                    next.deviceId(),
                    next.providerIssuer(),
                    next.providerClientId(),
                    rotation.providerSessionReference(),
                    next.refreshTokenDigest(),
                    next.rotation(),
                    next.status(),
                    next.createdAt(),
                    next.updatedAt(),
                    next.revokedAt(),
                    next.revocationReason());
            SessionRecord persisted;
            try {
                persisted = sessions.replaceIfCurrent(
                                current.sessionId(),
                                current.rotation(),
                                current.refreshTokenDigest(),
                                next)
                        .orElseThrow(() -> new IamPolicyException(
                                IamDecisionCode.SESSION_REPLAY,
                                "iam.session.replay"));
            } catch (IamPolicyException exception) {
                revokeLocally(current, "rotation_compare_and_set_conflict");
                appendAudit(current.scope(), IamDecisionCode.SESSION_REPLAY, "session_replay");
                throw exception;
            } catch (RuntimeException exception) {
                revokeLocally(current, "session_store_unavailable");
                appendAudit(current.scope(), IamDecisionCode.SESSION_STORE_UNAVAILABLE,
                        "session_store_unavailable");
                throw new IamPolicyException(
                        IamDecisionCode.SESSION_STORE_UNAVAILABLE,
                        "iam.session.store_unavailable");
            }
            next = persisted;
            appendAudit(next.scope(), IamDecisionCode.SESSION_ROTATED, "session_rotated");
            return new SessionRotationResult(
                    next.sessionId(),
                    next.principalId(),
                    next.deviceId(),
                    next.rotation(),
                    rotation.nextRefreshToken(),
                    rotation.accessTokenExpiresAt(),
                    rotation.nextAccessToken());
        }
    }

    /** Finds the session by the presented digest, then applies the same durable CAS rotation path. */
    public SessionRotationResult rotateByRefreshToken(String presentedRefreshToken) {
        String digest = SecretDigests.sha256Hex(presentedRefreshToken);
        SessionRecord session = sessions.findByRefreshTokenDigest(digest)
                .orElseThrow(() -> new IamPolicyException(IamDecisionCode.SESSION_NOT_FOUND,
                        "iam.session.not_found"));
        return rotate(session.sessionId(), presentedRefreshToken);
    }

    public SessionRecord find(SessionId sessionId) {
        return sessions.find(sessionId).orElseThrow(() -> new IamPolicyException(
                IamDecisionCode.SESSION_NOT_FOUND, "iam.session.not_found"));
    }

    public List<SessionRecord> findByDevice(PrincipalId principalId, DeviceId deviceId) {
        Objects.requireNonNull(principalId, "principalId");
        Objects.requireNonNull(deviceId, "deviceId");
        return sessions.findByDevice(principalId, deviceId);
    }

    public SessionRecord revokeOwned(PrincipalId principalId, SessionId sessionId, String reason) {
        SessionRecord current = find(sessionId);
        if (!current.principalId().equals(principalId)) {
            throw new IamPolicyException(IamDecisionCode.SESSION_NOT_FOUND, "iam.session.not_found");
        }
        return revoke(sessionId, reason);
    }

    public SessionRecord revoke(SessionId sessionId, String reason) {
        return revoke(sessionId, reason, null);
    }

    /**
     * Revokes the local session and, when the caller still holds the provider credential, delegates
     * RFC 7009 revocation without persisting that credential.
     */
    public SessionRecord revoke(SessionId sessionId, String reason, String providerRefreshToken) {
        Objects.requireNonNull(sessionId, "sessionId");
        Objects.requireNonNull(reason, "reason");
        synchronized (locks.computeIfAbsent(sessionId, ignored -> new Object())) {
            SessionRecord current = sessions.find(sessionId)
                    .orElseThrow(() -> new IamPolicyException(
                            IamDecisionCode.SESSION_NOT_FOUND,
                            "iam.session.not_found"));
            SessionRecord revoked = revokeLocally(current, reason);
            try {
                if (providerRefreshToken == null || providerRefreshToken.isBlank()) {
                    provider.revoke(current.providerIssuer(), current.providerSessionReference());
                } else {
                    provider.revoke(
                            current.providerIssuer(),
                            current.providerSessionReference(),
                            providerRefreshToken);
                }
            } catch (RuntimeException ignored) {
                // Local revocation is already durable; losing provider connectivity cannot reopen it.
            }
            appendAudit(revoked.scope(), IamDecisionCode.SESSION_REVOKED, "session_revoked");
            return revoked;
        }
    }

    public List<SessionRecord> revokeDevice(
            ServerPrincipalContext context,
            DeviceId deviceId,
            String reason) {
        Objects.requireNonNull(context, "context");
        Objects.requireNonNull(deviceId, "deviceId");
        Objects.requireNonNull(reason, "reason");
        return sessions.findByDevice(context.principalId(), deviceId).stream()
                .filter(session -> session.status() == SessionStatus.ACTIVE)
                .map(session -> revoke(session.sessionId(), reason))
                .toList();
    }

    private SessionRecord revokeLocally(SessionRecord current, String reason) {
        return sessions.revoke(current.sessionId(), Instant.now(clock), reason)
                .orElseGet(() -> current.revoke(Instant.now(clock), reason));
    }

    private void rejectProviderRotation(SessionRecord current, String reason) {
        revokeLocally(current, reason);
        appendAudit(current.scope(), IamDecisionCode.SESSION_PROVIDER_REJECTED,
                "session_provider_rejected");
    }

    private void appendAudit(TenantScope scope, IamDecisionCode code, String type) {
        try {
            audit.append(AuditDecision.of(type, code, code != IamDecisionCode.SESSION_REPLAY,
                    scope, Instant.now(clock), java.util.Set.of(), java.util.Set.of()));
        } catch (RuntimeException exception) {
            throw new IamPolicyException(IamDecisionCode.AUDIT_UNAVAILABLE, "iam.audit.unavailable");
        }
    }

    private static void requireIssuer(URI issuer) {
        Objects.requireNonNull(issuer, "providerIssuer");
        if (!issuer.isAbsolute() || issuer.getFragment() != null || issuer.getUserInfo() != null) {
            throw new IllegalArgumentException("provider issuer is invalid");
        }
    }
}
