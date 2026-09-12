package com.englishflow.audit.security;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

class AuditAuthorityAttemptFilterTest {

    private final AuditAuthorityAttemptFilter filter = new AuditAuthorityAttemptFilter();

    @Test
    void forgedAuthorizationHeadersAreRejected() throws Exception {
        for (String header : new String[]{"X-Role", "X-B5-Role", "X-Tenant-Id", "X-Owner-Id", "X-Permission",
                "X-Workload-Identity"}) {
            MockHttpServletRequest request = new MockHttpServletRequest("POST", "/internal/v1/audit/events");
            request.addHeader(header, "admin");
            MockHttpServletResponse response = new MockHttpServletResponse();
            MockFilterChain chain = new MockFilterChain();
            filter.doFilter(request, response, chain);
            assertEquals(403, response.getStatus(), header + " must be rejected");
            assertNull(chain.getRequest());
        }
    }

    @Test
    void actuatorRequestsBypassTheRejection() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/actuator/health/readiness");
        request.addHeader("X-Role", "admin");
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();
        filter.doFilter(request, response, chain);
        assertNotNull(chain.getRequest());
    }

    @Test
    void cleanRequestsReachTheRestOfTheChain() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/internal/v1/audit/events");
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();
        filter.doFilter(request, response, chain);
        assertNotNull(chain.getRequest());
        assertEquals(200, response.getStatus());
    }
}
