import { spawn, execFileSync } from 'node:child_process';
import { createHash, createSign, generateKeyPairSync, randomBytes, randomUUID } from 'node:crypto';
import { createWriteStream, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import { join } from 'node:path';

const root = '/Users/Admin/Desktop/work/cloudstudy';
const evidence = join(root, 'evidence/redesign/2026-10-10/R1-029');
const container = 'yuxuexing-local-mysql-1';
const schema = `r1_029_20261010_${randomBytes(4).toString('hex')}`;
const contentPort = 18089;
const learnerPort = 18088;
const assessmentPort = 18091;
const gatewayPort = 18070;
const jwksPort = 18199;
const consentPort = 18229;
const issuer = `http://127.0.0.1:${jwksPort}`;
const audience = 'yuxuexing-api';
const javaHome = '/Users/Admin/.local/tools/jdk-25.0.4.1+1/Contents/Home';
const subject = randomUUID();
const deniedAdult = randomUUID();
const deniedConsent = randomUUID();
const serviceSubject = 'assessment-service';

mkdirSync(evidence, { recursive: true });

const children = [];
let jwksServer = null;
let consentServer = null;
let password = '';
const steps = [];
const notes = [];
let failed = false;
let cleanupNote = '';
const qidaBefore = [];

function note(line) {
  const text = String(line);
  notes.push(text);
  console.log(text);
}

function run(command, args, options = {}) {
  return execFileSync(command, args, { encoding: 'utf8', ...options });
}

function sql(statement) {
  return run('docker', [
    'exec', '-i', container, 'sh', '-c',
    'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql --protocol=socket --user=root --default-character-set=utf8mb4 --batch --raw',
  ], { input: statement });
}

function sqlScalar(statement) {
  return run('docker', [
    'exec', '-i', container, 'sh', '-c',
    'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql --protocol=socket --user=root --default-character-set=utf8mb4 --batch --skip-column-names --raw',
  ], { input: statement }).trim();
}

function record(name, status, detail) {
  const step = { name, status, detail };
  steps.push(step);
  note(`${status} ${name} ${JSON.stringify(detail).slice(0, 500)}`);
  if (status === 'FAIL') failed = true;
  return step;
}

function listeners(port) {
  try {
    return run('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN']);
  } catch (error) {
    if (error.status === 1) return '';
    throw error;
  }
}

function b64(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function leakHits(text) {
  const value = String(text ?? '');
  const hits = [];
  if (/correctOption/i.test(value)) hits.push('correctOption');
  if (/answer_rule/i.test(value)) hits.push('answer_rule');
  // answerRulePin is the completion-rule pin name. It is not an answer rule.
  if (/"answerRule"/.test(value)) hits.push('answerRule');
  return hits;
}

function leaks(text) {
  return leakHits(text).length > 0;
}

function parseJson(text) {
  try { return JSON.parse(text); } catch { return null; }
}

function dataOf(body) {
  const parsed = typeof body === 'string' ? parseJson(body) : body;
  if (parsed && typeof parsed === 'object' && parsed.data && typeof parsed.data === 'object') return parsed.data;
  return null;
}

function request(options) {
  const payload = options.body == null ? null : Buffer.from(
    typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
  const headers = { accept: 'application/json', ...(options.headers || {}) };
  if (options.token) headers.authorization = 'Bearer ' + options.token;
  if (payload) {
    headers['content-type'] = 'application/json';
    headers['content-length'] = String(payload.length);
  }
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: '127.0.0.1',
      port: options.port,
      path: options.path,
      method: options.method || 'GET',
      headers,
      timeout: options.timeout || 20000,
    }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve({
        status: response.statusCode,
        body: Buffer.concat(chunks).toString('utf8'),
      }));
    });
    req.on('timeout', () => req.destroy(new Error('timeout ' + options.path)));
    req.on('error', reject);
    if (payload) req.end(payload);
    else req.end();
  });
}

function clip(text, max = 400) {
  const value = String(text ?? '').replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[REDACTED_JWT]');
  return value.length <= max ? value : value.slice(0, max) + '…';
}

function mint(privateKey, claims) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT', kid: 'r1-029-local' };
  const payload = {
    iss: issuer,
    aud: audience,
    iat: now,
    nbf: now - 30,
    exp: now + 7200,
    jti: randomUUID(),
    ...claims,
  };
  const input = `${b64(header)}.${b64(payload)}`;
  const signature = createSign('RSA-SHA256').update(input).end().sign(privateKey).toString('base64url');
  return `${input}.${signature}`;
}

function learnerClaims(sub, adultGate, consentState) {
  return {
    sub,
    tenant_id: 'platform',
    roles: ['learner'],
    permissions: [
      'content.read',
      // GET /api/v1/learner/targets authorizes learner.profile.read before it returns the goal.
      'learner.profile.read',
      'learner.target.write',
      'assessment.placement.session.create',
      'assessment.placement.session.read',
      'assessment.placement.response.submit',
      'assessment.placement.skip',
      'assessment.placement.report.read',
      'assessment.session.read',
    ],
    adult_gate: adultGate,
    consent_state: consentState,
    token_type: 'access',
    scope: 'learner',
  };
}

function assertMysql() {
  const value = JSON.parse(run('docker', ['inspect', container]))[0];
  const facts = {
    name: value.Name,
    image: value.Config.Image,
    project: value.Config.Labels?.['com.docker.compose.project'],
    service: value.Config.Labels?.['com.docker.compose.service'],
    status: value.State.Status,
    health: value.State.Health?.Status,
    port: value.NetworkSettings?.Ports?.['3306/tcp'],
  };
  const ok = facts.name === '/' + container && facts.image === 'mysql:8.0'
    && facts.project === 'yuxuexing-local' && facts.service === 'mysql'
    && facts.status === 'running' && facts.health === 'healthy'
    && JSON.stringify(facts.port) === JSON.stringify([{ HostIp: '127.0.0.1', HostPort: '13306' }]);
  record('mysql-identity', ok ? 'PASS' : 'FAIL', facts);
  if (!ok) throw new Error('MYSQL_OWNER_OR_PORT_CHANGED');
  const entry = (value.Config.Env || []).find((item) => item.startsWith('MYSQL_ROOT_PASSWORD='));
  if (!entry) throw new Error('MYSQL_ROOT_PASSWORD missing');
  password = entry.slice('MYSQL_ROOT_PASSWORD='.length);
  qidaBefore.push(...run('docker', ['ps', '--format', '{{.Names}}']).split('\n').filter((name) => name.includes('qida')).sort());
}

