package com.englishflow.modules.auth;

import org.springframework.http.HttpStatus;

/**
 * Domain exception that is safe to expose through the auth error envelope.
 * Raw credentials, tokens, phone numbers and device fingerprints are never
 * included in the message.
 */
public final class AuthException extends RuntimeException {

    private final AuthErrorCode errorCode;
    private final HttpStatus httpStatus;
    private final boolean retryable;

    public AuthException(
            AuthErrorCode errorCode,
            HttpStatus httpStatus,
            boolean retryable,
            String message
    ) {
        super(message);
        this.errorCode = errorCode;
        this.httpStatus = httpStatus;
        this.retryable = retryable;
    }

    public AuthErrorCode errorCode() {
        return errorCode;
    }

    public HttpStatus httpStatus() {
        return httpStatus;
    }

    public boolean retryable() {
        return retryable;
    }

    public static AuthException validation(String message) {
        return new AuthException(AuthErrorCode.VALIDATION_ERROR, HttpStatus.BAD_REQUEST, false, message);
    }

    public static AuthException ageRequired() {
        return new AuthException(
                AuthErrorCode.AUTH_AGE_REQUIRED,
                HttpStatus.FORBIDDEN,
                false,
                "仅向已确认年满18岁的用户开放"
        );
    }

    public static AuthException privacyConsentRequired() {
        return new AuthException(
                AuthErrorCode.AUTH_PRIVACY_CONSENT_REQUIRED,
                HttpStatus.FORBIDDEN,
                false,
                "请先同意当前隐私政策"
        );
    }

    public static AuthException otpInvalid() {
        return new AuthException(
                AuthErrorCode.AUTH_OTP_INVALID,
                HttpStatus.UNAUTHORIZED,
                false,
                "验证码无效或已核销"
        );
    }

    public static AuthException otpExpired() {
        return new AuthException(
                AuthErrorCode.AUTH_OTP_EXPIRED,
                HttpStatus.UNAUTHORIZED,
                false,
                "验证码已过期"
        );
    }

    public static AuthException identityExists() {
        return new AuthException(
                AuthErrorCode.AUTH_IDENTITY_EXISTS,
                HttpStatus.CONFLICT,
                false,
                "该登录身份已存在"
        );
    }

    public static AuthException accountFrozen() {
        return new AuthException(
                AuthErrorCode.AUTH_ACCOUNT_FROZEN,
                HttpStatus.FORBIDDEN,
                false,
                "账号当前不可用"
        );
    }

    public static AuthException required() {
        return new AuthException(AuthErrorCode.AUTH_REQUIRED, HttpStatus.UNAUTHORIZED, false, "需要登录");
    }

    public static AuthException refreshInvalid() {
        return new AuthException(
                AuthErrorCode.AUTH_INVALID_REFRESH_TOKEN,
                HttpStatus.UNAUTHORIZED,
                false,
                "Refresh Token 无效"
        );
    }

    public static AuthException refreshExpired() {
        return new AuthException(
                AuthErrorCode.AUTH_REFRESH_TOKEN_EXPIRED,
                HttpStatus.UNAUTHORIZED,
                false,
                "Refresh Token 已过期"
        );
    }

    public static AuthException refreshRevoked() {
        return new AuthException(
                AuthErrorCode.AUTH_REFRESH_TOKEN_REVOKED,
                HttpStatus.UNAUTHORIZED,
                false,
                "Refresh Token 已撤销"
        );
    }

    public static AuthException refreshReuseDetected() {
        return new AuthException(
                AuthErrorCode.AUTH_REFRESH_REUSE_DETECTED,
                HttpStatus.UNAUTHORIZED,
                false,
                "检测到 Refresh Token 重放，请重新登录"
        );
    }

    public static AuthException deviceMismatch() {
        return new AuthException(
                AuthErrorCode.AUTH_DEVICE_MISMATCH,
                HttpStatus.UNAUTHORIZED,
                false,
                "设备与会话不匹配"
        );
    }

    public static AuthException deviceKicked() {
        return new AuthException(
                AuthErrorCode.AUTH_DEVICE_KICKED,
                HttpStatus.UNAUTHORIZED,
                false,
                "当前设备已下线"
        );
    }

    public static AuthException accessExpired() {
        return new AuthException(
                AuthErrorCode.AUTH_ACCESS_TOKEN_EXPIRED,
                HttpStatus.UNAUTHORIZED,
                false,
                "Access Token 已过期"
        );
    }

    public static AuthException accessRevoked() {
        return new AuthException(
                AuthErrorCode.AUTH_ACCESS_TOKEN_REVOKED,
                HttpStatus.UNAUTHORIZED,
                false,
                "Access Token 已撤销"
        );
    }

    public static AuthException sessionNotFound() {
        return new AuthException(
                AuthErrorCode.AUTH_SESSION_NOT_FOUND,
                HttpStatus.NOT_FOUND,
                false,
                "会话不存在或不可见"
        );
    }

    public static AuthException cannotKickCurrent() {
        return new AuthException(
                AuthErrorCode.AUTH_CANNOT_KICK_CURRENT,
                HttpStatus.CONFLICT,
                false,
                "不能下线当前设备"
        );
    }
}
