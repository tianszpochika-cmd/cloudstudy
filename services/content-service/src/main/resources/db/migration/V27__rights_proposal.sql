-- V27: version-bound rights proposals (editor claims, L2-unverified).
-- The verified authority fact stays in rights_* (PENDING until L2 final
-- approval flips it); the proposal columns carry the editor-submitted dossier
-- (channels, evidence ref, learning grant) that the submit gate checks for
-- completeness and L2 verifies into ACTIVE rights. Claims and authority never
-- share a column, so client input can never be mistaken for a grant.
ALTER TABLE content_version
    ADD COLUMN rights_proposed_channels JSON NULL,
    ADD COLUMN rights_proposed_evidence_ref VARCHAR(128) NULL,
    ADD COLUMN rights_proposed_allows_learning TINYINT(1) NOT NULL DEFAULT 0;
