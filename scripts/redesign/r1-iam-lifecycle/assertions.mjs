import { createHash } from 'node:crypto';
import { validateCookie as r1002ValidateCookie } from '../r1-002/business-runtime.mjs';

export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

export function assertIamLifecycleSchema(schema) {
  if (typeof schema !== 'string' || !/^r1_iam_lifecycle_\d{8}_[a-f0-9]{12}$/.test(schema)) {
    throw new Error('SCHEMA_SCOPE_INVALID');
  }
  return schema;
}

export function assertIamLifecycleUser(user) {
  if (typeof user !== 'string' || !/^r1_iam_[a-f0-9]{12}$/.test(user)) {
    throw new Error('USER_SCOPE_INVALID');
  }
  return user;
}

export function databaseGrantScope(schema, partialRevokes) {
  assertIamLifecycleSchema(schema);
  if (typeof partialRevokes !== 'boolean') throw new Error('GRANT_SCOPE');
  return '`' + (partialRevokes ? schema : schema.replaceAll('_', '\\_')) + '`.*';
}

export function parseArgs(args = []) {
  const options = { mode: 'inspect' };
  const allowedModes = ['inspect', 'prepare', 'run', 'cleanup-plan'];

  let i = 0;
  if (args.length > 0 && !args[0].startsWith('--')) {
    if (!allowedModes.includes(args[0])) {
      throw new Error('MODE_SCOPE_INVALID');
    }
    options.mode = args[0];
    i = 1;
  }

  const nameMap = new Map([
    ['--mode', 'mode'],
    ['--config-dir', 'configDir'],
    ['--approval', 'approvalPath'],
    ['--private-parent', 'privateParent'],
    ['--out', 'outPath'],
  ]);

  while (i < args.length) {
    const flag = args[i];
    const key = nameMap.get(flag);
    if (!key || i + 1 >= args.length || args[i + 1].startsWith('--')) {
      throw new Error(`ARGUMENT_INVALID:${flag}`);
    }
    if (Object.hasOwn(options, key) && key !== 'mode') {
      throw new Error(`ARGUMENT_DUPLICATE:${flag}`);
    }
    options[key] = args[i + 1];
    i += 2;
  }

  if (!allowedModes.includes(options.mode)) {
    throw new Error('MODE_SCOPE_INVALID');
  }

  return options;
}

export function validateRunApproval(approval, { scriptSha256, schema, mysqlId }) {
  if (!approval || typeof approval !== 'object') throw new Error('APPROVAL_INVALID');
  if (approval.kind !== 'ROOT_APPROVED_R1_IAM_LIFECYCLE_RUNTIME') throw new Error('APPROVAL_KIND_MISMATCH');
  if (approval.scriptSha256 !== scriptSha256) throw new Error('APPROVAL_SCRIPT_MISMATCH');
  if (approval.schema !== schema) throw new Error('APPROVAL_SCHEMA_MISMATCH');
  if (approval.mysqlId !== mysqlId) throw new Error('APPROVAL_MYSQL_ID_MISMATCH');
  if (!approval.expiresAt || Date.parse(approval.expiresAt) <= Date.now()) throw new Error('APPROVAL_EXPIRED');
  return {
    valid: true,
    kind: approval.kind,
    schema: approval.schema,
    mysqlId: approval.mysqlId,
    expiresAt: approval.expiresAt,
  };
}

export function validateCookie(cookie, body) {
  return r1002ValidateCookie(cookie, body);
}

export function parseCookieValue(setCookieHeader, cookieName = 'yuxuexing_refresh') {
  if (typeof setCookieHeader !== 'string') return null;
  const match = setCookieHeader.match(new RegExp(`(?:^|;\\s*)${cookieName}=([^;]+)`));
  return match ? match[1] : null;
}

