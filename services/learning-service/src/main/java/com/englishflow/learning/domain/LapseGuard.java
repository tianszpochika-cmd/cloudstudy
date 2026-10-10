package com.englishflow.learning.domain;

/** A retry or an untrusted result must not add a lapse. Sm2Scheduler.review stays unchanged. */
public final class LapseGuard {
    private LapseGuard() {
    }

    public static int acceptedLapse(int currentLapse, int scheduledLapse, boolean trusted, boolean retry) {
        if (!trusted || retry) return currentLapse;
        return scheduledLapse;
    }
}
