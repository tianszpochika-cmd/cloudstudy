package com.englishflow.iam.domain;

/**
 * IAM-owned consent types.  The enum names are storage names; {@link #wireType()} and
 * {@link #purpose()} are the names used by the frozen B8 contract.
 */
public enum ConsentType {
    TERMS_OF_SERVICE("TERMS", "ACCOUNT_TERMS"),
    PRIVACY_NOTICE("PRIVACY", "PRIVACY_NOTICE"),
    ADULT_LEARNING("ADULT_LEARNING", "ADULT_LEARNING_ELIGIBILITY"),
    PRODUCT_ANALYTICS("PRODUCT_ANALYTICS", "PRODUCT_ANALYTICS"),
    VOICE_RECORDING("VOICE_RECORDING", "ADULT_VOICE_RECORDING_REMOTE_STORAGE_AND_REPLAY");

    private final String wireType;
    private final String purpose;

    ConsentType(String wireType, String purpose) {
        this.wireType = wireType;
        this.purpose = purpose;
    }

    public String wireType() {
        return wireType;
    }

    public String purpose() {
        return purpose;
    }

    /** Accept only the five exact B8 request type values. */
    public static ConsentType fromWire(String value) {
        return switch (value == null ? "" : value) {
            case "TERMS" -> TERMS_OF_SERVICE;
            case "PRIVACY" -> PRIVACY_NOTICE;
            case "ADULT_LEARNING" -> ADULT_LEARNING;
            case "PRODUCT_ANALYTICS" -> PRODUCT_ANALYTICS;
            case "VOICE_RECORDING" -> VOICE_RECORDING;
            default -> throw new IamPolicyException(IamDecisionCode.INVALID_REQUEST,
                    "iam.consent.type_invalid");
        };
    }

    /** Non-public persistence/history adapter for pre-B8 storage names. */
    static ConsentType fromLegacyStorage(String value) {
        String normalized = value == null ? "" : value.trim().toUpperCase(java.util.Locale.ROOT);
        return switch (normalized) {
            case "TERMS", "TERMS_OF_SERVICE", "ACCOUNT_TERMS" -> TERMS_OF_SERVICE;
            case "PRIVACY", "PRIVACY_NOTICE" -> PRIVACY_NOTICE;
            case "ADULT_LEARNING", "ADULT_LEARNING_ELIGIBILITY" -> ADULT_LEARNING;
            case "PRODUCT_ANALYTICS" -> PRODUCT_ANALYTICS;
            case "VOICE_RECORDING", "ADULT_VOICE_RECORDING_REMOTE_STORAGE_AND_REPLAY" -> VOICE_RECORDING;
            default -> throw new IllegalArgumentException("unknown consent storage type");
        };
    }
}
