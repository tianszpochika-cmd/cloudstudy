/**
 * Generate a loopback-only IAM test CA, PKCS12 and JVM truststore.
 *
 * Private keys stay in the chosen directory. The committed caller uses
 * `<repo>/.runtime/r3-iam-tls`, which is gitignored. This script never writes
 * the macOS keychain and never prints passwords.
 */
import { execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const KEY_ALIAS = 'r3-iam';
export const PUBLIC_FILES = ['test-ca.pem', 'iam-server.p12', 'trust.p12', 'iam-signer.pem', 'public.json', 'local.env'];

export function defaultMaterialDir(root = process.cwd()) {
  return path.join(root, '.runtime', 'r3-iam-tls');
}

export function assertMaterialDirectory(directory) {
  const resolved = path.resolve(directory);
  const allowed = [path.resolve(defaultMaterialDir()), path.resolve(tmpdir())];
  if (!allowed.some((root) => resolved === root || resolved.startsWith(root + path.sep))) {
    throw new Error(`refusing to write TLS material outside .runtime/r3-iam-tls or the system temp dir: ${resolved}`);
  }
  return resolved;
}

export function certificateSpkiHash(pemPath) {
  const publicKeyPem = execFileSync('openssl', ['x509', '-in', pemPath, '-pubkey', '-noout'], { encoding: 'utf8' });
  const publicKeyDer = execFileSync('openssl', ['pkey', '-pubin', '-outform', 'der'], { input: publicKeyPem });
  return createHash('sha256').update(publicKeyDer).digest('base64');
}

function run(command, args, env) {
  execFileSync(command, args, { env, stdio: ['ignore', 'pipe', 'pipe'] });
}

function writeSecret(file, text) {
  writeFileSync(file, text, { mode: 0o600 });
  chmodSync(file, 0o600);
}

/**
 * Create material when the directory is empty. An existing complete directory
 * is left untouched. A partial directory is refused so a failed run is not
 * silently overwritten.
 */
export function prepareIamTls(options = {}) {
  const directory = assertMaterialDirectory(options.directory ?? defaultMaterialDir(options.root));
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  chmodSync(directory, 0o700);
  const existing = loadIamTls(directory);
  if (existing) return { ...existing, created: false };
  const present = PUBLIC_FILES.filter((name) => existsSync(path.join(directory, name)));
  if (present.length) throw new Error(`incomplete TLS directory ${directory}; remove it before generating again`);

  const keystorePassword = randomBytes(18).toString('hex');
  const truststorePassword = randomBytes(18).toString('hex');
  const env = { ...process.env, R3_KEYSTORE_PASSWORD: keystorePassword, R3_TRUSTSTORE_PASSWORD: truststorePassword };
  const caPem = path.join(directory, 'test-ca.pem');
  const keyPem = path.join(directory, 'test-key.pem');
  const keyStore = path.join(directory, 'iam-server.p12');
  const trustStore = path.join(directory, 'trust.p12');
  const signer = path.join(directory, 'iam-signer.pem');
  run('openssl', ['req', '-x509', '-newkey', 'rsa:3072', '-nodes', '-sha256', '-days', String(options.days ?? 2),
    '-subj', '/CN=r3 local IAM loopback', '-addext', 'subjectAltName=IP:127.0.0.1,DNS:localhost',
    '-keyout', keyPem, '-out', caPem], env);
  chmodSync(keyPem, 0o600);
  chmodSync(caPem, 0o600);
  run('openssl', ['pkcs12', '-export', '-in', caPem, '-inkey', keyPem, '-out', keyStore,
    '-name', KEY_ALIAS, '-passout', 'env:R3_KEYSTORE_PASSWORD'], env);
  chmodSync(keyStore, 0o600);
  const keytool = options.keytool ?? 'keytool';
  run(keytool, ['-importcert', '-noprompt', '-alias', KEY_ALIAS, '-file', caPem,
    '-keystore', trustStore, '-storetype', 'PKCS12', '-storepass:env', 'R3_TRUSTSTORE_PASSWORD'], env);
  chmodSync(trustStore, 0o600);
  run('openssl', ['genpkey', '-algorithm', 'RSA', '-pkeyopt', 'rsa_keygen_bits:3072', '-out', signer], env);
  chmodSync(signer, 0o600);
  const spki = certificateSpkiHash(caPem);
  const fingerprint = execFileSync('openssl', ['x509', '-in', caPem, '-noout', '-fingerprint', '-sha256'], { encoding: 'utf8' }).trim();
  const publicRecord = {
    kind: 'R3_LOCAL_IAM_TLS',
    host: '127.0.0.1',
    port: 18087,
    keyAlias: KEY_ALIAS,
    caPem: 'test-ca.pem',
    keyStore: 'iam-server.p12',
    trustStore: 'trust.p12',
    signer: 'iam-signer.pem',
    spkiSha256: spki,
    fingerprintSha256: fingerprint,
    san: ['IP:127.0.0.1', 'DNS:localhost'],
    issuerClaim: 'http://127.0.0.1:18087',
    jwks: 'https://127.0.0.1:18087/api/v1/auth/jwks',
  };
  writeFileSync(path.join(directory, 'public.json'), JSON.stringify(publicRecord, null, 2) + '\n', { mode: 0o644 });
  writeSecret(path.join(directory, 'local.env'), `KEYSTORE_PASSWORD=${keystorePassword}\nTRUSTSTORE_PASSWORD=${truststorePassword}\n`);
  const loaded = loadIamTls(directory);
  if (!loaded) throw new Error('TLS material was written but could not be reloaded');
  return { ...loaded, created: true };
}

function readEnvFile(file) {
  const values = {};
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index <= 0) continue;
    values[trimmed.slice(0, index)] = trimmed.slice(index + 1);
  }
  return values;
}

