package com.englishflow.assessment.adapter.content;

import com.englishflow.assessment.domain.AssessmentDomainException;
import com.englishflow.assessment.domain.ContentSnapshot;
import com.englishflow.assessment.port.ContentSnapshotPort;

/** Fail-closed placeholder until the authenticated content-service adapter is supplied. */
public final class UnavailableContentSnapshotPort implements ContentSnapshotPort {
    @Override
    public ContentSnapshot fetch(ContentSnapshotRequest request) {
        throw AssessmentDomainException.retryable("ASM_CONTENT_UNAVAILABLE", "published content snapshot is unavailable");
    }
}
