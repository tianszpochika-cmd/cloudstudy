// SEED-20261013: realistic demo data for the clyunedev pre-release server.
// Run ON the server from the repo root:
//   node scripts/seed/seed-20261013.mjs account   # create/verify the learner account (gate + consents)
//   (finish onboarding goal + placement in the browser / e2e script)
//   node scripts/seed/seed-20261013.mjs data      # backup, SQL seed, admin + learner API seed
// Cleanup: scripts/seed/cleanup-seed-20261013.sh
// Every row is tagged: ids/codes start with seed-20261013 / SEED-20261013, or the row belongs to an
// e2e-20261013-* account. Content payload hashes use the content-service canonical hash and the SQL
// session is utf8mb4 (see FIX-4 in docs/takeover/E2E-BROWSER-TEST-20261013.md).
import { execFileSync } from 'node:child_process';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { contentPayloadHash } from '../database/local-real-10x-fixture.mjs';
import { VOCAB, GRAMMAR, READING, LISTENING, WRITING, COURSES } from './seed-20261013-data.mjs';

const TAG = 'SEED-20261013';
const P = 'seed-20261013';
const API = process.env.SEED_API || 'https://api.clyunedev.com/api/v1';
const MYSQL_CONTAINER = process.env.SEED_MYSQL_CONTAINER || 'cloudstudy-clyunedev-mysql-1';
const ADMIN_FILE = '/root/e2e-20261013-admin.txt';
const LEARNER_FILE = '/root/e2e-20261013-learner.txt';
const LEARNER_ID = 'e2e-20261013-learner';
const DEVICE = { deviceType: 'WEB', clientVersion: 'seed-20261013', deviceName: 'seed-20261013' };
const counts = {};
const add = (k, n = 1) => { counts[k] = (counts[k] || 0) + n; };

// ---------- helpers ----------
const q = (v) => v === null || v === undefined ? 'NULL' : `'${String(v).replaceAll('\\', '\\\\').replaceAll("'", "''")}'`;
const j = (v) => q(JSON.stringify(v));
const sha = (s) => createHash('sha256').update(String(s), 'utf8').digest('hex');
const ago = (h) => `DATE_SUB(UTC_TIMESTAMP(6), INTERVAL ${Math.round(h * 60)} MINUTE)`;
const ahead = (h) => `DATE_ADD(UTC_TIMESTAMP(6), INTERVAL ${Math.round(h * 60)} MINUTE)`;
function sql(text) {
  return execFileSync('docker', ['exec', '-i', MYSQL_CONTAINER, 'sh', '-c',
    'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" --default-character-set=utf8mb4 -N -B'],
  { input: 'SET NAMES utf8mb4;\n' + text, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 64 << 20 }).trim();
}
function readCred(file) {
  return Object.fromEntries(readFileSync(file, 'utf8').trim().split('\n').map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]; }));
}
async function call(method, path, { body, token, origin = 'https://learn.clyunedev.com' } = {}) {
  const headers = { accept: 'application/json', origin };
  if (token) headers.authorization = 'Bearer ' + token;
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (method !== 'GET') headers['idempotency-key'] = `${P}-${randomUUID()}`;
  const r = await fetch(API + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  let json = null; try { json = await r.json(); } catch { /* empty */ }
  return { status: r.status, json, data: json?.data ?? json };
}
async function login(identifier, password, origin) {
  const r = await call('POST', '/auth/login', { body: { identifier, password, device: DEVICE }, origin });
  if (!r.data?.accessToken) throw new Error(`LOGIN_FAILED ${identifier} ${r.status} ${JSON.stringify(r.json).slice(0, 200)}`);
  return r.data.accessToken;
}
const subjectOf = (t) => JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString()).sub;

// ---------- phase: account ----------
async function account() {
  let cred;
  if (existsSync(LEARNER_FILE)) cred = readCred(LEARNER_FILE);
  else {
    cred = { identifier: LEARNER_ID, password: `Lx7!${randomBytes(12).toString('hex')}` };
    const r = await call('POST', '/auth/register', { body: { identifier: cred.identifier, password: cred.password, device: DEVICE } });
    if (r.status !== 201) throw new Error('REGISTER_FAILED ' + r.status + ' ' + JSON.stringify(r.json).slice(0, 200));
    writeFileSync(LEARNER_FILE, `identifier=${cred.identifier}\npassword=${cred.password}\nurl=https://learn.clyunedev.com/\ncreated=${new Date().toISOString()}\n`, { mode: 0o600 });
    chmodSync(LEARNER_FILE, 0o600);
  }
  let token = await login(cred.identifier, cred.password);
  const gate = await call('POST', '/iam/adult-gate', { token, body: { confirmed: true, birthYear: 1996, policyVersion: 'b30-adult-v1' } });
  const consents = [];
  for (const t of ['PRIVACY', 'TERMS', 'ADULT_LEARNING']) {
    consents.push((await call('PUT', '/iam/consents', { token, body: { type: t, version: 'clyunedev-prerelease-v1', decision: 'ACCEPTED' } })).status);
  }
  token = await login(cred.identifier, cred.password);
  console.log(JSON.stringify({ phase: 'account', subject: subjectOf(token), gate: gate.status, consents }));
}

