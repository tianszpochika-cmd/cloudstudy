import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { validateContracts } from './validate-contracts.mjs';
import {
  dereference,
  isHttpMethod,
  isRecord,
  isWriteMethod,
  readJson,
  schemaDescription,
  schemaToTs,
  toEventTypeName,
  toTypeName,
  tsPropertyName,
} from './schema-utils.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..', '..');
const openApiPath = path.join(repoRoot, 'packages', 'contracts', 'openapi', 'v1', 'openapi.json');
const eventCatalogPath = path.join(repoRoot, 'packages', 'contracts', 'events', 'v1', 'catalog.json');
const schemaRegistryPath = path.join(repoRoot, 'packages', 'contracts', 'schemas', 'v1', 'registry.json');
const contractsGeneratedDir = path.join(repoRoot, 'packages', 'contracts', 'generated');
const apiClientGeneratedDir = path.join(repoRoot, 'packages', 'api-client', 'src', 'generated');

function writeFile(filePath, contents) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${contents.trimEnd()}\n`, 'utf8');
}

function normalizedContents(contents) {
  return `${contents.trimEnd()}\n`;
}

function schemaTypeAlias(name, schema, document) {
  const docs = schemaDescription(schema).length > 0 ? `${schemaDescription(schema).join('\n')}\n` : '';
  return `/**\n${docs || ' * Generated from the contract source.\n'} */\nexport type ${toTypeName(name)} = ${schemaToTs(document, schema)};`;
}

function generateOpenApiTypes(document) {
  const schemaEntries = Object.entries(document.components.schemas ?? {});
  const aliases = schemaEntries.map(([name, schema]) => schemaTypeAlias(name, schema, document));
  const canonical = Object.entries(document['x-canonical-id-fields'] ?? {})
    .map(([name, reference]) => `  ${tsPropertyName(name)}: ${schemaToTs(document, { $ref: reference })};`)
    .join('\n');

  const operations = [];
  for (const [route, pathItem] of Object.entries(document.paths ?? {})) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!isHttpMethod(method)) continue;
      const response = Object.values(operation.responses ?? {}).find((candidate) => candidate?.content?.['application/json']?.schema);
      const request = operation.requestBody?.content?.['application/json']?.schema;
      operations.push({
        operationId: operation.operationId,
        method: method.toUpperCase(),
        path: route,
        requestType: request ? schemaToTs(document, request) : 'never',
        responseType: response ? schemaToTs(document, response.content['application/json'].schema) : 'unknown',
        idempotency: isWriteMethod(method),
      });
    }
  }

  const operationMap = operations.map((operation) => `  ${operation.operationId}: { method: ${JSON.stringify(operation.method)}; path: ${JSON.stringify(operation.path)}; request: ${operation.requestType}; response: ${operation.responseType}; idempotent: ${String(operation.idempotency)} };`).join('\n');
  const header = `/* eslint-disable */\n// GENERATED FILE. Source: packages/contracts/openapi/v1/openapi.json\n// Run node scripts/contracts/generate-contracts.mjs after changing the source.\n\n`;
  return `${header}${aliases.join('\n\n')}\n\nexport interface CanonicalIdRegistry {\n${canonical}\n}\n\nexport interface ApiOperationRegistry {\n${operationMap}\n}\n\nexport type ApiOperationId = keyof ApiOperationRegistry;\n`;
}

