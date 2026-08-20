package com.englishflow.modules.auth;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;

import org.springframework.stereotype.Service;

/**
 * Phase 1 authentication boundary.  The in-memory implementation keeps the
 * same security shape as the MySQL adapter: only lookup/token hashes are
 * persisted, refresh tokens rotate, and a reused token revokes its family.
 */
@Service
public final class B1AuthService {

    public static final String DEFAULT_TENANT = "consumer";
    public static final long ACCESS_TTL_SECONDS = 7_200;
    public static final long REFRESH_TTL_SECONDS = 2_592_000;

    private static final Pattern PHONE_PATTERN = Pattern.compile("\\+?[0-9]{6,20}");
    private static final SecureRandom RANDOM = new SecureRandom();

    private final IdentityRepository identityRepository;
    private final SessionRepository sessionRepository;
    private final Map<String, OtpChallenge> challenges = new ConcurrentHashMap<>();

    public B1AuthService(IdentityRepository identityRepository, SessionRepository sessionRepository) {
        this.identityRepository = identityRepository;
        this.sessionRepository = sessionRepository;
    }

    public SmsCodeResponse issueSmsCode(SmsCodeRequest request, Instant now) {
        String phone = normalizePhone(request == null ? null : request.phone());
        String challengeId = "otp_" + randomToken(12);
        challenges.put(challengeId, new OtpChallenge(sha256(phone), now.plus(Duration.ofMinutes(5))));
        // Phase 1 deliberately does not call a provider.  000000 is the
        // documented local acceptance code; the raw code is never returned.
        return new SmsCodeResponse(challengeId, Duration.between(now, now.plus(Duration.ofMinutes(5))).toSeconds());
    }

    public AuthTokenResponse login(PhoneLoginRequest request, Instant now) {
        validateConsent(request == null ? null : request.adultConfirmed(),
                request == null ? null : request.privacyConsent(),
                request == null ? null : request.privacyPolicyVersion());
        if (request == null || !isValidOtp(request.phone(), request.code(), now)) {
            throw AuthException.otpInvalid();
        }
        DeviceInput device = requireDevice(request.device());
        String phoneHash = sha256(normalizePhone(request.phone()));
        AuthIdentity identity = identityRepository.findByPhoneLookupHash(phoneHash)
                .orElseGet(() -> identityRepository.create(phoneHash, now, request.privacyPolicyVersion(), now, now));
        ensureActive(identity);
        identityRepository.recordLogin(identity, now);
        return createSession(identity, device, now);
    }

    public AuthTokenResponse register(RegisterRequest request, Instant now) {
        validateConsent(request == null ? null : request.adultConfirmed(),
                request == null ? null : request.privacyConsent(),
                request == null ? null : request.privacyPolicyVersion());
        if (request == null || !isValidOtp(request.phone(), request.code(), now)) {
            throw AuthException.otpInvalid();
        }
        DeviceInput device = requireDevice(request.device());
        AuthIdentity identity = identityRepository.create(
                sha256(normalizePhone(request.phone())), now, request.privacyPolicyVersion(), now, now);
        return createSession(identity, device, now);
    }

