import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertIamLifecycleSchema,
  assertIamLifecycleUser,
  databaseGrantScope,
  parseArgs,
  validateRunApproval,
  validateCookie,
  parseCookieValue,
  extractDeviceList,
  evaluateSingleCurrentDevice,
  evaluateR1003Assertions,
  evaluateR1004Assertions,
  evaluateR1005Assertions,
  evaluateR1006Assertions,
  evaluateR1008Assertions,
  redactSecrets,
  generateCleanupPlan,
} from './assertions.mjs';
import { inspectMode } from './iam-lifecycle-runtime.mjs';

test('Schema and user name scope validation prevents SQL injection and cross-boundary access', () => {
  const validSchema = 'r1_iam_lifecycle_20261009_aabbccddeeff';
  assert.equal(assertIamLifecycleSchema(validSchema), validSchema);

  const validUser = 'r1_iam_aabbccddeeff';
  assert.equal(assertIamLifecycleUser(validUser), validUser);

  for (const badSchema of [
    'iam_service',
    'r1_002_20261008_aabbccddeeff',
    'r1_iam_lifecycle_20261009_bad;DROP DATABASE iam_service',
    'r1_iam_lifecycle_2026100_aabbccddeeff',
    '',
    null,
    undefined,
  ]) {
    assert.throws(() => assertIamLifecycleSchema(badSchema), /SCHEMA_SCOPE_INVALID/);
  }

  for (const badUser of [
    'root',
    'r1002_aabbccddeeff',
    'r1_iam_toolong1234567890123456',
    'r1_iam_user;DROP USER',
    '',
    null,
    undefined,
  ]) {
    assert.throws(() => assertIamLifecycleUser(badUser), /USER_SCOPE_INVALID/);
  }
});

test('Database grant scope correctly applies MySQL partial_revokes escaping', () => {
  const schema = 'r1_iam_lifecycle_20261009_aabbccddeeff';
  assert.equal(
    databaseGrantScope(schema, false),
    '`r1\\_iam\\_lifecycle\\_20261009\\_aabbccddeeff`.*'
  );
  assert.equal(databaseGrantScope(schema, true), '`' + schema + '`.*');

  assert.throws(() => databaseGrantScope('iam_service', false), /SCHEMA_SCOPE_INVALID/);
  assert.throws(() => databaseGrantScope(schema, 'true'), /GRANT_SCOPE/);
});

test('CLI argument parser handles modes and options with strict validation', () => {
  assert.deepEqual(parseArgs([]), { mode: 'inspect' });
  assert.deepEqual(parseArgs(['inspect']), { mode: 'inspect' });
  assert.deepEqual(
    parseArgs(['prepare', '--private-parent', '/tmp/external']),
    { mode: 'prepare', privateParent: '/tmp/external' }
  );
  assert.deepEqual(
    parseArgs(['run', '--config-dir', '/tmp/cfg', '--approval', '/tmp/app.json']),
    { mode: 'run', configDir: '/tmp/cfg', approvalPath: '/tmp/app.json' }
  );
  assert.deepEqual(
    parseArgs(['cleanup-plan', '--config-dir', '/tmp/cfg']),
    { mode: 'cleanup-plan', configDir: '/tmp/cfg' }
  );

  assert.throws(() => parseArgs(['unknown-mode']), /MODE_SCOPE_INVALID/);
  assert.throws(() => parseArgs(['--unknown-flag', 'value']), /ARGUMENT_INVALID/);
  assert.throws(() => parseArgs(['--config-dir', '/a', '--config-dir', '/b']), /ARGUMENT_DUPLICATE/);
});

test('Default inspect mode is strictly read-only with zero process or database actions', () => {
  const report = inspectMode();
  assert.equal(report.kind, 'R1_IAM_LIFECYCLE_INSPECT_REPORT');
  assert.equal(report.mode, 'inspect');
  assert.equal(report.readOnlyAudit, true);
  assert.equal(report.processesStarted, 0);
  assert.equal(report.databaseWrites, 0);
  assert.equal(report.dockerCommandsExecuted, 0);
  assert.equal(report.networkRequestsSent, 0);
  assert.equal(report.fixedPorts.iamPort, 18087);
  assert.equal(report.targetContainerAllowlist, 'yuxuexing-local-mysql-1');
  assert.ok(report.scriptProvenance.sha256);
});

