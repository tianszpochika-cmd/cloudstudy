import test from 'node:test'
import {
  assertAssessmentDeterminism,
  assertB1Contracts,
  assertB1Events,
  assertB1Fixture,
  assertB1Migration,
  assertContentRights,
  assertNoPlaintextSensitiveData,
} from '../../scripts/b1/b1-static-gates.mjs'

test('B1 fixture is synthetic and structurally complete', assertB1Fixture)
test('B1 API contracts expose acceptance and idempotency metadata', assertB1Contracts)
test('B1 events are versioned, additive, and payload-safe', assertB1Events)
test('B1 content supply-chain migration has rights and immutability guardrails', assertB1Migration)
test('B1 assessment replay is deterministic under a fixed rules version', assertAssessmentDeterminism)
test('B1 learner-visible content requires authorized rights', assertContentRights)
test('B1 fixtures contain no plaintext sensitive credentials', assertNoPlaintextSensitiveData)