/** Return absolute paths and passwords, or null when the directory is absent. */
export function loadIamTls(directory = defaultMaterialDir()) {
  const resolved = path.resolve(directory);
  const publicFile = path.join(resolved, 'public.json');
  const envFile = path.join(resolved, 'local.env');
  if (!existsSync(publicFile) || !existsSync(envFile)) return null;
  const record = JSON.parse(readFileSync(publicFile, 'utf8'));
  const secrets = readEnvFile(envFile);
  const required = ['caPem', 'keyStore', 'trustStore', 'signer', 'keyAlias', 'spkiSha256'];
  if (record.kind !== 'R3_LOCAL_IAM_TLS' || required.some((key) => !record[key])) return null;
  if (!secrets.KEYSTORE_PASSWORD || !secrets.TRUSTSTORE_PASSWORD) return null;
  const caPem = path.join(resolved, record.caPem);
  const keyStore = path.join(resolved, record.keyStore);
  const trustStore = path.join(resolved, record.trustStore);
  const signerPem = path.join(resolved, record.signer);
  if ([caPem, keyStore, trustStore, signerPem].some((file) => !existsSync(file))) return null;
  const spki = certificateSpkiHash(caPem);
  if (spki !== record.spkiSha256) return null;
  return {
    directory: resolved,
    caPem,
    keyStore,
    trustStore,
    signerPem,
    keyAlias: record.keyAlias,
    spki,
    keystorePassword: secrets.KEYSTORE_PASSWORD,
    truststorePassword: secrets.TRUSTSTORE_PASSWORD,
    issuer: record.issuerClaim,
    jwks: record.jwks,
  };
}

function main() {
  const dirFlag = process.argv.indexOf('--dir');
  const directory = dirFlag >= 0 ? process.argv[dirFlag + 1] : defaultMaterialDir();
  const material = prepareIamTls({ directory });
  process.stdout.write(JSON.stringify({
    created: material.created,
    directory: material.directory,
    spkiSha256: material.spki,
    caPem: material.caPem,
    listen: 'https://127.0.0.1:18087',
  }) + '\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