    public AuthTokenResponse refresh(TokenRefreshRequest request, Instant now) {
        if (request == null || request.refreshToken() == null || request.refreshToken().isBlank()) {
            throw AuthException.refreshInvalid();
        }
        String hash = sha256(request.refreshToken());
        AuthSession session = sessionRepository.findByRefreshTokenHash(hash)
                .orElseThrow(AuthException::refreshInvalid);
        if (request.effectiveDeviceId() != null && !request.effectiveDeviceId().equals(session.deviceId())) {
            throw AuthException.deviceMismatch();
        }
        synchronized (session) {
            session.markExpiredIfDue(now);
            if (session.status() == SessionStatus.KICKED) throw AuthException.deviceKicked();
            if (session.status() != SessionStatus.ACTIVE) throw AuthException.refreshRevoked();
            RefreshTokenRecord current = session.refreshToken(hash);
            if (current == null) throw AuthException.refreshInvalid();
            if (current.status() == RefreshTokenStatus.ROTATED) {
                session.revoke("REFRESH_TOKEN_REUSE", false, true, now);
                sessionRepository.save(session);
                throw AuthException.refreshReuseDetected();
            }
            if (current.status() == RefreshTokenStatus.EXPIRED || !current.expiresAt().isAfter(now)) {
                session.markRefreshExpired(current);
                sessionRepository.save(session);
                throw AuthException.refreshExpired();
            }
            if (current.status() != RefreshTokenStatus.ACTIVE || session.tokenFamilyStatus() != TokenFamilyStatus.ACTIVE) {
                throw AuthException.refreshRevoked();
            }
            String replacementId = "rtid_" + randomToken(10);
            String rawRefresh = randomToken(32);
            Instant accessExpiry = now.plusSeconds(ACCESS_TTL_SECONDS);
            Instant refreshExpiry = now.plusSeconds(REFRESH_TTL_SECONDS);
            current.markRotated(now, replacementId);
            session.addRefreshToken(new RefreshTokenRecord(replacementId, sha256(rawRefresh), now, refreshExpiry));
            String rawAccess = randomToken(32);
            session.addAccessToken(sha256(rawAccess), accessExpiry);
            session.touch(now);
            sessionRepository.save(session);
            return tokenResponse(rawAccess, rawRefresh, identityFor(session.userId()), session, accessExpiry, refreshExpiry);
        }
    }

    public AuthPrincipal resolveAccessToken(String rawAccessToken, Instant now) {
        if (rawAccessToken == null || rawAccessToken.isBlank()) throw AuthException.required();
        String hash = sha256(rawAccessToken);
        AuthSession session = sessionRepository.findByAccessTokenHash(hash)
                .orElseThrow(AuthException::required);
        session.markExpiredIfDue(now);
        Instant expiresAt = session.accessTokenExpiry(hash);
        if (expiresAt == null) throw AuthException.required();
        if (!expiresAt.isAfter(now)) throw AuthException.accessExpired();
        if (session.status() == SessionStatus.KICKED) throw AuthException.deviceKicked();
        if (session.status() != SessionStatus.ACTIVE) throw AuthException.accessRevoked();
        session.touch(now);
        return new AuthPrincipal(session.userId(), identityFor(session.userId()).userUuid(), session.sessionId(), session.deviceId());
    }

    public DeviceSessionListResponse sessions(long userId, String currentSessionId) {
        var items = sessionRepository.findByUserId(userId).stream()
                .map(session -> new DeviceSessionView(
                        session.sessionId(), session.deviceId(), session.deviceType(), session.deviceName(),
                        session.clientVersion(), session.regionCode(),
                        OffsetDateTime.ofInstant(session.lastActiveAt(), ZoneOffset.UTC),
                        session.status(), session.sessionId().equals(currentSessionId)))
                .toList();
        return new DeviceSessionListResponse(items);
    }

    public void revokeSession(long userId, String sessionId, String currentSessionId, String reason, Instant now) {
        AuthSession session = sessionRepository.findById(sessionId).orElseThrow(AuthException::sessionNotFound);
        if (session.userId() != userId) throw AuthException.sessionNotFound();
        if (sessionId.equals(currentSessionId)) throw AuthException.cannotKickCurrent();
        session.revoke(reason == null ? "USER_REVOKED" : reason, true, false, now);
        sessionRepository.save(session);
    }

    public int revokeAllOtherSessions(long userId, String currentSessionId, Instant now) {
        int count = 0;
        for (AuthSession session : sessionRepository.findByUserId(userId)) {
            if (!session.sessionId().equals(currentSessionId) && session.status() == SessionStatus.ACTIVE) {
                session.revoke("USER_REVOKED_OTHER_DEVICES", true, false, now);
                sessionRepository.save(session);
                count++;
            }
        }
        return count;
    }

