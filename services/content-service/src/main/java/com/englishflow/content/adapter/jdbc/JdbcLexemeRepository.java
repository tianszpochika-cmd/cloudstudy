package com.englishflow.content.adapter.jdbc;

import com.englishflow.content.domain.ContentOperationException;
import com.englishflow.content.domain.Lexeme;
import com.englishflow.content.domain.LexemeAvailability;
import com.englishflow.content.domain.LexemePronunciation;
import com.englishflow.content.port.LexemeRepository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;

import tools.jackson.databind.ObjectMapper;

/** Content-service-owned MySQL lexeme store. It never reads or writes another service schema. */
public final class JdbcLexemeRepository implements LexemeRepository {

    private static final String LEXEME_COLUMNS = """
            lexeme_id, tenant_id, pack_code, headword, language, cefr, availability, state_version,
            content_version, created_by, updated_by, first_reviewer, final_reviewer,
            publisher, fields_json, published_fields_json, created_at, updated_at
            """;

    private static final String PRON_COLUMNS = """
            pronunciation_id, lexeme_id, tenant_id, accent, ipa, audio_asset_id, source_type,
            voice_name, duration_ms, sample_rate, bitrate_kbps, qc_status, qc_by, qc_at, created_at
            """;

    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public JdbcLexemeRepository(JdbcTemplate jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    @Override
    public Optional<Lexeme> findById(String lexemeId) {
        List<Lexeme> rows = jdbc.query(
                "SELECT " + LEXEME_COLUMNS + " FROM lexeme WHERE lexeme_id = ?",
                (resultSet, row) -> mapLexeme(resultSet), lexemeId);
        return rows.stream().findFirst();
    }

    @Override
    public Optional<Lexeme> findByPackHeadword(String packCode, String headword) {
        List<Lexeme> rows = jdbc.query(
                "SELECT " + LEXEME_COLUMNS + " FROM lexeme WHERE tenant_id = 'platform' AND pack_code = ? AND headword = ?",
                (resultSet, row) -> mapLexeme(resultSet), packCode, headword);
        return rows.stream().findFirst();
    }

    @Override
    public List<Lexeme> search(String packCode, String query, String cefr, LexemeAvailability availability,
            String language, int limit, String afterLexemeId) {
        StringBuilder sql = new StringBuilder("SELECT ").append(LEXEME_COLUMNS)
                .append(" FROM lexeme WHERE tenant_id = 'platform' AND pack_code = ?");
        List<Object> args = new ArrayList<>();
        args.add(packCode);
        if (query != null && !query.isBlank()) {
            sql.append(" AND headword LIKE ?");
            args.add("%" + query.trim() + "%");
        }
        if (cefr != null && !cefr.isBlank()) {
            sql.append(" AND cefr = ?");
            args.add(cefr.trim().toUpperCase());
        }
        if (availability != null) {
            sql.append(" AND availability = ?");
            args.add(availability.name());
        }
        if (language != null && !language.isBlank()) {
            sql.append(" AND language = ?");
            args.add(language.trim());
        }
        if (afterLexemeId != null && !afterLexemeId.isBlank()) {
            sql.append(" AND lexeme_id > ?");
            args.add(afterLexemeId);
        }
        sql.append(" ORDER BY headword, lexeme_id LIMIT ?");
        args.add(Math.max(1, Math.min(limit, 100)));
        return jdbc.query(sql.toString(), (resultSet, row) -> mapLexeme(resultSet), args.toArray());
    }

    @Override
    public void save(Lexeme lexeme) {
        String fieldsJson = JdbcContentJson.write(mapper, lexeme.fields(), "lexeme fields cannot be serialized");
        String publishedJson = lexeme.publishedFields() == null
                ? null
                : JdbcContentJson.write(mapper, lexeme.publishedFields(), "lexeme snapshot cannot be serialized");
        try {
            jdbc.update("""
                    INSERT INTO lexeme
                        (lexeme_id, tenant_id, pack_code, headword, language, cefr, availability, state_version,
                         content_version, created_by, updated_by, first_reviewer, final_reviewer,
                         publisher, fields_json, published_fields_json, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE tenant_id = VALUES(tenant_id), pack_code = VALUES(pack_code),
                        headword = VALUES(headword), language = VALUES(language), cefr = VALUES(cefr), availability = VALUES(availability),
                        state_version = VALUES(state_version), content_version = VALUES(content_version),
                        created_by = VALUES(created_by), updated_by = VALUES(updated_by),
                        first_reviewer = VALUES(first_reviewer), final_reviewer = VALUES(final_reviewer),
                        publisher = VALUES(publisher), fields_json = VALUES(fields_json),
                        published_fields_json = VALUES(published_fields_json),
                        created_at = VALUES(created_at), updated_at = VALUES(updated_at)
                    """,
                    lexeme.lexemeId(), lexeme.tenantId(), lexeme.packCode(), lexeme.headword(), lexeme.language(), lexeme.cefr(),
                    lexeme.availability().name(), lexeme.stateVersion(), lexeme.contentVersion(),
                    lexeme.createdBy(), lexeme.updatedBy(), lexeme.firstReviewer(), lexeme.finalReviewer(),
                    lexeme.publisher(), fieldsJson, publishedJson,
                    JdbcContentJson.timestamp(lexeme.createdAt()), JdbcContentJson.timestamp(lexeme.updatedAt()));
        } catch (DuplicateKeyException error) {
            throw ContentOperationException.conflict("LEXEME_DUPLICATE",
                    "a lexeme with this pack and headword already exists");
        }
    }

    @Override
    public List<LexemePronunciation> listPronunciations(String lexemeId) {
        return jdbc.query(
                "SELECT " + PRON_COLUMNS + " FROM lexeme_pronunciation WHERE lexeme_id = ? ORDER BY accent, pronunciation_id",
                (resultSet, row) -> mapPronunciation(resultSet), lexemeId);
    }

    @Override
    public void savePronunciation(LexemePronunciation pronunciation) {
        jdbc.update("""
                INSERT INTO lexeme_pronunciation
                    (pronunciation_id, lexeme_id, tenant_id, accent, ipa, audio_asset_id, source_type,
                     voice_name, duration_ms, sample_rate, bitrate_kbps, qc_status, qc_by, qc_at, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE lexeme_id = VALUES(lexeme_id), tenant_id = VALUES(tenant_id),
                    accent = VALUES(accent), ipa = VALUES(ipa), audio_asset_id = VALUES(audio_asset_id),
                    source_type = VALUES(source_type), voice_name = VALUES(voice_name),
                    duration_ms = VALUES(duration_ms), sample_rate = VALUES(sample_rate),
                    bitrate_kbps = VALUES(bitrate_kbps), qc_status = VALUES(qc_status),
                    qc_by = VALUES(qc_by), qc_at = VALUES(qc_at), created_at = VALUES(created_at)
                """,
                pronunciation.pronunciationId(), pronunciation.lexemeId(), pronunciation.tenantId(),
                pronunciation.accent(), pronunciation.ipa(), pronunciation.audioAssetId(),
                pronunciation.sourceType(), pronunciation.voiceName(), pronunciation.durationMs(),
                pronunciation.sampleRate(), pronunciation.bitrateKbps(), pronunciation.qcStatus(),
                pronunciation.qcBy(), JdbcContentJson.timestamp(pronunciation.qcAt()),
                JdbcContentJson.timestamp(pronunciation.createdAt()));
    }

    private Lexeme mapLexeme(ResultSet resultSet) throws SQLException {
        Map<String, Object> fields = readFields(resultSet.getString("fields_json"));
        Map<String, Object> published = readNullableFields(resultSet.getString("published_fields_json"));
        String language = resultSet.getString("language");
        return new Lexeme(
                resultSet.getString("lexeme_id"), resultSet.getString("tenant_id"),
                resultSet.getString("pack_code"), resultSet.getString("headword"),
                language == null || language.isBlank() ? Lexeme.DEFAULT_LANGUAGE : language.trim(),
                resultSet.getString("cefr"), LexemeAvailability.parse(resultSet.getString("availability")),
                resultSet.getLong("state_version"), resultSet.getInt("content_version"),
                resultSet.getString("created_by"), resultSet.getString("updated_by"),
                resultSet.getString("first_reviewer"), resultSet.getString("final_reviewer"),
                resultSet.getString("publisher"), fields, published,
                JdbcContentJson.instant(resultSet, "created_at"), JdbcContentJson.instant(resultSet, "updated_at"));
    }

    private LexemePronunciation mapPronunciation(ResultSet resultSet) throws SQLException {
        return new LexemePronunciation(
                resultSet.getString("pronunciation_id"), resultSet.getString("lexeme_id"),
                resultSet.getString("tenant_id"), resultSet.getString("accent"), resultSet.getString("ipa"),
                resultSet.getString("audio_asset_id"), resultSet.getString("source_type"),
                resultSet.getString("voice_name"),
                resultSet.getObject("duration_ms") == null ? null : resultSet.getInt("duration_ms"),
                resultSet.getObject("sample_rate") == null ? null : resultSet.getInt("sample_rate"),
                resultSet.getObject("bitrate_kbps") == null ? null : resultSet.getInt("bitrate_kbps"),
                resultSet.getString("qc_status"), resultSet.getString("qc_by"),
                JdbcContentJson.instant(resultSet, "qc_at"), JdbcContentJson.instant(resultSet, "created_at"));
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> readNullableFields(String json) {
        if (json == null || json.isBlank()) {
            return null;
        }
        try {
            Object value = mapper.readValue(json, Map.class);
            if (value instanceof Map<?, ?> map) {
                Map<String, Object> result = new LinkedHashMap<>();
                for (Map.Entry<?, ?> entry : map.entrySet()) {
                    result.put(String.valueOf(entry.getKey()), entry.getValue());
                }
                return result;
            }
            throw new IllegalArgumentException("lexeme snapshot JSON is not an object");
        } catch (Exception exception) {
            throw ContentOperationException.unavailable("LEXEME_FACT_CORRUPT", "stored lexeme snapshot cannot be read");
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> readFields(String json) {
        if (json == null || json.isBlank()) {
            return Map.of();
        }
        try {
            Object value = mapper.readValue(json, Map.class);
            if (value instanceof Map<?, ?> map) {
                Map<String, Object> result = new LinkedHashMap<>();
                for (Map.Entry<?, ?> entry : map.entrySet()) {
                    result.put(String.valueOf(entry.getKey()), entry.getValue());
                }
                return result;
            }
            throw new IllegalArgumentException("lexeme fields JSON is not an object");
        } catch (Exception exception) {
            throw ContentOperationException.unavailable("LEXEME_FACT_CORRUPT", "stored lexeme fields cannot be read");
        }
    }
}
