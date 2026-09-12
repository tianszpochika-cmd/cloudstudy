package com.englishflow.notification.security;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import tools.jackson.databind.ObjectMapper;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

class NotificationAuthorityAttemptFilterTest {

    private final NotificationAuthorityAttemptFilter filter =
            new NotificationAuthorityAttemptFilter(new NotificationSecurityErrorWriter(new ObjectMapper()));

    @Test
    void forgedAuthorizationHeadersAreRejected() throws Exception {
        for (String header : new String[]{"x-role", "X-B5-Role", "X-Tenant-Id", "X-Owner-Id",
                "X-Workload-Identity", "X-Service-Name"}) {
            MockHttpServletRequest request = new MockHttpServletRequest("GET", "/internal/v1/notifications");
            request.addHeader(header, "admin");
            MockHttpServletResponse response = new MockHttpServletResponse();
            MockFilterChain chain = new MockFilterChain();
            filter.doFilter(request, response, chain);
            assertEquals(403, response.getStatus(), header + " must be rejected");
            assertNull(chain.getRequest(), header + " must not reach the controller");
        }
    }

    @Test
    void forgedAuthorizationQueryParametersAreRejected() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/internal/v1/notifications");
        request.setParameter("ownerId", "other");
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();
        filter.doFilter(request, response, chain);
        assertEquals(403, response.getStatus());
        assertNull(chain.getRequest());
    }

    @Test
    void cleanRequestsReachTheRestOfTheChain() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/internal/v1/notifications");
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();
        filter.doFilter(request, response, chain);
        assertNotNull(chain.getRequest());
        assertEquals(200, response.getStatus());
    }
}
