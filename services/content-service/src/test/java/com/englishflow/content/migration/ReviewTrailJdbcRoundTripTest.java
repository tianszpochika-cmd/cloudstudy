package com.englishflow.content.migration;

import com.englishflow.content.adapter.jdbc.JdbcContentItemRepository;
import com.englishflow.content.adapter.jdbc.JdbcContentReviewNotes;
import com.englishflow.content.adapter.jdbc.JdbcLexemeRepository;
import com.englishflow.content.domain.ContentItem;
import com.englishflow.content.domain.Lexeme;
import com.englishflow.content.domain.ReviewDecision;
import com.englishflow.content.domain.ReviewStage;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import tools.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** V31 round trip on real MySQL: review trail columns survive save/load for lexeme and item rows. */
@EnabledIfSystemProperty(named = "content.migration.integration", matches = "true")
class ReviewTrailJdbcRoundTripTest {

    @Test
    void trailColumnsRoundTrip() {
        String url = System.getenv("CONTENT_FLYWAY_TEST_ADMIN_URL");
        String user = System.getenv("CONTENT_FLYWAY_TEST_ADMIN_USER");
        String password = System.getenv("CONTENT_FLYWAY_TEST_ADMIN_PASSWORD");
        String schema = "content_trail_test_" + System.currentTimeMillis();
        JdbcTemplate admin = new JdbcTemplate(new DriverManagerDataSource(url, user, password));
        admin.execute("CREATE DATABASE " + schema + " CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
        try {
            String schemaUrl = url.replaceFirst("/\\?", "/" + schema + "?");
            DriverManagerDataSource dataSource = new DriverManagerDataSource(schemaUrl, user, password);
            Flyway.configure().dataSource(dataSource).locations("classpath:db/migration").load().migrate();
            JdbcTemplate jdbc = new JdbcTemplate(dataSource);
            ObjectMapper mapper = new ObjectMapper();
            Instant now = Instant.now().truncatedTo(ChronoUnit.MILLIS);

            JdbcLexemeRepository lexemes = new JdbcLexemeRepository(jdbc, mapper);
            Lexeme lexeme = Lexeme.create("lx_trail_1", "platform", "VOCAB-TRAIL", "habit", "en-US", "A2",
                    Map.of("headword", "habit"), "editor-1", now);
            lexeme.submit("editor-1", now);
            lexeme.reject(ReviewStage.FIRST_REVIEW, ReviewDecision.REJECTED, "reviewer-1", "缺少例句 \"quote\"", now);
            lexemes.save(lexeme);
            Lexeme loaded = lexemes.findById("lx_trail_1").orElseThrow();
            assertEquals("editor-1", loaded.trail().submittedBy());
            assertEquals("REJECTED_FIRST", loaded.trail().lastDecision());
            assertEquals("缺少例句 \"quote\"", loaded.trail().lastNote());
            assertEquals("reviewer-1", loaded.trail().lastReviewer());
            assertEquals(now, loaded.trail().lastReviewedAt());

            JdbcContentItemRepository items = new JdbcContentItemRepository(jdbc, mapper);
            ContentItem item = ContentItem.create("q_trail_1", "platform", "PACK-TRAIL", "QUESTION", "stem",
                    Map.of("options", List.of("a", "b"), "answerIndex", 0), null, null, "editor-1", now);
            item.submit("editor-1", now);
            item.reviewFirst("reviewer-1", now);
            item.reviewFinal("reviewer-2", now);
            item.publish("publisher-1", now);
            item.applyUpsert("stem v2", Map.of("options", List.of("a", "b"), "answerIndex", 1), "editor-2", now);
            items.save(item);
            ContentItem loadedItem = items.findById("q_trail_1").orElseThrow();
            assertTrue(loadedItem.trail().revisionOfLive());
            assertTrue(loadedItem.isLive());
            assertEquals("editor-1", loadedItem.trail().submittedBy());

            JdbcContentReviewNotes notes = new JdbcContentReviewNotes(jdbc);
            notes.record("pack-a", 25001L, 1, "FIRST_REVIEW", "REJECTED", "旧原因", "reviewer-1", now.minusSeconds(60));
            notes.record("pack-a", 25002L, 2, "FINAL_REVIEW", "CHANGES_REQUESTED", "新原因", "reviewer-2", now);
            Map<String, Object> latest = notes.latest("pack-a").orElseThrow();
            assertEquals("新原因", latest.get("note"));
            assertEquals(2, latest.get("versionNumber"));
            assertTrue(notes.latest("pack-missing").isEmpty());
        } finally {
            admin.execute("DROP DATABASE IF EXISTS " + schema);
        }
    }
}