test('Run approval validation enforces exact binding and rejects tampering', () => {
  const validApproval = {
    kind: 'ROOT_APPROVED_R1_IAM_LIFECYCLE_RUNTIME',
    scriptSha256: 'valid-sha-12345',
    schema: 'r1_iam_lifecycle_20261009_112233445566',
    mysqlId: 'mysql-container-id-abc',
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
  };

  const context = {
    scriptSha256: 'valid-sha-12345',
    schema: 'r1_iam_lifecycle_20261009_112233445566',
    mysqlId: 'mysql-container-id-abc',
  };

  const result = validateRunApproval(validApproval, context);
  assert.equal(result.valid, true);

  assert.throws(
    () => validateRunApproval({ ...validApproval, kind: 'OTHER' }, context),
    /APPROVAL_KIND_MISMATCH/
  );
  assert.throws(
    () => validateRunApproval({ ...validApproval, scriptSha256: 'tampered' }, context),
    /APPROVAL_SCRIPT_MISMATCH/
  );
  assert.throws(
    () => validateRunApproval({ ...validApproval, schema: 'other_schema' }, context),
    /APPROVAL_SCHEMA_MISMATCH/
  );
  assert.throws(
    () => validateRunApproval({ ...validApproval, mysqlId: 'foreign_mysql' }, context),
    /APPROVAL_MYSQL_ID_MISMATCH/
  );
  assert.throws(
    () => validateRunApproval(
      { ...validApproval, expiresAt: new Date(Date.now() - 1000).toISOString() },
      context
    ),
    /APPROVAL_EXPIRED/
  );
  assert.throws(() => validateRunApproval(null, context), /APPROVAL_INVALID/);
});

test('Cookie verification requires all security attributes and forbids body refreshToken', () => {
  const secureCookie = 'yuxuexing_refresh=synthetic-token-123; Path=/api/v1/auth; Max-Age=3600; HttpOnly; Secure; SameSite=Lax';
  const parsed = validateCookie(secureCookie, { data: {} });
  assert.equal(parsed.name, 'yuxuexing_refresh');
  assert.equal(parsed.httpOnly, true);
  assert.equal(parsed.secure, true);
  assert.equal(parsed.sameSite, 'Lax');

  assert.equal(parseCookieValue(secureCookie), 'synthetic-token-123');

  // Missing security attributes fail
  for (const attribute of ['; Path=/api/v1/auth', '; Max-Age=3600', '; HttpOnly', '; Secure', '; SameSite=Lax']) {
    assert.throws(
      () => validateCookie(secureCookie.replace(attribute, ''), { data: {} }),
      /COOKIE_SECURITY/
    );
  }

  // Body containing plaintext refreshToken fails
  assert.throws(
    () => validateCookie(secureCookie, { data: { refreshToken: 'leaked-token' } }),
    /COOKIE_SECURITY/
  );
});

test('Device list normalization and single isCurrent=true assertion logic', () => {
  const devices = [
    { deviceId: 'dev-A', deviceType: 'WEB', isCurrent: true },
    { deviceId: 'dev-B', deviceType: 'WEB', isCurrent: false },
  ];

  assert.deepEqual(extractDeviceList({ data: { devices } }), devices);
  assert.deepEqual(extractDeviceList({ data: devices }), devices);

  const evalA = evaluateSingleCurrentDevice(devices, 'dev-A');
  assert.equal(evalA.singleCurrent, true);
  assert.equal(evalA.matchedExpected, true);
  assert.equal(evalA.currentDeviceId, 'dev-A');

  const evalB = evaluateSingleCurrentDevice(devices, 'dev-B');
  assert.equal(evalB.singleCurrent, true);
  assert.equal(evalB.matchedExpected, false);

  // Both current = false -> singleCurrent is false
  const evalNone = evaluateSingleCurrentDevice([
    { deviceId: 'dev-A', isCurrent: false },
    { deviceId: 'dev-B', isCurrent: false },
  ], 'dev-A');
  assert.equal(evalNone.singleCurrent, false);
  assert.equal(evalNone.count, 0);

  // Both current = true -> singleCurrent is false
  const evalBoth = evaluateSingleCurrentDevice([
    { deviceId: 'dev-A', isCurrent: true },
    { deviceId: 'dev-B', isCurrent: true },
  ], 'dev-A');
  assert.equal(evalBoth.singleCurrent, false);
  assert.equal(evalBoth.count, 2);
});

