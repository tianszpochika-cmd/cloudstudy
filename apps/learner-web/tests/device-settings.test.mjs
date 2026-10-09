import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import ts from 'typescript'

const appRoot = resolve(import.meta.dirname, '..')

function loadB1Api(mockApiClient) {
  const source = readFileSync(resolve(appRoot, 'src/api/b1.ts'), 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const module = { exports: {} }
  const dependencies = {
    './unavailable': { unavailableOperation: () => {} },
    './client': { apiClient: mockApiClient },
    '../platform/client-id': { createClientId: (prefix) => `${prefix}-fixture` },
  }
  new Function('require', 'module', 'exports', compiled)((name) => {
    if (Object.hasOwn(dependencies, name)) return dependencies[name]
    throw new Error(`unexpected dependency: ${name}`)
  }, module, module.exports)
  return module.exports
}

test('fetchDevices prioritizes server isCurrent flag over client session deviceId', async () => {
  const apiResponse = {
    devices: [
      { deviceId: 'dev-srv-current', deviceType: 'WEB', status: 'ACTIVE', lastActiveAt: '2026-10-09T08:00:00Z', isCurrent: true },
      { deviceId: 'dev-srv-other', deviceType: 'IOS', status: 'ACTIVE', lastActiveAt: '2026-10-08T08:00:00Z', isCurrent: false },
    ],
  }
  const client = {
    get: async (url) => {
      assert.equal(url, '/iam/devices')
      return { data: apiResponse }
    },
  }
  const api = loadB1Api(client)

  // Even if client claims dev-srv-other is current, server isCurrent takes precedence
  const result = await api.fetchDevices('dev-srv-other')
  assert.equal(result.length, 2)

  const currentDev = result.find((d) => d.deviceId === 'dev-srv-current')
  assert.ok(currentDev)
  assert.equal(currentDev.current, true)

  const otherDev = result.find((d) => d.deviceId === 'dev-srv-other')
  assert.ok(otherDev)
  assert.equal(otherDev.current, false)
})

test('fetchDevices falls back to client deviceId comparison when server omits isCurrent', async () => {
  const legacyResponse = {
    devices: [
      { deviceId: 'dev-legacy-1', deviceType: 'WEB', status: 'ACTIVE', lastActiveAt: '2026-10-09T08:00:00Z' },
      { deviceId: 'dev-legacy-2', deviceType: 'IOS', status: 'ACTIVE', lastActiveAt: '2026-10-08T08:00:00Z' },
    ],
  }
  const client = {
    get: async () => ({ data: legacyResponse }),
  }
  const api = loadB1Api(client)

  const withMatch = await api.fetchDevices('dev-legacy-1')
  assert.equal(withMatch.find((d) => d.deviceId === 'dev-legacy-1')?.current, true)
  assert.equal(withMatch.find((d) => d.deviceId === 'dev-legacy-2')?.current, false)

  const withoutMatch = await api.fetchDevices(null)
  assert.equal(withoutMatch.every((d) => !d.current), true)
})

test('fetchDevices rejects malformed responses', async () => {
  const client = {
    get: async () => ({ data: 'invalid' }),
  }
  const api = loadB1Api(client)

  await assert.rejects(api.fetchDevices(), /设备列表响应不完整/)
})
