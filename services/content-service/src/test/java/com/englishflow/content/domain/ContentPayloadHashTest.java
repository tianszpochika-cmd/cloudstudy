package com.englishflow.content.domain;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

/** Deterministic SHA-256 canonical hashing used for version pinning and idempotency fingerprints. */
@DisplayName("ContentPayloadHash determinism and stability")
class ContentPayloadHashTest {

    @Test
    @DisplayName("the same logical payload hashes identically regardless of key order")
    void hashIsOrderIndependent() {
        Map<String, Object> a = Map.of("term", "cat", "definition", "猫");
        Map<String, Object> b = Map.of("definition", "猫", "term", "cat");
        assertEquals(ContentPayloadHash.sha256(a), ContentPayloadHash.sha256(b));
    }

    @Test
    @DisplayName("different payloads hash differently")
    void differentPayloadsHashDifferently() {
        Map<String, Object> a = Map.of("term", "cat");
        Map<String, Object> b = Map.of("term", "dog");
        assertNotEquals(ContentPayloadHash.sha256(a), ContentPayloadHash.sha256(b));
    }

    @Test
    @DisplayName("nested maps and lists hash deterministically")
    void nestedStructuresAreStable() {
        Map<String, Object> a = Map.of("options", List.of(Map.of("label", "A"), Map.of("label", "B")));
        Map<String, Object> b = Map.of("options", List.of(Map.of("label", "A"), Map.of("label", "B")));
        assertEquals(ContentPayloadHash.sha256(a), ContentPayloadHash.sha256(b));
    }

    @Test
    @DisplayName("null and primitive values are encoded safely")
    void nullAndPrimitives() {
        Map<String, Object> withNull = new java.util.HashMap<>();
        withNull.put("a", null);
        withNull.put("b", 1);
        withNull.put("c", true);
        Map<String, Object> without = new java.util.HashMap<>();
        without.put("b", 1);
        without.put("c", true);
        assertNotEquals(ContentPayloadHash.sha256(withNull), ContentPayloadHash.sha256(without));
    }
}
