package com.englishflow.assessment.port;

import com.englishflow.assessment.domain.AssessmentDomainException;
import com.englishflow.assessment.domain.AssessmentPrincipal;
import com.englishflow.assessment.domain.ContentSnapshot;

/** Read-only seam to content-service; assessment never owns the question master table. */
public interface ContentSnapshotPort {
    ContentSnapshot fetch(ContentSnapshotRequest request);

    record ContentSnapshotRequest(AssessmentPrincipal principal, String contentCode,
                                  long contentVersionId, long questionId) {
        public ContentSnapshotRequest {
            if (principal == null) throw AssessmentDomainException.forbidden("assessment principal is required");
            principal.requireAuthenticated();
            if (contentCode == null || !contentCode.matches("[A-Za-z0-9][A-Za-z0-9._:-]{1,127}")) throw AssessmentDomainException.invalid("ASM_CONTENT_REFERENCE_INVALID", "contentCode is invalid");
            if (contentVersionId < 1 || questionId < 1) throw AssessmentDomainException.invalid("ASM_CONTENT_REFERENCE_INVALID", "content version and question are required");
        }
    }
}
