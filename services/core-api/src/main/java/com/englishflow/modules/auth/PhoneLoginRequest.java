package com.englishflow.modules.auth;

public record PhoneLoginRequest(
        String phone,
        String code,
        Boolean adultConfirmed,
        Boolean privacyConsent,
        String privacyPolicyVersion,
        DeviceInput device
) {
    public PhoneLoginRequest(
            String phone,
            String code,
            boolean adultConfirmed,
            boolean privacyConsent,
            String privacyPolicyVersion,
            DeviceInput device
    ) {
        this(phone, code, Boolean.valueOf(adultConfirmed), Boolean.valueOf(privacyConsent), privacyPolicyVersion, device);
    }
}