// ---------- SQL seed ----------
function contentSql() {
  const s = [];
  let vid = 2610130000; let n = 0;
  const entries = [];
  // 8 vocab courses x 6 words (+2 spare) from VOCAB
  COURSES.forEach((c, ci) => {
    const words = VOCAB.slice(ci * 6, ci * 6 + 6);
    entries.push({ code: `${TAG}-${c[0]}`, kind: c[1], title: c[2], summary: c[3], level: c[4], goal: c[5],
      payload: { title: c[2], summary: c[3], locale: 'en-US', targetLevel: c[4],
        items: words.map((w) => ({ term: w[0], definition: w[3], example: w[5], text: `${w[0]} ${w[2]} — ${w[3]}` })) } });
  });
  GRAMMAR.slice(0, 12).forEach((g) => entries.push({ code: `${TAG}-GRAMMAR-${g[0]}`, kind: 'GRAMMAR', title: g[1], summary: g[3], level: g[5], goal: 'DAILY_ENGLISH',
    payload: { title: g[1], summary: g[3], locale: 'en-US', targetLevel: g[5], rule: g[2], explanation: `${g[3]}。易错点：${g[6]}。`, examples: [g[4]],
      items: [{ text: `规则：${g[2]}` }, { text: g[4] }, { text: `易错点：${g[6]}` }] } }));
  READING.slice(0, 12).forEach((r, i) => entries.push({ code: `${TAG}-READ-${String(i + 1).padStart(2, '0')}`, kind: 'COURSE_UNIT', title: r[0], summary: `${r[1]}｜精读短文`, level: r[2], goal: 'DAILY_ENGLISH',
    payload: { title: r[0], summary: `${r[1]}｜精读短文`, locale: 'en-US', targetLevel: r[2], blocks: r[3].map(([text, translation]) => ({ text, translation })), items: r[3].map(([a, b]) => ({ text: `${a} / ${b}` })) } }));
  LISTENING.slice(0, 8).forEach((l, i) => entries.push({ code: `${TAG}-LISTEN-${String(i + 1).padStart(2, '0')}`, kind: 'COURSE_UNIT', title: l[0], summary: '情景听力｜跟读与连读', level: l[1], goal: 'DAILY_ENGLISH',
    payload: { title: l[0], summary: '情景听力｜跟读与连读', locale: 'en-US', targetLevel: l[1], transcript: l[2].map((x) => x[0]).join(' '), durationSeconds: 20 + i * 5, items: l[2].map(([a, b]) => ({ text: `${a} / ${b}` })) } }));
  for (const e of entries) {
    vid += 1; n += 1;
    const cid = `${P}-content-${String(n).padStart(3, '0')}`;
    const hash = contentPayloadHash(e.payload);
    s.push(`INSERT INTO content_service.content_definition (content_id, tenant_id, content_code, kind, title, locale, target_level, goal_code, created_by, created_at, current_published_version_id, content_epoch, projection_version) VALUES (${q(cid)}, 'platform', ${q(e.code)}, ${q(e.kind)}, ${q(e.title)}, 'en-US', ${q(e.level)}, ${q(e.goal)}, '${P}-fixture', ${ago(400 - n)}, ${vid}, 1, 1);`);
    s.push(`INSERT INTO content_service.content_version (content_version_id, content_id, version_no, status, copyright_status, payload_hash, published_at, created_at, kind, payload_json, rights_source_code, rights_license_code, rights_allows_learning, rights_permitted_channels, rights_starts_at, rights_expires_at, authorization_evidence_ref, editor, release_note, first_reviewer, final_reviewer, publisher, archived_at, rollback_of_version_id, first_review_version, final_review_version, state_version) VALUES (${vid}, ${q(cid)}, 1, 'PUBLISHED', 'ACTIVE', ${q(hash)}, ${ago(300 - n)}, ${ago(400 - n)}, ${q(e.kind)}, ${j(e.payload)}, 'LOCAL_FIXTURE', 'LOCAL_FIXTURE', TRUE, ${j(['LEARNER', 'PUBLIC'])}, ${ago(400)}, NULL, '${P}-authorization', '${P}-editor', '${TAG} 首发', '${P}-reviewer-1', '${P}-reviewer-2', '${P}-publisher', NULL, NULL, 1, 1, 1);`);
    s.push(`INSERT INTO content_service.b25_content_course (content_code, tenant_id, content_type, title, summary, content_locale, target_level, content_version_id, availability, rights_status, definition_json, published_at, updated_at) VALUES (${q(e.code)}, 'platform', 'COURSE', ${q(e.title)}, ${q(e.summary)}, 'en-US', ${q(e.level)}, ${vid}, 'PUBLISHED', 'VALID', ${j({ fixtureId: TAG, courseCode: e.code })}, ${ago(300 - n)}, UTC_TIMESTAMP(6));`);
    s.push(`INSERT INTO content_service.b25_content_unit (unit_id, course_code, unit_code, unit_order, title_key, content_version, availability, rights_status, published_at) VALUES (${q(`${P}-unit-${n}`)}, ${q(e.code)}, ${q(`${P}-u${n}`)}, 1, ${q(e.title)}, 1, 'PUBLISHED', 'VALID', ${ago(300 - n)});`);
    e.payload.items.forEach((it, k) => s.push(`INSERT INTO content_service.b25_content_item (item_id, content_code, tenant_id, item_type, display_order, prompt, options_json, answer_rule_json, media_ref) VALUES (${q(`${P}-item-${n}-${k + 1}`)}, ${q(e.code)}, 'platform', 'LESSON', ${k + 1}, ${q(it.text)}, '[]', '{}', '');`));
  }
  add('内容目录（课程/单元）', entries.length);
  // b25 vocabulary
  VOCAB.forEach((w, i) => {
    s.push(`INSERT INTO content_service.b25_content_vocabulary (vocabulary_id, unit_code, word_normalized, meaning_key, cefr_level, content_version, availability, audio_ref, meaning_cn, definition_en, part_of_speech, examples_json, collocations_json) VALUES (${q(`${P}-v-${i + 1}`)}, ${q(`${TAG}-VOCAB`)}, ${q(w[0])}, ${q(`${w[0]}.core`)}, ${q(w[7])}, 1, 'PUBLISHED', NULL, ${q(w[3])}, ${q(w[4])}, ${q(w[1])}, ${j([{ sentence: w[5], translation: w[6] }])}, ${j([])});`);
  });
  add('词汇（b25 词库）', VOCAB.length);
  return s;
}

