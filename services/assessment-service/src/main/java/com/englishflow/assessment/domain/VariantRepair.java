package com.englishflow.assessment.domain;

/** A variant must be a different linked item. Passing a repair does not claim permanent mastery. */
public final class VariantRepair {
    public static final String NO_VARIANT = "NO_VARIANT";
    public static final String NO_VARIANT_COPY = "这次没有可用的变式题，不会用原题冒充。";
    public static final String PASSED = "本次补救已通过";

    private VariantRepair() {
    }

    public static boolean linked(long originalItemId, long variantItemId) {
        return variantItemId > 0 && variantItemId != originalItemId;
    }
}
