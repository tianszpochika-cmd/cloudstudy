package com.englishflow.content.release;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Durable snapshot of the release desk. Field names are the JSON document stored
 * in {@code it6_release_studio.state_json}.
 */
public record ReleaseStudioState(
        String mode,
        List<VersionRow> versions,
        List<PinRow> pins,
        List<IdempotencyRow> idempotency) {

    public ReleaseStudioState {
        mode = mode == null || mode.isBlank() ? "SIMPLE" : mode;
        versions = versions == null ? List.of() : List.copyOf(versions);
        pins = pins == null ? List.of() : List.copyOf(pins);
        idempotency = idempotency == null ? List.of() : List.copyOf(idempotency);
    }

    public static ReleaseStudioState empty() {
        return new ReleaseStudioState("SIMPLE", List.of(), List.of(), List.of());
    }

    public record VersionRow(
            String code,
            int number,
            long stateVersion,
            String title,
            String body,
            String kind,
            String status,
            String catalog,
            String editor,
            String copyrightRef,
            int copyrightVersion,
            boolean copyrightExpired,
            String reportRef,
            int reportVersion,
            String reportMode,
            boolean mediaRequired,
            boolean mediaBytesConnected,
            String mediaRef,
            String firstReviewer,
            String finalReviewer,
            String publisher,
            int reviewRecords,
            int reviewedVersion,
            String secondSignature,
            int publishAudits,
            boolean publishedOnce,
            int publishedNumber,
            String modeAtPublish,
            Integer rollbackOf,
            String unpublishReason,
            String unpublishScope,
            boolean force) {
    }

    public record PinRow(String code, int pin) {
    }

    public record IdempotencyRow(String key, int status, Map<String, Object> body) {
        public IdempotencyRow {
            body = body == null ? Map.of() : new LinkedHashMap<>(body);
        }
    }
}
