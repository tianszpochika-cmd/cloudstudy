import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function readJson(root, relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function readText(root, relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

export function readB28Inputs(root = repositoryRoot) {
  const config = readJson(root, 'config/b28-local-runtime.json');
  const ownerManifest = readJson(root, config.persistencePolicy.ownerManifest);
  const migrationTexts = Object.fromEntries(ownerManifest.services.map((service) => [
    service.id,
    fs.existsSync(path.join(root, service.migrationPath)) ? readText(root, service.migrationPath) : null
  ]));

  return {
    root,
    config,
    packageJson: readJson(root, 'package.json'),
    toolchainBaseline: readJson(root, config.sourceOfTruth.toolchain),
    runtimeManifest: readJson(root, config.sourceOfTruth.runtimeServices),
    localServices: readJson(root, config.sourceOfTruth.localServices),
    localPorts: readJson(root, config.sourceOfTruth.localPorts),
    ownerManifest,
    migrationTexts,
    composeText: readText(root, config.toolchain.docker.composeFile)
  };
}

function compareVersions(left, right) {
  const a = String(left).split('.').map((item) => Number(item));
  const b = String(right).split('.').map((item) => Number(item));
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const leftPart = a[index] ?? 0;
    const rightPart = b[index] ?? 0;
    if (leftPart !== rightPart) return leftPart - rightPart;
  }
  return 0;
}

function parseVersion(output) {
  return String(output ?? '').match(/\d+\.\d+\.\d+/)?.[0] ?? null;
}

function parseJavaMajor(output) {
  return Number(String(output ?? '').match(/version\s+"(\d+)/i)?.[1] ?? NaN) || null;
}

function parseMavenVersion(output) {
  return String(output ?? '').match(/Apache Maven\s+(\d+\.\d+\.\d+)/i)?.[1] ?? null;
}

function parseComposeVersion(output) {
  return String(output ?? '').match(/(?:version\s+)?v?(\d+\.\d+\.\d+)/i)?.[1] ?? parseVersion(output);
}

function serviceBlock(composeText, serviceName) {
  const lines = String(composeText).split(/\r?\n/);
  const start = lines.findIndex((line) => new RegExp(`^  ${serviceName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:\\s*$`).test(line));
  if (start < 0) return null;
  const endOffset = lines.slice(start + 1).findIndex((line) => /^  [A-Za-z0-9_-]+:\s*$/.test(line));
  return lines.slice(start, endOffset < 0 ? lines.length : start + 1 + endOffset).join('\n');
}

function parseComposePs(output) {
  const trimmed = String(output ?? '').trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return trimmed.split(/\r?\n/).flatMap((line) => {
      try {
        const parsed = JSON.parse(line);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        return [];
      }
    });
  }
}

function composePortToken(host, binding) {
  return '"' + host + ':${' + binding.hostPortEnv + ':-' + binding.hostPort + '}:' + binding.containerPort + '"';
}

function defaultCommandRunner(root, command, args) {
  return spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    shell: process.platform === 'win32' && command.endsWith('.cmd')
  });
}

function normalizeResult(result) {
  return {
    status: result?.status ?? null,
    stdout: result?.stdout ?? '',
    stderr: result?.stderr ?? '',
    error: result?.error?.message ?? result?.error ?? null
  };
}