test('R1-003 assertion evaluation checks first registration, idempotency replay, conflict and missing key', () => {
  const cleanBefore = { principals: 0, accounts: 0, sessions: 0, devices: 0, audits: 0, completedIdempotency: 0 };
  const afterFirst = { principals: 1, accounts: 1, sessions: 1, devices: 1, audits: 3, completedIdempotency: 1 };
  const afterReplay = { principals: 1, accounts: 1, sessions: 1, devices: 1, audits: 3, completedIdempotency: 1 };
  const afterConflict = { principals: 1, accounts: 1, sessions: 1, devices: 1, audits: 4, completedIdempotency: 1 };

  const firstReg = { status: 201, body: { data: { sessionId: 'sess-1', deviceId: 'dev-1', accessToken: 'token-1' } } };
  const replayReg = { status: 201, body: { data: { sessionId: 'sess-1', deviceId: 'dev-1', accessToken: 'token-replay' } } };
  const conflictReg = { status: 409, body: { error: { code: 'IDEMPOTENCY_CONFLICT' } } };
  const missingKeyReg = { status: 400, body: { error: { code: 'VALIDATION_ERROR' } } };

  const positive = evaluateR1003Assertions({
    firstRegistration: firstReg,
    replayRegistration: replayReg,
    conflictRegistration: conflictReg,
    missingKeyRegistration: missingKeyReg,
    dbCountsBefore: cleanBefore,
    dbCountsAfterFirst: afterFirst,
    dbCountsAfterReplay: afterReplay,
    dbCountsAfterConflict: afterConflict,
  });

  assert.equal(positive.passed, true);
  assert.equal(positive.card, 'R1-003');
  assert.equal(positive.chain, 'BC-003');
  assert.equal(positive.assertions.replayNoSecondAccount, true);
  assert.equal(positive.assertions.conflictRejected, true);
  assert.equal(positive.assertions.missingKeyRejected, true);

  // Negative: replay created second account
  const negativeAccounts = evaluateR1003Assertions({
    firstRegistration: firstReg,
    replayRegistration: replayReg,
    conflictRegistration: conflictReg,
    missingKeyRegistration: missingKeyReg,
    dbCountsBefore: cleanBefore,
    dbCountsAfterFirst: afterFirst,
    dbCountsAfterReplay: { ...afterReplay, accounts: 2 },
    dbCountsAfterConflict: afterConflict,
  });
  assert.equal(negativeAccounts.passed, false);
  assert.equal(negativeAccounts.assertions.replayNoSecondAccount, false);

  // Negative: conflict was not rejected
  const negativeConflict = evaluateR1003Assertions({
    firstRegistration: firstReg,
    replayRegistration: replayReg,
    conflictRegistration: { status: 200, body: {} },
    missingKeyRegistration: missingKeyReg,
    dbCountsBefore: cleanBefore,
    dbCountsAfterFirst: afterFirst,
    dbCountsAfterReplay: afterReplay,
    dbCountsAfterConflict: afterConflict,
  });
  assert.equal(negativeConflict.passed, false);
  assert.equal(negativeConflict.assertions.conflictRejected, false);
});

test('R1-004 assertion evaluation checks login, rotation, old refresh replay rejection, logout and revocation', () => {
  const reg = { status: 201, body: { data: { sessionId: 'sess-4' } } };
  const login = {
    status: 200,
    rawRefreshToken: 'refresh-token-v1',
    body: { data: { sessionId: 'sess-4', accessToken: 'access-v1' } }
  };
  const refresh = {
    status: 200,
    rawRefreshToken: 'refresh-token-v2',
    cookieSecurity: { secure: true, httpOnly: true, sameSite: 'Lax' },
    body: { data: { sessionId: 'sess-4', accessToken: 'access-v2' } }
  };
  const refreshReplay = { status: 401, body: { error: { code: 'AUTH_REFRESH_REUSE_DETECTED' } } };
  const relogin = {
    status: 200,
    rawRefreshToken: 'refresh-token-v3',
    body: { data: { sessionId: 'sess-4-new', accessToken: 'access-v3' } }
  };
  const logout = { status: 200, body: { data: { sessionId: 'sess-4-new', status: 'REVOKED' } } };
  const postLogoutAccess = { status: 401 };
  const postLogoutRefresh = { status: 401 };

  const positive = evaluateR1004Assertions({
    registration: reg,
    login,
    refresh,
    refreshReplay,
    relogin,
    logout,
    postLogoutAccess,
    postLogoutRefresh,
    sessionStatusAfterReplay: 'REVOKED',
    sessionStatusAfterLogout: 'REVOKED',
  });

  assert.equal(positive.passed, true);
  assert.equal(positive.card, 'R1-004');
  assert.equal(positive.chain, 'BC-004');
  assert.equal(positive.assertions.refreshRotatedNewTokenDifferent, true);
  assert.equal(positive.assertions.replayOldRefreshRejected, true);
  assert.equal(positive.assertions.replayOldRefreshSessionRevoked, true);
  assert.equal(positive.assertions.postLogoutAccessRejected401, true);
  assert.equal(positive.assertions.postLogoutRefreshRejected401, true);

  // Negative: old refresh replay allowed
  const negativeReplay = evaluateR1004Assertions({
    registration: reg,
    login,
    refresh,
    refreshReplay: { status: 200 },
    relogin,
    logout,
    postLogoutAccess,
    postLogoutRefresh,
    sessionStatusAfterReplay: 'ACTIVE',
    sessionStatusAfterLogout: 'REVOKED',
  });
  assert.equal(negativeReplay.passed, false);
  assert.equal(negativeReplay.assertions.replayOldRefreshRejected, false);
});

