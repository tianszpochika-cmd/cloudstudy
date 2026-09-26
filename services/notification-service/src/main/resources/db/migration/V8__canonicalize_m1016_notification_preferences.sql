-- M1-016 preference owner schema. Historical rows do not carry consentVersion,
-- DND intent, or frequencyPolicy. Keep them for audit/recovery, but do not promote
-- their enabled values into the canonical preference fact or infer consent.
CREATE TABLE notification_preference_canonical_v8 (
    tenant_id VARCHAR(128) NOT NULL,
    principal_id VARCHAR(128) NOT NULL,
    category VARCHAR(32) NOT NULL,
    channel VARCHAR(16) NOT NULL,
    enabled BOOLEAN NOT NULL,
    locale VARCHAR(20) NOT NULL,
    consent_version INT NOT NULL,
    dnd_start_local_time TIME NOT NULL,
    dnd_end_local_time TIME NOT NULL,
    frequency_policy VARCHAR(20) NOT NULL,
    version_no BIGINT NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (tenant_id, principal_id, category, channel),
    KEY idx_notification_preference_owner (tenant_id, principal_id),
    CONSTRAINT chk_notification_preference_category_v8 CHECK (category IN (
        'LEARNING', 'REVIEW', 'STREAK', 'EXAM', 'CHECKPOINT', 'STUDY_ROOM', 'REWARDS',
        'COURSE', 'MEMBERSHIP', 'MARKETING', 'SECURITY', 'ACCOUNT', 'PAYMENT', 'SYSTEM')),
    CONSTRAINT chk_notification_preference_channel_v8 CHECK (channel IN ('IN_APP', 'PUSH', 'EMAIL', 'SMS')),
    CONSTRAINT chk_notification_preference_sms_v8 CHECK (
        channel <> 'SMS' OR category IN ('SECURITY', 'ACCOUNT', 'PAYMENT')),
    CONSTRAINT chk_notification_preference_locale_v8 CHECK (locale = 'zh-CN'),
    CONSTRAINT chk_notification_preference_consent_version_v8 CHECK (consent_version >= 1),
    CONSTRAINT chk_notification_preference_start_time_v8 CHECK (
        dnd_start_local_time >= '00:00:00' AND dnd_start_local_time < '24:00:00'),
    CONSTRAINT chk_notification_preference_end_time_v8 CHECK (
        dnd_end_local_time >= '00:00:00' AND dnd_end_local_time < '24:00:00'),
    CONSTRAINT chk_notification_preference_frequency_v8 CHECK (
        frequency_policy IN ('IMMEDIATE', 'DAILY_DIGEST', 'WEEKLY_DIGEST', 'DISABLED')),
    CONSTRAINT chk_notification_preference_version_v8 CHECK (version_no >= 1)
) ENGINE=InnoDB;

-- Atomic table swap: existing consumers see either the historical table or the
-- canonical table, while the legacy facts remain intact under an archive name.
RENAME TABLE notification_preference TO notification_preference_legacy,
             notification_preference_canonical_v8 TO notification_preference;
