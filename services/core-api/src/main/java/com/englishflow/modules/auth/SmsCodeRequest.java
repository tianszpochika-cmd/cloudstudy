package com.englishflow.modules.auth;

public record SmsCodeRequest(
        String phone,
        Boolean adultConfirmed,
        Boolean privacyConsent,
        String scene
) {
}