test('R1-005 assertion evaluation checks device listing, current device detection, kickout and token invalidation', () => {
  const loginA = { status: 200, deviceId: 'dev-A', body: { data: { accessToken: 'token-A', sessionId: 'sess-A' } } };
  const loginB = { status: 200, deviceId: 'dev-B', body: { data: { accessToken: 'token-B', sessionId: 'sess-B' } } };

  const devicesFromA = {
    status: 200,
    body: {
      data: {
        devices: [
          { deviceId: 'dev-A', deviceType: 'WEB', status: 'ACTIVE', isCurrent: true },
          { deviceId: 'dev-B', deviceType: 'WEB', status: 'ACTIVE', isCurrent: false },
        ]
      }
    }
  };

  const devicesFromB = {
    status: 200,
    body: {
      data: {
        devices: [
          { deviceId: 'dev-A', deviceType: 'WEB', status: 'ACTIVE', isCurrent: false },
          { deviceId: 'dev-B', deviceType: 'WEB', status: 'ACTIVE', isCurrent: true },
        ]
      }
    }
  };

  const kickoutResult = { status: 200, body: { data: { sessionId: 'sess-B', status: 'REVOKED' } } };
  const accessBAfterKickout = { status: 401 };
  const refreshBAfterKickout = { status: 401 };
  const accessAAfterKickout = { status: 200 };

  const positive = evaluateR1005Assertions({
    loginA,
    loginB,
    devicesFromA,
    devicesFromB,
    kickoutResult,
    accessBAfterKickout,
    refreshBAfterKickout,
    accessAAfterKickout,
    sessionStatusA: 'ACTIVE',
    sessionStatusB: 'REVOKED',
  });

  assert.equal(positive.passed, true);
  assert.equal(positive.card, 'R1-005');
  assert.equal(positive.chain, 'BC-005');
  assert.equal(positive.assertions.devicesFromAHasSingleCurrent, true);
  assert.equal(positive.assertions.devicesFromAIsCurrentDeviceIdA, true);
  assert.equal(positive.assertions.devicesFromBHasSingleCurrent, true);
  assert.equal(positive.assertions.devicesFromBIsCurrentDeviceIdB, true);
  assert.equal(positive.assertions.kickedDeviceAccessRejected401, true);
  assert.equal(positive.assertions.kickedDeviceRefreshRejected401, true);
  assert.equal(positive.assertions.deviceARemainsValid200, true);
  assert.equal(positive.assertions.sessionStatusBRevoked, true);

  // Negative: kicked device B still access 200
  const negativeKick = evaluateR1005Assertions({
    loginA,
    loginB,
    devicesFromA,
    devicesFromB,
    kickoutResult,
    accessBAfterKickout: { status: 200 },
    refreshBAfterKickout,
    accessAAfterKickout,
    sessionStatusA: 'ACTIVE',
    sessionStatusB: 'REVOKED',
  });
  assert.equal(negativeKick.passed, false);
  assert.equal(negativeKick.assertions.kickedDeviceAccessRejected401, false);
});

test('Privacy redactor strips credentials, tokens, and sanitizes material directories', () => {
  const sensitiveData = {
    user: 'r1_iam_user1',
    password: 'super-secret-password',
    refreshToken: 'raw-refresh-token',
    accessToken: 'raw-access-token',
    authorization: 'Bearer secret-jwt',
    cookie: 'yuxuexing_refresh=secret',
    filePath: '/tmp/material/r1-iam-lifecycle-20261009-xyz/iam-server.p12',
    nested: {
      status: 200,
      privateKey: 'BEGIN RSA PRIVATE KEY',
      mysql_root_password: 'rootpassword',
    },
  };

  const sanitized = redactSecrets(sensitiveData, ['/tmp/material/r1-iam-lifecycle-20261009-xyz']);
  assert.equal(sanitized.password, '<REDACTED_SECRET>');
  assert.equal(sanitized.refreshToken, '<REDACTED_SECRET>');
  assert.equal(sanitized.accessToken, '<REDACTED_SECRET>');
  assert.equal(sanitized.authorization, '<REDACTED_SECRET>');
  assert.equal(sanitized.cookie, '<REDACTED_SECRET>');
  assert.equal(sanitized.nested.privateKey, '<REDACTED_SECRET>');
  assert.equal(sanitized.nested.mysql_root_password, '<REDACTED_SECRET>');
  assert.equal(sanitized.filePath, '<PRIVATE_MATERIAL_DIR>/iam-server.p12');
  assert.equal(sanitized.user, 'r1_iam_user1');
  assert.equal(sanitized.nested.status, 200);
});

