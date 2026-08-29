import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { isHttpMethod, isRecord, readJson, resolveJsonPointer } from './schema-utils.mjs';
import { validateEventPayloadSchemas } from './event-catalog-policy.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..', '..');
const defaults = {
  openapi: path.join(repoRoot, 'packages', 'contracts', 'openapi', 'v1', 'openapi.json'),
  events: path.join(repoRoot, 'packages', 'contracts', 'events', 'v1', 'catalog.json'),
  schema: path.join(repoRoot, 'packages', 'contracts', 'schemas', 'v1', 'registry.json'),
};

function parseArgs(argv) {
  const args = { kind: 'openapi', json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--json') args.json = true;
    else if (value === '--help') args.help = true;
    else if (value === '--kind') args.kind = argv[++index];
    else if (value === '--baseline') args.baseline = argv[++index];
    else if (value === '--current') args.current = argv[++index];
    else throw new Error(`Unknown argument: ${value}`);
  }
  return args;
}

function resolveInput(value, kind, flag) {
  if (!(kind in defaults)) throw new Error(`Unsupported contract kind: ${kind}`);
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Compatibility ${flag} is required; pass both --baseline <old.json> and --current <new.json>.`);
  }
  return path.resolve(repoRoot, value);
}

function describeChange(kind, location, reason) {
  return { kind, location, reason };
}

function normalizedTypes(type) {
  if (type === undefined) return null;
  const values = Array.isArray(type) ? type : [type];
  return [...new Set(values.map((value) => String(value)))].sort();
}

function sameTypes(previous, current) {
  return previous.length === current.length && previous.every((value, index) => value === current[index]);
}

function compareSchema(previous, current, location, changes, kind) {
  if (!isRecord(previous)) return;
  if (!isRecord(current)) {
    changes.push(describeChange(kind, location, 'existing schema definition was removed or is no longer an object'));
    return;
  }

  const previousTypes = normalizedTypes(previous.type);
  const currentTypes = normalizedTypes(current.type);
  if ((previousTypes || currentTypes) && (!previousTypes || !currentTypes || !sameTypes(previousTypes, currentTypes))) {
    changes.push(describeChange(kind, location, `type changed from ${previousTypes?.join(',') ?? '<unspecified>'} to ${currentTypes?.join(',') ?? '<unspecified>'}`));
  }

  const previousEnum = Array.isArray(previous.enum) ? previous.enum : null;
  const currentEnum = Array.isArray(current.enum) ? current.enum : null;
  if (previousEnum && currentEnum) {
    const previousValues = new Map(previousEnum.map((value) => [stableGovernanceValue(value), value]));
    const currentValues = new Map(currentEnum.map((value) => [stableGovernanceValue(value), value]));
    for (const [stableValue, value] of previousValues) {
      if (!currentValues.has(stableValue)) {
        changes.push(describeChange(kind, `${location}.enum`, `existing enum value removed: ${String(value)}`));
      }
    }
    for (const [stableValue, value] of currentValues) {
      if (!previousValues.has(stableValue)) {
        changes.push(describeChange(kind, `${location}.enum`, `new enum value added: ${String(value)}`));
      }
    }
  } else if (previousEnum || currentEnum) {
    changes.push(describeChange(kind, `${location}.enum`, `enum contract changed from ${previousEnum ? 'specified' : 'unspecified'} to ${currentEnum ? 'specified' : 'unspecified'}`));
  }

  const previousRequired = new Set(Array.isArray(previous.required) ? previous.required : []);
  const currentRequired = new Set(Array.isArray(current.required) ? current.required : []);
  for (const field of currentRequired) {
    if (!previousRequired.has(field)) changes.push(describeChange(kind, `${location}.required`, `new required field: ${field}`));
  }
  for (const field of previousRequired) {
    if (!currentRequired.has(field)) changes.push(describeChange(kind, `${location}.required`, `existing required field removed: ${field}`));
  }

  if (isRecord(previous.additionalProperties) && isRecord(current.additionalProperties)) {
    compareSchema(previous.additionalProperties, current.additionalProperties, `${location}.additionalProperties`, changes, kind);
  } else if (stableGovernanceValue(previous.additionalProperties) !== stableGovernanceValue(current.additionalProperties)) {
    changes.push(describeChange(kind, `${location}.additionalProperties`, 'additionalProperties policy changed'));
  }

  const exactKeywords = [
    '$id', '$schema', '$ref', 'title', 'description', 'default', 'examples',
    'deprecated', 'readOnly', 'writeOnly', 'nullable', 'pattern', 'format',
    'const', 'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum',
    'minLength', 'maxLength', 'minItems', 'maxItems', 'minProperties',
    'maxProperties', 'uniqueItems',
  ];
  for (const keyword of exactKeywords) {
    if (stableGovernanceValue(previous[keyword]) !== stableGovernanceValue(current[keyword])) {
      changes.push(describeChange(kind, `${location}.${keyword}`, `${keyword} contract changed`));
    }
  }

  if (previous.items !== undefined || current.items !== undefined) {
    if (isRecord(previous.items) && isRecord(current.items)) {
      compareSchema(previous.items, current.items, `${location}.items`, changes, kind);
    } else if (stableGovernanceValue(previous.items) !== stableGovernanceValue(current.items)) {
      changes.push(describeChange(kind, `${location}.items`, 'items contract changed'));
    }
  }
  for (const keyword of ['oneOf', 'anyOf', 'allOf', 'not']) {
    if (stableGovernanceValue(previous[keyword]) !== stableGovernanceValue(current[keyword])) {
      changes.push(describeChange(kind, `${location}.${keyword}`, `${keyword} contract changed`));
    }
  }

  const knownKeywords = new Set([
    'type', 'enum', 'required', 'additionalProperties', 'properties', 'items',
    'oneOf', 'anyOf', 'allOf', 'not', ...exactKeywords,
  ]);
  const unknownKeywords = new Set([...Object.keys(previous), ...Object.keys(current)]
    .filter((keyword) => !knownKeywords.has(keyword)));
  for (const keyword of unknownKeywords) {
    if (stableGovernanceValue(previous[keyword]) !== stableGovernanceValue(current[keyword])) {
      changes.push(describeChange(kind, `${location}.${keyword}`, 'unknown schema keyword or extension changed'));
    }
  }

  const previousProperties = isRecord(previous.properties) ? previous.properties : {};
  const currentProperties = isRecord(current.properties) ? current.properties : {};
  for (const [field, previousProperty] of Object.entries(previousProperties)) {
    if (!(field in currentProperties)) {
      changes.push(describeChange(kind, `${location}.properties.${field}`, 'existing property removed'));
      continue;
    }
    compareSchema(previousProperty, currentProperties[field], `${location}.properties.${field}`, changes, kind);
  }
}

function resolveMaybe(document, value) {
  return isRecord(value) && typeof value.$ref === 'string' ? resolveJsonPointer(document, value.$ref) : value;
}

function stableGovernanceValue(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableGovernanceValue).join(',')}]`;
  }
  if (isRecord(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableGovernanceValue(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function duplicateEventNames(events) {
  const seen = new Set();
  const duplicates = new Set();
  for (const event of events ?? []) {
    if (seen.has(event?.eventName)) duplicates.add(event?.eventName);
    seen.add(event?.eventName);
  }
  return [...duplicates].sort();
}

function compareOpenApi(previous, current) {
  const changes = [];
  const previousSecuritySchemes = previous.components?.securitySchemes ?? {};
  const currentSecuritySchemes = current.components?.securitySchemes ?? {};
  for (const [name, previousScheme] of Object.entries(previousSecuritySchemes)) {
    if (!(name in currentSecuritySchemes)) {
      changes.push(describeChange('openapi', `components.securitySchemes.${name}`, 'existing security scheme removed'));
      continue;
    }
    const currentScheme = currentSecuritySchemes[name];
    for (const field of ['type', 'scheme', 'bearerFormat', 'openIdConnectUrl']) {
      if (previousScheme?.[field] !== undefined && currentScheme?.[field] !== previousScheme[field]) {
        changes.push(describeChange('openapi', `components.securitySchemes.${name}.${field}`, `security scheme ${field} changed`));
      }
    }
  }
  const previousPaths = isRecord(previous.paths) ? previous.paths : {};
  const currentPaths = isRecord(current.paths) ? current.paths : {};
  for (const [route, previousPath] of Object.entries(previousPaths)) {
    if (!(route in currentPaths)) {
      changes.push(describeChange('openapi', route, 'existing route removed'));
      continue;
    }
    for (const [method, previousOperation] of Object.entries(previousPath)) {
      if (!isHttpMethod(method)) continue;
      const currentOperation = currentPaths[route]?.[method];
      if (!currentOperation) {
        changes.push(describeChange('openapi', `${method.toUpperCase()} ${route}`, 'existing operation removed'));
        continue;
      }
      const previousSecurity = Array.isArray(previousOperation.security) ? previousOperation.security : null;
      const currentSecurity = Array.isArray(currentOperation.security) ? currentOperation.security : null;
      if (previousSecurity && previousSecurity.length > 0 && (!currentSecurity || currentSecurity.length === 0)) {
        changes.push(describeChange('openapi', `${method.toUpperCase()} ${route}.security`, 'authenticated operation became public'));
      } else if (previousSecurity && currentSecurity) {
        const previousSchemes = new Set(previousSecurity.flatMap((requirement) => Object.keys(requirement ?? {})));
        const currentSchemes = new Set(currentSecurity.flatMap((requirement) => Object.keys(requirement ?? {})));
        for (const scheme of previousSchemes) {
          if (!currentSchemes.has(scheme)) changes.push(describeChange('openapi', `${method.toUpperCase()} ${route}.security`, `existing security scheme requirement removed: ${scheme}`));
        }
      }
      const previousRequest = resolveMaybe(previous, previousOperation.requestBody?.content?.['application/json']?.schema);
      const currentRequest = resolveMaybe(current, currentOperation.requestBody?.content?.['application/json']?.schema);
      if (previousRequest && currentRequest) compareSchema(previousRequest, currentRequest, `${method.toUpperCase()} ${route}.request`, changes, 'openapi');
      const previousResponses = isRecord(previousOperation.responses) ? previousOperation.responses : {};
      const currentResponses = isRecord(currentOperation.responses) ? currentOperation.responses : {};
      for (const status of Object.keys(previousResponses)) {
        if (!(status in currentResponses)) changes.push(describeChange('openapi', `${method.toUpperCase()} ${route}.responses.${status}`, 'existing response removed'));
      }
    }
  }

  const previousSchemas = previous.components?.schemas ?? {};
  const currentSchemas = current.components?.schemas ?? {};
  for (const [name, previousSchema] of Object.entries(previousSchemas)) {
    if (!(name in currentSchemas)) {
      changes.push(describeChange('openapi', `components.schemas.${name}`, 'existing schema removed'));
      continue;
    }
    compareSchema(previousSchema, currentSchemas[name], `components.schemas.${name}`, changes, 'openapi');
  }
  return changes;
}

function compareEvents(previous, current) {
  const changes = [];
  for (const error of validateEventPayloadSchemas(current.payloadSchemas)) {
    changes.push(describeChange('events', 'payloadSchemas', error));
  }
  for (const field of [
    'catalogVersion',
    'schema',
    'description',
    'x-v2-event-platform',
    'envelope',
    'compatibilityPolicy',
    'forbiddenPayloadFieldPatterns',
  ]) {
    if (previous[field] !== undefined
      && stableGovernanceValue(previous[field]) !== stableGovernanceValue(current[field])) {
      changes.push(describeChange('events', field, `established event catalog ${field} changed`));
    }
  }
  for (const eventName of duplicateEventNames(previous.events)) {
    changes.push(describeChange('events', `${eventName}.eventName`, 'baseline contains a duplicate event name'));
  }
  for (const eventName of duplicateEventNames(current.events)) {
    changes.push(describeChange('events', `${eventName}.eventName`, 'current catalog contains a duplicate event name'));
  }
  const previousEvents = new Map((previous.events ?? []).map((event) => [event.eventName, event]));
  const currentEvents = new Map((current.events ?? []).map((event) => [event.eventName, event]));
  for (const [eventName, previousEvent] of previousEvents) {
    const currentEvent = currentEvents.get(eventName);
    if (!currentEvent) {
      changes.push(describeChange('events', eventName, 'existing event removed'));
      continue;
    }
    if (Number(previousEvent.version) !== Number(currentEvent.version)) {
      changes.push(describeChange('events', eventName, 'event version changed without a new event name'));
    }
    for (const field of ['domain', 'schema', 'aggregateType', 'aggregateIdField']) {
      if (previousEvent[field] !== undefined && currentEvent[field] !== previousEvent[field]) {
        changes.push(describeChange('events', `${eventName}.${field}`, `existing event ${field} changed`));
      }
    }
    if (previousEvent.payloadSchema?.$ref !== undefined && currentEvent.payloadSchema?.$ref !== previousEvent.payloadSchema.$ref) {
      changes.push(describeChange('events', `${eventName}.payloadSchema.$ref`, 'existing payload schema identity changed'));
    }
    if (previousEvent.compatibility !== undefined
      && stableGovernanceValue(previousEvent.compatibility) !== stableGovernanceValue(currentEvent.compatibility)) {
      changes.push(describeChange('events', `${eventName}.compatibility`, 'existing compatibility policy changed'));
    }
    const previousEnvelopeRequired = new Set(previousEvent['x-envelope-required'] ?? []);
    const currentEnvelopeRequired = new Set(currentEvent['x-envelope-required'] ?? []);
    for (const field of previousEnvelopeRequired) {
      if (!currentEnvelopeRequired.has(field)) changes.push(describeChange('events', `${eventName}.x-envelope-required`, `existing required envelope field removed: ${field}`));
    }
    for (const field of currentEnvelopeRequired) {
      if (!previousEnvelopeRequired.has(field)) changes.push(describeChange('events', `${eventName}.x-envelope-required`, `new required envelope field: ${field}`));
    }
    const previousPayload = resolveMaybe(previous, previousEvent.payloadSchema);
    const currentPayload = resolveMaybe(current, currentEvent.payloadSchema);
    compareSchema(previousPayload, currentPayload, `${eventName}.payload`, changes, 'events');

    if (previousEvent.status !== undefined && currentEvent.status !== previousEvent.status) {
      changes.push(describeChange('events', `${eventName}.status`, `event governance status changed from ${String(previousEvent.status)} to ${String(currentEvent.status)}`));
    }
    const previousGovernance = previousEvent['x-p1r-governance'];
    const currentGovernance = currentEvent['x-p1r-governance'];
    if (previousGovernance !== undefined && currentGovernance === undefined) {
      changes.push(describeChange('events', `${eventName}.x-p1r-governance`, 'existing event governance was removed'));
    } else if (previousGovernance !== undefined && currentGovernance !== undefined
      && stableGovernanceValue(previousGovernance) !== stableGovernanceValue(currentGovernance)) {
      changes.push(describeChange('events', `${eventName}.x-p1r-governance`, 'producer, owner, consumer, transport, schema or correlation governance changed'));
    }
  }

  const previousPlatformGovernance = previous['x-p1r-event-governance'];
  const currentPlatformGovernance = current['x-p1r-event-governance'];
  if (previousPlatformGovernance !== undefined && currentPlatformGovernance === undefined) {
    changes.push(describeChange('events', 'x-p1r-event-governance', 'platform event governance was removed'));
  } else if (previousPlatformGovernance !== undefined && currentPlatformGovernance !== undefined
    && stableGovernanceValue(previousPlatformGovernance) !== stableGovernanceValue(currentPlatformGovernance)) {
    changes.push(describeChange('events', 'x-p1r-event-governance', 'established platform event governance changed'));
  }
  if (previousPlatformGovernance !== undefined
    && stableGovernanceValue(previous.asyncapi) !== stableGovernanceValue(current.asyncapi)) {
    changes.push(describeChange('events', 'asyncapi', 'established canonical AsyncAPI projection changed'));
  }
  return changes;
}

function compareSchemaRegistry(previous, current) {
  const changes = [];
  const previousSchemas = previous.schemas ?? {};
  const currentSchemas = current.schemas ?? {};
  for (const [schemaId, previousSchema] of Object.entries(previousSchemas)) {
    if (!(schemaId in currentSchemas)) {
      changes.push(describeChange('schema', schemaId, 'existing JSON Schema removed'));
      continue;
    }
    compareSchema(previousSchema, currentSchemas[schemaId], schemaId, changes, 'schema');
  }
  return changes;
}

export function compareContracts(kind, previous, current) {
  if (kind === 'openapi') return compareOpenApi(previous, current);
  if (kind === 'events') return compareEvents(previous, current);
  if (kind === 'schema') return compareSchemaRegistry(previous, current);
  throw new Error(`Unsupported contract kind: ${kind}`);
}

export function runCompatibilityDiff({ kind = 'openapi', baseline, current } = {}) {
  const baselinePath = resolveInput(baseline, kind, '--baseline');
  const currentPath = resolveInput(current, kind, '--current');
  if (baselinePath === currentPath) {
    throw new Error('Compatibility --baseline and --current must resolve to different files.');
  }
  const previous = readJson(baselinePath);
  const next = readJson(currentPath);
  const breakingChanges = compareContracts(kind, previous, next);
  return { kind, baseline: baselinePath, current: currentPath, breakingChanges, compatible: breakingChanges.length === 0 };
}

function printHelp() {
  console.log('Usage: node scripts/contracts/compatibility-diff.mjs --kind openapi|events|schema --baseline <old.json> --current <new.json> [--json]');
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      printHelp();
      process.exit(0);
    }
    const result = runCompatibilityDiff(args);
    if (args.json) console.log(JSON.stringify(result, null, 2));
    else console.log(`Contract compatibility ${result.compatible ? 'passed' : 'failed'}: ${result.kind}, ${result.breakingChanges.length} breaking change(s).`);
    if (!result.compatible) process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
