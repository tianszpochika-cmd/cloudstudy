/* eslint-disable */
// GENERATED FILE. Source: packages/contracts/schemas/v1/registry.json
// Run node scripts/contracts/generate-contracts.mjs after changing the source.

export const jsonSchemaRegistry = {
  "platform.contract.health.v1": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://contracts.englishflow.local/platform/contract-health.v1.schema.json",
    "title": "Platform contract health",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "requestId",
      "traceId",
      "status"
    ],
    "properties": {
      "requestId": {
        "type": "string",
        "minLength": 1
      },
      "traceId": {
        "type": "string",
        "minLength": 1
      },
      "status": {
        "type": "string",
        "enum": [
          "ok",
          "degraded"
        ]
      }
    }
  },
  "iam.auth.event-envelope.v1": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://contracts.englishflow.local/iam/auth-event-envelope.v1.schema.json",
    "title": "IAM auditable event envelope",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "eventId",
      "traceId",
      "schemaVersion",
      "aggregateId",
      "dedupeKey",
      "payload"
    ],
    "properties": {
      "eventId": {
        "type": "string",
        "pattern": "^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$"
      },
      "traceId": {
        "type": "string",
        "pattern": "^[a-f0-9]{32}$"
      },
      "schemaVersion": {
        "type": "string",
        "pattern": "^[a-z][a-z0-9_.-]{2,63}\\.v[0-9]+$"
      },
      "aggregateId": {
        "type": "string",
        "minLength": 1,
        "maxLength": 128
      },
      "dedupeKey": {
        "type": "string",
        "pattern": "^[A-Za-z0-9][A-Za-z0-9._:-]{7,255}$"
      },
      "payload": {
        "type": "object"
      }
    }
  },
  "iam.authorization.decision.v1": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://contracts.englishflow.local/iam/authorization-decision.v1.schema.json",
    "title": "IAM authorization decision request",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "action",
      "resourceType",
      "resourceId",
      "phase"
    ],
    "properties": {
      "action": {
        "type": "string",
        "pattern": "^[a-z][a-z0-9._:-]{1,95}$"
      },
      "resourceType": {
        "type": "string",
        "pattern": "^[a-z][a-z0-9._:-]{1,95}$"
      },
      "resourceId": {
        "type": "string",
        "minLength": 1,
        "maxLength": 128
      },
      "phase": {
        "type": "string",
        "enum": [
          "P1",
          "P2",
          "P3"
        ]
      },
      "contentRights": {
        "type": "string",
        "enum": [
          "PUBLISHED",
          "LICENSED",
          "INTERNAL",
          "UNKNOWN"
        ]
      },
      "deviceTrust": {
        "type": "string",
        "enum": [
          "TRUSTED",
          "STANDARD",
          "RISK_REVIEW",
          "UNKNOWN"
        ]
      },
      "consentRequirement": {
        "type": "string",
        "enum": [
          "NONE",
          "TERMS",
          "PRIVACY",
          "ADULT_LEARNING",
          "PRODUCT_ANALYTICS"
        ]
      }
    },
    "x-server-derived-authorization-facts": [
      "subject",
      "tenant",
      "owner",
      "role",
      "permission",
      "consent",
      "policyVersion"
    ]
  },
  "iam.security.error.v1": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://contracts.englishflow.local/iam/security-error.v1.schema.json",
    "title": "IAM security error envelope",
    "type": "object",
    "additionalProperties": false,
    "required": [
      "requestId",
      "traceId",
      "code"
    ],
    "properties": {
      "requestId": {
        "type": "string",
        "minLength": 8,
        "maxLength": 128
      },
      "traceId": {
        "type": "string",
        "minLength": 8,
        "maxLength": 128
      },
      "code": {
        "type": "string",
        "enum": [
          "unauthorized",
          "forbidden",
          "adult_gate_required",
          "consent_required",
          "session_revoked",
          "policy_denied"
        ]
      },
      "retryable": {
        "type": "boolean"
      },
      "policyVersion": {
        "type": "string",
        "maxLength": 64
      }
    }
  }
} as const;

export type JsonSchemaId = keyof typeof jsonSchemaRegistry;
