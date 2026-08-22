package com.englishflow.iam.domain;

/** Stable, non-sensitive decision codes used by IAM responses and audit facts. */
public enum IamDecisionCode {
    OIDC_REDIRECT_NOT_ALLOWED("oidc_redirect_not_allowed"),
    OIDC_STATE_INVALID("oidc_state_invalid"),
    OIDC_CALLBACK_REPLAY("oidc_callback_replay"),
    OIDC_NONCE_INVALID("oidc_nonce_invalid"),
    OIDC_PKCE_INVALID("oidc_pkce_invalid"),
    OIDC_ISSUER_INVALID("oidc_issuer_invalid"),
    OIDC_PROVIDER_REJECTED("oidc_provider_rejected"),
    PRINCIPAL_MAPPING_CONFLICT("principal_mapping_conflict"),
    CLIENT_AUTHORITY_OVERRIDE("client_authority_override"),
    CLIENT_TRUSTED_INPUT_REJECTED("client_trusted_input_rejected"),
    ADULT_CONFIRMATION_REQUIRED("adult_confirmation_required"),
    ADULT_AGE_EVIDENCE_MISSING("adult_age_evidence_missing"),
    ADULT_AGE_BELOW_MINIMUM("adult_age_below_minimum"),
    ADULT_GATE_ALLOWED("adult_gate_allowed"),
    AUDIT_UNAVAILABLE("audit_unavailable"),
    DEVICE_REGISTERED("device_registered"),
    DEVICE_NOT_FOUND("device_not_found"),
    DEVICE_REVOKED("device_revoked"),
    SESSION_OPENED("session_opened"),
    SESSION_ROTATED("session_rotated"),
    SESSION_REVOKED("session_revoked"),
    SESSION_NOT_FOUND("session_not_found"),
    SESSION_REPLAY("session_replay"),
    SESSION_PROVIDER_REJECTED("session_provider_rejected"),
    CONSENT_RECORDED("consent_recorded"),
    CONSENT_WITHDRAWN("consent_withdrawn"),
    CONSENT_VERSION_MISMATCH("consent_version_mismatch"),
    CONSENT_REQUIRES_EXPLICIT_ACCEPTANCE("consent_requires_explicit_acceptance");

    private final String wireValue;

    IamDecisionCode(String wireValue) {
        this.wireValue = wireValue;
    }

    public String wireValue() {
        return wireValue;
    }
}
