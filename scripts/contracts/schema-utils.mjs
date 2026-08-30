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

function singleFieldNotRequiredClauses(schema) {
  const clauses = Array.isArray(schema?.not?.anyOf)
    ? schema.not.anyOf
    : Array.isArray(schema?.not?.required) ? [schema.not] : [];
  return [...new Set(clauses.flatMap((clause) => (
    Array.isArray(clause?.required) && clause.required.length === 1 ? clause.required : []
  )))];
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

  if (schema.type === 'array'
    || (schema.type === undefined
      && (schema.items !== undefined
        || schema.prefixItems !== undefined
        || schema.minItems !== undefined
        || schema.maxItems !== undefined))) {
    if (Array.isArray(schema.prefixItems)) {
      const prefixTypes = schema.prefixItems.map((item) => schemaToTs(document, item));
      if (schema.items === false) {
        return prefixTypes.length === 0
          ? 'readonly []'
          : `readonly [${prefixTypes.join(', ')}]`;
      }
      const remainingItemType = schema.items && typeof schema.items === 'object'
        ? schemaToTs(document, schema.items)
        : 'unknown';
      return prefixTypes.length === 0
        ? `ReadonlyArray<${remainingItemType}>`
        : `readonly [${prefixTypes.join(', ')}, ...Array<${remainingItemType}>]`;
    }
    const itemType = schemaToTs(document, schema.items ?? {});
    const minimumItems = Number.isSafeInteger(schema.minItems) && schema.minItems >= 0
      ? schema.minItems
      : 0;
    const maximumItems = Number.isSafeInteger(schema.maxItems) && schema.maxItems >= 0
      ? schema.maxItems
      : undefined;
    const tupleForLength = (length) => (
      length === 0
        ? 'readonly []'
        : `readonly [${Array.from({ length }, () => itemType).join(', ')}]`
    );
    if (maximumItems !== undefined
      && maximumItems >= minimumItems
      && maximumItems <= 32
      && maximumItems - minimumItems <= 16) {
      return Array.from(
        { length: maximumItems - minimumItems + 1 },
        (_, offset) => tupleForLength(minimumItems + offset),
      ).join(' | ');
    }
    if (minimumItems > 0 && minimumItems <= 32) {
      const requiredItems = Array.from({ length: minimumItems }, () => itemType);
      return `readonly [${requiredItems.join(', ')}, ...Array<${itemType}>]`;
    }
    return `ReadonlyArray<${itemType}>`;
  }

  if (schema.type === 'object' || schema.properties || schema.additionalProperties !== undefined) {
    const properties = { ...(schema.properties ?? {}) };
    for (const field of singleFieldNotRequiredClauses(schema)) {
      // Project the common JSON Schema `not: { required: [field] }` safeguard
      // into a structural TypeScript constraint too. This matters for values
      // assembled through variables or object spread, where excess-property
      // checks alone cannot prevent client-owned authority fields.
      properties[field] = { enum: [] };
    }
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

function mergeProjectionPropertySchema(document, parentProperty, variantProperty) {
  if (!parentProperty || typeof parentProperty !== 'object' || Array.isArray(parentProperty)) {
    return variantProperty;
  }
  if (!variantProperty || typeof variantProperty !== 'object' || Array.isArray(variantProperty)) {
    return variantProperty;
  }
  if (variantProperty.$ref) return variantProperty;
  if (Array.isArray(variantProperty.allOf)
    || Array.isArray(variantProperty.oneOf)
    || Array.isArray(variantProperty.anyOf)) {
    // A branch-local composition already carries its own shared reference and
    // narrowing constraints. Keeping a parent `$ref` beside it would make the
    // early reference projection discard the branch narrowing.
    return variantProperty;
  }

  const resolvedParentProperty = parentProperty.$ref
    ? {
        ...dereference(document, parentProperty),
        ...Object.fromEntries(Object.entries(parentProperty).filter(([key]) => key !== '$ref')),
      }
    : parentProperty;

  // Constraint-only branches commonly restate only `minimum`, `minItems`,
  // `maxItems`, `enum` or `const`. Preserve the shared property's wire type
  // and item schema while applying those narrower branch constraints.
  const merged = { ...resolvedParentProperty, ...variantProperty };
  if (Object.hasOwn(variantProperty, 'const')) delete merged.enum;
  if (Object.hasOwn(variantProperty, 'enum')) delete merged.const;
  if (!Object.hasOwn(variantProperty, 'nullable')
    && (Object.hasOwn(variantProperty, 'type')
      || Object.hasOwn(variantProperty, 'const')
      || Object.hasOwn(variantProperty, 'enum'))) {
    // A branch that explicitly narrows the JSON value kind also narrows an
    // OpenAPI 3.0 parent `nullable: true` unless it opts back in itself.
    delete merged.nullable;
  }
  return merged;
}

function mergeProjectionObjectSchemas(document, schemas) {
  const merged = { properties: {}, required: [] };
  const required = new Set();
  let hasObjectShape = false;
  for (const candidate of schemas) {
    if (!candidate || typeof candidate !== 'object') continue;
    const resolved = candidate.$ref ? dereference(document, candidate) : candidate;
    if (!resolved || typeof resolved !== 'object') continue;
    if (resolved.type === 'object' || resolved.properties || resolved.additionalProperties !== undefined) {
      hasObjectShape = true;
      Object.assign(merged.properties, resolved.properties ?? {});
      for (const field of resolved.required ?? []) required.add(field);
      if (resolved.additionalProperties === false) merged.additionalProperties = false;
      if (resolved.discriminator) merged.discriminator = resolved.discriminator;
    }
  }
  if (!hasObjectShape) return undefined;
  merged.required = [...required];
  return merged;
}

function compositionVariantToTs(document, variant, parentSchema) {
  if (!variant || typeof variant !== 'object' || variant.$ref) return schemaToTs(document, variant);
  const parentIsArray = parentSchema?.type === 'array' || parentSchema?.items !== undefined;
  const variantIsArrayConstraint = variant.type === 'array'
    || variant.items !== undefined
    || variant.minItems !== undefined
    || variant.maxItems !== undefined;
  if (parentIsArray && variantIsArrayConstraint && variant.items === undefined) {
    // A oneOf branch often carries only minItems/maxItems. Reuse the parent
    // item schema so the tuple projection keeps its element type instead of
    // introducing `unknown` into an otherwise closed generated contract.
    return schemaToTs(document, { ...variant, type: 'array', items: parentSchema.items ?? {} });
  }
  const parentProperties = parentSchema?.properties ?? {};
  const variantProperties = Object.fromEntries(
    Object.entries(variant.properties ?? {}).map(([field, propertySchema]) => [
      field,
      mergeProjectionPropertySchema(document, parentProperties[field], propertySchema),
    ]),
  );
  const parentRequired = new Set(parentSchema?.required ?? []);
  const variantRequired = new Set(variant.required ?? []);
  const discriminator = parentSchema?.discriminator?.propertyName;
  if (typeof discriminator === 'string' && parentRequired.has(discriminator)) {
    // A source-required discriminator must remain required in every inline
    // branch so the emitted union keeps its reliable narrowing key.
    variantRequired.add(discriminator);
  }
  for (const field of Object.keys(variantProperties)) {
    if (parentRequired.has(field)) variantRequired.add(field);
  }
  const inheritedRequiredProperties = {};
  for (const field of variantRequired) {
    if (!Object.hasOwn(variantProperties, field) && Object.hasOwn(parentProperties, field)) {
      inheritedRequiredProperties[field] = parentProperties[field];
    }
  }
  const forbiddenFields = new Set(singleFieldNotRequiredClauses(variant));
  if (parentSchema?.additionalProperties === false && variant.additionalProperties === false) {
    for (const field of Object.keys(parentProperties)) {
      if (!Object.hasOwn(variantProperties, field) && !Object.hasOwn(inheritedRequiredProperties, field)) {
        // Both schemas are closed. A parent property omitted by this branch is
        // rejected by JSON Schema, so model it as `?: never` rather than
        // leaving a sibling payload field structurally assignable.
        forbiddenFields.add(field);
      }
    }
  }
  const forbiddenProperties = {};
  for (const field of forbiddenFields) {
    // An empty enum is the internal schema representation of TypeScript never.
    // The source schema remains untouched; this projects closed sibling fields
    // and the common `not: { required: [...] }` pattern into `field?: never`.
    forbiddenProperties[field] = { enum: [] };
  }
  if (Object.keys(inheritedRequiredProperties).length === 0
    && Object.keys(forbiddenProperties).length === 0
    && variantRequired.size === (variant.required ?? []).length) {
    return schemaToTs(document, variant);
  }
  return schemaToTs(document, {
    ...variant,
    required: [...variantRequired],
    properties: { ...inheritedRequiredProperties, ...variantProperties, ...forbiddenProperties },
  });
}

export function schemaToTs(document, schema, inheritedCompositionSchema) {
  if (!schema || typeof schema !== 'object') return 'unknown';

  if (schema.$ref) {
    return addNullable(referenceName(schema.$ref), schema);
  }

  const baseType = schemaBaseToTs(document, schema);
  if (Array.isArray(schema.oneOf) || Array.isArray(schema.anyOf)) {
    const variants = schema.oneOf ?? schema.anyOf;
    const compositionParent = mergeProjectionObjectSchemas(
      document,
      [inheritedCompositionSchema, schema],
    ) ?? schema;
    const variantTypes = variants.map((variant) => (
      compositionVariantToTs(document, variant, compositionParent)
    ));
    let composedType;
    if (baseType !== 'unknown') {
      // Some constraint-only branches (for example numeric ranges and
      // cross-field equality) cannot be represented faithfully in TypeScript.
      // Array cardinality and simple `not required` guards are projected above;
      // for the remaining constraints preserve the shared wire shape instead
      // of widening the generated type to unknown.
      composedType = variantTypes.some((typeName) => typeName === 'unknown')
        ? baseType
        : `${parenthesizeComposition(baseType)} & (${variantTypes.join(' | ') || 'unknown'})`;
    } else {
      composedType = variantTypes.join(' | ') || 'unknown';
    }
    return addNullable(composedType, schema);
  }

  if (Array.isArray(schema.allOf)) {
    const inheritedObjectSchema = mergeProjectionObjectSchemas(document, [
      inheritedCompositionSchema,
      ...schema.allOf,
    ]);
    const variantTypes = schema.allOf
      .map((variant) => schemaToTs(document, variant, inheritedObjectSchema))
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