function b3Sql() {
  const s = []; const exp = (domain, type, key, payload) => s.push(`INSERT INTO content_service.b3_content_experience (experience_id, tenant_id, domain_code, resource_type, resource_key, content_version_id, availability, payload_json) VALUES (${q(`${P}-${domain}-${type}-${key}`.slice(0, 96))}, 'platform', ${q(domain)}, ${q(type)}, ${q(String(key))}, 301, 'PUBLISHED', ${j({ ...payload, contentVersionId: 301 })});`);
  GRAMMAR.forEach((g, i) => {
    const gp = 810001 + i; const ex = 820001 + i;
    exp('GRAMMAR', 'GRAMMAR_POINT', gp, { code: g[0], title: g[1], trapTags: [g[6]], cefrLevel: g[5], meaningCn: g[3], ruleFormula: g[2], grammarPointId: gp });
    const words = g[4].split(' '); const blank = Math.min(words.length - 1, 1 + (i % 3));
    exp('GRAMMAR', 'GRAMMAR_EXERCISE', ex, { type: 'FILL_BLANK', options: [], exerciseId: ex, promptText: words.map((w, k) => (k === blank ? '___' : w)).join(' '), ruleVersion: 'b3-rule-v1', grammarPointId: gp });
    exp('WRITING', 'PROOFREADING', 892001 + i, { issueId: 892001 + i, promptId: 880001 + (i % WRITING.length), errorType: g[0], wrongText: g[4], explanation: `常见错误：${g[6]}。规则：${g[2]}。`, wrongTextHash: `${P}-proof-${i}` });
  });
  add('语法点', GRAMMAR.length); add('语法练习（题库）', GRAMMAR.length); add('写作改错', GRAMMAR.length);
  READING.forEach((r, i) => {
    const art = 840001 + i;
    exp('READING', 'READING_ARTICLE', art, { title: r[0], blocks: r[3].map(([text, translation], k) => ({ text, tokens: [], blockId: `block-${k + 1}`, blockIndex: k, translation })), articleId: art, cefrLevel: r[2], wordCount: r[3].map((x) => x[0]).join(' ').split(' ').length, rightsStatus: 'AUTHORIZED', estimatedMinutes: 2 + (i % 3) });
    exp('READING', 'READING_QUESTION', 850001 + i, { options: r[5].map((label, k) => ({ label, optionCode: 'ABC'[k] })), stemText: r[4], articleId: art, questionId: 850001 + i, questionType: 'DETAIL' });
    exp('READING', 'DICTIONARY_ENTRY', `${art}:${r[6].replaceAll(' ', '-')}`, { lemma: r[6], tokenId: r[6].replaceAll(' ', '-'), articleId: art, meaningCn: r[7], exampleText: r[6], partOfSpeech: 'word' });
  });
  add('阅读文章', READING.length); add('阅读题目', READING.length); add('阅读词典条目', READING.length);
  LISTENING.forEach((l, i) => {
    const mid = 860001 + i; let t = 0;
    const segments = l[2].map(([text, translation, note], k) => { const dur = 1400 + text.length * 45; const seg = { text, endMs: t + dur, tokens: [], startMs: t, segmentId: `seg-${k + 1}`, annotations: [{ endMs: t + 600, label: note, startMs: t + 200, ruleCode: 'LINK_C2V', annotationId: `a${k + 1}`, ruleSetVersion: 'b3-sound-v1' }], translation }; t += dur + 300; return seg; });
    const mediaRef = { assetId: `${P}-audio-${mid}`, variant: 'LOW', availability: 'PENDING', rightsStatus: 'AUTHORIZED' };
    exp('LISTENING', 'LISTENING_MATERIAL', mid, { title: l[0], mediaRef, segments, cefrLevel: l[1], durationMs: t, materialId: mid, rightsStatus: 'AUTHORIZED' });
    segments.forEach((sg, k) => exp('LISTENING', 'LISTENING_CLIP', 870001 + i * 2 + k, { endMs: sg.endMs, title: sg.text, clipId: 870001 + i * 2 + k, startMs: sg.startMs, mediaRef, materialId: mid }));
  });
  add('听力材料', LISTENING.length); add('听力片段', LISTENING.length * 2);
  WRITING.forEach((w, i) => {
    exp('WRITING', 'WRITING_PROMPT', 880001 + i, { title: w[0], promptId: 880001 + i, taskText: w[2], promptType: w[1], targetStructure: w[3] });
    exp('WRITING', 'WRITING_MATERIAL', 890001 + i, { title: `${w[0]}｜高分表达`, bodyText: w[3].join('; ') + '.', topicCode: w[1], materialId: 890001 + i });
  });
  add('写作题目', WRITING.length); add('写作素材', WRITING.length);
  return s;
}

