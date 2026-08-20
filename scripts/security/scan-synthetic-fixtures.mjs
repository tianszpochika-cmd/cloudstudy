import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { findSensitiveData } from '../../packages/telemetry/src/index.mjs';

const fixtureRoot = fileURLToPath(new URL('../../tests/fixtures/b0-security/', import.meta.url));
const forbiddenRealDataMarkers = ['@gmail.com', '@qq.com', '@163.com', '@outlook.com'];
const failures = [];

function walk(directory) {
  const files = [];
  for (const entry of readdirSync(directory)) {
    const fullPath = join(directory, entry);
    if (statSync(fullPath).isDirectory()) {
      files.push(...walk(fullPath));
    } else if (fullPath.endsWith('.json')) {
      files.push(fullPath);
    }
  }
  return files;
}

for (const file of walk(fixtureRoot)) {
  const relativePath = relative(fixtureRoot, file);
  let data;
  try {
    data = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    failures.push(`${relativePath}: invalid JSON (${error.message})`);
    continue;
  }
  const findings = findSensitiveData(data);
  if (findings.length > 0) {
    failures.push(`${relativePath}: sensitive data findings at ${findings.map((finding) => finding.path).join(', ')}`);
  }
  const serialized = JSON.stringify(data).toLowerCase();
  for (const marker of forbiddenRealDataMarkers) {
    if (serialized.includes(marker)) {
      failures.push(`${relativePath}: fixture contains a non-synthetic email domain`);
    }
  }
}

if (failures.length > 0) {
  console.error(`Synthetic fixture scan failed (${failures.length}):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log(`Synthetic fixture scan passed: ${walk(fixtureRoot).length} JSON files.`);
}
