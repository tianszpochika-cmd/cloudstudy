package com.englishflow.adminops.support;

import java.util.regex.Pattern;

import com.englishflow.adminops.domain.AdminOpsException;

/**
 * Metadata-only reference to media-service ownership. There is deliberately no bytes, URL,
 * filename, raw content or upload stream in this type.
 */
public record MediaObjectRef(
        String objectRef,
        String objectVersion,
        String purposeCode,
        String contentType,
        long sizeBytes) {

    private static final Pattern SAFE_REF = Pattern.compile("[A-Za-z0-9._:/-]{1,160}");
    private static final long MAX_ATTACHMENT_SIZE = 50L * 1024L * 1024L;

    public MediaObjectRef {
        objectRef = safe(objectRef, "objectRef");
        objectVersion = safe(objectVersion, "objectVersion");
        purposeCode = safe(purposeCode, "purposeCode");
        contentType = safe(contentType, "contentType");
        if (sizeBytes < 0 || sizeBytes > MAX_ATTACHMENT_SIZE) {
            throw AdminOpsException.invalid("SUPPORT_MEDIA_SIZE_INVALID", "attachment size is outside the allowed range");
        }
        if (contentType.equalsIgnoreCase("application/octet-stream")) {
            throw AdminOpsException.unprocessable("SUPPORT_MEDIA_TYPE_UNSAFE", "generic binary attachments are not allowed");
        }
    }

    private static String safe(String value, String field) {
        String normalized = value == null ? null : value.trim();
        if (normalized == null || normalized.isBlank() || !SAFE_REF.matcher(normalized).matches()
                || normalized.contains("http") || normalized.contains("\\")) {
            throw AdminOpsException.invalid("SUPPORT_MEDIA_REF_INVALID", field + " must be an opaque media reference");
        }
        return normalized;
    }
}
