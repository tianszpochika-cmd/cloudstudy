import net from 'node:net';
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const manifest = JSON.parse(readFileSync(path.join(root, 'config', 'v2-runtime-services.json'), 'utf8'));
const ports = JSON.parse(readFileSync(path.join(root, 'config', 'local-ports.json'), 'utf8'));
const ownerManifest = JSON.parse(readFileSync(path.join(root, 'config', 'b17-runtime-services.json'), 'utf8'));
const args = process.argv.slice(2);
const timeoutArg = args.indexOf('--timeout-ms');
const parsedTimeout = timeoutArg >= 0 ? Number(args[timeoutArg + 1]) : 45000;
const timeoutMs = Number.isFinite(parsedTimeout) && parsedTimeout > 0 ? parsedTimeout : 45000;
const skipHealth = args.includes('--skip-health');

function prepareWindowsJavaTempDirectory() {
  if (process.platform !== 'win32') return;
  const javaTempDirectory = process.env.ENGLISHFLOW_JAVA_TEMP_DIR?.trim() || 'C:\\Temp';
  try {
    mkdirSync(javaTempDirectory, { recursive: true });
    // JDK 17+ uses a Windows selector wakeup pipe whose AF_UNIX/loopback
    // initialization can fail under the desktop agent's inherited TEMP path.
    // Keep the workaround local to this runner and allow an explicit override.
    process.env.TEMP = javaTempDirectory;
    process.env.TMP = javaTempDirectory;
    console.log(`java temp directory: ${javaTempDirectory}`);
  } catch (error) {
    console.warn(`unable to prepare Java temp directory ${javaTempDirectory}: ${error.message}`);
  }
}

prepareWindowsJavaTempDirectory();

function values(name) {
  const result = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === name && args[index + 1]) result.push(args[index + 1]);
  }
  return result;
}

const requested = values('--service').flatMap((value) => value.split(/[\s,]+/)).filter(Boolean);
const selectAll = args.includes('--all');
if (!selectAll && requested.length === 0) {
  console.error('Usage: pnpm services:run -- --all [--skip-health]');
  console.error('   or: pnpm services:run -- --service api-gateway,iam-service');
  process.exit(2);
}
if (selectAll && requested.length > 0) {
  console.error('Use either --all or --service, not both.');
  process.exit(2);
}

const byId = new Map(manifest.services.map((service) => [service.id, service]));
const unknown = requested.filter((id) => !byId.has(id));
if (unknown.length > 0) {
  console.error(`Unknown runtime service(s): ${unknown.join(', ')}`);
  process.exit(2);
}
const selected = selectAll ? manifest.services : requested.map((id) => byId.get(id));

function assertJava25() {
  const result = spawnSync(process.platform === 'win32' ? 'java.exe' : 'java', ['-version'], {
    encoding: 'utf8',
    windowsHide: true,
  });
  const text = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  const match = text.match(/version\s+"(\d+)/i);
  if (result.status !== 0 || !match || Number(match[1]) !== 25) {
    throw new Error(`Java 25 is required before starting services; detected ${match?.[1] ?? 'unavailable'}`);
  }
}

function assertPortFree(port, serviceId) {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        reject(new Error(`${serviceId}: fixed port ${port} is already in use; stop its owner instead of changing the port`));
      } else {
        reject(error);
      }
    });
    probe.listen({ host: manifest.host, port }, () => probe.close(() => resolve()));
  });
}

function resolveJar(service) {
  const target = path.join(root, service.project, 'target');
  if (!existsSync(target)) return null;
  const jars = readdirSync(target)
    .filter((file) => file.endsWith('.jar'))
    .filter((file) => !file.endsWith('-sources.jar') && !file.endsWith('-javadoc.jar'));
  if (jars.length !== 1) {
    throw new Error(`${service.id}: expected exactly one runnable target/*.jar, found ${jars.length}`);
  }
  return path.join(target, jars[0]);
}

