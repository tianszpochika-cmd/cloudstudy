import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..', '..');
const openApiPath = path.join(repoRoot, 'packages', 'contracts', 'openapi', 'v1', 'openapi.json');
const eventCatalogPath = path.join(repoRoot, 'packages', 'contracts', 'events', 'v1', 'catalog.json');
const openApiFragmentDir = path.join(repoRoot, 'packages', 'contracts', 'fragments', 'b1');
const openApiB2FragmentDir = path.join(repoRoot, 'packages', 'contracts', 'fragments', 'b2');
const openApiB3FragmentDir = path.join(repoRoot, 'packages', 'contracts', 'fragments', 'b3');
const openApiB8FragmentDir = path.join(repoRoot, 'packages', 'contracts', 'fragments', 'b8');
const openApiB9FragmentDir = path.join(repoRoot, 'packages', 'contracts', 'fragments', 'b9');
const openApiB10FragmentDir = path.join(repoRoot, 'packages', 'contracts', 'fragments', 'b10');
const openApiB11FragmentDir = path.join(repoRoot, 'packages', 'contracts', 'fragments', 'b11');
const openApiB12FragmentDir = path.join(repoRoot, 'packages', 'contracts', 'fragments', 'b12');
const openApiB13FragmentDir = path.join(repoRoot, 'packages', 'contracts', 'fragments', 'b13');
const openApiSharedFragmentDir = path.join(repoRoot, 'packages', 'contracts', 'fragments');
const eventFragmentDir = path.join(repoRoot, 'packages', 'contracts', 'events', 'v1', 'fragments');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function stableJson(value) {
  return JSON.stringify(value, Object.keys(value ?? {}).sort());
}

function listJsonFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => path.join(directory, entry.name))
    .sort();
}

function mergeNamedMap(target, source, label, { allowOverride = false } = {}) {
  for (const [name, value] of Object.entries(source ?? {})) {
    if (target[name] !== undefined && stableJson(target[name]) !== stableJson(value) && !allowOverride) {
      throw new Error(`${label} duplicate with different definitions: ${name}`);
    }
    target[name] = value;
  }
}

function mergeOpenApi(base, fragment, filePath) {
  for (const tag of fragment.tags ?? []) {
    const existing = (base.tags ?? []).find((candidate) => candidate.name === tag.name);
    if (existing && stableJson(existing) !== stableJson(tag)) {
      throw new Error(`${filePath} conflicts with OpenAPI tag ${tag.name}`);
    }
    if (!existing) (base.tags ??= []).push(tag);
  }

  for (const [route, pathItem] of Object.entries(fragment.paths ?? {})) {
    const isOverrideFragment = /[\\/]b(?:2|3|4|5|6|8|9|10|11|12|13)(?:[\\/]|-)/i.test(filePath);
    if (base.paths[route] && stableJson(base.paths[route]) !== stableJson(pathItem) && !isOverrideFragment) {
      throw new Error(`${filePath} conflicts with OpenAPI route ${route}; reconcile manually`);
    }
    base.paths[route] = pathItem;
  }

  const isOverrideFragment = /[\\/]b(?:2|3|4|5|6|8|9|10|11|12)(?:[\\/]|-)/i.test(filePath);
  for (const componentGroup of ['schemas', 'parameters', 'responses', 'headers', 'securitySchemes', 'requestBodies', 'examples']) {
    mergeNamedMap(base.components[componentGroup] ??= {}, fragment.components?.[componentGroup], `OpenAPI ${componentGroup}`, { allowOverride: isOverrideFragment });
  }

  for (const metadataKey of ['x-b8-idp-integration', 'x-b8-compatibility']) {
    if (fragment[metadataKey] === undefined) continue;
    if (base[metadataKey] !== undefined && stableJson(base[metadataKey]) !== stableJson(fragment[metadataKey])) {
      throw new Error(`${filePath} conflicts with OpenAPI metadata ${metadataKey}`);
    }
    base[metadataKey] = fragment[metadataKey];
  }
}

function mergeEvents(base, fragment, filePath) {
  const isOverrideFragment = /[\\/]b(?:2|3|4|5|6|8|9|10|11|12|13)-/i.test(filePath);
  for (const event of fragment.events ?? []) {
    const existing = base.events.find((candidate) => candidate.eventName === event.eventName);
    if (existing && stableJson(existing) !== stableJson(event)) {
      if (!isOverrideFragment) throw new Error(`${filePath} conflicts with event ${event.eventName}`);
      base.events = base.events.map((candidate) => candidate.eventName === event.eventName ? event : candidate);
      continue;
    }
    if (!existing) base.events.push(event);
  }
  mergeNamedMap(base.payloadSchemas, fragment.payloadSchemas, 'event payload schema');

  if (fragment.asyncapi) {
    base.asyncapi ??= {};
    for (const key of ['version', 'info']) {
      if (fragment.asyncapi[key] === undefined) continue;
      if (base.asyncapi[key] !== undefined && stableJson(base.asyncapi[key]) !== stableJson(fragment.asyncapi[key])) {
        throw new Error(`${filePath} conflicts with AsyncAPI ${key}`);
      }
      base.asyncapi[key] = fragment.asyncapi[key];
    }
    mergeNamedMap(base.asyncapi.channels ??= {}, fragment.asyncapi.channels, 'AsyncAPI channel', { allowOverride: isOverrideFragment });
    mergeNamedMap(base.asyncapi.operations ??= {}, fragment.asyncapi.operations, 'AsyncAPI operation', { allowOverride: isOverrideFragment });
  }
}

function merge({ write = false } = {}) {
  const openApi = readJson(openApiPath);
  const catalog = readJson(eventCatalogPath);
  const openApiFiles = [...listJsonFiles(openApiSharedFragmentDir), ...listJsonFiles(openApiFragmentDir), ...listJsonFiles(openApiB2FragmentDir), ...listJsonFiles(openApiB3FragmentDir), ...listJsonFiles(openApiB8FragmentDir), ...listJsonFiles(openApiB9FragmentDir), ...listJsonFiles(openApiB10FragmentDir), ...listJsonFiles(openApiB11FragmentDir), ...listJsonFiles(openApiB12FragmentDir), ...listJsonFiles(openApiB13FragmentDir)]
    .filter((filePath, index, files) => files.indexOf(filePath) === index);
  const eventFiles = listJsonFiles(eventFragmentDir).filter((filePath) => /^(b1|b2|b3|b4|b5|b6|b8|b9|b10|b11|b12|b13)-/.test(path.basename(filePath)));

  for (const filePath of openApiFiles) mergeOpenApi(openApi, readJson(filePath), path.relative(repoRoot, filePath));
  for (const filePath of eventFiles) mergeEvents(catalog, readJson(filePath), path.relative(repoRoot, filePath));

  if (write) {
    writeJson(openApiPath, openApi);
    writeJson(eventCatalogPath, catalog);
  }

  return {
    openApiFragments: openApiFiles.map((filePath) => path.relative(repoRoot, filePath)),
    eventFragments: eventFiles.map((filePath) => path.relative(repoRoot, filePath)),
    routes: Object.keys(openApi.paths).length,
    events: catalog.events.length,
  };
}

try {
  const result = merge({ write: process.argv.includes('--write') });
  console.log(`Contract fragment merge ${process.argv.includes('--write') ? 'written' : 'checked'}: ${result.openApiFragments.length} OpenAPI fragments, ${result.eventFragments.length} event fragments, ${result.routes} routes, ${result.events} events.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