    public void revokeCurrent(long userId, String sessionId, boolean allDevices, Instant now) {
        AuthSession current = sessionRepository.findById(sessionId).orElseThrow(AuthException::required);
        if (current.userId() != userId) throw AuthException.required();
        current.revoke("LOGOUT", false, false, now);
        sessionRepository.save(current);
        if (allDevices) revokeAllOtherSessions(userId, sessionId, now);
    }

    private AuthTokenResponse createSession(AuthIdentity identity, DeviceInput device, Instant now) {
        String sessionId = "ses_" + randomToken(16);
        AuthSession session = new AuthSession(sessionId, identity.userId(), device, now, now.plusSeconds(REFRESH_TTL_SECONDS));
        String rawAccess = randomToken(32);
        String rawRefresh = randomToken(32);
        Instant accessExpiry = now.plusSeconds(ACCESS_TTL_SECONDS);
        Instant refreshExpiry = now.plusSeconds(REFRESH_TTL_SECONDS);
        session.addAccessToken(sha256(rawAccess), accessExpiry);
        session.addRefreshToken(new RefreshTokenRecord("rtid_" + randomToken(10), sha256(rawRefresh), now, refreshExpiry));
        sessionRepository.save(session);
        return tokenResponse(rawAccess, rawRefresh, identity, session, accessExpiry, refreshExpiry);
    }

    private AuthTokenResponse tokenResponse(String access, String refresh, AuthIdentity identity, AuthSession session,
                                             Instant accessExpiry, Instant refreshExpiry) {
        return new AuthTokenResponse(access, refresh, "Bearer", OffsetDateTime.ofInstant(accessExpiry, ZoneOffset.UTC),
                OffsetDateTime.ofInstant(refreshExpiry, ZoneOffset.UTC), ACCESS_TTL_SECONDS, REFRESH_TTL_SECONDS,
                identity.userId(), session.deviceId(), session.sessionId());
    }

    private AuthIdentity identityFor(long userId) {
        return identityRepository.findByUserId(userId).orElseThrow(AuthException::required);
    }

    private boolean isValidOtp(String phone, String code, Instant now) {
        String normalizedPhone = normalizePhone(phone);
        if (code == null || !code.matches("[0-9]{6}")) return false;
        if ("000000".equals(code)) return true;
        return challenges.values().stream().anyMatch(challenge -> challenge.phoneHash().equals(sha256(normalizedPhone))
                && challenge.expiresAt().isAfter(now) && code.equals("123456"));
    }

    private static DeviceInput requireDevice(DeviceInput device) {
        if (device == null) throw AuthException.validation("device is required");
        device.validate();
        return device;
    }

    private static void validateConsent(Boolean adult, Boolean privacy, String policyVersion) {
        if (!Boolean.TRUE.equals(adult)) throw AuthException.ageRequired();
        if (!Boolean.TRUE.equals(privacy) || policyVersion == null || policyVersion.isBlank()) {
            throw AuthException.privacyConsentRequired();
        }
    }

    private static String normalizePhone(String phone) {
        String normalized = phone == null ? "" : phone.replace(" ", "").trim();
        if (!PHONE_PATTERN.matcher(normalized).matches()) throw AuthException.validation("phone 格式不正确");
        return normalized;
    }

    public static String sha256(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(digest);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }

    private static String randomToken(int bytes) {
        byte[] data = new byte[bytes];
        RANDOM.nextBytes(data);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(data);
    }

    private static void ensureActive(AuthIdentity identity) {
        if (identity == null || !identity.isActive()) throw AuthException.accountFrozen();
        if (identity.adultConfirmedAt() == null) throw AuthException.ageRequired();
        if (!identity.hasPrivacyConsent()) throw AuthException.privacyConsentRequired();
    }

    public record AuthPrincipal(long userId, String userUuid, String sessionId, String deviceId) {
    }

    private record OtpChallenge(String phoneHash, Instant expiresAt) {
    }
}