function learnerSql(SUB) {
  const s = []; const other = (i) => `${P}-user-${String(i).padStart(2, '0')}`;
  // mistakes (40)
  const cats = ['GRAMMAR_TENSE', 'VOCAB_MEANING', 'LISTENING_DETAIL', 'READING_INFERENCE', 'WRITING_COLLOCATION'];
  const mst = ['PENDING_RETRY', 'PENDING_RETRY', 'DELAY_VERIFY_D1', 'DELAY_VERIFY_D7', 'MASTERED'];
  const msv = ['NEW', 'LEARNING', 'LEARNING', 'MASTERED', 'CONSOLIDATED'];
  for (let i = 0; i < 40; i++) { const k = i % 5;
    s.push(`INSERT INTO assessment_service.assessment_mistake (mistake_id, subject_id, tenant_id, item_id, question_id, error_category, rule_version, answer_hash, wrong_count, mistake_status, mastery_status, first_error_at, last_error_at, next_action_at, reason_trace_json) VALUES (${2610130000 + i}, ${q(SUB)}, 'platform', ${820001 + (i % 40)}, ${820001 + (i % 40)}, ${q(cats[k])}, 'v1', '${sha(`${TAG}-mistake-${i}`)}', ${(i % 4) + 1}, ${q(mst[k])}, ${q(msv[k])}, ${ago(24 * (30 - (i % 30)))}, ${ago(i * 3)}, ${ahead(24 * ((i % 7) - 2))}, ${j([{ source: TAG, grammar: GRAMMAR[i % 40][1] }])});`); }
  add('错题本', 40);
  // SRS (50) + reviews (40)
  const stages = ['NEW', 'LEARNING', 'REVIEW', 'REVIEW', 'MASTERED'];
  VOCAB.forEach((w, i) => s.push(`INSERT INTO learning_service.b25_learning_srs_state (principal_id, item_id, tenant_id, stage, due_at, interval_days, ease_factor, review_count, last_idempotency_key, updated_at, practice_ref_json) VALUES (${q(SUB)}, ${q(`${P}-v-${i + 1}`)}, 'platform', ${q(stages[i % 5])}, ${i < 20 ? ago(i + 1) : ahead((i - 19) * 8)}, ${[0, 1, 3, 7, 21][i % 5]}, ${(2.3 + (i % 5) * 0.1).toFixed(2)}, ${i % 9}, ${q(`${P}-srs-${i}`)}, ${ago(i)}, ${j({ word: w[0], meaningCn: w[3], source: TAG })});`));
  add('复习队列（SRS）', VOCAB.length);
  for (let i = 0; i < 40; i++) s.push(`INSERT INTO learning_service.b25_learning_review (review_id, principal_id, tenant_id, item_id, quality, idempotency_key, created_at) VALUES ('${randomUUID()}', ${q(SUB)}, 'platform', ${q(`${P}-v-${(i % 50) + 1}`)}, ${[5, 4, 3, 2, 4][i % 5]}, ${q(`${P}-review-${i}`)}, ${ago(i * 5 + 1)});`);
  add('复习记录', 40);
  // library (40) + expressions (30) + interactions (40)
  VOCAB.slice(0, 40).forEach((w, i) => s.push(`INSERT INTO learning_service.b25_learning_library_entry (principal_id, tenant_id, item_type, item_id, source_type, collection_status, idempotency_key, created_at) VALUES (${q(SUB)}, 'platform', 'VOCAB', ${q(`${P}-v-${i + 1}`)}, 'READING', ${q(['NEW_WORD', 'SAVED', 'SAVED', 'MASTERED'][i % 4])}, ${q(`${P}-lib-${i}`)}, ${ago(i * 7)});`));
  add('生词本/收藏', 40);
  READING.forEach((r, i) => { const [text, tr] = r[3][i % r[3].length];
    s.push(`INSERT INTO learning_service.b2_learner_expression (tenant_id, principal_id, source_type, source_ref, source_content_version, sentence_text, translation_cn, selected_text, range_start, range_end, want_to_say, private_note, tag_ids_json, status, create_idempotency_key, created_at) VALUES ('platform', ${q(SUB)}, 'READING', ${q(String(840001 + i))}, '301', ${q(text)}, ${q(tr)}, ${q(r[6])}, NULL, NULL, ${i % 3 === 0 ? 1 : 0}, ${q(i % 2 ? '写邮件时可以用' : null)}, '[]', 'ACTIVE', ${q(`${P}-expr-${i}`)}, ${ago(i * 9)});`); });
  add('表达本', READING.length);
  const doms = ['GRAMMAR', 'READING', 'LISTENING', 'WRITING'];
  for (let i = 0; i < 40; i++) { const ok = i % 3 === 2; const d = doms[i % 4];
    const key = d === 'GRAMMAR' ? 820001 + i : d === 'READING' ? 850001 + (i % 30) : d === 'LISTENING' ? 870001 + i : 880001 + (i % 30);
    s.push(`INSERT INTO learning_service.b3_learning_interaction (interaction_id, tenant_id, principal_id, domain_code, action_code, resource_key, idempotency_key, payload_json, result_json, status, created_at) VALUES ('${randomUUID()}', 'platform', ${q(SUB)}, ${q(d)}, 'ANSWER', ${q(String(key))}, ${q(`${P}-act-${i}`)}, '{}', ${j({ correct: ok, feedbackCode: ok ? 'CORRECT' : 'RETRY', message: ok ? '答对了' : '再想想时态和主谓一致', errorCategory: ok ? '' : 'RULE_RETRY', mistakeStatus: ok ? 'CLOSED' : 'OPEN' })}, 'ACCEPTED', ${ago(i * 6)});`); }
  add('练习作答记录', 40);
  // notifications (40 + 40)
  const nt = [['每日学习提醒', '今天的 15 分钟还没完成，从 5 个复习词开始吧。'], ['错题 D1 验证到期', '昨天做错的 3 道语法题今天可以再试一次。'], ['订单支付成功', '你已开通「语学星 Plus 月卡」，权益即刻生效。'], ['退款已到账', '订单退款 ¥39.00 已原路退回。'], ['自习室有人为你加油', '「四级冲刺自习室」的同学给你点了个赞。'], ['连续学习 7 天', '恭喜！你已连续学习 7 天，获得 50 星币。'], ['新内容上线', '新增 12 篇精读短文：职场、出行与科技。'], ['每周学习报告', '本周学习 186 分钟，新掌握 34 个词。'], ['客服回复', '你的工单「听力音频无法播放」已有新回复。'], ['赛季即将结束', '本赛季还剩 3 天，你目前排名第 12。']];
  for (let i = 0; i < 40; i++) { const [t, b] = nt[i % 10];
    s.push(`INSERT INTO notification_service.notification_message (notification_id, subject_id, tenant_id, template_key, notification_status, idempotency_key, created_at, notification_type, channel, template_version, title, safe_body, content_version, locale, structured_attributes_json, not_before, template_only, message_version) VALUES (${q(`${P}-msg-${i}`)}, ${q(SUB)}, 'platform', 'seed.learning', ${q(i < 14 ? 'SENT' : 'READ')}, ${q(`${P}-msg-${i}`)}, ${ago(i * 5)}, 'general', 'IN_APP', 'v1', ${q(t)}, ${q(b)}, 'v1', 'zh-CN', ${j({ source: TAG })}, ${ago(i * 5)}, 0, 1);`);
    s.push(`INSERT INTO notification_service.b25_notification_message (message_id, principal_id, tenant_id, template_code, status, created_at) VALUES ('${randomUUID()}', ${q(SUB)}, 'platform', ${q(`seed-20261013.n${i % 10}`)}, ${q(i < 12 ? 'UNREAD' : 'READ')}, ${ago(i * 5)});`); }
  add('消息通知', 80);
  // support tickets (40: 15 learner, 25 other users)
  const tk = [['TECHNICAL', '听力音频在 iOS 上无法播放'], ['CONTENT_CORRECTION', '第 3 篇阅读译文有一处错别字'], ['BILLING', '月卡扣费两次，申请退一笔'], ['ACCOUNT_ACCESS', '换手机后无法登录'], ['LEARNING_DATA', '昨天的打卡记录没有同步'], ['TECHNICAL', '复习页面加载很慢'], ['CONTENT_CORRECTION', '单词 accommodation 音标标注有误'], ['PRIVACY_REQUEST', '申请导出我的学习数据']];
  const tst = ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED'];
  for (let i = 0; i < 40; i++) { const [c, t] = tk[i % 8];
    s.push(`INSERT INTO admin_ops_service.support_ticket (ticket_id, tenant_id, requester_subject, ticket_status, priority, redacted_summary, created_at, updated_at, category, resource_ref, description_fingerprint, sla_due_at, attachments_json) VALUES ('${randomUUID()}', 'platform', ${q(i < 15 ? SUB : other(i))}, ${q(tst[i % 6])}, ${q(['NORMAL', 'HIGH', 'LOW', 'URGENT'][i % 4])}, ${q(t)}, ${ago(i * 11 + 2)}, ${ago(i * 4)}, ${q(c)}, ${q(TAG)}, '${sha(`${TAG}-ticket-${i}`)}', ${ahead(48 - i * 3)}, '[]');`); }
  add('客服工单', 40);
  // gamification (xp 40, coin 40, rewards 30, season 40)
  let xb = 0; let cb = 0;
  for (let i = 0; i < 40; i++) { const xd = 10 + (i % 6) * 5; xb += xd; const cd = i % 7 === 6 ? -30 : 5 + (i % 4) * 5; cb = Math.max(0, cb + cd);
    s.push(`INSERT INTO gamification_service.xp_ledger (ledger_id, subject_id, tenant_id, source_event_id, delta, balance_after, created_at) VALUES ('${randomUUID()}', ${q(SUB)}, 'platform', '${randomUUID()}', ${xd}, ${xb}, ${ago((40 - i) * 12)});`);
    s.push(`INSERT INTO gamification_service.coin_ledger (ledger_id, subject_id, tenant_id, source_event_id, delta, balance_after, created_at) VALUES ('${randomUUID()}', ${q(SUB)}, 'platform', '${randomUUID()}', ${cd}, ${cb}, ${ago((40 - i) * 12)});`);
    s.push(`INSERT INTO gamification_service.gamification_season_fact (season_id, event_id, subject_id, points, rule_version, occurred_at, recorded_at) VALUES ('season-2026-autumn', ${q(`${P}-season-${i}`)}, ${q(i < 20 ? SUB : other(i))}, ${15 + (i * 7) % 60}, 'season-v1', ${ago(i * 10)}, ${ago(i * 10)});`); }
  const rewards = ['streak.7d', 'streak.14d', 'daily.chest', 'weekly.goal', 'season.bronze', 'vocab.100'];
  for (let i = 0; i < 30; i++) s.push(`INSERT INTO gamification_service.reward_grant (grant_id, subject_id, source_event_id, tenant_id, reward_key, probability_version, claim_status, outcome_code, claimed_at, idempotency_key, created_at) VALUES ('${randomUUID()}', ${q(SUB)}, ${q(`${P}-rw-${i}`)}, 'platform', ${q(rewards[i % 6])}, 'prob-v1', ${q(i < 22 ? 'CLAIMED' : 'AVAILABLE')}, ${q(i < 22 ? 'COINS_50' : null)}, ${i < 22 ? ago(i * 20) : 'NULL'}, ${q(`${P}-rw-${i}`)}, ${ago(i * 20 + 1)});`);
  add('经验流水', 40); add('星币流水', 40); add('奖励领取', 30); add('赛季积分', 40);
  // social: 30 rooms, members, 30 reports, leaderboard 45
  const themes = [['CET', '四级冲刺自习室'], ['IELTS', '雅思 7 分互助房'], ['WORK', '下班后一小时'], ['MORNING', '早起背单词'], ['NIGHT', '深夜安静自习'], ['FOCUS', '番茄钟专注房']];
  for (let i = 0; i < 30; i++) { const [th, name] = themes[i % 6]; const rid = `seed20261013-room-${String(i + 1).padStart(2, '0')}`;
    s.push(`INSERT INTO social_service.soc_study_room (room_id, tenant_id, owner_subject, theme_code, display_name_key, capacity, state, created_at) VALUES (${q(rid)}, 'platform', ${q(other(i % 25))}, ${q(th)}, ${q(`${name} ${Math.floor(i / 6) + 1} 号`)}, ${20 + (i % 11)}, ${q(i < 26 ? 'OPEN' : 'CLOSED')}, ${ago(i * 30)});`);
    for (let m = 0; m < 3 + (i % 4); m++) s.push(`INSERT INTO social_service.soc_room_member (membership_id, room_id, tenant_id, subject_id, state, presence_state, joined_at, last_activity_at) VALUES (${q(`${P}-mem-${i}-${m}`)}, ${q(rid)}, 'platform', ${q(other((i + m) % 25))}, 'ACTIVE', ${q(['ONLINE', 'FOCUS', 'OFFLINE'][m % 3])}, ${ago(m + 1)}, ${ago(m * 0.2)});`);
    if (i < 4) s.push(`INSERT INTO social_service.soc_room_member (membership_id, room_id, tenant_id, subject_id, state, presence_state, joined_at, last_activity_at) VALUES (${q(`${P}-mem-${i}-me`)}, ${q(rid)}, 'platform', ${q(SUB)}, 'ACTIVE', 'OFFLINE', ${ago(30 + i)}, ${ago(2 + i)});`);
    s.push(`INSERT INTO social_service.soc_report (report_id, tenant_id, room_id, reporter_subject_id, target_subject_id, target_seat_index, reason_code, state, client_event_id, created_at, updated_at) VALUES (${q(`${P}-rep-${i}`)}, 'platform', ${q(rid)}, ${q(other((i + 3) % 25))}, ${q(other((i + 7) % 25))}, ${i % 20}, ${q(['SPAM', 'PRESET_ABUSE', 'HARASSMENT', 'IMPERSONATION'][i % 4])}, ${q(['RECEIVED', 'TRIAGED', 'IN_REVIEW', 'ACTIONED', 'REJECTED', 'CLOSED'][i % 6])}, ${q(`${P}-rep-${i}`)}, ${ago(i * 13)}, ${ago(i * 5)});`); }
  add('自习室', 30); add('社群举报', 30);
  const monday = "DATE_SUB(UTC_DATE(), INTERVAL WEEKDAY(UTC_DATE()) DAY)";
  for (const kind of ['FOCUS_MINUTES', 'MASTERED_WORDS', 'XP']) for (let i = 0; i < 15; i++) {
    const sub = i === 11 ? SUB : other(i); const score = (kind === 'XP' ? 900 : kind === 'FOCUS_MINUTES' ? 600 : 120) - i * (kind === 'MASTERED_WORDS' ? 6 : 35);
    s.push(`INSERT INTO social_service.soc_leaderboard_projection (tenant_id, leaderboard_kind, period_type, period_start, subject_id, score, qualified_units, source_watermark, projection_state, snapshot_version, last_projected_at) VALUES ('platform', ${q(kind)}, 'WEEK', ${monday}, ${q(sub)}, ${score}, ${Math.max(1, Math.round(score / 10))}, ${q(TAG)}, 'PUBLISHED', 1, ${ago(1)});`); }
  add('排行榜条目', 45);
  return s;
}

