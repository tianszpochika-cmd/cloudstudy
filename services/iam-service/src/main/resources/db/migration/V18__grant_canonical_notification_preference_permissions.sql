-- P1R-M1-016 canonical self-owned notification preference scopes.
-- Preference fact ownership remains in notification-service; these scopes only
-- authorize the learner's own preference read/CAS write routes.
INSERT IGNORE INTO iam_permission (permission_id, permission_key) VALUES
  ('perm-m1-016-notif-pref-read', 'notification.preference.read.self'),
  ('perm-m1-016-notif-pref-write', 'notification.preference.write.self');

INSERT IGNORE INTO iam_role_permission (role_id, permission_id)
  SELECT 'role-learner', permission_id FROM iam_permission
   WHERE permission_key IN (
     'notification.preference.read.self',
     'notification.preference.write.self');

-- Account permissions are the JWT source. Grant only to existing active learner
-- accounts. Credential issuance strips all notification.* scopes until the
-- server-approved adult gate and required learning consent facts are present.
UPDATE iam_account
   SET permissions = CONCAT_WS(',',
       NULLIF(permissions, ''),
       IF(FIND_IN_SET('notification.preference.read.self', permissions) = 0,
          'notification.preference.read.self', NULL),
       IF(FIND_IN_SET('notification.preference.write.self', permissions) = 0,
          'notification.preference.write.self', NULL))
 WHERE status = 'ACTIVE' AND FIND_IN_SET('learner', roles) > 0;
