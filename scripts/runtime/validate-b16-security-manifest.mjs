import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const manifest = JSON.parse(read('config/b16-security-runtime.json'));
const runtime = JSON.parse(read('config/v2-runtime-services.json'));
const ports = JSON.parse(read('config/local-ports.json'));
const errors = [];

function requireText(relative, patterns, label = relative) {
  const text = read(relative);
  for (const pattern of patterns) {
    if (!pattern.test(text)) errors.push(`${label}: 缺少 ${pattern}`);
  }
  return text;
}

if (manifest.phase !== 'phase-1') errors.push('B16 安全清单必须属于 Phase 1');
if (manifest.defaultDecision !== 'deny') errors.push('B16 默认决策必须是 deny');
if (manifest.gateway.directConnectAllowed !== false) errors.push('Gateway 直连必须明确禁止');
if (manifest.oidc.gIdpGate !== 'closed') errors.push('G-IDP 未批准前必须保持 closed');
if (manifest.oidc.tokenServerInRepository !== false) errors.push('仓库内不得实现 Token Server');
if (manifest.oidc.pkceMethod !== 'S256') errors.push('OIDC 必须使用 S256 PKCE');
if (manifest.iam.adultMinimumAge !== 18 || manifest.iam.minorDomainEnabled !== false) {
  errors.push('Phase 1 成人 Gate 必须为 18+ 且关闭未成年人域');
}

const gatewayPort = ports.services?.[manifest.gateway.portKey];
if (!gatewayPort || gatewayPort.port !== 18070 || gatewayPort.protocol !== 'http') {
  errors.push('Gateway 固定端口登记不符合 18070/http');
}
const iamPort = ports.services?.[manifest.iam.portKey];
if (!iamPort || iamPort.port !== 18087 || iamPort.protocol !== 'http') {
  errors.push('IAM 固定端口登记不符合 18087/http');
}

const gatewayYaml = requireText('services/api-gateway/src/main/resources/application.yaml', [
  /server:\s*[\s\S]*address:\s*\$\{SERVER_ADDRESS:127\.0\.0\.1\}/,
  /port:\s*\$\{API_GATEWAY_PORT:18070\}/,
  /shutdown:\s*graceful/,
  /resource-server-enabled:\s*\$\{GATEWAY_RESOURCE_SERVER_ENABLED:false\}/,
  /issuer-uri:\s*\$\{OIDC_ISSUER_URI:/
], 'Gateway application.yaml');
const gatewaySanitizer = read('services/api-gateway/src/main/java/com/englishflow/gateway/filter/ClientAuthorizationContextSanitizerGlobalFilter.java');
requireText('services/iam-service/src/main/resources/application.yaml', [
  /address:\s*\$\{IAM_SERVER_ADDRESS:127\.0\.0\.1\}/,
  /port:\s*\$\{IAM_SERVICE_PORT:18087\}/,
  /shutdown:\s*graceful/,
  /provider-mode:\s*provider-neutral/,
  /real-provider-enabled:\s*false/
], 'IAM application.yaml');
requireText('services/api-gateway/src/main/java/com/englishflow/gateway/config/GatewayConfiguration.java', [
  /oauth2ResourceServer/,
  /anyExchange\(\)\.authenticated\(\)/,
  /anyExchange\(\)\.denyAll\(\)/,
  /ReactiveJwtDecoders\.fromIssuerLocation/
], 'Gateway security configuration');
requireText('services/iam-service/src/main/java/com/englishflow/iam/oidc/ProviderNeutralOidcClient.java', [
  /PkceSupport\.s256Challenge/,
  /transactions\.consume\(callback\.state\(\)\)/,
  /OIDC_CALLBACK_REPLAY/
], 'IAM OIDC protocol seam');

const forbiddenTokenServer = [
  /JwtEncoder/,
  /NimbusJwtEncoder/,
  /AuthorizationServerConfiguration/,
  /@EnableAuthorizationServer/
];
const iamSources = fs.readdirSync(path.join(root, 'services/iam-service/src/main/java'), { recursive: true })
  .filter((file) => String(file).endsWith('.java'))
  .map((file) => read(path.join('services/iam-service/src/main/java', file)))
  .join('\n');
for (const pattern of forbiddenTokenServer) {
  if (pattern.test(iamSources)) errors.push(`IAM 不得包含自建 Token Server 标记 ${pattern}`);
}

const runtimeById = new Map(runtime.services.map((service) => [service.id, service]));
for (const serviceId of manifest.pep.domainServices) {
  const service = runtimeById.get(serviceId);
  if (!service) {
    errors.push(`PEP 服务未进入 v2 runtime manifest: ${serviceId}`);
    continue;
  }
  const project = service.project;
  const pom = read(path.join(project, 'pom.xml'));
  if (!/spring-boot-starter-security/.test(pom) || !/oauth2-resource-server/.test(pom)) {
    errors.push(`${serviceId}: 缺少 Resource Server 依赖`);
  }
  const sourceRoot = path.join(root, project, 'src', 'main');
  const javaFiles = [];
  const visit = (directory) => {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.name.endsWith('.java')) javaFiles.push(fs.readFileSync(absolute, 'utf8'));
    }
  };
  visit(sourceRoot);
  const java = javaFiles.join('\n');
  if (!/oauth2ResourceServer|ResourceServer|resource-server/.test(java)) {
    errors.push(`${serviceId}: 缺少服务侧 Resource Server/PEP 代码标记`);
  }
  const resources = path.join(sourceRoot, 'resources');
  const configs = fs.existsSync(resources)
    ? fs.readdirSync(resources).filter((file) => /^application\.(yml|yaml|properties)$/.test(file))
    : [];
  const configText = configs.map((file) => fs.readFileSync(path.join(resources, file), 'utf8')).join('\n');
  if (!/resource-server|RESOURCE_SERVER_ENABLED/.test(configText)) {
    errors.push(`${serviceId}: 缺少 Resource Server 配置开关`);
  }
}

for (const header of manifest.gateway.forbiddenAuthorityHeaders) {
  if (!gatewaySanitizer.includes(header)) errors.push(`Gateway 未声明清理伪造 authority header: ${header}`);
}
if (manifest.pep.pdpUnknownDecision !== 'deny' || manifest.pep.revocationUnknownDecision !== 'deny') {
  errors.push('PDP/撤销事实未知时必须 deny');
}

if (errors.length > 0) {
  for (const error of errors) console.error(`ERROR ${error}`);
  process.exitCode = 1;
} else {
  console.log(`B16 security manifest passed: Gateway/IAM/PEP ${manifest.pep.domainServices.length} services, G-IDP gate closed, default deny`);
}
