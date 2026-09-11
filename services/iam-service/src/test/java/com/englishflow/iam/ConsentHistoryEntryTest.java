package com.englishflow.iam;

import com.englishflow.iam.domain.ConsentHistoryEntry;
import com.englishflow.iam.domain.ConsentPolicyDescriptor;
import com.englishflow.iam.domain.ConsentRecord;
import com.englishflow.iam.domain.ConsentType;
import com.englishflow.iam.domain.ConsentVersion;
import com.englishflow.iam.domain.PrincipalId;
import com.englishflow.iam.domain.TenantScope;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Unit boundary for the explicit legacy consent history representation: legacy facts stay
 * readable but can never be turned into an authorization record or a fabricated published digest.
 */
class ConsentHistoryEntryTest {

    private static final String DIGEST = "a".repeat(64);
    private static final Instant RECORDED_AT = Instant.parse("2026-08-01T00:00:00Z");

    @Test
    void legacyEntryCannotAuthorize() {
        ConsentHistoryEntry legacy = entry(null, null, true);
        assertTrue(legacy.legacy());
        assertFalse(legacy.documentDigest() != null || legacy.policyDigest() != null);
        assertThrows(IllegalStateException.class, legacy::verifiedRecord,
                "a legacy entry must fail closed instead of manufacturing a published fact");
    }

    @Test
    void legacyEntryCannotCarryPublishedDigests() {
        assertThrows(IllegalArgumentException.class, () -> entry(DIGEST, DIGEST, true));
        assertThrows(IllegalArgumentException.class, () -> entry(DIGEST, null, true));
        assertThrows(IllegalArgumentException.class, () -> entry(null, DIGEST, true));
    }

    @Test
    void verifiedEntryRequiresPublishedDigests() {
        assertThrows(IllegalArgumentException.class, () -> entry(null, null, false));
        assertThrows(IllegalArgumentException.class, () -> entry(DIGEST, null, false));
    }

    @Test
    void verifiedEntryRoundTripsTheDomainFact() {
        PrincipalId principal = PrincipalId.random();
        ConsentRecord record = new ConsentRecord(UUID.randomUUID(), principal, TenantScope.derive(principal),
                ConsentType.TERMS_OF_SERVICE, ConsentType.TERMS_OF_SERVICE.purpose(), "BASE_REQUIRED", true,
                new ConsentVersion("v1"), DIGEST, new ConsentVersion("p1"), DIGEST, true, RECORDED_AT, RECORDED_AT,
                ConsentPolicyDescriptor.WithdrawalEffect.NO_ACTION, false);
        ConsentHistoryEntry entry = ConsentHistoryEntry.verified(record);
        assertFalse(entry.legacy());
        assertEquals(record, entry.verifiedRecord());
    }

    @Test
    void legacyEntryStillHasToMatchItsConsentType() {
        PrincipalId principal = PrincipalId.random();
        TenantScope scope = TenantScope.derive(principal);
        assertThrows(IllegalArgumentException.class, () -> new ConsentHistoryEntry(UUID.randomUUID(), principal, scope,
                ConsentType.TERMS_OF_SERVICE, "WRONG_PURPOSE", "BASE_REQUIRED", true, new ConsentVersion("v1"), null,
                new ConsentVersion("p1"), null, true, RECORDED_AT, RECORDED_AT,
                ConsentPolicyDescriptor.WithdrawalEffect.NO_ACTION, false, true));
    }

    private static ConsentHistoryEntry entry(String documentDigest, String policyDigest, boolean legacy) {
        PrincipalId principal = PrincipalId.random();
        return new ConsentHistoryEntry(UUID.randomUUID(), principal, TenantScope.derive(principal),
                ConsentType.TERMS_OF_SERVICE, ConsentType.TERMS_OF_SERVICE.purpose(), "BASE_REQUIRED", true,
                new ConsentVersion("v1"), documentDigest, new ConsentVersion("p1"), policyDigest, true,
                RECORDED_AT, RECORDED_AT, ConsentPolicyDescriptor.WithdrawalEffect.NO_ACTION, false, legacy);
    }
}
