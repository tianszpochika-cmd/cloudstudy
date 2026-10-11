-- V30: IT-6 release desk snapshot owned by content-service.
-- One row holds the desk facts so a process restart reads them back.
-- This table does not publish catalog rows and does not replace the four-eyes aggregate.
CREATE TABLE IF NOT EXISTS it6_release_studio (
    studio_id VARCHAR(64) NOT NULL,
    state_json JSON NOT NULL,
    state_version BIGINT NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    PRIMARY KEY (studio_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
