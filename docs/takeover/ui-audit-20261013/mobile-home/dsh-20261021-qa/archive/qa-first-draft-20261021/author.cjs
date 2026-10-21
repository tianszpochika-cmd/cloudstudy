// MB007 QA case runner. PREPARED ONLY: the author session did not launch a
// browser. Requiring this file performs no launch and no environment checks.
//
// One case per invocation:
//   node author.cjs --case ready|search|retry|empty|auth|late
//
// Required environment:
//   MB007_CONFIRM_BROWSER=1
//   EXPECTED_HOME_SHA=<raw sha256 of apps/mobile/src/pages/home/home.vue>
//   EXPECTED_I18N_SHA=<raw sha256 of packages/i18n/src/mobile-experience.ts>
//   EXPECTED_STORE_SHA=<raw sha256 of the narrow home store>
// Optional:
//   QA_STORE_FILE=<repo-relative store path>  default apps/mobile/src/stores/learner-content.ts
//   MB007_QA_RUN_ID (or QA_RUN_ID)            one safe path segment
//
// Exit: 0 = every check PASS; 1 = any FAIL; 2 = setup refusal / GAP / NOT_RUN.
// A GAP is not a PASS. Retry/late auth console errors are recorded raw and
// classified explicitly, never hidden by a broad allowlist.
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');

