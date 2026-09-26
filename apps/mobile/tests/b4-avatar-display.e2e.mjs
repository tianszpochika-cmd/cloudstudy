/** Browser-only avatar fixtures: the local catalog is never treated as an earned reward. */
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '../../..')
const output = path.join(root, 'artifacts/uat-2026-09-23/screenshots/mobile/avatar-fixture')
const base = 'http://127.0.0.1:18183/#/pages/b4-avatar/b4-avatar'
const browser = await chromium.launch({ headless: true })
const results = []
await fs.mkdir(output, { recursive: true })

async function scenario(kind, width) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion: 'reduce' })
  let failReads = kind === 'retry'
  await context.addInitScript(() => localStorage.setItem('yx.auth.mobile.session-hint', '1'))
  await context.route('**/api/v1/**', async route => {
    const suffix = new URL(route.request().url()).pathname.replace('/api/v1', '')
    const headers = { 'Access-Control-Allow-Origin': 'http://127.0.0.1:18183', 'Access-Control-Allow-Credentials': 'true' }
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: { ...headers, 'Access-Control-Allow-Headers': 'Content-Type, Authorization, Idempotency-Key, X-Request-Id, Accept-Language, X-Content-Locale', 'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS' } })
      return
    }
    if (failReads && !['/auth/token/refresh', '/iam/permissions', '/iam/me'].includes(suffix)) {
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { message: '暂时无法读取角色信息' } }), headers })
      return
    }
    let data = {}
    if (suffix === '/auth/token/refresh') data = { accessToken: 'avatar-fixture-only', adultGate: 'PASSED', deviceId: 'avatar-fixture-device', sessionId: 'avatar-fixture-session' }
    else if (suffix === '/iam/permissions' || suffix === '/iam/me') data = { adultGate: 'PASSED', subject: 'avatar-fixture', permissions: ['learning.plan.read'] }
    else if (suffix === '/avatar/profile' && kind === 'default') data = { profile: { avatarId: 'learner-01', resourceVersion: 'avatar-2026.08.1', loadoutId: 'starter-loadout', renderMode: '2D_FALLBACK' } }
    else if (suffix === '/avatar/profile' && kind === 'owner-empty') data = { profile: { renderMode: '2D_FALLBACK' } }
    else if (suffix === '/avatar/items') data = { items: kind === 'default' ? [
      { itemCode: 'ITEM_STARTER', quality: 'COMMON', slot: 'HEAD', resourceVersion: 'avatar-2026.08.1', owned: true },
      { itemCode: 'ITEM_FOCUS_AURA', quality: 'RARE', slot: 'AURA', resourceVersion: 'avatar-2026.08.1', owned: false },
    ] : [] }
    else if (suffix === '/avatar/loadouts') data = { items: kind === 'default' ? [{ loadoutId: 'starter-loadout', name: '晨间学习', equipped: true, items: ['ITEM_STARTER'] }] : [] }
    else if (suffix === '/avatar/resources' && kind === 'default') data = { resourceVersion: 'avatar-2026.08.1', fallbackMode: '2D_FALLBACK', performanceTiers: ['Ultra', 'High', 'Medium', 'Performance'] }
    else if (['/gamification/quests', '/games/catalog', '/notifications/messages', '/social/rooms', '/offline/packages'].some(prefix => suffix.startsWith(prefix))) data = { items: [] }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data }), headers })
  })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.stack ?? error.message))
  await page.goto(base)
  if (kind === 'retry') {
    await page.getByText('角色信息暂不可用。', { exact: true }).waitFor()
    assert.equal(await page.getByText('外观素材', { exact: true }).count(), 0)
    failReads = false
    await page.getByRole('button', { name: '重试', exact: true }).click()
  }
  try {
    await page.getByText('外观素材', { exact: true }).waitFor({ timeout: 10000 })
  } catch (error) {
    console.error(JSON.stringify({ kind, width, url: page.url(), body: (await page.locator('body').innerText()).slice(0, 1500), errors }))
    throw error
  }
  if (kind === 'default') {
    await page.getByText('晨间学习', { exact: true }).waitFor()
    assert.equal(await page.getByText('套装素材', { exact: true }).count(), 1)
    assert.equal(await page.getByText('当前使用', { exact: true }).count(), 0)
    assert.equal(await page.getByRole('button', { name: '使用', exact: true }).count(), 0)
    assert.equal(await page.getByRole('button', { name: '保存展示偏好' }).count(), 0)
    assert.equal(await page.getByText('画质只影响本机显示；角色素材尚未就绪。', { exact: true }).count(), 1)
    assert.equal(await page.getByText('头部装扮', { exact: true }).count(), 1)
    assert.equal(await page.getByText('光效装扮', { exact: true }).count(), 1)
    assert.equal(await page.getByText('素材展示不代表已获得奖励。', { exact: true }).count(), 1)
    for (const internal of ['2D_FALLBACK', 'ITEM_STARTER', 'ITEM_FOCUS_AURA', 'starter-loadout', 'avatar-2026.08.1', 'learner-01']) {
      assert.ok(!(await page.locator('.b4-avatar').innerText()).includes(internal), `${internal} is not user-facing`)
    }
  } else {
    await page.getByText('画质只影响本机显示；角色素材尚未就绪。', { exact: true }).waitFor()
    await page.getByText('暂无可展示的套装素材。', { exact: true }).waitFor()
    await page.getByText('暂无可展示的装扮素材。', { exact: true }).waitFor()
    assert.equal(await page.getByRole('button', { name: '保存展示偏好' }).count(), 0)
  }
  assert.equal(await page.locator('.b4-quality-picker').innerText(), '省资源')
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${kind}/${width}: no horizontal overflow`)
  assert.deepEqual(errors, [], `${kind}/${width}: no page errors`)
  await page.screenshot({ path: path.join(output, `${kind}-${width}.png`), fullPage: true })
  results.push({ kind, width, errors })
  await context.close()
}

try {
  for (const width of [320, 390]) for (const kind of ['empty', 'owner-empty', 'default']) await scenario(kind, width)
  await scenario('retry', 390)
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto(base)
  await page.waitForURL(/\/pages\/login\/login\?returnTo=/)
  const returnTo = new URL(page.url().replace(/^.*#/, 'http://mobile.invalid')).searchParams.get('returnTo')
  assert.equal(decodeURIComponent(returnTo), '/pages/b4-avatar/b4-avatar')
  results.push({ kind: 'anonymous', returnTo: '/pages/b4-avatar/b4-avatar' })
  await context.close()
  await fs.writeFile(path.join(output, 'results.json'), JSON.stringify({ source: 'browser-only fixtures; no real reward or avatar grant verified', results }, null, 2))
  console.log(JSON.stringify({ checked: results.length, output }))
} finally {
  await browser.close()
}
