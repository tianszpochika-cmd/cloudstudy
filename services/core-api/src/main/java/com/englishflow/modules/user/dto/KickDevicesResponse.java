package com.englishflow.modules.user.dto;

import java.util.List;

public record KickDevicesResponse(
        List<String> kickedDevicePublicIds,
        int revokedRefreshTokenCount,
        boolean currentDeviceRetained
) {
    public KickDevicesResponse {
        kickedDevicePublicIds = List.copyOf(kickedDevicePublicIds);
    }
}
