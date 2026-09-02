-- Normalize the V11 defaults for pre-existing optional/capability consent rows.
-- V11 keeps the old history immutable, while this additive projection metadata correction makes
-- analytics and voice withdrawal narrow-scoped and prevents them from revoking all sessions.
UPDATE iam_consent
SET withdrawal_effect = CASE consent_type
        WHEN 'PRODUCT_ANALYTICS' THEN 'RESTRICT_PROTECTED_CAPABILITY'
        WHEN 'VOICE_RECORDING' THEN 'RESTRICT_PROTECTED_CAPABILITY'
        ELSE 'RESTRICT_ALL_LEARNING_ACCESS'
    END,
    revoke_sessions = CASE consent_type
        WHEN 'PRODUCT_ANALYTICS' THEN FALSE
        WHEN 'VOICE_RECORDING' THEN FALSE
        ELSE TRUE
    END
WHERE consent_type IN ('TERMS_OF_SERVICE', 'PRIVACY_NOTICE', 'ADULT_LEARNING',
                       'PRODUCT_ANALYTICS', 'VOICE_RECORDING');
