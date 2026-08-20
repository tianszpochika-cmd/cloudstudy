package com.englishflow.modules.auth;

/** Public device metadata. A deviceId must not be a raw hardware fingerprint. */
public record DeviceInput(
        String deviceId,
        String deviceType,
        String deviceName,
        String osVersion,
        String clientVersion,
        String regionCode
) {

    public DeviceInput(String deviceId, String deviceType, String clientVersion) {
        this(deviceId, deviceType, null, null, clientVersion, null);
    }

    public DeviceInput {
        deviceId = trimToNull(deviceId);
        deviceType = trimToNull(deviceType);
        deviceName = trimToNull(deviceName);
        osVersion = trimToNull(osVersion);
        clientVersion = trimToNull(clientVersion);
        regionCode = trimToNull(regionCode);
    }

    public void validate() {
        if (deviceId == null || !deviceId.matches("[A-Za-z0-9][A-Za-z0-9._:-]{7,99}")) {
            throw AuthException.validation("deviceId 格式不正确");
        }
        if (deviceType == null || !deviceType.matches("(?i)IOS|ANDROID|WEB|H5|MP")) {
            throw AuthException.validation("deviceType 不受支持");
        }
        if (clientVersion == null || clientVersion.length() > 32) {
            throw AuthException.validation("clientVersion 不正确");
        }
        if (deviceName != null && deviceName.length() > 64) {
            throw AuthException.validation("deviceName 过长");
        }
        if (osVersion != null && osVersion.length() > 32) {
            throw AuthException.validation("osVersion 过长");
        }
        if (regionCode != null && !regionCode.matches("[A-Za-z0-9._-]{1,16}")) {
            throw AuthException.validation("regionCode 不正确");
        }
    }

    public String normalizedDeviceType() {
        return deviceType == null ? null : deviceType.toUpperCase(java.util.Locale.ROOT);
    }

    private static String trimToNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
