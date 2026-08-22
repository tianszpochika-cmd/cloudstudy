package com.englishflow.iam.domain;

import java.net.URI;
import java.util.Objects;
import java.util.regex.Pattern;

/**
 * The only external identity key accepted by principal mapping: issuer plus provider subject.
 * It is never derived from a client supplied tenant, owner or role field.
 */
public record ExternalIdentity(URI issuer, String subject) {

    private static final Pattern SUBJECT = Pattern.compile("[\\p{Graph}&&[^\\p{Cntrl}]]{1,255}");

    public ExternalIdentity {
        Objects.requireNonNull(issuer, "issuer");
        if (!issuer.isAbsolute() || issuer.getFragment() != null || issuer.getUserInfo() != null) {
            throw new IllegalArgumentException("issuer must be an absolute URI without userinfo or fragment");
        }
        Objects.requireNonNull(subject, "subject");
        if (!SUBJECT.matcher(subject).matches()) {
            throw new IllegalArgumentException("subject is invalid");
        }
    }

    public String stableKey() {
        return issuer.normalize() + "|" + subject;
    }
}