const ROOT = (() => {
  let dir = __dirname;
  for (let i = 0; i < 10; i += 1) {
    if (fs.existsSync(path.join(dir, 'apps/mobile/src/pages/home/home.vue'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error('repo root not found from ' + __dirname);
})();

const BASE = 'http://127.0.0.1:18183';
const RUNS_ROOT = path.resolve(__dirname, 'runs');
const CASES = ['ready', 'search', 'retry', 'empty', 'auth', 'late'];
const CASE = (() => {
  const index = process.argv.indexOf('--case');
  return index >= 0 ? String(process.argv[index + 1] || '').trim() : '';
})();

const HOME_FILE = 'apps/mobile/src/pages/home/home.vue';
const I18N_FILE = 'packages/i18n/src/mobile-experience.ts';
const STORE_FILE = String(process.env.QA_STORE_FILE || 'apps/mobile/src/stores/learner-content.ts').trim();
const FILES = {
  page: HOME_FILE,
  i18n: I18N_FILE,
  store: STORE_FILE,
  api: 'apps/mobile/src/api/learner-content.ts',
  session: 'apps/mobile/src/stores/session.ts',
  navigation: 'apps/mobile/src/auth/navigation.ts',
  runtime: 'apps/mobile/src/platform/uni-runtime.ts',
  handoff: 'apps/mobile/src/platform/public-auth-handoff.mjs',
  depPackage: 'apps/mobile/package.json',
  depLock: 'pnpm-lock.yaml',
};

const COPY = {
  h1: ['今日学习', "Today's learning"],
  courses: ['课程内容', 'Courses'],
  search: ['搜索课程', 'Search courses'],
  clear: ['清除搜索', 'Clear search'],
  retry: ['重试', 'Retry'],
  start: ['开始学习', 'Start learning'],
  continue: ['继续课程', 'Continue course', '继续学习', 'Continue learning'],
  noPlan: ['开始设置', 'Start setup'],
  noContent: ['看可用内容', 'View available content'],
  noDue: ['新学或结束', 'Learn or finish'],
  completedAction: ['结束学习', 'Finish learning'],
  backLogin: ['返回登录', 'Return to sign in', '返回', 'Back'],
};

function sha256File(relativePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(path.resolve(ROOT, relativePath))).digest('hex');
}

function hashSet() {
  const out = {};
  for (const [key, file] of Object.entries(FILES)) {
    out[key] = { path: file, sha256: sha256File(file) };
  }
  return out;
}

function norm(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function matchesCopy(text, names) {
  const value = norm(text);
  return names.some((name) => value === name || value.includes(name));
}

function refuse(message) {
  console.error('REFUSED (setup, exit 2): ' + message + ' Nothing was captured.');
  return 2;
}

function readConfig() {
  if (!CASES.includes(CASE)) throw new Error('pass exactly one --case <' + CASES.join('|') + '>.');
  if (String(process.env.MB007_CONFIRM_BROWSER || '').trim() !== '1') {
    throw new Error('set MB007_CONFIRM_BROWSER=1 to launch this prepared QA capture.');
  }
  const expected = {
    home: String(process.env.EXPECTED_HOME_SHA || '').trim().toLowerCase(),
    i18n: String(process.env.EXPECTED_I18N_SHA || '').trim().toLowerCase(),
    store: String(process.env.EXPECTED_STORE_SHA || '').trim().toLowerCase(),
  };
  for (const [key, value] of Object.entries(expected)) {
    if (!/^[0-9a-f]{64}$/.test(value)) throw new Error('EXPECTED_' + key.toUpperCase() + '_SHA must be explicit 64-lowercase-hex; no default/auto-accept.');
  }
  const actual = {
    home: sha256File(HOME_FILE),
    i18n: sha256File(I18N_FILE),
    store: sha256File(STORE_FILE),
  };
  for (const key of ['home', 'i18n', 'store']) {
    if (actual[key] !== expected[key]) {
      throw new Error('EXPECTED_' + key.toUpperCase() + '_SHA mismatch for ' + FILES[key] + ': file=' + actual[key] + ' expected=' + expected[key] + '.');
    }
  }
  const explicit = String(process.env.MB007_QA_RUN_ID || process.env.QA_RUN_ID || '').trim();
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '').replace('T', '-');
  const runId = explicit || `qa-${CASE}-${stamp}`;
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(runId)) throw new Error('run id must be one safe path segment.');
  return { expected, actual, runId };
}

function resolveRunDirectory(runId) {
  const out = path.resolve(RUNS_ROOT, runId);
  if (path.dirname(out) !== RUNS_ROOT) throw new Error('run directory escaped runs/.');
  if (fs.existsSync(out)) throw new Error('run directory already exists: ' + out + '; refusing to overwrite.');
  return out;
}

function probe(url) {
  return new Promise((resolve) => {
    const request = http.get(url, (response) => { response.resume(); resolve(response.statusCode || 0); });
    request.on('error', () => resolve(0));
    request.setTimeout(3000, () => { request.destroy(); resolve(0); });
  });
}

async function findHeading(page, names) {
  const locator = page.locator('h1, [role="heading"][aria-level="1"], [aria-level="1"], .v2-home-greet-title');
  const count = await locator.count();
  for (let i = 0; i < count; i += 1) {
    const node = locator.nth(i);
    if (!(await node.isVisible().catch(() => false))) continue;
    const text = norm(await node.innerText().catch(() => ''));
    if (matchesCopy(text, names)) return { locator: node, text };
  }
  return null;
}

async function findButton(page, names) {
  const locator = page.locator('button, uni-button, [role="button"]');
  const count = await locator.count();
  for (let i = 0; i < count; i += 1) {
    const node = locator.nth(i);
    if (!(await node.isVisible().catch(() => false))) continue;
    const text = norm(await node.innerText().catch(() => ''));
    const aria = norm(await node.getAttribute('aria-label').catch(() => ''));
    if (matchesCopy(text, names) || matchesCopy(aria, names)) return node;
  }
  return null;
}

async function findSearchInput(page) {
  const locator = page.locator('input, [role="searchbox"]');
  const count = await locator.count();
  let fallback = null;
  for (let i = 0; i < count; i += 1) {
    const node = locator.nth(i);
    if (!(await node.isVisible().catch(() => false))) continue;
    const type = String(await node.getAttribute('type').catch(() => '') || '').toLowerCase();
    const placeholder = norm(await node.getAttribute('placeholder').catch(() => ''));
    const aria = norm(await node.getAttribute('aria-label').catch(() => ''));
    if (type === 'search' || matchesCopy(placeholder, COPY.search) || matchesCopy(aria, COPY.search)) return node;
    if (!fallback && !['hidden', 'password', 'email', 'checkbox', 'radio'].includes(type)) fallback = node;
  }
  return fallback;
}

async function bodyText(page) {
  return page.evaluate(() => (document.body && document.body.innerText) || '');
}

async function waitForText(page, names, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const text = await bodyText(page);
    if (matchesCopy(text, names)) return text;
    await page.waitForTimeout(150);
  }
  return null;
}

async function textInViewport(page, names) {
  return page.evaluate((wanted) => {
    const normText = (value) => String(value || '').replace(/\s+/g, ' ').trim();
    const nodes = Array.from(document.querySelectorAll('*')).filter((node) => {
      const text = normText(node.textContent);
      if (!wanted.some((name) => text === name || text.includes(name))) return false;
      return !Array.from(node.children).some((child) => wanted.some((name) => {
        const childText = normText(child.textContent);
        return childText === name || childText.includes(name);
      }));
    });
    return nodes.some((node) => {
      const rect = node.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rect.top < window.innerHeight && rect.bottom > 0;
    });
  }, names);
}

async function waitReadyUi(page, fixture, item) {
  const deadline = Date.now() + 25000;
  while (Date.now() < deadline) {
    const heading = await findHeading(page, COPY.h1);
    const homeStatuses = fixture.report.requests.filter((entry) => entry.caseId === item.id && entry.path === '/api/v1/learner/home').map((entry) => entry.status);
    if (heading && homeStatuses.includes(200)) return heading;
    await page.waitForTimeout(150);
  }
  return null;
}

async function pageFacts(page) {
  return page.evaluate(() => {
    const normText = (value) => String(value || '').replace(/\s+/g, ' ').trim();
    const shown = (node) => Boolean(node && node.getClientRects().length > 0);
    const skipped = (node) => Boolean(node.closest('uni-tabbar') || node.closest('[aria-hidden="true"]'));
    const box = (node) => {
      const rect = node.getBoundingClientRect();
      return { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) };
    };
    const headings = Array.from(document.querySelectorAll('h1, [role="heading"][aria-level="1"], [aria-level="1"]'))
      .filter((node) => shown(node) && !skipped(node))
      .map((node) => normText(node.innerText || node.textContent));
    const textNodes = Array.from(document.querySelectorAll('body *')).filter((node) => shown(node) && !skipped(node)
      && Array.from(node.childNodes).some((child) => child.nodeType === 3 && normText(child.textContent)));
    const sizes = textNodes.map((node) => {
      const computed = getComputedStyle(node);
      return {
        tag: node.tagName.toLowerCase(),
        text: normText(node.textContent).slice(0, 100),
        fontSize: parseFloat(computed.fontSize),
        lineHeight: parseFloat(computed.lineHeight),
      };
    }).filter((entry) => Number.isFinite(entry.fontSize) && entry.fontSize > 0);
    const buttons = Array.from(document.querySelectorAll('button, uni-button, [role="button"]'))
      .filter((node) => shown(node) && !skipped(node))
      .map((node) => {
        const computed = getComputedStyle(node);
        return {
          text: normText(node.innerText || node.textContent).slice(0, 80),
          aria: normText(node.getAttribute('aria-label')),
          disabled: node.hasAttribute('disabled') || node.getAttribute('aria-disabled') === 'true',
          rect: box(node),
          fontSize: computed.fontSize,
          lineHeight: computed.lineHeight,
        };
      });
    const inputs = Array.from(document.querySelectorAll('input, [role="searchbox"]'))
      .filter((node) => shown(node) && !skipped(node))
      .map((node) => ({ type: node.getAttribute('type'), placeholder: normText(node.getAttribute('placeholder')), aria: normText(node.getAttribute('aria-label')), rect: box(node) }));
    const overflow = [];
    for (const node of Array.from(document.querySelectorAll('body *'))) {
      if (!(node instanceof HTMLElement) || skipped(node) || !shown(node)) continue;
      if (node.scrollWidth <= node.clientWidth + 1 && node.scrollHeight <= node.clientHeight + 1) continue;
      const computed = getComputedStyle(node);
      overflow.push({
        tag: node.tagName.toLowerCase(),
        class: String(node.getAttribute('class') || '').slice(0, 120),
        text: normText(node.textContent).slice(0, 100),
        clientWidth: node.clientWidth,
        scrollWidth: node.scrollWidth,
        clientHeight: node.clientHeight,
        scrollHeight: node.scrollHeight,
        overflowX: computed.overflowX,
        overflowY: computed.overflowY,
      });
    }
    return {
      text: normText(document.body.innerText).slice(0, 6000),
      bodyTextLength: normText(document.body.innerText).length,
      headings,
      sizes,
      minFontSize: sizes.length ? Math.min(...sizes.map((entry) => entry.fontSize)) : null,
      body16_24Count: sizes.filter((entry) => entry.fontSize === 16 && entry.lineHeight === 24).length,
      buttons,
      inputs,
      overflowCount: overflow.length,
      overflow: overflow.slice(0, 30),
      documentScroll: { scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth },
    };
  });
}

