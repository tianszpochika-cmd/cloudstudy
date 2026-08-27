package com.englishflow.platform.template.security;

import java.io.IOException;
import java.util.Enumeration;
import java.util.Locale;
import java.util.Set;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import com.englishflow.platform.template.config.WorkloadIdentityProperties;

import org.springframework.web.filter.OncePerRequestFilter;

/** Rejects forged service identity headers and enforces the optional mTLS workload boundary. */
public final class WorkloadIdentityFilter extends OncePerRequestFilter {

    private static final Set<String> FORWARDED_IDENTITY_HEADERS = Set.of(
            "x-workload-identity",
            "x-service-name",
            "x-service-account",
            "x-client-service",
            "x-forwarded-client-cert",
            "x-forwarded-client-cert-info",
            "x-ssl-client-cert",
            "x-ssl-client-subject-dn");

    private final WorkloadIdentityProperties properties;
    private final WorkloadIdentityVerifier verifier;
    private final SecurityErrorWriter errorWriter;

    public WorkloadIdentityFilter(
            WorkloadIdentityProperties properties,
            WorkloadIdentityVerifier verifier,
            SecurityErrorWriter errorWriter) {
        this.properties = properties;
        this.verifier = verifier;
        this.errorWriter = errorWriter;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {
        if (containsForwardedIdentity(request)) {
            errorWriter.write(
                    response,
                    HttpServletResponse.SC_FORBIDDEN,
                    "UNTRUSTED_WORKLOAD_IDENTITY",
                    "service identity must come from the TLS client certificate");
            return;
        }

        WorkloadIdentityVerifier.Verification verification = verifier.verify(request);
        if (!properties.isEnabled()) {
            if (verification.certificatePresent()) {
                errorWriter.write(
                        response,
                        HttpServletResponse.SC_FORBIDDEN,
                        "WORKLOAD_IDENTITY_DISABLED",
                        "workload identity is not enabled for this service");
                return;
            }
            filterChain.doFilter(request, response);
            return;
        }

        if (verification.certificatePresent() && !verification.accepted()) {
            errorWriter.write(
                    response,
                    HttpServletResponse.SC_FORBIDDEN,
                    "INVALID_WORKLOAD_IDENTITY",
                    "workload identity certificate is not trusted for this service");
            return;
        }
        if (properties.isRequired() && !verification.accepted()) {
            errorWriter.write(
                    response,
                    HttpServletResponse.SC_UNAUTHORIZED,
                    "WORKLOAD_IDENTITY_REQUIRED",
                    "mTLS workload identity is required");
            return;
        }
        verificationIdentity(verification).ifPresent(
                identity -> request.setAttribute(WorkloadIdentity.REQUEST_ATTRIBUTE, identity));
        filterChain.doFilter(request, response);
    }

    static boolean containsForwardedIdentity(HttpServletRequest request) {
        Enumeration<String> names = request.getHeaderNames();
        if (names == null) {
            return false;
        }
        while (names.hasMoreElements()) {
            String name = names.nextElement();
            if (FORWARDED_IDENTITY_HEADERS.contains(name.toLowerCase(Locale.ROOT))
                    && request.getHeader(name) != null) {
                return true;
            }
        }
        return false;
    }

    private static java.util.Optional<WorkloadIdentity> verificationIdentity(
            WorkloadIdentityVerifier.Verification verification) {
        return java.util.Optional.ofNullable(verification.identity());
    }
}