function mysqlUrl(schema) {
  // Services use Clock.systemUTC(); keeping the driver in UTC prevents Timestamp.from(Instant)
  // from being shifted by the workstation timezone before MySQL stores rights/review deadlines.
  return `jdbc:mysql://127.0.0.1:13306/${schema}?useUnicode=true&characterEncoding=utf8&serverTimezone=UTC&useSSL=false&allowPublicKeyRetrieval=true`;
}

function runtimeEnvironment(service, port) {
  const jwtIssuer = process.env.IAM_JWT_ISSUER ?? 'http://127.0.0.1:18087';
  const jwtJwks = process.env.IAM_JWT_JWKS_URI ?? `${jwtIssuer.replace(/\/$/, '')}/api/v1/auth/jwks`;
  const jwtAudience = process.env.IAM_JWT_AUDIENCE ?? 'yuxuexing-api';
  const environment = {
    ...process.env,
    PORT: String(port),
    SERVICE_PORT: String(port),
    ENGLISHFLOW_RUNTIME_PROFILE: 'local-real',
    LOCAL_RUNTIME_MODE: 'local-real',
    MYSQL_HOST: process.env.MYSQL_HOST ?? '127.0.0.1',
    MYSQL_PORT: process.env.MYSQL_PORT ?? '13306',
    MYSQL_OWNER_PASSWORD: process.env.MYSQL_OWNER_PASSWORD ?? 'local-owner-only',
    OTEL_ENABLED: process.env.OTEL_ENABLED ?? 'false',
    OTEL_METRICS_EXPORT_ENABLED: process.env.OTEL_METRICS_EXPORT_ENABLED ?? 'false',
    MANAGEMENT_OTLP_METRICS_EXPORT_ENABLED: process.env.MANAGEMENT_OTLP_METRICS_EXPORT_ENABLED ?? 'false',
    OTEL_EXPORTER_OTLP_ENDPOINT: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://127.0.0.1:4318',
  };
  if (service.id === 'iam-service') {
    environment.IAM_PERSISTENCE_ENABLED = 'true';
    environment.IAM_FLYWAY_ENABLED = 'true';
    // IamServiceProperties owns these values under iam.persistence.*.  The
    // nested prefix must therefore be IAM_PERSISTENCE_*, otherwise Spring
    // silently keeps the sample yuxuexing credentials from application.yaml
    // and the real callback fails closed at its first durable write.
    environment.IAM_PERSISTENCE_JDBCURL = mysqlUrl('iam_service');
    environment.IAM_PERSISTENCE_USERNAME = 'svc_iam';
    environment.IAM_PERSISTENCE_PASSWORD = environment.MYSQL_OWNER_PASSWORD;
    environment.IAM_JWT_ISSUER = jwtIssuer;
    environment.IAM_JWT_JWKS_URI = jwtJwks;
    environment.IAM_JWT_AUDIENCE = jwtAudience;
    environment.IAM_JWT_ALGORITHM = process.env.IAM_JWT_ALGORITHM ?? 'RS256';
    environment.IAM_LOCAL_ADULT_GATE_ENABLED = process.env.IAM_LOCAL_ADULT_GATE_ENABLED ?? 'true';
  }
  if (service.id === 'api-gateway') {
    environment.GATEWAY_RESOURCE_SERVER_ENABLED = 'true';
    environment.GATEWAY_JWT_PREVALIDATION_ENABLED = 'true';
    environment.GATEWAY_SECURITY_ISSUER_URI = jwtIssuer;
    environment.GATEWAY_SECURITY_JWK_SET_URI = jwtJwks;
    environment.GATEWAY_SECURITY_AUDIENCE = jwtAudience;
  }
  if (service.id === 'commerce-service') {
    environment.COMMERCE_SECURITY_ISSUER_URI = jwtIssuer;
    environment.COMMERCE_SECURITY_JWK_SET_URI = jwtJwks;
    environment.COMMERCE_SECURITY_AUDIENCE = jwtAudience;
  }
  const owner = ownerManifest.services.find((item) => item.id === service.id);
  const ownerUser = owner?.dbCredential;
  const ownerSchema = owner?.schema;
  if (ownerUser && ownerSchema) {
    const url = mysqlUrl(ownerSchema);
    const passwordEnv = `${service.id.toUpperCase().replaceAll('-', '_')}_DB_PASSWORD`;
    const password = process.env[passwordEnv] ?? environment.MYSQL_OWNER_PASSWORD;
    // Runtime credentials hold DML-only grants; migrations are pre-applied by
    // scripts/database/reconcile-owner-schemas.mjs with the admin credential.
    environment.SPRING_FLYWAY_ENABLED = 'false';
    const jdbc = {
      url,
      user: ownerUser,
      password,
    };
    switch (service.id) {
      case 'learner-service':
        environment.LEARNER_PERSISTENCE_MODE = 'jdbc';
        environment.LEARNER_JDBC_URL = jdbc.url;
        environment.LEARNER_JDBC_USERNAME = jdbc.user;
        environment.LEARNER_JDBC_PASSWORD = jdbc.password;
        break;
      case 'content-service':
        environment.CONTENT_PERSISTENCE_MODE = 'jdbc';
        environment.CONTENT_JDBC_URL = jdbc.url;
        environment.CONTENT_JDBC_USERNAME = jdbc.user;
        environment.CONTENT_JDBC_PASSWORD = jdbc.password;
        break;
      case 'learning-service':
        environment.LEARNING_PERSISTENCE_MODE = 'jdbc';
        environment.LEARNING_JDBC_URL = jdbc.url;
        environment.LEARNING_JDBC_USERNAME = jdbc.user;
        environment.LEARNING_JDBC_PASSWORD = jdbc.password;
        break;
      case 'assessment-service':
        environment.ASSESSMENT_PERSISTENCE_ENABLED = 'true';
        environment.ASSESSMENT_FLYWAY_ENABLED = 'false';
        // The local MySQL volume can retain pre-v2 synthetic rows in the legacy
        // assessment tables. Keep the production default fail-fast, while the
        // local-real runner skips only rows that cannot be rehydrated by the v2
        // aggregate so the service can start without deleting the volume.
        environment.ASSESSMENT_TOLERATE_CORRUPT_LEGACY_ROWS = 'true';
        environment.ASSESSMENT_DB_URL = jdbc.url;
        environment.ASSESSMENT_DB_USERNAME = jdbc.user;
        environment.ASSESSMENT_DB_PASSWORD = jdbc.password;
        break;
      case 'notification-service':
        environment.NOTIFICATION_PERSISTENCE_MODE = 'jdbc';
        environment.NOTIFICATION_JDBC_URL = jdbc.url;
        environment.NOTIFICATION_JDBC_USERNAME = jdbc.user;
        environment.NOTIFICATION_JDBC_PASSWORD = jdbc.password;
        break;
      case 'commerce-service':
        environment.SPRING_DATASOURCE_URL = jdbc.url;
        environment.SPRING_DATASOURCE_USERNAME = jdbc.user;
        environment.SPRING_DATASOURCE_PASSWORD = jdbc.password;
        break;
      case 'media-service':
        environment.MEDIA_SERVICE_SCHEMA = ownerSchema;
        environment.MEDIA_SERVICE_SIGNED_URL_BASE_URL = 'http://127.0.0.1:19000/yuxuexing-local';
        environment.SPRING_DATASOURCE_URL = jdbc.url;
        environment.SPRING_DATASOURCE_USERNAME = jdbc.user;
        environment.SPRING_DATASOURCE_PASSWORD = jdbc.password;
        break;
      case 'social-service':
        environment.SPRING_DATASOURCE_URL = jdbc.url;
        environment.SPRING_DATASOURCE_USERNAME = jdbc.user;
        environment.SPRING_DATASOURCE_PASSWORD = jdbc.password;
        break;
      case 'gamification-service':
      case 'admin-ops-service':
      case 'analytics-service':
        // Migrations are pre-applied by scripts/database/reconcile-owner-schemas.mjs with the
        // admin credential. Runtime credentials hold DML-only grants, so Flyway stays disabled
        // here and no service process performs DDL at startup.
        environment.SPRING_DATASOURCE_URL = jdbc.url;
        environment.SPRING_DATASOURCE_USERNAME = jdbc.user;
        environment.SPRING_DATASOURCE_PASSWORD = jdbc.password;
        break;
      default:
        break;
    }
    if (service.id !== 'api-gateway' && service.id !== 'iam-service' && service.id !== 'core-api') {
      const envPrefix = {
        'learner-service': 'LEARNER',
        'content-service': 'CONTENT_SERVICE',
        'learning-service': 'LEARNING',
        'assessment-service': 'ASSESSMENT',
        'media-service': 'MEDIA_SERVICE',
        'notification-service': 'NOTIFICATION',
        'gamification-service': 'GAMIFICATION',
        'social-service': 'SOCIAL',
        'commerce-service': 'COMMERCE',
        'admin-ops-service': 'ADMIN_OPS',
        'analytics-service': 'ANALYTICS',
      }[service.id];
      if (envPrefix) {
        environment[`${envPrefix}_RESOURCE_SERVER_ENABLED`] = 'true';
        environment[`${envPrefix}_SECURITY_ISSUER_URI`] = jwtIssuer;
        environment[`${envPrefix}_SECURITY_JWK_SET_URI`] = jwtJwks;
        environment[`${envPrefix}_SECURITY_AUDIENCE`] = jwtAudience;
      }
    }
  }
  return environment;
}

