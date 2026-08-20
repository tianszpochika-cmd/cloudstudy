import { readFileSync } from 'node:fs';

function readJson(relativePath) {
  return JSON.parse(readFileSync(new URL(relativePath, import.meta.url), 'utf8'));
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }

  for (const child of Object.values(value)) {
    deepFreeze(child);
  }

  return Object.freeze(value);
}

export const ACCESS_POLICY = deepFreeze(readJson('../policies/access-control.json'));
export const TELEMETRY_POLICY = deepFreeze(readJson('../policies/telemetry-events.json'));
export const TELEMETRY_SCHEMA = deepFreeze(readJson('../schemas/telemetry-event.schema.json'));
