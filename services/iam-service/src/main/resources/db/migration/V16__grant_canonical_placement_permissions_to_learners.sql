-- The canonical P1 placement API has five narrower permissions than the
-- compatibility assessment.session.* pair. Keep them distinct in IAM.
INSERT IGNORE INTO iam_permission (permission_id, permission_key) VALUES
  ('perm-p1-placement-create', 'assessment.placement.session.create'),
  ('perm-p1-placement-read', 'assessment.placement.session.read'),
  ('perm-p1-placement-submit', 'assessment.placement.response.submit'),
  ('perm-p1-placement-skip', 'assessment.placement.skip'),
  ('perm-p1-placement-report', 'assessment.placement.report.read');

INSERT IGNORE INTO iam_role_permission (role_id, permission_id)
  SELECT 'role-learner', permission_id FROM iam_permission
   WHERE permission_key IN (
     'assessment.placement.session.create',
     'assessment.placement.session.read',
     'assessment.placement.response.submit',
     'assessment.placement.skip',
     'assessment.placement.report.read');

-- Account permissions are the JWT source. Only existing active learner accounts
-- receive the new names. Token issuance still strips every assessment.* grant
-- until the server has verified the adult Gate and all required consents.
UPDATE iam_account
   SET permissions = CONCAT(permissions,
       IF(FIND_IN_SET('assessment.placement.session.create', permissions) = 0,
          ',assessment.placement.session.create', ''),
       IF(FIND_IN_SET('assessment.placement.session.read', permissions) = 0,
          ',assessment.placement.session.read', ''),
       IF(FIND_IN_SET('assessment.placement.response.submit', permissions) = 0,
          ',assessment.placement.response.submit', ''),
       IF(FIND_IN_SET('assessment.placement.skip', permissions) = 0,
          ',assessment.placement.skip', ''),
       IF(FIND_IN_SET('assessment.placement.report.read', permissions) = 0,
          ',assessment.placement.report.read', ''))
 WHERE status = 'ACTIVE' AND FIND_IN_SET('learner', roles) > 0;