test('Cleanup plan mode generates non-destructive SQL statements with warnings', () => {
  const plan = generateCleanupPlan(
    'r1_iam_lifecycle_20261009_aabbccddeeff',
    'r1_iam_aabbccddeeff'
  );

  assert.equal(plan.kind, 'R1_IAM_LIFECYCLE_CLEANUP_PLAN');
  assert.equal(plan.executed, false);
  assert.equal(plan.sqlStatements.length, 2);
  assert.ok(plan.sqlStatements[0].includes('DROP USER IF EXISTS \'r1_iam_aabbccddeeff\'@\'%\''));
  assert.ok(plan.sqlStatements[1].includes('DROP DATABASE IF EXISTS r1_iam_lifecycle_20261009_aabbccddeeff'));
  assert.ok(plan.warning.includes('Automatic DROP execution is disabled'));
});

test('R1-006 assertion evaluation checks adult and minor paths, DB facts, audits, replays, and boundary rejections', () => {
  const basePositive = {
    adultSubmit: {
      status: 200,
      body: {
        data: {
          status: 'PASSED',
          learningAccess: 'ELIGIBLE',
          evidenceStatus: 'SERVER_VERIFIED',
        },
      },
    },
    adultPrincipalFact: {
      principalId: 'p-adult-1',
      adultGateStatus: 'APPROVED',
      adultVerifiedAt: '2026-10-09T10:00:00.000Z',
      status: 'ACTIVE',
    },
    adultAuditFact: {
      decision: 'ALLOW',
      reasonCode: 'adult_gate_allowed',
    },
    adultReplay: {
      status: 200,
      body: {
        data: {
          status: 'PASSED',
          learningAccess: 'ELIGIBLE',
        },
      },
    },
    minorSubmit: {
      status: 200,
      body: {
        data: {
          status: 'REJECTED',
          learningAccess: 'RESTRICTED',
          evidenceStatus: 'REJECTED',
        },
      },
    },
    minorPrincipalFact: {
      principalId: 'p-minor-1',
      adultGateStatus: 'REJECTED',
      adultVerifiedAt: null,
      status: 'ACTIVE',
    },
    minorAuditFact: {
      decision: 'DENY',
      reasonCode: 'ADULT_AGE_BELOW_MINIMUM',
    },
    minorSessionStatus: 'ACTIVE',
    minorPrincipalMe: {
      status: 200,
      body: {
        data: {
          status: 'RESTRICTED',
        },
      },
    },
    minorReplay: {
      status: 200,
      body: {
        data: {
          status: 'REJECTED',
        },
      },
    },
    minorConflict: {
      status: 409,
      body: {
        error: { code: 'IDEMPOTENCY_CONFLICT' },
      },
    },
    missingConfirmation: {
      status: 403,
      body: {
        error: { code: 'FORBIDDEN' },
      },
    },
    missingKey: {
      status: 400,
      body: {
        error: { code: 'VALIDATION_ERROR' },
      },
    },
  };

  // 1. Positive baseline
  const positive = evaluateR1006Assertions(basePositive);
  assert.equal(positive.passed, true);
  assert.equal(positive.card, 'R1-006');
  assert.equal(positive.chain, 'BC-006');
  assert.equal(positive.assertions.adultSubmitStatus200, true);
  assert.equal(positive.assertions.adultGateStatusPassed, true);
  assert.equal(positive.assertions.adultLearningAccessEligible, true);
  assert.equal(positive.assertions.adultEvidenceVerified, true);
  assert.equal(positive.assertions.dbAdultGateStatusApproved, true);
  assert.equal(positive.assertions.dbAdultAuditAllow, true);
  assert.equal(positive.assertions.adultReplayConsistent, true);
  assert.equal(positive.assertions.minorSubmitStatus200, true);
  assert.equal(positive.assertions.minorGateStatusRejected, true);
  assert.equal(positive.assertions.minorLearningAccessRestricted, true);
  assert.equal(positive.assertions.minorEvidenceRejected, true);
  assert.equal(positive.assertions.dbMinorGateStatusRejected, true);
  assert.equal(positive.assertions.dbMinorAuditDeny, true);
  assert.equal(positive.assertions.minorSessionActive, true);
  assert.equal(positive.assertions.minorPostAccess200, true);
  assert.equal(positive.assertions.minorReplayConsistent, true);
  assert.equal(positive.assertions.minorConflict409, true);
  assert.equal(positive.assertions.missingConfirmation403, true);
  assert.equal(positive.assertions.missingIdempotencyKey400, true);

  // 2. Negative: Adult submit status not 200
  const negAdultSubmitStatus = evaluateR1006Assertions({
    ...basePositive,
    adultSubmit: { status: 500 },
  });
  assert.equal(negAdultSubmitStatus.passed, false);
  assert.equal(negAdultSubmitStatus.assertions.adultSubmitStatus200, false);

  // 3. Negative: Adult gate status not PASSED
  const negAdultGateStatus = evaluateR1006Assertions({
    ...basePositive,
    adultSubmit: { ...basePositive.adultSubmit, body: { data: { status: 'PENDING' } } },
  });
  assert.equal(negAdultGateStatus.passed, false);
  assert.equal(negAdultGateStatus.assertions.adultGateStatusPassed, false);

  // 4. Negative: Adult learningAccess not ELIGIBLE
  const negAdultLearningAccess = evaluateR1006Assertions({
    ...basePositive,
    adultSubmit: { ...basePositive.adultSubmit, body: { data: { status: 'PASSED', learningAccess: 'RESTRICTED' } } },
  });
  assert.equal(negAdultLearningAccess.passed, false);
  assert.equal(negAdultLearningAccess.assertions.adultLearningAccessEligible, false);

  // 5. Negative: Adult evidenceStatus not SERVER_VERIFIED
  const negAdultEvidence = evaluateR1006Assertions({
    ...basePositive,
    adultSubmit: { ...basePositive.adultSubmit, body: { data: { status: 'PASSED', learningAccess: 'ELIGIBLE', evidenceStatus: 'UNVERIFIED' } } },
  });
  assert.equal(negAdultEvidence.passed, false);
  assert.equal(negAdultEvidence.assertions.adultEvidenceVerified, false);

  // 6. Negative: DB Adult gate status not APPROVED
  const negDbAdultStatus = evaluateR1006Assertions({
    ...basePositive,
    adultPrincipalFact: { ...basePositive.adultPrincipalFact, adultGateStatus: 'PENDING' },
  });
  assert.equal(negDbAdultStatus.passed, false);
  assert.equal(negDbAdultStatus.assertions.dbAdultGateStatusApproved, false);

  // 7. Negative: DB Adult verifiedAt is null
  const negDbAdultVerifiedNull = evaluateR1006Assertions({
    ...basePositive,
    adultPrincipalFact: { ...basePositive.adultPrincipalFact, adultVerifiedAt: null },
  });
  assert.equal(negDbAdultVerifiedNull.passed, false);
  assert.equal(negDbAdultVerifiedNull.assertions.dbAdultGateStatusApproved, false);

  // 8. Negative: DB Adult audit not ALLOW
  const negDbAdultAuditDeny = evaluateR1006Assertions({
    ...basePositive,
    adultAuditFact: { decision: 'DENY', reasonCode: 'adult_gate_allowed' },
  });
  assert.equal(negDbAdultAuditDeny.passed, false);
  assert.equal(negDbAdultAuditDeny.assertions.dbAdultAuditAllow, false);

  // 9. Negative: DB Adult audit reasonCode mismatch
  const negDbAdultAuditReason = evaluateR1006Assertions({
    ...basePositive,
    adultAuditFact: { decision: 'ALLOW', reasonCode: 'unknown_code' },
  });
  assert.equal(negDbAdultAuditReason.passed, false);
  assert.equal(negDbAdultAuditReason.assertions.dbAdultAuditAllow, false);

  // 10. Negative: Adult replay not consistent
  const negAdultReplay = evaluateR1006Assertions({
    ...basePositive,
    adultReplay: { status: 200, body: { data: { status: 'REJECTED' } } },
  });
  assert.equal(negAdultReplay.passed, false);
  assert.equal(negAdultReplay.assertions.adultReplayConsistent, false);

  // 11. Negative: Minor submit status not 200
  const negMinorSubmitStatus = evaluateR1006Assertions({
    ...basePositive,
    minorSubmit: { status: 400 },
  });
  assert.equal(negMinorSubmitStatus.passed, false);
  assert.equal(negMinorSubmitStatus.assertions.minorSubmitStatus200, false);

  // 12. Negative: Minor gate status not REJECTED
  const negMinorGateStatus = evaluateR1006Assertions({
    ...basePositive,
    minorSubmit: { ...basePositive.minorSubmit, body: { data: { status: 'PASSED' } } },
  });
  assert.equal(negMinorGateStatus.passed, false);
  assert.equal(negMinorGateStatus.assertions.minorGateStatusRejected, false);

  // 13. Negative: Minor learningAccess not RESTRICTED
  const negMinorLearningAccess = evaluateR1006Assertions({
    ...basePositive,
    minorSubmit: { ...basePositive.minorSubmit, body: { data: { status: 'REJECTED', learningAccess: 'ELIGIBLE' } } },
  });
  assert.equal(negMinorLearningAccess.passed, false);
  assert.equal(negMinorLearningAccess.assertions.minorLearningAccessRestricted, false);

  // 14. Negative: Minor evidenceStatus not REJECTED
  const negMinorEvidence = evaluateR1006Assertions({
    ...basePositive,
    minorSubmit: { ...basePositive.minorSubmit, body: { data: { status: 'REJECTED', learningAccess: 'RESTRICTED', evidenceStatus: 'SERVER_VERIFIED' } } },
  });
  assert.equal(negMinorEvidence.passed, false);
  assert.equal(negMinorEvidence.assertions.minorEvidenceRejected, false);

  // 15. Negative: DB Minor gate status not REJECTED
  const negDbMinorStatus = evaluateR1006Assertions({
    ...basePositive,
    minorPrincipalFact: { ...basePositive.minorPrincipalFact, adultGateStatus: 'APPROVED' },
  });
  assert.equal(negDbMinorStatus.passed, false);
  assert.equal(negDbMinorStatus.assertions.dbMinorGateStatusRejected, false);

  // 16. Negative: DB Minor verifiedAt not null
  const negDbMinorVerifiedNotNull = evaluateR1006Assertions({
    ...basePositive,
    minorPrincipalFact: { ...basePositive.minorPrincipalFact, adultVerifiedAt: '2026-10-09T10:00:00Z' },
  });
  assert.equal(negDbMinorVerifiedNotNull.passed, false);
  assert.equal(negDbMinorVerifiedNotNull.assertions.dbMinorGateStatusRejected, false);

  // 17. Negative: DB Minor audit not DENY
  const negDbMinorAuditAllow = evaluateR1006Assertions({
    ...basePositive,
    minorAuditFact: { decision: 'ALLOW', reasonCode: 'ADULT_AGE_BELOW_MINIMUM' },
  });
  assert.equal(negDbMinorAuditAllow.passed, false);
  assert.equal(negDbMinorAuditAllow.assertions.dbMinorAuditDeny, false);

  // 18. Negative: DB Minor audit reasonCode mismatch
  const negDbMinorAuditReason = evaluateR1006Assertions({
    ...basePositive,
    minorAuditFact: { decision: 'DENY', reasonCode: 'WRONG_REASON' },
  });
  assert.equal(negDbMinorAuditReason.passed, false);
  assert.equal(negDbMinorAuditReason.assertions.dbMinorAuditDeny, false);

  // 19. Negative: Minor session erroneously killed (not ACTIVE)
  const negMinorSessionKilled = evaluateR1006Assertions({
    ...basePositive,
    minorSessionStatus: 'REVOKED',
  });
  assert.equal(negMinorSessionKilled.passed, false);
  assert.equal(negMinorSessionKilled.assertions.minorSessionActive, false);

  // 20. Negative: Minor principal/me cannot be accessed (e.g. 401 or 403)
  const negMinorPrincipalMe = evaluateR1006Assertions({
    ...basePositive,
    minorPrincipalMe: { status: 403 },
  });
  assert.equal(negMinorPrincipalMe.passed, false);
  assert.equal(negMinorPrincipalMe.assertions.minorPostAccess200, false);

  // 21. Negative: Minor replay not consistent
  const negMinorReplay = evaluateR1006Assertions({
    ...basePositive,
    minorReplay: { status: 200, body: { data: { status: 'PASSED' } } },
  });
  assert.equal(negMinorReplay.passed, false);
  assert.equal(negMinorReplay.assertions.minorReplayConsistent, false);

  // 22. Negative: Minor conflict not 409
  const negMinorConflict = evaluateR1006Assertions({
    ...basePositive,
    minorConflict: { status: 200 },
  });
  assert.equal(negMinorConflict.passed, false);
  assert.equal(negMinorConflict.assertions.minorConflict409, false);

  // 23. Negative: Missing confirmation not 403
  const negMissingConf = evaluateR1006Assertions({
    ...basePositive,
    missingConfirmation: { status: 200 },
  });
  assert.equal(negMissingConf.passed, false);
  assert.equal(negMissingConf.assertions.missingConfirmation403, false);

  // 24. Negative: Missing key not 400
  const negMissingKey = evaluateR1006Assertions({
    ...basePositive,
    missingKey: { status: 200 },
  });
  assert.equal(negMissingKey.passed, false);
  assert.equal(negMissingKey.assertions.missingIdempotencyKey400, false);
});

