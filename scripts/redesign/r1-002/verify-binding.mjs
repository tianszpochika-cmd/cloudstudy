import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { root, assertExternalDirectory, certificateFacts, sha256 } from './prepare.mjs';

// Deliberately not a service launcher: extracts only public libraries into a temporary folder.
let temporary;
try {
  if (process.argv.length !== 4 || process.argv[2] !== '--tls-dir') throw new Error('Usage: node verify-binding.mjs --tls-dir <protected external material directory>');
  const directory = assertExternalDirectory(process.argv[3]);
  const certificate = path.join(directory, 'test-ca.pem');
  certificateFacts(readFileSync(certificate));
  const jar = path.join(root, 'services/api-gateway/target/api-gateway-0.1.0-SNAPSHOT.jar');
  temporary = mkdtempSync(path.join(os.tmpdir(), 'r1-002-binding-'));
  const extract = spawnSync('jar', ['--extract', '--file', jar, 'BOOT-INF/lib'], { cwd: temporary, encoding: 'utf8', timeout: 30000 });
  if (extract.status !== 0) throw new Error(`Public dependency extraction failed: exit ${extract.status}`);
  const lib = path.join(temporary, 'BOOT-INF/lib');
  const dependencies = readdirSync(lib).filter(name => /^spring-cloud-gateway-server-webflux-.*\.jar$/.test(name));
  if (dependencies.length !== 1) throw new Error('Exactly one Gateway WebFlux dependency is required');
  const check = spawnSync('java', ['-cp', path.join(lib, '*'), path.join(root, 'scripts/redesign/r1-002/VerifyGatewayBinding.java'), certificate], {
    encoding: 'utf8', timeout: 30000,
  });
  if (check.status !== 0) throw new Error(`Offline Spring binding check failed: exit ${check.status}; output withheld`);
  const result = JSON.parse(check.stdout.trim().split('\n').at(-1));
  process.stdout.write(JSON.stringify({ task: 'R1-002', status: 'PREPARATION_PARTIAL_NOT_READY', executableJarSha256: sha256(readFileSync(jar)),
    dependency: dependencies[0], dependencySha256: sha256(readFileSync(path.join(lib, dependencies[0]))),
    binderSourceSha256: sha256(readFileSync(path.join(root, 'scripts/redesign/r1-002/VerifyGatewayBinding.java'))), result }, null, 2) + '\n');
} catch (error) { process.stderr.write(`R1-002 binding refused: ${error.message}\n`); process.exitCode = 1; }
finally { if (temporary) rmSync(temporary, { recursive: true, force: true }); }
