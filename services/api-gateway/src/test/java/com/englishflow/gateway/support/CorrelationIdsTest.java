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
    void extractsTraceIdFromValidW3cTraceparent() {
        assertEquals(
                "4bf92f3577b34da6a3ce929d0e0e4736",
                CorrelationIds.traceId(null, "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01", 128)
        );
    }
}
