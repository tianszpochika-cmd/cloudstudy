// Rebind the manifests whose recorded digests no longer match the tree.
//
// Changing any script that a manifest records invalidates that manifest, and with seventy-eight tasks ahead the ad-hoc
// rebinding done by hand so far would be repeated hundreds of times. This does it in one place: recompute the digests,
// point sourceCommit at the revision that now holds them, append the provenance entry that says why, and report every
// manifest it touched.
//
// Usage: node scripts/audit/rebind-manifests.mjs [--write]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const write = process.argv.includes('--write');
const reason = process.argv.find((argument) => argument.startsWith('--reason='))?.slice('--reason='.length)
  ?? 'Digest rebind after a recorded artifact changed.';

const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();

const manifests = [];
const collect = (directory) => {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) { collect(absolute); continue; }
    if (entry.name === 'manifest.json') manifests.push(absolute);
  }
};
collect(path.join(root, 'evidence', 'p1r'));

const touched = [];
for (const file of manifests) {
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (unreadable) {
    console.error(`unreadable: ${path.relative(root, file)}`);
    continue;
  }
  const stale = [];
  for (const entry of manifest.artifactDigests ?? []) {
    const absolute = path.join(root, entry.path);
    if (!fs.existsSync(absolute)) continue;
    const digest = crypto.createHash('sha256').update(fs.readFileSync(absolute)).digest('hex');
    if (digest !== entry.digest) {
      stale.push(entry.path);
      if (write) entry.digest = digest;
    }
  }
  if (stale.length === 0) continue;

  if (write) {
    const previous = manifest.sourceCommit;
    manifest.sourceCommit = head;
    const provenance = manifest.provenance ?? {};
    const history = provenance.currentSourceRevalidationHistory ?? [];
    provenance.previousCurrentSourceCommit = provenance.currentSourceRevalidationAuditedImplementationSource
      ?? history.at(-1)?.sourceCommit ?? previous;
    provenance.currentSourceRevalidationTask = manifest.taskId;
    provenance.currentSourceRevalidationReviewer = 'agent:p1r_implementation:deepseek-harness';
    provenance.currentSourceRevalidationRuntimeStatus = provenance.currentSourceRevalidationRuntimeStatus ?? 'NOT_RUNTIME_VERIFIED';
    provenance.currentSourceRevalidationFinishedAt = new Date().toISOString();
    provenance.currentSourceRevalidationAuditedImplementationSource = head;
    provenance.currentSourceRevalidationIntegrationCheckpoint = head;
    history.push({
      taskId: manifest.taskId,
      sourceCommit: head,
      auditedImplementationSource: head,
      integrationCheckpoint: head,
      reviewer: provenance.currentSourceRevalidationReviewer,
      runtimeStatus: provenance.currentSourceRevalidationRuntimeStatus,
      finishedAt: provenance.currentSourceRevalidationFinishedAt,
      details: reason,
    });
    provenance.currentSourceRevalidationHistory = history;
    manifest.provenance = provenance;
    fs.writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`);
  }
  touched.push({ task: manifest.taskId, stale });
}

console.log(`${write ? 'rebound' : 'would rebind'} ${touched.length} manifest(s) against ${head.slice(0, 7)}`);
for (const entry of touched) {
  console.log(`  ${entry.task}: ${entry.stale.length} artifact(s)`);
  for (const artifact of entry.stale.slice(0, 4)) console.log(`      ${artifact}`);
  if (entry.stale.length > 4) console.log(`      ... and ${entry.stale.length - 4} more`);
}
if (!write) console.log('\nnothing written; pass --write to apply');
