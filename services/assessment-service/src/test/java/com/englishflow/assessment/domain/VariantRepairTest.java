package com.englishflow.assessment.domain;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class VariantRepairTest {
    @Test
    void missingVariantStaysExplainedAndPassingDoesNotClaimMastery() {
        assertFalse(VariantRepair.linked(11, 0));
        assertFalse(VariantRepair.linked(11, 11));
        assertTrue(VariantRepair.linked(11, 22));
        assertEquals("NO_VARIANT", VariantRepair.NO_VARIANT);
        assertFalse(VariantRepair.PASSED.contains("已掌握"));
        assertEquals("本次补救已通过", VariantRepair.PASSED);
    }
}
