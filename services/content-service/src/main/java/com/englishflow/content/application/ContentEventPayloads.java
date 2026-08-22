package com.englishflow.content.application;

import com.englishflow.content.domain.ContentDefinition;
import com.englishflow.content.domain.ContentVersion;
import com.englishflow.content.domain.ReviewDecision;
import com.englishflow.content.domain.ReviewStage;

import java.time.Instant;

/** Canonical B9 event payloads; this keeps the domain slice independent of Jackson. */
final class ContentEventPayloads {

    private ContentEventPayloads() {
    }

    static String versionSubmitted(ContentDefinition content, ContentVersion version, Instant occurredAt) {
        return object(
                field("tenantId", content.tenantId()),
                field("contentCode", content.contentCode()),
                field("contentType", version.kind().name()),
                number("contentVersionId", version.versionId().value()),
                number("versionNumber", version.versionNumber()),
                number("stateVersion", version.stateVersion()),
                field("submittedAt", occurredAt));
    }

    static String versionReviewed(
            ContentDefinition content,
            ContentVersion version,
            ReviewStage stage,
            ReviewDecision decision,
            Instant occurredAt) {
        return object(
                field("tenantId", content.tenantId()),
                field("contentCode", content.contentCode()),
                number("contentVersionId", version.versionId().value()),
                number("versionNumber", version.versionNumber()),
                field("reviewStage", stage.name()),
                field("decision", decision.name()),
                number("reviewVersion", version.reviewVersion(stage)),
                field("reviewedAt", occurredAt));
    }

    static String versionPublished(
            ContentDefinition content,
            ContentVersion version,
            ContentDefinition.ProjectionRevision revision,
            Instant occurredAt) {
        return object(
                field("tenantId", content.tenantId()),
                field("contentCode", content.contentCode()),
                field("contentType", version.kind().name()),
                number("contentVersionId", version.versionId().value()),
                number("versionNumber", version.versionNumber()),
                field("projectionKey", projectionKey(content)),
                number("projectionVersion", revision.projectionVersion()),
                number("contentEpoch", revision.contentEpoch()),
                field("publicFieldSet", "PUBLIC_V1"),
                field("publishedAt", occurredAt));
    }

    static String versionUnpublished(
            ContentDefinition content,
            ContentVersion version,
            ContentDefinition.ProjectionRevision revision,
            String reasonCode,
            Instant occurredAt) {
        return object(
                field("tenantId", content.tenantId()),
                field("contentCode", content.contentCode()),
                number("contentVersionId", version.versionId().value()),
                field("projectionKey", projectionKey(content)),
                number("contentEpoch", revision.contentEpoch()),
                field("reasonCode", reasonCode),
                field("unpublishedAt", occurredAt));
    }

    static String versionRolledBack(
            ContentDefinition content,
            ContentVersion from,
            ContentVersion target,
            ContentDefinition.ProjectionRevision revision,
            Instant occurredAt) {
        return object(
                field("tenantId", content.tenantId()),
                field("contentCode", content.contentCode()),
                number("fromVersionId", from.versionId().value()),
                number("targetVersionId", target.versionId().value()),
                field("projectionKey", projectionKey(content)),
                number("contentEpoch", revision.contentEpoch()),
                field("rolledBackAt", occurredAt));
    }

    static String projectionInvalidated(
            ContentDefinition content,
            ContentVersion version,
            ContentDefinition.ProjectionRevision revision,
            String reasonCode,
            Instant occurredAt) {
        return object(
                field("tenantId", content.tenantId()),
                field("projectionKey", projectionKey(content)),
                field("contentCode", content.contentCode()),
                number("contentVersionId", version.versionId().value()),
                number("contentEpoch", revision.contentEpoch()),
                field("invalidationScope", "VERSION"),
                field("reasonCode", reasonCode),
                field("cacheTag", version.contentHash().substring(0, 32)),
                field("invalidatedAt", occurredAt));
    }

    static String projectionKey(ContentDefinition content) {
        return content.contentCode() + ":public";
    }

    private static String object(String... fields) {
        return "{" + String.join(",", fields) + "}";
    }

    private static String field(String name, Object value) {
        return quote(name) + ":" + quote(String.valueOf(value));
    }

    private static String number(String name, long value) {
        return quote(name) + ":" + value;
    }

    private static String quote(String value) {
        StringBuilder escaped = new StringBuilder(value.length() + 2).append('"');
        for (int index = 0; index < value.length(); index++) {
            char character = value.charAt(index);
            switch (character) {
                case '"' -> escaped.append("\\\"");
                case '\\' -> escaped.append("\\\\");
                case '\b' -> escaped.append("\\b");
                case '\f' -> escaped.append("\\f");
                case '\n' -> escaped.append("\\n");
                case '\r' -> escaped.append("\\r");
                case '\t' -> escaped.append("\\t");
                default -> {
                    if (character < 0x20) {
                        escaped.append(String.format("\\u%04x", (int) character));
                    } else {
                        escaped.append(character);
                    }
                }
            }
        }
        return escaped.append('"').toString();
    }
}
