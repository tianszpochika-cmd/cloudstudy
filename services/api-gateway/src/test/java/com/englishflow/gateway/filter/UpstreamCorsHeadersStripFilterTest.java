package com.englishflow.gateway.filter;

import org.junit.jupiter.api.Test;
import org.springframework.cloud.gateway.filter.headers.HttpHeadersFilter;
import org.springframework.http.HttpHeaders;

import static org.assertj.core.api.Assertions.assertThat;

class UpstreamCorsHeadersStripFilterTest {

    @Test
    void stripsUpstreamCorsHeadersOnlyOnResponses() {
        UpstreamCorsHeadersStripFilter filter = new UpstreamCorsHeadersStripFilter();
        HttpHeaders upstream = new HttpHeaders();
        upstream.add(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, "https://learn.clyunedev.com");
        upstream.add(HttpHeaders.ACCESS_CONTROL_ALLOW_CREDENTIALS, "true");
        upstream.add("access-control-expose-headers", "X-Request-Id");
        upstream.add(HttpHeaders.SET_COOKIE, "a=b; Secure");
        upstream.add(HttpHeaders.CONTENT_TYPE, "application/json");

        HttpHeaders out = filter.filter(upstream, null);

        assertThat(out.headerNames()).noneMatch(h -> h.toLowerCase().startsWith("access-control-"));
        assertThat(out.get(HttpHeaders.SET_COOKIE)).containsExactly("a=b; Secure");
        assertThat(out.getFirst(HttpHeaders.CONTENT_TYPE)).isEqualTo("application/json");
        assertThat(filter.supports(HttpHeadersFilter.Type.RESPONSE)).isTrue();
        assertThat(filter.supports(HttpHeadersFilter.Type.REQUEST)).isFalse();
    }
}
