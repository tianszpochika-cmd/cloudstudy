package com.englishflow.workflow.adapter.http;

import com.englishflow.workflow.domain.ManualRecoveryRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.net.URI;

/**
 * Turns a refused recovery transition into a 403 with the reason, so the two-person rule is visible to the
 * caller rather than looking like a generic failure.
 *
 * <p>403 rather than 400: the request was well formed and the caller simply is not allowed to make that
 * transition, which is what a client should be able to distinguish from a malformed body.
 */
@RestControllerAdvice
public class RecoveryExceptionHandler {

    @ExceptionHandler(ManualRecoveryRequest.RecoveryNotAllowed.class)
    public ProblemDetail onRefused(ManualRecoveryRequest.RecoveryNotAllowed refusal) {
        ProblemDetail detail = ProblemDetail.forStatusAndDetail(HttpStatus.FORBIDDEN, refusal.getMessage());
        detail.setTitle("recovery transition refused");
        detail.setType(URI.create("https://yuxuexing.local/problems/recovery-transition-refused"));
        // The rule is a policy rather than a bug, so the code names it and the message says which transition
        // was refused and why.
        detail.setProperty("code", "RECOVERY_NOT_ALLOWED");
        return detail;
    }
}
