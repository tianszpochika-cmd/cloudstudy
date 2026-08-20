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
const contractsGeneratedDir = path.join(repoRoot, 'packages', 'contracts', 'generated');
const apiClientGeneratedDir = path.join(repoRoot, 'packages', 'api-client', 'src', 'generated');

function writeFile(filePath, contents) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${contents.trimEnd()}\n`, 'utf8');
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
  const eventTypes = catalog.events.map((event) => {
    const typeName = toEventTypeName(event.eventName);
    const payloadName = event.payloadSchema.$ref.split('/').at(-1);
    return `export interface ${typeName}Event extends PlatformEventEnvelope<${toTypeName(payloadName)}> {\n  eventName: ${JSON.stringify(event.eventName)};\n  version: ${event.version};\n}`;
  });
  const header = `/* eslint-disable */\n// GENERATED FILE. Source: packages/contracts/events/v1/catalog.json\n// Run node scripts/contracts/generate-contracts.mjs after changing the source.\n\n`;
  const envelope = `export interface PlatformEventEnvelope<TPayload> {\n  eventId: string;\n  eventName: string;\n  schema: ${JSON.stringify(catalog.envelope.schema)};\n  version: number;\n  occurredAt: string;\n  aggregateType: string;\n  aggregateId: string;\n  actorId: string;\n  traceId: string;\n  requestId: string;\n  clientEventId?: string;\n  contentVersionId?: number;\n  payload: TPayload;\n}\n`;
  return `${header}${envelope}\n${payloadAliases.join('\n\n')}\n\n${eventTypes.join('\n\n')}\n\nexport type PlatformEvent = ${catalog.events.map((event) => `${toEventTypeName(event.eventName)}Event`).join(' | ')};\n`;
}

function generateApiClientTypes(document) {
  const operations = [];
  const responseTypes = new Set();
  for (const [route, pathItem] of Object.entries(document.paths ?? {})) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!isHttpMethod(method)) continue;
      const response = Object.values(operation.responses ?? {}).find((candidate) => candidate?.content?.['application/json']?.schema);
      const responseType = response ? schemaToTs(document, response.content['application/json'].schema) : 'unknown';
      if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(responseType)) responseTypes.add(responseType);
      operations.push(`  ${operation.operationId}: { method: ${JSON.stringify(method.toUpperCase())}; path: ${JSON.stringify(route)}; response: ${responseType}; };`);
    }
  }
  const imports = responseTypes.size > 0 ? `import type { ${[...responseTypes].sort().join(', ')} } from '@englishflow/contracts';\n\n` : '';
  return `/* eslint-disable */\n// GENERATED FILE. Source: packages/contracts/openapi/v1/openapi.json\n\n${imports}export interface GeneratedApiOperationRegistry {\n${operations.join('\n')}\n}\n\nexport type GeneratedApiOperationId = keyof GeneratedApiOperationRegistry;\n`;
}

export function generateContracts() {
  validateContracts({ quiet: true });
  const openApi = readJson(openApiPath);
  const catalog = readJson(eventCatalogPath);
  writeFile(path.join(contractsGeneratedDir, 'openapi.ts'), generateOpenApiTypes(openApi));
  writeFile(path.join(contractsGeneratedDir, 'events.ts'), generateEventTypes(catalog));
  writeFile(path.join(contractsGeneratedDir, 'index.ts'), `export * from './openapi';\nexport * from './events';`);
  writeFile(path.join(apiClientGeneratedDir, 'index.ts'), generateApiClientTypes(openApi));
  return {
    outputs: [
      path.join(contractsGeneratedDir, 'openapi.ts'),
      path.join(contractsGeneratedDir, 'events.ts'),
      path.join(contractsGeneratedDir, 'index.ts'),
      path.join(apiClientGeneratedDir, 'index.ts'),
    ],
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  try {
    if (process.argv.includes('--help')) {
      console.log('Usage: node scripts/contracts/generate-contracts.mjs');
      process.exit(0);
    }
    const result = generateContracts();
    console.log(`Contract generation passed: ${result.outputs.length} generated files.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