async function taskButtonInfo(page, title) {
  return page.evaluate((wanted) => {
    const normText = (value) => String(value || '').replace(/\s+/g, ' ').trim();
    const nodes = Array.from(document.querySelectorAll('*')).filter((node) => normText(node.textContent) === wanted
      && !Array.from(node.children).some((child) => normText(child.textContent) === wanted));
    const node = nodes[0];
    if (!node) return { found: false, title: wanted };
    for (let depth = 0, ancestor = node; ancestor && depth < 8; depth += 1, ancestor = ancestor.parentElement) {
      if (normText(ancestor.textContent).length > 500) break;
      const button = ancestor.matches('button, [role="button"], uni-button')
        ? ancestor
        : ancestor.querySelector('button, [role="button"], uni-button');
      if (button) {
        const rect = button.getBoundingClientRect();
        return {
          found: true,
          title: wanted,
          buttonText: normText(button.innerText || button.textContent),
          disabled: button.hasAttribute('disabled') || button.getAttribute('aria-disabled') === 'true',
          visible: button.getClientRects().length > 0,
          rect: { width: Math.round(rect.width), height: Math.round(rect.height) },
        };
      }
    }
    return { found: true, title: wanted, buttonText: null, disabled: null, visible: false, rect: null };
  }, title);
}

async function clickTaskButton(page, title) {
  return page.evaluate((wanted) => {
    const normText = (value) => String(value || '').replace(/\s+/g, ' ').trim();
    const nodes = Array.from(document.querySelectorAll('*')).filter((node) => normText(node.textContent) === wanted
      && !Array.from(node.children).some((child) => normText(child.textContent) === wanted));
    const node = nodes[0];
    if (!node) return { clicked: false, reason: 'title-not-found' };
    for (let depth = 0, ancestor = node; ancestor && depth < 8; depth += 1, ancestor = ancestor.parentElement) {
      if (normText(ancestor.textContent).length > 500) break;
      const button = ancestor.matches('button, [role="button"], uni-button')
        ? ancestor
        : ancestor.querySelector('button, [role="button"], uni-button');
      if (!button) continue;
      if (button.hasAttribute('disabled') || button.getAttribute('aria-disabled') === 'true') return { clicked: false, disabled: true };
      button.click();
      return { clicked: true, disabled: false };
    }
    return { clicked: false, reason: 'button-not-found' };
  }, title);
}

async function applyTextScale(page, scale) {
  const factor = scale / 100;
  await page.evaluate(({ factor: value }) => {
    const root = document.querySelector('.yx-page') || document.body;
    const nodes = [root, ...root.querySelectorAll('*')];
    const snapshot = nodes.map((node) => {
      const computed = getComputedStyle(node);
      return [node, parseFloat(computed.fontSize), parseFloat(computed.lineHeight)];
    });
    for (const [node, fontSize, lineHeight] of snapshot) {
      if (Number.isFinite(fontSize) && fontSize > 0) node.style.setProperty('font-size', `${fontSize * value}px`, 'important');
      if (Number.isFinite(lineHeight) && lineHeight > 0) node.style.setProperty('line-height', `${lineHeight * value}px`, 'important');
    }
  }, { factor });
  await page.waitForTimeout(250);
}

async function screenshot(page, outDir, name) {
  const full = path.join(outDir, name + '-full.png');
  const viewport = path.join(outDir, name + '-viewport.png');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: full, fullPage: true });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(100);
  await page.screenshot({ path: viewport, fullPage: false });
  return { fullpage: full, viewport };
}

function check(name, ok, detail) {
  checks.push({ name, result: ok ? 'PASS' : 'FAIL', detail: detail || null });
}

function gap(name, note) {
  gaps.push({ name, note });
}

function requestStats(fixture, item) {
  const requests = fixture.report.requests.filter((entry) => entry.caseId === item.id);
  const writes = requests.filter((entry) => entry.method !== 'GET' && entry.method !== 'OPTIONS');
  return {
    requests,
    writes,
    authWrites: writes.filter((entry) => entry.path.startsWith('/api/v1/auth/')),
    domainWrites: writes.filter((entry) => !entry.path.startsWith('/api/v1/auth/')),
    unknown: fixture.report.unknown.filter((entry) => entry.caseId === item.id),
    homeStatuses: requests.filter((entry) => entry.path === '/api/v1/learner/home').map((entry) => entry.status),
    catalogStatuses: requests.filter((entry) => entry.path === '/api/v1/content/learner/catalog').map((entry) => entry.status),
  };
}

