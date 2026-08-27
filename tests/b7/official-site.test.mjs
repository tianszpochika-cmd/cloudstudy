import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import { buildLearnerLink } from '../../apps/official-site/utils/public-links.mjs'
import { getPublicStateMeta, PUBLIC_STATES, resolvePublicState } from '../../apps/official-site/utils/public-state.mjs'
import { publicRoutes } from '../../apps/official-site/utils/site-content.mjs'

const testDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(testDir, '..', '..')
const siteRoot = join(repoRoot, 'apps', 'official-site')

async function readSite(relativePath) {
  return readFile(join(siteRoot, relativePath), 'utf8')
}

async function collectSourceFiles(directory, files = []) {
  const entries = await readdir(directory, { withFileTypes: true })
  for (const entry of entries) {
    if (['.nuxt', '.output', '.turbo', 'node_modules'].includes(entry.name)) continue
    const absolute = join(directory, entry.name)
    if (entry.isDirectory()) await collectSourceFiles(absolute, files)
    else files.push(absolute)
  }
  return files
}

test('官网包含 v2 规定的六个核心公开页面和服务公告页', async () => {
  const expectedFiles = [
    'pages/index.vue',
    'pages/courses/index.vue',
    'pages/pricing.vue',
    'pages/download.vue',
    'pages/about.vue',
    'pages/compliance.vue',
  ]

  for (const file of expectedFiles) {
    await readSite(file)
  }

  assert.deepEqual(publicRoutes, ['/', '/courses', '/pricing', '/download', '/about', '/announcements', '/compliance'])
})

test('官网使用公共壳、响应式导航和可访问的移动菜单', async () => {
  const header = await readSite('components/SiteHeader.vue')
  const layout = await readSite('layouts/default.vue')
  const css = await readSite('assets/css/main.css')

  assert.match(layout, /SiteHeader/)
  assert.match(layout, /SiteFooter/)
  assert.match(header, /aria-expanded/)
  assert.match(header, /aria-controls="official-site-nav"/)
  assert.match(header, /isMenuOpen = !isMenuOpen/)
  assert.match(header, /@click="closeMenu"/)
  assert.match(css, /@media \(max-width: 720px\)/)
  assert.match(css, /\.site-nav\.is-open/)
  assert.match(css, /min-height: var\(--ef-touch-target\)/)
})

test('公共状态覆盖 loading、empty、error 和 download-disabled', async () => {
  const component = await readSite('components/PublicStatus.vue')
  const download = await readSite('pages/download.vue')

  assert.deepEqual(PUBLIC_STATES, ['ready', 'loading', 'empty', 'error', 'download-disabled'])
  for (const state of PUBLIC_STATES) {
    assert.equal(resolvePublicState(state), state)
    assert.ok(getPublicStateMeta(state).title)
  }
  assert.equal(resolvePublicState('unknown'), 'ready')
  assert.match(component, /role="meta\.role"/)
  assert.match(component, /@click="emit\('retry'\)"/)
  assert.match(download, /download-disabled/)
  assert.match(download, /aria-disabled="true"/)
})

test('学习端跳转只允许受控 HTTP(S) 深链并保留来源参数', () => {
  assert.equal(
    buildLearnerLink('https://learn.example.test', '/login', { returnTo: '/onboarding', source: 'official' }),
    'https://learn.example.test/login?returnTo=%2Fonboarding&source=official',
  )
  assert.equal(buildLearnerLink('/', '/learn', { source: 'footer' }), '/learn?source=footer')
  assert.throws(() => buildLearnerLink('javascript:alert(1)', '/login'), /http or https/)
})

test('SEO、结构化数据、robots 和 sitemap 均为源码能力', async () => {
  const config = await readSite('nuxt.config.ts')
  const seo = await readSite('utils/seo.ts')
  const app = await readSite('app.vue')
  const robots = await readSite('server/routes/robots.txt.ts')
  const sitemap = await readSite('server/routes/sitemap.xml.ts')

  assert.match(config, /ssr: true/)
  assert.match(config, /sitemap\.xml/)
  assert.match(seo, /useSeoMeta/)
  assert.match(seo, /application\/ld\+json/)
  assert.match(app, /Organization|englishflow-official-site-tokens/)
  assert.match(robots, /User-agent: \*/)
  assert.match(robots, /Sitemap:/)
  assert.match(sitemap, /urlset xmlns=/)
  assert.match(sitemap, /changefreq/)
})

test('官网源码不调用登录后学习 API，也不依赖生成目录', async () => {
  const files = await collectSourceFiles(siteRoot)
  const source = (await Promise.all(files.map((file) => readFile(file, 'utf8')))).join('\n')
  assert.doesNotMatch(source, /\b(?:fetch|useFetch|useAsyncData|\$fetch)\s*\(/)
  assert.doesNotMatch(source, /(?:^|[\\/])(?:\.nuxt|\.output)(?:[\\/]|$)/)
  assert.doesNotMatch(source, /(?:password|token|payment credential|支付凭证)\s*[:=]\s*[^,\n]+/i)
})

test('页面内部公开链接都指向已注册公开路由或公开锚点', async () => {
  const files = await collectSourceFiles(join(siteRoot, 'pages'))
  const pages = (await Promise.all(files.map((file) => readFile(file, 'utf8')))).join('\n')
  const links = [...pages.matchAll(/(?:to|href)="(\/(?:courses|pricing|download|about|compliance)?(?:#[^\"]*)?)"/g)].map((match) => match[1])
  const validPaths = new Set(publicRoutes)
  for (const link of links) {
    assert.ok(validPaths.has(link.split('#')[0]), `未注册公开路由: ${link}`)
  }
})

test('本次变更测试文件只验证源码，不读取 .nuxt/.output 构建产物', () => {
  const relativeTestPath = relative(repoRoot, fileURLToPath(import.meta.url))
  assert.equal(relativeTestPath.replaceAll('\\', '/'), 'tests/b7/official-site.test.mjs')
})
