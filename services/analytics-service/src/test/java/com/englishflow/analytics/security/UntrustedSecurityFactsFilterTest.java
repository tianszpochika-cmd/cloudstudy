package com.englishflow.analytics.security;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

class UntrustedSecurityFactsFilterTest {

    private final UntrustedSecurityFactsFilter filter = new UntrustedSecurityFactsFilter();

    @Test
    void forgedAuthorizationHeadersAreRejected() throws Exception {
        for (String header : new String[]{"X-Role", "X-B5-Role", "X-Tenant-Id", "X-Owner-Id", "X-User-Id",
                "X-Principal-Id", "X-Permission", "X-Workload-Identity"}) {
            MockHttpServletRequest request = new MockHttpServletRequest("GET", "/internal/v1/analytics/metrics");
            request.addHeader(header, "admin");
            MockHttpServletResponse response = new MockHttpServletResponse();
            MockFilterChain chain = new MockFilterChain();
            filter.doFilter(request, response, chain);
            assertEquals(400, response.getStatus(), header + " must be rejected");
            assertNull(chain.getRequest(), header + " must not reach the controller");
        }
    }

    @Test
    void forgedAuthorizationQueryParametersAreRejected() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/internal/v1/analytics/metrics");
        request.setParameter("ownerId", "other");
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();
        filter.doFilter(request, response, chain);
        assertEquals(400, response.getStatus());
        assertNull(chain.getRequest());
    }

    @Test
    void cleanRequestsReachTheRestOfTheChain() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/internal/v1/analytics/metrics");
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();
        filter.doFilter(request, response, chain);
        assertNotNull(chain.getRequest());
        assertEquals(200, response.getStatus());
    }
}
