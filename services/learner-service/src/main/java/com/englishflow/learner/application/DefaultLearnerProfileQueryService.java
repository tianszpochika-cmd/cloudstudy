package com.englishflow.learner.application;

import com.englishflow.learner.adapter.shadow.LearnerProfileShadowAdapter;
import com.englishflow.learner.domain.AuthorizationDecision;
import com.englishflow.learner.domain.FirstDayProjection;
import com.englishflow.learner.domain.LearnerAccessPolicy;
import com.englishflow.learner.domain.LearnerPrincipalContext;
import com.englishflow.learner.domain.LearnerProfile;
import com.englishflow.learner.domain.LearnerTenantScope;
import com.englishflow.learner.domain.ProfileSource;
import com.englishflow.learner.port.LearnerProfileStore;

import java.time.Clock;
import java.util.Objects;

/** Query service with own-store-first, legacy-shadow-second read behavior. */
public final class DefaultLearnerProfileQueryService implements LearnerProfileQueryPort {

    private final LearnerProfileStore store;
    private final LearnerProfileShadowAdapter shadowAdapter;
    private final LearnerAccessPolicy accessPolicy;
    private final Clock clock;

    public DefaultLearnerProfileQueryService(
            LearnerProfileStore store,
            LearnerProfileShadowAdapter shadowAdapter,
            LearnerAccessPolicy accessPolicy,
            Clock clock) {
        this.store = Objects.requireNonNull(store, "store is required");
        this.shadowAdapter = Objects.requireNonNull(shadowAdapter, "shadowAdapter is required");
        this.accessPolicy = Objects.requireNonNull(accessPolicy, "accessPolicy is required");
        this.clock = Objects.requireNonNull(clock, "clock is required");
    }

    @Override
    public LearnerProfileView getProfile(LearnerPrincipalContext context) {
        authorize(context, "learner.profile.read");
        return LearnerProfileView.from(load(context.scope()));
    }

    @Override
    public FirstDayView getFirstDay(LearnerPrincipalContext context) {
        authorize(context, "learner.onboarding.read");
        return FirstDayView.from(store.findFirstDay(context.scope())
                .orElseGet(() -> FirstDayProjection.from(load(context.scope()), clock.instant())));
    }

    private LearnerProfile load(LearnerTenantScope scope) {
        return store.find(scope)
                .orElseGet(() -> shadowAdapter.readShadow(scope)
                        .orElseGet(() -> LearnerProfile.empty(scope, clock.instant())));
    }

    private void authorize(LearnerPrincipalContext context, String permission) {
        LearnerTenantScope scope = context == null ? null : context.scope();
        AuthorizationDecision decision = accessPolicy.authorize(context, permission, "learner-profile",
                scope == null ? null : scope.subjectId(),
                scope == null ? null : scope.tenantId(),
                scope == null ? null : scope.subjectId());
        decision.requireAllowed();
        if (context != null) {
            context.scope().rejectClientAuthority(context.clientAuthorityClaims());
        }
    }
}
