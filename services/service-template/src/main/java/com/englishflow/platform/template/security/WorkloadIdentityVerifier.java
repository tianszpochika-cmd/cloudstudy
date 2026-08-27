package com.englishflow.platform.template.security;

import java.security.cert.CertificateParsingException;
import java.security.cert.X509Certificate;
import java.time.Clock;
import java.util.Collection;
import java.util.Date;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;

import jakarta.servlet.http.HttpServletRequest;

import com.englishflow.platform.template.config.WorkloadIdentityProperties;

/**
 * Application-level workload identity check after the TLS stack validates the certificate chain.
 *
 * <p>Trust-chain validation, private-key possession and protocol negotiation belong to the
 * configured TLS connector. This verifier adds the service-level SAN allowlist and validity
 * window check; it never accepts a forwarded certificate header.</p>
 */
public final class WorkloadIdentityVerifier {

    private static final String JAKARTA_CERTIFICATE_ATTRIBUTE = "jakarta.servlet.request.X509Certificate";
    private static final String JAVAEE_CERTIFICATE_ATTRIBUTE = "javax.servlet.request.X509Certificate";

    private final Set<String> allowedCallers;
    private final Clock clock;

    public WorkloadIdentityVerifier(WorkloadIdentityProperties properties, Clock clock) {
        Objects.requireNonNull(properties, "workload identity properties are required");
        this.allowedCallers = normalize(properties.getAllowedCallers());
        this.clock = Objects.requireNonNull(clock, "clock is required");
    }

    public Verification verify(HttpServletRequest request) {
        X509Certificate certificate = leafCertificate(request);
        if (certificate == null) {
            return Verification.absent();
        }
        try {
            certificate.checkValidity(Date.from(clock.instant()));
            String subject = certificate.getSubjectX500Principal().getName("RFC2253");
            Set<String> identities = identities(certificate, subject);
            for (String identity : identities) {
                if (allowedCallers.contains(normalize(identity))) {
                    return Verification.accepted(new WorkloadIdentity(
                            identity,
                            subject,
                            certificate.getSerialNumber().toString(16)));
                }
            }
        } catch (Exception ignored) {
            // Certificate parsing/validity failures are intentionally indistinguishable at the
            // boundary and always produce a deny result.
        }
        return Verification.rejected();
    }

    public record Verification(boolean certificatePresent, WorkloadIdentity identity) {

        static Verification absent() {
            return new Verification(false, null);
        }

        static Verification rejected() {
            return new Verification(true, null);
        }

        static Verification accepted(WorkloadIdentity identity) {
            return new Verification(true, Objects.requireNonNull(identity, "identity is required"));
        }

        public boolean accepted() {
            return identity != null;
        }
    }

    private static X509Certificate leafCertificate(HttpServletRequest request) {
        if (request == null) {
            return null;
        }
        Object value = request.getAttribute(JAKARTA_CERTIFICATE_ATTRIBUTE);
        if (!(value instanceof X509Certificate[] certificates)) {
            value = request.getAttribute(JAVAEE_CERTIFICATE_ATTRIBUTE);
        }
        if (!(value instanceof X509Certificate[] certificates) || certificates.length == 0) {
            return null;
        }
        return certificates[0];
    }

    private static Set<String> identities(X509Certificate certificate, String subject)
            throws CertificateParsingException {
        Set<String> identities = new LinkedHashSet<>();
        identities.add(subject);
        Collection<ListEntry> sans = sans(certificate);
        for (ListEntry san : sans) {
            identities.add(san.value());
        }
        return identities;
    }

    private static Collection<ListEntry> sans(X509Certificate certificate)
            throws CertificateParsingException {
        Collection<ListEntry> values = new java.util.ArrayList<>();
        Collection<List<?>> raw = certificate.getSubjectAlternativeNames();
        if (raw == null) {
            return values;
        }
        for (List<?> entry : raw) {
            if (entry.size() < 2 || !(entry.get(0) instanceof Integer type)) {
                continue;
            }
            if ((type == 2 || type == 6) && entry.get(1) instanceof String value && !value.isBlank()) {
                values.add(new ListEntry(value.trim()));
            }
        }
        return values;
    }

    private static Set<String> normalize(Set<String> values) {
        Set<String> result = new LinkedHashSet<>();
        if (values != null) {
            for (String value : values) {
                String normalized = normalize(value);
                if (normalized != null) {
                    result.add(normalized);
                }
            }
        }
        return Set.copyOf(result);
    }

    private static String normalize(String value) {
        return value == null || value.isBlank() ? null : value.trim().toLowerCase(Locale.ROOT);
    }

    private record ListEntry(String value) {
    }
}
