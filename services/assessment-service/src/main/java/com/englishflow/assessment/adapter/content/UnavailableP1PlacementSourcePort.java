package com.englishflow.assessment.adapter.content;

import com.englishflow.assessment.port.P1PlacementSourcePort;
import com.englishflow.assessment.web.AssessmentHttpPrincipals.VerifiedAssessmentPrincipal;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/** Never substitutes B25's two local questions for the authorized P1 ten-item snapshot. */
public final class UnavailableP1PlacementSourcePort implements P1PlacementSourcePort {
    @Override
    public Resolved resolve(VerifiedAssessmentPrincipal principal) {
        throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                "P1_PLACEMENT_SOURCE_UNAVAILABLE: published authorized ten-item snapshot and target pin are required");
    }
}
