/** Focused UI fixtures for truthful home, review, and account read states. */
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const output = process.env.MOBILE_STATE_OUTPUT || path.join(os.tmpdir(), `cloudstudy-mobile-states-${Date.now()}`)
const base = 'http://127.0.0.1:18183/#/'
const browser = await chromium.launch({ headless: true })
const results = []
await fs.mkdir(output, { recursive: true })

const token = { accessToken: 'state-fixture-not-a-real-token', adultGate: 'PASSED', deviceId: 'state-fixture-device', sessionId: 'state-fixture-session' }
const catalog = { items: [{ contentCode: 'ui-coffee', title: '咖啡馆里的日常英语', summary: '练习日常表达', availability: 'PUBLISHED', contentLocale: 'en-US', contentType: 'COURSE_UNIT' }] }
const emptyHome = { tasks: [], completedMinutes: 0, targetMinutes: 15, projectionVersion: 1 }

async function checkScenario(name, width) {
  const pageName = name === 'learn-ready' ? 'learn' : name
  const context = await browser.newContext({ viewport: { width, height: 844 }, reducedMotion: 'reduce' })
  const requests = { profile: 0, review: 0 }
  await context.addInitScript(() => localStorage.setItem('yx.auth.mobile.session-hint', '1'))
  await context.route('**/api/v1/**', async route => {
    const suffix = new URL(route.request().url()).pathname.replace('/api/v1', '')
    let status = 200
    let data = {}
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': 'http://127.0.0.1:18183', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, Idempotency-Key, X-Request-Id, Accept-Language, X-Content-Locale', 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS' } })
      return
    }
    if (['/auth/token/refresh', '/auth/login'].includes(suffix)) data = token
    else if (suffix === '/iam/permissions' || suffix === '/iam/me' || suffix === '/iam/principal/me') data = { adultGate: 'PASSED', subject: 'state-fixture', permissions: ['learning.plan.read'], consentState: { accepted: true, unsatisfiedPurposes: [] } }
    else if (suffix === '/learner/home') data = emptyHome
    else if (suffix === '/learner/preferences') data = { themeMode: 'LIGHT', uiLocale: 'zh-CN', contentLocale: 'en-US', stateVersion: 1 }
    else if (suffix === '/learner/targets') data = { goalCode: 'WORKPLACE_DAILY', dailyQuotaMinutes: 15 }
    else if (suffix === '/content/learner/catalog') data = catalog
    else if (suffix === '/content/learner/ui-coffee') data = { ...catalog.items[0], items: [{ itemId: 'ui-item', text: 'Could I have a latte, please?', options: [] }] }
    else if (suffix === '/learner/profile') {
      requests.profile++
      if (name === 'profile') { status = 503; data = { message: '资料服务暂不可用' } }
      else data = { status: 'ACTIVE', themeMode: 'LIGHT', uiLocale: 'zh-CN', contentLocale: 'en-US', stateVersion: 1 }
    }
    else if (suffix === '/learning/review-queue') {
      requests.review++
      if (name === 'learn-ready') data = { items: [{ queueItemId: 'fixture-item', source: 'REVIEW', state: 'LEARNING', priority: 80, completable: false }] }
      else { status = 503; data = { message: '复习服务暂不可用' } }
    }
    else { status = 503; data = { message: 'fixture unavailable' } }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ data }), headers: { 'Access-Control-Allow-Origin': 'http://127.0.0.1:18183', 'Access-Control-Allow-Credentials': 'true' } })
  })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(base + `pages/${pageName}/${pageName}${pageName === 'learn' ? '?contentCode=ui-coffee' : ''}`)
  await page.locator('.mobile-page-title').waitFor()
  if (name === 'home') {
    await page.getByText('今天还没有安排任务。', { exact: true }).waitFor()
    assert.equal(await page.getByText('今日进度', { exact: true }).count(), 0, 'no progress without a task')
    assert.equal(await page.locator('.progress-track').count(), 0, 'no empty progress track')
    assert.equal(await page.getByText('可从下方选择课程。', { exact: true }).count(), 1)
  } else if (pageName === 'learn') {
    await page.getByText('Could I have a latte, please?', { exact: true }).waitFor()
    assert.equal(await page.getByText('英语 · 课程单元', { exact: true }).count(), 1, 'content codes have readable labels')
    assert.equal(await page.getByText('en-US · COURSE_UNIT', { exact: true }).count(), 0)
    if (name === 'learn-ready') {
      await page.getByText('复习 · 巩固中', { exact: true }).waitFor()
      assert.equal(await page.getByText('待复习 1 项', { exact: true }).count(), 1)
      assert.equal(await page.getByText('REVIEW · LEARNING', { exact: true }).count(), 0, 'raw review states are hidden')
      assert.ok(await page.getByRole('button', { name: '暂不可操作' }).isDisabled(), `review without verified evidence cannot be completed: ${await page.getByRole('button', { name: '暂不可操作' }).evaluate(el => el.outerHTML)}`)
    } else {
      await page.locator('.review-card [role="alert"]').waitFor()
      assert.equal(await page.locator('.review-card [role="alert"]').count(), 1, 'one review failure message')
      assert.equal(await page.getByText('待复习 0 项', { exact: true }).count(), 0, 'unknown count is not shown as zero')
      assert.equal(await page.locator('.review-card').getByRole('button', { name: '重试' }).count(), 1, `review retry is available: ${await page.locator('.review-card').innerText()}`)
      await page.locator('.review-card').getByRole('button', { name: '重试' }).click()
      await page.waitForFunction(() => document.querySelector('.review-card [role="alert"]') !== null)
      assert.ok(requests.review >= 2, 'review retry reads the service again')
    }
  } else {
    await page.locator('.profile-state[role="alert"]').waitFor()
    assert.equal(await page.locator('.mobile-profile-banner, .profile-card, .profile-facts').count(), 0, 'fallback account is hidden after read failure')
    assert.equal(await page.locator('.profile-state[role="alert"]').count(), 1, 'one account failure message')
    await page.locator('.profile-state').getByRole('button', { name: '重试' }).click()
    await page.locator('.profile-state[role="alert"]').waitFor()
    assert.ok(requests.profile >= 2, 'account retry reads the service again')
  }
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${name}/${width}: no horizontal overflow`)
  assert.deepEqual(errors, [], `${name}/${width}: no page errors`)
  await page.screenshot({ path: path.join(output, `${name}-${width}.png`), fullPage: true })
  results.push({ name, width, requests, errors })
  await context.close()
}

try {
  for (const width of [320, 390, 768]) {
    for (const name of ['home', 'learn', 'profile']) await checkScenario(name, width)
  }
  await checkScenario('learn-ready', 390)
  await fs.writeFile(path.join(output, 'results.json'), JSON.stringify({ scope: 'synthetic UI failure and empty states only', checked: results.length, results }, null, 2))
  console.log(JSON.stringify({ checked: results.length, output }))
} finally {
  await browser.close()
}
