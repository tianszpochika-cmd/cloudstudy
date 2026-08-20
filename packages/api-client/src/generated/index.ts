/* eslint-disable */
// GENERATED FILE. Source: packages/contracts/openapi/v1/openapi.json

import type { AuthRefreshResponse, HealthResponse } from '@englishflow/contracts';

export interface GeneratedApiOperationRegistry {
  getHealth: { method: "GET"; path: "/api/v1/health"; response: HealthResponse; };
  refreshAuthSession: { method: "POST"; path: "/api/v1/auth/refresh"; response: AuthRefreshResponse; };
}

export type GeneratedApiOperationId = keyof GeneratedApiOperationRegistry;
