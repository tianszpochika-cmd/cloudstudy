import { createHash } from 'node:crypto';

export const FIXTURE_ID = 'local-real-10x-v1';
export const FIXTURE_PREFIX = 'local-10x';
export const TENANT_ID = 'platform';
export const ROWS_PER_FUNCTION = 10;
export const FIXTURE_DATE = process.env.LOCAL_FIXTURE_DATE || '2026-08-26';

if (!/^\d{4}-\d{2}-\d{2}$/.test(FIXTURE_DATE)) {
  throw new Error('LOCAL_FIXTURE_DATE must use YYYY-MM-DD');
}

export function assertLocalDatabaseTarget() {
  const host = process.env.MYSQL_HOST || '127.0.0.1';
  const port = String(process.env.MYSQL_PORT || '13306');
  const override = process.env.LOCAL_FIXTURE_ALLOW_NONLOCAL === '1';
  const localHost = ['127.0.0.1', 'localhost', '::1'].includes(host);
  if (!override && (!localHost || port !== '13306')) {
    throw new Error(
      `local-real-10x 只允许写入本机 MySQL 127.0.0.1:13306；当前为 ${host}:${port}。` +
      ' 如确需覆盖，请显式设置 LOCAL_FIXTURE_ALLOW_NONLOCAL=1。',
    );
  }
}

const RAW = Symbol('raw-sql');
const raw = (value) => ({ [RAW]: value });

function sqlString(value) {
  return `'${String(value).replaceAll('\\', '\\\\').replaceAll("'", "''")}'`;
}

function sqlValue(value) {
  if (value && typeof value === 'object' && RAW in value) return value[RAW];
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'number') return String(value);
  return sqlString(value);
}

function jsonValue(value) {
  return JSON.stringify(value);
}