function commerceSql(SUB) {
  const s = [];
  const skus = [['plus-month', '语学星 Plus 月卡', 'PLUS_MONTHLY', 3900], ['plus-quarter', '语学星 Plus 季卡', 'PLUS_QUARTERLY', 9900], ['plus-year', '语学星 Plus 年卡', 'PLUS_YEARLY', 29800], ['cet4-sprint', '四级 30 天冲刺营', 'CET4_SPRINT', 6900], ['cet6-sprint', '六级 30 天冲刺营', 'CET6_SPRINT', 7900], ['ielts-writing', '雅思写作精批 10 篇', 'IELTS_WRITING_PACK', 19900], ['biz-email', '商务邮件写作课', 'BIZ_EMAIL_COURSE', 4900], ['listen-100', '情景听力 100 篇', 'LISTENING_100', 2900], ['phonetics', '音标纠音训练营', 'PHONETICS_CAMP', 3900], ['coin-500', '500 星币', 'COIN_500', 600]];
  for (const [id, title, ent, amt] of skus) {
    s.push(`INSERT INTO commerce_service.commerce_sku (tenant_id, sku_id, version, title, entitlement_code, currency, amount_minor, status, effective_from, created_at) VALUES ('platform', ${q(`${P}-sku-${id}`)}, 1, ${q(title)}, ${q(ent)}, 'CNY', ${amt}, 'ACTIVE', ${ago(720)}, ${ago(720)});`);
    s.push(`INSERT INTO commerce_service.commerce_price_snapshot (tenant_id, sku_id, sku_version, title, entitlement_code, currency, amount_minor, captured_at) VALUES ('platform', ${q(`${P}-sku-${id}`)}, 1, ${q(title)}, ${q(ent)}, 'CNY', ${amt}, ${ago(720)});`);
  }
  add('商品/套餐（SKU）', skus.length);
  const st = ['PAID', 'PAID', 'PAID', 'REFUNDED', 'CANCELLED', 'PAID'];
  for (let i = 0; i < 30; i++) { const [id, title, ent, amt] = skus[i % 10]; const status = st[i % 6]; const subj = i < 12 ? SUB : `${P}-user-${String(i).padStart(2, '0')}`; const oid = `${P}-order-${String(i + 1).padStart(3, '0')}`;
    s.push(`INSERT INTO commerce_service.commerce_order (tenant_id, order_id, subject_id, sku_id, sku_version, sku_title, entitlement_code, provider, currency, amount_minor, status, created_at, updated_at, paid_at) VALUES ('platform', ${q(oid)}, ${q(subj)}, ${q(`${P}-sku-${id}`)}, 1, ${q(title)}, ${q(ent)}, 'SANDBOX', 'CNY', ${amt}, ${q(status)}, ${ago(i * 30 + 5)}, ${ago(i * 30)}, ${status === 'CANCELLED' ? 'NULL' : ago(i * 30)});`);
    if (status === 'PAID' && (i % 10) < 9) s.push(`INSERT INTO commerce_service.commerce_entitlement (tenant_id, entitlement_id, subject_id, sku_id, sku_version, sku_title, entitlement_code, source_type, source_ref, currency, amount_minor, status, active_from, expires_at, reason_code) VALUES ('platform', ${q(`${P}-ent-${i + 1}`)}, ${q(subj)}, ${q(`${P}-sku-${id}`)}, 1, ${q(title)}, ${q(ent)}, 'ORDER', ${q(oid)}, 'CNY', ${amt}, 'ACTIVE', ${ago(i * 30)}, ${ahead(24 * (30 + i * 5))}, '');`);
  }
  add('订单', 30); add('权益', s.filter((x) => x.includes('commerce_entitlement')).length);
  return s;
}

