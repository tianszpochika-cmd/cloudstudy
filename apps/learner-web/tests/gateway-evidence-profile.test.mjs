import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '../../..')
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8')

test('production gateway default stays 30 and evidence scripts use an isolated profile', () => {
  const production = read('services/api-gateway/src/main/resources/application.yml')
  const evidence = read('services/api-gateway/src/main/resources/application-evidence.yml')
  assert.match(production, /high-risk-admin:[\s\S]*requests-per-window:\s\$\{GATEWAY_RATE_LIMIT_HIGH_RISK_ADMIN_REQUESTS:30\}/)
  assert.match(evidence, /on-profile:\s*evidence/)
  assert.match(evidence, /requests-per-window:\s*2000/)
  assert.doesNotMatch(evidence, /GATEWAY_RATE_LIMIT_HIGH_RISK_ADMIN_REQUESTS|\$\{/)

  const scripts = fs.readdirSync(path.join(root, 'scripts/redesign/r3-local-https'))
    .filter((name) => name.startsWith('run-') && name.endsWith('.mjs'))
  assert.ok(scripts.length >= 12)
  for (const name of scripts) {
    const source = read(path.join('scripts/redesign/r3-local-https', name))
    assert.doesNotMatch(source, /GATEWAY_RATE_LIMIT_HIGH_RISK_ADMIN_REQUESTS/, name)
    assert.match(source, /SPRING_PROFILES_ACTIVE: 'local,evidence'/, name)
    assert.match(source, /retry-after/, name)
  }
  const frozen = read('evidence/redesign/2026-10-10/it1-named-gates/run.mjs')
  assert.match(frozen, /GATEWAY_RATE_LIMIT_HIGH_RISK_ADMIN_REQUESTS: '2000'/)
})