export function extractDeviceList(body) {
  if (!body || typeof body !== 'object') return [];
  if (Array.isArray(body.data)) return body.data;
  if (body.data && Array.isArray(body.data.devices)) return body.data.devices;
  if (body.data && Array.isArray(body.data.items)) return body.data.items;
  return [];
}

export function evaluateSingleCurrentDevice(devices, expectedDeviceId) {
  if (!Array.isArray(devices)) return { singleCurrent: false, count: 0, matchedExpected: false, currentDeviceId: null };
  const currents = devices.filter(d => d && d.isCurrent === true);
  const singleCurrent = currents.length === 1;
  const currentDeviceId = singleCurrent ? currents[0].deviceId : null;
  const matchedExpected = singleCurrent && (currentDeviceId === expectedDeviceId);
  return {
    singleCurrent,
    count: currents.length,
    matchedExpected,
    currentDeviceId,
  };
}

export function evaluateR1003Assertions({
  firstRegistration,
  replayRegistration,
  conflictRegistration,
  missingKeyRegistration,
  dbCountsBefore,
  dbCountsAfterFirst,
  dbCountsAfterReplay,
  dbCountsAfterConflict,
}) {
  const assertions = {};

  assertions.initialCleanDb = dbCountsBefore ? Object.values(dbCountsBefore).every(v => v === 0) : true;
  assertions.firstRegistrationStatus201 = firstRegistration?.status === 201;
  assertions.firstRegistrationHasSession = Boolean(firstRegistration?.body?.data?.sessionId);
  assertions.firstRegistrationHasDevice = Boolean(firstRegistration?.body?.data?.deviceId);

  assertions.replayStatusConsistent = replayRegistration?.status === (firstRegistration?.status ?? 201);
  assertions.replaySessionConsistent = Boolean(
    replayRegistration?.body?.data?.sessionId &&
    replayRegistration?.body?.data?.sessionId === firstRegistration?.body?.data?.sessionId
  );
  assertions.replayDeviceConsistent = Boolean(
    replayRegistration?.body?.data?.deviceId &&
    replayRegistration?.body?.data?.deviceId === firstRegistration?.body?.data?.deviceId
  );
  assertions.replayNoSecondAccount = Boolean(
    dbCountsAfterReplay &&
    dbCountsAfterReplay.accounts === 1 &&
    dbCountsAfterReplay.principals === 1 &&
    dbCountsAfterReplay.devices === 1 &&
    dbCountsAfterReplay.sessions === 1
  );
  assertions.replayCompletedIdempotencyCount = (dbCountsAfterReplay?.completedIdempotency ?? 0) === 1;

  const conflictStatus = conflictRegistration?.status ?? 0;
  assertions.conflictRejected = conflictStatus >= 400 && conflictStatus < 500;
  assertions.conflictActualStatus = conflictStatus;
  assertions.conflictNoSecondAccount = Boolean(
    dbCountsAfterConflict &&
    dbCountsAfterConflict.accounts === 1 &&
    dbCountsAfterConflict.principals === 1
  );

  const missingKeyStatus = missingKeyRegistration?.status ?? 0;
  assertions.missingKeyRejected = missingKeyStatus === 400;
  assertions.missingKeyActualStatus = missingKeyStatus;

  const coreChecks = [
    assertions.firstRegistrationStatus201,
    assertions.firstRegistrationHasSession,
    assertions.replayStatusConsistent,
    assertions.replaySessionConsistent,
    assertions.replayNoSecondAccount,
    assertions.replayCompletedIdempotencyCount,
    assertions.conflictRejected,
    assertions.conflictNoSecondAccount,
    assertions.missingKeyRejected,
  ];

  assertions.passed = coreChecks.every(Boolean);

  return {
    card: 'R1-003',
    chain: 'BC-003',
    summary: '注册幂等回放验证',
    assertions,
    passed: assertions.passed,
  };
}