function adminSql() {
  const s = [];
  const metrics = [['assessment_attempt', 'learning.v1', 'scoreBucket:FULL'], ['learning_mastery_projection', 'learning.v1', 'projectionStatus:APPLIED'], ['learning_review_queue', 'learning.v1', 'state:REVIEW_QUEUE'], ['growth_ledger', 'growth.v1', 'ledgerKind:SCORE'], ['leaderboard_projection', 'social.v1', 'kind:FOCUS_MINUTES'], ['notification', 'notification.v1', 'channel:IN_APP'], ['workflow.saga.started', 'workflow.v1', 'currentStep:LEARNING_PROJECT']];
  for (const [mid, ver, dim] of metrics) for (let d = 1; d <= 6; d++) s.push(`INSERT INTO analytics_service.analytics_metric_projection (tenant_id, metric_id, metric_version, period_start, dimension_key, projection_state, event_count, total_value, last_occurred_at, source_watermark, projection_version, error_code, updated_at) VALUES ('platform', ${q(mid)}, ${q(ver)}, DATE_SUB(UTC_DATE(), INTERVAL ${d} DAY), ${q(dim)}, 'READY', ${40 + ((d * 17 + mid.length * 7) % 90)}, ${120 + ((d * 31 + mid.length * 13) % 400)}, ${ago(24 * d)}, ${q(TAG)}, 20261013, NULL, UTC_TIMESTAMP(6)) ON DUPLICATE KEY UPDATE tenant_id = tenant_id;`);
  add('运营指标（6 天 × 7 项）', 42);
  return s;
}

