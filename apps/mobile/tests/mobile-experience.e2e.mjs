/** UI fixtures only. No request reaches IAM or a real business service. */
import { chromium } from 'playwright'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import assert from 'node:assert/strict'

const root = path.resolve(import.meta.dirname, '../../..')
const output = process.env.MOBILE_E2E_OUTPUT || path.join(os.tmpdir(), `cloudstudy-mobile-experience-${Date.now()}`)
await fs.mkdir(output, { recursive: true })
const pages = JSON.parse(await fs.readFile(path.join(root, 'apps/mobile/src/pages.json'), 'utf8')).pages
const browser = await chromium.launch({ headless: true })
const results = []
const errors = []
const resetConfirmationRequests = []
const base = 'http://127.0.0.1:18183/#/'
const account = { nickname: '小星', status: 'ACTIVE', ageConfirmed: true, privacyConsent: true, termsConsent: true, accentPref: 'US', stateVersion: 1, goal: { goalCode: 'WORKPLACE_DAILY', dailyQuotaMinutes: 15 }, preferences: { themeMode: 'LIGHT', motionMode: 'FULL', uiLocale: 'zh-CN', contentLocale: 'en-US' } }
const token = { accessToken: 'ui-fixture-not-a-real-token', adultGate: 'PASSED', deviceId: 'ui-fixture-device', sessionId: 'ui-fixture-session' }
const home = { tasks: [{ taskId: 'ui-task', title: '在咖啡馆，自信点一杯咖啡', description: '听懂一段日常对话，记住三个实用表达', minutes: 5, status: 'AVAILABLE', contentCode: 'ui-coffee' }], completedMinutes: 0, targetMinutes: 15, projectionVersion: 1 }
const catalog = { items: [{ contentCode: 'ui-coffee', title: '咖啡馆里的日常英语', summary: '从一杯咖啡开始，练习自然的日常表达', availability: 'PUBLISHED', contentLocale: 'en-US', contentType: 'COURSE_UNIT' }] }

async function contextFor(theme, width, signedIn) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, colorScheme: theme === 'dark' ? 'dark' : 'light', reducedMotion: 'reduce' })
  await context.addInitScript(({ theme, signedIn }) => {
    localStorage.setItem('ef.theme', JSON.stringify({ type: 'string', data: theme }))
    if (signedIn) localStorage.setItem('yx.auth.mobile.session-hint', '1')
  }, { theme, signedIn })
  await context.route('**/api/v1/**', async route => {
    const url = new URL(route.request().url()), suffix = url.pathname.replace('/api/v1', '')
    let data, status = 200
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': 'http://127.0.0.1:18183', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, Idempotency-Key, X-Request-Id, Accept-Language, X-Content-Locale', 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS' } })
    if (['/auth/token/refresh', '/auth/login', '/auth/register'].includes(suffix)) data = token
    else if (suffix === '/iam/permissions' || suffix === '/iam/me' || suffix === '/iam/principal/me') data = { adultGate: 'PASSED', subject: 'ui-fixture', permissions: ['learning.plan.read'], consentState: { accepted: true, unsatisfiedPurposes: [] } }
    else if (suffix === '/learner/profile') data = { ...account, preferences: { ...account.preferences, themeMode: theme === 'dark' ? 'DARK' : 'LIGHT', highContrast: theme === 'high-contrast' } }
    else if (suffix === '/learner/home') data = home
    else if (suffix === '/learner/first-day') data = { state: 'READY', taskCount: 1 }
    else if (suffix === '/content/learner/catalog') data = catalog
    else if (suffix.startsWith('/content/learner/') && suffix.includes('ui-coffee')) data = { ...catalog.items[0], items: [{ itemId: 'ui-item', text: 'Could I have a latte, please?', options: [] }] }
    else if (suffix === '/onboarding/options') data = { goals: [{ value: 'WORKPLACE_DAILY', label: '日常交流', description: '在生活中自然表达' }], dailyQuotaMinutes: [5, 15, 30, 45] }
    else if (suffix === '/learner/targets') data = account.goal
    else if (suffix === '/learner/preferences') data = { ...account.preferences, themeMode: theme === 'dark' ? 'DARK' : 'LIGHT', highContrast: theme === 'high-contrast', stateVersion: 1 }
    else if (suffix === '/auth/password-reset/confirm') {
      resetConfirmationRequests.push(route.request().postDataJSON())
      data = {}
    }
    else if (suffix === '/auth/password-reset/request') data = { accepted: true }
    else { status = 503; data = { message: 'UI fixture: service unavailable' } }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ data }), headers: { 'Access-Control-Allow-Origin': 'http://127.0.0.1:18183', 'Access-Control-Allow-Credentials': 'true' } })
  })
  return context
}

