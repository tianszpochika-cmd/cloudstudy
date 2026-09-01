package com.englishflow.gateway.support;

import com.englishflow.gateway.config.GatewayProperties;
import com.englishflow.gateway.policy.GatewayRoutePolicy;
import org.junit.jupiter.api.Test;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class SecurityAuditRecorderTest {

    @Test
    void recordsUnsetResponseStatusAsSuccessfulDefault200() {
        GatewayProperties properties = mock(GatewayProperties.class);
        GatewayProperties.Cors cors = mock(GatewayProperties.Cors.class);
        when(properties.security()).thenReturn(new GatewayProperties.Security(
                false, false, true, null, null, null));
        when(properties.requestContext()).thenReturn(new GatewayProperties.RequestContext(128));
        when(properties.cors()).thenReturn(cors);
        when(cors.profileFor(any())).thenReturn(GatewayProperties.Cors.OriginProfile.UNKNOWN);
        when(cors.nativeAuthTransport()).thenReturn("NATIVE_SECURE_STORAGE");

        List<SecurityAuditRecord> records = new ArrayList<>();
        SecurityAuditRecorder recorder = new SecurityAuditRecorder(
                properties,
                new GatewayRoutePolicy(),
                records::add
        );
        var exchange = MockServerWebExchange.from(
                MockServerHttpRequest.get("/api/v1/public/content/catalog").build());

        recorder.record(exchange, System.nanoTime()).block();

        assertEquals(1, records.size());
        assertEquals(200, records.getFirst().status());
        assertEquals("ALLOW", records.getFirst().decision());
        assertEquals("completed", records.getFirst().reasonCode());
    }
}
