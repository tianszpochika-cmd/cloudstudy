import { readFileSync, writeFileSync, mkdtempSync, realpathSync, statSync, lstatSync, chmodSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { createHash, randomBytes, X509Certificate } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { sanitizeEvidence } from './sanitize-evidence.mjs';

export const root = realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..'));
export const tlsPrefix = 'spring.cloud.gateway.server.webflux.httpclient.ssl';
export const sha256 = value => createHash('sha256').update(value).digest('hex');

export function assertExternalDirectory(directory, repository = root) {
  const resolved = realpathSync(directory);
  const relative = path.relative(realpathSync(repository), resolved);
  if (!relative || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))) {
    throw new Error('Private material must be outside the repository');
  }
  if (process.platform === 'win32') {
    throw new Error('Windows material creation requires independently verified protected DACL; use the historical DPAPI workflow on that machine');
  }
  const info = statSync(resolved);
  if (!info.isDirectory() || info.uid !== process.getuid() || (info.mode & 0o7777) !== 0o700) {
    throw new Error('Private directory must belong to the current user and have mode 0700');
  }
  return resolved;
}

export function checkPrivateMetadata(info, expectedUid, kind, name) {
  const expectedMode = kind === 'directory' ? 0o700 : 0o600;
  const mode = info.mode & 0o7777;
  const facts = { name, kind, mode: `0${mode.toString(8)}`, expectedMode: `0${expectedMode.toString(8)}`,
    ownerUid: info.uid, expectedOwnerUid: expectedUid, ownerMatches: info.uid === expectedUid,
    symbolicLink: info.isSymbolicLink(), expectedTypeMatches: kind === 'directory' ? info.isDirectory() : info.isFile() };
  if (!facts.ownerMatches || mode !== expectedMode || facts.symbolicLink || !facts.expectedTypeMatches) {
    throw new Error(`Private permission readback rejected: ${JSON.stringify(facts)}`);
  }
  return { ...facts, result: 'PASS' };
}

export function verifyPrivateMaterialPermissions(directory, filenames) {
  if (process.platform === 'win32') throw new Error('POSIX stat cannot prove a protected Windows DACL');
  const resolved = assertExternalDirectory(directory);
  const uid = process.getuid();
  const checks = [checkPrivateMetadata(lstatSync(resolved), uid, 'directory', 'material-directory')];
  for (const name of filenames) {
    if (!/^[A-Za-z0-9._-]+$/.test(name)) throw new Error('Private readback accepts a local filename only');
    checks.push(checkPrivateMetadata(lstatSync(path.join(resolved, name)), uid, 'file', name));
  }
  return { checkedAt: new Date().toISOString(), method: 'filesystem-lstat-owner-and-mode', checks, result: 'PASS', contentsRead: false };
}

export function javaArgument(value) {
  if (/[\r\n\0]/.test(value)) throw new Error('Unsafe Java argument');
  return '"' + value.replaceAll('\\', '\\\\').replaceAll('"', '\\"') + '"';
}

export function transportPlan(directory, ports) {
  if (ports.host !== '127.0.0.1' || ports.services['iam-service']?.port !== 18087 || ports.services['api-gateway']?.port !== 18070) {
    throw new Error('Fixed loopback IAM/Gateway registration differs from the preparation baseline');
  }
  return {
    issuer: 'http://127.0.0.1:18087',
    iamTransport: 'https://127.0.0.1:18087',
    jwksTransport: 'https://127.0.0.1:18087/api/v1/auth/jwks',
    gatewayArguments: [
      `--${tlsPrefix}.trusted-x509-certificates[0]=${pathToFileURL(path.join(directory, 'test-ca.pem')).href}`,
      `--${tlsPrefix}.use-insecure-trust-manager=false`,
    ],
    independentJwksClient: {
      implementation: 'GatewayIamPublicJwkSource.readDocument → WebClient.builder().build()',
      trustConfiguration: 'Dedicated JVM trustStore via protected external gateway-jvm.args; does not inherit SCG route CA settings',
    },
    runtimeVerified: false,
    registrationPerformed: false,
    databaseTouched: false,
  };
}