test('R1-008 assertion evaluation checks consent reading, dynamic signing, DB facts, 409 conflict and replay', () => {
  const basePositive = {
    preConsentMe: {
      status: 200,
      body: {
        data: {
          consentState: {
            required: true,
            accepted: false,
            version: 'b30-consent-v1',
            requiredPurposes: ['PRIVACY', 'TERMS', 'ADULT_LEARNING'],
          },
        },
      },
    },
    privacySubmit: { status: 200, body: { data: { type: 'PRIVACY', decision: 'ACCEPTED' } } },
    termsSubmit: { status: 200, body: { data: { type: 'TERMS', decision: 'ACCEPTED' } } },
    adultLearningSubmit: { status: 200, body: { data: { type: 'ADULT_LEARNING', decision: 'ACCEPTED' } } },
    postConsentMe: {
      status: 200,
      body: {
        data: {
          status: 'ACTIVE',
          consentState: {
            required: true,
            accepted: true,
            version: 'b30-consent-v1',
            learningAccess: 'ELIGIBLE',
          },
        },
      },
    },
    dbConsentRecords: [
      { consentType: 'PRIVACY', documentVersion: 'b30-consent-v1', status: 'GRANTED' },
      { consentType: 'TERMS', documentVersion: 'b30-consent-v1', status: 'GRANTED' },
      { consentType: 'ADULT_LEARNING', documentVersion: 'b30-consent-v1', status: 'GRANTED' },
    ],
    dbAuditFacts: [
      { actionCode: 'consent_recorded', decision: 'ALLOW' },
      { actionCode: 'consent_recorded', decision: 'ALLOW' },
      { actionCode: 'consent_recorded', decision: 'ALLOW' },
    ],
    staleVersionSubmit: { status: 409 },
    missingKeySubmit: { status: 400 },
    invalidDecisionSubmit: { status: 400 },
    replaySubmit: { status: 200, body: { data: { type: 'PRIVACY', decision: 'ACCEPTED' } } },
  };

  const positive = evaluateR1008Assertions(basePositive);
  assert.equal(positive.passed, true);
  assert.equal(positive.card, 'R1-008');
  assert.equal(positive.chain, 'BC-008');
  assert.equal(positive.assertions.preConsentPrincipalMe200, true);
  assert.equal(positive.assertions.consentVersionPresent, true);
  assert.equal(positive.assertions.privacySubmit200, true);
  assert.equal(positive.assertions.termsSubmit200, true);
  assert.equal(positive.assertions.adultLearningSubmit200, true);
  assert.equal(positive.assertions.postLearningAccessEligible, true);
  assert.equal(positive.assertions.dbConsentsRecordedCount3, true);
  assert.equal(positive.assertions.dbAuditConsentRecorded, true);
  assert.equal(positive.assertions.staleVersionConflict409, true);
  assert.equal(positive.assertions.replayConsent200, true);

  // Negative 1: Missing consent version in preConsentMe
  const negMissingVer = evaluateR1008Assertions({
    ...basePositive,
    preConsentMe: { status: 200, body: { data: { consentState: { required: true, accepted: false } } } },
  });
  assert.equal(negMissingVer.passed, false);
  assert.equal(negMissingVer.assertions.consentVersionPresent, false);

  // Negative 2: Privacy submit not 200
  const negPrivacyFail = evaluateR1008Assertions({
    ...basePositive,
    privacySubmit: { status: 500 },
  });
  assert.equal(negPrivacyFail.passed, false);
  assert.equal(negPrivacyFail.assertions.privacySubmit200, false);

  // Negative 3: DB consent records count < 3
  const negDbCount = evaluateR1008Assertions({
    ...basePositive,
    dbConsentRecords: [{ consentType: 'PRIVACY', status: 'GRANTED' }],
  });
  assert.equal(negDbCount.passed, false);
  assert.equal(negDbCount.assertions.dbConsentsRecordedCount3, false);

  // Negative 4: Stale version did not return 409
  const negNo409 = evaluateR1008Assertions({
    ...basePositive,
    staleVersionSubmit: { status: 200 },
  });
  assert.equal(negNo409.passed, false);
  assert.equal(negNo409.assertions.staleVersionConflict409, false);

  // Negative 5: Missing key did not return 400
  const negNo400 = evaluateR1008Assertions({
    ...basePositive,
    missingKeySubmit: { status: 200 },
  });
  assert.equal(negNo400.passed, false);
  assert.equal(negNo400.assertions.missingIdempotencyKey400, false);
});

