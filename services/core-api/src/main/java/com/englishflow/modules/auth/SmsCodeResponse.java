package com.englishflow.modules.auth;

public record SmsCodeResponse(String challengeId, long expiresInSeconds) {
}