export function validateTransportPlan(plan) {
  if (plan.issuer !== 'http://127.0.0.1:18087' || plan.iamTransport !== 'https://127.0.0.1:18087'
      || plan.jwksTransport !== 'https://127.0.0.1:18087/api/v1/auth/jwks') throw new Error('Issuer and TLS transport must remain separate and fixed');
  if (plan.gatewayArguments.length !== 2 || !plan.gatewayArguments[0].startsWith(`--${tlsPrefix}.trusted-x509-certificates[0]=file:`)
      || plan.gatewayArguments[1] !== `--${tlsPrefix}.use-insecure-trust-manager=false`) throw new Error('Explicit verified route CA and secure trust manager are required');
  if (plan.runtimeVerified || plan.registrationPerformed || plan.databaseTouched) throw new Error('Preparation cannot claim runtime or business acceptance');
  return true;
}

function command(executable, args, options = {}) {
  const result = spawnSync(executable, args, { encoding: 'utf8', timeout: 30000, windowsHide: true, ...options });
  if (result.status !== 0) throw new Error(`${path.basename(executable)} failed (exit ${result.status ?? 'unavailable'}); output withheld`);
  return result;
}

export function certificateFacts(pem) {
  if (/PRIVATE KEY/.test(pem.toString())) throw new Error('Private key material is not a public certificate');
  const cert = new X509Certificate(pem);
  if (cert.checkIP('127.0.0.1') !== '127.0.0.1' || cert.checkHost('localhost') !== 'localhost') throw new Error('Loopback SAN is required');
  if (cert.checkHost('untrusted.example.invalid')) throw new Error('Foreign hostname must not match');
  if (Date.parse(cert.validTo) <= Date.now() || Date.parse(cert.validFrom) > Date.now()) throw new Error('Certificate is not currently valid');
  return { sha256: sha256(pem), fingerprint256: cert.fingerprint256, subjectAltName: cert.subjectAltName, validFrom: cert.validFrom, validTo: cert.validTo, ca: cert.ca };
}

