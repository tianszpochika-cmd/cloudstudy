import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const registry = JSON.parse(fs.readFileSync(path.join(root, 'config/local-ports.json'), 'utf8'));
const runtime = JSON.parse(fs.readFileSync(path.join(root, 'config/v2-runtime-services.json'), 'utf8'));
const checks = [];
async function http(name, portKey, pathname, readiness = false, validateJson = null) {
  const url = `http://${registry.host}:${registry.services[portKey].port}${pathname}`;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const body = readiness || validateJson ? await response.json() : null;
    checks.push({ name, url, passed: response.ok && (!readiness || body.status === 'UP') && (!validateJson || validateJson(body)), status: response.status });
  } catch (error) { checks.push({ name, url, passed: false, error: error.message }); }
}
await Promise.all(runtime.services.filter(service => service.profile !== 'legacy-compatibility').map(service =>
  http(service.id, service.portKey, `${service.healthBasePath ?? ''}${service.healthPath}`, true)));
await Promise.all([
  ['Learner Web', 'learner-web-dev', '/login'],
  ['Admin Web', 'admin-web-dev', '/login'],
  ['Official Site', 'official-site-dev', '/'],
  ['Mobile H5', 'mobile-h5-dev', '/']
].map(([name, key, pathname]) => http(name, key, pathname)));
await http('IAM RSA JWKS', 'iam-service', '/api/v1/auth/jwks', false, body => {
  const keys = body?.data?.keys ?? body?.keys;
  return Array.isArray(keys) && keys.length > 0 && keys.every(key =>
    key.kty === 'RSA' && key.alg === 'RS256' && key.use === 'sig'
      && ['kid', 'n', 'e'].every(field => typeof key[field] === 'string' && key[field].length > 0)
      && ['d', 'p', 'q', 'dp', 'dq', 'qi'].every(field => !(field in key)));
});
await http('MinIO', 'minio-api', '/minio/health/live');
for (const key of ['mysql', 'redis', 'kafka']) {
  await new Promise(resolve => {
    const socket = net.createConnection({ host: registry.host, port: registry.services[key].port });
    let complete = false;
    function finish(passed) {
      if (complete) return;
      complete = true;
      checks.push({ name: key, passed, scope: 'TCP availability; owner/ACL/topic tests are separate' });
      socket.destroy(); resolve();
    }
    socket.setTimeout(5000, () => finish(false));
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
  });
}
checks.sort((a, b) => a.name.localeCompare(b.name));
console.log(JSON.stringify({ result: checks.every(check => check.passed) ? 'PASS' : 'FAIL',
  scope: 'Runtime readiness only; business acceptance and P1R contract governance are separate gates.', checks }, null, 2));
if (checks.some(check => !check.passed)) process.exitCode = 1;
