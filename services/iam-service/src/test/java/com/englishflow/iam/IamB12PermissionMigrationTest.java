package com.englishflow.iam;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class IamB12PermissionMigrationTest {
    private static final Set<String> B12_LEARNER_SCOPES = Set.of(
            "gamification.read.self",
            "gamification.ledger.read.self",
            "gamification.reward.read.self",
            "gamification.reward.claim.self",
            "gamification.game.read.self",
            "gamification.game.play.self",
            "social.room.read",
            "social.room.write.self",
            "social.focus.write.self",
            "social.interaction.write.self",
            "social.leaderboard.read",
            "social.visibility.write.self",
            "social.report.create.self",
            "social.report.read.self");

    @Test
    void backfillIsAdditiveIdempotentAndLimitedToActiveLearnerAccounts() throws IOException {
        String migration = migration();

        assertEquals(B12_LEARNER_SCOPES, permissionCatalogKeys(migration));
        assertTrue(migration.contains("INSERT IGNORE INTO iam_permission"));
        assertTrue(migration.contains("INSERT IGNORE INTO iam_role_permission"));
        assertTrue(migration.contains("SELECT 'role-learner', permission_id FROM iam_permission"));

        int rolePermissionsStart = migration.indexOf("WHERE permission_key IN (");
        int rolePermissionsEnd = migration.indexOf(");", rolePermissionsStart);
        assertTrue(rolePermissionsStart >= 0 && rolePermissionsEnd > rolePermissionsStart,
                "the learner role binding must enumerate its granted permission keys");
        assertEquals(B12_LEARNER_SCOPES, keys(migration.substring(rolePermissionsStart, rolePermissionsEnd),
                Pattern.compile("'([^']+)'")));

        Matcher update = Pattern.compile("UPDATE iam_account(?s:.*?)WHERE status = 'ACTIVE' AND FIND_IN_SET\\('learner', roles\\) > 0;")
                .matcher(migration);
        assertTrue(update.find(), "the account backfill must target active learner accounts only");
        String backfill = update.group();
        assertTrue(backfill.contains("CONCAT_WS(',',"), "existing permissions must be preserved while adding new scopes");
        assertEquals(B12_LEARNER_SCOPES, keys(backfill,
                Pattern.compile("IF\\(FIND_IN_SET\\('([^']+)', permissions\\) = 0, '([^']+)', NULL\\)"), true));
        assertTrue(migration.contains("gamification.* and social.* permission"),
                "the migration must document that pre-gate token issuance strips the gated scopes");
    }

    private static Set<String> keys(String source, Pattern pattern) {
        return keys(source, pattern, false);
    }

    private static Set<String> permissionCatalogKeys(String migration) {
        Matcher matcher = Pattern.compile("\\('(perm-b12-[^']+)',\\s*'([^']+)'\\)").matcher(migration);
        Set<String> result = new HashSet<>();
        while (matcher.find()) {
            assertTrue(matcher.group(1).length() <= 36, "permission ids must fit iam_permission.permission_id");
            result.add(matcher.group(2));
        }
        return result;
    }

    private static Set<String> keys(String source, Pattern pattern, boolean requireMatchingGroups) {
        Set<String> result = new HashSet<>();
        Matcher matcher = pattern.matcher(source);
        while (matcher.find()) {
            if (requireMatchingGroups) assertEquals(matcher.group(1), matcher.group(2));
            result.add(matcher.group(1));
        }
        return result;
    }

    private static String migration() throws IOException {
        try (InputStream input = IamB12PermissionMigrationTest.class.getResourceAsStream(
                "/db/migration/V17__grant_canonical_b12_learner_permissions.sql")) {
            assertNotNull(input, "V17 migration resource must be packaged for IAM tests");
            return new String(input.readAllBytes(), StandardCharsets.UTF_8);
        }
    }
}