export function createTls(parent, ports) {
  const directory = mkdtempSync(path.join(assertExternalDirectory(parent), 'r1-002-'));
  chmodSync(directory, 0o700);
  const password = randomBytes(32).toString('base64url');
  const privateKey = path.join(directory, 'test-key.pem');
  const pem = path.join(directory, 'test-ca.pem');
  const environment = { ...process.env, R1_002_KEYSTORE_PASSWORD: password };
  command('openssl', ['req', '-x509', '-newkey', 'rsa:3072', '-nodes', '-sha256', '-days', '7',
    '-subj', '/CN=R1-002 synthetic loopback preparation', '-addext', 'subjectAltName=IP:127.0.0.1,DNS:localhost',
    '-keyout', privateKey, '-out', pem]);
  chmodSync(privateKey, 0o600);
  chmodSync(pem, 0o600);
  command('openssl', ['pkcs12', '-export', '-in', pem, '-inkey', privateKey, '-out', path.join(directory, 'iam-server.p12'),
    '-name', 'r1-002-test', '-passout', 'env:R1_002_KEYSTORE_PASSWORD'], { env: environment });
  command('keytool', ['-importcert', '-noprompt', '-alias', 'r1-002-test-ca', '-file', pem,
    '-keystore', path.join(directory, 'gateway-trust.p12'), '-storetype', 'PKCS12', '-storepass:env', 'R1_002_KEYSTORE_PASSWORD'], { env: environment });
  command('keytool', ['-list', '-keystore', path.join(directory, 'gateway-trust.p12'), '-storepass:env', 'R1_002_KEYSTORE_PASSWORD'], { env: environment });
  const gatewayArgs = [
    `-Djavax.net.ssl.trustStore=${path.join(directory, 'gateway-trust.p12')}`,
    '-Djavax.net.ssl.trustStoreType=PKCS12',
    `-Djavax.net.ssl.trustStorePassword=${password}`,
  ];
  writeFileSync(path.join(directory, 'gateway-jvm.args'), gatewayArgs.map(javaArgument).join('\n') + '\n', { mode: 0o600, flag: 'wx' });
  writeFileSync(path.join(directory, 'iam-private.properties'), [
    'server.ssl.enabled=true', 'server.ssl.key-store-type=PKCS12', 'server.ssl.key-alias=r1-002-test',
    `server.ssl.key-store=${pathToFileURL(path.join(directory, 'iam-server.p12')).href}`, `server.ssl.key-store-password=${password}`,
    'iam.jwt.refresh-cookie-secure=true',
  ].join('\n') + '\n', { mode: 0o600, flag: 'wx' });
  for (const name of ['iam-server.p12', 'gateway-trust.p12']) chmodSync(path.join(directory, name), 0o600);
  const plan = transportPlan(directory, ports);
  validateTransportPlan(plan);
  writeFileSync(path.join(directory, 'transport-plan.json'), JSON.stringify(plan, null, 2), { mode: 0o600, flag: 'wx' });
  const privateFiles = ['test-key.pem', 'test-ca.pem', 'iam-server.p12', 'gateway-trust.p12',
    'gateway-jvm.args', 'iam-private.properties', 'transport-plan.json'];
  // Re-read OS metadata before consuming protected config; successful chmod is not evidence.
  verifyPrivateMaterialPermissions(directory, privateFiles);
  // Java consumes protected @argfile; no secret is present in argv or stdout.
  command('java', [`@${path.join(directory, 'gateway-jvm.args')}`, '-version']);
  const trustCheck = command('java', [`@${path.join(directory, 'gateway-jvm.args')}`, path.join(root, 'scripts/redesign/r1-002/VerifyTrust.java'), pem]);
  return { directory, publicCertificate: certificateFacts(readFileSync(pem)), plan, keytoolImportAndListExit: 0, javaArgfileParseExit: 0,
    offlineJvmTrust: JSON.parse(trustCheck.stdout.trim()), privateMaterialPermissions: verifyPrivateMaterialPermissions(directory, privateFiles),
    serviceStarted: false, databaseTouched: false };
}

export function inspectProcesses(ports) {
  if (process.platform === 'win32') return { status: 'UNVERIFIED', reason: 'No Windows process identity probe executed; do not infer ownership or stop a process' };
  return ['api-gateway', 'iam-service'].map(service => {
    const port = ports.services[service].port;
    const listeners = spawnSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], { encoding: 'utf8' });
    if (listeners.error) return { service, port, status: 'UNVERIFIED', reason: 'lsof unavailable' };
    const pids = [...new Set(listeners.stdout.trim().split(/\s+/).filter(Boolean))];
    return { service, port, occupied: pids.length > 0, processes: pids.map(pid => {
      const summary = spawnSync('ps', ['-p', pid, '-o', 'pid=,ppid=,comm=,lstart='], { encoding: 'utf8' }).stdout.trim();
      const raw = spawnSync('ps', ['-p', pid, '-o', 'command='], { encoding: 'utf8' }).stdout;
      const jar = raw.match(/-jar\s+(\S+)/)?.[1];
      const ppid = spawnSync('ps', ['-p', pid, '-o', 'ppid='], { encoding: 'utf8' }).stdout.trim();
      const parent = spawnSync('ps', ['-p', ppid, '-o', 'command='], { encoding: 'utf8' }).stdout;
      return { pid: Number(pid), summary, parentPid: Number(ppid), projectAllServicesRunner: parent.includes('scripts/runtime/run-v2-services.mjs') && parent.includes('--all'),
        jar: jar && existsSync(jar) ? path.relative(root, jar) : null, diskJarSha256: jar && existsSync(jar) ? sha256(readFileSync(jar)) : null,
        runtimeJarBytesProven: false, startupReceiptAvailable: false, stopped: false };
    }) };
  });
}

