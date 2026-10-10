package com.englishflow.learning.application;

import java.util.List;

/**
 * Decides whether a planning-input digest replays an existing snapshot or
 * must be inserted as the next pin version. An existing version is never
 * updated. A duplicate-key insert is the caller's signal to answer 409.
 */
public final class PlanInputHistory {

    private PlanInputHistory() {
    }

    public record Existing(long pinVersion, String pinDigest) {
    }

    public sealed interface Decision {
        record Replay(long pinVersion) implements Decision {
        }

        record Insert(long pinVersion) implements Decision {
        }
    }

    public static Decision decide(List<Existing> rows, String digest) {
        if (digest == null || digest.isBlank()) {
            throw new IllegalArgumentException("pin digest is required");
        }
        long max = 0L;
        if (rows != null) {
            for (Existing row : rows) {
                if (row == null || row.pinDigest() == null) {
                    continue;
                }
                if (digest.equals(row.pinDigest())) {
                    return new Decision.Replay(row.pinVersion());
                }
                if (row.pinVersion() > max) {
                    max = row.pinVersion();
                }
            }
        }
        return new Decision.Insert(max + 1L);
    }

    /** True when writing this digest would replace a stored version. */
    public static boolean rejectsOverwrite(String storedDigest, String incomingDigest) {
        return storedDigest != null && incomingDigest != null && !storedDigest.equals(incomingDigest);
    }
}
