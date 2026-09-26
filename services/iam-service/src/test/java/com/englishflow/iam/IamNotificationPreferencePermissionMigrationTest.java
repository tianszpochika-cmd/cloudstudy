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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class IamNotificationPreferencePermissionMigrationTest {
    private static final Set<String> PREFERENCE_SCOPES = Set.of(
            "notification.preference.read.self",
            "notification.preference.write.self");

    @Test
    void migrationAddsOnlyCanonicalLearnerPreferenceScopesIdempotently() throws IOException {
        String migration = migration();

        assertEquals(PREFERENCE_SCOPES, permissionCatalogKeys(migration));
        assertTrue(migration.contains("INSERT IGNORE INTO iam_permission"));
        assertTrue(migration.contains("INSERT IGNORE INTO iam_role_permission"));
        assertTrue(migration.contains("SELECT 'role-learner', permission_id FROM iam_permission"));
        assertTrue(migration.contains("WHERE permission_key IN ("));

        int rolePermissionsStart = migration.indexOf("WHERE permission_key IN (");
        int rolePermissionsEnd = migration.indexOf(");", rolePermissionsStart);
        assertTrue(rolePermissionsStart >= 0 && rolePermissionsEnd > rolePermissionsStart,
                "role binding must enumerate only the two self-owned learner preference scopes");
        assertEquals(PREFERENCE_SCOPES, keys(migration.substring(rolePermissionsStart, rolePermissionsEnd),
                Pattern.compile("'([^']+)'")));
        assertFalse(migration.contains("role-admin"), "staff roles must not receive these learner scopes");
        assertFalse(migration.contains("notification.preference.trusted-event"),
                "trusted-event permissions must remain workload-only");

        Matcher update = Pattern.compile("UPDATE iam_account(?s:.*?)WHERE status = 'ACTIVE' AND FIND_IN_SET\\('learner', roles\\) > 0;")
                .matcher(migration);
        assertTrue(update.find(), "the account backfill must target active learner accounts only");
        String backfill = update.group();
        assertTrue(backfill.contains("CONCAT_WS(',',"), "existing account permissions must be preserved");
        assertEquals(PREFERENCE_SCOPES, keys(backfill,
                Pattern.compile("IF\\(FIND_IN_SET\\('([^']+)', permissions\\) = 0,\\s*'([^']+)', NULL\\)"), true));
        assertTrue(migration.contains("strips all notification.* scopes"),
                "pre-gate token issuance must remain fail closed for notification permissions");
    }

    private static Set<String> permissionCatalogKeys(String migration) {
        Matcher matcher = Pattern.compile("\\('(perm-m1-016-notif-pref-[^']+)',\\s*'([^']+)'\\)").matcher(migration);
        Set<String> result = new HashSet<>();
        while (matcher.find()) {
            assertTrue(matcher.group(1).length() <= 36, "permission ids must fit iam_permission.permission_id");
            result.add(matcher.group(2));
        }
        return result;
    }

    private static Set<String> keys(String source, Pattern pattern) {
        return keys(source, pattern, false);
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
        try (InputStream input = IamNotificationPreferencePermissionMigrationTest.class.getResourceAsStream(
                "/db/migration/V18__grant_canonical_notification_preference_permissions.sql")) {
            assertNotNull(input, "V18 migration resource must be packaged for IAM tests");
            return new String(input.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

}
