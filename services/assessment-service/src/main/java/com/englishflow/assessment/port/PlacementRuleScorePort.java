package com.englishflow.assessment.port;

/**
 * Objective grade for one placement choice. The answer stays in content-service.
 * This port returns FULL or ZERO and a sentence that does not carry the option.
 */
public interface PlacementRuleScorePort {
    String FULL_EXPLANATION = "Selected option equals the stored answer rule.";
    String ZERO_EXPLANATION = "Selected option does not equal the stored answer rule.";

    RuleScore score(long itemId, String selectedOptionId);

    record RuleScore(String outcome, String explanation) {
        public RuleScore {
            if (!"FULL".equals(outcome) && !"ZERO".equals(outcome)) {
                throw new IllegalArgumentException("placement outcome must be FULL or ZERO");
            }
            String expected = "FULL".equals(outcome) ? FULL_EXPLANATION : ZERO_EXPLANATION;
            if (!expected.equals(explanation) || explanation.contains("correctOption")) {
                throw new IllegalArgumentException("placement explanation does not match the outcome");
            }
        }
    }
}
