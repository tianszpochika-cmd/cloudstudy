package com.englishflow.media.port;

import com.englishflow.media.domain.MediaAuthorizationContext;

import java.util.Map;
import java.util.function.Supplier;

/** A successful command and its replayable response share one owner transaction in local-real. */
public interface MediaWriteIdempotencyPort {

    Map<String, Object> execute(
            String operation, String assetId, Object request,
            MediaAuthorizationContext context, String idempotencyKey,
            Runnable authorize, Supplier<Map<String, Object>> command);
}
