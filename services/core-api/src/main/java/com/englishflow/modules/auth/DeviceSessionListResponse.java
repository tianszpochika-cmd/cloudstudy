package com.englishflow.modules.auth;

import java.util.List;

public record DeviceSessionListResponse(List<DeviceSessionView> items) {
    public DeviceSessionListResponse {
        items = List.copyOf(items);
    }
}