function generateEventTypes(catalog) {
  const payloadAliases = Object.entries(catalog.payloadSchemas ?? {}).map(([name, schema]) => schemaTypeAlias(name, schema, catalog));
  const usedEventTypeNames = new Set();
  const eventTypeNames = catalog.events.map((event) => {
    const baseName = toEventTypeName(event.eventName);
    if (!usedEventTypeNames.has(baseName)) {
      usedEventTypeNames.add(baseName);
      return baseName;
    }

    const payloadName = event.payloadSchema.$ref.split('/').at(-1);
    const payloadTypeName = toTypeName(payloadName);
    const numericBoundary = payloadTypeName.match(/^B[0-9]+/)?.[0] ?? '';
    const semanticSuffix = payloadTypeName.startsWith(baseName)
      ? payloadTypeName.slice(baseName.length)
      : numericBoundary || payloadTypeName;
    const collisionSuffix = semanticSuffix || 'Variant';
    let candidate = `${baseName}${collisionSuffix}`;
    let variant = 2;
    while (usedEventTypeNames.has(candidate)) candidate = `${baseName}${collisionSuffix}${variant++}`;
    usedEventTypeNames.add(candidate);
    return candidate;
  });
  const baseEnvelopeFields = new Set([
    'eventId', 'eventName', 'schema', 'version', 'occurredAt', 'aggregateType',
    'aggregateId', 'actorId', 'traceId', 'requestId', 'payload',
  ]);
  const envelopeFieldTypes = {
    schemaVersion: 'string',
    dedupeKey: 'string',
    clientEventId: 'string',
    contentVersionId: 'number',
  };
  const eventTypes = catalog.events.map((event, index) => {
    const typeName = eventTypeNames[index];
    const payloadName = event.payloadSchema.$ref.split('/').at(-1);
    const requiredEnvelopeFields = (event['x-envelope-required'] ?? [])
      .filter((field) => !baseEnvelopeFields.has(field))
      .map((field) => `  ${tsPropertyName(field)}: ${envelopeFieldTypes[field] ?? 'string'};`)
      .join('\n');
    return `export interface ${typeName}Event extends PlatformEventEnvelope<${toTypeName(payloadName)}> {\n  eventName: ${JSON.stringify(event.eventName)};\n  version: ${event.version};${requiredEnvelopeFields ? `\n${requiredEnvelopeFields}` : ''}\n}`;
  });
  const header = `/* eslint-disable */\n// GENERATED FILE. Source: packages/contracts/events/v1/catalog.json\n// Run node scripts/contracts/generate-contracts.mjs after changing the source.\n\n`;
  const envelope = `export interface PlatformEventEnvelope<TPayload> {\n  eventId: string;\n  eventName: string;\n  schema: ${JSON.stringify(catalog.envelope.schema)};\n  version: number;\n  occurredAt: string;\n  aggregateType: string;\n  aggregateId: string;\n  actorId: string;\n  traceId: string;\n  requestId: string;\n  schemaVersion?: string;\n  dedupeKey?: string;\n  clientEventId?: string;\n  contentVersionId?: number;\n  payload: TPayload;\n}\n`;
  const canonicalEventEntries = catalog.events
    .map((event, index) => ({ event, typeName: eventTypeNames[index] }))
    .filter(({ event }) => event.status === 'CANONICAL_D2');
  const governanceRegistry = Object.fromEntries(canonicalEventEntries.map(({ event }) => [
    event.eventName,
    event['x-p1r-governance'],
  ]));
  const canonicalUnion = canonicalEventEntries.length > 0
    ? canonicalEventEntries.map(({ typeName }) => `${typeName}Event`).join(' | ')
    : 'never';
  const candidateUnion = eventTypeNames.map((typeName) => `${typeName}Event`).join(' | ');
  return `${header}${envelope}\n${payloadAliases.join('\n\n')}\n\n${eventTypes.join('\n\n')}\n\n/** All catalog entries, including HISTORICAL_CANDIDATE records. New v2 publishers must use CanonicalPlatformEvent. */\nexport type EventCatalogCandidate = ${candidateUnion};\n\n/** @deprecated Use CanonicalPlatformEvent for new v2 event publication. */\nexport type PlatformEvent = EventCatalogCandidate;\n\nexport const canonicalEventGovernance = ${JSON.stringify(governanceRegistry, null, 2)} as const;\n\nexport type CanonicalEventName = keyof typeof canonicalEventGovernance;\nexport type CanonicalPlatformEvent = ${canonicalUnion};\n`;
}