export function evaluateR1004Assertions({
  registration,
  login,
  refresh,
  refreshReplay,
  relogin,
  logout,
  postLogoutAccess,
  postLogoutRefresh,
  sessionStatusAfterReplay,
  sessionStatusAfterLogout,
}) {
  const assertions = {};

  assertions.registrationStatus201 = registration?.status === 201;
  assertions.loginStatus200 = login?.status === 200;
  assertions.loginHasSession = Boolean(login?.body?.data?.sessionId);

  assertions.refreshStatus200 = refresh?.status === 200;
  assertions.refreshRotatedNewTokenDifferent = Boolean(
    refresh?.rawRefreshToken &&
    login?.rawRefreshToken &&
    refresh.rawRefreshToken !== login.rawRefreshToken
  );
  assertions.refreshCookieSecurity = Boolean(refresh?.cookieSecurity);
  assertions.refreshBodyNoPlaintextToken = !Object.hasOwn(refresh?.body?.data ?? {}, 'refreshToken');

  const replayStatus = refreshReplay?.status ?? 0;
  assertions.replayOldRefreshRejected = replayStatus === 401;
  assertions.replayOldRefreshActualStatus = replayStatus;
  assertions.replayOldRefreshSessionRevoked = sessionStatusAfterReplay === 'REVOKED';

  assertions.reloginStatus200 = relogin?.status === 200;
  assertions.logoutStatus200 = logout?.status === 200;
  assertions.logoutSessionRevoked = sessionStatusAfterLogout === 'REVOKED';

  const postLogoutAccessStatus = postLogoutAccess?.status ?? 0;
  assertions.postLogoutAccessRejected401 = postLogoutAccessStatus === 401;
  assertions.postLogoutAccessActualStatus = postLogoutAccessStatus;

  const postLogoutRefreshStatus = postLogoutRefresh?.status ?? 0;
  assertions.postLogoutRefreshRejected401 = postLogoutRefreshStatus === 401;
  assertions.postLogoutRefreshActualStatus = postLogoutRefreshStatus;

  const coreChecks = [
    assertions.registrationStatus201,
    assertions.loginStatus200,
    assertions.refreshStatus200,
    assertions.refreshRotatedNewTokenDifferent,
    assertions.refreshCookieSecurity,
    assertions.refreshBodyNoPlaintextToken,
    assertions.replayOldRefreshRejected,
    assertions.replayOldRefreshSessionRevoked,
    assertions.reloginStatus200,
    assertions.logoutStatus200,
    assertions.logoutSessionRevoked,
    assertions.postLogoutAccessRejected401,
    assertions.postLogoutRefreshRejected401,
  ];

  assertions.passed = coreChecks.every(Boolean);

  return {
    card: 'R1-004',
    chain: 'BC-004',
    summary: '登录/刷新/撤销全套生命周期验证',
    assertions,
    passed: assertions.passed,
  };
}

