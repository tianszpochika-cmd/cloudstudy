package com.englishflow.gateway.support;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CorrelationIdsTest {

    @Test
    void rejectsUntrustedRequestIdAndGeneratesBoundedValue() {
        String generated = CorrelationIds.requestId("bad value\nwith-header-injection", 128);

        assertNotEquals("bad value\nwith-header-injection", generated);
        assertTrue(generated.matches("[A-Za-z0-9-]{36}"));
    }

    @Test
    void mintedRequestIdSatisfiesThePlatformOwnerServicePattern() {
        // P1-LIVE-004: owner services fail closed unless the id starts with a letter.
        for (int i = 0; i < 25; i++) {
            String generated = CorrelationIds.requestId(null, 128);
            assertTrue(generated.matches("[A-Za-z][A-Za-z0-9._-]{7,127}"),
                    "minted request id must satisfy the platform pattern: " + generated);
        }
    }

    @Test
    void extractsTraceIdFromValidW3cTraceparent() {
        assertEquals(
                "4bf92f3577b34da6a3ce929d0e0e4736",
                CorrelationIds.traceId(null, "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01", 128)
        );
    }
}
