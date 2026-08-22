package com.englishflow.learner.application;

import com.englishflow.learner.domain.LearnerPrincipalContext;

/** Read port for profile and first-day projection; no cross-owner lookup is exposed. */
public interface LearnerProfileQueryPort {

    LearnerProfileView getProfile(LearnerPrincipalContext context);

    FirstDayView getFirstDay(LearnerPrincipalContext context);
}
