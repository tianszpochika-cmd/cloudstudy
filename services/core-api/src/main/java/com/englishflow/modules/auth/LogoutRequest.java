package com.englishflow.modules.auth;

public record LogoutRequest(Boolean allDevices) {
    public boolean revokeAllDevices() {
        return Boolean.TRUE.equals(allDevices);
    }
}
