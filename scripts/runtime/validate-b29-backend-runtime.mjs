import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function readJson(root, relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function readText(root, relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requiredString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasValue(value) {
  return (typeof value === 'string' && value.trim().length > 0)
    || (typeof value === 'number' && Number.isFinite(value));
}

function normalized(value) {
  return String(value ?? '').trim().toLowerCase();
}

function upper(value) {
  return String(value ?? '').trim().toUpperCase();
}

function isWithin(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === ''
    || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function unique(values) {
  return new Set(values).size === values.length;
}

function parseJavaMajor(value) {
  const match = String(value ?? '').match(/(?:java|jdk|version)?\s*["']?(\d+)(?:\.\d+)?/i);
  return match ? Number(match[1]) : null;
}

function applicationPortLineMatches(text, port) {
  return String(text ?? '')
    .split(/\r?\n/)
    .filter((line) => /\bport\s*[:=]/i.test(line))
    .some((line) => new RegExp(`\\b${String(port)}\\b`).test(line));
}

function serviceMainClassPath(root, service) {
  return path.join(root, service.project, 'src', 'main', 'java', ...service.mainClass.split('.')) + '.java';
}

function expectedReadinessPath(config, service) {
  const effectiveHealthPath = `${service.healthBasePath ?? ''}${service.healthPath}`;
  if (service.profile === 'legacy-compatibility' && config.readinessPolicy?.legacyReadinessPathUsesHealthPath === true) {
    return effectiveHealthPath;
  }
  return effectiveHealthPath;
}

function expectedLivenessPath(config, service) {
  if (service.profile === 'legacy-compatibility') return expectedReadinessPath(config, service);
  return '/actuator/health/liveness';
}

export function readB29Inputs(root = repositoryRoot) {
  const config = readJson(root, 'config/b29-backend-runtime.json');
  const runtimeManifest = readJson(root, config.sourceOfTruth.runtimeServices);
  const localPorts = readJson(root, config.sourceOfTruth.localPorts);
  const ownerManifest = readJson(root, config.sourceOfTruth.ownerManifest);
  const services = runtimeManifest.services.map((service) => {
    const resourceRoot = path.join(root, service.project, 'src', 'main', 'resources');
    const applicationFiles = fs.existsSync(resourceRoot)
      ? fs.readdirSync(resourceRoot).filter((file) => /^application\.(yml|yaml|properties)$/.test(file))
      : [];
    const applicationText = applicationFiles
      .map((file) => readText(root, path.join(service.project, 'src', 'main', 'resources', file)))
      .join('\n');
    const mainPath = serviceMainClassPath(root, service);
    return {
      id: service.id,
      service,
      projectPath: path.join(root, service.project),
      mainPath,
      mainExists: fs.existsSync(mainPath),
      pomExists: fs.existsSync(path.join(root, service.project, 'pom.xml')),
      applicationFiles,
      applicationText,
    };
  });

  return {
    root,
    config,
    runtimeManifest,
    localPorts,
    ownerManifest,
    services,
  };
}

function staticValidatorState() {
  return { errors: [], staticErrors: [], staticChecks: 0, fixedPortCount: 0 };
}

function staticCheck(state, label, condition) {
  state.staticChecks += 1;
  if (!condition) {
    const message = `B29 静态检查失败：${label}`;
    state.staticErrors.push(message);
    state.errors.push(message);
  }
}

function validateStaticInputs(inputs) {
  const state = staticValidatorState();
  const { config, runtimeManifest, localPorts, ownerManifest } = inputs;
  const backend = config?.backend ?? {};
  const portPolicy = config?.portPolicy ?? {};
  const readinessPolicy = config?.readinessPolicy ?? {};
  const gatewayPolicy = config?.gatewayPolicy ?? {};
  const persistencePolicy = config?.persistencePolicy ?? {};
  const observabilityPolicy = config?.observabilityPolicy ?? {};
  const runtimeGate = config?.runtimeGate ?? {};
  const staticPolicy = config?.staticPolicy ?? {};
  const manifestServices = Array.isArray(runtimeManifest?.services) ? runtimeManifest.services : [];
  const expectedIds = Array.isArray(backend.serviceOrder) ? backend.serviceOrder : [];
  const actualIds = manifestServices.map((service) => service?.id);
  const sourceById = new Map((inputs.services ?? []).map((item) => [item.id, item]));

  staticCheck(state, 'config schemaVersion must be 1', config?.schemaVersion === 1);
  staticCheck(state, 'config batch must be B29', config?.batch === 'B29');
  staticCheck(state, 'config phase must be phase-1', config?.phase === 'phase-1');
  staticCheck(state, 'runtime profile must be local-real', config?.runtimeProfile === 'local-real');
  staticCheck(state, 'task baseline source must be the B28-B36 baseline', config?.sourceOfTruth?.taskBaseline === 'requirements/backlog/v2-B28plus-Phase1-本机真实全栈与MCP浏览器验收任务基线.md');
  staticCheck(state, 'runtime service source must be config/v2-runtime-services.json', config?.sourceOfTruth?.runtimeServices === 'config/v2-runtime-services.json');
  staticCheck(state, 'local port source must be config/local-ports.json', config?.sourceOfTruth?.localPorts === 'config/local-ports.json');
  staticCheck(state, 'owner manifest source must be config/b17-runtime-services.json', config?.sourceOfTruth?.ownerManifest === 'config/b17-runtime-services.json');

  staticCheck(state, 'v2 runtime host must be loopback', runtimeManifest?.host === portPolicy.host && portPolicy.host === '127.0.0.1');
  staticCheck(state, `backend process count must be ${backend.requiredProcessCount}`, manifestServices.length === backend.requiredProcessCount && expectedIds.length === backend.requiredProcessCount);
  staticCheck(state, 'backend service ids must be unique', unique(actualIds));
  staticCheck(state, 'backend service order must match the B29 target', JSON.stringify(actualIds) === JSON.stringify(expectedIds));
  staticCheck(state, 'api-gateway must be the external ingress', runtimeManifest?.services?.some((service) => service?.id === backend.gatewayServiceId));
  staticCheck(state, 'core-api must be legacy compatibility only', runtimeManifest?.services?.find((service) => service?.id === 'core-api')?.profile === 'legacy-compatibility');
  staticCheck(state, 'core-api must not be listed as a v2 service', runtimeManifest?.services?.find((service) => service?.id === 'core-api')?.profile !== 'v2');
  staticCheck(state, 'Phase 2/3 services must stay out of the default manifest', (runtimeManifest?.disabledPhaseServices ?? []).every((id) => !actualIds.includes(id)));

  staticCheck(state, 'fixed port source must match the local registry', portPolicy.source === config.sourceOfTruth.localPorts);
  staticCheck(state, 'automatic port increment must be disabled', portPolicy.autoIncrement === false && localPorts?.policy?.autoIncrement === false);
  staticCheck(state, 'loopback-only port policy must be enabled', portPolicy.bindOnlyToLoopback === true && localPorts?.policy?.bindOnlyToLoopback === true);
  staticCheck(state, 'backend port protocol must be http', portPolicy.portProtocol === 'http');

  const seenPorts = new Set();
  for (const service of manifestServices) {
    const serviceInput = sourceById.get(service?.id);
    const registered = localPorts?.services?.[service?.portKey];
    const port = registered?.port;
    const expectedPort = portPolicy.portProtocol === 'http' ? port : undefined;
    staticCheck(state, `${service?.id ?? '<missing>'} must have a registered portKey`, Boolean(service?.portKey && registered));
    staticCheck(state, `${service?.id ?? '<missing>'} must use an HTTP fixed port`, Boolean(registered && registered.protocol === 'http' && Number.isInteger(port) && port > 0));
    staticCheck(state, `${service?.id ?? '<missing>'} must use its fixed port`, Boolean(expectedPort && service?.portKey === service?.id));
    if (Number.isInteger(port)) {
      if (seenPorts.has(port)) staticCheck(state, `fixed port ${port} must be unique`, false);
      seenPorts.add(port);
    }
    staticCheck(state, `${service?.id ?? '<missing>'} project must have pom.xml`, Boolean(serviceInput?.pomExists));
    staticCheck(state, `${service?.id ?? '<missing>'} main class must exist`, Boolean(serviceInput?.mainExists));
    staticCheck(state, `${service?.id ?? '<missing>'} must have application configuration`, Boolean(serviceInput?.applicationFiles?.length));
    staticCheck(state, `${service?.id ?? '<missing>'} application must declare port ${port ?? '<missing>'}`, Boolean(port && applicationPortLineMatches(serviceInput?.applicationText, port)));
    staticCheck(state, `${service?.id ?? '<missing>'} must bind to loopback`, String(serviceInput?.applicationText ?? '').includes('127.0.0.1'));
    staticCheck(state, `${service?.id ?? '<missing>'} must use graceful shutdown`, String(serviceInput?.applicationText ?? '').includes('shutdown: graceful'));
    staticCheck(state, `${service?.id ?? '<missing>'} healthPath must be Actuator health`, typeof service?.healthPath === 'string' && service.healthPath.startsWith(readinessPolicy.healthPathPrefix ?? '/actuator/health'));
    staticCheck(state, `${service?.id ?? '<missing>'} application must expose health`, /health/i.test(String(serviceInput?.applicationText ?? '')));
    if (service?.profile === 'v2') {
      staticCheck(state, `${service.id} must configure readiness probes`, String(serviceInput?.applicationText ?? '').includes('readiness:') && String(serviceInput?.applicationText ?? '').includes('readinessstate:') && String(serviceInput?.applicationText ?? '').includes('probes:'));
    } else {
      staticCheck(state, `${service?.id ?? '<missing>'} legacy health path must remain registered`, service?.healthPath === '/actuator/health');
    }
  }
  state.fixedPortCount = seenPorts.size;
  staticCheck(state, `all ${backend.requiredProcessCount} backend ports must be unique`, seenPorts.size === backend.requiredProcessCount);

  const gateway = manifestServices.find((service) => service?.id === backend.gatewayServiceId);
  const gatewayInput = sourceById.get(backend.gatewayServiceId);
  staticCheck(state, 'gateway policy must point to api-gateway', gatewayPolicy.externalIngress === backend.gatewayServiceId && gateway?.portKey === backend.gatewayServiceId);
  staticCheck(state, 'gateway external path must be /api/v1', gatewayPolicy.externalPathPrefix === '/api/v1');
  staticCheck(state, 'gateway must have a configured readiness endpoint', Boolean(gateway?.healthPath && gatewayInput?.applicationText));
  staticCheck(state, 'gateway application must declare response correlation headers', String(gatewayInput?.applicationText ?? '').includes('X-Request-Id') && String(gatewayInput?.applicationText ?? '').includes('X-Trace-Id'));
  staticCheck(state, 'gateway unauthenticated protected statuses must be 401/403', JSON.stringify(gatewayPolicy.protectedUnauthenticatedStatuses) === JSON.stringify([401, 403]));
  staticCheck(state, 'direct service access must not be a client path', gatewayPolicy.directServiceAccess === 'forbidden-as-client-path');

  const ownerServices = Array.isArray(ownerManifest?.services) ? ownerManifest.services : [];
  const ownerIds = ownerServices.map((service) => service?.id);
  // Platform services own a schema and an independent credential without being Phase 1 domain
  // owners, so they are declared in backend.platformOwnedSchemaServices instead of the B17 owner
  // manifest. Deriving the domain set by subtraction alone would demand a B17 entry for them.
  const platformOwned = new Set(backend.platformOwnedSchemaServices ?? ['iam-service']);
  const domainIds = expectedIds.filter((id) => id !== backend.gatewayServiceId
    && id !== 'core-api' && !platformOwned.has(id));
  const schemas = ownerServices.map((service) => service?.schema);
  const credentials = ownerServices.map((service) => service?.dbCredential);
  staticCheck(state, 'owner manifest must contain 11 domain services', ownerServices.length === domainIds.length && ownerServices.length === 11);
  staticCheck(state, 'owner manifest ids must be unique', unique(ownerIds));
  staticCheck(state, 'owner schemas must be unique', unique(schemas));
  staticCheck(state, 'owner credentials must be unique', unique(credentials));
  staticCheck(state, 'owner manifest must not own gateway/IAM/core-api', !ownerIds.includes(backend.gatewayServiceId) && !ownerIds.includes('iam-service') && !ownerIds.includes('core-api'));
  staticCheck(state, 'platform-owned schema services must stay out of the owner manifest', [...platformOwned].every((id) => !ownerIds.includes(id)));
  for (const id of domainIds) {
    const owner = ownerServices.find((service) => service?.id === id);
    const registered = localPorts?.services?.[id];
    staticCheck(state, `${id} must have a domain owner schema`, Boolean(owner && requiredString(owner.schema) && owner.schema === owner.id.replaceAll('-', '_')));
    staticCheck(state, `${id} owner port must match local registry`, Boolean(owner && registered && owner.port === registered.port));
    staticCheck(state, `${id} owner credential must be service-scoped`, Boolean(owner && /^svc_[a-z0-9_]+$/.test(owner.dbCredential ?? '')));
  }

  staticCheck(state, 'local-real fact authority must be MySQL', persistencePolicy.runtimeProfile === 'local-real' && persistencePolicy.factAuthority === 'mysql');
  staticCheck(state, 'local-real domain persistence mode must be JDBC', persistencePolicy.allowedDomainMode === 'jdbc');
  staticCheck(state, 'mock facts must be forbidden', persistencePolicy.mockAllowed === false);
  staticCheck(state, 'fallback facts must be forbidden', persistencePolicy.fallbackAllowed === false);
  staticCheck(state, 'in-memory facts must be forbidden', persistencePolicy.inMemoryFactsAllowed === false);
  staticCheck(state, 'missing persistence must fail closed', persistencePolicy.failClosedOnMissingPersistence === true);
  staticCheck(state, 'core-api must not write v2 facts', persistencePolicy.coreApiMayWriteV2DomainFacts === false);
  staticCheck(state, 'forbidden fact modes must include mock/fallback/in-memory', ['mock', 'fallback', 'memory', 'in-memory'].every((mode) => (persistencePolicy.forbiddenFactModes ?? []).includes(mode)));
  staticCheck(state, 'restart persistence read-back is required', persistencePolicy.restartReadBackRequired === true);
  const failClosedServices = persistencePolicy.localRealFailClosedServices ?? [];
  staticCheck(state, 'local-real fail-closed service list must be unique', unique(failClosedServices));
  staticCheck(state, 'local-real fail-closed services must not include gateway/IAM/core-api', !failClosedServices.some((id) => [backend.gatewayServiceId, 'iam-service', 'core-api'].includes(id)));
  staticCheck(state, 'fail-closed services must be explicitly non-fact boundaries', persistencePolicy.failClosedServicesAreNotBusinessFacts === true);

  staticCheck(state, 'observability propagation must be W3C', observabilityPolicy.propagation === 'W3C');
  staticCheck(state, 'observability must require requestId/traceId/service identity/version', ['requestId', 'traceId', 'serviceId', 'serviceVersion'].every((field) => (observabilityPolicy.requiredServiceFields ?? []).includes(field)));
  staticCheck(state, 'observability must require structured logs', (observabilityPolicy.requiredServiceFields ?? []).includes('structuredLog') && (observabilityPolicy.requiredServiceFields ?? []).includes('logEvidenceRef'));
  staticCheck(state, 'observability correlation must be required', observabilityPolicy.correlationRequired === true && observabilityPolicy.serviceIdentityAndVersionRequired === true);

  staticCheck(state, 'runtime evidence must be external', runtimeGate.runtimeEvidenceClass === 'runtime-external' && runtimeGate.externalProvenanceRequired === true);
  staticCheck(state, 'missing runtime evidence must fail closed', runtimeGate.missingEvidenceDecision === 'FAIL_CLOSED' && runtimeGate.defaultDecision === 'BLOCKED');
  staticCheck(state, 'static-only evidence cannot promote runtime', runtimeGate.staticOnlyLabelCannotPassRuntime === true);
  staticCheck(state, 'validator must not generate runtime evidence', runtimeGate.validatorCannotGenerateEvidence === true);
  staticCheck(state, 'runtime evidence must require every B29 check', (runtimeGate.requiredEvidenceChecks ?? []).length >= 8);

  staticCheck(state, 'static policy must be read-only', staticPolicy.readOnly === true && staticPolicy.connectToDocker === false && staticPolicy.connectToDatabase === false && staticPolicy.writeRuntimeEvidence === false);
  staticCheck(state, 'static policy must require project/config evidence', staticPolicy.requiredApplicationConfig === true && staticPolicy.requiredMainClassAndArtifactProject === true);

  return {
    ...state,
    staticStatus: state.staticErrors.length === 0 ? 'PASS' : 'FAIL',
    runtimeProcessCount: manifestServices.length,
    ownerSchemaCount: ownerServices.length,
  };
}

function checkRef(value) {
  return requiredString(value) && !/^(?:static-only|validator|generated):/i.test(value);
}

function normalizeChecks(value, errors) {
  if (Array.isArray(value)) {
    const ids = value.map((item) => item?.id);
    if (!unique(ids)) errors.push('运行证据 checks 不得包含重复 id');
    return new Map(value.filter((item) => isRecord(item) && requiredString(item.id)).map((item) => [item.id, item]));
  }
  if (isRecord(value)) {
    return new Map(Object.entries(value).map(([id, item]) => [id, isRecord(item) ? { id, ...item } : { id, status: item }]));
  }
  errors.push('运行证据 checks 必须是数组或对象');
  return new Map();
}

function normalizeHeaders(headers) {
  if (Array.isArray(headers)) {
    return new Map(headers.filter((item) => isRecord(item) && requiredString(item.name)).map((item) => [item.name.toLowerCase(), item.value]));
  }
  if (isRecord(headers)) return new Map(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
  return new Map();
}

function validateProbe(probe, label, expectedPath, config, errors) {
  if (!isRecord(probe)) {
    errors.push(`${label} 缺失`);
    return;
  }
  if (probe.path !== expectedPath) errors.push(`${label} path 必须为 ${expectedPath}`);
  if (upper(probe.status) !== upper(config.readinessPolicy.requiredHealthStatus)) errors.push(`${label} status 必须为 ${config.readinessPolicy.requiredHealthStatus}`);
  const statusCode = probe.httpStatus ?? probe.statusCode;
  if (statusCode !== config.readinessPolicy.requiredHttpStatus) errors.push(`${label} HTTP status 必须为 ${config.readinessPolicy.requiredHttpStatus}`);
  if (!checkRef(probe.evidenceRef)) errors.push(`${label} 缺少 evidenceRef`);
}

function valueFrom(item, process, names) {
  for (const name of names) {
    if (item?.[name] !== undefined) return item[name];
    if (process?.[name] !== undefined) return process[name];
  }
  return undefined;
}

function expectedOwnerSchema(inputs, serviceId) {
  if (serviceId === 'iam-service') return 'iam_service';
  if (serviceId === 'core-api') return null;
  return inputs.ownerManifest?.services?.find((service) => service?.id === serviceId)?.schema ?? null;
}

function validatePersistenceEvidence(inputs, service, item, config, errors) {
  const persistence = item.persistence;
  const label = `${service.id} persistence`;
  if (!isRecord(persistence)) {
    errors.push(`${label} 缺失`);
    return;
  }
  for (const flag of config.persistencePolicy.requiredRuntimeFlags ?? []) {
    if (persistence[flag] !== false) errors.push(`${label}.${flag} 必须为 false`);
  }
  if (persistence.failClosedOnUnavailable !== true) errors.push(`${label} 缺少 fail-closed 运行证明`);
  if (service.id === config.backend.gatewayServiceId) {
    if (persistence.mode !== config.persistencePolicy.gatewayFactMode || persistence.factSource !== 'none') {
      errors.push(`${label} Gateway 必须声明无领域事实源`);
    }
    if (persistence.domainFactsOwned !== false) errors.push(`${label} Gateway 不得拥有领域事实`);
    return;
  }

  const failClosedServices = new Set(config.persistencePolicy?.localRealFailClosedServices ?? []);
  if (failClosedServices.has(service.id)) {
    if (persistence.mode !== 'fail-closed') errors.push(`${label}.mode 必须为 fail-closed`);
    if (persistence.factSource !== 'none') errors.push(`${label}.factSource 必须为 none`);
    if (persistence.domainFactsOwned !== false) errors.push(`${label} fail-closed boundary 不得拥有领域事实`);
    if (upper(persistence.connectionStatus) !== 'VERIFIED' && upper(persistence.connectionStatus) !== 'PASS') errors.push(`${label} owner schema 连接必须已 VERIFIED`);
    if (persistence.mysqlReachable !== true) errors.push(`${label} 缺少 owner schema reachable 证明`);
    if (!requiredString(persistence.ownerSchema)) errors.push(`${label} 缺少 ownerSchema`);
    if (!checkRef(persistence.schemaEvidenceRef)) errors.push(`${label} 缺少 schemaEvidenceRef`);
    if (persistence.restartReadBack !== true) errors.push(`${label} 缺少 restartReadBack 证明`);
    return;
  }

  if (persistence.mode !== config.persistencePolicy.allowedDomainMode) errors.push(`${label}.mode 必须为 jdbc`);
  if (persistence.factSource !== config.persistencePolicy.factAuthority) errors.push(`${label}.factSource 必须为 mysql`);
  if (upper(persistence.connectionStatus) !== 'VERIFIED' && upper(persistence.connectionStatus) !== 'PASS') errors.push(`${label} MySQL 连接必须已 VERIFIED`);
  if (persistence.mysqlReachable !== true) errors.push(`${label} 缺少 MySQL reachable 证明`);
  if (!requiredString(persistence.ownerSchema)) errors.push(`${label} 缺少 ownerSchema`);
  if (!checkRef(persistence.schemaEvidenceRef)) errors.push(`${label} 缺少 schemaEvidenceRef`);
  if (persistence.restartReadBack !== true) errors.push(`${label} 缺少 restartReadBack 证明`);
  const expectedSchema = expectedOwnerSchema(inputs, service.id);
  if (expectedSchema && persistence.ownerSchema !== expectedSchema) errors.push(`${label}.ownerSchema 必须为 ${expectedSchema}`);
  if (service.id === 'core-api') {
    if (persistence.v2DomainFactsWritten !== false) errors.push('core-api 不得写入 v2 domain facts');
    if (persistence.ownerType !== 'legacy-compatibility') errors.push('core-api persistence.ownerType 必须为 legacy-compatibility');
  }
}

export function validateB29RuntimeEvidence(inputs, evidence) {
  const config = inputs.config;
  const runtimeManifest = inputs.runtimeManifest;
  const errors = [];
  const checks = normalizeChecks(evidence?.checks, errors);
  const requiredFields = config.runtimeGate?.requiredEvidenceFields ?? [];
  for (const field of requiredFields) {
    if (evidence?.[field] === undefined || evidence?.[field] === null || evidence?.[field] === '') errors.push(`运行证据缺少字段：${field}`);
  }
  if (evidence?.batch !== config.batch) errors.push(`运行证据 batch 必须为 ${config.batch}`);
  if (evidence?.mode !== config.runtimeGate.requiredMode) errors.push(`运行证据 mode 必须为 ${config.runtimeGate.requiredMode}`);
  if (evidence?.status !== 'PASS') errors.push('运行证据 status 必须为 PASS');
  if (evidence?.evidenceClass !== config.runtimeGate.runtimeEvidenceClass) errors.push('运行证据 evidenceClass 必须为 runtime-external');
  if (!requiredString(evidence?.runId) || /static|synthetic|mock|fake/i.test(evidence?.runId ?? '')) errors.push('运行证据 runId 必须是外部真实运行标识');
  if (!requiredString(evidence?.sourceRevision) || /unknown|static-only/i.test(evidence?.sourceRevision ?? '')) errors.push('运行证据 sourceRevision 不可为空或静态占位');
  if (!requiredString(evidence?.capturedAt) || Number.isNaN(Date.parse(evidence?.capturedAt ?? ''))) errors.push('运行证据 capturedAt 必须是有效时间');

  const environment = evidence?.environment;
  if (!isRecord(environment) || environment.profile !== config.runtimeProfile || environment.host !== config.portPolicy.host) {
    errors.push('运行证据 environment 必须明确 local-real/127.0.0.1');
  }
  const provenance = evidence?.provenance;
  if (!isRecord(provenance) || provenance.external !== true || !requiredString(provenance.producer) || !requiredString(provenance.source)) {
    errors.push('运行证据必须包含 external provenance/producer/source');
  }
  if (provenance?.generatedByValidator === true || provenance?.synthetic === true || provenance?.validatorGenerated === true) {
    errors.push('拒绝由验证器生成或标记为 synthetic 的运行证据');
  }
  if (/validate-b29-backend-runtime|static-validator|b29-validator/i.test(String(provenance?.producer ?? ''))) {
    errors.push('运行证据 producer 不能是 B29 静态/运行验证器');
  }
  if (/static(?:-only)?|mock|fake/i.test(String(provenance?.source ?? ''))) {
    errors.push('运行证据 provenance.source 不能是静态或伪造来源');
  }
  if (evidence?.synthetic === true || evidence?.staticOnly === true || evidence?.mock === true || evidence?.fake === true) {
    errors.push('拒绝 synthetic/static/mock/fake runtime evidence');
  }

  const correlation = evidence?.correlation;
  if (!isRecord(correlation) || !requiredString(correlation.requestId) || !requiredString(correlation.traceId)) {
    errors.push('运行证据 correlation 必须包含 requestId/traceId');
  }
  if (correlation?.propagation !== config.observabilityPolicy.propagation) errors.push('运行证据 propagation 必须为 W3C');
  const correlationServiceIds = Array.isArray(correlation?.serviceIds) ? correlation.serviceIds : [];
  if (JSON.stringify([...new Set(correlationServiceIds)].sort()) !== JSON.stringify((runtimeManifest?.services ?? []).map((service) => service.id).sort())) {
    errors.push('运行证据 correlation.serviceIds 必须覆盖且仅覆盖 14 个服务');
  }

  const manifestServices = Array.isArray(runtimeManifest?.services) ? runtimeManifest.services : [];
  const serviceEvidence = Array.isArray(evidence?.services) ? evidence.services : [];
  if (serviceEvidence.length !== config.backend.requiredProcessCount) errors.push('运行证据 services 必须包含 14 个进程');
  const evidenceIds = serviceEvidence.map((item) => item?.id);
  if (!unique(evidenceIds)) errors.push('运行证据 services id 不得重复');
  const pids = [];
  const ports = [];
  for (const service of manifestServices) {
    const item = serviceEvidence.find((candidate) => candidate?.id === service.id);
    if (!item) {
      errors.push(`运行证据缺少服务：${service.id}`);
      continue;
    }
    const process = isRecord(item.process) ? item.process : item;
    const pid = valueFrom(item, process, ['pid', 'processId']);
    const command = valueFrom(item, process, ['command', 'startupCommand']);
    const artifact = valueFrom(item, process, ['artifact', 'artifactRef']);
    const version = valueFrom(item, process, ['version', 'serviceVersion']);
    const jvmVersion = valueFrom(item, process, ['jvmVersion', 'javaVersion']);
    const profile = valueFrom(item, process, ['profile']);
    const mainClass = valueFrom(item, process, ['mainClass']);
    const port = valueFrom(item, process, ['port']);
    const host = valueFrom(item, process, ['host', 'bindAddress']);
    const processStatus = valueFrom(item, process, ['processStatus', 'status']);
    const binding = item.portBinding ?? item.binding ?? {};
    const listening = item.listening ?? binding.listening ?? item.portCheck?.listening;
    const label = `运行证据 ${service.id}`;
    if (service.id !== item.id) errors.push(`${label} id 不匹配`);
    if (!Number.isInteger(pid) || pid <= 0) errors.push(`${label} pid 必须是正整数`);
    else pids.push(pid);
    if (!requiredString(command)) errors.push(`${label} 缺少启动 command`);
    if (!requiredString(artifact)) errors.push(`${label} 缺少 artifact`);
    if (!requiredString(version)) errors.push(`${label} 缺少 service version`);
    if (parseJavaMajor(jvmVersion) !== config.backend.requiredJvmMajor) errors.push(`${label} 必须运行在 Java ${config.backend.requiredJvmMajor}`);
    if (profile !== service.profile) errors.push(`${label} profile 与运行清单不一致`);
    if (mainClass !== service.mainClass) errors.push(`${label} mainClass 与运行清单不一致`);
    const registeredPort = inputs.localPorts?.services?.[service.portKey]?.port;
    if (port !== registeredPort) errors.push(`${label} port 漂移：必须为 ${registeredPort}`);
    else ports.push(port);
    if (host !== config.portPolicy.host || binding.host !== config.portPolicy.host) errors.push(`${label} 必须绑定 ${config.portPolicy.host}`);
    if (binding.port !== registeredPort) errors.push(`${label} portBinding.port 必须为 ${registeredPort}`);
    if (listening !== true) errors.push(`${label} 缺少 listening=true 证明`);
    if (!['RUNNING', 'UP', 'PASS'].includes(upper(processStatus))) errors.push(`${label} process status 必须为 RUNNING/UP/PASS`);

    const readinessPath = expectedReadinessPath(config, service);
    validateProbe(item.health, `${label} health`, readinessPath, config, errors);
    validateProbe(item.readiness, `${label} readiness`, readinessPath, config, errors);
    if (config.readinessPolicy.requiredLiveness === true) {
      const liveness = item.liveness;
      if (!isRecord(liveness)) errors.push(`${label} liveness 缺失`);
      else {
        if (liveness.path !== expectedLivenessPath(config, service)) errors.push(`${label} liveness path 必须为 ${expectedLivenessPath(config, service)}`);
        if (upper(liveness.status) !== upper(config.readinessPolicy.requiredHealthStatus) || (liveness.httpStatus ?? liveness.statusCode) !== config.readinessPolicy.requiredHttpStatus) errors.push(`${label} liveness 未通过`);
        if (!checkRef(liveness.evidenceRef)) errors.push(`${label} liveness 缺少 evidenceRef`);
      }
    }

    const observability = item.observability;
    if (!isRecord(observability)) {
      errors.push(`${label} observability 缺失`);
    } else {
      for (const field of config.observabilityPolicy.requiredServiceFields ?? []) {
        if (field === 'processId' || field === 'jvmVersion') continue;
        if (observability[field] === undefined || observability[field] === null || observability[field] === '') errors.push(`${label} observability 缺少 ${field}`);
      }
      if (observability.requestId !== correlation?.requestId) errors.push(`${label} requestId 未与跨服务 correlation 对齐`);
      if (observability.traceId !== correlation?.traceId) errors.push(`${label} traceId 未与跨服务 correlation 对齐`);
      if (observability.serviceId !== service.id) errors.push(`${label} observability.serviceId 不匹配`);
      if (observability.serviceVersion !== version) errors.push(`${label} serviceVersion 未与进程版本对齐`);
      if (observability.processId !== pid) errors.push(`${label} processId 未与 pid 对齐`);
      if (parseJavaMajor(observability.jvmVersion) !== config.backend.requiredJvmMajor) errors.push(`${label} observability.jvmVersion 不是 Java 25`);
      if (observability.profile !== profile) errors.push(`${label} observability.profile 不匹配`);
      if (observability.structuredLog !== true) errors.push(`${label} structuredLog 必须为 true`);
      if (observability.propagation !== config.observabilityPolicy.propagation) errors.push(`${label} propagation 必须为 W3C`);
    }
    validatePersistenceEvidence(inputs, service, item, config, errors);
  }
  if (!unique(pids)) errors.push('运行证据 pid 必须在 14 个进程之间唯一');
  if (!unique(ports)) errors.push('运行证据 port 必须在 14 个进程之间唯一');

  const gateway = evidence?.gateway;
  const external = gateway?.externalIngress;
  if (!isRecord(external)) {
    errors.push('运行证据缺少 gateway.externalIngress');
  } else {
    if (external.serviceId !== config.gatewayPolicy.externalIngress) errors.push('Gateway externalIngress serviceId 不匹配');
    if (external.host !== config.portPolicy.host || external.port !== inputs.localPorts?.services?.[config.gatewayPolicy.externalIngress]?.port) errors.push('Gateway externalIngress host/port 漂移');
    if (!requiredString(external.path) || !external.path.startsWith(config.gatewayPolicy.externalPathPrefix)) errors.push('Gateway externalIngress 必须经过 /api/v1');
    if (external.reachable !== true || external.throughGateway !== true) errors.push('Gateway externalIngress 缺少真实可达/经 Gateway 证明');
    if (!Number.isInteger(external.httpStatus) || external.httpStatus < 200 || external.httpStatus >= 500) errors.push('Gateway externalIngress 不能以 5xx 作为 smoke 通过');
    if (!checkRef(external.evidenceRef)) errors.push('Gateway externalIngress 缺少 evidenceRef');
    const headers = normalizeHeaders(external.responseHeaders);
    for (const header of config.gatewayPolicy.requiredResponseHeaders ?? []) {
      const value = headers.get(header.toLowerCase());
      if (!requiredString(value)) errors.push(`Gateway externalIngress 缺少 ${header}`);
    }
    if (headers.get('x-request-id') !== correlation?.requestId) errors.push('Gateway X-Request-Id 未与 correlation 对齐');
    if (headers.get('x-trace-id') !== correlation?.traceId) errors.push('Gateway X-Trace-Id 未与 correlation 对齐');
  }
  const unauthenticated = gateway?.unauthenticatedProtectedRequest;
  if (!isRecord(unauthenticated) || unauthenticated.authenticated !== false || !(config.gatewayPolicy.protectedUnauthenticatedStatuses ?? []).includes(unauthenticated.httpStatus)) {
    errors.push('Gateway 受保护未认证请求必须真实返回 401/403');
  } else if (!checkRef(unauthenticated.evidenceRef)) {
    errors.push('Gateway 未认证请求缺少 evidenceRef');
  }
  const direct = gateway?.directServiceAccess;
  if (!isRecord(direct) || direct.clientPath !== false || direct.denied !== true || !checkRef(direct.evidenceRef)) {
    errors.push('直连领域服务必须标记为非客户端路径并被拒绝');
  }

  for (const checkId of config.runtimeGate.requiredEvidenceChecks ?? []) {
    const check = checks.get(checkId);
    if (!check) {
      errors.push(`运行证据缺少检查项：${checkId}`);
      continue;
    }
    if (check.status !== 'PASS') errors.push(`运行证据检查项未通过：${checkId}`);
    if (!checkRef(check.evidenceRef)) errors.push(`运行证据检查项缺少 evidenceRef：${checkId}`);
  }

  return {
    result: errors.length === 0 ? 'PASS' : 'FAIL',
    valid: errors.length === 0,
    errors,
    runtimeChecks: [...checks.values()],
    evidenceRunId: evidence?.runId ?? null,
    runtimeProcessCount: serviceEvidence.length,
    fixedPortCount: new Set(ports).size,
  };
}

function readAndValidateEvidence(inputs, env) {
  const config = inputs.config;
  const errors = [];
  const evidenceEnv = config.runtimeGate.evidenceFileEnv;
  const configuredPath = env?.[evidenceEnv];
  if (!requiredString(configuredPath)) {
    return { errors: [`运行证据缺失：必须设置 ${evidenceEnv}；静态结果不能升级为真实运行通过`], evidence: null, validation: null };
  }
  const evidenceRoot = path.resolve(inputs.root, config.runtimeGate.evidenceRoot);
  const evidencePath = path.resolve(inputs.root, configuredPath);
  if (!isWithin(evidenceRoot, evidencePath)) {
    return { errors: [`${evidenceEnv} 必须位于 ${config.runtimeGate.evidenceRoot} 下，拒绝越界证据`], evidence: null, validation: null };
  }
  if (!fs.existsSync(evidencePath) || !fs.statSync(evidencePath).isFile()) {
    return { errors: [`运行证据文件不存在：${path.relative(inputs.root, evidencePath)}`], evidence: null, validation: null };
  }
  let evidence;
  try {
    evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
  } catch (error) {
    return { errors: [`运行证据文件不是有效 JSON：${error.message}`], evidence: null, validation: null };
  }
  const validation = validateB29RuntimeEvidence(inputs, evidence);
  errors.push(...validation.errors);
  return { errors, evidence, validation };
}

export function validateB29BackendRuntime(inputs = readB29Inputs(), options = {}) {
  const staticResult = validateStaticInputs(inputs);
  const runtimeRequested = options.runtimeRequested === true;
  const errors = [...staticResult.errors];
  let runtimeStatus = runtimeRequested ? 'blocked' : 'not-requested';
  let runtimeChecks = [];
  let evidenceRunId = null;

  if (runtimeRequested && staticResult.staticStatus === 'PASS') {
    const evidenceResult = readAndValidateEvidence(inputs, options.env ?? process.env);
    errors.push(...evidenceResult.errors);
    runtimeChecks = evidenceResult.validation?.runtimeChecks ?? [];
    evidenceRunId = evidenceResult.validation?.evidenceRunId ?? null;
    if (evidenceResult.validation?.valid === true && evidenceResult.errors.length === 0) runtimeStatus = 'PASS';
  }

  return {
    result: errors.length === 0 ? 'PASS' : 'FAIL',
    batch: inputs.config.batch,
    mode: inputs.config.runtimeProfile,
    staticStatus: staticResult.staticStatus,
    runtimeStatus,
    runtimeGate: runtimeRequested ? (runtimeStatus === 'PASS' ? 'runtime-verified' : 'blocked') : 'static-only',
    runtimeEvidencePending: runtimeStatus === 'PASS' ? 0 : (inputs.config.runtimeGate.requiredEvidenceChecks?.length ?? 0),
    staticChecks: staticResult.staticChecks,
    runtimeChecks,
    requiredEvidenceCheckCount: inputs.config.runtimeGate.requiredEvidenceChecks?.length ?? 0,
    runtimeProcessCount: staticResult.runtimeProcessCount,
    ownerSchemaCount: staticResult.ownerSchemaCount,
    fixedPortCount: staticResult.fixedPortCount,
    evidenceRunId,
    execution: {
      dockerInvoked: false,
      databaseConnected: false,
      databaseWritten: false,
      runtimeEvidenceWritten: false,
    },
    errors,
    warnings: [],
  };
}

export function main(argv = process.argv.slice(2)) {
  const args = new Set(argv);
  const allowed = new Set(['--static-only', '--require-runtime']);
  const unknown = [...args].filter((arg) => !allowed.has(arg));
  if (unknown.length > 0 || (args.has('--static-only') && args.has('--require-runtime'))) {
    console.error('Usage: node scripts/runtime/validate-b29-backend-runtime.mjs [--static-only | --require-runtime]');
    return 2;
  }

  const staticOnly = args.has('--static-only');
  const runtimeRequested = !staticOnly || args.has('--require-runtime');
  try {
    const result = validateB29BackendRuntime(readB29Inputs(), { runtimeRequested });
    console.log(JSON.stringify(result, null, 2));
    if (result.result !== 'PASS') {
      console.error(`B29 backend runtime gate blocked: ${result.errors.join('; ')}`);
      return 1;
    }
    console.log(`B29 backend runtime validation passed (${staticOnly ? 'static' : 'runtime'}); no Docker/database mutation or runtime-evidence generation was performed.`);
    return 0;
  } catch (error) {
    console.error(JSON.stringify({ result: 'FAIL', batch: 'B29', errors: [error instanceof Error ? error.message : String(error)] }, null, 2));
    return 1;
  }
}

const currentFile = path.resolve(fileURLToPath(import.meta.url));
const invokedFile = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedFile === currentFile) process.exitCode = main();
