package com.englishflow.iam.domain;

import java.util.Objects;

/** Device request data. Authority fields are checked and never copied into the registration. */
public record DeviceRegistrationCommand(
        DeviceId deviceId,
        String platform,
        String label,
        ClientAuthorityClaims clientAuthorityClaims) {

    public DeviceRegistrationCommand {
        Objects.requireNonNull(deviceId, "deviceId");
        require(platform, "platform", 32);
        require(label, "label", 128);
    }

    private static void require(String value, String name, int maxLength) {
        Objects.requireNonNull(value, name);
        if (value.isBlank() || value.length() > maxLength || value.chars().anyMatch(Character::isISOControl)) {
            throw new IllegalArgumentException(name + " is invalid");
        }
    }
}
