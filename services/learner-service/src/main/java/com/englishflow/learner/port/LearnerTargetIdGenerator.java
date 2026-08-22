package com.englishflow.learner.port;

import com.englishflow.learner.domain.LearnerTenantScope;

/** Server-side target identity allocation seam; production maps this to the learner DB sequence. */
@FunctionalInterface
public interface LearnerTargetIdGenerator {

    long nextId(LearnerTenantScope scope);
}
