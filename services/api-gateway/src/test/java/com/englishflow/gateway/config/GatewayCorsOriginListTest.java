package com.englishflow.gateway.config;

import org.junit.jupiter.api.Test;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;

class GatewayCorsOriginListTest {

    private final GatewayProperties.Cors cors = new GatewayProperties.Cors(
            "https://learn.clyunedev.com, https://learn.clyune.com",
            "https://admin.clyunedev.com,https://admin.clyune.com",
            "https://mobile.clyunedev.com,https://mobile.clyune.com",
            "https://clyunedev.com,https://clyune.com,https://www.clyune.com",
            "GET,POST", "Content-Type", "Content-Type", "X-Request-Id", "rt", "header", Duration.ofMinutes(30));

    @Test
    void eachListedOriginMapsToItsProfile() {
        assertThat(cors.profileFor("https://learn.clyune.com")).isEqualTo(GatewayProperties.Cors.OriginProfile.LEARNER_WEB);
        assertThat(cors.profileFor("https://learn.clyunedev.com")).isEqualTo(GatewayProperties.Cors.OriginProfile.LEARNER_WEB);
        assertThat(cors.profileFor("https://mobile.clyune.com")).isEqualTo(GatewayProperties.Cors.OriginProfile.MOBILE_H5);
        assertThat(cors.profileFor("https://admin.clyune.com")).isEqualTo(GatewayProperties.Cors.OriginProfile.ADMIN_WEB);
        assertThat(cors.profileFor("https://www.clyune.com")).isEqualTo(GatewayProperties.Cors.OriginProfile.OFFICIAL_SITE);
    }

    @Test
    void unlistedOrPartialOriginsStayUnknown() {
        assertThat(cors.profileFor("https://learn.clyune.com.evil.io")).isEqualTo(GatewayProperties.Cors.OriginProfile.UNKNOWN);
        assertThat(cors.profileFor("https://evil.com")).isEqualTo(GatewayProperties.Cors.OriginProfile.UNKNOWN);
        assertThat(cors.profileFor(null)).isEqualTo(GatewayProperties.Cors.OriginProfile.UNKNOWN);
        assertThat(cors.profileFor("")).isEqualTo(GatewayProperties.Cors.OriginProfile.UNKNOWN);
    }

    @Test
    void originListsPassTheExactUniqueOriginValidation() {
        assertThat(cors.isOriginPolicySafe()).isTrue();
        assertThat(cors.allOrigins()).contains("https://learn.clyune.com", "https://www.clyune.com");
        GatewayProperties.Cors withPath = new GatewayProperties.Cors(
                "https://learn.clyune.com,https://learn.clyune.com/x", "https://a.example", "https://m.example", "https://o.example",
                "GET", "Content-Type", "Content-Type", "X-Request-Id", "rt", "header", Duration.ofMinutes(30));
        assertThat(withPath.isOriginPolicySafe()).isFalse();
        GatewayProperties.Cors duplicated = new GatewayProperties.Cors(
                "https://learn.clyune.com", "https://learn.clyune.com", "https://m.example", "https://o.example",
                "GET", "Content-Type", "Content-Type", "X-Request-Id", "rt", "header", Duration.ofMinutes(30));
        assertThat(duplicated.isOriginPolicySafe()).isFalse();
    }
}
