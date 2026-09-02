package com.englishflow.iam.domain;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.time.Instant;
import java.util.List;

/** Strict B8 PDP input shape. All authority fields are verified again by IAM before use. */
@JsonIgnoreProperties(ignoreUnknown = false)
public record PdpAuthorizationRequest(String invocationReason, String action, PrincipalContext principal,
                                      ResourceContext resource, PolicyContext policy,
                                      ServiceIdentityContext serviceIdentity) {

    @JsonIgnoreProperties(ignoreUnknown = false)
    public record PrincipalContext(Subject subject, Tenant tenant, List<String> roles, List<String> permissions,
                                   Phase phase, AdultGate adultGate, Consent consent, DeviceTrust deviceTrust,
                                   AuthorityProvenance authorityProvenance) {}
    @JsonIgnoreProperties(ignoreUnknown = false)
    public record Subject(String subjectId, String source, Instant derivedAt) {}
    @JsonIgnoreProperties(ignoreUnknown = false)
    public record Tenant(String tenantId, String provenance, Instant derivedAt) {}
    @JsonIgnoreProperties(ignoreUnknown = false)
    public record Phase(String currentPhase, String learningAccess, String provenance) {}
    @JsonIgnoreProperties(ignoreUnknown = false)
    public record AdultGate(String status, String learningAccess, Instant effectiveAt, String policyVersion,
                            Instant policyAsOf, Integer minimumAge, String evidenceDigest, String evidenceStatus,
                            AdultProvenance evaluationProvenance, Revalidation revalidation) {}
    @JsonIgnoreProperties(ignoreUnknown = false)
    public record AdultProvenance(String authority, String evaluator, String evidenceSource, Instant evaluatedAt,
                                 Boolean rawEvidenceReturned) {}
    @JsonIgnoreProperties(ignoreUnknown = false)
    public record Consent(Boolean required, Boolean accepted, String version, String learningAccess,
                          List<String> requiredPurposes, List<String> unsatisfiedPurposes, Instant evaluatedAt,
                          String policyVersion, Revalidation revalidation, ConsentProvenance provenance) {}
    @JsonIgnoreProperties(ignoreUnknown = false)
    public record ConsentProvenance(String authority, Instant recordedAt, String documentSource, String policySource) {}
    @JsonIgnoreProperties(ignoreUnknown = false)
    public record Revalidation(String status, Boolean required, Instant evaluatedAt, Instant dueAt,
                               List<String> reasonCodes) {}
    @JsonIgnoreProperties(ignoreUnknown = false)
    public record DeviceTrust(String deviceId, String trustLevel, String sessionStatus, String provenance,
                              Instant evaluatedAt) {}
    @JsonIgnoreProperties(ignoreUnknown = false)
    public record AuthorityProvenance(String authority, Instant derivedAt, String jwtValidation,
                                      String tenantSource, String rolePermissionSource, String policySource,
                                      String revocationState) {}
    @JsonIgnoreProperties(ignoreUnknown = false)
    public record ResourceContext(String resourceType, String resourceId, Owner owner, Tenant tenant,
                                  String phase, String contentRights, ResourceProvenance provenance) {}
    @JsonIgnoreProperties(ignoreUnknown = false)
    public record Owner(String ownerId, String provenance) {}
    @JsonIgnoreProperties(ignoreUnknown = false)
    public record ResourceProvenance(String ownerService, Instant resolvedAt, String factDigest) {}
    @JsonIgnoreProperties(ignoreUnknown = false)
    public record PolicyContext(PolicyVersion policy, String bundleVersion, String cacheState, String revocationState) {}
    @JsonIgnoreProperties(ignoreUnknown = false)
    public record PolicyVersion(String policyVersionId, String version, String status, Instant effectiveAt,
                                String revocationState, String provenance) {}
    @JsonIgnoreProperties(ignoreUnknown = false)
    public record ServiceIdentityContext(String serviceId, String credentialBinding, String audience,
                                         Instant authenticatedAt) {}
}