export function evaluateR1005Assertions({
  loginA,
  loginB,
  devicesFromA,
  devicesFromB,
  kickoutResult,
  accessBAfterKickout,
  refreshBAfterKickout,
  accessAAfterKickout,
  sessionStatusA,
  sessionStatusB,
}) {
  const assertions = {};

  assertions.loginAStatus200 = loginA?.status === 200;
  assertions.loginBStatus200 = loginB?.status === 200;

  const evalA = evaluateSingleCurrentDevice(extractDeviceList(devicesFromA?.body), loginA?.deviceId);
  assertions.devicesFromAStatus200 = devicesFromA?.status === 200;
  assertions.devicesFromAHasSingleCurrent = evalA.singleCurrent;
  assertions.devicesFromAIsCurrentDeviceIdA = evalA.matchedExpected;

  const evalB = evaluateSingleCurrentDevice(extractDeviceList(devicesFromB?.body), loginB?.deviceId);
  assertions.devicesFromBStatus200 = devicesFromB?.status === 200;
  assertions.devicesFromBHasSingleCurrent = evalB.singleCurrent;
  assertions.devicesFromBIsCurrentDeviceIdB = evalB.matchedExpected;

  assertions.kickoutStatus200 = kickoutResult?.status === 200;

  const accessBStatus = accessBAfterKickout?.status ?? 0;
  assertions.kickedDeviceAccessRejected401 = accessBStatus === 401;
  assertions.kickedDeviceAccessActualStatus = accessBStatus;

  const refreshBStatus = refreshBAfterKickout?.status ?? 0;
  assertions.kickedDeviceRefreshRejected401 = refreshBStatus === 401;
  assertions.kickedDeviceRefreshActualStatus = refreshBStatus;

  assertions.deviceARemainsValid200 = accessAAfterKickout?.status === 200;
  assertions.sessionStatusBRevoked = sessionStatusB === 'REVOKED';
  assertions.sessionStatusAActive = sessionStatusA === 'ACTIVE';

  const coreChecks = [
    assertions.loginAStatus200,
    assertions.loginBStatus200,
    assertions.devicesFromAStatus200,
    assertions.devicesFromAHasSingleCurrent,
    assertions.devicesFromAIsCurrentDeviceIdA,
    assertions.devicesFromBStatus200,
    assertions.devicesFromBHasSingleCurrent,
    assertions.devicesFromBIsCurrentDeviceIdB,
    assertions.kickoutStatus200,
    assertions.kickedDeviceAccessRejected401,
    assertions.kickedDeviceRefreshRejected401,
    assertions.deviceARemainsValid200,
    assertions.sessionStatusBRevoked,
    assertions.sessionStatusAActive,
  ];

  assertions.passed = coreChecks.every(Boolean);

  return {
    card: 'R1-005',
    chain: 'BC-005',
    summary: '多设备列表识别与踢出验证',
    assertions,
    passed: assertions.passed,
  };
}

export function evaluateR1006Assertions({
  adultSubmit,
  adultPrincipalFact,
  adultAuditFact,
  adultReplay,
  minorSubmit,
  minorPrincipalFact,
  minorAuditFact,
  minorSessionStatus,
  minorPrincipalMe,
  minorReplay,
  minorConflict,
  missingConfirmation,
  missingKey,
}) {
  const assertions = {};

  // 成年路径
  assertions.adultSubmitStatus200 = adultSubmit?.status === 200;
  assertions.adultGateStatusPassed = adultSubmit?.body?.data?.status === 'PASSED';
  assertions.adultLearningAccessEligible = adultSubmit?.body?.data?.learningAccess === 'ELIGIBLE';
  assertions.adultEvidenceVerified = adultSubmit?.body?.data?.evidenceStatus === 'SERVER_VERIFIED';
  assertions.dbAdultGateStatusApproved = Boolean(
    adultPrincipalFact?.adultGateStatus === 'APPROVED' &&
    adultPrincipalFact?.adultVerifiedAt != null
  );
  assertions.dbAdultAuditAllow = Boolean(
    adultAuditFact?.decision === 'ALLOW' &&
    (adultAuditFact?.reasonCode === 'adult_gate_allowed' || adultAuditFact?.reasonCode === 'ADULT_GATE_ALLOWED')
  );
  assertions.adultReplayConsistent = Boolean(
    adultReplay?.status === 200 &&
    adultReplay?.body?.data?.status === 'PASSED'
  );

  // 未成年路径
  assertions.minorSubmitStatus200 = minorSubmit?.status === 200;
  assertions.minorGateStatusRejected = minorSubmit?.body?.data?.status === 'REJECTED';
  assertions.minorLearningAccessRestricted = minorSubmit?.body?.data?.learningAccess === 'RESTRICTED';
  assertions.minorEvidenceRejected = minorSubmit?.body?.data?.evidenceStatus === 'REJECTED';
  assertions.dbMinorGateStatusRejected = Boolean(
    minorPrincipalFact?.adultGateStatus === 'REJECTED' &&
    minorPrincipalFact?.adultVerifiedAt == null
  );
  assertions.dbMinorAuditDeny = Boolean(
    minorAuditFact?.decision === 'DENY' &&
    (minorAuditFact?.reasonCode === 'ADULT_AGE_BELOW_MINIMUM' || minorAuditFact?.reasonCode === 'adult_age_below_minimum')
  );
  assertions.minorSessionActive = minorSessionStatus === 'ACTIVE';
  assertions.minorPostAccess200 = minorPrincipalMe?.status === 200;
  assertions.minorReplayConsistent = Boolean(
    minorReplay?.status === 200 &&
    minorReplay?.body?.data?.status === 'REJECTED'
  );
  assertions.minorConflict409 = minorConflict?.status === 409;

  // 边界拒绝
  assertions.missingConfirmation403 = missingConfirmation?.status === 403;
  assertions.missingIdempotencyKey400 = missingKey?.status === 400;

  const coreChecks = [
    assertions.adultSubmitStatus200,
    assertions.adultGateStatusPassed,
    assertions.adultLearningAccessEligible,
    assertions.adultEvidenceVerified,
    assertions.dbAdultGateStatusApproved,
    assertions.dbAdultAuditAllow,
    assertions.adultReplayConsistent,
    assertions.minorSubmitStatus200,
    assertions.minorGateStatusRejected,
    assertions.minorLearningAccessRestricted,
    assertions.minorEvidenceRejected,
    assertions.dbMinorGateStatusRejected,
    assertions.dbMinorAuditDeny,
    assertions.minorSessionActive,
    assertions.minorPostAccess200,
    assertions.minorReplayConsistent,
    assertions.minorConflict409,
    assertions.missingConfirmation403,
    assertions.missingIdempotencyKey400,
  ];

  assertions.passed = coreChecks.every(Boolean);

  return {
    card: 'R1-006',
    chain: 'BC-006',
    summary: '成人门提交双路径落库与审计验证',
    assertions,
    passed: assertions.passed,
  };
}

