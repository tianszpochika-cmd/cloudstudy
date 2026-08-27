import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const args = new Set(process.argv.slice(2));
const staticOnly = args.has('--static-only');
const startInfra = args.has('--start-infra');
const requireHealthy = args.has('--require-healthy');
const failures = [];

function run(label, command, commandArgs) {
  const result = spawnSync(command, commandArgs, { cwd: root, encoding: 'utf8', windowsHide: true, stdio: 'inherit' });
  if (result.status !== 0) failures.push(label);
  return result.status === 0;
}

function nodeScript(label, script, ...scriptArgs) {
  return run(label, process.execPath, [path.join(root, script), ...scriptArgs]);
}

nodeScript('toolchain', 'scripts/toolchain/check-toolchain.mjs', ...(staticOnly ? ['--static-only'] : []));
nodeScript('runtime-manifest', 'scripts/runtime/validate-v2-runtime-manifest.mjs');
nodeScript('fixed-port-registry', 'scripts/check-fixed-ports.mjs', '--registry-only');
nodeScript('infra-static', 'scripts/check-local-infra.mjs', '--static-only');
nodeScript('migration-static', 'scripts/database/validate-migrations.mjs');
nodeScript('fixture-static', 'scripts/database/validate-fixtures.mjs');
nodeScript('runtime-config', 'scripts/check-runtime-config.mjs');

if (startInfra) {
  run('docker-compose-up', 'docker', ['compose', '-f', 'infra/docker/docker-compose.dev.yml', 'up', '-d']);
}

if (!staticOnly && (startInfra || requireHealthy)) {
  nodeScript('infra-runtime-health', 'scripts/check-local-infra.mjs', '--require-healthy');
} else {
  console.log('B15 bootstrap: Java services are not started by this safe preflight; use the runtime service runner after Java 25/Maven are available.');
}

if (failures.length > 0) {
  console.error(`B15 bootstrap failed: ${failures.join(', ')}`);
  process.exitCode = 1;
} else {
  console.log(`B15 bootstrap passed (${staticOnly ? 'static preflight' : 'runtime preflight'}); no production data or credentials were changed.`);
}