async function runReady(fixture, outDir) {
  const item = await fixture.fresh({ mode: 'ready', caseId: 'ready' });
  const evidence = {};
  try {
    const heading = await waitReadyUi(item.page, fixture, item);
    const expected = item.expected('A');
    await waitForText(item.page, [expected.available], 8000);
    const facts = await pageFacts(item.page);
    const stats = requestStats(fixture, item);
    evidence.heading = heading ? heading.text : null;
    evidence.facts = facts;
    evidence.stats = stats;
    check('ready-login-reaches-home', Boolean(heading), { heading: evidence.heading, url: item.page.url() });
    check('ready-single-h1', facts.headings.length === 1 && matchesCopy(facts.headings[0], COPY.h1), { headings: facts.headings });
    check('ready-home-get-200', stats.homeStatuses.includes(200), { homeStatuses: stats.homeStatuses });
    check('ready-catalog-get-200', stats.catalogStatuses.includes(200), { catalogStatuses: stats.catalogStatuses });
    check('ready-only-published-courses', expected.published.every((title) => facts.text.includes(title)) && !facts.text.includes(expected.unpublished), { expected, unpublishedVisible: facts.text.includes(expected.unpublished) });
    const titles = [expected.available, expected.inProgress, expected.completed, expected.unavailable, expected.locked];
    check('ready-five-task-titles', titles.every((title) => facts.text.includes(title)), { titles });
    const available = await taskButtonInfo(item.page, expected.available);
    const inProgress = await taskButtonInfo(item.page, expected.inProgress);
    check('ready-available-start', Boolean(available.found && available.visible && !available.disabled && matchesCopy(available.buttonText, COPY.start)), available);
    check('ready-inprogress-continue', Boolean(inProgress.found && inProgress.visible && !inProgress.disabled && matchesCopy(inProgress.buttonText, COPY.continue)), inProgress);
    const negative = [expected.completed, expected.unavailable, expected.locked];
    for (const title of negative) {
      const beforeText = await bodyText(item.page);
      const beforeUrl = item.page.url();
      const beforeRequests = fixture.report.requests.filter((entry) => entry.caseId === item.id).length;
      const info = await taskButtonInfo(item.page, title);
      const clicked = await clickTaskButton(item.page, title);
      await item.page.waitForTimeout(200);
      const afterRequests = fixture.report.requests.filter((entry) => entry.caseId === item.id).length;
      const sameUrl = item.page.url() === beforeUrl;
      const noTrigger = (info.disabled === true && clicked.disabled === true) || (afterRequests === beforeRequests && sameUrl && !matchLearn(item.page.url()));
      check('ready-' + title.slice(0, 8) + '-no-trigger', noTrigger, { title, info, clicked, titleVisible: beforeText.includes(title), sameUrl });
    }
    check('ready-body-16-24', facts.body16_24Count >= 3, { body16_24Count: facts.body16_24Count });
    check('ready-aux-min-14', facts.minFontSize !== null && facts.minFontSize >= 14, { minFontSize: facts.minFontSize });
    check('ready-buttons-min-44', facts.buttons.every((button) => button.rect.height >= 44), { buttons: facts.buttons.map((button) => ({ text: button.text, height: button.rect.height })) });
    check('ready-primary-48', facts.buttons.some((button) => button.rect.height >= 48), { buttons: facts.buttons.map((button) => ({ text: button.text, height: button.rect.height })) });
    check('ready-no-unknown-api', stats.unknown.length === 0, { unknown: stats.unknown });
    check('ready-no-page-errors', fixture.report.pageErrors.filter((entry) => entry.caseId === item.id).length === 0, { pageErrors: fixture.report.pageErrors.filter((entry) => entry.caseId === item.id) });
    check('ready-no-console-errors', fixture.report.consoleErrors.filter((entry) => entry.caseId === item.id).length === 0, { consoleErrors: fixture.report.consoleErrors.filter((entry) => entry.caseId === item.id) });
    check('ready-zero-domain-writes', stats.domainWrites.length === 0, { domainWrites: stats.domainWrites });
    evidence.screenshot = await screenshot(item.page, outDir, '01-ready');
    return { evidence };
  } finally {
    await item.close().catch(() => {});
  }
}

function matchLearn(url) {
  return String(url || '').includes('/pages/learn/learn');
}

