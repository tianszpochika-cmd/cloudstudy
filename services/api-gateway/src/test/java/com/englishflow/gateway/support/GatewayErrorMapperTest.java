package com.englishflow.gateway.support;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.net.ConnectException;
import java.util.concurrent.TimeoutException;

import static org.junit.jupiter.api.Assertions.assertEquals;

class GatewayErrorMapperTest {

    @Test
    void mapsTimeoutToGatewayTimeout() {
        GatewayError error = GatewayErrorMapper.map(new TimeoutException(), "request-1", "trace-1");

        assertEquals(504, error.status());
        assertEquals("upstream_timeout", error.code());
    }

    @Test
    void mapsConnectFailureToUnavailable() {
        GatewayError error = GatewayErrorMapper.map(new ConnectException(), "request-1", "trace-1");

        assertEquals(503, error.status());
        assertEquals("upstream_unavailable", error.code());
    }

    @Test
    void preservesExplicitHttpErrorSemantics() {
        GatewayError error = GatewayErrorMapper.map(
                new ResponseStatusException(HttpStatus.FORBIDDEN),
                "request-1",
                "trace-1"
        );

        assertEquals(403, error.status());
        assertEquals("forbidden", error.code());
    }
}
