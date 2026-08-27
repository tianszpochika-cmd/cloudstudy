import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const manifest = JSON.parse(readFileSync(path.join(root, 'config', 'v2-runtime-services.json'), 'utf8'));
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

function values(name) {
  const result = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === name && args[index + 1]) result.push(args[index + 1]);
  }
  return result;
}

const requested = values('--service').flatMap((value) => value.split(',')).filter(Boolean);
const selectAll = args.includes('--all');
if (!selectAll && requested.length === 0) {
  console.error('Usage: pnpm services:build -- --all [--dry-run]');
  console.error('   or: pnpm services:build -- --service api-gateway,iam-service');
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
const maven = process.platform === 'win32' ? 'mvn.cmd' : 'mvn';

if (!dryRun) {
  const toolchain = spawnSync(process.execPath, [path.join(root, 'scripts', 'toolchain', 'check-toolchain.mjs')], {
    cwd: root,
    stdio: 'inherit',
    windowsHide: true,
  });
  if (toolchain.status !== 0) {
    console.error('v2 service build stopped: Java 25/Maven toolchain check failed.');
    process.exit(1);
  }
}

for (const service of selected) {
  const pom = path.join(root, service.project, 'pom.xml');
  if (!existsSync(pom)) {
    console.error(`${service.id}: missing ${pom}`);
    process.exitCode = 1;
    continue;
  }
  const command = `${maven} -f ${path.relative(root, pom)} -DskipTests package`;
  if (dryRun) {
    console.log(`[dry-run] ${command}`);
    continue;
  }
  const result = spawnSync(maven, ['-f', pom, '-DskipTests', 'package'], {
    cwd: root,
    stdio: 'inherit',
    windowsHide: true,
    shell: process.platform === 'win32' && maven.endsWith('.cmd'),
  });
  if (result.status !== 0) {
    console.error(`${service.id}: Maven build failed with exit ${result.status ?? 'unknown'}`);
    process.exitCode = 1;
    break;
  }
  console.log(`${service.id}: package built`);
}
