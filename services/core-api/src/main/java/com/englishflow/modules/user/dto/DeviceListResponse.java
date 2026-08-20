package com.englishflow.modules.user.dto;

import java.util.List;

public record DeviceListResponse(
        List<DeviceResponse> items
) {
    public DeviceListResponse {
        items = List.copyOf(items);
    }
}
