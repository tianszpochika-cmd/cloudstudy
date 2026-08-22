package com.englishflow.iam.domain;

import java.time.LocalDate;
import java.util.Objects;

/**
 * Adult gate command with untrusted fields represented explicitly. The service rejects those
 * fields rather than using them as evidence.
 */
public record AdultGateCommand(
        PrincipalId principalId,
        boolean explicitAdultConfirmation,
        TrustedAgeEvidence trustedAgeEvidence,
        Integer clientReportedAge,
        LocalDate clientReportedBirthDate,
        ClientAuthorityClaims clientAuthorityClaims) {

    public AdultGateCommand {
        Objects.requireNonNull(principalId, "principalId");
    }

    public boolean containsClientTrustedInput() {
        return clientReportedAge != null || clientReportedBirthDate != null;
    }
}
