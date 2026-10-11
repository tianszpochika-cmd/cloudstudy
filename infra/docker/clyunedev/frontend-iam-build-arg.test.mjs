import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const here = new URL('.', import.meta.url)
const read = (name) => readFileSync(new URL(name, here), 'utf8')
const IAM = 'VITE_IAM_AUTH_BASE_URL: https://api.clyunedev.com/api/v1'

test('learner-web and mobile-h5 bake the public HTTPS IAM auth base, never the loopback default', () => {
  const core = read('docker-compose.core.yml')
  const full = read('docker-compose.full.yml')
  const learner = core.slice(core.indexOf('\n  learner-web:'), core.indexOf('\n  admin-web:'))
  assert.ok(learner.includes(IAM), 'learner-web build args must set VITE_IAM_AUTH_BASE_URL')
  const mobile = full.slice(full.indexOf('\n  mobile-h5:'))
  assert.ok(mobile.includes(IAM), 'mobile-h5 build args must set VITE_IAM_AUTH_BASE_URL')
  for (const f of ['Dockerfile.vite-web', 'Dockerfile.mobile-h5']) {
    const d = read(f)
    assert.match(d, /ARG VITE_IAM_AUTH_BASE_URL/)
    assert.match(d, /VITE_IAM_AUTH_BASE_URL="\$\{VITE_IAM_AUTH_BASE_URL\}"[^\n]* pnpm/)
  }
})
