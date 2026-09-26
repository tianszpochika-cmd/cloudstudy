package com.englishflow.content.web;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

class PublicSiteFacetTruthTest {

    @Test
    void incompleteLocalFixtureRowsNeverBecomePublicCards() {
        Map<String, Object> fixture = Map.of(
                "fixtureId", "local-real-10x-v1",
                "title", "本地站点信息 2",
                "order", 2);
        assertTrue(ContentHttpController.publicFacet("DOWNLOAD", fixture).isEmpty());
        assertTrue(ContentHttpController.publicFacet("ANNOUNCEMENT", fixture).isEmpty());
        assertTrue(ContentHttpController.publicFacet("COMPLIANCE", fixture).isEmpty());
    }

    @Test
    void onlyCompleteContractFieldsAreProjected() {
        Map<String, Object> availableWeb = ContentHttpController.publicFacet("DOWNLOAD", Map.of(
                "platform", "WEB", "channel", "学习 Web", "status", "AVAILABLE",
                "downloadUrl", "https://learn.clyunedev.com/start"));
        assertEquals("AVAILABLE", availableWeb.get("status"));
        assertEquals("https://learn.clyunedev.com/start", availableWeb.get("downloadUrl"));
        assertEquals("2026-09-23T00:00:00Z", ContentHttpController.publicFacet("ANNOUNCEMENT", Map.of(
                "announcementCode", "release-1", "title", "课程更新", "summary", "课程内容已更新。",
                "publishedAt", "2026-09-23T00:00:00Z")).get("publishedAt"));
        assertEquals("v1", ContentHttpController.publicFacet("COMPLIANCE", Map.of(
                "noticeCode", "adult-phase", "title", "服务范围", "body", "仅供成年用户使用。",
                "version", "v1", "effectiveAt", "2026-09-23T00:00:00Z")).get("version"));
    }

    @Test
    void malformedDatesAndStatusesAreExcluded() {
        assertTrue(ContentHttpController.publicFacet("DOWNLOAD", Map.of(
                "platform", "WEB", "channel", "学习 Web", "status", "")).isEmpty());
        assertTrue(ContentHttpController.publicFacet("ANNOUNCEMENT", Map.of(
                "announcementCode", "release-1", "title", "课程更新", "summary", "课程内容已更新。",
                "publishedAt", "not-a-date")).isEmpty());
    }

    @Test
    void availableDownloadsRequireUsablePublicHttpsUrls() {
        assertTrue(download("AVAILABLE", null).isEmpty());
        for (String url : List.of(
                "http://downloads.example.com/start",
                "https://localhost/start",
                "https://service.local/start",
                "https://127.0.0.1/start",
                "https://010.0.0.1/start",
                "https://10.20.30.40/start",
                "https://100.64.0.1/start",
                "https://172.16.0.1/start",
                "https://192.168.1.20/start",
                "https://169.254.169.254/latest/meta-data",
                "https://[::1]/start",
                "https://[fd00::1]/start",
                "https://[2001:db8::1]/start",
                "https://user@downloads.example.com/start")) {
            assertTrue(download("AVAILABLE", url).isEmpty(), url);
        }

        assertFalse(download("AVAILABLE", "https://8.8.8.8/start").isEmpty());
        assertFalse(download("AVAILABLE", "https://[2001:4860:4860::8888]/start").isEmpty());
    }

    @Test
    void unavailableDownloadsMayOmitLinksAndNeverExposeUnsafeOnes() {
        Map<String, Object> withoutLink = download("UNAVAILABLE", null);
        assertEquals("UNAVAILABLE", withoutLink.get("status"));
        assertFalse(withoutLink.containsKey("downloadUrl"));

        Map<String, Object> unsafeOptionalLink = download("COMING_SOON", "http://127.0.0.1/start");
        assertEquals("COMING_SOON", unsafeOptionalLink.get("status"));
        assertFalse(unsafeOptionalLink.containsKey("downloadUrl"));
    }

    private static Map<String, Object> download(String status, String downloadUrl) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("platform", "WEB");
        payload.put("channel", "学习 Web");
        payload.put("status", status);
        if (downloadUrl != null) {
            payload.put("downloadUrl", downloadUrl);
        }
        return ContentHttpController.publicFacet("DOWNLOAD", payload);
    }
}
