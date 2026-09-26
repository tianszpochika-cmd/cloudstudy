-- Add only the learner-facing scopes from the frozen P1R-M1-014 route policy.
-- The two internal trusted-event permissions are workload authority and are excluded.
INSERT IGNORE INTO iam_permission (permission_id, permission_key) VALUES
  ('perm-b12-gam-read', 'gamification.read.self'),
  ('perm-b12-gam-ledger-read', 'gamification.ledger.read.self'),
  ('perm-b12-gam-reward-read', 'gamification.reward.read.self'),
  ('perm-b12-gam-reward-claim', 'gamification.reward.claim.self'),
  ('perm-b12-soc-room-write', 'social.room.write.self'),
  ('perm-b12-soc-focus-write', 'social.focus.write.self'),
  ('perm-b12-soc-interaction-write', 'social.interaction.write.self'),
  ('perm-b12-soc-leaderboard-read', 'social.leaderboard.read'),
  ('perm-b12-soc-visibility-write', 'social.visibility.write.self'),
  ('perm-b12-soc-report-create', 'social.report.create.self'),
  ('perm-b12-soc-report-read', 'social.report.read.self'),
  ('perm-b12-gam-game-read', 'gamification.game.read.self'),
  ('perm-b12-gam-game-play', 'gamification.game.play.self'),
  ('perm-b12-soc-room-read', 'social.room.read');

INSERT IGNORE INTO iam_role_permission (role_id, permission_id)
  SELECT 'role-learner', permission_id FROM iam_permission
   WHERE permission_key IN (
     'gamification.read.self',
     'gamification.ledger.read.self',
     'gamification.reward.read.self',
     'gamification.reward.claim.self',
     'social.room.write.self',
     'social.focus.write.self',
     'social.interaction.write.self',
     'social.leaderboard.read',
     'social.visibility.write.self',
     'social.report.create.self',
     'social.report.read.self',
     'gamification.game.read.self',
     'gamification.game.play.self',
     'social.room.read');

-- Existing active learner accounts are the persisted JWT permission source.
-- These scopes are only effective in a newly issued token after the controller has
-- verified the adult Gate and all required consent facts; pre-gate issuance strips
-- every gamification.* and social.* permission.
UPDATE iam_account
   SET permissions = CONCAT_WS(',',
       NULLIF(permissions, ''),
       IF(FIND_IN_SET('gamification.read.self', permissions) = 0, 'gamification.read.self', NULL),
       IF(FIND_IN_SET('gamification.ledger.read.self', permissions) = 0, 'gamification.ledger.read.self', NULL),
       IF(FIND_IN_SET('gamification.reward.read.self', permissions) = 0, 'gamification.reward.read.self', NULL),
       IF(FIND_IN_SET('gamification.reward.claim.self', permissions) = 0, 'gamification.reward.claim.self', NULL),
       IF(FIND_IN_SET('social.room.write.self', permissions) = 0, 'social.room.write.self', NULL),
       IF(FIND_IN_SET('social.focus.write.self', permissions) = 0, 'social.focus.write.self', NULL),
       IF(FIND_IN_SET('social.interaction.write.self', permissions) = 0, 'social.interaction.write.self', NULL),
       IF(FIND_IN_SET('social.leaderboard.read', permissions) = 0, 'social.leaderboard.read', NULL),
       IF(FIND_IN_SET('social.visibility.write.self', permissions) = 0, 'social.visibility.write.self', NULL),
       IF(FIND_IN_SET('social.report.create.self', permissions) = 0, 'social.report.create.self', NULL),
       IF(FIND_IN_SET('social.report.read.self', permissions) = 0, 'social.report.read.self', NULL),
       IF(FIND_IN_SET('gamification.game.read.self', permissions) = 0, 'gamification.game.read.self', NULL),
       IF(FIND_IN_SET('gamification.game.play.self', permissions) = 0, 'gamification.game.play.self', NULL),
       IF(FIND_IN_SET('social.room.read', permissions) = 0, 'social.room.read', NULL))
 WHERE status = 'ACTIVE' AND FIND_IN_SET('learner', roles) > 0;