export function sha256(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

function canonicalPayload(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return `[${value.map((item) => `${canonicalPayload(item)};`).join('')}]`;
  if (typeof value === 'object') {
    return `{${Object.entries(value)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, nested]) => `${quotePayload(key)}:${canonicalPayload(nested)};`)
      .join('')}}`;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return quotePayload(value);
}

function quotePayload(value) {
  return `"${String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
}

export function contentPayloadHash(value) {
  return sha256(canonicalPayload(value));
}

export function stableUuid(namespace, index) {
  const hex = sha256(`${FIXTURE_ID}:${namespace}:${index}`).slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20)}`;
}

export function fixtureText(kind, index) {
  return `${FIXTURE_PREFIX}-${kind}-${String(index).padStart(2, '0')}`;
}

const each = (factory) => Array.from({ length: ROWS_PER_FUNCTION }, (_, offset) => factory(offset + 1));
const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const themes = ['LIGHT', 'DARK', 'SYSTEM', 'HIGH_CONTRAST'];
const motionModes = ['FULL', 'REDUCED', 'OFF'];
const sourceTypes = ['READING', 'LISTENING', 'SCENARIO', 'VOCAB_EXAMPLE'];
const PHASE_ONE_DAILY_QUOTA_MINUTES = [5, 15, 30, 45];

export const B3_RESOURCE_TYPES = [
  'GRAMMAR_POINT',
  'GRAMMAR_EXERCISE',
  'SENTENCE',
  'LISTENING_MATERIAL',
  'LISTENING_CLIP',
  'READING_ARTICLE',
  'READING_QUESTION',
  'DICTIONARY_ENTRY',
  'PHONEME',
  'MINIMAL_PAIR',
  'WRITING_PROMPT',
  'WRITING_TEMPLATE',
  'WRITING_MATERIAL',
  'PROOFREADING',
];

export const GAMIFICATION_FEATURE_KEYS = [
  'quests',
  'achievements',
  'collection',
  'catalog',
  'season-rewards',
  'avatar-profile',
  'avatar-items',
  'avatar-loadouts',
  'avatar-resources',
  'study-space',
  'game-catalog',
];

export const SUBJECTS = each((index) => stableUuid('principal', index));
const deviceIds = each((index) => stableUuid('device', index));
const devicePublicIds = each((index) => stableUuid('device-public', index));
const sessionIds = each((index) => stableUuid('iam-session', index));
const contentIds = each((index) => fixtureText('content', index));
const contentCodes = each((index) => fixtureText('course', index));
const contentVersionIds = each((index) => 261000 + index);
const b25ItemIds = each((index) => fixtureText('item', index));
const b25AssessmentSessionIds = each((index) => stableUuid('b25-assessment-session', index));
const b25AssessmentReportIds = each((index) => stableUuid('b25-assessment-report', index));
const b10SessionIds = each((index) => fixtureText('b10-session', index));
const b10AttemptIds = each((index) => fixtureText('b10-attempt', index));
const b10ReportIds = each((index) => fixtureText('b10-report', index));
const legacyAssessmentSessionIds = each((index) => stableUuid('legacy-assessment-session', index));
const legacyAssessmentAttemptIds = each((index) => stableUuid('legacy-assessment-attempt', index));
const mediaAssetIds = each((index) => stableUuid('media-asset', index));
const mediaRenditionIds = each((index) => stableUuid('media-rendition', index));
const socialRoomIds = each((index) => fixtureText('room', index));
const socialLeaseIds = each((index) => fixtureText('lease', index));

function listSql(values) {
  return values.map(sqlString).join(', ');
}

function insert(schema, table, columns, rows, updateColumns = columns.slice(1)) {
  if (!rows.length) return '';
  const values = rows
    .map((row) => `(${row.map(sqlValue).join(', ')})`)
    .join(',\n');
  const updates = (updateColumns.length ? updateColumns : [columns[0]])
    .map((column) => `\`${column}\` = VALUES(\`${column}\`)`)
    .join(', ');
  return [
    `INSERT INTO ${schema}.${table} (${columns.map((column) => `\`${column}\``).join(', ')})`,
    'VALUES',
    values,
    `ON DUPLICATE KEY UPDATE ${updates};`,
  ].join('\n');
}

const now = raw('UTC_TIMESTAMP(6)');
const dateValue = FIXTURE_DATE;
const subjectsSql = listSql(SUBJECTS);

// IAM owner facts ---------------------------------------------------------
const iamPrincipalRows = each((index) => [
  SUBJECTS[index - 1], TENANT_ID, 'ACTIVE', 'APPROVED', FIXTURE_ID,
  now, now, now,
]);

const fixturePasswordHash = '$2a$12$C6UzMDM.H6dfI/f/IKcEe.Vn2xL1Xg9sN8m5p4wJ7w7j9y9e3dF6';
const iamAccountRows = each((index) => [
  SUBJECTS[index - 1], fixtureText('account', index) + '@example.invalid', fixturePasswordHash,
  'learner',
  'learner.profile.read,learner.profile.write,learning.plan.read,learning.plan.write,assessment.session.read,assessment.session.write,content.read,iam.self.read,iam.self.write',
  'ACTIVE', 0, null, now, now,
]);

const iamDeviceRows = each((index) => [
  deviceIds[index - 1], SUBJECTS[index - 1], devicePublicIds[index - 1],
  raw(`UNHEX('${sha256(`${FIXTURE_ID}:device-hash:${index}`)}')`),
  index % 2 ? 'WEB' : 'MOBILE', 'ACTIVE', now, null, null, now,
]);

const iamSessionRows = each((index) => [
  sessionIds[index - 1], SUBJECTS[index - 1], deviceIds[index - 1],
  stableUuid('token-family', index),
  raw(`UNHEX('${sha256(`${FIXTURE_ID}:refresh:${index}`)}')`),
  'ACTIVE', now, raw('DATE_ADD(UTC_TIMESTAMP(6), INTERVAL 30 DAY)'), null, null,
  null, 0,
]);

const iamConsentRows = each((index) => [
  stableUuid('consent', index), SUBJECTS[index - 1], 'ADULT_GATE', 'b30-rbac-v1',
  'GRANTED', now, null,
]);

const iamDecisionAuditRows = each((index) => [
  stableUuid('decision', index), fixtureText('request', index), fixtureText('trace', index),
  SUBJECTS[index - 1], TENANT_ID, 'learner.profile.read', 'LEARNER_PROFILE',
  raw(`UNHEX('${sha256(`${FIXTURE_ID}:profile:${index}`)}')`), 'b30-rbac-v1',
  'ALLOW', 'LOCAL_FIXTURE', now,
]);

const iamPrincipalRoleRows = each((index) => [SUBJECTS[index - 1], 'role-learner', now, null]);

// Learner owner facts -----------------------------------------------------
const learnerProfileRows = each((index) => [
  SUBJECTS[index - 1], TENANT_ID, 'ACTIVE', fixtureText('learner', index),
  index % 2 ? 'US' : 'UK', 1980 + index, true, true, true, 'zh-CN', 'en-US',
  'Asia/Shanghai', themes[(index - 1) % themes.length], 1, now, now,
]);

const learnerGoalRows = each((index) => [
  SUBJECTS[index - 1], TENANT_ID, `ENGLISH_${levels[(index - 1) % levels.length]}`,
  levels[(index - 1) % levels.length], PHASE_ONE_DAILY_QUOTA_MINUTES[(index - 1) % PHASE_ONE_DAILY_QUOTA_MINUTES.length],
  'ACTIVE', fixtureText('goal-idem', index),
]);

const learnerPreferenceRows = each((index) => [
  SUBJECTS[index - 1], TENANT_ID, 'zh-CN', 'en-US', 'Asia/Shanghai',
  themes[(index - 1) % themes.length], index % 4 === 0,
  motionModes[(index - 1) % motionModes.length], fixtureText('preference-idem', index),
]);

const learnerDailyTaskRows = each((index) => [
  fixtureText('daily-task', index), SUBJECTS[index - 1], TENANT_ID, contentCodes[index - 1],
  `每日学习任务 ${index}`, 'LESSON', PHASE_ONE_DAILY_QUOTA_MINUTES[(index - 1) % PHASE_ONE_DAILY_QUOTA_MINUTES.length],
  index % 3 === 0 ? 'COMPLETED' : 'AVAILABLE', index,
  fixtureText('daily-task-idem', index), index % 3 === 0 ? now : null, now,
]);

const learnerPrivacyExportRows = each((index) => [
  fixtureText('privacy-export', index), SUBJECTS[index - 1], TENANT_ID,
  'PHASE1_LEARNER_EXPORT', 'COMPLETED', fixtureText('privacy-export-idem', index), now,
]);

const onboardingOptionRows = each((index) => {
  const optionType = ['LANGUAGE', 'GOAL', 'EXAM', 'QUOTA', 'ACCENT'][(index - 1) % 5];
  return [
    910000 + index, optionType, fixtureText(`onboarding-${optionType.toLowerCase()}`, index),
    `本地测试选项 ${index}`, `fixture option ${index}`, optionType === 'QUOTA' ? 15 + index : null,
    index, true, now,
  ];
});

// Content owner facts -----------------------------------------------------
const contentDefinitionRows = each((index) => [
  contentIds[index - 1], TENANT_ID, contentCodes[index - 1], 'COURSE',
  `本地测试课程 ${index}`, 'en-US', levels[(index - 1) % levels.length], 'DAILY_ENGLISH',
  'local-fixture', now, contentVersionIds[index - 1], 1, 1,
]);

const contentVersionRows = each((index) => {
  const payload = { fixtureId: FIXTURE_ID, contentCode: contentCodes[index - 1], unitCount: 1 };
  return [
    contentVersionIds[index - 1], contentIds[index - 1], 1, 'PUBLISHED', 'ACTIVE',
    contentPayloadHash(payload), now, now, 'COURSE', jsonValue(payload),
    'LOCAL_FIXTURE', 'LOCAL_FIXTURE', true, jsonValue(['STREAM', 'DOWNLOAD', 'OFFLINE']),
    now, null, fixtureText('authorization', index), 'local-editor', 'local fixture release',
    'local-reviewer-1', 'local-reviewer-2', 'local-publisher', null, null, 1, 1, 1,
  ];
});

const contentProjectionRows = each((index) => [
  contentIds[index - 1], contentVersionIds[index - 1], 'LEARNER', 'COURSE',
  `本地测试课程 ${index}`, 'en-US', levels[(index - 1) % levels.length], 'DAILY_ENGLISH',
  jsonValue({ fixtureId: FIXTURE_ID, contentCode: contentCodes[index - 1], visible: true }),
  sha256(`${FIXTURE_ID}:projection:${index}`), now,
]);

const b25CourseRows = each((index) => [
  contentCodes[index - 1], TENANT_ID, 'COURSE', `本地测试课程 ${index}`,
  `用于本地端到端测试的第 ${index} 个课程`, 'en-US', levels[(index - 1) % levels.length],
  contentVersionIds[index - 1], 'PUBLISHED', 'VALID',
  jsonValue({ fixtureId: FIXTURE_ID, courseCode: contentCodes[index - 1], unitCount: 1 }), now, now,
]);

const b25UnitRows = each((index) => [
  fixtureText('unit', index), contentCodes[index - 1], fixtureText('unit-code', index), 1,
  `local.unit.${index}`, 1, 'PUBLISHED', 'VALID', now,
]);

const b25VocabularyRows = each((index) => [
  fixtureText('vocab', index), fixtureText('unit-code', index), `habit${index}`,
  `local.vocabulary.meaning.${index}`, levels[(index - 1) % levels.length], 1, 'PUBLISHED',
  fixtureText('audio-ref', index),
]);

const b25ItemRows = each((index) => [
  b25ItemIds[index - 1], contentCodes[index - 1], TENANT_ID, 'CHOICE', 1,
  `Choose the best word for habit ${index}.`,
  jsonValue([{ optionCode: 'A', label: 'habit' }, { optionCode: 'B', label: 'random' }]),
  jsonValue({ ruleRef: fixtureText('answer-rule', index), ruleVersion: 'v1' }),
  fixtureText('media-ref', index),
]);

const b25AnswerRuleRows = each((index) => [
  fixtureText('answer-rule-id', index), fixtureText('answer-rule', index), 'v1', 'EXACT_MATCH',
  jsonValue({ fixtureId: FIXTURE_ID, algorithm: 'EXACT_MATCH', answerHash: sha256(`habit${index}`) }),
  'ACTIVE',
]);

function experienceDomain(resourceType) {
  if (resourceType.startsWith('GRAMMAR')) return 'GRAMMAR';
  if (resourceType.startsWith('LISTENING')) return 'LISTENING';
  if (resourceType.startsWith('READING') || resourceType === 'DICTIONARY_ENTRY') return 'READING';
  if (resourceType === 'PHONEME' || resourceType === 'MINIMAL_PAIR') return 'PHONETICS';
  return 'WRITING';
}

function experiencePayload(resourceType, index, resourceKey) {
  const common = { fixtureId: FIXTURE_ID, resourceType, resourceKey, contentVersionId: 301 + index };
  switch (resourceType) {
    case 'GRAMMAR_POINT':
      return { ...common, grammarPointId: 31000 + index, code: `LOCAL_TENSE_${index}`, title: `本地语法点 ${index}`, ruleFormula: 'subject + base verb', meaningCn: '描述习惯与事实', cefrLevel: levels[(index - 1) % levels.length] };
    case 'GRAMMAR_EXERCISE':
      return { ...common, exerciseId: 37000 + index, grammarPointId: 31000 + index, type: 'CHOICE', promptText: `The learner studies every day ${index}.`, options: ['does', 'do'], ruleVersion: 'local-b3-rule-v1' };
    case 'SENTENCE':
      return { ...common, sentenceId: 32000 + index, text: `Small habits support progress ${index}.`, translation: `小习惯支持进步 ${index}。`, nodes: [], edges: [], slices: [], blockOrder: [], imitationSlots: {} };
    case 'LISTENING_MATERIAL':
      return { ...common, materialId: 34000 + index, title: `Learning in small steps ${index}`, cefrLevel: 'B1', durationMs: 1200 + index, rightsStatus: 'AUTHORIZED', segments: [], mediaRef: { assetId: fixtureText('media', index), variant: 'LOW' } };
    case 'LISTENING_CLIP':
      return { ...common, clipId: 34100 + index, materialId: 34000 + index, title: `Small step clip ${index}`, startMs: 0, endMs: 1200 + index, mediaRef: { assetId: fixtureText('media', index), variant: 'LOW' } };
    case 'READING_ARTICLE':
      return { ...common, articleId: 35000 + index, title: `Small routines ${index}`, cefrLevel: 'B1', wordCount: 12, estimatedMinutes: 2, rightsStatus: 'AUTHORIZED', blocks: [] };
    case 'READING_QUESTION':
      return { ...common, questionId: 39500 + index, articleId: 35000 + index, questionType: 'MAIN_IDEA', stemText: 'What supports steady progress?', options: [{ optionCode: 'A', label: 'Small routines' }, { optionCode: 'B', label: 'No practice' }] };
    case 'DICTIONARY_ENTRY':
      return { ...common, articleId: 35000 + index, tokenId: `token-${index}`, lemma: `habit${index}`, partOfSpeech: 'noun', meaningCn: `习惯 ${index}`, exampleText: `Build a habit ${index}.` };
    case 'PHONEME':
      return { ...common, phonemeId: 36000 + index, symbol: ['iː', 'æ', 'ʃ', 'θ', 'ə', 'uː'][index % 6], group: 'LOCAL_CATALOG', exampleWord: `sound${index}`, description: 'Phase 1 rule-based phoneme reference', mouthProfile: { profileVersion: 'mouth-v1', fallback2d: 'svg-mouth-v1', jawOpen: 0.3, tongueHeight: 0.5, tongueBackness: 0.4, lipRound: 0.2, voicing: index % 2 === 0 } };
    case 'MINIMAL_PAIR':
      return { ...common, pairId: 39600 + index, leftPhonemeId: 36000 + index, rightPhonemeId: 36010 + index, leftWord: `sound${index}`, rightWord: `zound${index}` };
    case 'WRITING_PROMPT':
      return { ...common, promptId: 33000 + index, promptType: 'OPINION', title: `学习计划写作 ${index}`, taskText: 'Write one sentence about a sustainable learning habit.', targetStructure: ['claim', 'reason', 'example'] };
    case 'WRITING_TEMPLATE':
      return { ...common, templateId: 39000 + index, templateType: 'PARAGRAPH', title: `观点段落模板 ${index}`, structure: [{ slotCode: 'CLAIM', required: true }, { slotCode: 'REASON', required: true }, { slotCode: 'EXAMPLE', required: false }] };
    case 'WRITING_MATERIAL':
      return { ...common, materialId: 39100 + index, topicCode: 'LEARNING_HABITS', title: `学习习惯表达 ${index}`, bodyText: 'Regular review makes progress visible.' };
    case 'PROOFREADING':
      return { ...common, issueId: 39200 + index, promptId: 33000 + index, errorType: 'SUBJECT_VERB_AGREEMENT', wrongText: 'The learner study every day.', wrongTextHash: sha256(`local-proofreading:${index}`), explanation: '单数主语使用第三人称单数形式。' };
    default:
      return common;
  }
}

const b3ExperienceRows = B3_RESOURCE_TYPES.flatMap((resourceType, typeIndex) => each((index) => {
  const resourceKey = fixtureText(resourceType.toLowerCase(), index);
  return [
    fixtureText(`experience-${resourceType.toLowerCase()}`, index), TENANT_ID,
    experienceDomain(resourceType), resourceType, resourceKey, 301 + index, 'PUBLISHED',
    jsonValue(experiencePayload(resourceType, index, resourceKey)),
  ];
}));

const publicFacetRows = each((index) => [
  fixtureText('facet', index), 'zh-CN', ['DOWNLOAD', 'ANNOUNCEMENT', 'COMPLIANCE', 'CAMPAIGN'][(index - 1) % 4],
  'PUBLISHED', jsonValue({ fixtureId: FIXTURE_ID, title: `本地站点信息 ${index}`, order: index }), 1, now, null, now,
]);

const b2ChunkRows = each((index) => [
  321000 + index, TENANT_ID, `build a habit ${index}`, 'COLLOCATION', `养成一个习惯 ${index}`,
  'Local fixture chunk for vocabulary detail.', 'DAILY_ROUTINE',
  jsonValue([{ sentence: `It takes time to build a habit ${index}.`, translation: `养成习惯需要时间 ${index}。` }]),
  FIXTURE_ID, 'PUBLISHED',
]);

// Learning owner facts ----------------------------------------------------
const b25LearningPlanRows = each((index) => [
  stableUuid('b25-learning-plan', index), SUBJECTS[index - 1], TENANT_ID, 'ACTIVE',
  PHASE_ONE_DAILY_QUOTA_MINUTES[(index - 1) % PHASE_ONE_DAILY_QUOTA_MINUTES.length], 1, now,
]);

const b25SrsRows = each((index) => [
  SUBJECTS[index - 1], fixtureText('vocab', index), TENANT_ID,
  ['NEW', 'LEARNING', 'REVIEW', 'MASTERED'][(index - 1) % 4],
  raw(`DATE_ADD(UTC_TIMESTAMP(6), INTERVAL ${index} DAY)`), index % 4, 2.5, index,
  fixtureText('srs-idem', index), now,
]);

const b25ReviewRows = each((index) => [
  stableUuid('b25-review', index), SUBJECTS[index - 1], TENANT_ID, fixtureText('vocab', index),
  3 + (index % 3), fixtureText('review-idem', index), now,
]);

const continueContextRows = each((index) => [
  TENANT_ID, SUBJECTS[index - 1], fixtureText('module', index), `学习模块 ${index}`,
  fixtureText('lesson', index), `学习课次 ${index}`, 2, 5, 120000 + index * 1000,
  'ACTIVE', fixtureText('continue-idem', index), now,
]);

const b3InteractionRows = each((index) => [
  stableUuid('b3-interaction', index), TENANT_ID, SUBJECTS[index - 1],
  ['GRAMMAR', 'WRITING', 'LISTENING', 'READING', 'PHONETICS'][(index - 1) % 5],
  ['VIEWED', 'ANSWERED', 'SAVED', 'COMPLETED', 'REPLAYED'][(index - 1) % 5],
  fixtureText('experience', index), fixtureText('interaction-idem', index),
  jsonValue({ fixtureId: FIXTURE_ID, input: { itemIndex: index } }),
  jsonValue({ correct: index % 4 !== 0, score: 60 + index }), 'ACCEPTED', now, now,
]);

const expressionRows = each((index) => [
  611000 + index, TENANT_ID, SUBJECTS[index - 1], sourceTypes[(index - 1) % sourceTypes.length],
  fixtureText('sentence', index), FIXTURE_ID, `Small habits support progress ${index}.`,
  `小习惯支持进步 ${index}。`, `habits ${index}`, 0, 7, index % 2 === 0,
  `local note ${index}`, jsonValue([`habit-${index}`]), 'ACTIVE',
  fixtureText('expression-create', index), fixtureText('expression-last', index), now, now,
]);

const libraryRows = each((index) => [
  621000 + index, SUBJECTS[index - 1], TENANT_ID,
  ['VOCAB', 'CHUNK', 'EXPRESSION'][(index - 1) % 3],
  [fixtureText('vocab', index), String(321000 + index), String(611000 + index)][(index - 1) % 3],
  'LOCAL_FIXTURE', ['NEW_WORD', 'SAVED', 'MASTERED'][(index - 1) % 3],
  fixtureText('library-idem', index), now, now,
]);

const runtimeUserIds = each((index) => 700000 + index);
const runtimePlanIds = each((index) => 100000 + index);
const runtimeTaskIds = each((index) => 200000 + index);
const runtimeSnapshotIds = each((index) => 300000 + index);
const runtimeSrsIds = each((index) => 400000 + index);
const runtimeReviewIds = each((index) => 500000 + index);
const runtimeItemIds = each((index) => 910000 + index);

const runtimePlanRows = each((index) => [
  runtimePlanIds[index - 1], TENANT_ID, SUBJECTS[index - 1], runtimeUserIds[index - 1],
  800000 + index, `ENGLISH_${levels[(index - 1) % levels.length]}`, contentVersionIds[index - 1], 1,
  'Asia/Shanghai', PHASE_ONE_DAILY_QUOTA_MINUTES[(index - 1) % PHASE_ONE_DAILY_QUOTA_MINUTES.length], 'ACTIVE', 1, now, now,
]);

const runtimeTaskRows = each((index) => [
  runtimeTaskIds[index - 1], runtimePlanIds[index - 1], TENANT_ID, SUBJECTS[index - 1],
  runtimeUserIds[index - 1], 'LESSON', runtimeItemIds[index - 1], contentVersionIds[index - 1],
  dateValue, index % 3 === 0 ? 'COMPLETED' : 'AVAILABLE', index % 3 === 0 ? 100 : 25, 1, now,
]);

const runtimeProgressRows = each((index) => [
  TENANT_ID, SUBJECTS[index - 1], runtimeUserIds[index - 1], runtimePlanIds[index - 1],
  runtimeTaskIds[index - 1], index % 3 === 0 ? 1 : 0, 1, 60 + index * 10, 1, now,
]);

const runtimeSrsRows = each((index) => [
  runtimeSrsIds[index - 1], TENANT_ID, SUBJECTS[index - 1], runtimeUserIds[index - 1], 'VOCAB',
  800000 + index, runtimeItemIds[index - 1], contentVersionIds[index - 1], 'REVIEW',
  2.5, index, index, 0, 'Asia/Shanghai', raw(`DATE_ADD(UTC_TIMESTAMP(6), INTERVAL ${index} DAY)`), now, 1,
]);

const runtimeReviewRows = each((index) => [
  runtimeReviewIds[index - 1], TENANT_ID, SUBJECTS[index - 1], runtimeUserIds[index - 1], 'VOCAB',
  800000 + index, runtimeItemIds[index - 1], contentVersionIds[index - 1], 'b25-srs-v1',
  runtimeSrsIds[index - 1], 1, 3 + (index % 3), 3 + (index % 3), 'HIGH', now,
  fixtureText('runtime-review-event', index),
]);

const runtimeMasteryRows = each((index) => [
  TENANT_ID, SUBJECTS[index - 1], runtimeUserIds[index - 1], 'VOCAB', runtimeItemIds[index - 1],
  contentVersionIds[index - 1], 'REVIEW', 60 + index, 1 + index, index % 3 === 0 ? 1 : 0, 1,
  'VERIFIED', 'b25-rule-v1', now, jsonValue([fixtureText('runtime-review-event', index)]),
]);

const runtimeQueueSnapshotRows = each((index) => [
  runtimeSnapshotIds[index - 1], TENANT_ID, SUBJECTS[index - 1], runtimeUserIds[index - 1],
  dateValue, 'Asia/Shanghai', 'b25-srs-v1', 1, now,
]);

const runtimeQueueItemRows = each((index) => [
  runtimeSnapshotIds[index - 1], TENANT_ID, SUBJECTS[index - 1], runtimeUserIds[index - 1], 1,
  runtimeSrsIds[index - 1], 'VOCAB', runtimeItemIds[index - 1], raw(`DATE_ADD(UTC_TIMESTAMP(6), INTERVAL ${index} DAY)`),
]);

// Assessment owner facts --------------------------------------------------
const b25AssessmentRuleRows = each((index) => [
  b25ItemIds[index - 1], contentCodes[index - 1], contentVersionIds[index - 1],
  `Choose the best word for habit ${index}.`,
  jsonValue([{ optionCode: 'A', label: 'habit' }, { optionCode: 'B', label: 'random' }]),
  ['VOCABULARY', 'GRAMMAR', 'LISTENING', 'READING'][(index - 1) % 4], 1 + (index % 4),
  jsonValue({ algorithm: 'EXACT_MATCH', answerHash: sha256(`habit${index}`) }), true, now,
]);

const b25AssessmentSessionRows = each((index) => [
  b25AssessmentSessionIds[index - 1], SUBJECTS[index - 1], TENANT_ID, contentCodes[index - 1],
  'COMPLETED', jsonValue({ [b25ItemIds[index - 1]]: 'A' }), 70 + index,
  b25AssessmentReportIds[index - 1], fixtureText('assessment-idem', index), now, now,
]);

const b25AssessmentReportRows = each((index) => [
  b25AssessmentReportIds[index - 1], b25AssessmentSessionIds[index - 1], SUBJECTS[index - 1],
  TENANT_ID, levels[(index - 1) % levels.length], 70 + index,
  jsonValue({ vocabulary: 70 + index, grammar: 65 + index, reading: 75 + index }),
  jsonValue({ items: index % 4 === 0 ? [b25ItemIds[index - 1]] : [] }), 1, now,
]);

const b10SessionRows = each((index) => [
  b10SessionIds[index - 1], SUBJECTS[index - 1], TENANT_ID,
  ['PRACTICE', 'REVIEW', 'PLACEMENT', 'MOCK'][(index - 1) % 4], 'ASSESSED', contentCodes[index - 1],
  contentVersionIds[index - 1], 1, 980000 + index, sha256(`${FIXTURE_ID}:b10-snapshot:${index}`),
  jsonValue([runtimeItemIds[index - 1]]), jsonValue({ [String(runtimeItemIds[index - 1])]: 'A' }), 2, 1,
  b10AttemptIds[index - 1], b10ReportIds[index - 1], fixtureText('b10-session-idem', index), now,
  raw('DATE_ADD(UTC_TIMESTAMP(6), INTERVAL 1 DAY)'), now,
]);

const b10AttemptRows = each((index) => [
  b10AttemptIds[index - 1], b10SessionIds[index - 1], SUBJECTS[index - 1], TENANT_ID, 1,
  fixtureText('b10-submission', index), 'ASSESSED', 1,
  sha256(`${FIXTURE_ID}:b10-submission:${index}`), index % 4 === 0 ? 'PARTIAL' : 'FULL',
  jsonValue(index % 4 === 0 ? ['SUBJECT_VERB_AGREEMENT'] : []), b10ReportIds[index - 1], now,
]);

const b10CheckpointRows = each((index) => [
  b10AttemptIds[index - 1], b10SessionIds[index - 1], SUBJECTS[index - 1], TENANT_ID, 1, 1,
  jsonValue([String(runtimeItemIds[index - 1])]), sha256(`${FIXTURE_ID}:b10-checkpoint:${index}`), now,
]);

const b10ReportRows = each((index) => [
  b10ReportIds[index - 1], b10AttemptIds[index - 1], b10SessionIds[index - 1], SUBJECTS[index - 1],
  TENANT_ID, 1, 'READY', index % 4 === 0 ? 'PARTIAL' : 'FULL',
  jsonValue(index % 4 === 0 ? ['SUBJECT_VERB_AGREEMENT'] : []), index % 4 === 0 ? 'WEAK' : 'STABLE',
  jsonValue({ contentVersionId: contentVersionIds[index - 1], snapshotId: 980000 + index }), now,
]);

const legacyAssessmentSessionRows = each((index) => [
  legacyAssessmentSessionIds[index - 1], SUBJECTS[index - 1], TENANT_ID, 'PRACTICE', 'CLOSED',
  now, raw('DATE_ADD(UTC_TIMESTAMP(6), INTERVAL 1 DAY)'), now, now,
]);

const legacyAssessmentSessionExerciseRows = each((index) => [
  legacyAssessmentSessionIds[index - 1], 990000 + index, 1, 'CONTENT', 'VERIFIED',
  jsonValue({ fixtureId: FIXTURE_ID, contentCode: contentCodes[index - 1], itemId: b25ItemIds[index - 1] }),
]);

const legacyAssessmentAttemptFactRows = each((index) => [
  legacyAssessmentAttemptIds[index - 1], legacyAssessmentSessionIds[index - 1], 990000 + index,
  991000 + index, SUBJECTS[index - 1], TENANT_ID, fixtureText('legacy-submission', index), 1,
  sha256(`${FIXTURE_ID}:legacy-answer:${index}`), now,
]);

const legacyAssessmentAnswerRows = each((index) => [
  legacyAssessmentAttemptIds[index - 1], jsonValue({ optionCode: 'A', fixtureId: FIXTURE_ID }), now,
]);

const legacyAssessmentScoreRows = each((index) => [
  legacyAssessmentAttemptIds[index - 1], 'ASSESSED', 70 + index, 100, index % 4 !== 0,
  jsonValue(index % 4 === 0 ? ['SUBJECT_VERB_AGREEMENT'] : []), 'local-rule-v1',
  jsonValue({ earned: 70 + index, max: 100 }), now,
]);

const legacyAssessmentCheckpointRows = each((index) => [
  stableUuid('legacy-assessment-checkpoint', index), legacyAssessmentSessionIds[index - 1], 1,
  990000 + index, sha256(`${FIXTURE_ID}:legacy-state:${index}`), 120000 + index, now,
]);

const legacyAssessmentReportRows = each((index) => [
  992000 + index, legacyAssessmentSessionIds[index - 1], SUBJECTS[index - 1], TENANT_ID, 'PRACTICE',
  'READY', 70 + index, 100, 1, 1, 'local-calculation-v1', 'local-score-policy-v1', now,
  jsonValue({ score: 70 + index }), jsonValue({ evidence: [`local-evidence-${index}`] }),
  jsonValue(index % 4 === 0 ? ['SUBJECT_VERB_AGREEMENT'] : []),
]);

const legacyAssessmentMistakeRows = each((index) => [
  993000 + index, SUBJECTS[index - 1], TENANT_ID, 990000 + index, 994000 + index,
  'SUBJECT_VERB_AGREEMENT', FIXTURE_ID, sha256(`${FIXTURE_ID}:mistake:${index}`), 1,
  'OPEN', 'WEAK', now, now, raw('DATE_ADD(UTC_TIMESTAMP(6), INTERVAL 1 DAY)'),
  jsonValue({ fixtureId: FIXTURE_ID, reason: 'synthetic failed answer' }),
]);

const legacyAssessmentAttemptRows = each((index) => [
  legacyAssessmentAttemptIds[index - 1], SUBJECTS[index - 1], TENANT_ID, 1,
  'ASSESSED', sha256(`${FIXTURE_ID}:legacy-answer:${index}`), index % 4 === 0 ? 'PARTIAL' : 'FULL',
  fixtureText('legacy-attempt-idem', index), now, now,
]);

const legacyAssessmentCheckpointRowsV1 = each((index) => [
  stableUuid('legacy-checkpoint', index), legacyAssessmentAttemptIds[index - 1], 1,
  sha256(`${FIXTURE_ID}:legacy-checkpoint:${index}`), now,
]);

// Media owner facts -------------------------------------------------------
const mediaAssetRows = each((index) => [
  mediaAssetIds[index - 1], TENANT_ID, SUBJECTS[index - 1], contentVersionIds[index - 1], 1,
  sha256(`${FIXTURE_ID}:media:${index}`), 2048 + index, 'ACTIVE', 'ACTIVE', now, now,
  fixtureText('asset', index), 'AUDIO', 'audio/mpeg', 'LOCAL_OBJECT_STORE', 'yuxuexing-local',
  fixtureText('object', index), `version-${index}`, true, 1024, 2, 'READY', 'LEARNING_AUDIO',
  fixtureText('segment', index), fixtureText('rights', index), 'LOCAL_FIXTURE', 'STREAM,DOWNLOAD,OFFLINE',
  now, raw('DATE_ADD(UTC_TIMESTAMP(6), INTERVAL 365 DAY)'), true, fixtureText('authorization', index),
]);

const mediaRenditionRows = each((index) => [
  mediaRenditionIds[index - 1], mediaAssetIds[index - 1], fixtureText('rendition', index), 1,
  'READY', fixtureText('object', index), now, 'audio/mpeg', sha256(`${FIXTURE_ID}:rendition:${index}`),
  1024 + index, true, null, `object-version-${index}`,
]);

// Gamification owner facts ------------------------------------------------
const xpRows = each((index) => [
  stableUuid('xp-ledger', index), SUBJECTS[index - 1], TENANT_ID,
  stableUuid('xp-event', index), 10 + index, 10 + index, now,
]);

const coinRows = each((index) => [
  stableUuid('coin-ledger', index), SUBJECTS[index - 1], TENANT_ID,
  stableUuid('coin-event', index), 5 + index, 5 + index, now,
]);

const rewardRows = each((index) => [
  stableUuid('reward-grant', index), SUBJECTS[index - 1], TENANT_ID, `LOCAL_REWARD_${index}`,
  'local-probability-v1', 'GRANTED', fixtureText('reward-idem', index), now,
  fixtureText('reward-event', index), 'XP_BOOST', now,
]);

const gamificationEventRows = each((index) => [
  fixtureText('gamification-event', index), SUBJECTS[index - 1], sha256(`${FIXTURE_ID}:gamification:${index}`),
  jsonValue({ fixtureId: FIXTURE_ID, accepted: true, points: 10 + index }), now,
]);

const activeDateRows = each((index) => [SUBJECTS[index - 1], dateValue, now]);

const seasonRows = each((index) => [
  'local-season-2026', fixtureText('gamification-event', index), SUBJECTS[index - 1], 10 + index,
  'local-season-rule-v1', now, now,
]);

const timezoneRows = each((index) => [SUBJECTS[index - 1], 'Asia/Shanghai', now]);

const featureStateRows = GAMIFICATION_FEATURE_KEYS.flatMap((featureKey) => each((index) => [
  SUBJECTS[index - 1], featureKey, 1,
  jsonValue({ fixtureId: FIXTURE_ID, featureKey, enabled: true, progress: index, level: 1 }), now,
]));

const gameSessionRows = each((index) => [
  fixtureText('game-session', index), SUBJECTS[index - 1], 'WORD_MATCH', 'COMPLETED',
  jsonValue({ fixtureId: FIXTURE_ID, round: index, score: 80 + index }), now, now,
]);

// Social owner facts ------------------------------------------------------
const socialRoomRows = each((index) => [
  910000 + index, socialRoomIds[index - 1], TENANT_ID, SUBJECTS[index - 1],
  ['FOCUS', 'LISTENING', 'READING', 'SPEAKING'][(index - 1) % 4], fixtureText('room-name', index),
  20, 'OPEN', 1, now, now,
]);

const socialMemberRows = each((index) => [
  911000 + index, fixtureText('membership', index), socialRoomIds[index - 1], TENANT_ID,
  SUBJECTS[index - 1], 'ACTIVE', 'ONLINE', 'PUBLIC', 1, now, null, now,
]);

const socialSeatRows = each((index) => [
  912000 + index, socialRoomIds[index - 1], TENANT_ID, 1, SUBJECTS[index - 1], 'OCCUPIED',
  socialLeaseIds[index - 1], 1, raw('DATE_ADD(UTC_TIMESTAMP(6), INTERVAL 2 HOUR)'), null, now, null, null,
]);

const socialFocusRows = each((index) => [
  913000 + index, fixtureText('focus', index), TENANT_ID, socialRoomIds[index - 1], SUBJECTS[index - 1],
  1, socialLeaseIds[index - 1], index % 2 ? 25 : 45, 'DAILY_HABIT', 'RUNNING', now, null,
  60 * index, 60 * index,
]);

const socialInteractionRows = each((index) => [
  914000 + index, fixtureText('social-event', index), fixtureText('social-client-event', index), TENANT_ID,
  socialRoomIds[index - 1], SUBJECTS[index - 1], SUBJECTS[index === ROWS_PER_FUNCTION ? 1 : index], 1,
  ['CHEER_UP', 'STUDY_TOGETHER', 'CONGRATS', 'TRY_AGAIN', 'TONIGHT_20_MIN'][(index - 1) % 5],
  'DELIVERED', now, now,
]);

const socialLeaderboardRows = each((index) => [
  915000 + index, TENANT_ID, 'DAILY_FOCUS', 'DAY', dateValue, SUBJECTS[index - 1],
  100 - index, 60 + index, fixtureText('leaderboard-watermark', index), 'PUBLISHED', 1, now,
]);

const socialReportRows = each((index) => [
  916000 + index, fixtureText('social-report', index), TENANT_ID, socialRoomIds[index - 1],
  SUBJECTS[index - 1], SUBJECTS[index === ROWS_PER_FUNCTION ? 1 : index], 1, 'OFF_TOPIC', 'RECEIVED',
  fixtureText('social-report-client', index), now, now,
]);

// Commerce owner facts ----------------------------------------------------
const commerceSkuRows = each((index) => [
  TENANT_ID, fixtureText('sku', index), 1, `本地测试商品 ${index}`, `LOCAL_ENTITLEMENT_${index}`,
  'CNY', 9900 + index * 500, 'ACTIVE', now, now,
]);

const commercePriceRows = each((index) => [
  TENANT_ID, fixtureText('sku', index), 1, `本地测试商品 ${index}`, `LOCAL_ENTITLEMENT_${index}`,
  'CNY', 9900 + index * 500, now,
]);

const commerceOrderRows = each((index) => [
  TENANT_ID, fixtureText('order', index), SUBJECTS[index - 1], fixtureText('sku', index), 1,
  `本地测试商品 ${index}`, `LOCAL_ENTITLEMENT_${index}`, 'LOCAL_SIMULATOR', 'CNY', 9900 + index * 500,
  'PAID', now, now, now,
]);

const commercePaymentAttemptRows = each((index) => [
  TENANT_ID, fixtureText('payment-attempt', index), fixtureText('order', index), SUBJECTS[index - 1],
  'LOCAL_SIMULATOR', fixtureText('provider-payment', index), 'SUCCEEDED', 9900 + index * 500, 'CNY', now, now,
]);

const commercePaymentCallbackRows = each((index) => [
  TENANT_ID, 'LOCAL_SIMULATOR', fixtureText('payment-event', index), fixtureText('order', index),
  fixtureText('provider-payment', index), sha256(`${FIXTURE_ID}:payment:${index}`), 9900 + index * 500,
  'CNY', 'VERIFIED_PAID', now,
]);

const commerceEntitlementRows = each((index) => [
  TENANT_ID, fixtureText('entitlement', index), SUBJECTS[index - 1], fixtureText('sku', index), 1,
  `本地测试商品 ${index}`, `LOCAL_ENTITLEMENT_${index}`, 'ORDER', fixtureText('order', index), 'CNY',
  9900 + index * 500, 'ACTIVE', now, raw('DATE_ADD(UTC_TIMESTAMP(6), INTERVAL 365 DAY)'), 'LOCAL_FIXTURE',
]);

const commerceActivationRows = each((index) => [
  TENANT_ID, sha256(`${FIXTURE_ID}:activation-code:${index}`), fixtureText('sku', index), 1,
  `本地测试商品 ${index}`, `LOCAL_ENTITLEMENT_${index}`, 9900 + index * 500, 'CNY', 'AVAILABLE',
  raw('DATE_ADD(UTC_TIMESTAMP(6), INTERVAL 365 DAY)'), null, null,
]);

const commerceRefundRows = each((index) => [
  TENANT_ID, fixtureText('refund', index), fixtureText('order', index), SUBJECTS[index - 1],
  'LOCAL_SIMULATOR', 9900 + index * 500, 'CNY', 'REQUESTED', 'LOCAL_TEST_REFUND', now, now, null,
]);

const commerceRefundCallbackRows = each((index) => [
  TENANT_ID, 'LOCAL_SIMULATOR', fixtureText('refund-event', index), fixtureText('refund', index),
  sha256(`${FIXTURE_ID}:refund:${index}`), 9900 + index * 500, 'CNY', 'PENDING', now,
]);

const commerceAuditRows = each((index) => [
  fixtureText('commerce-audit', index), TENANT_ID, SUBJECTS[index - 1], 'ORDER_CREATED', 'ORDER',
  fixtureText('order', index), 'ACCEPTED', jsonValue({ fixtureId: FIXTURE_ID, provider: 'LOCAL_SIMULATOR' }), now,
]);

const commerceReconciliationRows = each((index) => [
  TENANT_ID, fixtureText('reconciliation', index), fixtureText('order', index), 'MATCHED',
  9900 + index * 500, 9900 + index * 500, 0, 'ACTIVE', false, now,
]);

// Notification owner facts ------------------------------------------------
const notificationMessageIds = each((index) => fixtureText('notification', index));
const notificationMessageRows = each((index) => [
  notificationMessageIds[index - 1], SUBJECTS[index - 1], TENANT_ID, 'LEARNING_REMINDER',
  'UNREAD', fixtureText('notification-idem', index), 'LEARNING_REMINDER', 'IN_APP', 'local-template-v1', `学习提醒 ${index}`, `今天完成 15 分钟学习任务 ${index}。`, FIXTURE_ID, 'zh-CN',
  jsonValue({ fixtureId: FIXTURE_ID, taskIndex: index }), now, false, 1, now,
]);

const offlineCursorRows = each((index) => [
  stableUuid('offline-cursor', index), SUBJECTS[index - 1], TENANT_ID, deviceIds[index - 1], index, 1,
  now, jsonValue({ learning: index, notification: index }),
]);

const b25NotificationPreferenceRows = each((index) => [
  SUBJECTS[index - 1], TENANT_ID, true, true, index % 2 === 0, 'zh-CN', fixtureText('notification-preference-idem', index), now,
]);

const b25NotificationMessageRows = each((index) => [
  stableUuid('b25-notification', index), SUBJECTS[index - 1], TENANT_ID,
  `LEARNING_PROGRESS_${index}`, index % 2 ? 'UNREAD' : 'READ', now,
]);

const notificationPreferenceRows = each((index) => [
  TENANT_ID, SUBJECTS[index - 1], 'LEARNING_REMINDER', 'IN_APP', true, 'zh-CN', 1, now,
]);

const deliveryAttemptRows = each((index) => [
  fixtureText('delivery-attempt', index), notificationMessageIds[index - 1], 'IN_APP', 1,
  'SENT', null, null, fixtureText('notification-request', index), fixtureText('notification-trace', index), now, false,
]);

const notificationConsentRows = each((index) => [
  TENANT_ID, SUBJECTS[index - 1], 'IN_APP', true, 'LOCAL_FIXTURE', fixtureText('notification-consent-idem', index), now,
]);

const notificationAuditRows = each((index) => [
  fixtureText('notification-audit', index), 'DELIVER', 'SUCCESS', 'local-fixture', TENANT_ID,
  SUBJECTS[index - 1], 'NOTIFICATION', notificationMessageIds[index - 1], fixtureText('notification-request', index),
  fixtureText('notification-trace', index), now, jsonValue({ fixtureId: FIXTURE_ID, channel: 'IN_APP' }),
]);

const trustedReceiptRows = each((index) => [
  'local-notification-consumer', fixtureText('notification-event', index), 'learning.review.recorded',
  fixtureText('notification-dedupe', index), sha256(`${FIXTURE_ID}:notification-event:${index}`), 'ACCEPTED',
  1, null, notificationMessageIds[index - 1], fixtureText('notification-workflow', index), now, now,
]);

const notificationWorkflowRows = each((index) => [
  fixtureText('notification-workflow', index), TENANT_ID, SUBJECTS[index - 1], 'DELIVER_NOTIFICATION',
  'NOTIFICATION', notificationMessageIds[index - 1], 'QUEUED', 0, 3, null, now, now,
]);

const offlineReceiptRows = each((index) => [
  TENANT_ID, SUBJECTS[index - 1], deviceIds[index - 1], fixtureText('offline-client-event', index),
  sha256(`${FIXTURE_ID}:offline-receipt:${index}`), index, 'ACCEPTED', 1, now,
]);

const offlinePackageRows = each((index) => [
  fixtureText('offline-package', index), 'ENGLISH_PHASE1', `10x-${index}`, 'PUBLISHED', 4096 + index,
  2, sha256(`${FIXTURE_ID}:offline-package:${index}`), `local-signature-${index}`, '1.0.0',
  raw('DATE_ADD(UTC_TIMESTAMP(6), INTERVAL 365 DAY)'), jsonValue([fixtureText('offline-part-1', index), fixtureText('offline-part-2', index)]), now,
]);

const offlineDownloadRows = each((index) => [
  fixtureText('offline-download', index), fixtureText('offline-package', index), TENANT_ID,
  SUBJECTS[index - 1], deviceIds[index - 1], 'COMPLETED', jsonValue([0, 1]), 4096 + index, now, now,
]);

const offlineEventRows = each((index) => [
  910000 + index, TENANT_ID, SUBJECTS[index - 1], deviceIds[index - 1], fixtureText('offline-batch', index),
  fixtureText('offline-event', index), 'LEARNING_PROGRESS_REPLAY', fixtureText('learning-task', index), 1, now,
  jsonValue({ fixtureId: FIXTURE_ID, progressPercent: 25 + index }), now,
]);

// Admin owner facts -------------------------------------------------------
const adminProjectionRows = each((index) => [
  stableUuid('admin-projection', index), 'LEARNING', fixtureText('plan', index), 1,
  jsonValue({ fixtureId: FIXTURE_ID, status: 'ACTIVE', redacted: true }), now,
]);

const supportTicketRows = each((index) => [
  stableUuid('support-ticket', index), TENANT_ID, SUBJECTS[index - 1],
  index % 3 === 0 ? 'RESOLVED' : 'OPEN', index % 2 ? 'NORMAL' : 'HIGH',
  `本地测试工单摘要 ${index}`, now, now, 'TECHNICAL', fixtureText('ticket-resource', index),
  sha256(`${FIXTURE_ID}:ticket:${index}`), raw('DATE_ADD(UTC_TIMESTAMP(6), INTERVAL 2 DAY)'),
  null, fixtureText('admin-audit', index), 1, jsonValue([]),
]);

const adminAuditRows = each((index) => [
  910000 + index, fixtureText('admin-audit', index), TENANT_ID, 'local-fixture-admin', 'TICKET_CREATE',
  fixtureText('ticket-resource', index), fixtureText('admin-command', index), fixtureText('admin-trace', index),
  stableUuid('decision', index), jsonValue({ fixtureId: FIXTURE_ID, redacted: true }), now, null,
  sha256(`${FIXTURE_ID}:admin-audit:${index}`),
]);

const adminMediaAuthorizationRows = each((index) => [
  TENANT_ID, SUBJECTS[index - 1], fixtureText('asset', index), `version-${index}`, 'LEARNING_PLAYBACK', now,
]);

const adminReviewStateRows = each((index) => [
  TENANT_ID, 'CONTENT', contentCodes[index - 1], '1', 'local-reviewer-1', 'local-reviewer-2', now,
]);

// Analytics owner facts ---------------------------------------------------
const analyticsEventReceiptRows = each((index) => [
  TENANT_ID, fixtureText('analytics-event', index), 'learning.review.recorded', 'v1',
  fixtureText('analytics-dedupe', index), sha256(`${FIXTURE_ID}:analytics:${index}`), 'metric-v1',
  'ACCEPTED', null, now,
]);

const analyticsEventJournalRows = each((index) => [
  TENANT_ID, fixtureText('analytics-event', index), 'learning.review.recorded', 'v1',
  fixtureText('analytics-dedupe', index), sha256(`${FIXTURE_ID}:analytics:${index}`), now,
  jsonValue({ fixtureId: FIXTURE_ID, domain: 'learning', value: 1 }),
]);

const analyticsMetricRows = each((index) => [
  TENANT_ID, fixtureText('metric', index), 'metric-v1', dateValue, `local-dimension-${index}`,
  'READY', index, index * 10, now, sha256(`${FIXTURE_ID}:metric:${index}`), 1, null, now,
]);

const analyticsRecomputeRows = each((index) => [
  fixtureText('recompute-job', index), TENANT_ID, 'metric-v1', dateValue, dateValue, 'COMPLETED',
  1, 1, 'LOCAL_FIXTURE_REPLAY', now, now,
]);

function buildStatements() {
  const statements = ['START TRANSACTION;'];

  statements.push(insert('iam_service', 'iam_principal',
    ['principal_id', 'tenant_id', 'status', 'adult_gate_status', 'adult_gate_version', 'adult_verified_at', 'created_at', 'updated_at'],
    iamPrincipalRows, ['status', 'adult_gate_status', 'adult_gate_version', 'adult_verified_at', 'updated_at']));
  statements.push(insert('iam_service', 'iam_account',
    ['principal_id', 'identifier', 'password_hash', 'roles', 'permissions', 'status', 'failed_attempts', 'locked_until', 'created_at', 'updated_at'],
    iamAccountRows, ['identifier', 'password_hash', 'roles', 'permissions', 'status', 'failed_attempts', 'locked_until', 'updated_at']));
  statements.push(insert('iam_service', 'iam_device',
    ['device_id', 'principal_id', 'device_public_id', 'device_id_hash', 'device_type', 'status', 'last_seen_at', 'revoked_at', 'revoke_reason', 'created_at'],
    iamDeviceRows, ['principal_id', 'device_public_id', 'device_id_hash', 'device_type', 'status', 'last_seen_at', 'revoked_at', 'revoke_reason']));
  statements.push(insert('iam_service', 'iam_session',
    ['session_id', 'principal_id', 'device_id', 'token_family_id', 'refresh_token_hash', 'status', 'issued_at', 'expires_at', 'rotated_at', 'revoked_at', 'revoke_reason', 'rotation'],
    iamSessionRows, ['principal_id', 'device_id', 'status', 'issued_at', 'expires_at', 'rotation']));
  statements.push(insert('iam_service', 'iam_consent',
    ['consent_id', 'principal_id', 'consent_type', 'policy_version', 'status', 'granted_at', 'revoked_at'],
    iamConsentRows, ['principal_id', 'consent_type', 'policy_version', 'status', 'granted_at', 'revoked_at']));
  statements.push(insert('iam_service', 'iam_decision_audit',
    ['decision_id', 'request_id', 'trace_id', 'principal_id', 'tenant_id', 'action_code', 'resource_type', 'resource_id_hash', 'policy_version', 'decision', 'reason_code', 'created_at'],
    iamDecisionAuditRows, ['request_id', 'trace_id', 'principal_id', 'action_code', 'resource_type', 'resource_id_hash', 'policy_version', 'decision', 'reason_code']));
  statements.push(insert('iam_service', 'iam_principal_role',
    ['principal_id', 'role_id', 'assigned_at', 'revoked_at'], iamPrincipalRoleRows,
    ['assigned_at', 'revoked_at']));

  statements.push(insert('learner_service', 'b25_learner_profile',
    ['principal_id', 'tenant_id', 'status', 'nickname', 'accent_pref', 'birth_year', 'age_confirmed', 'privacy_consent', 'terms_consent', 'ui_locale', 'content_locale', 'timezone', 'theme_mode', 'state_version', 'created_at', 'updated_at'],
    learnerProfileRows, ['tenant_id', 'status', 'nickname', 'accent_pref', 'birth_year', 'age_confirmed', 'privacy_consent', 'terms_consent', 'ui_locale', 'content_locale', 'timezone', 'theme_mode', 'state_version', 'updated_at']));
  statements.push(insert('learner_service', 'b25_learner_goal',
    ['principal_id', 'tenant_id', 'goal_code', 'target_level', 'daily_quota_minutes', 'status', 'idempotency_key'], learnerGoalRows));
  statements.push(insert('learner_service', 'b25_learner_preferences',
    ['principal_id', 'tenant_id', 'ui_locale', 'content_locale', 'timezone', 'theme_mode', 'high_contrast', 'motion_mode', 'idempotency_key'], learnerPreferenceRows));
  statements.push(insert('learner_service', 'b25_learner_daily_task',
    ['task_id', 'principal_id', 'tenant_id', 'content_code', 'title', 'task_type', 'minutes', 'task_status', 'task_order', 'idempotency_key', 'completed_at', 'updated_at'], learnerDailyTaskRows));
  statements.push(insert('learner_service', 'b25_learner_privacy_export',
    ['export_id', 'principal_id', 'tenant_id', 'policy_name', 'export_status', 'idempotency_key', 'created_at'], learnerPrivacyExportRows));
  statements.push(insert('learner_service', 'b25_onboarding_option',
    ['option_id', 'option_type', 'option_code', 'label', 'description', 'numeric_value', 'display_order', 'enabled', 'updated_at'], onboardingOptionRows));

  statements.push(insert('content_service', 'content_definition',
    ['content_id', 'tenant_id', 'content_code', 'kind', 'title', 'locale', 'target_level', 'goal_code', 'created_by', 'created_at', 'current_published_version_id', 'content_epoch', 'projection_version'], contentDefinitionRows));
  statements.push(insert('content_service', 'content_version',
    ['content_version_id', 'content_id', 'version_no', 'status', 'copyright_status', 'payload_hash', 'published_at', 'created_at', 'kind', 'payload_json', 'rights_source_code', 'rights_license_code', 'rights_allows_learning', 'rights_permitted_channels', 'rights_starts_at', 'rights_expires_at', 'authorization_evidence_ref', 'editor', 'release_note', 'first_reviewer', 'final_reviewer', 'publisher', 'archived_at', 'rollback_of_version_id', 'first_review_version', 'final_review_version', 'state_version'], contentVersionRows));
  statements.push(insert('content_service', 'content_public_projection',
    ['content_id', 'content_version_id', 'audience', 'kind', 'title', 'locale', 'target_level', 'goal_code', 'fields_json', 'content_hash', 'generated_at'], contentProjectionRows));
  statements.push(insert('content_service', 'b25_content_course',
    ['content_code', 'tenant_id', 'content_type', 'title', 'summary', 'content_locale', 'target_level', 'content_version_id', 'availability', 'rights_status', 'definition_json', 'published_at', 'updated_at'], b25CourseRows));
  statements.push(insert('content_service', 'b25_content_unit',
    ['unit_id', 'course_code', 'unit_code', 'unit_order', 'title_key', 'content_version', 'availability', 'rights_status', 'published_at'], b25UnitRows));
  statements.push(insert('content_service', 'b25_content_vocabulary',
    ['vocabulary_id', 'unit_code', 'word_normalized', 'meaning_key', 'cefr_level', 'content_version', 'availability', 'audio_ref'], b25VocabularyRows));
  statements.push(insert('content_service', 'b25_content_item',
    ['item_id', 'content_code', 'tenant_id', 'item_type', 'display_order', 'prompt', 'options_json', 'answer_rule_json', 'media_ref'], b25ItemRows));
  statements.push(insert('content_service', 'b25_content_answer_rule',
    ['rule_id', 'rule_ref', 'rule_version', 'algorithm_code', 'rule_definition_json', 'status'], b25AnswerRuleRows));
  statements.push(insert('content_service', 'b3_content_experience',
    ['experience_id', 'tenant_id', 'domain_code', 'resource_type', 'resource_key', 'content_version_id', 'availability', 'payload_json'], b3ExperienceRows));
  statements.push(insert('content_service', 'content_public_site_facet',
    ['facet_id', 'ui_locale', 'facet_type', 'status', 'payload_json', 'projection_version', 'published_at', 'expires_at', 'updated_at'], publicFacetRows));
  statements.push(insert('content_service', 'b2_content_chunk',
    ['chunk_id', 'tenant_id', 'canonical_text', 'chunk_type', 'meaning_cn', 'usage_note', 'scenario_code', 'examples_json', 'content_version', 'availability'], b2ChunkRows));

  statements.push(insert('learning_service', 'b25_learning_plan',
    ['plan_id', 'principal_id', 'tenant_id', 'status', 'target_minutes', 'plan_version', 'updated_at'], b25LearningPlanRows));
  statements.push(insert('learning_service', 'b25_learning_srs_state',
    ['principal_id', 'item_id', 'tenant_id', 'stage', 'due_at', 'interval_days', 'ease_factor', 'review_count', 'last_idempotency_key', 'updated_at'], b25SrsRows));
  statements.push(insert('learning_service', 'b25_learning_review',
    ['review_id', 'principal_id', 'tenant_id', 'item_id', 'quality', 'idempotency_key', 'created_at'], b25ReviewRows));
  statements.push(insert('learning_service', 'b25_learning_continue_context',
    ['tenant_id', 'principal_id', 'module_id', 'module_label', 'lesson_id', 'lesson_title', 'step_index', 'total_steps', 'elapsed_time_ms', 'status', 'last_idempotency_key', 'updated_at'], continueContextRows));
  statements.push(insert('learning_service', 'b3_learning_interaction',
    ['interaction_id', 'tenant_id', 'principal_id', 'domain_code', 'action_code', 'resource_key', 'idempotency_key', 'payload_json', 'result_json', 'status', 'created_at', 'updated_at'], b3InteractionRows));
  statements.push(insert('learning_service', 'b2_learner_expression',
    ['expression_id', 'tenant_id', 'principal_id', 'source_type', 'source_ref', 'source_content_version', 'sentence_text', 'translation_cn', 'selected_text', 'range_start', 'range_end', 'want_to_say', 'private_note', 'tag_ids_json', 'status', 'create_idempotency_key', 'last_idempotency_key', 'created_at', 'updated_at'], expressionRows));
  statements.push(insert('learning_service', 'b25_learning_library_entry',
    ['entry_id', 'principal_id', 'tenant_id', 'item_type', 'item_id', 'source_type', 'collection_status', 'idempotency_key', 'created_at', 'updated_at'], libraryRows));
  statements.push(insert('learning_service', 'learning_runtime_plan',
    ['plan_id', 'tenant_id', 'principal_id', 'user_id', 'target_id', 'goal_code', 'content_version_id', 'content_epoch', 'time_zone_id', 'daily_quota_minutes', 'status', 'plan_version', 'created_at', 'updated_at'], runtimePlanRows));
  statements.push(insert('learning_service', 'learning_runtime_task',
    ['learning_task_id', 'learning_plan_id', 'tenant_id', 'principal_id', 'user_id', 'task_type', 'content_item_id', 'content_version_id', 'planned_local_date', 'task_status', 'progress_percent', 'completion_version', 'last_updated_at'], runtimeTaskRows));
  statements.push(insert('learning_service', 'learning_runtime_progress',
    ['tenant_id', 'principal_id', 'user_id', 'plan_id', 'task_id', 'completed_units', 'total_units', 'study_seconds', 'progress_version', 'last_activity_at'], runtimeProgressRows));
  statements.push(insert('learning_service', 'learning_runtime_srs_state',
    ['srs_state_id', 'tenant_id', 'principal_id', 'user_id', 'item_type', 'target_id', 'item_id', 'content_version_id', 'stage', 'easiness_factor', 'repetitions', 'interval_days', 'lapse_count', 'time_zone_id', 'due_at', 'last_reviewed_at', 'state_version'], runtimeSrsRows));
  statements.push(insert('learning_service', 'learning_runtime_review_event',
    ['review_event_id', 'tenant_id', 'principal_id', 'user_id', 'item_type', 'target_id', 'item_id', 'content_version_id', 'algorithm_version', 'srs_state_id', 'state_version', 'raw_quality', 'effective_quality', 'confidence', 'reviewed_at', 'client_event_id'], runtimeReviewRows));
  statements.push(insert('learning_service', 'learning_runtime_mastery_projection',
    ['tenant_id', 'principal_id', 'user_id', 'item_type', 'item_id', 'content_version_id', 'stage', 'score', 'attempt_count', 'correct_count', 'projection_version', 'verification_stage', 'rule_version', 'last_evidence_at', 'applied_evidence_ids_json'], runtimeMasteryRows));
  statements.push(insert('learning_service', 'learning_runtime_review_queue_snapshot',
    ['schedule_snapshot_id', 'tenant_id', 'principal_id', 'user_id', 'local_date', 'time_zone_id', 'rules_version', 'item_count', 'created_at'], runtimeQueueSnapshotRows));
  statements.push(insert('learning_service', 'learning_runtime_review_queue_item',
    ['schedule_snapshot_id', 'tenant_id', 'principal_id', 'user_id', 'item_order', 'srs_state_id', 'item_type', 'item_id', 'due_at'], runtimeQueueItemRows));

  statements.push(insert('assessment_service', 'b25_assessment_item_rule',
    ['item_id', 'content_code', 'content_version_id', 'prompt', 'options_json', 'dimension', 'difficulty', 'answer_rule_json', 'active', 'updated_at'], b25AssessmentRuleRows));
  statements.push(insert('assessment_service', 'b25_assessment_session',
    ['session_id', 'principal_id', 'tenant_id', 'content_code', 'status', 'answers_json', 'score', 'report_id', 'idempotency_key', 'created_at', 'updated_at'], b25AssessmentSessionRows));
  statements.push(insert('assessment_service', 'b25_assessment_report',
    ['report_id', 'session_id', 'principal_id', 'tenant_id', 'cefr_level', 'score', 'radar_json', 'mistakes_json', 'report_version', 'created_at'], b25AssessmentReportRows));
  statements.push(insert('assessment_service', 'b10_assessment_session',
    ['session_id', 'principal_id', 'tenant_id', 'mode', 'status', 'content_code', 'content_version_id', 'content_epoch', 'snapshot_id', 'snapshot_hash', 'items_json', 'answers_json', 'state_version', 'attempt_count', 'last_attempt_id', 'last_report_id', 'idempotency_key', 'started_at', 'expires_at', 'updated_at'], b10SessionRows));
  statements.push(insert('assessment_service', 'b10_assessment_attempt',
    ['attempt_id', 'session_id', 'principal_id', 'tenant_id', 'attempt_version', 'submission_id', 'status', 'item_count', 'submission_digest', 'score_bucket', 'mistake_codes_json', 'report_id', 'created_at'], b10AttemptRows));
  statements.push(insert('assessment_service', 'b10_assessment_checkpoint',
    ['attempt_id', 'session_id', 'principal_id', 'tenant_id', 'checkpoint_version', 'item_cursor', 'completed_item_ids_json', 'checkpoint_digest', 'saved_at'], b10CheckpointRows));
  statements.push(insert('assessment_service', 'b10_assessment_report',
    ['report_id', 'attempt_id', 'session_id', 'principal_id', 'tenant_id', 'report_version', 'status', 'score_bucket', 'mistake_codes_json', 'mastery_signal', 'pin_json', 'generated_at'], b10ReportRows));
  statements.push(insert('assessment_service', 'assessment_session',
    ['session_id', 'subject_id', 'tenant_id', 'session_type', 'session_status', 'created_at', 'deadline_at', 'started_at', 'closed_at'], legacyAssessmentSessionRows));
  statements.push(insert('assessment_service', 'assessment_session_exercise',
    ['session_id', 'exercise_id', 'position_no', 'source_bucket', 'verification_stage', 'snapshot_json'], legacyAssessmentSessionExerciseRows));
  statements.push(insert('assessment_service', 'assessment_attempt_fact',
    ['attempt_id', 'session_id', 'exercise_id', 'submission_id', 'subject_id', 'tenant_id', 'client_submission_id', 'revision', 'answer_hash', 'submitted_at'], legacyAssessmentAttemptFactRows));
  statements.push(insert('assessment_service', 'assessment_answer',
    ['attempt_id', 'answer_json', 'created_at'], legacyAssessmentAnswerRows));
  statements.push(insert('assessment_service', 'assessment_score_fact',
    ['attempt_id', 'scoring_status', 'earned_score', 'max_score', 'correct', 'error_causes_json', 'rule_version', 'score_breakdown_json', 'updated_at'], legacyAssessmentScoreRows));
  statements.push(insert('assessment_service', 'assessment_checkpoint_fact',
    ['checkpoint_id', 'session_id', 'checkpoint_seq', 'current_exercise_id', 'client_state_hash', 'monotonic_elapsed_ms', 'saved_at'], legacyAssessmentCheckpointRows));
  statements.push(insert('assessment_service', 'assessment_report',
    ['report_id', 'session_id', 'subject_id', 'tenant_id', 'report_type', 'report_status', 'score', 'max_score', 'completed_count', 'total_count', 'calculation_version', 'score_policy_version', 'generated_at', 'metrics_json', 'evidence_json', 'mistakes_json'], legacyAssessmentReportRows));
  statements.push(insert('assessment_service', 'assessment_mistake',
    ['mistake_id', 'subject_id', 'tenant_id', 'item_id', 'question_id', 'error_category', 'rule_version', 'answer_hash', 'wrong_count', 'mistake_status', 'mastery_status', 'first_error_at', 'last_error_at', 'next_action_at', 'reason_trace_json'], legacyAssessmentMistakeRows));
  statements.push(insert('assessment_service', 'assessment_attempt',
    ['attempt_id', 'subject_id', 'tenant_id', 'assessment_version', 'attempt_status', 'answer_digest', 'score_bucket', 'idempotency_key', 'created_at', 'updated_at'], legacyAssessmentAttemptRows));
  statements.push(insert('assessment_service', 'assessment_checkpoint',
    ['checkpoint_id', 'attempt_id', 'checkpoint_seq', 'payload_hash', 'created_at'], legacyAssessmentCheckpointRowsV1));

  statements.push(insert('media_service', 'media_asset',
    ['asset_id', 'tenant_id', 'owner_subject', 'content_version_id', 'asset_version', 'checksum_sha256', 'size_bytes', 'rights_status', 'asset_status', 'created_at', 'updated_at', 'asset_key', 'kind', 'mime_type', 'storage_provider', 'bucket_name', 'object_key', 'object_version', 'supports_range', 'chunk_size_bytes', 'part_count', 'transcoding_status', 'content_role', 'segment_id', 'rights_id', 'license_code', 'permitted_channels', 'rights_starts_at', 'rights_expires_at', 'allow_offline', 'authorization_evidence_ref'], mediaAssetRows));
  statements.push(insert('media_service', 'media_rendition',
    ['rendition_id', 'asset_id', 'rendition_key', 'rendition_version', 'rendition_status', 'object_reference', 'created_at', 'mime_type', 'checksum_sha256', 'size_bytes', 'supports_range', 'failure_code', 'object_version'], mediaRenditionRows));

  statements.push(insert('gamification_service', 'xp_ledger',
    ['ledger_id', 'subject_id', 'tenant_id', 'source_event_id', 'delta', 'balance_after', 'created_at'], xpRows));
  statements.push(insert('gamification_service', 'coin_ledger',
    ['ledger_id', 'subject_id', 'tenant_id', 'source_event_id', 'delta', 'balance_after', 'created_at'], coinRows));
  statements.push(insert('gamification_service', 'reward_grant',
    ['grant_id', 'subject_id', 'tenant_id', 'reward_key', 'probability_version', 'claim_status', 'idempotency_key', 'created_at', 'source_event_id', 'outcome_code', 'claimed_at'], rewardRows));
  statements.push(insert('gamification_service', 'gamification_event_record',
    ['event_id', 'subject_id', 'fingerprint', 'response_json', 'created_at'], gamificationEventRows));
  statements.push(insert('gamification_service', 'gamification_active_date',
    ['subject_id', 'active_date', 'created_at'], activeDateRows));
  statements.push(insert('gamification_service', 'gamification_season_fact',
    ['season_id', 'event_id', 'subject_id', 'points', 'rule_version', 'occurred_at', 'recorded_at'], seasonRows));
  statements.push(insert('gamification_service', 'gamification_user_timezone',
    ['subject_id', 'time_zone', 'updated_at'], timezoneRows));
  statements.push(insert('gamification_service', 'gamification_feature_state',
    ['subject_id', 'feature_key', 'version', 'state_json', 'updated_at'], featureStateRows));
  statements.push(insert('gamification_service', 'gamification_game_session',
    ['session_id', 'subject_id', 'game_code', 'state', 'session_json', 'created_at', 'updated_at'], gameSessionRows));

  statements.push(insert('social_service', 'soc_study_room',
    ['id', 'room_id', 'tenant_id', 'owner_subject', 'theme_code', 'display_name_key', 'capacity', 'state', 'room_version', 'created_at', 'updated_at'], socialRoomRows));
  statements.push(insert('social_service', 'soc_room_member',
    ['id', 'membership_id', 'room_id', 'tenant_id', 'subject_id', 'state', 'presence_state', 'room_visibility', 'privacy_version', 'joined_at', 'left_at', 'last_activity_at'], socialMemberRows));
  statements.push(insert('social_service', 'soc_seat_lease',
    ['id', 'room_id', 'tenant_id', 'seat_index', 'subject_id', 'state', 'lease_id', 'lease_version', 'lease_expires_at', 'disconnected_at', 'last_activity_at', 'release_reason', 'released_at'], socialSeatRows));
  statements.push(insert('social_service', 'soc_focus_state',
    ['id', 'focus_id', 'tenant_id', 'room_id', 'subject_id', 'seat_index', 'lease_id', 'duration_minutes', 'focus_tag_code', 'state', 'started_at', 'ended_at', 'server_elapsed_seconds', 'qualified_seconds'], socialFocusRows));
  statements.push(insert('social_service', 'soc_interaction',
    ['id', 'event_id', 'client_event_id', 'tenant_id', 'room_id', 'sender_subject_id', 'target_subject_id', 'target_seat_index', 'preset_code', 'state', 'created_at', 'delivered_at'], socialInteractionRows));
  statements.push(insert('social_service', 'soc_leaderboard_projection',
    ['id', 'tenant_id', 'leaderboard_kind', 'period_type', 'period_start', 'subject_id', 'score', 'qualified_units', 'source_watermark', 'projection_state', 'snapshot_version', 'last_projected_at'], socialLeaderboardRows));
  statements.push(insert('social_service', 'soc_report',
    ['id', 'report_id', 'tenant_id', 'room_id', 'reporter_subject_id', 'target_subject_id', 'target_seat_index', 'reason_code', 'state', 'client_event_id', 'created_at', 'updated_at'], socialReportRows));

  statements.push(insert('commerce_service', 'commerce_sku',
    ['tenant_id', 'sku_id', 'version', 'title', 'entitlement_code', 'currency', 'amount_minor', 'status', 'effective_from', 'created_at'], commerceSkuRows));
  statements.push(insert('commerce_service', 'commerce_price_snapshot',
    ['tenant_id', 'sku_id', 'sku_version', 'title', 'entitlement_code', 'currency', 'amount_minor', 'captured_at'], commercePriceRows));
  statements.push(insert('commerce_service', 'commerce_order',
    ['tenant_id', 'order_id', 'subject_id', 'sku_id', 'sku_version', 'sku_title', 'entitlement_code', 'provider', 'currency', 'amount_minor', 'status', 'created_at', 'updated_at', 'paid_at'], commerceOrderRows));
  statements.push(insert('commerce_service', 'commerce_payment_attempt',
    ['tenant_id', 'attempt_id', 'order_id', 'subject_id', 'provider', 'provider_reference', 'status', 'amount_minor', 'currency', 'created_at', 'updated_at'], commercePaymentAttemptRows));
  statements.push(insert('commerce_service', 'commerce_payment_callback',
    ['tenant_id', 'provider', 'provider_event_id', 'order_id', 'provider_reference', 'payload_hash', 'amount_minor', 'currency', 'verification_state', 'received_at'], commercePaymentCallbackRows));
  statements.push(insert('commerce_service', 'commerce_entitlement',
    ['tenant_id', 'entitlement_id', 'subject_id', 'sku_id', 'sku_version', 'sku_title', 'entitlement_code', 'source_type', 'source_ref', 'currency', 'amount_minor', 'status', 'active_from', 'expires_at', 'reason_code'], commerceEntitlementRows));
  statements.push(insert('commerce_service', 'commerce_activation_code',
    ['tenant_id', 'code_hash', 'sku_id', 'sku_version', 'sku_title', 'entitlement_code', 'amount_minor', 'currency', 'status', 'expires_at', 'redeemed_by', 'redeemed_at'], commerceActivationRows));
  statements.push(insert('commerce_service', 'commerce_refund',
    ['tenant_id', 'refund_id', 'order_id', 'subject_id', 'provider', 'amount_minor', 'currency', 'status', 'reason_code', 'created_at', 'updated_at', 'completed_at'], commerceRefundRows));
  statements.push(insert('commerce_service', 'commerce_refund_callback',
    ['tenant_id', 'provider', 'provider_event_id', 'refund_id', 'payload_hash', 'amount_minor', 'currency', 'verification_state', 'received_at'], commerceRefundCallbackRows));
  statements.push(insert('commerce_service', 'commerce_audit_record',
    ['audit_id', 'tenant_id', 'actor_ref', 'action', 'aggregate_type', 'aggregate_id', 'outcome', 'attributes_json', 'occurred_at'], commerceAuditRows));
  statements.push(insert('commerce_service', 'commerce_reconciliation_record',
    ['tenant_id', 'reconciliation_id', 'order_id', 'state', 'expected_amount_minor', 'paid_amount_minor', 'refunded_amount_minor', 'entitlement_state', 'repair_required', 'checked_at'], commerceReconciliationRows));

  statements.push(insert('notification_service', 'notification_message',
    ['notification_id', 'subject_id', 'tenant_id', 'template_key', 'notification_status', 'idempotency_key', 'notification_type', 'channel', 'template_version', 'title', 'safe_body', 'content_version', 'locale', 'structured_attributes_json', 'not_before', 'template_only', 'message_version', 'created_at'], notificationMessageRows));
  statements.push(insert('notification_service', 'offline_sync_cursor',
    ['cursor_id', 'subject_id', 'tenant_id', 'device_id', 'client_seq', 'cursor_version', 'updated_at', 'vector_json'], offlineCursorRows));
  statements.push(insert('notification_service', 'b25_notification_preference',
    ['principal_id', 'tenant_id', 'in_app_enabled', 'learning_reminder_enabled', 'marketing_enabled', 'ui_locale', 'idempotency_key', 'updated_at'], b25NotificationPreferenceRows));
  statements.push(insert('notification_service', 'b25_notification_message',
    ['message_id', 'principal_id', 'tenant_id', 'template_code', 'status', 'created_at'], b25NotificationMessageRows));
  statements.push(insert('notification_service', 'notification_preference',
    ['tenant_id', 'principal_id', 'notification_type', 'channel', 'enabled', 'locale', 'version_no', 'updated_at'], notificationPreferenceRows));
  statements.push(insert('notification_service', 'notification_delivery_attempt',
    ['attempt_id', 'message_id', 'channel', 'attempt_number', 'status', 'failure_code', 'next_attempt_at', 'request_id', 'trace_id', 'occurred_at', 'retryable'], deliveryAttemptRows));
  statements.push(insert('notification_service', 'notification_consent_fact',
    ['tenant_id', 'principal_id', 'channel', 'granted', 'source', 'idempotency_key', 'updated_at'], notificationConsentRows));
  statements.push(insert('notification_service', 'notification_audit_event',
    ['audit_id', 'action', 'outcome', 'actor_id', 'tenant_id', 'principal_id', 'aggregate_type', 'aggregate_id', 'request_id', 'trace_id', 'occurred_at', 'attributes_json'], notificationAuditRows));
  statements.push(insert('notification_service', 'notification_trusted_event_receipt',
    ['consumer_name', 'event_id', 'event_name', 'dedupe_key', 'fingerprint', 'status', 'attempt', 'reason_code', 'message_id', 'workflow_task_id', 'first_seen_at', 'updated_at'], trustedReceiptRows));
  statements.push(insert('notification_service', 'notification_workflow_task',
    ['task_id', 'tenant_id', 'principal_id', 'action', 'aggregate_type', 'aggregate_id', 'state', 'attempt', 'max_attempts', 'reason_code', 'next_run_at', 'updated_at'], notificationWorkflowRows));
  statements.push(insert('notification_service', 'offline_sync_receipt',
    ['tenant_id', 'subject_id', 'device_id', 'client_event_id', 'fingerprint', 'client_seq', 'status', 'server_version', 'accepted_at'], offlineReceiptRows));
  statements.push(insert('notification_service', 'notification_offline_package',
    ['package_id', 'package_code', 'version_code', 'state', 'size_bytes', 'part_count', 'sha256', 'signature', 'min_client_version', 'expires_at', 'signed_part_urls_json', 'created_at'], offlinePackageRows));
  statements.push(insert('notification_service', 'notification_offline_download',
    ['download_id', 'package_id', 'tenant_id', 'principal_id', 'device_id', 'state', 'completed_parts_json', 'downloaded_bytes', 'created_at', 'updated_at'], offlineDownloadRows));
  statements.push(insert('notification_service', 'notification_offline_event',
    ['event_seq', 'tenant_id', 'principal_id', 'device_id', 'client_batch_id', 'client_event_id', 'event_type', 'entity_id', 'entity_version', 'occurred_at', 'payload_json', 'created_at'], offlineEventRows));

  statements.push(insert('admin_ops_service', 'admin_projection',
    ['projection_id', 'domain_name', 'resource_ref', 'projection_version', 'redacted_payload', 'updated_at'], adminProjectionRows));
  statements.push(insert('admin_ops_service', 'support_ticket',
    ['ticket_id', 'tenant_id', 'requester_subject', 'ticket_status', 'priority', 'redacted_summary', 'created_at', 'updated_at', 'category', 'resource_ref', 'description_fingerprint', 'sla_due_at', 'assignee_subject', 'last_audit_id', 'ticket_version', 'attachments_json'], supportTicketRows));
  statements.push(insert('admin_ops_service', 'admin_audit_record',
    ['sequence_id', 'audit_id', 'tenant_ref', 'actor_ref', 'operation', 'resource_ref', 'command_id', 'trace_id', 'decision_id', 'safe_context', 'occurred_at', 'previous_hash', 'record_hash'], adminAuditRows));
  statements.push(insert('admin_ops_service', 'admin_media_authorization',
    ['tenant_id', 'subject_id', 'object_ref', 'object_version', 'purpose_code', 'granted_at'], adminMediaAuthorizationRows));
  statements.push(insert('admin_ops_service', 'admin_review_state',
    ['tenant_id', 'domain_name', 'resource_ref', 'projection_version', 'first_reviewer_subject', 'final_reviewer_subject', 'updated_at'], adminReviewStateRows));

  statements.push(insert('analytics_service', 'analytics_event_receipt',
    ['tenant_id', 'event_id', 'event_name', 'schema_version', 'dedupe_key', 'payload_hash', 'metric_version', 'receipt_state', 'reason_code', 'received_at'], analyticsEventReceiptRows));
  statements.push(insert('analytics_service', 'analytics_event_journal',
    ['tenant_id', 'event_id', 'event_name', 'schema_version', 'dedupe_key', 'payload_hash', 'occurred_at', 'sanitized_payload_json'], analyticsEventJournalRows));
  statements.push(insert('analytics_service', 'analytics_metric_projection',
    ['tenant_id', 'metric_id', 'metric_version', 'period_start', 'dimension_key', 'projection_state', 'event_count', 'total_value', 'last_occurred_at', 'source_watermark', 'projection_version', 'error_code', 'updated_at'], analyticsMetricRows));
  statements.push(insert('analytics_service', 'analytics_recompute_job',
    ['job_id', 'tenant_id', 'metric_version', 'from_date', 'to_date', 'job_state', 'replayed_event_count', 'projection_count', 'reason_code', 'started_at', 'completed_at'], analyticsRecomputeRows));

  statements.push('COMMIT;');
  return statements.filter(Boolean);
}

export function buildFixtureSql() {
  return `${buildStatements().join('\n\n')}\n`;
}

const ownerPredicate = (column) => `${column} IN (${subjectsSql})`;
const prefixPredicate = (column) => `${column} LIKE '${FIXTURE_PREFIX}-%'`;

export const TABLE_CHECKS = [
  ['iam.principal', 'iam_service.iam_principal', ownerPredicate('principal_id'), 10],
  ['iam.account', 'iam_service.iam_account', ownerPredicate('principal_id'), 10],
  ['iam.device', 'iam_service.iam_device', ownerPredicate('principal_id'), 10],
  ['iam.session', 'iam_service.iam_session', ownerPredicate('principal_id'), 10],
  ['iam.consent', 'iam_service.iam_consent', ownerPredicate('principal_id'), 10],
  ['iam.decision-audit', 'iam_service.iam_decision_audit', ownerPredicate('principal_id'), 10],
  ['iam.principal-role', 'iam_service.iam_principal_role', ownerPredicate('principal_id'), 10],
  ['learner.profile', 'learner_service.b25_learner_profile', ownerPredicate('principal_id'), 10],
  ['learner.goal', 'learner_service.b25_learner_goal', ownerPredicate('principal_id'), 10],
  ['learner.preferences', 'learner_service.b25_learner_preferences', ownerPredicate('principal_id'), 10],
  ['learner.daily-task', 'learner_service.b25_learner_daily_task', ownerPredicate('principal_id'), 10],
  ['learner.privacy-export', 'learner_service.b25_learner_privacy_export', ownerPredicate('principal_id'), 10],
  ['learner.onboarding-option', 'learner_service.b25_onboarding_option', prefixPredicate('option_code'), 10],
  ['content.definition', 'content_service.content_definition', prefixPredicate('content_code'), 10],
  ['content.version', 'content_service.content_version', prefixPredicate('content_id'), 10],
  ['content.public-projection', 'content_service.content_public_projection', prefixPredicate('content_id'), 10],
  ['content.course', 'content_service.b25_content_course', prefixPredicate('content_code'), 10],
  ['content.unit', 'content_service.b25_content_unit', prefixPredicate('unit_code'), 10],
  ['content.vocabulary', 'content_service.b25_content_vocabulary', prefixPredicate('vocabulary_id'), 10],
  ['content.item', 'content_service.b25_content_item', prefixPredicate('item_id'), 10],
  ['content.answer-rule', 'content_service.b25_content_answer_rule', prefixPredicate('rule_ref'), 10],
  ['content.b3-experience', 'content_service.b3_content_experience', prefixPredicate('resource_key'), 140],
  ['content.public-site-facet', 'content_service.content_public_site_facet', prefixPredicate('facet_id'), 10],
  ['content.b2-chunk', 'content_service.b2_content_chunk', `content_version = '${FIXTURE_ID}'`, 10],
  ['learning.b25-plan', 'learning_service.b25_learning_plan', ownerPredicate('principal_id'), 10],
  ['learning.b25-srs', 'learning_service.b25_learning_srs_state', ownerPredicate('principal_id'), 10],
  ['learning.b25-review', 'learning_service.b25_learning_review', ownerPredicate('principal_id'), 10],
  ['learning.continue-context', 'learning_service.b25_learning_continue_context', ownerPredicate('principal_id'), 10],
  ['learning.b3-interaction', 'learning_service.b3_learning_interaction', ownerPredicate('principal_id'), 10],
  ['learning.b2-expression', 'learning_service.b2_learner_expression', ownerPredicate('principal_id'), 10],
  ['learning.library', 'learning_service.b25_learning_library_entry', ownerPredicate('principal_id'), 10],
  ['learning.runtime-plan', 'learning_service.learning_runtime_plan', ownerPredicate('principal_id'), 10],
  ['learning.runtime-task', 'learning_service.learning_runtime_task', ownerPredicate('principal_id'), 10],
  ['learning.runtime-progress', 'learning_service.learning_runtime_progress', ownerPredicate('principal_id'), 10],
  ['learning.runtime-srs', 'learning_service.learning_runtime_srs_state', ownerPredicate('principal_id'), 10],
  ['learning.runtime-review', 'learning_service.learning_runtime_review_event', ownerPredicate('principal_id'), 10],
  ['learning.runtime-mastery', 'learning_service.learning_runtime_mastery_projection', ownerPredicate('principal_id'), 10],
  ['learning.runtime-queue-snapshot', 'learning_service.learning_runtime_review_queue_snapshot', ownerPredicate('principal_id'), 10],
  ['learning.runtime-queue-item', 'learning_service.learning_runtime_review_queue_item', ownerPredicate('principal_id'), 10],
  ['assessment.b25-item-rule', 'assessment_service.b25_assessment_item_rule', prefixPredicate('item_id'), 10],
  ['assessment.b25-session', 'assessment_service.b25_assessment_session', ownerPredicate('principal_id'), 10],
  ['assessment.b25-report', 'assessment_service.b25_assessment_report', ownerPredicate('principal_id'), 10],
  ['assessment.b10-session', 'assessment_service.b10_assessment_session', ownerPredicate('principal_id'), 10],
  ['assessment.b10-attempt', 'assessment_service.b10_assessment_attempt', ownerPredicate('principal_id'), 10],
  ['assessment.b10-checkpoint', 'assessment_service.b10_assessment_checkpoint', ownerPredicate('principal_id'), 10],
  ['assessment.b10-report', 'assessment_service.b10_assessment_report', ownerPredicate('principal_id'), 10],
  ['assessment.legacy-session', 'assessment_service.assessment_session', ownerPredicate('subject_id'), 10],
  ['assessment.legacy-session-exercise', 'assessment_service.assessment_session_exercise', `session_id IN (${listSql(legacyAssessmentSessionIds)})`, 10],
  ['assessment.legacy-attempt-fact', 'assessment_service.assessment_attempt_fact', ownerPredicate('subject_id'), 10],
  ['assessment.legacy-answer', 'assessment_service.assessment_answer', `attempt_id IN (${listSql(legacyAssessmentAttemptIds)})`, 10],
  ['assessment.legacy-score', 'assessment_service.assessment_score_fact', `attempt_id IN (${listSql(legacyAssessmentAttemptIds)})`, 10],
  ['assessment.legacy-checkpoint-fact', 'assessment_service.assessment_checkpoint_fact', `session_id IN (${listSql(legacyAssessmentSessionIds)})`, 10],
  ['assessment.legacy-report', 'assessment_service.assessment_report', ownerPredicate('subject_id'), 10],
  ['assessment.legacy-mistake', 'assessment_service.assessment_mistake', `rule_version = '${FIXTURE_ID}'`, 10],
  ['assessment.legacy-attempt', 'assessment_service.assessment_attempt', ownerPredicate('subject_id'), 10],
  ['assessment.legacy-checkpoint', 'assessment_service.assessment_checkpoint', `attempt_id IN (${listSql(legacyAssessmentAttemptIds)})`, 10],
  ['media.asset', 'media_service.media_asset', prefixPredicate('asset_key'), 10],
  ['media.rendition', 'media_service.media_rendition', prefixPredicate('rendition_key'), 10],
  ['gamification.xp', 'gamification_service.xp_ledger', ownerPredicate('subject_id'), 10],
  ['gamification.coin', 'gamification_service.coin_ledger', ownerPredicate('subject_id'), 10],
  ['gamification.reward', 'gamification_service.reward_grant', ownerPredicate('subject_id'), 10],
  ['gamification.event', 'gamification_service.gamification_event_record', ownerPredicate('subject_id'), 10],
  ['gamification.active-date', 'gamification_service.gamification_active_date', ownerPredicate('subject_id') + ` AND active_date = '${FIXTURE_DATE}'`, 10],
  ['gamification.season', 'gamification_service.gamification_season_fact', ownerPredicate('subject_id'), 10],
  ['gamification.timezone', 'gamification_service.gamification_user_timezone', ownerPredicate('subject_id'), 10],
  ...GAMIFICATION_FEATURE_KEYS.map((featureKey) => [
    `gamification.feature-state.${featureKey}`,
    'gamification_service.gamification_feature_state',
    ownerPredicate('subject_id') + ` AND feature_key = '${featureKey}'`,
    10,
  ]),
  ['gamification.game-session', 'gamification_service.gamification_game_session', prefixPredicate('session_id'), 10],
  ['social.room', 'social_service.soc_study_room', prefixPredicate('room_id'), 10],
  ['social.member', 'social_service.soc_room_member', prefixPredicate('membership_id'), 10],
  ['social.seat', 'social_service.soc_seat_lease', prefixPredicate('lease_id'), 10],
  ['social.focus', 'social_service.soc_focus_state', prefixPredicate('focus_id'), 10],
  ['social.interaction', 'social_service.soc_interaction', prefixPredicate('event_id'), 10],
  ['social.leaderboard', 'social_service.soc_leaderboard_projection', prefixPredicate('source_watermark'), 10],
  ['social.report', 'social_service.soc_report', prefixPredicate('report_id'), 10],
  ['commerce.sku', 'commerce_service.commerce_sku', prefixPredicate('sku_id'), 10],
  ['commerce.price-snapshot', 'commerce_service.commerce_price_snapshot', prefixPredicate('sku_id'), 10],
  ['commerce.order', 'commerce_service.commerce_order', prefixPredicate('order_id'), 10],
  ['commerce.payment-attempt', 'commerce_service.commerce_payment_attempt', prefixPredicate('attempt_id'), 10],
  ['commerce.payment-callback', 'commerce_service.commerce_payment_callback', prefixPredicate('provider_event_id'), 10],
  ['commerce.entitlement', 'commerce_service.commerce_entitlement', prefixPredicate('entitlement_id'), 10],
  ['commerce.activation-code', 'commerce_service.commerce_activation_code', `sku_id LIKE '${FIXTURE_PREFIX}-%'`, 10],
  ['commerce.refund', 'commerce_service.commerce_refund', prefixPredicate('refund_id'), 10],
  ['commerce.refund-callback', 'commerce_service.commerce_refund_callback', prefixPredicate('provider_event_id'), 10],
  ['commerce.audit', 'commerce_service.commerce_audit_record', prefixPredicate('audit_id'), 10],
  ['commerce.reconciliation', 'commerce_service.commerce_reconciliation_record', prefixPredicate('reconciliation_id'), 10],
  ['notification.message', 'notification_service.notification_message', ownerPredicate('subject_id'), 10],
  ['notification.offline-cursor', 'notification_service.offline_sync_cursor', ownerPredicate('subject_id'), 10],
  ['notification.b25-preference', 'notification_service.b25_notification_preference', ownerPredicate('principal_id'), 10],
  ['notification.b25-message', 'notification_service.b25_notification_message', ownerPredicate('principal_id'), 10],
  ['notification.preference', 'notification_service.notification_preference', ownerPredicate('principal_id'), 10],
  ['notification.delivery-attempt', 'notification_service.notification_delivery_attempt', prefixPredicate('attempt_id'), 10],
  ['notification.consent', 'notification_service.notification_consent_fact', ownerPredicate('principal_id'), 10],
  ['notification.audit', 'notification_service.notification_audit_event', ownerPredicate('principal_id'), 10],
  ['notification.trusted-receipt', 'notification_service.notification_trusted_event_receipt', prefixPredicate('event_id'), 10],
  ['notification.workflow', 'notification_service.notification_workflow_task', ownerPredicate('principal_id'), 10],
  ['notification.offline-receipt', 'notification_service.offline_sync_receipt', ownerPredicate('subject_id'), 10],
  ['notification.offline-package', 'notification_service.notification_offline_package', prefixPredicate('package_id'), 10],
  ['notification.offline-download', 'notification_service.notification_offline_download', ownerPredicate('principal_id'), 10],
  ['notification.offline-event', 'notification_service.notification_offline_event', ownerPredicate('principal_id'), 10],
  ['admin.projection', 'admin_ops_service.admin_projection', prefixPredicate('resource_ref'), 10],
  ['admin.ticket', 'admin_ops_service.support_ticket', ownerPredicate('requester_subject'), 10],
  ['admin.audit', 'admin_ops_service.admin_audit_record', prefixPredicate('audit_id'), 10],
  ['admin.media-authorization', 'admin_ops_service.admin_media_authorization', ownerPredicate('subject_id'), 10],
  ['admin.review-state', 'admin_ops_service.admin_review_state', prefixPredicate('resource_ref'), 10],
  ['analytics.event-receipt', 'analytics_service.analytics_event_receipt', prefixPredicate('event_id'), 10],
  ['analytics.event-journal', 'analytics_service.analytics_event_journal', prefixPredicate('event_id'), 10],
  ['analytics.metric', 'analytics_service.analytics_metric_projection', prefixPredicate('metric_id'), 10],
  ['analytics.recompute-job', 'analytics_service.analytics_recompute_job', prefixPredicate('job_id'), 10],
];

export const FUNCTION_CHECK_COUNT = TABLE_CHECKS.length;
export const FEATURE_STATE_ROW_COUNT = GAMIFICATION_FEATURE_KEYS.length * ROWS_PER_FUNCTION;
export const B3_EXPERIENCE_ROW_COUNT = B3_RESOURCE_TYPES.length * ROWS_PER_FUNCTION;
