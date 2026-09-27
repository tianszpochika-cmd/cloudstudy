package com.englishflow.learner.adapter.shadow;

import com.englishflow.learner.domain.LearnerDomainException;
import com.englishflow.learner.domain.LearnerPreferences;
import com.englishflow.learner.domain.LearnerProfile;
import com.englishflow.learner.domain.LearnerTenantScope;
import com.englishflow.learner.domain.LegacyLearnerSnapshot;
import com.englishflow.learner.domain.LearningGoal;
import com.englishflow.learner.domain.ProfileSource;
import com.englishflow.learner.domain.LearnerDecisionCode;
import com.englishflow.learner.port.LegacyLearnerReadModelPort;

import java.time.Clock;
import java.util.Optional;

/**
 * Maps old read data into an explicit LEGACY_SHADOW profile. The adapter cannot write the old
 * model, and a mutation promotes the snapshot into learner-service ownership first.
 */
public final class LearnerProfileShadowAdapter {

    private final LegacyLearnerReadModelPort legacyPort;
    private final Clock clock;

    public LearnerProfileShadowAdapter(LegacyLearnerReadModelPort legacyPort, Clock clock) {
        this.legacyPort = legacyPort;
        this.clock = clock;
    }

    public Optional<LearnerProfile> readShadow(LearnerTenantScope scope) {
        return legacyPort.find(scope).map(snapshot -> map(scope, snapshot));
    }

    private LearnerProfile map(LearnerTenantScope scope, LegacyLearnerSnapshot snapshot) {
        try {
            scope.assertResource(snapshot.tenantId(), snapshot.ownerId());
            var goal = snapshot.goalType() == null
                    ? Optional.<LearningGoal>empty()
                    : Optional.of(new LearningGoal(snapshot.goalType(), snapshot.dailyStudyMinutes(),
                            snapshot.targetDate(), snapshot.startingLevel(), snapshot.updatedAt()));
            var preferences = snapshot.uiLocale() == null
                    ? Optional.<LearnerPreferences>empty()
                    : Optional.of(new LearnerPreferences(snapshot.uiLocale(), snapshot.contentLocale(),
                            snapshot.themeMode(), snapshot.timezone(), snapshot.reducedMotion(), null,
                            snapshot.updatedAt()));
            return new LearnerProfile(scope, snapshot.profileId(), ProfileSource.LEGACY_SHADOW,
                    snapshot.onboardingState(), snapshot.assessmentState(),
                    Optional.ofNullable(snapshot.startingLevel()), goal, preferences,
                    snapshot.resumeTarget(), snapshot.version(), snapshot.updatedAt(), snapshot.updatedAt());
        } catch (LearnerDomainException exception) {
            throw exception;
        } catch (RuntimeException exception) {
            throw new LearnerDomainException(LearnerDecisionCode.INVALID_LEGACY_SNAPSHOT,
                    "legacy learner snapshot failed closed: " + exception.getMessage());
        }
    }
}
