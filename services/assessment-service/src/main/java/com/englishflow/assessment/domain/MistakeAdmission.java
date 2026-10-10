package com.englishflow.assessment.domain;

/** Only a fully missed practice enters the mistake book. */
public final class MistakeAdmission {
    private MistakeAdmission() {
    }

    public static boolean entersBook(String totalScoreBucket) {
        return "ZERO".equals(totalScoreBucket);
    }
}
