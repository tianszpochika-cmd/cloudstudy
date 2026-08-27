import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'config', 'v2-runtime-services.json'), 'utf8'));
const ports = JSON.parse(fs.readFileSync(path.join(root, 'config', 'local-ports.json'), 'utf8'));
const errors = [];
const ids = new Set();

for (const service of manifest.services) {
  if (ids.has(service.id)) errors.push(`重复服务 id: ${service.id}`);
  ids.add(service.id);
  const projectPath = path.join(root, service.project);
  const pomPath = path.join(projectPath, 'pom.xml');
  if (!fs.existsSync(pomPath)) errors.push(`${service.id}: 缺少 ${service.project}/pom.xml`);
  const mainPath = path.join(projectPath, 'src', 'main', 'java', ...service.mainClass.split('.')) + '.java';
  if (!fs.existsSync(mainPath)) errors.push(`${service.id}: 缺少 main class ${service.mainClass}`);
  const resourcePath = path.join(projectPath, 'src', 'main', 'resources');
  const applicationFiles = fs.existsSync(resourcePath)
    ? fs.readdirSync(resourcePath).filter((file) => /^application\.(yml|yaml|properties)$/.test(file))
    : [];
  if (applicationFiles.length === 0) errors.push(`${service.id}: 缺少 application 配置`);
  const applicationText = applicationFiles
    .map((file) => fs.readFileSync(path.join(resourcePath, file), 'utf8'))
    .join('\n');
  const port = ports.services?.[service.portKey];
  if (!port) errors.push(`${service.id}: portKey 未登记 ${service.portKey}`);
  if (port && port.protocol !== 'http') errors.push(`${service.id}: 后端服务端口必须为 http`);
  if (port) {
    const portLines = applicationText.split(/\r?\n/).filter((line) => /(^|\s)port\s*:/.test(line));
    if (!portLines.some((line) => line.includes(String(port.port)))) {
      errors.push(`${service.id}: application 配置未声明注册端口 ${port.port}`);
    }
  }
  if (!service.healthPath.startsWith('/actuator/health')) errors.push(`${service.id}: healthPath 必须是 Actuator health`);
  if (!applicationText.includes('shutdown: graceful')) errors.push(`${service.id}: 缺少 graceful shutdown 配置`);
  if (service.healthPath.endsWith('/readiness') && !applicationText.includes('readiness:')) {
    errors.push(`${service.id}: readiness healthPath 缺少 readiness group 配置`);
  }
  if (service.profile === 'v2' && service.id === 'core-api') errors.push('core-api 不能标记为 v2');
}

const forbidden = manifest.disabledPhaseServices.filter((id) => manifest.services.some((service) => service.id === id));
if (forbidden.length > 0) errors.push(`Phase 2/3 服务不能进入默认运行清单: ${forbidden.join(', ')}`);

if (errors.length > 0) {
  for (const error of errors) console.error(`ERROR ${error}`);
  process.exitCode = 1;
} else {
  console.log(`v2 runtime manifest passed: ${manifest.services.length} services, loopback host ${manifest.host}, Phase 1 only`);
}
