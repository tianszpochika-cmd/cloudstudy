import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { readFileSync, readdirSync, writeFileSync, realpathSync } from 'node:fs';

export function sanitizeEvidence(value, materialDirectories, repository) {
  const replacements = [];
  for (const directory of materialDirectories) {
    if (!path.isAbsolute(directory)) throw new Error('Private material directory must be absolute');
    const relative = path.relative(repository, directory);
    if (!relative || (!relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))) throw new Error('Do not redact repository source paths as private materials');
    replacements.push([pathToFileURL(directory).href, '<PRIVATE_MATERIAL_DIR>'], [directory, '<PRIVATE_MATERIAL_DIR>']);
    const parent = path.dirname(directory);
    const repositoryFromParent = path.relative(parent, repository);
    if (repositoryFromParent.startsWith(`..${path.sep}`) || path.isAbsolute(repositoryFromParent)) replacements.push([parent, '<PRIVATE_MATERIAL_PARENT>']);
  }
  replacements.sort((left, right) => right[0].length - left[0].length);
  const clean = data => {
    if (typeof data === 'string') {
      for (const [actual, placeholder] of replacements) data = data.replaceAll(actual.replaceAll('\\', '\\\\'), placeholder).replaceAll(actual, placeholder);
      return data;
    }
    if (Array.isArray(data)) return data.map(clean);
    if (data && typeof data === 'object') return Object.fromEntries(Object.entries(data).map(([key, child]) => [key, clean(child)]));
    return data;
  };
  return clean(value);
}

// Explicit archive operation, limited to this card's own preparation evidence directory.
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const repository = realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..'));
    const evidence = path.join(repository, 'evidence/redesign/2026-10-07/R1-002-preparation');
    const args = process.argv.slice(2);
    const directories = [];
    for (let i = 0; i < args.length; i += 2) {
      if (args[i] !== '--material-dir' || !args[i + 1]) throw new Error('Usage: sanitize-evidence.mjs --material-dir <external directory> [--material-dir <external directory>]');
      directories.push(args[i + 1]);
    }
    if (!directories.length) throw new Error('At least one explicit private material directory is required');
    let files = 0;
    for (const name of readdirSync(evidence)) {
      if (!/\.(json|log|md)$/.test(name)) continue;
      const file = path.join(evidence, name);
      const raw = readFileSync(file, 'utf8');
      const sanitized = name.endsWith('.json') ? JSON.stringify(sanitizeEvidence(JSON.parse(raw), directories, repository), null, 2) + '\n'
        : sanitizeEvidence(raw, directories, repository);
      if (raw !== sanitized) { writeFileSync(file, sanitized); files++; }
    }
    process.stdout.write(JSON.stringify({ task: 'R1-002', archiveSanitized: true, filesChanged: files, privateDirectoriesPrinted: false }) + '\n');
  } catch (error) { process.stderr.write(`R1-002 evidence sanitization refused: ${error.message}\n`); process.exitCode = 1; }
}
