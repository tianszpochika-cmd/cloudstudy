package com.englishflow.adminops.support;

public record MediaObjectView(
        String mediaObjectRef,
        String objectVersion,
        String purposeCode,
        String contentType,
        long sizeBytes) {
}
