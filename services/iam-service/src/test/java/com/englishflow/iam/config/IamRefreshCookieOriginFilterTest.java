package com.englishflow.iam.config;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class IamRefreshCookieOriginFilterTest {

    private static final String COOKIE_VALUE = "synthetic-refresh-value";
    private final IamRefreshCookieOriginFilter filter = new IamRefreshCookieOriginFilter(new IamServiceProperties());
    private final ObjectMapper json = new ObjectMapper();

    @Test
    void learnerOriginWithMatchingRefererReachesRefresh() throws Exception {
        MockHttpServletRequest request = refresh("http://127.0.0.1:18180");
        request.addHeader(HttpHeaders.REFERER, "http://127.0.0.1:18180/onboarding");
        assertPassed(request);
    }

    @Test
    void localhostMobileOriginIsTrusted() throws Exception {
        assertPassed(refresh("http://localhost:18183"));
    }

    @Test
    void absentOriginMayUseTrustedReferer() throws Exception {
        MockHttpServletRequest request = refresh(null);
        request.addHeader(HttpHeaders.REFERER, "http://127.0.0.1:18183/assessment");
        assertPassed(request);
    }

    @Test
    void missingSourceIsForbidden() throws Exception {
        assertDenied(refresh(null));
    }

    @Test
    void httpsPageAndAdminOriginAreClosed() throws Exception {
        assertDenied(refresh("https://127.0.0.1:18180"));
        assertDenied(refresh("http://127.0.0.1:18181"));
        assertDenied(refresh("null"));
    }

    @Test
    void originAndRefererConflictIsForbidden() throws Exception {
        MockHttpServletRequest request = refresh("http://127.0.0.1:18180");
        request.addHeader(HttpHeaders.REFERER, "http://localhost:18180/onboarding");
        assertDenied(request);
    }

    @Test
    void requestsWithoutTheRefreshCookieAreNotBlocked() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/auth/login");
        assertPassed(request);
    }

    @Test
    void safeMethodsAndNonAuthPathsAreNotBlocked() throws Exception {
        MockHttpServletRequest read = refresh("http://evil.example");
        read.setMethod("GET");
        assertPassed(read);
        MockHttpServletRequest adultGate = new MockHttpServletRequest("POST", "/api/v1/iam/adult-gate");
        adultGate.setCookies(new Cookie("yuxuexing_refresh", COOKIE_VALUE));
        assertPassed(adultGate);
    }

    private void assertPassed(MockHttpServletRequest request) throws Exception {
        boolean[] called = {false};
        filter.doFilter(request, new MockHttpServletResponse(), (req, res) -> called[0] = true);
        assertTrue(called[0]);
    }

    private void assertDenied(MockHttpServletRequest request) throws Exception {
        boolean[] called = {false};
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = (req, res) -> called[0] = true;
        filter.doFilter(request, response, chain);
        assertFalse(called[0]);
        assertEquals(403, response.getStatus());
        assertEquals("no-store", response.getHeader(HttpHeaders.CACHE_CONTROL));
        assertTrue(response.getContentType().startsWith("application/json"));
        String body = response.getContentAsString();
        assertFalse(body.contains(COOKIE_VALUE));
        JsonNode envelope = json.readTree(body);
        assertEquals("FORBIDDEN", envelope.path("error").path("errorCode").asText());
        assertEquals("iam.auth.origin_untrusted", envelope.path("error").path("message").asText());
        assertFalse(envelope.path("error").path("retryable").asBoolean());
        assertEquals("v1", envelope.path("meta").path("apiVersion").asText());
    }

    private static MockHttpServletRequest refresh(String origin) {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/auth/token/refresh");
        request.setCookies(new Cookie("yuxuexing_refresh", COOKIE_VALUE));
        if (origin != null) request.addHeader(HttpHeaders.ORIGIN, origin);
        return request;
    }
}
