import { readFileSync } from 'node:fs';

export function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

export function resolveJsonPointer(document, reference) {
  if (typeof reference !== 'string' || !reference.startsWith('#/')) {
    throw new Error(`Only local JSON references are supported: ${String(reference)}`);
  }

  return reference
    .slice(2)
    .split('/')
    .map((part) => part.replaceAll('~1', '/').replaceAll('~0', '~'))
    .reduce((current, part) => {
      if (current === undefined || current === null || !(part in current)) {
        throw new Error(`Unresolved JSON reference: ${reference}`);
      }
      return current[part];
    }, document);
}

export function dereference(document, schema, maxDepth = 24) {
  let current = schema;
  let depth = 0;
  while (current && typeof current === 'object' && current.$ref) {
    if (depth >= maxDepth) {
      throw new Error(`Reference depth exceeded while resolving ${current.$ref}`);
    }
    current = resolveJsonPointer(document, current.$ref);
    depth += 1;
  }
  return current;
}

export function referenceName(reference) {
  if (typeof reference !== 'string') {
    return 'Unknown';
  }
  const last = reference.split('/').at(-1) ?? 'Unknown';
  return toTypeName(last);
}

export function toTypeName(value) {
  const normalized = String(value)
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join('');
  return /^[A-Za-z_]/.test(normalized) ? normalized : `Type${normalized}`;
}

export function toEventTypeName(eventName) {
  return toTypeName(eventName.replace(/\.v[0-9]+$/, ''));
}

export function quoteTs(value) {
  return JSON.stringify(value);
}

export function tsPropertyName(value) {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value) ? value : quoteTs(value);
}

export function tsLiteral(value) {
  if (typeof value === 'string') return quoteTs(value);
  if (value === null) return 'null';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return 'unknown';
}

function addNullable(typeName, schema) {
  return schema?.nullable ? `${typeName} | null` : typeName;
}

export function schemaToTs(document, schema) {
  if (!schema || typeof schema !== 'object') return 'unknown';

  if (schema.$ref) {
    return addNullable(referenceName(schema.$ref), schema);
  }

  if (Array.isArray(schema.oneOf) || Array.isArray(schema.anyOf)) {
    const variants = schema.oneOf ?? schema.anyOf;
    const union = variants.map((variant) => schemaToTs(document, variant)).join(' | ') || 'unknown';
    return addNullable(union, schema);
  }

  if (Array.isArray(schema.allOf)) {
    const intersection = schema.allOf.map((variant) => schemaToTs(document, variant)).join(' & ') || 'unknown';
    return addNullable(intersection, schema);
  }

  if (Array.isArray(schema.enum)) {
    const enumType = schema.enum.map(tsLiteral).join(' | ') || 'never';
    return addNullable(enumType, schema);
  }

  if (Object.hasOwn(schema, 'const')) {
    return addNullable(tsLiteral(schema.const), schema);
  }

  if (schema.type === 'array') {
    const itemType = schemaToTs(document, schema.items ?? {});
    return addNullable(`ReadonlyArray<${itemType}>`, schema);
  }

  if (schema.type === 'object' || schema.properties || schema.additionalProperties !== undefined) {
    const properties = schema.properties ?? {};
    const required = new Set(schema.required ?? []);
    const fields = Object.entries(properties).map(([name, propertySchema]) => {
      const optional = required.has(name) ? '' : '?';
      return `${tsPropertyName(name)}${optional}: ${schemaToTs(document, propertySchema)};`;
    });

    if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
      fields.push(`[key: string]: ${schemaToTs(document, schema.additionalProperties)};`);
    } else if (schema.additionalProperties === true) {
      fields.push('[key: string]: unknown;');
    }

    const objectType = fields.length > 0 ? `{ ${fields.join(' ')} }` : 'Record<string, never>';
    return addNullable(objectType, schema);
  }

  if (schema.type === 'integer' || schema.type === 'number') return addNullable('number', schema);
  if (schema.type === 'boolean') return addNullable('boolean', schema);
  if (schema.type === 'string') return addNullable('string', schema);
  if (schema.type === 'null') return 'null';

  return 'unknown';
}

export function schemaDescription(schema) {
  if (!schema || typeof schema.description !== 'string') return [];
  return schema.description
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => ` * ${line.replaceAll('*/', '*\\/')}`);
}

export function collectReferences(value, references = new Set()) {
  if (!value || typeof value !== 'object') return references;
  if (value.$ref) references.add(value.$ref);
  for (const child of Object.values(value)) collectReferences(child, references);
  return references;
}

export function isWriteMethod(method) {
  return ['post', 'put', 'patch', 'delete'].includes(method.toLowerCase());
}

export function isHttpMethod(value) {
  return ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace'].includes(value.toLowerCase());
}

export function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
