import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const appRoot = path.resolve(import.meta.dirname, '..', '..')
const source = fs.readFileSync(path.join(appRoot, 'src/api/b11.ts'), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText

class MobileApiError extends Error {
  constructor(status) { super(`HTTP ${status}`); this.status = status }
}

const unavailableModule = { exports: {} }
const unavailableSource = fs.readFileSync(path.resolve(appRoot, '../../packages/api-client/src/unavailable.ts'), 'utf8')
const unavailableCompiled = ts.transpileModule(unavailableSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
new Function('module', 'exports', unavailableCompiled)(unavailableModule, unavailableModule.exports)

function adapter(request) {
  const module = { exports: {} }
  const require = (name) => {
    if (name === './unavailable') return { unavailableOperation: () => unavailableModule.exports.rejectUnavailableOperation('Feature unavailable') }
    if (name === './client') return { mobileApiClient: { request }, MobileApiError }
    if (name === '../domain/b11') return { contentVersionOf: (value, fallback = 'unknown') => value ?? fallback }
    throw new Error(`unexpected module: ${name}`)
  }
  new Function('require', 'module', 'exports', compiled)(require, module, module.exports)
  return module.exports
}

const context = { uiLocale: 'zh-CN', contentLocale: 'en-US' }
const activeManifest = {
  assetId: 'asset-1', contentVersionId: '301', assetStatus: 'ACTIVE', transcodingStatus: 'READY', rightsStatus: 'ACTIVE',
  checksumSha256: 'a'.repeat(64), sizeBytes: 2048,
  items: [
    { renditionKey: 'original', status: 'READY', mimeType: 'audio/mpeg', checksumSha256: 'a'.repeat(64), sizeBytes: 2048 },
    { renditionKey: 'low', status: 'PROCESSING', mimeType: 'audio/mpeg', checksumSha256: 'b'.repeat(64), sizeBytes: 1024 },
  ],
}

test('media owner manifest becomes a ready unsigned mobile rendition', async () => {
  const api = adapter(async () => activeManifest)
  const manifest = await api.fetchB11MediaManifest('asset-1', context, '301')
  assert.equal(manifest?.rightsStatus, 'AUTHORIZED')
  assert.equal(manifest?.availability, 'READY')
  assert.equal(manifest?.contentVersion, '301')
  assert.equal(manifest?.variants.length, 1)
  assert.equal(manifest?.variants[0].variant, 'default')
  assert.equal(manifest?.variants[0].signedUrl, null)
})

test('revoked, uploading and malformed media owner facts remain unplayable', async () => {
  for (const facts of [
    { assetStatus: 'REVOKED', rightsStatus: 'ACTIVE' },
    { assetStatus: 'UPLOADING' },
    { rightsStatus: 'UNKNOWN' },
    { items: [] },
  ]) {
    const api = adapter(async () => ({ ...activeManifest, ...facts }))
    const manifest = await api.fetchB11MediaManifest('asset-1', context, '301')
    assert.notEqual(manifest?.availability, 'READY')
  }
  const mismatched = adapter(async () => ({ ...activeManifest, assetId: 'another-asset' }))
  await assert.rejects(mismatched.fetchB11MediaManifest('asset-1', context, '301'), /媒体清单无效/)
  const missing = adapter(async () => { throw new MobileApiError(404) })
  await assert.rejects(missing.fetchB11MediaManifest('asset-1', context, '301'))
})

test('legacy manifest variants remain readable without treating unsigned owner items as URLs', async () => {
  const api = adapter(async () => ({ assetId: 'asset-1', contentVersion: 301, rightsStatus: 'AUTHORIZED', availability: 'READY', variants: [{ variant: 'low', signedUrl: 'https://media.example.invalid/low' }] }))
  const manifest = await api.fetchB11MediaManifest('asset-1', context, '301')
  assert.equal(manifest?.availability, 'READY')
  assert.equal(manifest?.variants[0].signedUrl, 'https://media.example.invalid/low')
})

test('short-lived signed URL is parsed separately and must match the asset and expiry', async () => {
  const expiresAt = new Date(Date.now() + 60_000).toISOString()
  const api = adapter(async () => ({ assetId: 'asset-1', url: 'http://127.0.0.1:19000/media/asset-1?token=test', expiresAt, checksumSha256: 'a'.repeat(64), sizeBytes: 2048 }))
  const playback = await api.authorizeB11Playback('asset-1', 'default', context, 'event-1', '301')
  assert.equal(playback?.rightsStatus, 'AUTHORIZED')
  assert.equal(playback?.availability, 'READY')
  assert.equal(playback?.variants[0].signedUrl, 'http://127.0.0.1:19000/media/asset-1?token=test')

  for (const response of [
    { assetId: 'another-asset', url: 'https://media.example.invalid/asset', expiresAt },
    { assetId: 'asset-1', url: 'javascript:alert(1)', expiresAt },
    { assetId: 'asset-1', url: 'https://media.example.invalid/asset', expiresAt: 'invalid' },
    { assetId: 'asset-1', url: 'https://media.example.invalid/asset', expiresAt: new Date(Date.now() - 60_000).toISOString() },
  ]) {
    const invalid = adapter(async () => response)
    const denied = await invalid.authorizeB11Playback('asset-1', 'default', context, 'event-1', '301')
    assert.equal(denied?.availability, 'NOT_READY')
    assert.equal(denied?.variants.length, 0)
  }
})

test('failed media authorization cannot revive a content-embedded playback URL', async () => {
  const api = adapter(async () => { throw new MobileApiError(403) })
  const denied = await api.authorizeB11Playback('asset-1', 'default', context, 'event-1', '301')
  assert.equal(denied?.rightsStatus, 'PENDING')
  assert.equal(denied?.availability, 'NOT_READY')
  assert.deepEqual(denied?.variants, [])
})

test('withheld recording, reading, listening and sync operations reject without transport or successful empty fallback', async () => {
  let requests = 0
  const api = adapter(async () => { requests += 1; return {} })
  const calls = [
    () => api.startB11ListeningSession(1, context, 'event', '301'),
    () => api.submitB11Dictation('session', 'segment', 'answer', context, 'event', '301'),
    () => api.loadB11Phonetics(context),
    () => api.saveB11ReadingProgress({}, 'block', 10, 1, context, 'event'),
    () => api.submitB11ReadingQuestion({}, 'answer', context, 'event'),
    () => api.registerB11Recording({}, context),
    () => api.deleteB11Recording('recording', context, 'event'),
    () => api.submitB11SelfRating('recording', 'GOOD', context, 'event', '301'),
    () => api.completeB11Shadowing({}, context),
    () => api.syncB11Offline([], 'cursor', context, 'batch'),
  ]
  for (const call of calls) await assert.rejects(call(), error => error.code === 'FEATURE_UNAVAILABLE' && error.retryable === false)
  assert.equal(requests, 0)
})
