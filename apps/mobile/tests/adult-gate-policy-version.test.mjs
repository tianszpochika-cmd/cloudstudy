import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..', '..', '..')
const read = (path) => readFile(join(root, path), 'utf8')

const SESSION = 'apps/mobile/src/stores/session.ts'
const CONTROLLER = 'services/iam-service/src/main/java/com/englishflow/iam/web/IamProviderBoundaryController.java'

test('the adult gate policy version matches the one the server accepts', async () => {
  const session = await read(SESSION)
  const controller = await read(CONTROLLER)

  const client = /ADULT_GATE_POLICY_VERSION\s*=\s*'([^']+)'/u.exec(session)?.[1]
  // The server compares the request field against a literal and rejects anything else with
  // iam.adult_gate.policy_version_invalid, leaving the gate closed.
  const server = /"([a-z0-9-]+)"\.equals\(request\.policyVersion\(\)\)/u.exec(controller)?.[1]

  assert.ok(client, 'the mobile client must declare ADULT_GATE_POLICY_VERSION')
  assert.ok(server, 'the server must compare policyVersion against a literal')
  assert.equal(client, server,
    `the mobile client sends ${client} but the adult gate accepts ${server}; the gate would stay closed`)
})

test('the adult gate call uses the shared constant rather than a literal', async () => {
  const session = await read(SESSION)
  assert.match(session, /confirmAdultGate\(birthYear: number, policyVersion = ADULT_GATE_POLICY_VERSION\)/u)
  // A literal here is what drifted before: the store sent 'v2-phase1' for as long as nobody compared
  // it with the server, and no learner could pass the gate.
  assert.doesNotMatch(session, /policyVersion\s*=\s*'/u)
})
