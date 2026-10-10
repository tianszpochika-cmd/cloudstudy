import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, chmodSync, realpathSync, lstatSync, copyFileSync, openSync, closeSync } from 'node:fs';
import { randomBytes, randomUUID, createHash, createPublicKey, verify } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { request as httpsRequest } from 'node:https';
import { request as httpRequest } from 'node:http';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readProcessIdentity, compareProcessIdentity } from './process-identity.mjs';
import { root, createTls, verifyPrivateMaterialPermissions } from './prepare.mjs';
import { registeredPorts, inspectFixedPorts, readBuildReceipt, BUILD_RECEIPT_PATH } from './lifecycle.mjs';
const evidence = path.join(root, 'evidence/redesign/2026-10-08/R1-002/runtime');
const approvalPath = path.join(evidence, 'run-approval.json');
let currentOwnedChildren = [];
const containerName = 'yuxuexing-local-mysql-1';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
function safeJson(bytes, code) { try { return JSON.parse(bytes); } catch { throw new Error(code); } }
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
function checked(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', timeout: 60000, maxBuffer: 8 * 1024 * 1024, ...options });
  if (result.status !== 0) throw new Error(`COMMAND_FAILED_${path.basename(command)}_${result.status ?? 'unknown'}`);
  return result.stdout;
}
export function databaseGrantScope(schema, partialRevokes) {
  if(!/^r1_002_(?:learner_)?20261008_[a-f0-9]{12}$/.test(schema) || typeof partialRevokes!=='boolean')throw new Error('GRANT_SCOPE');
  // MySQL database ACL names are patterns unless partial_revokes is enabled.
  return '`'+(partialRevokes?schema:schema.replaceAll('_','\\_'))+'`.*';
}
export function assertLearnerSchema(schema) {
  if(!/^r1_002_learner_20261008_[a-f0-9]{12}$/.test(schema))throw new Error('LEARNER_SCHEMA_SCOPE');
  return schema;
}
export function assertSchema(schema) {
  if (!/^r1_002_20261008_[a-f0-9]{12}$/.test(schema)) throw new Error('SCHEMA_SCOPE');
  return schema;
}
function protectedDirectory(directory) {
  const resolved = realpathSync(directory), metadata = lstatSync(resolved);
  if (resolved === root || resolved.startsWith(root + path.sep) || metadata.uid !== process.getuid()
      || metadata.mode % 0o1000 !== 0o700 || lstatSync(directory).isSymbolicLink()) throw new Error('PRIVATE_DIRECTORY_SCOPE');
  return resolved;
}
function secretFile(directory, name, content) {
  writeFileSync(path.join(directory, name), content, { mode: 0o600, flag: 'wx' });
}
function inspectMysql() {
  const value = safeJson(checked('docker', ['inspect', '--format',
    '{"Id":{{json .Id}},"Name":{{json .Name}},"Image":{{json .Config.Image}},"Labels":{{json .Config.Labels}},"Ports":{{json .NetworkSettings.Ports}},"Status":{{json .State.Status}},"Health":{{json .State.Health.Status}}}', containerName]),'MYSQL_METADATA_INVALID');
  // Only allowlisted provenance is retained; never return Config.Env or container commands.
  const facts = { id: value.Id, name: value.Name, image: value.Image,
    project: value.Labels?.['com.docker.compose.project'], service: value.Labels?.['com.docker.compose.service'],
    port: value.Ports?.['3306/tcp'], state: value.Status, health: value.Health };
  if (facts.name !== '/' + containerName || facts.project !== 'yuxuexing-local' || facts.service !== 'mysql'
      || facts.image !== 'mysql:8.0' || facts.state !== 'running' || facts.health !== 'healthy'
      || JSON.stringify(facts.port) !== JSON.stringify([{ HostIp: '127.0.0.1', HostPort: '13306' }])) throw new Error('MYSQL_OWNER_OR_PORT_CHANGED');
  return facts;
}
function sql(statement, expectedMysql) {
  if (JSON.stringify(inspectMysql()) !== JSON.stringify(expectedMysql)) throw new Error('MYSQL_IDENTITY_CHANGED');
  return checked('docker', ['exec', '-i', containerName, 'sh', '-c',
    'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql --protocol=socket --user=root --batch --skip-column-names'], { input: statement });
}
export function validateRestrictedToken(token, document) {
  const pieces = token.split('.'); if (pieces.length !== 3) throw new Error('TOKEN_SHAPE');
  const header = safeJson(Buffer.from(pieces[0], 'base64url'),'TOKEN_HEADER_INVALID'), claims = safeJson(Buffer.from(pieces[1], 'base64url'),'TOKEN_CLAIMS_INVALID');
  const key = document.data?.keys?.find(value => value.kid === header.kid);
  if (header.alg !== 'RS256' || !key || key.kty !== 'RSA' || ['d','p','q','dp','dq','qi','oth','k'].some(name => Object.hasOwn(key,name))
      || !verify('RSA-SHA256', Buffer.from(pieces[0] + '.' + pieces[1]), createPublicKey({ key, format: 'jwk' }), Buffer.from(pieces[2], 'base64url')))
    throw new Error('TOKEN_SIGNATURE');
  const perms = Array.isArray(claims.permissions) ? claims.permissions : [];
  const allowedPermissions=['iam.self.read','iam.self.write','learner.profile.read','learner.profile.write'];
  if (claims.iss !== 'http://127.0.0.1:18087' || !(Array.isArray(claims.aud) ? claims.aud : [claims.aud]).includes('yuxuexing-api')
      || claims.exp <= Date.now()/1000 || claims.adult_gate !== 'NOT_EVALUATED' || claims.consent_state !== 'UNKNOWN'
      || claims.phase!=='phase-1' || claims.tenant_id!=='platform' || claims.token_type!=='access'
      || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(claims.sub)
      || claims.sub!==claims.owner_id || claims.scope!==perms.slice().sort().join(' ')
      || perms.length!==allowedPermissions.length || perms.some(value => !allowedPermissions.includes(value))) throw new Error('TOKEN_NOT_RESTRICTED');
  return { signature: 'RS256_VERIFIED', issuer: claims.iss, audience: 'yuxuexing-api', adultGate: claims.adult_gate,
    consentState: claims.consent_state, subjectOwnerEqual:true, tenant:'platform',phase:'phase-1',learningPermissionCount: 0, permissionCount: perms.length };
}
export function validateCookie(cookie, body) {
  if (typeof cookie !== 'string' || !cookie.startsWith('yuxuexing_refresh=') || !/;\s*Path=\/api\/v1\/auth(?:;|$)/.test(cookie)
      || !/;\s*HttpOnly(?:;|$)/i.test(cookie) || !/;\s*Secure(?:;|$)/i.test(cookie)
      || !/;\s*SameSite=None(?:;|$)/i.test(cookie) || !/;\s*Partitioned(?:;|$)/i.test(cookie)
      || !/;\s*Max-Age=[1-9]\d*(?:;|$)/.test(cookie)
      || Object.hasOwn(body.data ?? {}, 'refreshToken')) throw new Error('COOKIE_SECURITY');
  return { name: 'yuxuexing_refresh', path: '/api/v1/auth', httpOnly: true, secure: true, sameSite: 'None', partitioned: true, positiveMaxAge: true, bodyRefreshTokenPresent: false };
}
function http(url, { method = 'GET', body, token, ca } = {}) {
  return new Promise((resolve, reject) => {
    const secure = url.startsWith('https:'), payload = body ? JSON.stringify(body) : undefined;
    const req = (secure ? httpsRequest : httpRequest)(url, { method, ca, rejectUnauthorized: true, timeout: 8000,
      headers: { ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload), 'Idempotency-Key': randomBytes(16).toString('hex'), 'X-Auth-Transport': 'WEB_COOKIE' } : {}),
        ...(token ? { Authorization: 'Bearer ' + token } : {}) } }, response => {
      let bytes = ''; response.on('data', part => { bytes += part; if (bytes.length > 512 * 1024) req.destroy(new Error('RESPONSE_BOUND')); });
      response.on('end', () => { try { resolve({ status: response.statusCode, headers: response.headers, body: bytes ? JSON.parse(bytes) : null }); } catch { reject(new Error('RESPONSE_JSON_INVALID')); } });
    });
    req.on('timeout', () => req.destroy(new Error('REQUEST_TIMEOUT'))); req.on('error', () => reject(new Error('HTTP_TRANSPORT_FAILED')));
    if (payload) req.write(payload); req.end();
  });
}
function counts(config) {
  const schema = assertSchema(config.schema);
  const values = sql(`SELECT (SELECT COUNT(*) FROM ${schema}.iam_principal),(SELECT COUNT(*) FROM ${schema}.iam_account),(SELECT COUNT(*) FROM ${schema}.iam_session),`+
    `(SELECT COUNT(*) FROM ${schema}.iam_device),(SELECT COUNT(*) FROM ${schema}.iam_decision_audit),`+
    `(SELECT COUNT(*) FROM ${schema}.iam_idempotency_record WHERE state='COMPLETED');`, config.mysql).trim().split('\t').map(Number);
  return { principals:values[0], accounts: values[1], sessions: values[2], devices: values[3], audits: values[4], completedIdempotency: values[5] };
}
export function prepare() {
  const parent = realpathSync(mkdtempSync(path.join(os.tmpdir(), 'r1-002-20261008-'))); chmodSync(parent, 0o700);
  const tls = createTls(parent, safeJson(readFileSync(path.join(root, 'config/local-ports.json')),'PORTS_JSON_INVALID'));
  const directory = tls.directory, suffix = randomBytes(6).toString('hex'), schema = assertSchema('r1_002_20261008_' + suffix), user = 'r1002_' + suffix;
  const password = randomBytes(32).toString('base64url'), mysql = inspectMysql();
  const partialValue=sql('SELECT @@GLOBAL.partial_revokes;',mysql).trim();
  if(!['0','1'].includes(partialValue))throw new Error('MYSQL_GRANT_MODE_UNKNOWN');
  const partialRevokes=partialValue==='1';
  if (sql(`SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name='${schema}'; SELECT COUNT(*) FROM mysql.user WHERE user='${user}';`,mysql).trim() !== '0\n0') throw new Error('RESOURCE_EXISTS');
  sql(`CREATE DATABASE ${schema} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; CREATE USER '${user}'@'%' IDENTIFIED BY '${password}'; GRANT SELECT,INSERT,UPDATE,DELETE,CREATE,ALTER,DROP,INDEX,REFERENCES ON ${databaseGrantScope(schema,partialRevokes)} TO '${user}'@'%';`,mysql);
  checked('openssl', ['genpkey', '-algorithm', 'RSA', '-pkeyopt', 'rsa_keygen_bits:3072', '-out', path.join(directory,'iam-signer.pem')]); chmodSync(path.join(directory,'iam-signer.pem'),0o600);
  const tlsConfig = readFileSync(path.join(directory,'iam-private.properties'),'utf8');
  secretFile(directory,'iam-runtime.properties', tlsConfig + '\n' + [
    'server.address=127.0.0.1','server.port=18087','iam.persistence.enabled=true','spring.flyway.enabled=true',
    `iam.persistence.jdbc-url=jdbc:mysql://127.0.0.1:13306/${schema}?serverTimezone=UTC&useSSL=false&allowPublicKeyRetrieval=true`,
    `iam.persistence.schema=${schema}`,`iam.persistence.username=${user}`,`iam.persistence.password=${password}`,
    'iam.idempotency.v13-writers-drained=true',`iam.idempotency.replay-secret=${randomBytes(32).toString('base64url')}`,
    `iam.idempotency.fingerprint-secret=${randomBytes(32).toString('base64url')}`,
    `iam.jwt.private-key-file=${path.join(directory,'iam-signer.pem')}`,'iam.jwt.ephemeral-keys-allowed=false',
    'iam.jwt.refresh-cookie-secure=true','iam.consent.policy-source=local-candidate','iam.local-adult-gate-enabled=false',
    'management.otlp.metrics.export.enabled=false','management.opentelemetry.enabled=false'
  ].join('\n')+'\n');
  const wrong = createTls(parent,safeJson(readFileSync(path.join(root,'config/local-ports.json')),'PORTS_JSON_INVALID'));
  secretFile(directory,'wrong-trust.json',JSON.stringify({directory:wrong.directory})+'\n');
  const learnerSuffix=randomBytes(6).toString('hex'),learnerSchema=assertLearnerSchema('r1_002_learner_20261008_'+learnerSuffix),learnerUser='r1002l_'+learnerSuffix,learnerPassword=randomBytes(32).toString('base64url');
  if(sql(`SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name='${learnerSchema}'; SELECT COUNT(*) FROM mysql.user WHERE user='${learnerUser}';`,mysql).trim()!=='0\n0')throw new Error('LEARNER_RESOURCE_EXISTS');
  sql(`CREATE DATABASE ${learnerSchema} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; CREATE USER '${learnerUser}'@'%' IDENTIFIED BY '${learnerPassword}'; GRANT SELECT,INSERT,UPDATE,DELETE,CREATE,ALTER,DROP,INDEX,REFERENCES ON ${databaseGrantScope(learnerSchema,partialRevokes)} TO '${learnerUser}'@'%';`,mysql);
  secretFile(directory,'learner-runtime.properties',[
    'server.address=127.0.0.1','server.port=18088','learner.persistence.mode=jdbc','spring.flyway.enabled=true',
    `LEARNER_SCHEMA=${learnerSchema}`,`spring.flyway.schemas=${learnerSchema}`,`spring.flyway.default-schema=${learnerSchema}`,`service.schema=${learnerSchema}`,
    `learner.persistence.jdbc-url=jdbc:mysql://127.0.0.1:13306/${learnerSchema}?serverTimezone=UTC&useSSL=false&allowPublicKeyRetrieval=true`,
    `learner.persistence.username=${learnerUser}`,`learner.persistence.password=${learnerPassword}`,'learner.persistence.driver-class-name=com.mysql.cj.jdbc.Driver',
    'security.resource-server.jwk-set-uri=https://127.0.0.1:18087/api/v1/auth/jwks',
    'security.resource-server.issuer-uri=http://127.0.0.1:18087','security.resource-server.audience=yuxuexing-api'
  ].join('\n')+'\n');
  const config = { learnerSchema,learnerUser, kind:'R1_002_OWNED_RUNTIME', directory, schema, user, mysql, materialCertificateSha256:tls.publicCertificate.sha256, preparedAt:new Date().toISOString() };
  secretFile(directory,'runtime.json',JSON.stringify(config,null,2)+'\n');
  const permissions=verifyPrivateMaterialPermissions(directory,['iam-signer.pem','iam-runtime.properties','learner-runtime.properties','runtime.json']);
  writeFileSync(path.join(evidence,'prepared-'+suffix+'.json'),JSON.stringify({kind:config.kind,schema,user,learnerSchema,learnerUser,mysql,privateDirectory:'<PRIVATE_MATERIAL_DIR>',permissions,certificate:tls.publicCertificate,databaseCreated:true,servicesStarted:false},null,2)+'\n',{flag:'wx'});
  return { privateDirectory:directory, schema, user, learnerSchema,learnerUser, prepared:true };
}
async function stop(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  if(child.r1Identity && (!compareProcessIdentity(child.r1Identity,readProcessIdentity(child.pid)).matches || child.r1Identity.ppid!==process.pid))throw new Error('OWNED_CHILD_IDENTITY_CHANGED');
  if(child._handle!==child.r1Handle || !child._handle || child._handle.pid!==child.pid)throw new Error('OWNED_NATIVE_HANDLE_CHANGED');
  child.kill('SIGTERM');
  for (let i=0;i<300 && child.exitCode === null && child.signalCode === null;i++) await delay(100);
  if (child.exitCode === null && child.signalCode === null) throw new Error('OWNED_CHILD_STOP_TIMEOUT');
}
async function start(id, directory, args, app = []) {
  const jarName = id+'.jar'; const log = openSync(path.join(directory,id+'-'+randomBytes(4).toString('hex')+'.log'),'wx',0o600); const child = spawn('java', [...args,'-jar',path.join(directory,jarName),
    '--spring.profiles.active=local','--management.otlp.metrics.export.enabled=false','--management.opentelemetry.enabled=false',...app],
    {cwd:directory,env:{PATH:process.env.PATH,JAVA_HOME:process.env.JAVA_HOME,LANG:'en_US.UTF-8'},stdio:['ignore',log,log]});
  closeSync(log);
  currentOwnedChildren.push(child);child.r1Handle=child._handle;
  if (!child.pid) throw new Error('CHILD_START_FAILED');
  child.on('error',()=>{child.r1StartFailed=true;});
  await delay(100);
  if(child.r1StartFailed || child.exitCode!==null || child.signalCode!==null)throw new Error('OWNED_CHILD_EARLY_EXIT');
  child.r1Identity=readProcessIdentity(child.pid);
  if(child.r1Identity.ppid!==process.pid || child.r1Identity.cwd!==directory)throw new Error('OWNED_CHILD_IDENTITY');
  return child;
}
async function healthy(child,url,ca) {
  for(let i=0;i<300;i++) {
    if(child.exitCode!==null || child.signalCode!==null) throw new Error('OWNED_CHILD_EARLY_EXIT');
    try { if((await http(url,{ca})).status===200)return; } catch {}
    await delay(200);
  }
  throw new Error('HEALTH_TIMEOUT');
}
export async function run(directory) {
  protectedDirectory(directory); const config=safeJson(readFileSync(path.join(directory,'runtime.json')),'PRIVATE_CONFIG_JSON_INVALID'); assertSchema(config.schema);assertLearnerSchema(config.learnerSchema);
  if(config.directory!==directory)throw new Error('RUNTIME_DIRECTORY_BINDING');
  const approval=safeJson(readFileSync(approvalPath),'RUN_APPROVAL_JSON_INVALID');
  if(approval.kind!=='ROOT_APPROVED_R1_002_RUNTIME' || approval.scriptSha256!==sha(readFileSync(fileURLToPath(import.meta.url)))
      || approval.schema!==config.schema || approval.learnerSchema!==config.learnerSchema || approval.mysqlId!==config.mysql.id || Date.parse(approval.expiresAt)<=Date.now())throw new Error('RUN_APPROVAL_BINDING');
  if(inspectFixedPorts(registeredPorts()).some(value=>value.state!=='FREE') || spawnSync('lsof',['-nP','-iTCP:18088','-sTCP:LISTEN','-Fp'],{encoding:'utf8'}).stdout.trim()) throw new Error('FIXED_PORT_OCCUPIED');
  const build=readBuildReceipt(path.join(root,BUILD_RECEIPT_PATH),{jarPath:path.join(root,'services/api-gateway/target/api-gateway-0.1.0-SNAPSHOT.jar')});
  const builds=safeJson(readFileSync(path.join(root,'evidence/redesign/2026-10-08/R1-002/gateway/runtime-builds.json')),'BUILD_RECEIPT_JSON_INVALID');
  if(builds.schemaVersion!=='r1-002-runtime-builds/v1' || builds.baselineGitHead!==checked('git',['rev-parse','HEAD'],{cwd:root}).trim())throw new Error('RUNTIME_BUILD_CONTEXT');
  for(const module of builds.modules ?? []) {
    if(!['services/iam-service','services/learner-service'].includes(module.module) || module.inputsUnchangedAfterBuild!==true
      || module.commands.some(value=>value.exitCode!==0)) throw new Error('RUNTIME_BUILD_RECEIPT');
    for(const file of module.inputFiles) {
      if(!/^(services\/(iam-service|learner-service)\/(src\/|pom.xml)|pom.xml$|config\/(toolchain-baseline|local-ports).json$)/.test(file.path)
        || sha(readFileSync(path.join(root,file.path)))!==file.sha256)throw new Error('RUNTIME_BUILD_SOURCE_DRIFT');
    }
  }
  for(const id of ['api-gateway','iam-service','learner-service']) {
    const source=path.join(root,`services/${id}/target/${id}-0.1.0-SNAPSHOT.jar`);
    const expected=id==='api-gateway'?build.output:builds.modules?.find(item=>item.module===`services/${id}`)?.outputs?.[0];
    if(!expected || sha(readFileSync(source))!==expected.sha256)throw new Error('CURRENT_JAR_BUILD_MISMATCH');
    copyFileSync(source,path.join(directory,id+'.jar'));chmodSync(path.join(directory,id+'.jar'),0o400);
  }
  const ca=readFileSync(path.join(directory,'test-ca.pem')); const children=currentOwnedChildren=[]; const report={kind:'R1_002_REGISTRATION_RUNTIME',status:'RUNNING',build,businessCardOnly:true,tlsCasesOldD1:'NOT_EXECUTED',checks:{}};
  let trigger=false;
  try {
    const iam=await start('iam-service',directory,[],['--spring.config.import='+pathToFileURL(path.join(directory,'iam-runtime.properties')).href]);
    // Runtime properties imported from protected config via a non-secret path, never from argv values.
    await healthy(iam,'https://127.0.0.1:18087/actuator/health',ca);
    const flyway=sql(`SELECT COUNT(*),SUM(success=0),MAX(CAST(version AS UNSIGNED)) FROM ${config.schema}.flyway_schema_history WHERE version IS NOT NULL;`,config.mysql).trim().split('\t').map(Number);
    if(flyway[0]!==17 || flyway[1]!==0 || flyway[2]!==18)throw new Error('FLYWAY_BASELINE');report.checks.flyway={successfulVersions:flyway[0],failed:flyway[1],maxVersion:flyway[2]};
    const before=counts(config); if(Object.values(before).some(value=>value!==0))throw new Error('NOT_CLEAN_BASELINE'); report.checks.cleanBaseline=before;
    const jwks=await http('https://127.0.0.1:18087/api/v1/auth/jwks',{ca});
    const body=()=>({identifier:'r1002-'+randomBytes(8).toString('hex')+'@example.invalid',password:randomBytes(24).toString('base64url'),device:{deviceId:randomUUID(),deviceType:'WEB',deviceName:'R1-002 synthetic',osVersion:'test',clientVersion:'r1-002'}});
    const registered=await http('https://127.0.0.1:18087/api/v1/auth/register',{method:'POST',body:body(),ca});
    if(registered.status!==201 || !registered.headers['cache-control']?.includes('no-store'))throw new Error('REGISTRATION_STATUS_OR_CACHE');
    report.checks.registration={status:201,cacheControl:'no-store',cookie:validateCookie(registered.headers['set-cookie']?.[0],registered.body)};
    const token=registered.body.data.accessToken;report.checks.token=validateRestrictedToken(token,jwks.body);
    const publicKey=createPublicKey({key:jwks.body.data.keys[0],format:'jwk'});if(publicKey.asymmetricKeyDetails.modulusLength!==3072)throw new Error('SIGNER_SIZE');report.checks.signer={algorithm:'RSA',bits:3072,externalPersistedKey:true};
    const claims=safeJson(Buffer.from(token.split('.')[1],'base64url'),'TOKEN_CLAIMS_INVALID');
    if(!/^[a-f0-9-]{36}$/.test(registered.body.data.sessionId)||! /^[a-f0-9-]{36}$/.test(claims.sub))throw new Error('DURABLE_IDS');
    const linked=Number(sql(`SELECT COUNT(*) FROM ${config.schema}.iam_account a JOIN ${config.schema}.iam_principal p ON p.principal_id=a.principal_id JOIN ${config.schema}.iam_session s ON s.principal_id=a.principal_id JOIN ${config.schema}.iam_device d ON d.principal_id=a.principal_id AND d.device_id=s.device_id WHERE a.principal_id='${claims.sub}' AND s.session_id='${registered.body.data.sessionId}' AND p.tenant_id='platform' AND p.adult_gate_status='PENDING' AND s.status='ACTIVE';`,config.mysql).trim());
    if(linked!==1)throw new Error('DURABLE_FACT_LINKS');report.checks.durableFactLinks={matchingAccountPrincipalSessionDevice:1,adultFact:'PENDING',session:'ACTIVE'};
    report.checks.durable=counts(config);if(report.checks.durable.accounts!==1 || report.checks.durable.sessions!==1 || report.checks.durable.devices!==1)throw new Error('DURABLE_REGISTRATION');
    sql(`CREATE TRIGGER ${config.schema}.r1002_fail_audit BEFORE INSERT ON ${config.schema}.iam_decision_audit FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='R1_002_SYNTHETIC_FAILURE';`,config.mysql);trigger=true;
    const failed=await http('https://127.0.0.1:18087/api/v1/auth/register',{method:'POST',body:body(),ca});
    const afterFailure=counts(config);if(failed.status<500 || JSON.stringify(afterFailure)!==JSON.stringify(report.checks.durable))throw new Error('REGISTRATION_TRANSACTION_ROLLBACK');
    report.checks.rollback={status:failed.status,unchangedCounts:afterFailure};sql(`DROP TRIGGER ${config.schema}.r1002_fail_audit;`,config.mysql);trigger=false;
    const gatewayConfig = (routeCertificate) => [
      '--server.address=127.0.0.1','--server.port=18070','--gateway.identity.iam-base-url=https://127.0.0.1:18087',
      '--gateway.security.jwk-set-uri=https://127.0.0.1:18087/api/v1/auth/jwks',
      '--gateway.security.issuer-uri=http://127.0.0.1:18087','--gateway.security.audience=yuxuexing-api',
      '--gateway.b12.enabled=false','--gateway.b13.enabled=false','--gateway.b14.enabled=false',
      '--spring.cloud.gateway.server.webflux.httpclient.ssl.trusted-x509-certificates[0]='+pathToFileURL(routeCertificate).href,
      '--spring.cloud.gateway.server.webflux.httpclient.ssl.use-insecure-trust-manager=false'
    ];
    const gwProbe = async (trustArgs, routeCertificate) => {
      const gateway=await start('api-gateway',directory,['@'+trustArgs],gatewayConfig(routeCertificate));
      await healthy(gateway,'http://127.0.0.1:18070/actuator/health');
      const route=await http('http://127.0.0.1:18070/api/v1/auth/jwks');
      const independent=await http('http://127.0.0.1:18070/api/v1/iam/principal/me',{token});
      await stop(gateway);return {route:route.status,independent:independent.status};
    };
    const positive=await gwProbe(path.join(directory,'gateway-jvm.args'),path.join(directory,'test-ca.pem'));
    if(positive.route!==200 || positive.independent!==200)throw new Error('GATEWAY_HTTPS_POSITIVE');
    report.checks.gatewayHttpsPositive=positive;
    const wrong=safeJson(readFileSync(path.join(directory,'wrong-trust.json')),'PRIVATE_CONFIG_JSON_INVALID').directory;
    const wrongJwks=await gwProbe(path.join(wrong,'gateway-jvm.args'),path.join(directory,'test-ca.pem'));
    if(wrongJwks.route!==200 || wrongJwks.independent<400)throw new Error('INDEPENDENT_TRUST_NOT_ISOLATED');
    report.checks.gatewayWrongIndependentTrust=wrongJwks;
    const wrongRoute=await gwProbe(path.join(directory,'gateway-jvm.args'),path.join(wrong,'test-ca.pem'));
    if(wrongRoute.route<400 || wrongRoute.independent<400)throw new Error('ROUTE_TRUST_NOT_ISOLATED');
    report.checks.gatewayWrongRouteTrust={route:wrongRoute.route,independentRoute:wrongRoute.independent,
      independentClientProof:'positive separate client already verified; authenticated forwarded request also needs route TLS'};
    const learner=await start('learner-service',directory,['@'+path.join(directory,'gateway-jvm.args')],['--spring.config.import='+pathToFileURL(path.join(directory,'learner-runtime.properties')).href]);await healthy(learner,'http://127.0.0.1:18088/actuator/health');
    const learnerVersions=sql(`SELECT COUNT(*),SUM(success=0),MAX(CAST(version AS UNSIGNED)) FROM ${config.learnerSchema}.flyway_schema_history WHERE version IS NOT NULL;`,config.mysql).trim().split('\t').map(Number);
    if(learnerVersions[0]!==12||learnerVersions[1]!==0||learnerVersions[2]!==12)throw new Error('LEARNER_FLYWAY_BASELINE');report.checks.learnerFlyway={successfulVersions:12,failed:0,maxVersion:12};
    const denied=await http('http://127.0.0.1:18088/api/v1/learner/targets',{token});
    if(denied.status!==403 || denied.body?.error?.code!=='CONSENT_REQUIRED')throw new Error('SERVICE_PEP_NOT_403');
    report.checks.servicePep={directService:'learner-service',port:18088,path:'/api/v1/learner/targets',status:403,
      gatewayBypassed:true,errorCode:denied.body?.error?.code,domainAdapter:'jdbc, dedicated learner-owned clean schema; denial before domain read'};
    report.status='PASS';
  } catch(error) {
    report.status='FAILED';report.failure=(/^[A-Z][A-Z0-9_]{1,100}$/.test(error.message)?error.message:'RUNTIME_ERROR');throw error;
  } finally {
    const cleanupErrors=[];
    if(trigger)try{sql(`DROP TRIGGER ${config.schema}.r1002_fail_audit;`,config.mysql);}catch{cleanupErrors.push('OWNED_TRIGGER_CLEANUP_FAILED');}
    for(const child of children.reverse())try{await stop(child);}catch(error){cleanupErrors.push((/^[A-Z][A-Z0-9_]{1,100}$/.test(error.message)?error.message:'RUNTIME_ERROR'));}
    report.ownedChildrenStopped=children.every(child=>child.exitCode!==null||child.signalCode!==null);
    report.portStates=inspectFixedPorts(registeredPorts());
    const learnerState=spawnSync('lsof',['-nP','-iTCP:18088','-sTCP:LISTEN','-Fp'],{encoding:'utf8'});
    report.learnerPortFree=learnerState.status===1 && !learnerState.stdout.trim();
    if(report.portStates.some(value=>value.state!=='FREE')||!report.learnerPortFree)cleanupErrors.push('OWNED_PORT_NOT_RELEASED');
    report.cleanupErrors=cleanupErrors;
    if(cleanupErrors.length)report.status='FAILED_CLEANUP';
    const out=path.join(evidence,'runtime-results-'+randomBytes(4).toString('hex')+'.json');
    writeFileSync(out,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  }
  return report;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    const [mode,directory]=process.argv.slice(2);let result;
    if(mode==='prepare'&&!directory)result=prepare();else if(mode==='run'&&directory)result=await run(realpathSync(directory));else throw new Error('MODE_SCOPE');
    process.stdout.write(JSON.stringify(result)+'\n');
  }catch(error){process.stderr.write('R1-002 runtime refused: '+(/^[A-Z][A-Z0-9_]{1,100}$/.test(error.message)?error.message:'RUNTIME_ERROR')+'\n');process.exitCode=1;}
}