async function waitForHealth(service, child) {
  const port = ports.services[service.portKey]?.port;
  const healthBasePath = service.healthBasePath ?? '';
  const url = `http://${manifest.host}:${port}${healthBasePath}${service.healthPath}`;
  const deadline = Date.now() + timeoutMs;
  let lastError = 'no response';
  let exited = null;
  child.once('exit', (code, signal) => { exited = `code=${code ?? 'null'} signal=${signal ?? 'none'}`; });
  while (Date.now() < deadline) {
    if (exited) throw new Error(`${service.id}: exited before health check (${exited})`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error.message;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`${service.id}: health timeout at ${url} (${lastError})`);
}

const children = [];
let stopping = false;
async function stopChildren() {
  if (stopping) return;
  stopping = true;
  for (const item of [...children].reverse()) item.child.kill('SIGTERM');
  await new Promise((resolve) => setTimeout(resolve, 1000));
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, async () => {
    await stopChildren();
    process.exit(130);
  });
}

try {
  const manifestCheck = spawnSync(process.execPath, [path.join(root, 'scripts', 'runtime', 'validate-v2-runtime-manifest.mjs')], {
    cwd: root,
    stdio: 'inherit',
    windowsHide: true,
  });
  if (manifestCheck.status !== 0) throw new Error('runtime manifest validation failed');
  assertJava25();
  for (const service of selected) {
    const port = ports.services[service.portKey]?.port;
    if (!port) throw new Error(`${service.id}: port key ${service.portKey} is not registered`);
    await assertPortFree(port, service.id);
  }

  for (const service of selected) {
    const jar = resolveJar(service);
    if (!jar) throw new Error(`${service.id}: no built jar found; run pnpm services:build -- --service ${service.id}`);
    const port = ports.services[service.portKey].port;
    const child = spawn('java', [
      '-jar', jar,
      `--server.address=${manifest.host}`,
      `--server.port=${port}`,
      `--spring.profiles.active=${service.profile},local-real`,
      '--local.runtime.mode=local-real',
    ], {
      cwd: root,
      env: runtimeEnvironment(service, port),
      stdio: 'inherit',
      windowsHide: true,
    });
    children.push({ service, child });
    console.log(`started ${service.id} pid=${child.pid} port=${port}`);
    if (!skipHealth) await waitForHealth(service, child);
    console.log(`healthy ${service.id} ${service.healthPath}`);
  }
  console.log(`v2 services running: ${selected.map((service) => service.id).join(', ')}`);
  await new Promise((resolve, reject) => {
    for (const item of children) {
      item.child.once('exit', (code, signal) => {
        if (!stopping) reject(new Error(`${item.service.id} exited: code=${code ?? 'null'} signal=${signal ?? 'none'}`));
      });
    }
  });
} catch (error) {
  console.error(`[services:run] ${error.message}`);
  await stopChildren();
  process.exitCode = 1;
}
