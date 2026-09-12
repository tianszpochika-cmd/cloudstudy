package com.englishflow.media.security;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

class MediaAuthorityAttemptFilterTest {

    private final MediaAuthorityAttemptFilter filter = new MediaAuthorityAttemptFilter(new MediaSecurityErrorWriter());

    @Test
    void forgedAuthorizationHeadersAreRejected() throws Exception {
        for (String header : new String[]{"x-role", "X-B5-Role", "X-Tenant-Id", "X-Owner-Id", "X-Workload-Identity"}) {
            MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/media/assets/1");
            request.addHeader(header, "admin");
            MockHttpServletResponse response = new MockHttpServletResponse();
            MockFilterChain chain = new MockFilterChain();
            filter.doFilter(request, response, chain);
            assertEquals(403, response.getStatus(), header + " must be rejected");
            assertNull(chain.getRequest(), header + " must not reach the controller");
        }
    }

    @Test
    void forgedContentRightsQueryParameterIsRejected() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/media/assets/1");
        request.setParameter("contentRights", "PREMIUM");
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();
        filter.doFilter(request, response, chain);
        assertEquals(403, response.getStatus());
        assertNull(chain.getRequest());
    }

    @Test
    void cleanRequestsReachTheRestOfTheChain() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/media/assets/1");
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();
        filter.doFilter(request, response, chain);
        assertNotNull(chain.getRequest());
        assertEquals(200, response.getStatus());
    }
}
