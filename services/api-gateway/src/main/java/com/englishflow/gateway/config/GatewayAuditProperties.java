package com.englishflow.gateway.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Where the durable security audit sink sends, and how it authenticates there.
 *
 * <p>A separate class rather than more components on {@code GatewayProperties.Security}, and a plain bean rather than a
 * record. Two reasons, both measured: adding components to that record breaks every hand-built six-argument call in the
 * test sources, and binding a record through {@code Binder} silently returns not-bound here when any component has no
 * value — which is the state these settings are in by default, so the empty case is the common one and has to bind.
 *
 * <p>Every field is optional. When none is set the Gateway keeps the bounded in-memory sink, which is what it had before
 * durable auditing existed; setting all four switches it to the canonical ingest, authenticated with a short-lived
 * service token from IAM (ADR-0016).
 */
@ConfigurationProperties(prefix = "gateway.audit")
public class GatewayAuditProperties {

    /** The canonical ingest endpoint that accepts the redacted envelope. */
    private String ingestUri;

    /** IAM's service-token endpoint, traded for the Bearer the ingest requires. */
    private String serviceTokenUri;

    /** The client identifier IAM knows this gateway by. */
    private String serviceClientId;

    /** The client secret, injected by the environment and never committed. */
    private String serviceClientSecret;

    /**
     * Whether every setting a durable sink needs is present.
     *
     * <p>Blank counts as absent: an unset placeholder binds to the empty string, and treating that as configured would
     * produce a sink that fails on every request.
     */
    public boolean hasDurableSink() {
        return isSet(ingestUri) && isSet(serviceTokenUri) && isSet(serviceClientId) && isSet(serviceClientSecret);
    }

    private static boolean isSet(String value) {
        return value != null && !value.isBlank();
    }

    public String getIngestUri() {
        return ingestUri;
    }

    public void setIngestUri(String ingestUri) {
        this.ingestUri = ingestUri;
    }

    public String getServiceTokenUri() {
        return serviceTokenUri;
    }

    public void setServiceTokenUri(String serviceTokenUri) {
        this.serviceTokenUri = serviceTokenUri;
    }

    public String getServiceClientId() {
        return serviceClientId;
    }

    public void setServiceClientId(String serviceClientId) {
        this.serviceClientId = serviceClientId;
    }

    public String getServiceClientSecret() {
        return serviceClientSecret;
    }

    public void setServiceClientSecret(String serviceClientSecret) {
        this.serviceClientSecret = serviceClientSecret;
    }

    /** Never prints the secret. */
    @Override
    public String toString() {
        return "GatewayAuditProperties{ingestUri=" + ingestUri + ", serviceTokenUri=" + serviceTokenUri
                + ", serviceClientId=" + serviceClientId + ", serviceClientSecret="
                + (isSet(serviceClientSecret) ? "set" : "unset") + '}';
    }
}
