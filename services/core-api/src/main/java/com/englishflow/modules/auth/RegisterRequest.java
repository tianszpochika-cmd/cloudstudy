package com.englishflow.modules.auth;

public record RegisterRequest(
        String phone,
        String code,
        boolean adultConfirmed,
        boolean privacyConsent,
        String privacyPolicyVersion,
        DeviceInput device
) {
}