function assertPorts() {
  const ports = [gatewayPort, learnerPort, contentPort, assessmentPort, jwksPort, consentPort];
  const occupied = [];
  for (const port of ports) {
    const text = listeners(port).trim();
    if (text) occupied.push({ port, text: text.split('\n').slice(0, 2).join(' | ') });
  }
  record('ports-free', occupied.length === 0 ? 'PASS' : 'FAIL', { ports, occupied });
  if (occupied.length) throw new Error('PORT_OCCUPIED');
}

function startJwks(publicJwk) {
  const body = JSON.stringify({ keys: [publicJwk] });
  jwksServer = http.createServer((request, response) => {
    if (request.url === '/jwks') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(body);
      return;
    }
    response.writeHead(404);
    response.end();
  });
  return new Promise((resolve) => jwksServer.listen(jwksPort, '127.0.0.1', resolve));
}

function startConsentStub() {
  consentServer = http.createServer((request, response) => {
    if (request.method === 'POST' && request.url === '/internal/v1/iam/service-token') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ accessToken: 'r1-029-consent-stub' }));
      return;
    }
    if (request.method === 'GET' && request.url.startsWith('/internal/v1/iam/principals/')
        && request.url.endsWith('/learning-consent')) {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ data: { learningConsent: 'GRANTED', learningAccess: 'ELIGIBLE' } }));
      return;
    }
    response.writeHead(404);
    response.end();
  });
  return new Promise((resolve) => consentServer.listen(consentPort, '127.0.0.1', resolve));
}

function jdbcUrl() {
  return `jdbc:mysql://127.0.0.1:13306/${schema}?useUnicode=true&characterEncoding=utf8&serverTimezone=UTC&allowPublicKeyRetrieval=true&useSSL=false`;
}

function baseEnv() {
  return {
    ...process.env,
    JAVA_HOME: javaHome,
    PATH: `${javaHome}/bin:${process.env.PATH}`,
    IAM_JWT_ISSUER: issuer,
    IAM_JWT_JWKS_URI: `${issuer}/jwks`,
    IAM_JWT_AUDIENCE: audience,
    OTEL_ENABLED: 'false',
    OTEL_TRACING_EXPORT_ENABLED: 'false',
    OTEL_TRACING_ENABLED: 'false',
  };
}