export function evaluateR1008Assertions({
  preConsentMe,
  privacySubmit,
  termsSubmit,
  adultLearningSubmit,
  postConsentMe,
  dbConsentRecords,
  dbAuditFacts,
  staleVersionSubmit,
  missingKeySubmit,
  invalidDecisionSubmit,
  replaySubmit,
}) {
  const assertions = {};

  // 1. 前置读取激活版本
  assertions.preConsentPrincipalMe200 = preConsentMe?.status === 200;
  assertions.consentRequiredTrue = preConsentMe?.body?.data?.consentState?.required === true;
  assertions.consentAcceptedInitialFalse = preConsentMe?.body?.data?.consentState?.accepted === false;
  assertions.consentVersionPresent = Boolean(preConsentMe?.body?.data?.consentState?.version);
  const reqPurposes = preConsentMe?.body?.data?.consentState?.requiredPurposes;
  assertions.requiredPurposesValid = Boolean(
    Array.isArray(reqPurposes) &&
    reqPurposes.length === 3 &&
    (reqPurposes.includes('PRIVACY_NOTICE') || reqPurposes.includes('PRIVACY')) &&
    (reqPurposes.includes('ACCOUNT_TERMS') || reqPurposes.includes('TERMS')) &&
    (reqPurposes.includes('ADULT_LEARNING_ELIGIBILITY') || reqPurposes.includes('ADULT_LEARNING'))
  );

  // 2. 动态签署
  assertions.privacySubmit200 = privacySubmit?.status === 200 && privacySubmit?.body?.data?.decision === 'ACCEPTED';
  assertions.termsSubmit200 = termsSubmit?.status === 200 && termsSubmit?.body?.data?.decision === 'ACCEPTED';
  assertions.adultLearningSubmit200 = adultLearningSubmit?.status === 200 && adultLearningSubmit?.body?.data?.decision === 'ACCEPTED';

  // 3. 签署后状态确认与学习资格
  assertions.postConsentPrincipalMe200 = postConsentMe?.status === 200;
  assertions.consentAcceptedPostTrue = postConsentMe?.body?.data?.consentState?.accepted === true;
  assertions.postLearningAccessEligible = postConsentMe?.body?.data?.consentState?.learningAccess === 'ELIGIBLE' &&
    postConsentMe?.body?.data?.status === 'ACTIVE';
  assertions.dbConsentsRecordedCount3 = Boolean(
    Array.isArray(dbConsentRecords) &&
    dbConsentRecords.length === 3 &&
    dbConsentRecords.every(r => r.status === 'GRANTED')
  );
  assertions.dbAuditConsentRecorded = Boolean(
    Array.isArray(dbAuditFacts) &&
    dbAuditFacts.some(a => a.actionCode === 'consent_recorded')
  );

  // 4. 版本冲突 409
  assertions.staleVersionConflict409 = staleVersionSubmit?.status === 409;

  // 5. 边界校验
  assertions.missingIdempotencyKey400 = missingKeySubmit?.status === 400;
  assertions.invalidDecision400 = invalidDecisionSubmit?.status === 400;

  // 6. 幂等重放
  assertions.replayConsent200 = replaySubmit?.status === 200;

  const coreChecks = [
    assertions.preConsentPrincipalMe200,
    assertions.consentRequiredTrue,
    assertions.consentAcceptedInitialFalse,
    assertions.consentVersionPresent,
    assertions.requiredPurposesValid,
    assertions.privacySubmit200,
    assertions.termsSubmit200,
    assertions.adultLearningSubmit200,
    assertions.postConsentPrincipalMe200,
    assertions.consentAcceptedPostTrue,
    assertions.postLearningAccessEligible,
    assertions.dbConsentsRecordedCount3,
    assertions.dbAuditConsentRecorded,
    assertions.staleVersionConflict409,
    assertions.missingIdempotencyKey400,
    assertions.invalidDecision400,
    assertions.replayConsent200,
  ];

  assertions.passed = coreChecks.every(Boolean);

  return {
    card: 'R1-008',
    chain: 'BC-008',
    summary: '三同意动态版读取与签署及409拒绝验证',
    assertions,
    passed: assertions.passed,
  };
}