// ---------- API seed ----------
async function adminApi() {
  const cred = readCred(ADMIN_FILE); const token = await login(cred.identifier, cred.password, 'https://admin.clyunedev.com');
  const A = (m, p, body) => call(m, p, { body, token, origin: 'https://admin.clyunedev.com' });
  let ok = 0; const fail = {};
  const tally = (k, r) => { if (r.status < 300) { add(k); ok++; } else fail[k] = `${r.status} ${JSON.stringify(r.json?.error ?? r.json).slice(0, 160)}`; return r; };
  for (const w of VOCAB) {
    const r = tally('词条（管理端 VOCAB-PHASE1）', await A('POST', '/admin/content-commands', { command: 'LEXEME_UPSERT', contentCode: 'VOCAB-PHASE1', expectedStateVersion: 0, lexemeId: '', lexeme: { headword: w[0], language: 'en-US', lemma: w[0], pos: [w[1]], cefr: w[7], phoneticUS: w[2], phoneticUK: w[2], senses: [{ pos: w[1], meaningCn: w[3], meaningEn: w[4], examples: [{ en: w[5], cn: w[6], source: TAG }], usageNote: TAG }] } }));
    const d = r.data; if (d?.lexemeId && VOCAB.indexOf(w) % 3 === 0) await A('POST', '/admin/content-commands', { command: 'LEXEME_SUBMIT_REVIEW', contentCode: 'VOCAB-PHASE1', expectedStateVersion: d.lexemeStateVersion ?? 1, lexemeId: d.lexemeId, reasonCode: 'TENANT_ADMIN' });
  }
  const kinds = ['QUESTION', 'EXAMPLE', 'GRAMMAR_POINT', 'EXERCISE', 'PASSAGE'];
  for (let i = 0; i < 40; i++) { const g = GRAMMAR[i]; const kind = kinds[i % 5];
    const fields = kind === 'QUESTION' ? { options: [g[4], g[4].replace(/\b(is|are|was|were|has|have)\b/, (m) => ({ is: 'are', are: 'is', was: 'were', were: 'was', has: 'have', have: 'has' })[m]), '以上都不对'], answerIndex: 0, tags: [TAG, g[0]] } : { tags: [TAG, g[0]] };
    const stem = kind === 'PASSAGE' ? READING[i % 30][3].map((x) => x[0]).join(' ') : kind === 'QUESTION' ? `选出语法正确的句子（${g[1]}）` : `${g[1]}：${g[4]}`;
    tally('题目与练习（管理端）', await A('POST', '/admin/content-commands', { command: 'ITEM_UPSERT', contentCode: 'VOCAB-PHASE1', expectedStateVersion: 0, itemId: '', item: { kind, stem, fields } })); }
  const rc = [['ACCOUNT_SECURITY', '同一账号 1 小时内 6 个城市登录'], ['DEVICE_ANOMALY', '单设备 24 小时注册 9 个账号'], ['PAYMENT_ANOMALY', '同卡 10 分钟内 5 次支付失败'], ['ACTIVATION_ABUSE', '激活码被批量尝试'], ['EXPORT_ANOMALY', '短时间内重复申请数据导出'], ['CONTENT_RIGHTS', '用户上传音频疑似侵权']];
  for (let i = 0; i < 40; i++) { const [c, t] = rc[i % 6]; tally('风险案件', await A('POST', '/admin/ops/risk/cases', { category: c, severity: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'][i % 4], title: `${t}（#${i + 1}）`, subjectRef: `${P}-user-${String(i % 25).padStart(2, '0')}`, evidenceRefs: [TAG, `${P}-evidence-${i + 1}`], note: '演示数据：用于治理页浏览' })); }
  const rec = [['ORDER', 'RETRY', '支付回调超时，订单停在待支付'], ['LEARNING_PLAN', 'REPLAY', '学习计划重算失败，需重放事件'], ['NOTIFICATION', 'RETRY', '推送通道 502，消息未送达'], ['REFUND', 'RETRY', '退款回调签名校验失败后重试'], ['ENTITLEMENT', 'COMPENSATE', '支付成功但权益未发放']];
  for (let i = 0; i < 30; i++) { const [st, ac, re] = rec[i % 5]; tally('人工恢复任务', await A('POST', '/admin/recovery/recoveries', { subjectType: st, subjectId: `${P}-${st.toLowerCase()}-${i + 1}`, action: ac, reason: `${re}（${TAG}）` })); }
  const pol = [['content-editor', ['admin.content.read', 'admin.content.write'], 'CONTENT_EDIT', 'CONTENT_PACK', '内容编辑'], ['content-reviewer', ['admin.content.read', 'admin.content.publish'], 'CONTENT_REVIEW', 'CONTENT_VERSION', '内容审核'], ['support-agent', ['admin.support.read', 'support.ticket.manage'], 'TICKET_REPLY', 'SUPPORT_TICKET', '客服处理'], ['risk-analyst', ['admin.risk.read', 'admin.risk.write'], 'RISK_TRIAGE', 'RISK_CASE', '风控分析'], ['finance-ops', ['admin.commerce.read', 'commerce.refund'], 'REFUND_APPROVE', 'ORDER', '财务退款']];
  for (let i = 0; i < 30; i++) { const [role, perms, act, res, cn] = pol[i % 5];
    const r = tally('策略版本', await A('POST', '/iam/policy-versions', { changeReason: `${TAG} ${cn}策略第 ${Math.floor(i / 5) + 1} 版`, policyDocument: { name: `${TAG} ${cn}策略 v${Math.floor(i / 5) + 1}`, description: `${cn}角色的最小权限集（演示数据）`, roleBindings: [{ roleCode: role, permissions: perms, assignmentScope: 'SERVER_DERIVED_PLATFORM_TENANT' }], rules: [{ effect: 'ALLOW', requiredPermissions: [perms[1]], actions: [act], resourceTypes: [res], conditions: { phases: ['P1'], requiresAdultEligibility: false, requiredConsentPurposes: [], contentRights: [], ownerMatchRequired: false, tenantMatchRequired: true } }] } }));
    const pid = r.data?.policy?.policyVersionId; if (pid && i % 3 === 1) await A('POST', `/iam/policy-versions/${pid}/submit`, { expectedRevision: 1, submissionReason: `${TAG} 提交审批` }); }
  return fail;
}

async function learnerApi(token) {
  const fail = {};
  for (let i = 0; i < 30; i++) { const day = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10); const kind = i % 4 === 3 ? 'weekly' : 'daily';
    let r = await call('POST', `/learning/reports/${kind}/shares?date=${day}`, { token });
    if (r.status === 404) r = await call('POST', `/learning/reports/${kind.toUpperCase()}/shares?date=${day}`, { token });
    if (r.status < 300) add('学习报告分享'); else fail['学习报告分享'] = `${r.status} ${JSON.stringify(r.json?.error ?? r.json).slice(0, 160)}`; }
  for (let i = 0; i < 6; i++) { const r = await call('POST', '/commerce/orders', { token, body: { skuId: `${P}-sku-${['plus-month', 'cet4-sprint', 'listen-100', 'phonetics', 'biz-email', 'coin-500'][i]}` } });
    if (r.status < 300) add('订单（API 下单，待支付）'); else fail['API 下单'] = `${r.status} ${JSON.stringify(r.json?.error ?? r.json).slice(0, 160)}`; }
  return fail;
}

async function data() {
  const lc = readCred(LEARNER_FILE); const token = await login(lc.identifier, lc.password); const SUB = subjectOf(token);
  if (sql(`SELECT COUNT(*) FROM content_service.content_definition WHERE content_id LIKE '${P}-%';`) !== '0') throw new Error('SEED_ALREADY_PRESENT: run cleanup-seed-20261013.sh first');
  const ts = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const backup = `/srv/cloudstudy/backups/seed-20261013-pre-${ts}.sql.gz`;
  const schemas = 'content_service assessment_service learning_service notification_service admin_ops_service commerce_service social_service gamification_service analytics_service workflow_service';
  execFileSync('sh', ['-c', `docker exec ${MYSQL_CONTAINER} sh -c 'mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --default-character-set=utf8mb4 --single-transaction --databases ${schemas} 2>/dev/null' | gzip > ${backup} && chmod 600 ${backup}`]);
  console.log('backup:', backup);
  const batches = { content: contentSql(), b3: b3Sql(), learner: learnerSql(SUB), commerce: commerceSql(SUB), admin: adminSql() };
  for (const [name, stmts] of Object.entries(batches)) { sql(`START TRANSACTION;\n${stmts.join('\n')}\nCOMMIT;`); console.log('sql batch ok:', name, stmts.length); }
  const adminFail = await adminApi();
  const learnerFail = await learnerApi(token);
  console.log(JSON.stringify({ phase: 'data', subject: SUB, backup, counts, failures: { ...adminFail, ...learnerFail } }, null, 1));
}

const phase = process.argv[2];
if (phase === 'account') await account();
else if (phase === 'data') await data();
else { console.error('usage: seed-20261013.mjs account|data'); process.exit(2); }
