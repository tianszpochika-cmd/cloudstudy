package com.englishflow.content.domain;

import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/**
 * Editor-submitted rights claim bound to one version. A proposal grants
 * nothing: it is the L2-unverified dossier (channels, evidence, learning
 * grant) that the submit gate checks for completeness and L2 final approval
 * verifies into ACTIVE rights. Claims and authority never share a column.
 */
public record RightsProposal(
        Set<String> proposedChannels,
        String proposedEvidenceRef,
        boolean proposedAllowsLearning) {

    public RightsProposal {
        LinkedHashSet<String> normalized = new LinkedHashSet<>();
        if (proposedChannels != null) {
            for (String channel : proposedChannels) {
                if (channel != null && !channel.isBlank() && normalized.size() < 16) {
                    normalized.add(channel.trim().toUpperCase(java.util.Locale.ROOT));
                }
            }
        }
        proposedChannels = Set.copyOf(normalized);
        proposedEvidenceRef = proposedEvidenceRef == null || proposedEvidenceRef.isBlank()
                ? null : proposedEvidenceRef.trim();
    }

    public static RightsProposal proposed(Set<String> channels, String evidenceRef, boolean allowsLearning) {
        return new RightsProposal(channels, evidenceRef, allowsLearning);
    }

    public static RightsProposal empty() {
        return new RightsProposal(Set.of(), null, false);
    }

    /** Fail-closed input validation: a learning claim without evidence is rejected. */
    public RightsProposal validated() {
        if (proposedAllowsLearning
                && (proposedEvidenceRef == null || proposedEvidenceRef.isBlank())) {
            throw ContentOperationException.badRequest(
                    "CONTENT_RIGHTS_EVIDENCE_REQUIRED", "learning rights require authorization evidence");
        }
        return this;
    }

    /** Complete dossier for the submit gate, independent of verification state. */
    public boolean isComplete() {
        if (proposedEvidenceRef == null || proposedEvidenceRef.isBlank() || !proposedAllowsLearning) {
            return false;
        }
        return proposedChannels.contains("*")
                || (proposedChannels.contains("LEARNER") && proposedChannels.contains("PUBLIC"));
    }

    /** Verified ACTIVE rights built solely from this dossier. Empty when incomplete. */
    public java.util.Optional<ContentRights> activatedCopy(
            String sourceCode, String licenseCode, Instant now) {
        Objects.requireNonNull(now, "activation time is required");
        if (!isComplete()) {
            return java.util.Optional.empty();
        }
        ContentRights candidate = new ContentRights(sourceCode, licenseCode, CopyrightStatus.ACTIVE,
                true, new LinkedHashSet<>(proposedChannels), null, null, proposedEvidenceRef);
        if (!candidate.isAttestedForReview(now)) {
            return java.util.Optional.empty();
        }
        return java.util.Optional.of(candidate);
    }

    public List<String> channelList() {
        return List.copyOf(proposedChannels);
    }
}
