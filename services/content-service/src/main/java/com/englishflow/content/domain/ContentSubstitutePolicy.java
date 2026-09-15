package com.englishflow.content.domain;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

/**
 * M5-001 substitute policy: when a pinned version is withdrawn, rights-expired or
 * unpublished, learning must receive an explicit, explainable substitute — never a silent
 * fallback and never an in-memory fabrication. The substitute is a published,
 * rights-ready version of the same kind and target level, chosen deterministically by
 * content code so every caller agrees without coordination.
 */
public final class ContentSubstitutePolicy {

    public record SubstituteCandidate(
            String contentCode,
            ContentVersionId versionId,
            ContentKind kind,
            String targetLevel,
            String title) {
    }

    public record SubstituteResolution(
            SubstituteCandidate substitute,
            String reasonCode,
            String alternativeAction) {
    }

    private ContentSubstitutePolicy() {
    }

    /**
     * Selects the substitute for an unavailable pin. Empty when no published,
     * rights-ready sibling exists — the caller then surfaces RETURN_TO_CATALOG or
     * CONTACT_SUPPORT instead of inventing content.
     */
    public static Optional<SubstituteResolution> resolve(
            String unavailableCode,
            String reasonCode,
            List<SubstituteCandidate> catalog,
            java.util.function.Predicate<SubstituteCandidate> rightsReady) {
        if (catalog == null || catalog.isEmpty()) {
            return Optional.empty();
        }
        SubstituteCandidate unavailable = catalog.stream()
                .filter(c -> c.contentCode().equals(unavailableCode))
                .findFirst()
                .orElse(null);
        return catalog.stream()
                .filter(c -> !c.contentCode().equals(unavailableCode))
                .filter(c -> unavailable == null
                        || (c.kind() == unavailable.kind()
                        && c.targetLevel().equalsIgnoreCase(unavailable.targetLevel())))
                .filter(rightsReady)
                .min(Comparator.comparing(SubstituteCandidate::contentCode))
                .map(found -> new SubstituteResolution(found, reasonCode, "SELECT_ALTERNATIVE_TASK"));
    }

    /** Audit line proving which pin, reason and substitute were joined at which instant. */
    public static String auditLine(String unavailableCode, SubstituteResolution resolution, Instant now) {
        return "substitute unavailable=" + unavailableCode
                + " reason=" + resolution.reasonCode()
                + " alternative=" + resolution.substitute().contentCode()
                + ":v" + resolution.substitute().versionId().value()
                + " action=" + resolution.alternativeAction()
                + " at=" + now;
    }
}