async function runSearch(fixture, outDir) {
  const item = await fixture.fresh({ mode: 'ready', caseId: 'search' });
  const evidence = {};
  try {
    await waitReadyUi(item.page, fixture, item);
    const expected = item.expected('A');
    await waitForText(item.page, [expected.published[0]], 8000);
    const input = await findSearchInput(item.page);
    check('search-real-input-present', Boolean(input), { inputs: (await pageFacts(item.page)).inputs });
    const fill = async (value) => {
      const target = await findSearchInput(item.page);
      if (!target) throw new Error('search input not found');
      await target.click();
      await target.fill(value);
    };
    const visibleCourses = async () => {
      const text = await bodyText(item.page);
      return expected.published.filter((title) => text.includes(title));
    };
    await fill('');
    await item.page.waitForTimeout(160);
    check('search-empty-shows-both-published', (await visibleCourses()).length === 2, { visible: await visibleCourses() });
    await fill('AIRPORT');
    await item.page.waitForTimeout(160);
    check('search-case-insensitive', (await visibleCourses()).length === 1 && (await visibleCourses())[0] === expected.published[0], { visible: await visibleCourses() });
    await fill('机场');
    await item.page.waitForTimeout(160);
    check('search-chinese', (await visibleCourses()).length === 1, { visible: await visibleCourses() });
    await fill('NO_MATCH_QA');
    const immediate = await visibleCourses();
    await item.page.waitForTimeout(160);
    const settled = await visibleCourses();
    check('search-no-match-settled', settled.length === 0, { immediate, settled });
    const clear = await findButton(item.page, COPY.clear);
    check('search-clear-visible', Boolean(clear), { immediate });
    if (clear) {
      await clear.click();
      await item.page.waitForTimeout(160);
      check('search-pointer-clear-restores', (await visibleCourses()).length === 2, { visible: await visibleCourses() });
    } else {
      check('search-pointer-clear-restores', false, { reason: 'clear button not found' });
    }
    await fill('NO_MATCH_QA');
    await item.page.waitForTimeout(160);
    const clearSpace = await findButton(item.page, COPY.clear);
    if (clearSpace) {
      await clearSpace.focus();
      await item.page.keyboard.press('Space');
      await item.page.waitForTimeout(160);
      check('search-space-clear-restores', (await visibleCourses()).length === 2, { visible: await visibleCourses() });
    } else {
      check('search-space-clear-restores', false, { reason: 'clear button not found' });
    }
    await fill('NO_MATCH_QA');
    await item.page.waitForTimeout(160);
    const clearEnter = await findButton(item.page, COPY.clear);
    if (clearEnter) {
      await clearEnter.focus();
      await item.page.keyboard.press('Enter');
      await item.page.waitForTimeout(160);
      check('search-enter-clear-restores', (await visibleCourses()).length === 2, { visible: await visibleCourses() });
    } else {
      check('search-enter-clear-restores', false, { reason: 'clear button not found' });
    }
    await fill('');
    await item.page.waitForTimeout(160);
    await applyTextScale(item.page, 200);
    const scaled = await pageFacts(item.page);
    const longCourse = scaled.text.includes(expected.published[0]);
    const courseOverflow = scaled.overflow.filter((entry) => entry.text.includes('airport') || entry.text.includes('值机'));
    check('search-text200-long-text-present', longCourse, { longCourse });
    check('search-text200-no-horizontal-overflow', scaled.documentScroll.scrollWidth <= scaled.documentScroll.clientWidth + 1 && courseOverflow.length === 0, { documentScroll: scaled.documentScroll, courseOverflow });
    evidence.scaled = scaled;
    await screenshot(item.page, outDir, '01-search-text200');
    const beforeDetail = fixture.report.requests.filter((entry) => entry.caseId === item.id && entry.path.startsWith('/api/v1/content/learner/')).length;
    await item.page.getByText(expected.published[0], { exact: false }).first().click();
    await item.page.waitForFunction(() => location.hash.includes('/pages/learn/learn'), null, { timeout: 15000 }).catch(() => {});
    let afterDetail = beforeDetail;
    const detailDeadline = Date.now() + 8000;
    while (afterDetail <= beforeDetail && Date.now() < detailDeadline) {
      await item.page.waitForTimeout(200);
      afterDetail = fixture.report.requests.filter((entry) => entry.caseId === item.id && entry.path.startsWith('/api/v1/content/learner/')).length;
    }
    await item.page.waitForTimeout(300);
    const learnText = await bodyText(item.page);
    check('search-course-click-learn-url', matchLearn(item.page.url()), { url: item.page.url() });
    check('search-course-click-learn-dom', learnText.includes(expected.published[0]) && learnText.length > 20, { excerpt: learnText.slice(0, 300) });
    check('search-course-click-learn-get', afterDetail > beforeDetail, { beforeDetail, afterDetail });
    evidence.learn = { url: item.page.url(), excerpt: learnText.slice(0, 500), warnings: fixture.report.consoleWarnings.filter((entry) => entry.caseId === item.id) };
    check('search-no-unknown-api', requestStats(fixture, item).unknown.length === 0, { unknown: requestStats(fixture, item).unknown });
    check('search-no-page-errors', fixture.report.pageErrors.filter((entry) => entry.caseId === item.id).length === 0, { pageErrors: fixture.report.pageErrors.filter((entry) => entry.caseId === item.id) });
    return { evidence };
  } finally {
    await item.close().catch(() => {});
  }
}

async function runRetry(fixture, outDir) {
  const item = await fixture.fresh({ mode: 'retry503Hold', waitReady: false, caseId: 'retry' });
  const evidence = {};
  try {
    const retry = await waitForButton(item.page, COPY.retry, 15000);
    const initialText = await bodyText(item.page);
    const stats = requestStats(fixture, item);
    check('retry-first-home-503', stats.homeStatuses.includes(503), { homeStatuses: stats.homeStatuses });
    check('retry-light-error-visible', Boolean(retry) && initialText.length > 0, { excerpt: initialText.slice(0, 300) });
    if (!retry) {
      gap('retry-precondition', 'retry button not found; no further retry steps are claimed.');
      return { evidence };
    }
    const beforeHome = stats.homeStatuses.length;
    await retry.click();
    const received = await item.waitForHold('retry-held', 12000);
    check('retry-held-get-received', Boolean(received), { received });
    const during = await findButton(item.page, COPY.retry);
    const disabled = during ? await during.isDisabled().catch(() => false) : null;
    const beforeRepeat = requestStats(fixture, item).homeStatuses.length;
    for (let i = 0; i < 3; i += 1) {
      if (during) {
        await during.click({ force: true, timeout: 500 }).catch(() => {});
      } else {
        await clickTaskButton(item.page, COPY.retry[0]);
      }
      await item.page.waitForTimeout(120);
    }
    const afterRepeat = requestStats(fixture, item).homeStatuses.length;
    check('retry-button-disabled-while-held', disabled === true || during === null, { buttonPresent: Boolean(during), disabled });
    check('retry-repeat-clicks-zero-new-home-get', afterRepeat === beforeRepeat, { beforeRepeat, afterRepeat });
    const release = await item.releaseHold('retry-held');
    evidence.hold = release;
    check('retry-release-http-200', release.fulfilled === true && release.status === 200, release);
    const heading = await waitReadyUi(item.page, fixture, item);
    check('retry-recovers-ready', Boolean(heading), { heading: heading ? heading.text : null, homeStatuses: requestStats(fixture, item).homeStatuses });
    const consoleErrors = fixture.report.consoleErrors.filter((entry) => entry.caseId === item.id);
    evidence.expectedHttpConsole = consoleErrors.filter((entry) => /503|Failed to load resource/i.test(entry.message));
    evidence.consoleErrors = consoleErrors;
    check('retry-expected-503-console-recorded', evidence.expectedHttpConsole.length > 0, { consoleErrors });
    check('retry-no-page-errors', fixture.report.pageErrors.filter((entry) => entry.caseId === item.id).length === 0, { pageErrors: fixture.report.pageErrors.filter((entry) => entry.caseId === item.id) });
    check('retry-no-unknown-api', requestStats(fixture, item).unknown.length === 0, { unknown: requestStats(fixture, item).unknown });
    check('retry-zero-domain-writes', requestStats(fixture, item).domainWrites.length === 0, { domainWrites: requestStats(fixture, item).domainWrites });
    evidence.screenshot = await screenshot(item.page, outDir, '01-retry-recovered');
    return { evidence };
  } finally {
    await item.close().catch(() => {});
  }
}