function requiredString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isWithin(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function validateEvidenceFile(inputs, config, env, errors) {
  const evidenceEnv = config.runtimeGate.evidenceFileEnv;
  const configuredPath = env[evidenceEnv];
  if (!requiredString(configuredPath)) {
    errors.push(`运行证据缺失：必须设置 ${evidenceEnv}；静态结果不能升级为真实运行通过`);
    return null;
  }

  const evidenceRoot = path.resolve(inputs.root, config.runtimeGate.evidenceRoot);
  const evidencePath = path.resolve(inputs.root, configuredPath);
  if (!isWithin(evidenceRoot, evidencePath)) {
    errors.push(`${evidenceEnv} 必须位于 ${config.runtimeGate.evidenceRoot} 下，拒绝读取仓库外或越界证据`);
    return null;
  }
  if (!fs.existsSync(evidencePath)) {
    errors.push(`运行证据文件不存在：${path.relative(inputs.root, evidencePath)}`);
    return null;
  }

  let evidence;
  try {
    evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
  } catch (error) {
    errors.push(`运行证据文件不是有效 JSON：${error.message}`);
    return null;
  }

  for (const field of config.runtimeGate.requiredEvidenceFields) {
    if (evidence[field] === undefined || evidence[field] === null || evidence[field] === '') {
      errors.push(`运行证据缺少字段：${field}`);
    }
  }
  if (evidence.batch !== config.batch) errors.push(`运行证据 batch 必须为 ${config.batch}`);
  if (evidence.mode !== config.runtimeGate.requiredMode) errors.push(`运行证据 mode 必须为 ${config.runtimeGate.requiredMode}`);
  if (evidence.status !== 'PASS') errors.push('运行证据 status 必须为 PASS；失败或待定证据不能通过');
  if (evidence.evidenceClass !== config.runtimeGate.runtimeEvidenceClass) {
    errors.push(`运行证据 evidenceClass 必须为 ${config.runtimeGate.runtimeEvidenceClass}`);
  }
  if (evidence.synthetic === true || evidence.provenance?.synthetic === true) {
    errors.push('拒绝 synthetic runtime evidence；合成数据只能用于准备，不能关闭运行 Gate');
  }
  if (evidence.provenance?.producer !== 'b28-runtime-probe') {
    errors.push('运行证据必须由 b28-runtime-probe 产生，不能用手工摘要冒充');
  }

  const serialized = JSON.stringify(evidence);
  if (/\b(mock|fake|fixture-only|static-only)\b/i.test(serialized)) {
    errors.push('运行证据包含 mock/fake/fixture-only/static-only 标记，拒绝升级运行 Gate');
  }

  const checks = Array.isArray(evidence.checks)
    ? new Map(evidence.checks.map((item) => [item.id, item]))
    : new Map(Object.entries(evidence.checks ?? {}).map(([id, item]) => [id, { id, ...item }]));
  for (const evidenceId of config.runtimeGate.requiredEvidence) {
    const item = checks.get(evidenceId);
    if (!item) {
      errors.push(`运行证据缺少检查项：${evidenceId}`);
      continue;
    }
    if (item.status !== 'PASS') errors.push(`运行证据检查项未通过：${evidenceId}`);
    if (!requiredString(item.evidenceRef)) errors.push(`运行证据检查项缺少 evidenceRef：${evidenceId}`);
  }
  return evidence;
}

function validateRuntimeToolchain(inputs, config, commandRunner, errors, runtimeChecks) {
  const run = (id, command, args, parser, requirement) => {
    const result = normalizeResult(commandRunner(command, args));
    const output = `${result.stdout}\n${result.stderr}`;
    const version = parser(output);
    const passed = result.status === 0 && version !== null && requirement(version);
    runtimeChecks.push({ id, status: passed ? 'PASS' : 'FAIL', version });
    if (!passed) {
      errors.push(`${id} 运行时版本门禁失败：检测到 ${version ?? 'unavailable'}`);
    }
    return { result, version };
  };

  run('java25', process.platform === 'win32' ? 'java.exe' : 'java', ['-version'], parseJavaMajor, (version) => version === config.toolchain.java.requiredMajor);
  run('maven', process.platform === 'win32' ? 'mvn.cmd' : 'mvn', ['-version'], parseMavenVersion, (version) => compareVersions(version, config.toolchain.maven.minimumVersion) >= 0);
  run('node', process.execPath, ['--version'], parseVersion, (version) => compareVersions(version, config.toolchain.node.minimumVersion) >= 0);
  run('pnpm', process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', ['--version'], parseVersion, (version) => version === config.toolchain.pnpm.requiredVersion);
  run('docker-server', 'docker', ['version', '--format', '{{.Server.Version}}'], parseVersion, (version) => compareVersions(version, config.toolchain.docker.minimumServerVersion) >= 0);
  run('docker-compose', 'docker', ['compose', 'version', '--short'], parseComposeVersion, (version) => compareVersions(version, config.toolchain.docker.minimumComposeVersion) >= 0);
}

function validateDockerRuntime(inputs, config, commandRunner, errors, runtimeChecks) {
  const composeFile = path.relative(inputs.root, path.resolve(inputs.root, config.toolchain.docker.composeFile)).split(path.sep).join('/');
  const composeArgs = (...extra) => ['compose', '-f', composeFile, ...extra];
  const composeConfig = normalizeResult(commandRunner('docker', composeArgs('config', '--quiet')));
  const configPass = composeConfig.status === 0;
  runtimeChecks.push({ id: 'docker-compose-config', status: configPass ? 'PASS' : 'FAIL' });
  if (!configPass) errors.push(`Docker Compose 配置未通过真实校验：${composeConfig.stderr || composeConfig.error || 'unknown error'}`);

  for (const dependency of config.dependencies.filter((item) => item.required)) {
    const result = normalizeResult(commandRunner('docker', composeArgs('ps', '--all', '--format', 'json', dependency.composeService)));
    const records = parseComposePs(result.stdout);
    const record = records.find((item) => item.Service === dependency.composeService) ?? records[0];
    const state = String(record?.State ?? '').toLowerCase();
    const health = String(record?.Health ?? '').toLowerCase();
    const healthy = result.status === 0 && state === 'running' && health === 'healthy';
    const id = `dependency-health:${dependency.id}`;
    runtimeChecks.push({ id, status: healthy ? 'PASS' : 'FAIL', state, health });
    if (!healthy) errors.push(`${dependency.id} 未被 Docker Compose 报告为 running/healthy；不伪造基础设施通过`);
  }
}

export function validateB28LocalRuntime(inputs = readB28Inputs(), options = {}) {
  const { config, packageJson, toolchainBaseline, runtimeManifest, localServices, localPorts, ownerManifest, migrationTexts, composeText } = inputs;
  const runtimeRequested = options.runtimeRequested === true;
  const errors = [];
  const staticErrors = [];
  const runtimeChecks = [];
  let staticChecks = 0;

  const staticCheck = (label, condition) => {
    staticChecks += 1;
    if (!condition) {
      const message = `B28 静态检查失败：${label}`;
      staticErrors.push(message);
      errors.push(message);
    }
  };

  staticCheck('batch must be B28', config.batch === 'B28');
  staticCheck('phase must be phase-1', config.phase === 'phase-1');
  staticCheck('runtime profile must be local-real', config.runtimeProfile === 'local-real');
  staticCheck('Java 25 must match the repository toolchain baseline', config.toolchain.java.requiredMajor === toolchainBaseline.java.requiredMajor && config.toolchain.java.requiredMajor === 25);
  staticCheck('Maven minimum must match the repository toolchain baseline', config.toolchain.maven.minimumVersion === toolchainBaseline.maven.minimumVersion);
  staticCheck('packageManager must pin the required pnpm version', packageJson.packageManager === `pnpm@${config.toolchain.pnpm.requiredVersion}`);
  staticCheck('Node minimum version must be a valid Node 22+ baseline', config.toolchain.node.minimumMajor >= 22 && compareVersions(config.toolchain.node.minimumVersion, '22.0.0') >= 0);
  staticCheck('Docker Compose file must exist', fs.existsSync(path.join(inputs.root, config.toolchain.docker.composeFile)));

  staticCheck('v2 runtime host must be loopback', runtimeManifest.host === '127.0.0.1');
  staticCheck('v2 runtime process count must be 14', runtimeManifest.services.length === config.runtimeServices.requiredProcessCount);
  staticCheck('api-gateway must be the external ingress', runtimeManifest.services.some((service) => service.id === config.runtimeServices.externalIngress));
  staticCheck('core-api must remain legacy compatibility', runtimeManifest.services.find((service) => service.id === 'core-api')?.profile === 'legacy-compatibility');
  staticCheck('core-api may not write v2 domain facts', config.runtimeServices.coreApiMayWriteV2DomainFacts === false);

  staticCheck('local service host must be loopback', localServices.host === config.portPolicy.host && config.portPolicy.host === '127.0.0.1');
  staticCheck('local service port source must use the fixed registry', localServices.portSource === config.portPolicy.source);
  staticCheck('automatic port increment must be disabled', localServices.policy?.autoIncrement === false && config.portPolicy.autoIncrement === false);
  staticCheck('loopback-only policy must be enabled', localServices.policy?.bindOnlyToLoopback === true && config.portPolicy.bindOnlyToLoopback === true);
  staticCheck('Compose file must match the local service manifest', localServices.composeFile === config.toolchain.docker.composeFile);

  const seenPorts = new Set();
  const localRequired = new Set(localServices.requiredDependencies ?? []);
  const requiredDependencies = config.dependencies.filter((dependency) => dependency.required);
  for (const dependency of requiredDependencies) {
    const localService = localServices.services?.[dependency.localServiceId];
    const port = localPorts.services?.[dependency.portKey];
    const block = serviceBlock(composeText, dependency.composeService);
    staticCheck(`${dependency.id} is registered as a local dependency`, Boolean(localService && localRequired.has(dependency.localServiceId)));
    staticCheck(`${dependency.id} has the expected compose service and image`, Boolean(localService && localService.composeService === dependency.composeService && localService.image === dependency.image && block?.includes(`image: ${dependency.image}`)));
    staticCheck(`${dependency.id} has a compose healthcheck`, Boolean(block?.includes('healthcheck:') && block.includes(dependency.healthcheckMarker)));
    staticCheck(`${dependency.id} has a persistent volume`, Boolean(localService?.volume && block?.includes(`${localService.volume}:/`)));

    const bindings = [dependency, ...(dependency.secondaryBinding ? [dependency.secondaryBinding] : [])];
    for (const binding of bindings) {
      const localBinding = localService?.bindings?.find((item) => item.portKey === binding.portKey);
      const registeredPort = localPorts.services?.[binding.portKey];
      const bindingMatches = Boolean(
        localBinding
          && localBinding.hostPort === binding.hostPort
          && localBinding.containerPort === binding.containerPort
          && localBinding.protocol === binding.protocol
          && localBinding.hostPortEnv === binding.hostPortEnv
          && registeredPort?.port === binding.hostPort
          && registeredPort?.protocol === binding.protocol
      );
      staticCheck(`${dependency.id}/${binding.portKey} uses its fixed port`, bindingMatches);
      if (seenPorts.has(binding.hostPort)) staticCheck(`fixed port ${binding.hostPort} is unique`, false);
      seenPorts.add(binding.hostPort);
      if (binding.hostPortEnv) staticCheck(`${dependency.id}/${binding.portKey} has a loopback compose binding`, Boolean(block?.includes(composePortToken(config.portPolicy.host, binding))));
    }
  }

  const minioInit = localServices.minioInitialization;
  const minioInitBlock = minioInit ? serviceBlock(composeText, minioInit.composeService) : null;
  staticCheck('MinIO bucket initialization is present and private/idempotent', Boolean(
    minioInitBlock
      && minioInitBlock.includes('depends_on:')
      && minioInitBlock.includes('mc mb --ignore-existing')
      && minioInitBlock.includes('mc anonymous set none')
  ));
  staticCheck('Keycloak is declared as a standard OIDC provider', Boolean(
    config.dependencies.find((dependency) => dependency.id === 'keycloak')?.factRole === 'standard-oidc-test-provider'
      && localServices.services?.['oidc-idp']?.purpose?.includes('no application token server')
  ));
  staticCheck('Kafka auto topic creation is disabled', Boolean(serviceBlock(composeText, 'kafka')?.includes('KAFKA_AUTO_CREATE_TOPICS_ENABLE: "false"')));

  const ownerDefaults = ownerManifest.defaults ?? {};
  staticCheck('domain owners use independent schemas', ownerDefaults.independentSchema === true);
  staticCheck('domain owners use independent credentials', ownerDefaults.independentCredentials === true);
  staticCheck('cross-service SQL is disabled', ownerDefaults.crossServiceSql === false);
  staticCheck('shared ORM entities are disabled', ownerDefaults.sharedOrmEntities === false);
  staticCheck('owner manifest contains 11 Phase 1 domain owners', ownerManifest.services.length === config.persistencePolicy.requiredOwnerSchemaCount);

  const schemas = new Set();
  const credentials = new Set();
  const ports = new Set();
  for (const owner of ownerManifest.services) {
    const migrationText = migrationTexts?.[owner.id];
    const ownerPort = localPorts.services?.[owner.id]?.port;
    staticCheck(`${owner.id} has a valid owner/schema/credential tuple`, Boolean(
      /^[a-z][a-z0-9_]+$/.test(owner.schema)
        && /^svc_[a-z0-9_]+$/.test(owner.dbCredential)
        && requiredString(owner.migrationPath)
        && fs.existsSync(path.join(inputs.root, owner.migrationPath))
        && migrationText
    ));
    staticCheck(`${owner.id} migration is Flyway-safe and non-destructive`, Boolean(
      migrationText
        && /CREATE\s+TABLE/i.test(migrationText)
        && !/\bDROP\s+(DATABASE|SCHEMA|TABLE|VIEW)\b|\bTRUNCATE\s+TABLE\b|\bCREATE\s+DATABASE\b/i.test(migrationText)
    ));
    if (schemas.has(owner.schema)) staticCheck(`schema ${owner.schema} is unique`, false);
    if (credentials.has(owner.dbCredential)) staticCheck(`credential ${owner.dbCredential} is unique`, false);
    if (ownerPort && ports.has(ownerPort)) staticCheck(`owner port ${ownerPort} is unique`, false);
    schemas.add(owner.schema);
    credentials.add(owner.dbCredential);
    if (ownerPort) ports.add(ownerPort);
  }
  staticCheck('owner schema count is unique', schemas.size === ownerManifest.services.length);
  staticCheck('owner credential count is unique', credentials.size === ownerManifest.services.length);
  staticCheck('owner ports are registered and unique', ports.size === ownerManifest.services.length);
  staticCheck('Flyway-per-service and no cross-owner writes are required', config.persistencePolicy.migrationRunner === 'flyway-per-service' && config.persistencePolicy.crossServiceSqlAllowed === false && config.persistencePolicy.crossServiceWritesAllowed === false);

  staticCheck('mock runtime facts are forbidden', config.safetyPolicy.mockAllowed === false);
  staticCheck('fallback runtime facts are forbidden', config.safetyPolicy.fallbackAllowed === false);
  staticCheck('in-memory facts are forbidden', config.safetyPolicy.inMemoryFactsAllowed === false);
  staticCheck('static evidence cannot promote runtime', config.safetyPolicy.staticEvidencePromotesRuntime === false && config.runtimeGate.staticOnlyLabelCannotPassRuntime === true);
  staticCheck('missing runtime evidence fails closed', config.safetyPolicy.missingRuntimeEvidenceDecision === 'FAIL_CLOSED' && config.runtimeGate.defaultDecision === 'BLOCKED');
  staticCheck('runtime gate has six external evidence classes', config.runtimeGate.requiredEvidence.length === 6 && config.runtimeGate.requiredEvidence.every((item) => requiredString(item)));

  const staticStatus = staticErrors.length === 0 ? 'PASS' : 'FAIL';
  let runtimeStatus = runtimeRequested ? 'blocked' : 'not-requested';
  let runtimeEvidence = null;

  if (runtimeRequested && staticStatus === 'PASS') {
    const env = options.env ?? process.env;
    runtimeEvidence = validateEvidenceFile(inputs, config, env, errors);
    if (runtimeEvidence) {
      const commandRunner = options.commandRunner ?? ((command, args) => defaultCommandRunner(inputs.root, command, args));
      validateRuntimeToolchain(inputs, config, commandRunner, errors, runtimeChecks);
      validateDockerRuntime(inputs, config, commandRunner, errors, runtimeChecks);
    }
    if (errors.length === 0) runtimeStatus = 'PASS';
  }

  return {
    result: errors.length === 0 ? 'PASS' : 'FAIL',
    batch: config.batch,
    mode: config.runtimeProfile,
    staticStatus,
    runtimeStatus,
    runtimeGate: runtimeRequested ? (runtimeStatus === 'PASS' ? 'runtime-verified' : 'blocked') : 'static-only',
    runtimeEvidencePending: runtimeRequested && runtimeStatus === 'PASS' ? 0 : config.runtimeGate.requiredEvidence.length,
    staticChecks,
    runtimeChecks,
    requiredDependencyCount: requiredDependencies.length,
    runtimeProcessCount: runtimeManifest.services.length,
    ownerSchemaCount: ownerManifest.services.length,
    fixedPortCount: seenPorts.size,
    evidenceRunId: runtimeEvidence?.runId ?? null,
    errors,
    warnings: []
  };
}

function runNodeScript(root, label, script, args, failures) {
  const result = spawnSync(process.execPath, [path.join(root, script), ...args], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    stdio: 'inherit'
  });
  if (result.status !== 0) failures.push(label);
}

export function main(argv = process.argv.slice(2)) {
  const args = new Set(argv);
  const allowed = new Set(['--static-only', '--require-runtime']);
  const unknown = [...args].filter((arg) => !allowed.has(arg));
  if (unknown.length > 0 || (args.has('--static-only') && args.has('--require-runtime'))) {
    console.error('Usage: node scripts/runtime/b28-bootstrap.mjs [--static-only | --require-runtime]');
    return 2;
  }

  const staticOnly = args.has('--static-only');
  const runtimeRequested = !staticOnly || args.has('--require-runtime');
  const failures = [];
  runNodeScript(repositoryRoot, 'b15-static-prerequisite', 'scripts/runtime/b15-bootstrap.mjs', ['--static-only'], failures);

  const result = validateB28LocalRuntime(readB28Inputs(), { runtimeRequested });
  console.log(JSON.stringify(result, null, 2));
  if (failures.length > 0 || result.result !== 'PASS') {
    console.error(`B28 bootstrap blocked: ${[...failures, ...result.errors].join('; ')}`);
    return 1;
  }
  console.log(`B28 bootstrap passed (${staticOnly ? 'static' : 'runtime'}); no infrastructure was started or database data was changed.`);
  return 0;
}

const currentFile = path.resolve(fileURLToPath(import.meta.url));
const invokedFile = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedFile === currentFile) process.exitCode = main();
