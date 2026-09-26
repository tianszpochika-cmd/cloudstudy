import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import ts from 'typescript'

const appRoot = join(import.meta.dirname, '..')

async function loadModule(relativePath, imports = {}) {
  const source = await readFile(join(appRoot, relativePath), 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const exports = {}
  new Function('require', 'exports', compiled)((name) => {
    if (!(name in imports)) throw new Error(`Unexpected import: ${name}`)
    return imports[name]
  }, exports)
  return exports
}

const state = (ready) => ({
  contentCode: 'draft-1',
  title: 'Draft',
  latestStatus: 'DRAFT',
  stateVersion: 3,
  rightsStatus: 'VALID',
  reviewSubmissionReady: ready,
  versions: [{ contentVersionId: 'version-1', versionNumber: 1, status: 'DRAFT', sourceCode: 'SOURCE-1', licenseCode: 'LICENSE-1' }],
})

async function adapterWith(listState, detailState) {
  const domain = await loadModule('src/domain/content.ts')
  const requests = []
  const client = {
    async request(path, options = {}) {
      requests.push({ path, method: options.method, body: options.body })
      if (path === '/admin/content-commands?pageSize=100') return { data: [listState], meta: { hasMore: false } }
      if (path === '/admin/content-commands/draft-1') {
        if (detailState instanceof Error) throw detailState
        return { data: detailState }
      }
      if (path === '/admin/content-commands' && options.method === 'POST') return { data: { status: 'ACCEPTED' } }
      throw new Error(`Unexpected request: ${path}`)
    },
  }
  const module = await loadModule('src/api/content-service-command-adapter.ts', {
    './client': { adminClient: client, AdminApiError: class AdminApiError extends Error {} },
    '../platform/admin-i18n': { adminT: (key) => key },
    '../platform/client-id': { createClientId: () => 'test-id' },
    '../domain/content': domain,
  })
  return { adapter: module.createContentServiceCommandAdapter({ client }), requests }
}

test('admin content projection treats missing and string readiness as closed', async () => {
  const { adapter } = await adapterWith(state('true'), state(true))
  const projection = await adapter.getWorkspaceProjection()
  assert.equal(projection.contents[0].reviewSubmissionReady, false)
  const domain = await loadModule('src/domain/content.ts')
  assert.equal(domain.toContentSnapshot({ contentId: 'draft-1', reviewSubmissionReady: 'true' }).reviewSubmissionReady, false)
  assert.equal(domain.toContentSnapshot({ contentId: 'draft-1' }).reviewSubmissionReady, false)
})

test('submit rereads owner decision and never posts when readiness is missing', async () => {
  const { adapter, requests } = await adapterWith(state(true), state(undefined))
  await adapter.getWorkspaceProjection()
  await assert.rejects(adapter.submitReview('draft-1'), { code: 'CONTENT_REVIEW_NOT_READY' })
  assert.deepEqual(requests.map(({ method }) => method), ['GET', 'GET'])
})

test('submit rejects stale version and posts only for matching owner-ready draft', async () => {
  const stale = state(true)
  stale.stateVersion = 4
  const first = await adapterWith(state(true), stale)
  await first.adapter.getWorkspaceProjection()
  await assert.rejects(first.adapter.submitReview('draft-1'), { code: 'CONTENT_STATE_STALE' })
  assert.equal(first.requests.some(({ method }) => method === 'POST'), false)

  const malformed = state(true)
  delete malformed.stateVersion
  const missingVersion = await adapterWith(state(true), malformed)
  await missingVersion.adapter.getWorkspaceProjection()
  assert.equal(await missingVersion.adapter.verifyReviewSubmissionReady('draft-1'), false)
  assert.equal(missingVersion.requests.some(({ method }) => method === 'POST'), false)

  const second = await adapterWith(state(true), state(true))
  await second.adapter.getWorkspaceProjection()
  await second.adapter.submitReview('draft-1')
  assert.equal(second.requests.at(-1).method, 'POST')
  assert.equal(second.requests.at(-1).body.command, 'SUBMIT_REVIEW')
  assert.equal(second.requests.at(-1).body.expectedStateVersion, 3)
})

test('failed detail read keeps review submission unverified and sends no command', async () => {
  const { adapter, requests } = await adapterWith(state(true), new Error('owner detail unavailable'))
  await adapter.getWorkspaceProjection()
  assert.equal(await adapter.verifyReviewSubmissionReady('draft-1'), false)
  assert.equal(requests.some(({ method }) => method === 'POST'), false)
})

test('review button requires the owner readiness decision', async () => {
  const view = await readFile(join(appRoot, 'src/views/AdminContentView.vue'), 'utf8')
  assert.match(view, /selectedContent\.value\?\.reviewSubmissionReady === true/)
  assert.match(view, /selectedReviewReady\.value/)
  assert.match(view, /verifySelectedReviewReadiness\(content\)/)
  assert.match(view, /:disabled="!canSubmitSelected \|\| !!busyAction"/)
})

test('every B9 pack command body follows frozen field policy and oneOf exclusions', async () => {
  const contract = JSON.parse(await readFile(join(appRoot, '..', '..', 'packages/contracts/fragments/b9/b9-content.openapi.json'), 'utf8'))
  const schema = contract.components.schemas.B9ContentCommandRequest
  const fieldPolicy = schema['x-command-field-policy']
  const hash = 'a'.repeat(64)
  const bodies = []
  const run = async (listState, detailState, act) => {
    const { adapter, requests } = await adapterWith(listState, detailState)
    await adapter.getWorkspaceProjection()
    await act(adapter)
    const post = requests.findLast(({ method }) => method === 'POST')
    assert.ok(post, 'expected an owner command')
    bodies.push(post.body)
  }
  await run(state(false), state(false), adapter => adapter.createDraft({
    contentCode: 'new-draft', contentType: 'UNIT', title: 'Title', contentHash: hash,
    sourceCode: 'SOURCE-1', licenseCode: 'LICENSE-1', payload: {},
  }))
  await run(state(false), state(false), adapter => adapter.saveDraft('draft-1', {
    title: 'Title', contentHash: hash, payload: {},
  }))
  await run(state(false), state(false), adapter => adapter.validateDraft('draft-1'))
  await run(state(true), state(true), adapter => adapter.submitReview('draft-1'))
  for (const [stage, stageValue] of [['FIRST', 'FIRST_PENDING'], ['FINAL', 'FINAL_PENDING']]) {
    const reviewState = { ...state(false), reviewStages: [stageValue] }
    await run(reviewState, reviewState, async adapter => {
      const tasks = (await adapter.getWorkspaceProjection()).reviewTasks
      await adapter.decideReview(tasks[0].reviewTaskId, stage, 'APPROVED')
    })
  }
  await run(state(false), state(false), adapter => adapter.publish('draft-1'))
  await run(state(false), state(false), adapter => adapter.rollback('draft-1', {
    targetVersionId: '1', reason: 'LOCAL_TEST',
  }))

  assert.deepEqual(bodies.map(({ command }) => command), [
    'CREATE_DRAFT', 'SAVE_DRAFT', 'VALIDATE_DRAFT', 'SUBMIT_REVIEW',
    'REVIEW_FIRST', 'REVIEW_FINAL', 'PUBLISH', 'ROLLBACK',
  ])
  for (const body of bodies) {
    const policy = fieldPolicy[body.command]
    assert.ok(policy, `missing field policy for ${body.command}`)
    for (const field of policy.required) assert.ok(Object.hasOwn(body, field), `${body.command} missing ${field}`)
    for (const field of Object.keys(body)) assert.ok(policy.allowed.includes(field), `${body.command} forbids ${field}`)
    const branches = schema.oneOf.filter(branch => branch.properties?.command?.enum?.includes(body.command))
    assert.equal(branches.length, 1, `${body.command} should match one branch`)
    for (const field of branches[0].required ?? []) assert.ok(Object.hasOwn(body, field), `${body.command} missing oneOf ${field}`)
    for (const forbidden of branches[0].not?.anyOf ?? []) {
      assert.equal(forbidden.required.every(field => Object.hasOwn(body, field)), false,
        `${body.command} violates oneOf exclusion ${forbidden.required.join(',')}`)
    }
  }
})