function generateApiClientTypes(document) {
  const operations = [];
  const responseTypes = new Set();
  const schemaNames = new Set(Object.keys(document.components?.schemas ?? {}));
  for (const [route, pathItem] of Object.entries(document.paths ?? {})) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!isHttpMethod(method)) continue;
      const response = Object.values(operation.responses ?? {}).find((candidate) => candidate?.content?.['application/json']?.schema);
      const responseType = response ? schemaToTs(document, response.content['application/json'].schema) : 'unknown';
      const referencedSchemaNames = responseType.match(/\b[A-Za-z_$][A-Za-z0-9_$]*\b/g) ?? [];
      for (const referencedSchemaName of referencedSchemaNames) {
        if (schemaNames.has(referencedSchemaName)) responseTypes.add(referencedSchemaName);
      }
      operations.push(`  ${operation.operationId}: { method: ${JSON.stringify(method.toUpperCase())}; path: ${JSON.stringify(route)}; response: ${responseType}; };`);
    }
  }
  const imports = responseTypes.size > 0 ? `import type { ${[...responseTypes].sort().join(', ')} } from '@englishflow/contracts';\n\n` : '';
  return `/* eslint-disable */\n// GENERATED FILE. Source: packages/contracts/openapi/v1/openapi.json\n\n${imports}export interface GeneratedApiOperationRegistry {\n${operations.join('\n')}\n}\n\nexport type GeneratedApiOperationId = keyof GeneratedApiOperationRegistry;\n`;
}

function generateSchemaRegistry(registry) {
  const header = `/* eslint-disable */
// GENERATED FILE. Source: packages/contracts/schemas/v1/registry.json
// Run node scripts/contracts/generate-contracts.mjs after changing the source.

`;
  return `${header}export const jsonSchemaRegistry = ${JSON.stringify(registry.schemas, null, 2)} as const;

export type JsonSchemaId = keyof typeof jsonSchemaRegistry;
`;
}

export function buildGeneratedOutputs({ contractsOnly = false } = {}) {
  validateContracts({ quiet: true });
  const openApi = readJson(openApiPath);
  const catalog = readJson(eventCatalogPath);
  const schemaRegistry = readJson(schemaRegistryPath);
  const outputs = [
    { path: path.join(contractsGeneratedDir, 'openapi.ts'), contents: normalizedContents(generateOpenApiTypes(openApi)) },
    { path: path.join(contractsGeneratedDir, 'events.ts'), contents: normalizedContents(generateEventTypes(catalog)) },
    { path: path.join(contractsGeneratedDir, 'schemas.ts'), contents: normalizedContents(generateSchemaRegistry(schemaRegistry)) },
    { path: path.join(contractsGeneratedDir, 'index.ts'), contents: normalizedContents(`export * from './openapi';\nexport * from './events';\nexport * from './schemas';`) },
  ];
  if (!contractsOnly) {
    outputs.push({ path: path.join(apiClientGeneratedDir, 'index.ts'), contents: normalizedContents(generateApiClientTypes(openApi)) });
  }
  return outputs;
}

export function findGeneratedOutputDrift(outputs, { readFile = (filePath) => fs.readFileSync(filePath, 'utf8') } = {}) {
  const drift = [];
  for (const output of outputs) {
    try {
      if (readFile(output.path) !== output.contents) drift.push(output.path);
    } catch {
      drift.push(output.path);
    }
  }
  return drift;
}

export function generateContracts({ write = true, contractsOnly = false } = {}) {
  const generatedOutputs = buildGeneratedOutputs({ contractsOnly });
  if (write) {
    for (const output of generatedOutputs) writeFile(output.path, output.contents);
  } else {
    const drift = findGeneratedOutputDrift(generatedOutputs);
    if (drift.length > 0) {
      throw new Error(`Generated contract drift detected in ${drift.map((filePath) => path.relative(repoRoot, filePath)).join(', ')}. Run pnpm contracts:generate to write generated outputs.`);
    }
  }
  return {
    outputs: generatedOutputs.map((output) => output.path),
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  try {
    if (process.argv.includes('--help')) {
      console.log('Usage: node scripts/contracts/generate-contracts.mjs [--check] [--contracts-only]');
      process.exit(0);
    }
    const check = process.argv.includes('--check');
    const result = generateContracts({ write: !check, contractsOnly: process.argv.includes('--contracts-only') });
    console.log(`Contract generation ${check ? 'checked' : 'passed'}: ${result.outputs.length} generated files.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