function inspect(ports) {
  const source = readFileSync(path.join(root, 'services/api-gateway/src/main/java/com/englishflow/gateway/config/GatewayIamPublicJwkSource.java'));
  const local = path.join(os.homedir(), '.m2/repository/org/springframework/cloud/spring-cloud-gateway-server-webflux');
  const versions = existsSync(local) ? readdirSync(local).filter(version => existsSync(path.join(local, version, `spring-cloud-gateway-server-webflux-${version}.jar`))) : [];
  let dependency = { status: 'UNVERIFIED', versions };
  if (versions.length === 1) {
    const jar = path.join(local, versions[0], `spring-cloud-gateway-server-webflux-${versions[0]}.jar`);
    const temporary = mkdtempSync(path.join(os.tmpdir(), 'r1-002-metadata-'));
    command('jar', ['--extract', '--file', jar, 'META-INF/spring-configuration-metadata.json'], { cwd: temporary });
    const metadata = JSON.parse(readFileSync(path.join(temporary, 'META-INF/spring-configuration-metadata.json')));
    rmSync(temporary, { recursive: true });
    dependency = { version: versions[0], jarSha256: sha256(readFileSync(jar)),
      properties: metadata.properties.filter(p => p.name === `${tlsPrefix}.trusted-x509-certificates` || p.name === `${tlsPrefix}.use-insecure-trust-manager`),
      status: metadata.properties.some(p => p.name === `${tlsPrefix}.trusted-x509-certificates`) ? 'PASS' : 'FAIL', runtimeBindingVerified: false };
  }
  return { dependency, jwksSourceSha256: sha256(source), independentClientObserved: /WebClient client = WebClient\.builder\(\)/.test(source.toString()),
    processes: inspectProcesses(ports), tlsRuntimeStatus: 'OPEN', noServicesStartedOrStopped: true, noDatabaseOperation: true };
}

export function parseArguments(args) {
  const values = {};
  for (let i = 0; i < args.length; i += 1) {
    if (!['--mode', '--out', '--private-parent'].includes(args[i]) || !args[i + 1] || args[i + 1].startsWith('--') || values[args[i]]) throw new Error('Invalid or duplicate argument');
    values[args[i]] = args[++i];
  }
  if (!['inspect', 'create-tls'].includes(values['--mode'] ?? 'inspect')) throw new Error('Supported modes: inspect, create-tls');
  if ((values['--mode'] === 'create-tls') !== Boolean(values['--private-parent'])) throw new Error('create-tls requires --private-parent; inspect does not accept it');
  return values;
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = parseArguments(process.argv.slice(2));
    const ports = JSON.parse(readFileSync(path.join(root, 'config/local-ports.json')));
    const mode = args['--mode'] ?? 'inspect';
    const report = { task: 'R1-002', status: 'PREPARATION_PARTIAL_NOT_READY', checkedAt: new Date().toISOString(), mode,
      platform: process.platform, architecture: process.arch, sourceHead: command('git', ['rev-parse', 'HEAD'], { cwd: root }).stdout.trim(),
      toolSha256: sha256(readFileSync(fileURLToPath(import.meta.url))), localPortsSha256: sha256(readFileSync(path.join(root, 'config/local-ports.json'))),
      result: mode === 'inspect' ? inspect(ports) : createTls(args['--private-parent'], ports) };
    if (args['--out']) {
      const archived = mode === 'create-tls' ? sanitizeEvidence(report, [report.result.directory], root) : report;
      writeFileSync(args['--out'], JSON.stringify(archived, null, 2) + '\n', { flag: 'wx' });
    }
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  } catch (error) { process.stderr.write(`R1-002 preparation refused: ${error.message}\n`); process.exitCode = 1; }
}