async function waitForButton(page, names, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const button = await findButton(page, names);
    if (button) return button;
    await page.waitForTimeout(150);
  }
  return null;
}

async function runEmpty(fixture, outDir) {
  const modes = [
    { mode: 'emptyNO_PLAN', action: COPY.noPlan, name: 'NO_PLAN' },
    { mode: 'NO_CONTENT', action: COPY.noContent, name: 'NO_CONTENT' },
    { mode: 'NO_DUE_REVIEW', action: COPY.noDue, name: 'NO_DUE_REVIEW' },
    { mode: 'COMPLETED', action: COPY.completedAction, name: 'COMPLETED' },
  ];
  const evidence = {};
  for (const spec of modes) {
    const item = await fixture.fresh({ mode: spec.mode, caseId: 'empty-' + spec.name });
    try {
      await waitReadyUi(item.page, fixture, item);
      const text = await bodyText(item.page);
      const facts = await pageFacts(item.page);
      const start = await findButton(item.page, COPY.start);
      const cont = await findButton(item.page, COPY.continue);
      check('empty-' + spec.name + '-no-fabricated-task', !start && !cont, { buttons: facts.buttons.map((button) => button.text) });
      check('empty-' + spec.name + '-no-fabricated-zero-percent', !/(^|[^\d])0\s*%/.test(text), { text: text.slice(0, 400) });
      check('empty-' + spec.name + '-no-fabricated-plan', !text.includes('plan_mb007'), { text: text.slice(0, 400) });
      const action = await waitForButton(item.page, spec.action, 8000);
      check('empty-' + spec.name + '-action-visible', Boolean(action), { actions: spec.action });
      if (action) {
        const before = item.page.url();
        await action.click();
        await item.page.waitForTimeout(500);
        const after = item.page.url();
        if (spec.mode === 'emptyNO_PLAN') {
          check('empty-NO_PLAN-onboarding-outlet', after.includes('/pages/onboarding/onboarding') || (await bodyText(item.page)).includes('学习目标'), { before, after, excerpt: (await bodyText(item.page)).slice(0, 300) });
        } else if (spec.mode === 'NO_CONTENT' || spec.mode === 'NO_DUE_REVIEW') {
          const shelf = await waitForText(item.page, COPY.courses, 4000);
          const shelfInView = await textInViewport(item.page, COPY.courses);
          check('empty-' + spec.name + '-shelf-outlet', Boolean(shelf) && shelfInView, { before, after, shelfSeen: Boolean(shelf), shelfInView });
        } else {
          check('empty-COMPLETED-no-self-loop', after === before || after.includes('/pages/home/home') || after.endsWith('#/'), { before, after });
        }
      }
      evidence[spec.name] = { text: text.slice(0, 1000), buttons: facts.buttons, url: item.page.url() };
      if (spec.mode === 'emptyNO_PLAN') evidence.screenshot = await screenshot(item.page, outDir, '01-empty-no-plan');
    } finally {
      await item.close().catch(() => {});
    }
  }
  const stale = await fixture.fresh({ mode: 'stale', caseId: 'empty-stale' });
  try {
    await waitReadyUi(stale.page, fixture, stale);
    const text = await bodyText(stale.page);
    const facts = await pageFacts(stale.page);
    check('stale-no-fabricated-zero-percent', !/(^|[^\d])0\s*%/.test(text), { text: text.slice(0, 400) });
    check('stale-no-fabricated-task', !(await findButton(stale.page, COPY.start)) && !(await findButton(stale.page, COPY.continue)), { buttons: facts.buttons.map((button) => button.text) });
    check('stale-no-fabricated-plan', !text.includes('plan_mb007'), { text: text.slice(0, 400) });
    evidence.STALE = { text: text.slice(0, 1000), buttons: facts.buttons };
  } finally {
    await stale.close().catch(() => {});
  }
  const catalogDown = await fixture.fresh({ mode: 'catalogUNAVAILABLE', waitReady: false, caseId: 'empty-catalog' });
  try {
    await catalogDown.page.waitForTimeout(1500);
    const text = await bodyText(catalogDown.page);
    const stats = requestStats(fixture, catalogDown);
    check('catalog-unavailable-http-503', stats.catalogStatuses.includes(503), { catalogStatuses: stats.catalogStatuses });
    check('catalog-unavailable-no-fabricated-published', !text.includes(catalogDown.expected('A').published[0]), { excerpt: text.slice(0, 400) });
    evidence.CATALOG_UNAVAILABLE = { text: text.slice(0, 800), stats };
    evidence.screenshotCatalog = await screenshot(catalogDown.page, outDir, '01-catalog-unavailable');
  } finally {
    await catalogDown.close().catch(() => {});
  }
  return { evidence };
}