export function redactSecrets(value, privateDirectories = []) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    let sanitized = value;
    for (const dir of privateDirectories) {
      if (dir && typeof dir === 'string') {
        sanitized = sanitized.replaceAll(dir, '<PRIVATE_MATERIAL_DIR>');
      }
    }
    return sanitized;
  }
  if (Array.isArray(value)) {
    return value.map(v => redactSecrets(v, privateDirectories));
  }
  if (typeof value === 'object') {
    const sensitiveKeys = new Set([
      'password', 'rawpassword', 'secret', 'replaysecret', 'fingerprintsecret',
      'refreshtoken', 'accesstoken', 'token', 'authorization', 'set-cookie',
      'cookie', 'mysql_root_password', 'privatekey', 'keystorepassword'
    ]);
    const result = {};
    for (const [k, v] of Object.entries(value)) {
      if (sensitiveKeys.has(k.toLowerCase())) {
        result[k] = '<REDACTED_SECRET>';
      } else {
        result[k] = redactSecrets(v, privateDirectories);
      }
    }
    return result;
  }
  return value;
}

export function generateCleanupPlan(schema, user) {
  assertIamLifecycleSchema(schema);
  assertIamLifecycleUser(user);
  return {
    kind: 'R1_IAM_LIFECYCLE_CLEANUP_PLAN',
    schema,
    user,
    sqlStatements: [
      `DROP USER IF EXISTS '${user}'@'%';`,
      `DROP DATABASE IF EXISTS ${schema};`,
    ],
    executed: false,
    warning: 'This is a strictly non-destructive inspection plan. Automatic DROP execution is disabled by policy.',
  };
}
