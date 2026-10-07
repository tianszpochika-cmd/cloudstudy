import { readFileSync } from 'node:fs';
import { assertProtectedPath } from './receipt.mjs';

export const TLS_CASES = Object.freeze(Array.from({ length: 8 }, (_, i) => ({
  id: `TLS-${String(i + 1).padStart(2, '0')}`, status: 'NOT_EXECUTED',
})));

const fields = ['bindHost', 'gatewayPort', 'publisherPort', 'jwksUri', 'routeCertificate',
  'independentTrustStore', 'insecureTrustManager', 'hostnameVerification', 'httpFallback'];

/** Configuration validation only. This module has no import-time or D1 listener. */
export function validateHarnessConfig(config, { registered, repositoryRoot, inspectMaterial = assertProtectedPath } = {}) {
  if (!config || typeof config !== 'object' || Array.isArray(config)
      || Object.keys(config).some(key => !fields.includes(key))
      || fields.some(key => !Object.hasOwn(config, key))) throw new Error('HARNESS_CONFIG_SCHEMA');
  if (config.bindHost !== registered.bindHost || config.bindHost !== '127.0.0.1'
      || config.gatewayPort !== registered.gatewayPort || config.publisherPort !== registered.publisherPort
      || config.jwksUri !== `https://127.0.0.1:${registered.publisherPort}/api/v1/auth/jwks`) {
    throw new Error('FIXED_LOOPBACK_HTTPS_REQUIRED');
  }
  if (config.insecureTrustManager !== false || config.hostnameVerification !== true || config.httpFallback !== false) {
    throw new Error('UNSAFE_TLS_DOWNGRADE');
  }
  for (const name of ['routeCertificate', 'independentTrustStore']) {
    if (typeof config[name] !== 'string' || !config[name]) throw new Error('MATERIAL_PATH_REQUIRED');
    inspectMaterial(config[name], { directory: false, repositoryRoot });
  }
  if (config.routeCertificate === config.independentTrustStore) throw new Error('INDEPENDENT_CLIENT_MATERIALS_REQUIRED');
  return { ...config };
}

/** Public-only publisher fixture validation; never rewrites/filters production source results. */
export function validatePublicEnvelope(document) {
  if (!document || typeof document !== 'object' || !document.data || !Array.isArray(document.data.keys)) {
    throw new Error('PUBLIC_ENVELOPE_REQUIRED');
  }
  for (const key of document.data.keys) {
    if (!key || key.kty !== 'RSA' || typeof key.kid !== 'string' || !key.kid
        || typeof key.n !== 'string' || !key.n || typeof key.e !== 'string' || !key.e
        || ['d', 'p', 'q', 'dp', 'dq', 'qi', 'oth'].some(name => Object.hasOwn(key, name))) {
      throw new Error('SYNTHETIC_PUBLISHER_PUBLIC_RSA_ONLY');
    }
  }
  return document;
}

export function loadPublicEnvelope(file) {
  return validatePublicEnvelope(JSON.parse(readFileSync(file, 'utf8')));
}

/** D2 is intentionally unavailable: no boolean flag, arbitrary authority key, or raw listen API. */
export function launchHarness() {
  throw new Error('D2_NOT_AUTHORIZED: no reviewed maintenance authority/window; listeners=0 signals=0 db=0');
}

export function probeHarness() {
  throw new Error('D2_NOT_AUTHORIZED: no approved live harness; networkRequests=0');
}
