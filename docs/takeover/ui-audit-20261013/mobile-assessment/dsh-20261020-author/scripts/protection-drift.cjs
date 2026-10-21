#!/usr/bin/env node
// Read-only drift check against .git/codex-local-backups/ui-audit-20261013/preexisting-work.json
// Does not write into .git or any protected file. Outputs JSON to stdout and to the named out file.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const repo = process.argv[2] || process.cwd();
const outFile = process.argv[3];

const manifestPath = path.join(repo, '.git', 'codex-local-backups', 'ui-audit-20261013', 'preexisting-work.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

function sha256File(p) {
  const h = crypto.createHash('sha256');
  h.update(fs.readFileSync(p));
  return h.digest('hex');
}

const results = [];
for (const entry of manifest.dirty || []) {
  const abs = path.join(repo, entry.path);
  const exists = fs.existsSync(abs);
  if (!exists) {
    results.push({ path: entry.path, expected: entry.sha256, actual: null, status: 'MISSING' });
    continue;
  }
  const st = fs.statSync(abs);
  if (st.isDirectory()) {
    results.push({ path: entry.path, expected: entry.sha256, actual: null, status: 'DIRECTORY_PRESENT' });
    continue;
  }
  const actual = sha256File(abs);
  let status;
  if (entry.sha256 === null) status = 'NO_EXPECTED_HASH_RECORDED';
  else if (actual === entry.sha256) status = 'MATCH';
  else status = 'DRIFT';
  results.push({ path: entry.path, expected: entry.sha256, actual, status });
}

const drift = results.filter((r) => r.status === 'DRIFT' || r.status === 'MISSING');
const report = {
  checkedAt: new Date().toISOString(),
  manifestPath,
  manifestHead: manifest.head,
  manifestRemote: manifest.remote,
  totalEntries: results.length,
  match: results.filter((r) => r.status === 'MATCH').length,
  directoryPresent: results.filter((r) => r.status === 'DIRECTORY_PRESENT').length,
  driftCount: drift.length,
  drift,
  results,
};

const json = JSON.stringify(report, null, 2);
if (outFile) fs.writeFileSync(outFile, json + '\n');
process.stdout.write(json + '\n');
