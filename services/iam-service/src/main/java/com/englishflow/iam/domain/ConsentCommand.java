package com.englishflow.iam.domain;

import java.util.Objects;

public record ConsentCommand(
        ConsentType type,
        ConsentVersion version,
        boolean accepted,
        ClientAuthorityClaims clientAuthorityClaims) {

    public ConsentCommand {
        Objects.requireNonNull(type, "type");
        Objects.requireNonNull(version, "version");
    }
}
