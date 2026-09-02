package com.englishflow.iam.domain;

import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Pattern;

/** Facts extracted from a validated service JWT, never copied from the request body. */
public record VerifiedServiceIdentity(String serviceId, Set<String> audiences, Instant issuedAt) {
    private static final Pattern SERVICE_ID = Pattern.compile("[a-z][a-z0-9-]{1,63}");

    public VerifiedServiceIdentity {
        if (serviceId == null || !SERVICE_ID.matcher(serviceId).matches()) {
            throw new IamPolicyException(IamDecisionCode.PDP_INVALID_SERVICE_IDENTITY,
                    "iam.pdp.invalid_service_identity");
        }
        LinkedHashSet<String> copy = new LinkedHashSet<>();
        if (audiences != null) {
            for (String audience : audiences) {
                if (audience == null || audience.isBlank() || audience.length() > 128
                        || audience.chars().anyMatch(Character::isISOControl)) {
                    throw new IamPolicyException(IamDecisionCode.PDP_INVALID_SERVICE_IDENTITY,
                            "iam.pdp.invalid_service_identity");
                }
                copy.add(audience);
            }
        }
        if (copy.isEmpty() || issuedAt == null) {
            throw new IamPolicyException(IamDecisionCode.PDP_INVALID_SERVICE_IDENTITY,
                    "iam.pdp.invalid_service_identity");
        }
        audiences = Set.copyOf(copy);
    }
}
