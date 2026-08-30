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
  if (!schema?.nullable || /(?:^|[ (])null(?:$|[ )|])/.test(typeName)) return typeName;
  return `${typeName} | null`;
}

function schemaBaseToTs(document, schema) {
  if (Array.isArray(schema.type)) {
    const types = schema.type.map((type) => schemaBaseToTs(document, { ...schema, type }));
    return [...new Set(types)].join(' | ') || 'unknown';
  }

  if (Array.isArray(schema.enum)) {
    return schema.enum.map(tsLiteral).join(' | ') || 'never';
  }

  if (Object.hasOwn(schema, 'const')) {
    return tsLiteral(schema.const);
  }

  if (schema.type === 'array' || (schema.type === undefined && schema.items !== undefined)) {
    const itemType = schemaToTs(document, schema.items ?? {});
    return `ReadonlyArray<${itemType}>`;
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
    return objectType;
  }

  if (schema.type === 'integer' || schema.type === 'number') return 'number';
  if (schema.type === 'boolean') return 'boolean';
  if (schema.type === 'string') return 'string';
  if (schema.type === 'null') return 'null';

  return 'unknown';
}

function parenthesizeComposition(typeName) {
  return typeName.includes(' | ') ? `(${typeName})` : typeName;
}

function compositionVariantToTs(document, variant, parentSchema) {
  if (!variant || typeof variant !== 'object' || variant.$ref) return schemaToTs(document, variant);
  const parentProperties = parentSchema?.properties ?? {};
  const variantProperties = variant.properties ?? {};
  const parentRequired = new Set(parentSchema?.required ?? []);
  const variantRequired = new Set(variant.required ?? []);
  for (const field of Object.keys(variantProperties)) {
    if (parentRequired.has(field)) variantRequired.add(field);
  }
  const inheritedRequiredProperties = {};
  for (const field of variantRequired) {
    if (!Object.hasOwn(variantProperties, field) && Object.hasOwn(parentProperties, field)) {
      inheritedRequiredProperties[field] = parentProperties[field];
    }
  }
  const forbiddenFields = [];
  const forbiddenClauses = Array.isArray(variant.not?.anyOf)
    ? variant.not.anyOf
    : variant.not?.required ? [variant.not] : [];
  for (const clause of forbiddenClauses) {
    if (Array.isArray(clause?.required) && clause.required.length === 1) {
      forbiddenFields.push(clause.required[0]);
    }
  }
  const forbiddenProperties = {};
  for (const field of forbiddenFields) {
    if (!Object.hasOwn(variantProperties, field) && Object.hasOwn(parentProperties, field)) {
      // An empty enum is the internal schema representation of TypeScript
      // never. The source schema remains untouched; this only projects the
      // common `not: { required: [...] }` pattern into `field?: never`.
      forbiddenProperties[field] = { enum: [] };
    }
  }
  if (Object.keys(inheritedRequiredProperties).length === 0
    && Object.keys(forbiddenProperties).length === 0
    && variantRequired.size === (variant.required ?? []).length) {
    return schemaToTs(document, variant);
  }
  return schemaToTs(document, {
    ...variant,
    required: [...variantRequired],
    properties: { ...inheritedRequiredProperties, ...forbiddenProperties, ...variantProperties },
  });
}

export function schemaToTs(document, schema) {
  if (!schema || typeof schema !== 'object') return 'unknown';

  if (schema.$ref) {
    return addNullable(referenceName(schema.$ref), schema);
  }

  const baseType = schemaBaseToTs(document, schema);
  if (Array.isArray(schema.oneOf) || Array.isArray(schema.anyOf)) {
    const variants = schema.oneOf ?? schema.anyOf;
    const variantTypes = variants.map((variant) => compositionVariantToTs(document, variant, schema));
    let composedType;
    if (baseType !== 'unknown') {
      // Constraint-only branches (for example array cardinality expressed with
      // minItems/not) cannot be represented faithfully in TypeScript. Preserve
      // the shared wire shape instead of widening the generated type to unknown
      // or incorrectly narrowing it to the only representable branch.
      composedType = variantTypes.some((typeName) => typeName === 'unknown')
        ? baseType
        : `${parenthesizeComposition(baseType)} & (${variantTypes.join(' | ') || 'unknown'})`;
    } else {
      composedType = variantTypes.join(' | ') || 'unknown';
    }
    return addNullable(composedType, schema);
  }

  if (Array.isArray(schema.allOf)) {
    const variantTypes = schema.allOf
      .map((variant) => schemaToTs(document, variant))
      .filter((typeName) => typeName !== 'unknown');
    const parts = baseType === 'unknown' ? variantTypes : [baseType, ...variantTypes];
    const intersection = parts.map(parenthesizeComposition).join(' & ') || 'unknown';
    return addNullable(intersection, schema);
  }

  return addNullable(baseType, schema);
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
