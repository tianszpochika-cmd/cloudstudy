package com.englishflow.content.adapter.jdbc;

import com.englishflow.content.domain.ContentOperationException;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import tools.jackson.databind.ObjectMapper;

/** Small JSON/time boundary shared by the content-owned JDBC adapters. */
final class JdbcContentJson {

    private JdbcContentJson() {
    }

    static String write(ObjectMapper mapper, Object value, String failureMessage) {
        try {
            return mapper.writeValueAsString(value);
        } catch (Exception exception) {
            throw ContentOperationException.unavailable(
                    "CONTENT_PERSISTENCE_SERIALIZE_FAILED", failureMessage);
        }
    }

    @SuppressWarnings("unchecked")
    static Map<String, Object> readMap(ObjectMapper mapper, String json, String failureMessage) {
        if (json == null || json.isBlank()) {
            throw ContentOperationException.unavailable("CONTENT_FACT_CORRUPT", failureMessage);
        }
        try {
            Object value = mapper.readValue(json, Map.class);
            if (!(value instanceof Map<?, ?>)) {
                throw new IllegalArgumentException("JSON value is not an object");
            }
            return (Map<String, Object>) value;
        } catch (Exception exception) {
            throw ContentOperationException.unavailable("CONTENT_FACT_CORRUPT", failureMessage);
        }
    }

    static Set<String> readStringSet(ObjectMapper mapper, String json, String failureMessage) {
        if (json == null || json.isBlank()) {
            throw ContentOperationException.unavailable("CONTENT_FACT_CORRUPT", failureMessage);
        }
        try {
            Object value = mapper.readValue(json, List.class);
            if (!(value instanceof List<?> list)) {
                throw new IllegalArgumentException("JSON value is not an array");
            }
            LinkedHashSet<String> result = new LinkedHashSet<>();
            for (Object item : list) {
                if (!(item instanceof String string) || string.isBlank()) {
                    throw new IllegalArgumentException("JSON array contains a non-string value");
                }
                result.add(string);
            }
            return result;
        } catch (Exception exception) {
            throw ContentOperationException.unavailable("CONTENT_FACT_CORRUPT", failureMessage);
        }
    }

    static Timestamp timestamp(Instant value) {
        return value == null ? null : Timestamp.from(value);
    }

    static Instant instant(ResultSet resultSet, String column) throws SQLException {
        Timestamp value = resultSet.getTimestamp(column);
        return value == null ? null : value.toInstant();
    }
}
