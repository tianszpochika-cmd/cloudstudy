import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium } from 'playwright'

const root = path.resolve(import.meta.dirname, '../../..')
const baseCss = path.join(root, 'apps/learner-web/src/assets/styles/base.css')
const experienceCss = path.join(root, 'apps/learner-web/src/assets/styles/experience.css')
const mobileCss = path.join(root, 'apps/mobile/src/uni.scss')

const artwork = `
  <div class="study-artwork" aria-hidden="true">
    <div class="study-artwork__orbit"></div>
    <div class="study-artwork__star">✦</div>
    <div class="study-artwork__star study-artwork__star--small">✧</div>
    <div class="study-artwork__window"><i></i><b></b></div>
    <div class="study-artwork__desk"></div>
    <div class="study-artwork__plant"><i></i><i></i><i></i><b></b></div>
    <div class="study-artwork__books"><i></i><i></i><i></i></div>
    <div class="study-artwork__cup"><i></i><b></b><span></span></div>
    <div class="study-artwork__note"><span>little by little</span><strong>grow.</strong><i>✦</i></div>
  </div>`

function pageHtml(kind) {
  if (kind === 'web') {
    return `<!doctype html><html><head>
      <link rel="stylesheet" href="${pathToFileURL(baseCss).href}">
      <link rel="stylesheet" href="${pathToFileURL(experienceCss).href}">
    </head><body>
      <div class="experience-shell"><div class="app-shell"><main class="app-shell__main"><div class="app-shell__content">
        <section class="home-hero">${artwork}</section>
        <section class="experience-heading experience-heading--hero"><div class="experience-heading__art"></div>${artwork.replace('study-artwork"', 'study-artwork study-artwork--compact"')}</section>
        <article class="library-card"><div class="library-card__art"><svg width="72" height="96" viewBox="0 0 72 96"></svg><i></i></div></article>
        <section class="world-invitation" style="position:relative"><div class="world-invitation__art"><span>✦</span><b>✧</b></div></section>
      </div></main></div></div>
      <div class="auth-layout"><div class="auth-art">${artwork}</div></div>
    </body></html>`
  }
  return `<!doctype html><html><head><style>html,body{margin:0}view,text{display:block}</style><style></style></head><body>
    <div class="yx-page"><view class="mobile-intro mobile-intro--hero">
      <view class="mobile-intro-copy"><text class="mobile-kicker">TODAY</text><text class="mobile-page-title">继续今天的学习</text><text class="mobile-page-description">听一段，再说出来。</text></view>
      <view class="mobile-book-art"><view class="mobile-art-orbit"></view><text class="mobile-art-spark">✦</text>
        <view class="mobile-art-book"><text>Aa</text><view></view><view></view></view><view class="mobile-art-disc"></view>
      </view>
    </view></div>
  </body></html>`
}

async function offenders(page) {
  return page.evaluate(() => {
    const doc = document.documentElement
    const viewport = doc.clientWidth
    const found = []
    for (const el of document.querySelectorAll('body *')) {
      const rect = el.getBoundingClientRect()
      if (rect.width < 1 || rect.height < 1) continue
      const parent = el.parentElement
      if (!parent) continue
      const box = parent.getBoundingClientRect()
      const pastRight = Math.max(rect.right - box.right, rect.right - viewport)
      const pastLeft = Math.max(box.left - rect.left, -rect.left)
      const extra = Math.max(pastRight, pastLeft)
      if (extra > 1) found.push({ extra: Math.round(extra * 10) / 10, cls: String(el.className || el.tagName).slice(0, 80) })
    }
    found.sort((a, b) => b.extra - a.extra)
    const wide = [...document.querySelectorAll('body *')].map((el) => {
      const rect = el.getBoundingClientRect()
      return { cls: String(el.className || el.tagName).slice(0, 60), right: Math.round(rect.right), width: Math.round(rect.width) }
    }).filter((item) => item.right > doc.clientWidth + 1).sort((a, b) => b.right - a.right).slice(0, 8)
    return { overflow: doc.scrollWidth - doc.clientWidth, client: doc.clientWidth, offenders: found.slice(0, 12), wide }
  })
}

test('decorative nodes stay inside their parent and the viewport at 390 and 1280', async () => {
  const mobileSource = await fs.readFile(mobileCss, 'utf8')
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'rv3-art-'))
  const browser = await chromium.launch({ headless: true })
  try {
    for (const width of [390, 1280]) {
      for (const kind of ['web', 'h5']) {
        const file = path.join(dir, `${kind}-${width}.html`)
        const html = kind === 'h5'
          ? pageHtml('h5').replace('<style></style>', `<style>${mobileSource}</style>`)
          : pageHtml('web')
        await fs.writeFile(file, html)
        const page = await browser.newPage({ viewport: { width, height: 844 }, reducedMotion: 'reduce' })
        await page.goto(pathToFileURL(file).href)
        const probe = await offenders(page)
        assert.ok(probe.overflow <= 1, `${kind}/${width} document overflow ${JSON.stringify(probe)}`)
        assert.deepEqual(probe.offenders, [], `${kind}/${width} horizontal overflow ${JSON.stringify(probe.offenders)}`)
        await page.close()
      }
    }
  } finally {
    await browser.close()
    await fs.rm(dir, { recursive: true, force: true })
  }
})