function startJava(id, jar, env) {
  const out = createWriteStream(join(evidence, id + '.log'));
  const child = spawn(join(javaHome, 'bin', 'java'), [
    '-Dfile.encoding=UTF-8',
    '-Dspring.main.banner-mode=off',
    '-Dmanagement.otlp.metrics.export.enabled=false',
    '-Dmanagement.opentelemetry.enabled=false',
    '-jar', join(root, 'services', jar, 'target', jar + '-0.1.0-SNAPSHOT.jar'),
  ], {
    cwd: root,
    detached: true,
    env: { ...baseEnv(), ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.pipe(out);
  child.stderr.pipe(out);
  child.on('error', (error) => {
    child.spawnError = error;
    note(id + '_SPAWN_ERROR ' + error.message);
  });
  child.on('exit', (code) => note(id + '_EXIT ' + code));
  children.push({ id, child });
  return child;
}

async function waitHealth(child, port, label) {
  const deadline = Date.now() + 180000;
  let last = 'none';
  while (Date.now() < deadline) {
    if (child.spawnError) throw new Error(label + '_SPAWN ' + child.spawnError.message);
    if (child.exitCode != null) throw new Error(label + '_DIED ' + child.exitCode + ' last=' + last);
    try {
      const health = await request({ port, path: '/actuator/health', timeout: 2000 });
      last = health.status + ' ' + clip(health.body, 180);
      if (health.status === 200) {
        note(label + '_HEALTH ' + last);
        return;
      }
    } catch (error) {
      last = error.message;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(label + '_HEALTH_TIMEOUT ' + last);
}

function renameHistory(from, to) {
  sql(`RENAME TABLE \`${schema}\`.\`${from}\` TO \`${schema}\`.\`${to}\`;`);
}

function emptyHistoryLike(source) {
  sql(`CREATE TABLE \`${schema}\`.flyway_schema_history LIKE \`${schema}\`.\`${source}\`;`);
  const count = sqlScalar(`SELECT COUNT(*) FROM \`${schema}\`.flyway_schema_history;`);
  if (count !== '0') throw new Error('fresh flyway history was not empty: ' + count);
}

function distribution() {
  const rows = sqlScalar(`
    SELECT CONCAT(
      (SELECT COUNT(*) FROM \`${schema}\`.content_placement_item), '|',
      (SELECT COUNT(*) FROM \`${schema}\`.content_placement_item WHERE dimension='VOCABULARY'), '|',
      (SELECT COUNT(*) FROM \`${schema}\`.content_placement_item WHERE dimension='BASIC_GRAMMAR'), '|',
      (SELECT COUNT(*) FROM \`${schema}\`.content_placement_item WHERE dimension='READING'), '|',
      (SELECT COUNT(*) FROM \`${schema}\`.content_placement_item WHERE dimension='LISTENING'), '|',
      (SELECT COUNT(*) FROM \`${schema}\`.content_placement_item WHERE bank_code='P1_PLACEMENT_V1'), '|',
      (SELECT COUNT(*) FROM \`${schema}\`.content_placement_item
        WHERE JSON_UNQUOTE(JSON_EXTRACT(answer_rule_json, '$.correctOption')) IS NOT NULL
          AND JSON_UNQUOTE(JSON_EXTRACT(answer_rule_json, '$.correctOption')) <> '')
    );`);
  const [total, vocab, grammar, reading, listening, bank, answers] = rows.split('|').map(Number);
  return { total, vocab, grammar, reading, listening, bank, answers };
}

function sessionCount(principal) {
  return Number(sqlScalar(`SELECT COUNT(*) FROM \`${schema}\`.p1_placement_session WHERE principal_id='${principal}' AND tenant_id='platform';`));
}

function answerKey(itemId) {
  return sqlScalar(`SELECT JSON_UNQUOTE(JSON_EXTRACT(answer_rule_json, '$.correctOption'))
    FROM \`${schema}\`.content_placement_item WHERE placement_item_id=${Number(itemId)};`);
}

async function stopChild(entry) {
  const child = entry.child;
  if (!child || child.pid == null || child.exitCode != null) return;
  try { process.kill(-child.pid, 'SIGTERM'); } catch { try { child.kill('SIGTERM'); } catch { /* already gone */ } }
  const deadline = Date.now() + 15000;
  while (child.exitCode == null && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  if (child.exitCode == null) {
    try { process.kill(-child.pid, 'SIGKILL'); } catch { try { child.kill('SIGKILL'); } catch { /* already gone */ } }
  }
}

async function cleanup() {
  const lines = [];
  for (const entry of children) {
    await stopChild(entry);
    lines.push(entry.id + '=' + entry.child.exitCode);
  }
  if (jwksServer) await new Promise((resolve) => jwksServer.close(resolve));
  if (consentServer) await new Promise((resolve) => consentServer.close(resolve));
  try {
    sql(`DROP DATABASE IF EXISTS \`${schema}\`;`);
    const left = sqlScalar(`SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name='${schema}';`);
    lines.push('schemaLeft=' + left);
  } catch (error) {
    lines.push('dropFailed=' + error.message);
  }
  const ports = [gatewayPort, learnerPort, contentPort, assessmentPort, jwksPort, consentPort];
  const still = ports.filter((port) => listeners(port).trim());
  lines.push('listenersLeft=' + (still.join(',') || 'none'));
  const qidaAfter = run('docker', ['ps', '--format', '{{.Names}}']).split('\n').filter((name) => name.includes('qida')).sort();
  const qidaAdded = qidaAfter.filter((name) => !qidaBefore.includes(name));
  const qidaRemoved = qidaBefore.filter((name) => !qidaAfter.includes(name));
  lines.push('qidaUnchanged=' + (qidaAdded.length === 0 && qidaRemoved.length === 0));
  if (qidaAdded.length || qidaRemoved.length) {
    lines.push('qidaAdded=' + (qidaAdded.join(',') || 'none'));
    lines.push('qidaRemoved=' + (qidaRemoved.join(',') || 'none'));
  }
  cleanupNote = lines.join(' ');
  note('CLEANUP ' + cleanupNote);
}

function readResume(path) {
  try {
    const text = readFileSync(path, 'utf8');
    const exit = text.match(/(?:LEARNER|MOBILE)_EXIT:(\d+)/);
    const tests = text.match(/# tests (\d+)/);
    const pass = text.match(/# pass (\d+)/);
    const fail = text.match(/# fail (\d+)/);
    return {
      exitCode: exit ? Number(exit[1]) : null,
      tests: tests ? Number(tests[1]) : null,
      pass: pass ? Number(pass[1]) : null,
      fail: fail ? Number(fail[1]) : null,
    };
  } catch {
    return { exitCode: null, tests: null, pass: null, fail: null, missing: true };
  }
}

function writeReports() {
  const planned = [
    'mysql-identity', 'ports-free', 'content-seed-10-3-3-2-2', 'sealed-200-no-correctOption',
    'sealed-under-10-is-503', 'sealed-restored-200', 'learner-active-goal', 'assessment-flyway',
    'gate-closed-403-no-session', 'open-10-stems-no-correctOption', 'out-of-order-409-unchanged',
    'correct-full-advances-no-correctOption', 'stale-or-behind-409-unchanged', 'wrong-zero-no-correctOption',
    'ten-items-report-digest', 'report-reread-same-digest', 'retest-new-session-old-digest',
    'incomplete-retest-409', 'skip-incomplete-skipped-no-report', 'skip-completed-409-digest-unchanged',
    'gateway-post-start-404', 'gateway-get-start-forwarded', 'gateway-post-sessions-not-404',
    'r1-018-real-db-open',
  ];
  for (const name of planned) {
    if (!steps.some((step) => step.name === name)) {
      record(name, 'NOT_RUN', { reason: '前面的步骤失败或未走到，停止，没有改产品代码' });
    }
  }
  const web = readResume('/tmp/r1-029-learner-web-resume.log');
  const mobile = readResume('/tmp/r1-029-mobile-resume.log');
  record('learner-web-placement-resume', web.exitCode === 0 && web.fail === 0 ? 'PASS' : (web.exitCode == null ? 'NOT_RUN' : 'FAIL'), web);
  record('mobile-placement-resume', mobile.exitCode === 0 && mobile.fail === 0 ? 'PASS' : (mobile.exitCode == null ? 'NOT_RUN' : 'FAIL'), mobile);
  record('browser-full-chain', 'NOT_RUN', { reason: '这次没有开浏览器，也没有真机走查' });
  record('retest-button-not-claimed-connected', 'NOT_RUN', {
    reason: '两端按钮仍是 disabled「重测尚未接通」。续答测试断言的是未接通，不是按钮已经能重测。',
  });
  const anyFail = steps.some((step) => step.status === 'FAIL');
  const summary = anyFail ? 'FAIL' : 'PASS_WITH_NOT_RUN';
  const httpResult = {
    card: 'R1-029',
    date: '2026-10-10',
    branch: 'dev-redesign',
    schema,
    summary,
    accepted: false,
    it2Outbound: false,
    steps,
    cleanup: cleanupNote,
    notes: notes.filter((line) => !line.includes('jdbc:')),
  };
  writeFileSync(join(evidence, 'http-result.json'), JSON.stringify(httpResult, null, 2));
  const lines = [];
  lines.push('# R1-029 L2 干净库重放');
  lines.push('');
  lines.push('日期：2026-10-10。分支：`dev-redesign`。Owner：QA。依赖：R1-018…028。');
  lines.push('**不是 ACCEPTED，也不是 IT-2 出站。** 没有 commit，没有 push。`CURRENT-PROGRESS.md` 未改。没有改业务 Java/Vue。没有补造 R1-030。');
  lines.push('');
  lines.push(`总判：\`${summary}\`。有 FAIL 时不把本卡写成全绿。专库 \`${schema}\`。`);
  lines.push('');
  lines.push('## 步骤');
  lines.push('');
  for (const step of steps) {
    lines.push(`- ${step.status} \`${step.name}\`: ${JSON.stringify(step.detail)}`);
  }
  lines.push('');
  lines.push('## 运行约束');
  lines.push('');
  lines.push('只使用 `yuxuexing-local-mysql-1`（`mysql:8.0`，`127.0.0.1:13306`）。没有 `docker compose down`，没有 prune，没有碰名称含 qida 的容器。');
  lines.push('端口来自 `config/local-ports.json`：网关 18070，learner 18088，content 18089，assessment 18091。18199 是本轮临时 JWKS，18229 是本轮学习同意复检回环桩，都不是 IAM。复检保持开启，但没有启动 iam-service。');
  lines.push('三个服务的 Flyway 历史表在代码里都叫 `flyway_schema_history`。内容服务先在空库迁移，然后把历史表改名为 `content_flyway_schema_history`，再建一张空的同结构历史表给 learner；learner 迁完再改名为 `learner_flyway_schema_history`，assessment 用自己的空历史表迁移。这是回放隔离，不是产品改动。');
  lines.push('判分用的服务令牌只放在 assessment 进程环境里，证据不收录令牌。选哪一个选项由库内 `answer_rule_json` 决定，learner 响应里不回写这个字段。');
  lines.push('');
  lines.push('## 前端');
  lines.push('');
  lines.push('没有改页面。learner-web 与 mobile 只跑已有的 `tests/placement-checkpoint-resume.test.mjs`。');
  lines.push(`learner-web 退出码 ${web.exitCode}，tests ${web.tests}，pass ${web.pass}，fail ${web.fail}。`);
  lines.push(`mobile 退出码 ${mobile.exitCode}，tests ${mobile.tests}，pass ${mobile.pass}，fail ${mobile.fail}。`);
  lines.push('这些测试仍然要求按钮是 `disabled>重测尚未接通`。不要把这句写成重测按钮已经接通。');
  lines.push('');
  lines.push('## 未验证');
  lines.push('');
  lines.push('- 浏览器全链：NOT_RUN。');
  lines.push('- 重测按钮：客户端仍未接通。服务端内部重测是否通过，看上面的 `retest` 步骤，不代表页面按钮可用。');
  lines.push('');
  lines.push('## 清理');
  lines.push('');
  lines.push(cleanupNote || '未记录');
  lines.push('');
  writeFileSync(join(evidence, 'report.md'), lines.join('\n'));
  const short = [
    `# R1-029 ${summary}`,
    `schema ${schema}`,
    `cleanup ${cleanupNote}`,
    ...steps.map((step) => `${step.status} ${step.name}`),
    '不是 ACCEPTED。不是 IT-2 出站。没有 R1-030。',
  ].join('\n') + '\n';
  writeFileSync('/tmp/r1-029-review.md', short);
}

async function main() {
  assertMysql();
  assertPorts();
  sql(`CREATE DATABASE \`${schema}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
  note('SCHEMA ' + schema);

  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = publicKey.export({ format: 'jwk' });
  jwk.kid = 'r1-029-local';
  jwk.alg = 'RS256';
  jwk.use = 'sig';
  await startJwks(jwk);
  await startConsentStub();
  const learnerToken = mint(privateKey, learnerClaims(subject, 'PASSED', 'GRANTED'));
  const adultDenied = mint(privateKey, learnerClaims(deniedAdult, 'REJECTED', 'GRANTED'));
  const consentDenied = mint(privateKey, learnerClaims(deniedConsent, 'PASSED', 'WITHDRAWN'));
  const serviceToken = mint(privateKey, {
    sub: serviceSubject,
    tenant_id: 'platform',
    service_id: serviceSubject,
    permissions: ['content:answer-rules:read'],
    token_type: 'service',
    scope: 'content:answer-rules:read',
  });

  const content = startJava('content-service', 'content-service', {
    CONTENT_PERSISTENCE_MODE: 'jdbc',
    CONTENT_FLYWAY_ENABLED: 'true',
    CONTENT_SERVICE_SCHEMA: schema,
    CONTENT_JDBC_URL: jdbcUrl(),
    CONTENT_JDBC_USERNAME: 'root',
    CONTENT_JDBC_PASSWORD: password,
    CONTENT_SERVICE_PORT: String(contentPort),
    CONTENT_SERVICE_SERVER_ADDRESS: '127.0.0.1',
    CONTENT_EVENT_RELAY_ENABLED: 'false',
    CONTENT_EVENT_CONSUMER_ENABLED: 'false',
    CONTENT_SERVICE_SECURITY_ISSUER_URI: issuer,
    CONTENT_SERVICE_SECURITY_JWK_SET_URI: `${issuer}/jwks`,
    CONTENT_SERVICE_SECURITY_AUDIENCE: audience,
  });
  await waitHealth(content, contentPort, 'CONTENT');
  const flyway = sqlScalar(`SELECT COUNT(*), SUM(success=0) FROM \`${schema}\`.flyway_schema_history WHERE version IS NOT NULL;`);
  const seeded = distribution();
  const seedOk = flyway.endsWith('\t0') && seeded.total === 10 && seeded.vocab === 3 && seeded.grammar === 3
    && seeded.reading === 2 && seeded.listening === 2 && seeded.bank === 10 && seeded.answers === 10;
  record('content-seed-10-3-3-2-2', seedOk ? 'PASS' : 'FAIL', { flyway, seeded });
  if (!seedOk) throw new Error('SEED_SHAPE');

  const sealed = await request({ port: contentPort, path: '/internal/v1/content/placement-bank/sealed', token: learnerToken });
  const sealedData = dataOf(sealed.body);
  const sealedItems = sealedData && Array.isArray(sealedData.items) ? sealedData.items : [];
  const dims = sealedItems.reduce((acc, item) => {
    acc[item.dimension] = (acc[item.dimension] || 0) + 1;
    return acc;
  }, {});
  const sealedOk = sealed.status === 200 && sealedItems.length === 10
    && dims.VOCABULARY === 3 && dims.BASIC_GRAMMAR === 3 && dims.READING === 2 && dims.LISTENING === 2
    && sealedItems.every((item) => item.stem && Array.isArray(item.options) && item.options.length > 0)
    && !leaks(sealed.body);
  record('sealed-200-no-correctOption', sealedOk ? 'PASS' : 'FAIL', {
    status: sealed.status, bytes: sealed.body.length, dims, leaks: leaks(sealed.body), sampleKeys: sealedItems[0] ? Object.keys(sealedItems[0]) : [],
  });
  if (!sealedOk) throw new Error('SEALED');

  const stem = sqlScalar(`SELECT stem FROM \`${schema}\`.content_placement_item WHERE placement_item_id=266010;`);
  sql(`CREATE TABLE \`${schema}\`.r1_029_hold_item AS SELECT * FROM \`${schema}\`.content_placement_item WHERE placement_item_id=266010;`);
  sql(`DELETE FROM \`${schema}\`.content_placement_item WHERE placement_item_id=266010;`);
  const short = await request({ port: contentPort, path: '/internal/v1/content/placement-bank/sealed', token: learnerToken });
  const shortOk = short.status === 503 && !short.body.includes(stem) && !leaks(short.body)
    && distribution().total === 9;
  record('sealed-under-10-is-503', shortOk ? 'PASS' : 'FAIL', {
    status: short.status, total: distribution().total, body: clip(short.body), stemLeaked: short.body.includes(stem),
  });
  sql(`INSERT INTO \`${schema}\`.content_placement_item SELECT * FROM \`${schema}\`.r1_029_hold_item;`);
  sql(`DROP TABLE \`${schema}\`.r1_029_hold_item;`);
  const restored = await request({ port: contentPort, path: '/internal/v1/content/placement-bank/sealed', token: learnerToken });
  const restoredOk = shortOk && restored.status === 200 && !leaks(restored.body) && distribution().total === 10;
  record('sealed-restored-200', restoredOk ? 'PASS' : 'FAIL', { status: restored.status, total: distribution().total });
  if (!restoredOk) throw new Error('SEALED_503_OR_RESTORE');

  renameHistory('flyway_schema_history', 'content_flyway_schema_history');
  emptyHistoryLike('content_flyway_schema_history');
  const learner = startJava('learner-service', 'learner-service', {
    LEARNER_PERSISTENCE_MODE: 'jdbc',
    LEARNER_FLYWAY_ENABLED: 'true',
    LEARNER_SCHEMA: schema,
    LEARNER_JDBC_URL: jdbcUrl(),
    LEARNER_JDBC_USERNAME: 'root',
    LEARNER_JDBC_PASSWORD: password,
    LEARNER_SERVICE_PORT: String(learnerPort),
    SERVER_ADDRESS: '127.0.0.1',
    LEARNER_SECURITY_ISSUER_URI: issuer,
    LEARNER_SECURITY_JWK_SET_URI: `${issuer}/jwks`,
    LEARNER_SECURITY_AUDIENCE: audience,
    LEARNER_CONSENT_RECHECK_ENABLED: 'true',
    LEARNER_CONSENT_RECHECK_IAM_BASE_URL: `http://127.0.0.1:${consentPort}`,
    LEARNER_CONSENT_RECHECK_CLIENT_ID: 'learner-service',
    LEARNER_CONSENT_RECHECK_CLIENT_SECRET: 'r1-029-local-consent-secret',
  });
  await waitHealth(learner, learnerPort, 'LEARNER');
  const learnerFlyway = sqlScalar(`SELECT COUNT(*), SUM(success=0) FROM \`${schema}\`.flyway_schema_history WHERE version IS NOT NULL;`);
  const put = await request({
    port: learnerPort,
    method: 'PUT',
    path: '/api/v1/learner/targets',
    token: learnerToken,
    headers: { 'Idempotency-Key': 'r1-029-goal-000001' },
    body: { expectedStateVersion: 0, goalCode: 'FOUNDATION', targetLevel: 'A1', dailyQuotaMinutes: 15 },
  });
  const goal = dataOf(put.body);
  const goalOk = put.status === 200 && goal && goal.status === 'ACTIVE' && Number(goal.targetId) >= 1
    && goal.goalCode && goal.targetLevel && Number(goal.stateVersion) >= 1;
  record('learner-active-goal', goalOk ? 'PASS' : 'FAIL', {
    status: put.status, flyway: learnerFlyway, goal: goal ? {
      status: goal.status, targetId: goal.targetId, goalCode: goal.goalCode, stateVersion: goal.stateVersion,
    } : clip(put.body),
  });
  if (!goalOk) throw new Error('GOAL');

  renameHistory('flyway_schema_history', 'learner_flyway_schema_history');
  emptyHistoryLike('learner_flyway_schema_history');
  const assessment = startJava('assessment-service', 'assessment-service', {
    ASSESSMENT_PERSISTENCE_ENABLED: 'true',
    ASSESSMENT_FLYWAY_ENABLED: 'true',
    ASSESSMENT_SCHEMA: schema,
    ASSESSMENT_DB_URL: jdbcUrl(),
    ASSESSMENT_DB_USERNAME: 'root',
    ASSESSMENT_DB_PASSWORD: password,
    ASSESSMENT_SERVICE_PORT: String(assessmentPort),
    ASSESSMENT_SERVICE_SERVER_ADDRESS: '127.0.0.1',
    ASSESSMENT_SECURITY_ISSUER_URI: issuer,
    ASSESSMENT_SECURITY_JWK_SET_URI: `${issuer}/jwks`,
    ASSESSMENT_SECURITY_AUDIENCE: audience,
    ASSESSMENT_PLACEMENT_BANK_CONTENT_BASE_URL: `http://127.0.0.1:${contentPort}`,
    ASSESSMENT_PLACEMENT_BANK_LEARNER_BASE_URL: `http://127.0.0.1:${learnerPort}`,
    ASSESSMENT_PLACEMENT_SCORE_CONTENT_BASE_URL: `http://127.0.0.1:${contentPort}`,
    ASSESSMENT_PLACEMENT_SCORE_SERVICE_TOKEN: serviceToken,
    SPRING_FLYWAY_BASELINE_ON_MIGRATE: 'true',
    SPRING_FLYWAY_BASELINE_VERSION: '0',
    SERVER_ERROR_INCLUDE_MESSAGE: 'always',
    SPRING_MVC_PROBLEMDETAILS_ENABLED: 'true',
  });
  await waitHealth(assessment, assessmentPort, 'ASSESSMENT');
  const assessmentFlyway = sqlScalar(`SELECT GROUP_CONCAT(version ORDER BY installed_rank), SUM(success=0)
    FROM \`${schema}\`.flyway_schema_history WHERE version IS NOT NULL;`);
  record('assessment-flyway', assessmentFlyway.endsWith('\t0') ? 'PASS' : 'FAIL', { assessmentFlyway });
  if (!assessmentFlyway.endsWith('\t0')) throw new Error('ASSESSMENT_FLYWAY');

  const gateway = startJava('api-gateway', 'api-gateway', {
    SPRING_PROFILES_ACTIVE: 'local',
    API_GATEWAY_PORT: String(gatewayPort),
    SERVER_ADDRESS: '127.0.0.1',
    ASSESSMENT_SERVICE_BASE_URL: `http://127.0.0.1:${assessmentPort}`,
    LEARNER_SERVICE_BASE_URL: `http://127.0.0.1:${learnerPort}`,
    CONTENT_SERVICE_BASE_URL: `http://127.0.0.1:${contentPort}`,
    GATEWAY_RESPONSE_TIMEOUT: '30s',
    GATEWAY_CONNECT_TIMEOUT_MS: '3000',
    GATEWAY_RATE_LIMIT_BACKEND: 'memory',
  });
  await waitHealth(gateway, gatewayPort, 'GATEWAY');

  async function openSession(token, key) {
    return request({
      port: gatewayPort,
      method: 'POST',
      path: '/api/v1/assessment/placement/sessions',
      token,
      headers: { 'Idempotency-Key': key },
    });
  }

  const beforeDenied = sessionCount(deniedAdult) + sessionCount(deniedConsent);
  const adultNo = await openSession(adultDenied, 'r1-029-open-adult-deny');
  const consentNo = await openSession(consentDenied, 'r1-029-open-consent-deny');
  const afterDenied = sessionCount(deniedAdult) + sessionCount(deniedConsent);
  const gateOk = adultNo.status === 403 && consentNo.status === 403 && beforeDenied === 0 && afterDenied === 0;
  record('gate-closed-403-no-session', gateOk ? 'PASS' : 'FAIL', {
    adult: adultNo.status, consent: consentNo.status, sessions: afterDenied,
    adultBody: clip(adultNo.body), consentBody: clip(consentNo.body),
  });
  if (!gateOk) throw new Error('GATE');

  const targetRead = await request({ port: learnerPort, path: '/api/v1/learner/targets', token: learnerToken });
  const targetData = dataOf(targetRead.body);
  const opened = await openSession(learnerToken, 'r1-029-open-00000001');
  const openedData = dataOf(opened.body);
  const items = openedData && Array.isArray(openedData.items)
    ? [...openedData.items].sort((a, b) => Number(a.displayOrder) - Number(b.displayOrder)) : [];
  const openOk = opened.status === 201 && items.length === 10
    && items.every((item) => item.stem && Array.isArray(item.options) && item.options.length > 0)
    && Number(openedData.acceptedSequence) === 0 && !leaks(opened.body);
  let directOpen = null;
  if (!openOk) {
    directOpen = await request({
      port: assessmentPort,
      method: 'POST',
      path: '/internal/v1/assessment/placement/sessions',
      token: learnerToken,
      headers: { 'Idempotency-Key': 'r1-029-open-direct-01' },
    });
  }
  record('open-10-stems-no-correctOption', openOk ? 'PASS' : 'FAIL', {
    status: opened.status,
    acceptedSequence: openedData && openedData.acceptedSequence,
    stateVersion: openedData && openedData.stateVersion,
    items: items.length,
    leaks: leaks(opened.body),
    leakHits: leakHits(opened.body),
    r1018RealDb: openOk,
    body: openOk ? undefined : clip(opened.body, 900),
    targetRead: {
      status: targetRead.status,
      goalStatus: targetData && targetData.status,
      targetId: targetData && targetData.targetId,
      stateVersion: targetData && targetData.stateVersion,
      body: targetRead.status === 200 ? undefined : clip(targetRead.body, 400),
    },
    directAssessment: directOpen ? { status: directOpen.status, body: clip(directOpen.body, 900) } : undefined,
  });
  if (!openOk) throw new Error('OPEN');
  const sessionId = openedData.sessionId;
  let version = Number(openedData.stateVersion);

  async function submit(sequence, itemId, option, key, expectedVersion) {
    const candidateResponse = { responseType: 'CHOICE', selectedOptionIds: [option] };
    const responseDigest = sha256(JSON.stringify([sessionId, itemId, sequence, candidateResponse]));
    return request({
      port: gatewayPort,
      method: 'POST',
      path: `/api/v1/assessment/placement/sessions/${sessionId}/responses`,
      token: learnerToken,
      headers: { 'Idempotency-Key': key },
      body: {
        expectedStateVersion: expectedVersion,
        itemId,
        itemSequence: sequence,
        candidateResponse,
        responseDigest,
        timeSpentSec: 4,
      },
    });
  }

  async function readSession(id = sessionId) {
    return request({
      port: gatewayPort,
      path: `/api/v1/assessment/placement/sessions/${id}`,
      token: learnerToken,
    });
  }

  const ahead = await submit(2, items[1].itemId, 'a', 'r1-029-ahead-0000001', version);
  const aheadRead = dataOf((await readSession()).body);
  const aheadCount = Number(sqlScalar(`SELECT COUNT(*) FROM \`${schema}\`.p1_placement_response WHERE session_id='${sessionId}';`));
  const aheadOk = ahead.status === 409 && Number(aheadRead.acceptedSequence) === 0 && aheadCount === 0
    && Number(aheadRead.stateVersion) === version;
  record('out-of-order-409-unchanged', aheadOk ? 'PASS' : 'FAIL', {
    status: ahead.status, acceptedSequence: aheadRead && aheadRead.acceptedSequence, responses: aheadCount, body: clip(ahead.body),
  });
  if (!aheadOk) throw new Error('AHEAD');

  const correct = answerKey(items[0].itemId);
  const first = await submit(1, items[0].itemId, correct, 'r1-029-answer-000001', version);
  const firstData = dataOf(first.body);
  const firstOk = first.status === 200 && firstData && firstData.outcome === 'FULL'
    && Number(firstData.acceptedSequence) === 1 && !leaks(first.body);
  record('correct-full-advances-no-correctOption', firstOk ? 'PASS' : 'FAIL', {
    status: first.status, outcome: firstData && firstData.outcome, acceptedSequence: firstData && firstData.acceptedSequence,
    leaks: leaks(first.body),
  });
  if (!firstOk) throw new Error('FULL');
  version = Number(firstData.stateVersion);

  const behind = await submit(1, items[0].itemId, correct, 'r1-029-behind-000001', version);
  const stale = await submit(2, items[1].itemId, 'a', 'r1-029-stale-0000001', version - 1);
  const midRead = dataOf((await readSession()).body);
  const midCount = Number(sqlScalar(`SELECT COUNT(*) FROM \`${schema}\`.p1_placement_response WHERE session_id='${sessionId}';`));
  const lockOk = behind.status === 409 && stale.status === 409 && Number(midRead.acceptedSequence) === 1
    && Number(midRead.stateVersion) === version && midCount === 1;
  record('stale-or-behind-409-unchanged', lockOk ? 'PASS' : 'FAIL', {
    behind: behind.status, stale: stale.status, acceptedSequence: midRead && midRead.acceptedSequence, responses: midCount,
  });
  if (!lockOk) throw new Error('LOCK');

  const wrongOption = correct === 'a' ? 'b' : 'a';
  const secondCorrect = answerKey(items[1].itemId);
  const secondOption = secondCorrect === 'a' ? 'b' : 'a';
  const second = await submit(2, items[1].itemId, secondOption, 'r1-029-answer-000002', version);
  const secondData = dataOf(second.body);
  const secondOk = second.status === 200 && secondData && secondData.outcome === 'ZERO'
    && Number(secondData.acceptedSequence) === 2 && !leaks(second.body) && secondOption !== secondCorrect;
  record('wrong-zero-no-correctOption', secondOk ? 'PASS' : 'FAIL', {
    status: second.status, outcome: secondData && secondData.outcome, acceptedSequence: secondData && secondData.acceptedSequence,
    leaks: leaks(second.body), usedWrongOption: wrongOption !== correct,
  });
  if (!secondOk) throw new Error('ZERO');
  version = Number(secondData.stateVersion);

  const outcomes = ['FULL', 'ZERO'];
  let tenth = secondData;
  for (let index = 2; index < 10; index += 1) {
    const wanted = answerKey(items[index].itemId);
    const option = index % 2 === 0 ? wanted : (wanted === 'a' ? 'b' : 'a');
    const sent = await submit(index + 1, items[index].itemId, option, `r1-029-answer-${String(index + 1).padStart(6, '0')}`, version);
    const sentData = dataOf(sent.body);
    const expect = option === wanted ? 'FULL' : 'ZERO';
    outcomes.push(expect);
    if (sent.status !== 200 || !sentData || sentData.outcome !== expect || leaks(sent.body)) {
      record('remaining-scores', 'FAIL', { index: index + 1, status: sent.status, outcome: sentData && sentData.outcome, expect, body: clip(sent.body) });
      throw new Error('SCORE');
    }
    version = Number(sentData.stateVersion);
    tenth = sentData;
  }
  const report = tenth.report || tenth.summary || (tenth.completedResult || null);
  const reportId = (tenth.report && tenth.report.reportId) || (tenth.summary && tenth.summary.reportId);
  const digest = (tenth.report && tenth.report.digest) || (tenth.summary && tenth.summary.digest);
  const doneOk = Number(tenth.acceptedSequence) === 10 && tenth.status === 'COMPLETED' && reportId && /^[a-f0-9]{64}$/.test(digest)
    && !leaks(JSON.stringify(tenth));
  record('ten-items-report-digest', doneOk ? 'PASS' : 'FAIL', {
    acceptedSequence: tenth.acceptedSequence, status: tenth.status, reportId, digest, outcomes,
  });
  if (!doneOk) throw new Error('REPORT');

  const read1 = await request({
    port: gatewayPort, path: `/api/v1/assessment/placement/reports/${reportId}`, token: learnerToken,
  });
  const read2 = await request({
    port: gatewayPort, path: `/api/v1/assessment/placement/reports/${reportId}`, token: learnerToken,
  });
  const d1 = dataOf(read1.body);
  const d2 = dataOf(read2.body);
  const same = read1.status === 200 && read2.status === 200 && d1 && d2 && d1.digest === digest && d2.digest === digest
    && read1.body === read2.body && !leaks(read1.body);
  record('report-reread-same-digest', same ? 'PASS' : 'FAIL', {
    first: read1.status, second: read2.status, digest: d1 && d1.digest, sameBody: read1.body === read2.body,
  });
  if (!same) throw new Error('REREAD');

  const sessionsBeforeRetest = sessionCount(subject);
  const retest = await request({
    port: assessmentPort,
    method: 'POST',
    path: `/internal/v1/assessment/placement/sessions/${sessionId}/retest`,
    token: learnerToken,
    headers: { 'Idempotency-Key': 'r1-029-retest-000001' },
  });
  const retestData = dataOf(retest.body);
  const oldAfter = await request({
    port: gatewayPort, path: `/api/v1/assessment/placement/reports/${reportId}`, token: learnerToken,
  });
  const oldDigest = dataOf(oldAfter.body);
  const retestOk = retest.status === 201 && retestData && retestData.sessionId && retestData.sessionId !== sessionId
    && Number(retestData.acceptedSequence) === 0 && !leaks(retest.body)
    && oldDigest && oldDigest.digest === digest && sessionCount(subject) === sessionsBeforeRetest + 1;
  record('retest-new-session-old-digest', retestOk ? 'PASS' : 'FAIL', {
    status: retest.status,
    newSession: retestData && retestData.sessionId,
    acceptedSequence: retestData && retestData.acceptedSequence,
    oldDigest: oldDigest && oldDigest.digest,
    via: 'assessment-internal',
    body: retestOk ? undefined : clip(retest.body),
  });
  if (!retestOk) throw new Error('RETEST');
  const newSession = retestData.sessionId;

  const publicRetest = await request({
    port: gatewayPort,
    method: 'POST',
    path: `/api/v1/assessment/placement/sessions/${sessionId}/retest`,
    token: learnerToken,
    headers: { 'Idempotency-Key': 'r1-029-retest-public01' },
  });
  record('public-retest-route-observation', 'NOT_RUN', {
    status: publicRetest.status,
    body: clip(publicRetest.body),
    reason: 'R1-024 没有把重测接到网关。这里只记录现状，不用这个状态代替内部重测结果，也不把它写成按钮已接通。',
  });

  const beforeIncomplete = sessionCount(subject);
  const incomplete = await request({
    port: assessmentPort,
    method: 'POST',
    path: `/internal/v1/assessment/placement/sessions/${newSession}/retest`,
    token: learnerToken,
    headers: { 'Idempotency-Key': 'r1-029-retest-000002' },
  });
  const incompleteOk = incomplete.status === 409 && sessionCount(subject) === beforeIncomplete
    && dataOf((await request({
      port: gatewayPort, path: `/api/v1/assessment/placement/reports/${reportId}`, token: learnerToken,
    })).body).digest === digest;
  record('incomplete-retest-409', incompleteOk ? 'PASS' : 'FAIL', {
    status: incomplete.status, sessions: sessionCount(subject), body: clip(incomplete.body),
  });
  if (!incompleteOk) throw new Error('INCOMPLETE_RETEST');

  const skip = await request({
    port: gatewayPort,
    method: 'POST',
    path: '/api/v1/assessment/placement/baselines/skip',
    token: learnerToken,
    headers: { 'Idempotency-Key': 'r1-029-skip-incomplete' },
    body: { sessionId: newSession },
  });
  const skipData = dataOf(skip.body);
  const skipOk = skip.status === 201 && skipData && skipData.status === 'SKIPPED' && skipData.resultKind === 'SKIPPED'
    && !Object.prototype.hasOwnProperty.call(skipData, 'reportId') && !leaks(skip.body) && !/reportId/.test(skip.body);
  record('skip-incomplete-skipped-no-report', skipOk ? 'PASS' : 'FAIL', {
    status: skip.status, bodyStatus: skipData && skipData.status, resultKind: skipData && skipData.resultKind,
    hasReportId: skipData ? Object.prototype.hasOwnProperty.call(skipData, 'reportId') : null,
    body: skipOk ? undefined : clip(skip.body),
  });
  if (!skipOk) throw new Error('SKIP');

  const skipDone = await request({
    port: gatewayPort,
    method: 'POST',
    path: '/api/v1/assessment/placement/baselines/skip',
    token: learnerToken,
    headers: { 'Idempotency-Key': 'r1-029-skip-completed1' },
    body: { sessionId },
  });
  const afterSkipReport = dataOf((await request({
    port: gatewayPort, path: `/api/v1/assessment/placement/reports/${reportId}`, token: learnerToken,
  })).body);
  const storedDigest = sqlScalar(`SELECT JSON_UNQUOTE(JSON_EXTRACT(report_json, '$.digest'))
    FROM \`${schema}\`.p1_placement_result WHERE report_id='${reportId}';`);
  const skipDoneOk = skipDone.status === 409 && afterSkipReport && afterSkipReport.digest === digest && storedDigest === digest;
  record('skip-completed-409-digest-unchanged', skipDoneOk ? 'PASS' : 'FAIL', {
    status: skipDone.status, digest: afterSkipReport && afterSkipReport.digest, storedDigest, body: clip(skipDone.body),
  });
  if (!skipDoneOk) throw new Error('SKIP_DONE');

  const b25Before = Number(sqlScalar(`SELECT COUNT(*) FROM \`${schema}\`.b25_assessment_session WHERE principal_id='${subject}';`));
  const postStart = await request({
    port: gatewayPort,
    method: 'POST',
    path: '/api/v1/assessment/placement/start',
    token: learnerToken,
    headers: { 'Idempotency-Key': 'r1-029-legacy-start01' },
    body: {},
  });
  const b25After = Number(sqlScalar(`SELECT COUNT(*) FROM \`${schema}\`.b25_assessment_session WHERE principal_id='${subject}';`));
  const postStartJson = parseJson(postStart.body) || {};
  const postStartCode = postStartJson.errorCode || (postStartJson.error && postStartJson.error.errorCode);
  const postStartOk = postStart.status === 404 && postStartCode === 'NOT_FOUND' && b25After === b25Before;
  record('gateway-post-start-404', postStartOk ? 'PASS' : 'FAIL', {
    status: postStart.status, errorCode: postStartCode, b25: b25After, body: clip(postStart.body),
  });
  if (!postStartOk) throw new Error('POST_START');

  const getStart = await request({
    port: gatewayPort,
    path: '/api/v1/assessment/placement/start',
    token: learnerToken,
  });
  const getStartJson = parseJson(getStart.body) || {};
  const getStartOk = getStart.status === 200 && getStartJson.status === 'EMPTY' && getStartJson.errorCode !== 'NOT_FOUND';
  record('gateway-get-start-forwarded', getStartOk ? 'PASS' : 'FAIL', {
    status: getStart.status, body: clip(getStart.body),
  });
  if (!getStartOk) throw new Error('GET_START');

  const again = await openSession(learnerToken, 'r1-029-open-00000002');
  const againData = dataOf(again.body);
  const againOk = again.status === 201 && againData && againData.sessionId && againData.sessionId !== sessionId
    && !leaks(again.body);
  record('gateway-post-sessions-not-404', againOk ? 'PASS' : 'FAIL', {
    status: again.status, sessionId: againData && againData.sessionId,
  });
  if (!againOk) throw new Error('POST_SESSIONS');

  record('r1-018-real-db-open', 'PASS', {
    reason: '同一专库上，content 密封下发经 assessment 开题，网关 POST /placement/sessions 返回 10 道无 correctOption 的题干。',
  });
}

try {
  await main();
} catch (error) {
  note('FATAL ' + (error && error.stack ? error.stack : error));
  if (!failed) record('run', 'FAIL', { error: String(error && error.message ? error.message : error) });
} finally {
  try {
    await cleanup();
  } catch (error) {
    cleanupNote = 'cleanup-threw ' + String(error && error.message ? error.message : error);
    note(cleanupNote);
  }
  writeReports();
  if (steps.some((step) => step.status === 'FAIL')) process.exitCode = 1;
}
