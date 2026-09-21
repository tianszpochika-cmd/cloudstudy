package com.englishflow.content.web;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.web.server.ResponseStatusException;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/** B4-02 phonetics language ribbon: domain mapping keeps English default-compatible. */
@DisplayName("B3 phonetics language domain mapping")
class B3PhoneticsDomainTest {

    @Test
    void blankLanguageKeepsLegacyEnglishDomain() {
        assertEquals("PHONETICS", B3ContentJdbcController.phoneticsDomain(null));
        assertEquals("PHONETICS", B3ContentJdbcController.phoneticsDomain(""));
        assertEquals("PHONETICS", B3ContentJdbcController.phoneticsDomain("   "));
    }

    @ParameterizedTest
    @ValueSource(strings = {"en", "EN", "en-US", "en-GB"})
    void englishTagsKeepLegacyDomain(String language) {
        assertEquals("PHONETICS", B3ContentJdbcController.phoneticsDomain(language));
    }

    @Test
    void frenchTagsResolveToFrenchDomain() {
        assertEquals("PHONETICS-FR", B3ContentJdbcController.phoneticsDomain("fr-FR"));
        assertEquals("PHONETICS-FR", B3ContentJdbcController.phoneticsDomain("fr"));
    }

    @Test
    void germanTagResolvesToGermanDomain() {
        assertEquals("PHONETICS-DE", B3ContentJdbcController.phoneticsDomain("de-DE"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"e", "1234", "bad tag!!", "-FR", "french"})
    void invalidLanguageIsRejected(String language) {
        assertThrows(ResponseStatusException.class,
                () -> B3ContentJdbcController.phoneticsDomain(language));
    }
}
