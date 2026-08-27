-- B30: the policy package used by IAM decisions must be a durable, queryable fact.
-- The policy document is delivered with the service; this row records its version and digest.
INSERT INTO iam_policy_version
    (policy_version, policy_type, status, policy_digest, published_at)
VALUES
    ('b30-rbac-v1', 'rbac', 'ACTIVE',
     SHA2('b30-rbac-v1:phase-1:default-deny:server-derived-tenant', 256),
     CURRENT_TIMESTAMP(6))
ON DUPLICATE KEY UPDATE
    status = 'ACTIVE',
    policy_digest = VALUES(policy_digest),
    published_at = COALESCE(published_at, VALUES(published_at));
