import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const appRoot = path.resolve(import.meta.dirname, '..', '..')
const source = fs.readFileSync(path.join(appRoot, 'src/domain/notification-preferences.ts'), 'utf8')
const javascript = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
const helpers = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`)

test('new mobile notification preferences start off with an off quiet window and version zero', () => {
  const command = helpers.makeNotificationPreferenceCommand('LEARNING', false)
  assert.deepEqual(command, {
    category: 'LEARNING',
    enabled: false,
    locale: 'zh-CN',
    consentVersion: 1,
    dndWindow: { startLocalTime: '00:00', endLocalTime: '00:00' },
    frequencyPolicy: 'DISABLED',
    expectedVersion: 0,
  })
})

test('enabling a category selects immediate delivery and never treats metadata as consent', () => {
  const command = helpers.makeNotificationPreferenceCommand('REVIEW', true)
  assert.equal(command.frequencyPolicy, 'IMMEDIATE')
  assert.equal(command.consentVersion, 1)
  assert.deepEqual(command.dndWindow, { startLocalTime: '00:00', endLocalTime: '00:00' })
})

test('a refreshed preference confirms only the requested owner state, independent of its new version', () => {
  const current = {
    category: 'REVIEW', channel: 'IN_APP', enabled: false, locale: 'zh-CN', consentVersion: 2,
    dndWindow: { startLocalTime: '22:00', endLocalTime: '07:00' },
    frequencyPolicy: 'DISABLED', version: 7, updatedAt: '2026-09-25T08:00:00Z',
  }
  const command = helpers.makeNotificationPreferenceCommand('REVIEW', true, current, undefined, 'IMMEDIATE')
  const committed = {
    ...current, enabled: true, frequencyPolicy: 'IMMEDIATE', version: 8,
  }
  assert.equal(helpers.notificationPreferenceMatchesCommand(committed, command), true)
  assert.equal(helpers.notificationPreferenceMatchesCommand(current, command), false)
  assert.equal(helpers.notificationPreferenceMatchesCommand(undefined, command), false)
})

test('unrelated preference edits preserve the returned quiet interval but omit server timezone from the command', () => {
  const current = {
    category: 'STUDY_ROOM', channel: 'IN_APP', enabled: false, locale: 'zh-CN', consentVersion: 3,
    dndWindow: { startLocalTime: '21:30', endLocalTime: '06:45', timezone: 'Asia/Shanghai' },
    frequencyPolicy: 'IMMEDIATE', version: 4, updatedAt: '2026-09-25T08:00:00Z',
  }
  const command = helpers.makeNotificationPreferenceCommand('STUDY_ROOM', true, current)
  assert.equal(command.expectedVersion, 4)
  assert.equal(command.consentVersion, 3)
  assert.deepEqual(command.dndWindow, { startLocalTime: '21:30', endLocalTime: '06:45' })
  assert.equal('timezone' in command.dndWindow, false)
})

test('equal endpoints mean DND off; active quiet hours require a real interval', () => {
  assert.equal(helpers.isNotificationDndEnabled({ startLocalTime: '00:00', endLocalTime: '00:00' }), false)
  assert.equal(helpers.isNotificationDndEnabled({ startLocalTime: '22:00', endLocalTime: '07:00' }), true)
  assert.equal(helpers.NOTIFICATION_CATEGORIES.length, 14)
})

test('canonical preference reads follow every cursor page and reject a repeated cursor', async () => {
  const calls = []
  const rows = await helpers.readAllNotificationPreferencePages(async (cursor) => {
    calls.push(cursor)
    if (cursor === null) return { data: [{ category: 'ACCOUNT', version: 1 }], meta: { hasMore: true, nextCursor: 'opaque/next' } }
    return { data: [{ category: 'SYSTEM', version: 2 }], meta: { hasMore: false, nextCursor: null } }
  })
  assert.deepEqual(calls, [null, 'opaque/next'])
  assert.deepEqual(rows.map(row => row.category), ['ACCOUNT', 'SYSTEM'])

  await assert.rejects(
    helpers.readAllNotificationPreferencePages(async () => ({ data: [], meta: { hasMore: true, nextCursor: 'repeat' } })),
    /游标无效/,
  )
})