async function runAuth(fixture, outDir) {
  const evidence = {};
  const forbidden = await fixture.fresh({ mode: 'home403', waitReady: false, waitForHomeUrl: false, caseId: 'auth-403' });
  try {
    await waitForText(forbidden.page, ['403', '没有访问权限', 'Forbidden', 'Access is not allowed'], 10000);
    const text = await bodyText(forbidden.page);
    const stats = requestStats(fixture, forbidden);
    const back = await findButton(forbidden.page, COPY.backLogin);
    check('auth-403-forbidden-visible', /403|没有访问权限|forbidden/i.test(text) || forbidden.page.url().includes('/pages/forbidden/forbidden'), { url: forbidden.page.url(), excerpt: text.slice(0, 300) });
    check('auth-403-old-data-hidden', !text.includes(forbidden.expected('A').available), { excerpt: text.slice(0, 300) });
    check('auth-403-secondary-exit', Boolean(back), { buttons: (await pageFacts(forbidden.page)).buttons });
    check('auth-403-zero-domain-writes', stats.domainWrites.length === 0, { domainWrites: stats.domainWrites });
    if (forbidden.state.permissionGap) {
      gap('auth-403-permission-contract', 'fixture returned synthetic HTTP 403 for learner.home.read; this harness does not assert a formal permission-error envelope or claim a product contract defeat.');
    }
    evidence.forbidden = { text: text.slice(0, 800), url: forbidden.page.url(), stats };
    evidence.screenshot403 = await screenshot(forbidden.page, outDir, '01-auth-403');
  } finally {
    await forbidden.close().catch(() => {});
  }
  const unauthorized = await fixture.fresh({ mode: 'home401', waitReady: false, waitForHomeUrl: false, caseId: 'auth-401' });
  try {
    await unauthorized.page.locator('#mobile-login-identifier').waitFor({ timeout: 15000 });
    const text = await bodyText(unauthorized.page);
    const stats = requestStats(fixture, unauthorized);
    check('auth-401-login-redirect', unauthorized.page.url().includes('/pages/login/login') || await unauthorized.page.locator('#mobile-login-identifier').isVisible().catch(() => false), { url: unauthorized.page.url(), excerpt: text.slice(0, 300) });
    check('auth-401-old-data-hidden', !text.includes(unauthorized.expected('A').available), { excerpt: text.slice(0, 300) });
    check('auth-401-refresh-401', stats.requests.some((entry) => entry.path === '/api/v1/auth/token/refresh' && entry.status === 401), { requests: stats.requests });
    check('auth-401-zero-domain-writes', stats.domainWrites.length === 0, { domainWrites: stats.domainWrites });
    evidence.unauthorized = { text: text.slice(0, 800), url: unauthorized.page.url(), stats };
    evidence.screenshot401 = await screenshot(unauthorized.page, outDir, '01-auth-401');
  } finally {
    await unauthorized.close().catch(() => {});
  }
  return { evidence };
}

async function runLate(fixture, outDir) {
  const item = await fixture.fresh({ mode: 'ready', owner: 'A', caseId: 'late' });
  const evidence = {};
  try {
    await waitReadyUi(item.page, fixture, item);
    const a = item.expected('A');
    const b = item.expected('B');
    await waitForText(item.page, [a.available], 8000);
    check('late-A-home-ready', (await bodyText(item.page)).includes(a.available), { url: item.page.url() });
    await item.holdNext('/api/v1/learner/home', 'late-A');
    await item.page.getByText(a.published[0], { exact: false }).first().click();
    await item.page.waitForFunction(() => location.hash.includes('/pages/learn/learn'), null, { timeout: 15000 }).catch(() => {});
    await item.page.waitForTimeout(500);
    await item.page.goBack();
    const received = await item.waitForHold('late-A', 12000);
    check('late-old-get-received', Boolean(received), { received });
    if (!received) {
      gap('late-old-get-not-received', 'No held old home GET was received; no late proof is claimed.');
      return { evidence };
    }
    await item.armResponse('/api/v1/content/learner/*', { status: 401, code: 'UNAUTHORIZED' });
    await item.armResponse('/api/v1/auth/token/refresh', { status: 401, code: 'REFRESH_UNAUTHORIZED' });
    await item.page.getByText(a.published[1], { exact: false }).first().click();
    const login = item.page.locator('#mobile-login-identifier');
    const loginSeen = await login.waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
    check('late-real-401-reaches-login', loginSeen, { url: item.page.url(), excerpt: (await bodyText(item.page)).slice(0, 300) });
    if (!loginSeen) {
      gap('late-login-not-reached', 'Real 401/refresh401 did not reach login within 15s; late overlay is NOT_RUN.');
      return { evidence };
    }
    item.switchOwner('B');
    await login.fill('qa-mb007-B');
    await item.page.locator('#mobile-login-password').fill('SyntheticOnly123');
    await item.page.locator('.login-submit').click();
    await item.page.waitForURL((url) => url.hash === '#/' || url.hash.startsWith('#/pages/home/home'), { timeout: 30000 }).catch(() => {});
    await waitForText(item.page, [b.available], 15000);
    const bReady = await waitReadyUi(item.page, fixture, item);
    check('late-B-home-ready', Boolean(bReady) && (await bodyText(item.page)).includes(b.available), { heading: bReady ? bReady.text : null, url: item.page.url() });
    const release = await item.releaseHold('late-A');
    evidence.release = release;
    check('late-old-get-real-http-200', release.fulfilled === true, release);
    if (!release.fulfilled) {
      gap('late-old-get-aborted', 'Held old GET was not delivered as a real 200; aborted is recorded, not treated as late proof.');
      return { evidence };
    }
    await item.page.waitForTimeout(700);
    const text = await bodyText(item.page);
    check('late-A-data-does-not-overwrite-B', !text.includes(a.available) && !text.includes(a.published[0]), { excerpt: text.slice(0, 500) });
    check('late-B-data-intact', text.includes(b.available), { excerpt: text.slice(0, 500) });
    evidence.after = { url: item.page.url(), excerpt: text.slice(0, 800), hold: item.holdSummary() };
    evidence.screenshot = await screenshot(item.page, outDir, '01-late-after-old-release');
    return { evidence };
  } catch (error) {
    gap('late-step-failed', error.message);
    evidence.error = { message: error.message, stack: error.stack || null, url: item.page.url() };
    return { evidence };
  } finally {
    await item.close().catch(() => {});
  }
}