try {
  // Every registered page renders at three widths; three themes at phone width.
  for (const [theme, width] of [['light', 320], ['light', 390], ['light', 768], ['dark', 390], ['high-contrast', 390]]) {
    const context = await contextFor(theme, width, true)
    const page = await context.newPage()
    page.on('pageerror', error => errors.push({ message: error.message, stack: error.stack, route: page.url() }))
    for (const entry of pages.filter(entry => !['login', 'register', 'reset-password'].includes(entry.path.split('/')[1]))) {
      const name = entry.path.split('/')[1]
      await page.goto(base + entry.path)
      await page.locator('.mobile-page-title').waitFor()
      await page.waitForTimeout(200)
      if (name === 'home') await page.getByText('在咖啡馆，自信点一杯咖啡', { exact: true }).waitFor()
      if (name === 'profile') {
        await page.locator('.mobile-profile-name').filter({ hasText: '我的学习' }).waitFor()
        await page.getByText('职场与日常 · 15 分钟/天', { exact: true }).waitFor()
        assert.equal(await page.getByRole('button', { name: '保存资料' }).count(), 0, 'profile does not offer an unsupported nickname save')
      }
      if (['b11-reading', 'b11-listening', 'b11-speaking'].includes(name)) {
        await page.locator('.b11-status--error, .b11-status--offline, .b11-status--empty').waitFor()
        assert.equal(await page.locator('.b11-status').count(), 1, `${name}: one status panel`)
        assert.equal(await page.getByRole('button', { name: '重试', exact: true }).count(), 1, `${name}: one retry action`)
        assert.equal(await page.getByText('Performance', { exact: true }).count(), 0, `${name}: no internal quality tier`)
        if (name === 'b11-speaking') assert.equal(await page.locator('.phoneme-card, .recorder-card, .demo-audio').count(), 0, 'speaking: no empty practice controls')
      }
      if (['home', 'learn', 'b2-practice', 'world', 'profile'].includes(name)) {
        await page.waitForFunction(() => {
          const icons = [...document.querySelectorAll('uni-tabbar img')]
          return icons.length === 5 && icons.every(icon => icon.complete && icon.naturalWidth > 0)
        })
      }
      const rendered = await page.locator('.yx-page').first().evaluate(el => ({
        width: el.getBoundingClientRect().width, scrollWidth: document.documentElement.scrollWidth,
        viewport: innerWidth, title: el.querySelector('.mobile-page-title')?.textContent,
        background: getComputedStyle(el).backgroundColor, brand: getComputedStyle(el).getPropertyValue('--yx-brand').trim(),
        headers: el.querySelectorAll('.mobile-page-header').length,
      }))
      assert.equal(await page.locator('.yx-page .yx-page').count(), 0, `${name}: no nested page shell`)
      assert.equal(rendered.headers, 1, `${name}: one page header`)
      assert.ok(!rendered.title.includes('mobile.pages.'), `${name}: translated heading`)
      assert.ok(rendered.scrollWidth <= rendered.viewport + 1, `${name}/${width}/${theme}: horizontal overflow ${JSON.stringify(rendered)}`)
      assert.ok(page.url().includes(entry.path), `${name}: route changed to ${page.url()}`)
      assert.equal(rendered.background, theme === 'high-contrast' ? 'rgb(0, 0, 0)' : theme === 'dark' ? 'rgb(22, 25, 37)' : 'rgb(247, 248, 252)', `${name}: theme applied`)
      results.push({ name, theme, width, ...rendered, state: ['home', 'profile', 'settings', 'onboarding'].includes(name) ? 'synthetic fixture' : 'unavailable/empty fixture' })
      if (width === 390 && ['home', 'learn', 'b2-practice', 'world', 'profile', 'settings', 'b11-reading', 'b11-listening', 'b11-speaking'].includes(name)) await page.screenshot({ path: path.join(output, `${name}-${theme}.png`), fullPage: true })
    }
    await context.close()
  }
  const readingContext = await contextFor('light', 390, true)
  const readyArticle = { articleId: 91, title: '界面测试文章（非真实课程）', cefrLevel: 'A2', wordCount: 12, estimatedMinutes: 1, blocks: [{ blockId: 'fixture-block', blockIndex: 0, text: 'A short test paragraph.', tokens: [] }], rightsStatus: 'AUTHORIZED', contentVersionId: 1 }
  await readingContext.route('**/api/v1/reading/**', async route => {
    const pathname = new URL(route.request().url()).pathname
    const data = pathname.endsWith('/reading/articles') ? { items: [readyArticle] } : pathname.endsWith('/reading/articles/91') ? readyArticle : { items: [] }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data }), headers: { 'Access-Control-Allow-Origin': 'http://127.0.0.1:18183', 'Access-Control-Allow-Credentials': 'true' } })
  })
  const readyPage = await readingContext.newPage()
  await readyPage.goto(base + 'pages/b11-reading/b11-reading')
  await readyPage.getByText('界面测试文章（非真实课程）', { exact: true }).waitFor()
  assert.match(await readyPage.locator('.b11-quality').innerText(), /^画质：(精致|舒适|轻量|省资源) ▾$/)
  await readyPage.getByRole('button', { name: '关闭动效', exact: true }).click()
  await readyPage.getByRole('button', { name: '开启动效', exact: true }).waitFor()
  assert.equal(await readyPage.locator('.yx-page').getAttribute('data-motion'), 'off')
  await readyPage.screenshot({ path: path.join(output, 'b11-reading-ready-light.png'), fullPage: true })
  await readingContext.close()
  // Public auth navigation, actual uni form submission and show-password behavior.
  const context = await contextFor('light', 390, false)
  const page = await context.newPage()
  await page.goto(base + 'pages/login/login')
  await page.locator('.mobile-page-title').waitFor()
  await page.locator('uni-form .yx-button').first().click()
  await page.getByText('请输入账号和密码。', { exact: true }).waitFor()
  await page.getByText('创建账号 ↗', { exact: true }).click()
  await page.waitForURL('**/pages/register/register')
  await page.locator('uni-form .yx-button').first().click()
  await page.getByText('请输入账号和密码。', { exact: true }).waitFor()
  await page.getByText('已有账号？去登录', { exact: true }).click()
  await page.waitForURL('**/pages/login/login')
  await page.getByText('忘记密码？', { exact: true }).click()
  await page.waitForURL('**/pages/reset-password/reset-password')
  await page.getByText('我已收到口令', { exact: true }).click()
  await page.getByText('新密码（至少 12 位）', { exact: true }).waitFor()
  await page.getByText('返回上一步', { exact: true }).click()
  await page.getByText('发送重置指引', { exact: true }).waitFor()
  await page.locator('.yx-field input').fill('ui-fixture@example.invalid')
  await page.getByRole('button', { name: '发送重置指引', exact: true }).click()
  await page.getByText('申请已受理。若收到重置邮件，请按邮件指引操作。', { exact: true }).waitFor()
  await page.goto(base + 'pages/reset-password/reset-password?token=synthetic-reset-token')
  await page.locator('.yx-field input').nth(0).waitFor()
  await page.locator('.yx-field input').nth(0).fill('ui-fixture@example.invalid')
  assert.equal(await page.locator('.yx-field input').nth(1).inputValue(), 'synthetic-reset-token')
  await page.locator('.yx-field input').nth(2).fill('synthetic-new-password')
  await page.getByRole('button', { name: '重置密码', exact: true }).click()
  await page.getByText('密码已重置。请返回登录，使用新密码继续学习。', { exact: true }).waitFor()
  assert.deepEqual(resetConfirmationRequests, [{ identifier: 'ui-fixture@example.invalid', resetToken: 'synthetic-reset-token', newPassword: 'synthetic-new-password' }])
  for (const [theme, width] of [['light', 320], ['light', 390], ['light', 768], ['dark', 390], ['high-contrast', 390]]) {
    const publicContext = await contextFor(theme, width, false)
    const publicPage = await publicContext.newPage()
    for (const name of ['login', 'register', 'reset-password']) {
      await publicPage.goto(base + `pages/${name}/${name}`)
      await publicPage.locator('.mobile-page-title').waitFor()
      assert.ok((await publicPage.evaluate(() => document.documentElement.scrollWidth)) <= width + 1)
      if (width === 390) await publicPage.screenshot({ path: path.join(output, `${name}-${theme}.png`), fullPage: true })
      results.push({ name, theme, width, state: 'public route and validation' })
    }
    await publicContext.close()
  }
  await page.goto(base + 'pages/login/login')
  await page.locator('.yx-field input').nth(0).fill('ui-fixture@example.invalid')
  await page.locator('.yx-field input').nth(1).fill('synthetic-test-password')
  await page.getByText('显示', { exact: true }).click()
  assert.equal(await page.locator('.mobile-password input').getAttribute('type'), 'text')
  await page.getByText('隐藏', { exact: true }).click()
  assert.equal(await page.locator('.mobile-password input').getAttribute('type'), 'password')
  await page.locator('uni-form .yx-button').first().click()
  await page.waitForURL(/#\/(?:pages\/home\/home)?$/)
  await page.getByText('在咖啡馆，自信点一杯咖啡', { exact: true }).waitFor()
  await page.getByText('咖啡馆里的日常英语', { exact: true }).click()
  await page.waitForURL('**/pages/learn/learn')
  await page.getByText('Could I have a latte, please?', { exact: true }).waitFor()
  await page.goto(base + 'pages/settings/settings')
  await page.getByText('深色', { exact: true }).click()
  assert.equal(await page.locator('.yx-page').first().evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(22, 25, 37)')
  await page.getByText('关闭动效', { exact: true }).click()
  assert.equal(await page.locator('.yx-page').getAttribute('data-motion'), 'off')
  await context.close()
  const motionContext = await contextFor('system', 390, false)
  const motionPage = await motionContext.newPage()
  await motionPage.emulateMedia({ reducedMotion: 'no-preference', colorScheme: 'dark' })
  await motionPage.goto(base + 'pages/login/login')
  await motionPage.locator('.mobile-page-title').waitFor()
  assert.equal(await motionPage.locator('.yx-page').getAttribute('data-motion'), 'on')
  assert.equal(await motionPage.locator('.yx-page').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(22, 25, 37)')
  await motionPage.getByRole('button', { name: '登录并继续', exact: true }).press('Enter')
  await motionPage.getByText('请输入账号和密码。', { exact: true }).waitFor()
  await motionPage.emulateMedia({ reducedMotion: 'reduce' })
  await motionPage.reload()
  await motionPage.locator('.mobile-page-title').waitFor()
  assert.equal(await motionPage.locator('.yx-page').getAttribute('data-motion'), 'off')
  await motionContext.close()
  assert.deepEqual(errors, [], 'No page-level runtime exceptions')
  await fs.writeFile(path.join(output, 'results.json'), JSON.stringify({ scope: 'UI fixture validation only; no backend UAT or native device acceptance', checked: results.length, interactions: ['public auth routes', 'required fields', 'reset step navigation', 'password visibility', 'uni form submit', 'course query across tab switch', 'live dark theme', 'motion off', 'reset request and success feedback', 'reset deep link', 'system theme', 'default motion', 'reduced motion', 'keyboard submit'], results, errors }, null, 2))
  await fs.rm(path.join(output, 'failure.json'), { force: true })
  console.log(JSON.stringify({ checked: results.length, errors: errors.length, output }))
} catch (error) {
  await fs.writeFile(path.join(output, 'failure.json'), JSON.stringify({ message: error.message, results, errors }, null, 2))
  throw error
} finally { await browser.close() }