const checks = [];
const gaps = [];

async function main() {
  let config;
  try { config = readConfig(); } catch (error) { return refuse(error.message); }
  const status = await probe(BASE);
  if (!status) return refuse('no dev server answering ' + BASE + ' on the fixed mobile H5 port.');
  let outDir;
  try { outDir = resolveRunDirectory(config.runId); } catch (error) { return refuse(error.message); }

  const fixture = require('./fixture.cjs');
  try {
    await fixture.init();
  } catch (error) {
    await fixture.close().catch(() => {});
    return refuse('browser launch failed (setup): ' + error.message + ' Known DSH spawn EPERM is not retried.');
  }
  try {
    fs.mkdirSync(RUNS_ROOT, { recursive: true });
    fs.mkdirSync(outDir);
  } catch (error) {
    await fixture.close().catch(() => {});
    return refuse('run directory could not be created exclusively: ' + error.message);
  }

  const hashesBefore = hashSet();
  let caseResult;
  try {
    if (CASE === 'ready') caseResult = await runReady(fixture, outDir);
    else if (CASE === 'search') caseResult = await runSearch(fixture, outDir);
    else if (CASE === 'retry') caseResult = await runRetry(fixture, outDir);
    else if (CASE === 'empty') caseResult = await runEmpty(fixture, outDir);
    else if (CASE === 'auth') caseResult = await runAuth(fixture, outDir);
    else caseResult = await runLate(fixture, outDir);
  } catch (error) {
    check('case-completed-without-exception', false, { message: error.message, stack: error.stack || null });
    caseResult = { evidence: { error: { message: error.message, stack: error.stack || null } } };
  }

  let closed = false;
  try { await fixture.close(); closed = true; } catch (error) {
    check('browser-closed-cleanly', false, { error: error.message });
  }
  check('browser-closed-cleanly', closed === true, { closed });

  const hashesAfter = hashSet();
  const sourcesStable = JSON.stringify(hashesBefore) === JSON.stringify(hashesAfter);
  check('source-and-deps-hashes-stable', sourcesStable, { before: hashesBefore, after: hashesAfter });

  const caseRequests = fixture.report.requests.filter((entry) => String(entry.caseId || '').startsWith(CASE) || entry.caseId === CASE || String(entry.caseId || '').startsWith(CASE + '-'));
  const unknown = fixture.report.unknown.filter((entry) => String(entry.caseId || '').startsWith(CASE) || entry.caseId === CASE || String(entry.caseId || '').startsWith(CASE + '-'));
  const writes = caseRequests.filter((entry) => entry.method !== 'GET' && entry.method !== 'OPTIONS');
  const failed = checks.filter((entry) => entry.result === 'FAIL');
  const result = failed.length ? 'FAIL' : gaps.length ? 'GAP' : checks.length ? 'PASS' : 'NOT_RUN';

  const payload = {
    scope: 'MB007_QA_' + CASE.toUpperCase(),
    preparedBy: 'DSH author session (prepared, not executed)',
    preparedAt: '2026-10-21',
    case: CASE,
    runId: config.runId,
    runDirectory: outDir,
    at: new Date().toISOString(),
    base: BASE,
    expectedHashes: config.expected,
    observedHashes: config.actual,
    sourceHashesBefore: hashesBefore,
    sourceHashesAfter: hashesAfter,
    sourcesStable,
    checks,
    gaps,
    result,
    evidence: caseResult ? caseResult.evidence : null,
    api: {
      requestCount: caseRequests.length,
      unknownCount: unknown.length,
      unknown,
      writeCount: writes.length,
      authWrites: writes.filter((entry) => entry.path.startsWith('/api/v1/auth/')),
      domainWrites: writes.filter((entry) => !entry.path.startsWith('/api/v1/auth/')),
      requests: caseRequests,
    },
    consoleWarnings: fixture.report.consoleWarnings.filter((entry) => String(entry.caseId || '').startsWith(CASE) || entry.caseId === CASE || String(entry.caseId || '').startsWith(CASE + '-')),
    consoleErrors: fixture.report.consoleErrors.filter((entry) => String(entry.caseId || '').startsWith(CASE) || entry.caseId === CASE || String(entry.caseId || '').startsWith(CASE + '-')),
    pageErrors: fixture.report.pageErrors.filter((entry) => String(entry.caseId || '').startsWith(CASE) || entry.caseId === CASE || String(entry.caseId || '').startsWith(CASE + '-')),
    closed,
    exitCode: result === 'PASS' ? 0 : result === 'FAIL' ? 1 : 2,
  };
  try {
    fs.writeFileSync(path.join(outDir, 'results.json'), JSON.stringify(payload, null, 2));
  } catch (error) {
    console.error('RESULT WRITE FAILED: ' + error.message);
    return 1;
  }
  console.log(JSON.stringify({
    case: CASE,
    absoluteOutputPath: outDir,
    result,
    checks: checks.length,
    failed: failed.map((entry) => entry.name),
    gaps,
    closed,
    sourcesStable,
    unknownApiCount: unknown.length,
    results: path.join(outDir, 'results.json'),
  }, null, 2));
  return payload.exitCode;
}

if (require.main === module) {
  main().then((code) => { process.exitCode = code; }).catch((error) => {
    console.error('UNEXPECTED FAILURE: ' + (error && error.stack ? error.stack : error));
    process.exitCode = 1;
  });
}

module.exports = { main, runReady, runSearch, runRetry, runEmpty, runAuth, runLate, pageFacts, CASES };
