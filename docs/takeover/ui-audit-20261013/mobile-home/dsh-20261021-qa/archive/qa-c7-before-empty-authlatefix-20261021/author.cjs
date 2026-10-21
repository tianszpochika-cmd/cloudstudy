// MB007 QA case runner. PREPARED ONLY: the author session did not launch a
// browser. Requiring this file performs no launch and no environment checks.
//
// One case per invocation:
//   node author.cjs --case ready|search|navigation|retry|empty|auth|late|late-same|plan-late|learn-late|learn-retry
//
// Required environment:
//   MB007_CONFIRM_BROWSER=1
//   EXPECTED_HOME_SHA=<raw sha256 of apps/mobile/src/pages/home/home.vue>
//   EXPECTED_I18N_SHA=<raw sha256 of packages/i18n/src/mobile-experience.ts>
//   EXPECTED_STORE_SHA=<raw sha256 of the narrow home store>
//   EXPECTED_RUNTIME_SHA=<raw sha256 of apps/mobile/src/platform/uni-runtime.ts>
//   EXPECTED_LEARN_SHA=<raw sha256 of apps/mobile/src/pages/learn/learn.vue>
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
const CASES = ['ready', 'search', 'navigation', 'retry', 'empty', 'auth', 'late', 'late-same', 'plan-late', 'learn-late', 'learn-retry'];
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
  learn: 'apps/mobile/src/pages/learn/learn.vue',
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
  continue: ['继续', 'Continue'],
  viewCourses: ['查看课程', 'View courses'],
  assessment: ['进入测评', 'Take assessment'],
  guideFact: ['目标已保存，可继续测评。', 'Your goal is saved. You can take the assessment next.'],
  oldGuide: ['目标已保存，下一步进入定级', 'Goal saved. Next is placement'],
  noPlan: ['开始设置', 'Start setup'],
  forbiddenTitle: ['暂时无法确认访问状态', '暂时无法访问这项内容', '暂时无法开始学习', '学习访问已暂停', 'We cannot confirm access', 'This content is not available.', 'Learning is not available yet', 'Learning access is paused'],
  forbiddenAction: ['管理账号', '帮助与反馈', '退出登录', 'Manage account', 'Help and feedback', 'Sign out'],
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
    runtime: String(process.env.EXPECTED_RUNTIME_SHA || '').trim().toLowerCase(),
    learn: String(process.env.EXPECTED_LEARN_SHA || '').trim().toLowerCase(),
  };
  for (const [key, value] of Object.entries(expected)) {
    if (!/^[0-9a-f]{64}$/.test(value)) throw new Error('EXPECTED_' + key.toUpperCase() + '_SHA must be explicit 64-lowercase-hex; no default/auto-accept.');
  }
  const actual = {
    home: sha256File(HOME_FILE),
    i18n: sha256File(I18N_FILE),
    store: sha256File(STORE_FILE),
    runtime: sha256File(FILES.runtime),
    learn: sha256File(FILES.learn),
  };
  for (const key of ['home', 'i18n', 'store', 'runtime', 'learn']) {
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
    const rows = Array.from(document.querySelectorAll('.home-task'));
    const matches = rows.filter((entry) => normText(entry.querySelector('.home-task__title')?.textContent) === wanted);
    const row = matches[0];
    if (!row) return { found: false, row: false, rowCount: 0, title: wanted };
    const button = row.querySelector('.home-task__primary, .home-task__secondary, button, [role="button"], uni-button');
    const state = row.querySelector('.home-task__state');
    const rect = button ? button.getBoundingClientRect() : null;
    return {
      found: true,
      row: true,
      rowCount: matches.length,
      title: wanted,
      stateText: normText(state?.textContent),
      buttonText: button ? normText(button.innerText || button.textContent) : null,
      disabled: button ? (button.hasAttribute('disabled') || button.getAttribute('aria-disabled') === 'true') : null,
      visible: button ? button.getClientRects().length > 0 : false,
      rect: rect ? { width: Math.round(rect.width), height: Math.round(rect.height) } : null,
    };
  }, title);
}

async function clickTaskButton(page, title) {
  return page.evaluate((wanted) => {
    const normText = (value) => String(value || '').replace(/\s+/g, ' ').trim();
    const rows = Array.from(document.querySelectorAll('.home-task'));
    const row = rows.find((entry) => normText(entry.querySelector('.home-task__title')?.textContent) === wanted);
    if (!row) return { clicked: false, reason: 'row-not-found' };
    const button = row.querySelector('.home-task__primary, .home-task__secondary, button, [role="button"], uni-button');
    if (!button) return { clicked: false, disabled: false, reason: 'no-button' };
    if (button.hasAttribute('disabled') || button.getAttribute('aria-disabled') === 'true') return { clicked: false, disabled: true };
    button.click();
    return { clicked: true, disabled: false };
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

async function countVisibleButtons(page, names) {
  return page.evaluate((wanted) => {
    const normText = (value) => String(value || '').replace(/\s+/g, ' ').trim();
    const nodes = Array.from(document.querySelectorAll('button, uni-button, [role="button"]')).filter((node) => node.getClientRects().length > 0);
    return nodes.filter((node) => {
      const text = normText(node.innerText || node.textContent);
      const aria = normText(node.getAttribute('aria-label'));
      return wanted.some((name) => text === name || text.includes(name) || aria === name || aria.includes(name));
    }).length;
  }, names);
}

function inCase(entry, caseName) {
  return Boolean(entry && entry.caseKey && String(entry.caseKey).startsWith(caseName));
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
    check('ready-available-start', Boolean(available.row && available.visible && !available.disabled && matchesCopy(available.buttonText, COPY.start)), available);
    check('ready-inprogress-continue', Boolean(inProgress.row && inProgress.visible && !inProgress.disabled && matchesCopy(inProgress.buttonText, COPY.continue)), inProgress);
    const negative = [expected.completed, expected.unavailable, expected.locked];
    for (const title of negative) {
      const beforeUrl = item.page.url();
      const beforeRequests = fixture.report.requests.filter((entry) => entry.caseId === item.id).length;
      const info = await taskButtonInfo(item.page, title);
      const clicked = await clickTaskButton(item.page, title);
      await item.page.waitForTimeout(200);
      const afterRequests = fixture.report.requests.filter((entry) => entry.caseId === item.id).length;
      const sameUrl = item.page.url() === beforeUrl;
      const statePresent = Boolean(info.row && info.rowCount === 1 && info.stateText);
      const noButtonOrDisabled = !info.buttonText || info.disabled === true;
      const noTrigger = statePresent && noButtonOrDisabled && afterRequests === beforeRequests && sameUrl;
      check('ready-' + title.slice(0, 8) + '-no-trigger', noTrigger, { title, info, clicked, statePresent, noButtonOrDisabled, sameUrl });
    }
    check('ready-body-16-24', facts.body16_24Count >= 3, { body16_24Count: facts.body16_24Count });
    check('ready-aux-min-14', facts.minFontSize !== null && facts.minFontSize >= 14, { minFontSize: facts.minFontSize });
    check('ready-buttons-min-44', facts.buttons.every((button) => button.rect.height >= 44), { buttons: facts.buttons.map((button) => ({ text: button.text, height: button.rect.height })) });
    check('ready-primary-48', Boolean(available.rect && available.rect.height >= 48), { primary: available, buttons: facts.buttons.map((button) => ({ text: button.text, height: button.rect.height })) });
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
    const clipping = await item.page.evaluate(() => {
      const normText = (value) => String(value || '').replace(/\s+/g, ' ').trim();
      const nodes = Array.from(document.querySelectorAll('.home-course__title, .home-course__desc, .home-task__title, .home-task__desc, .home-task__meta, button'));
      return nodes.filter((node) => !node.closest('uni-tabbar') && node.getClientRects().length > 0).flatMap((node) => {
        const computed = getComputedStyle(node);
        const hiddenX = computed.overflowX !== 'visible' && node.scrollWidth > node.clientWidth + 1;
        const hiddenY = computed.overflowY !== 'visible' && node.scrollHeight > node.clientHeight + 1;
        if (!hiddenX && !hiddenY) return [];
        return [{ tag: node.tagName.toLowerCase(), class: String(node.getAttribute('class') || '').slice(0, 120), text: normText(node.textContent).slice(0, 100), hiddenX, hiddenY, clientWidth: node.clientWidth, scrollWidth: node.scrollWidth, clientHeight: node.clientHeight, scrollHeight: node.scrollHeight, overflowX: computed.overflowX, overflowY: computed.overflowY }];
      });
    });
    const horizontalPageOverflow = scaled.documentScroll.scrollWidth > scaled.documentScroll.clientWidth + 1;
    check('search-text200-long-text-present', longCourse, { longCourse });
    check('search-text200-no-horizontal-overflow', !horizontalPageOverflow && clipping.length === 0, { documentScroll: scaled.documentScroll, horizontalPageOverflow, clipping, verticalShellOnly: scaled.overflow.filter((entry) => entry.scrollHeight > entry.clientHeight + 1 && entry.scrollWidth <= entry.clientWidth + 1).length });
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
    await item.page.waitForTimeout(800);
    await item.page.waitForLoadState('networkidle').catch(() => {});
    const settledUnknown = fixture.report.unknown.filter((entry) => entry.caseKey === item.state.caseKey);
    evidence.learn = { url: item.page.url(), excerpt: learnText.slice(0, 500), warnings: fixture.report.consoleWarnings.filter((entry) => entry.caseId === item.id), settledUnknown };
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
    const disabled = during ? await elementDisabled(during) : null;
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
    const home503Paths = new Set(stats.requests.filter((entry) => entry.status === 503).map((entry) => entry.path));
    evidence.expectedHttpConsole = consoleErrors.filter((entry) => entry.path && home503Paths.has(entry.path));
    evidence.unclassifiedConsoleErrors = consoleErrors.filter((entry) => !(entry.path && home503Paths.has(entry.path)));
    evidence.consoleErrors = consoleErrors;
    check('retry-expected-503-console-recorded', evidence.expectedHttpConsole.length > 0, { consoleErrors, home503Paths: [...home503Paths] });
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
    { mode: 'emptyNO_PLAN', name: 'NO_PLAN', action: null, expectAction: false, guide: true, outlet: 'guide-assessment', stateTitle: ['还没有学习计划', 'No learning plan yet'] },
    { mode: 'NO_CONTENT', name: 'NO_CONTENT', action: null, expectAction: false, outlet: 'none', stateTitle: ['暂时没有可学习的内容', 'No learning content available right now'] },
    { mode: 'NO_DUE_REVIEW', name: 'NO_DUE_REVIEW', action: COPY.viewCourses, expectAction: true, outlet: 'shelf', stateTitle: ['今天没有到期的复习', 'No reviews due today'] },
    { mode: 'COMPLETED', name: 'COMPLETED', action: COPY.viewCourses, expectAction: true, outlet: 'shelf-completed', stateTitle: ['今天的学习已经完成', 'Today’s learning is complete', "Today's learning is complete"] },
  ];
  const evidence = {};
  for (const spec of modes) {
    const item = await fixture.fresh({ mode: spec.mode, caseId: 'empty-' + spec.name });
    try {
      await waitReadyUi(item.page, fixture, item);
      if (spec.mode === 'NO_CONTENT') {
        await waitForText(item.page, ['书架里还没有可学习的内容', 'No courses are available yet', '暂时没有可学习的内容', 'No learning content available'], 6000);
      }
      const text = await bodyText(item.page);
      const facts = await pageFacts(item.page);
      const rows = await item.page.locator('.home-task').count();
      const taskButtons = await item.page.evaluate(() => Array.from(document.querySelectorAll('.home-task__primary, .home-task__secondary')).filter((node) => node.getClientRects().length > 0).length);
      const stateTitle = await waitForText(item.page, spec.stateTitle, 6000);
      const action = spec.expectAction ? await waitForButton(item.page, spec.action, 8000) : null;
      const homeBefore = item.page.url().endsWith('#/') || item.page.url().includes('/pages/home/home');
      check('empty-' + spec.name + '-state-visible', Boolean(stateTitle), { stateTitle: spec.stateTitle, excerpt: text.slice(0, 400) });
      check('empty-' + spec.name + '-no-fabricated-task', rows === 0 && taskButtons === 0, { rows, taskButtons, buttons: facts.buttons.map((button) => button.text) });
      check('empty-' + spec.name + '-no-fabricated-zero-percent', !/(^|[^\d])0\s*%/.test(text), { text: text.slice(0, 400) });
      check('empty-' + spec.name + '-no-fabricated-plan', !text.includes('plan_mb007'), { text: text.slice(0, 400) });
      check('empty-' + spec.name + '-home-before', homeBefore, { url: item.page.url(), heading: await findHeading(item.page, COPY.h1) });
      await screenshot(item.page, outDir, '01-empty-' + spec.name + '-home');
      if (spec.guide) {
        const assessmentCount = await countVisibleButtons(item.page, COPY.assessment);
        const guideFactText = await waitForText(item.page, COPY.guideFact, 6000);
        const startSetup = await findButton(item.page, COPY.noPlan);
        check('empty-NO_PLAN-single-assessment-cta', assessmentCount === 1, { assessmentCount, buttons: facts.buttons.map((button) => button.text) });
        check('empty-NO_PLAN-guide-fact', Boolean(guideFactText) && !text.includes(COPY.oldGuide[0]) && !text.includes(COPY.oldGuide[1]), { guideFactText });
        check('empty-NO_PLAN-no-dup-start-setup', !startSetup && !text.includes('先完成设置') && !text.includes('Finish setup first'), { startSetup: Boolean(startSetup) });
        const assessmentButton = await findButton(item.page, COPY.assessment);
        if (assessmentButton) {
          await assessmentButton.click();
          await item.page.waitForFunction(() => location.hash.includes('/pages/assessment/assessment'), null, { timeout: 10000 }).catch(() => {});
          const assessmentText = await bodyText(item.page);
          check('empty-NO_PLAN-guide-to-assessment', item.page.url().includes('/pages/assessment/assessment') && !item.page.url().includes('/pages/onboarding/onboarding') && assessmentText.trim().length > 20, { url: item.page.url(), excerpt: assessmentText.slice(0, 300) });
          check('empty-NO_PLAN-zero-assessment-writes', requestStats(fixture, item).domainWrites.length === 0, { domainWrites: requestStats(fixture, item).domainWrites });
        } else {
          check('empty-NO_PLAN-guide-to-assessment', false, { reason: 'assessment CTA not found' });
        }
      } else if (spec.mode === 'NO_CONTENT') {
        const invalidCta = await findButton(item.page, COPY.viewCourses);
        const courses = await item.page.locator('.home-course').count();
        check('empty-NO_CONTENT-no-invalid-cta', !invalidCta && courses === 0, { invalidCta: Boolean(invalidCta), courses, buttons: facts.buttons.map((button) => button.text) });
      } else {
        check('empty-' + spec.name + '-action-visible', Boolean(action), { actions: spec.action });
      }
      if (action) {
        const before = item.page.url();
        await action.click();
        await item.page.waitForTimeout(500);
        const after = item.page.url();
        if (spec.outlet === 'onboarding') {
          check('empty-NO_PLAN-onboarding-outlet', after.includes('/pages/onboarding/onboarding') || (await bodyText(item.page)).includes('学习目标'), { before, after, excerpt: (await bodyText(item.page)).slice(0, 300) });
        } else {
          const shelf = await waitForText(item.page, COPY.courses, 4000);
          const shelfInView = await textInViewport(item.page, COPY.courses);
          check('empty-' + spec.name + '-shelf-outlet', Boolean(shelf) && shelfInView, { before, after, shelfSeen: Boolean(shelf), shelfInView });
          if (spec.outlet === 'shelf-completed') {
            check('empty-COMPLETED-no-self-loop', shelfInView && (after === before || after.includes('/pages/home/home') || after.endsWith('#/')), { before, after, shelfInView });
          }
        }
      }
      evidence[spec.name] = { text: text.slice(0, 1000), buttons: facts.buttons, url: item.page.url(), actionVisible: Boolean(action), homeBefore };
      if (spec.mode === 'emptyNO_PLAN') evidence.screenshotTarget = await screenshot(item.page, outDir, '02-empty-NO_PLAN-target');
      if (spec.mode === 'COMPLETED') evidence.screenshotTarget = await screenshot(item.page, outDir, '02-empty-COMPLETED-target');
    } finally {
      await item.close().catch(() => {});
    }
  }
  const stale = await fixture.fresh({ mode: 'stale', caseId: 'empty-stale' });
  try {
    await waitReadyUi(stale.page, fixture, stale);
    const text = await bodyText(stale.page);
    const facts = await pageFacts(stale.page);
    const rows = await stale.page.locator('.home-task').count();
    check('stale-no-fabricated-zero-percent', !/(^|[^\d])0\s*%/.test(text), { text: text.slice(0, 400) });
    const staleTaskButtons = await stale.page.evaluate(() => Array.from(document.querySelectorAll('.home-task__primary, .home-task__secondary')).filter((node) => node.getClientRects().length > 0).length);
    check('stale-no-fabricated-task', rows === 0 && staleTaskButtons === 0, { rows, taskButtons: staleTaskButtons, buttons: facts.buttons.map((button) => button.text) });
    check('stale-no-fabricated-plan', !text.includes('plan_mb007'), { text: text.slice(0, 400) });
    evidence.STALE = { text: text.slice(0, 1000), buttons: facts.buttons };
  } finally {
    await stale.close().catch(() => {});
  }
  const catalogDown = await fixture.fresh({ mode: 'catalogUNAVAILABLE', waitReady: false, caseId: 'empty-catalog' });
  try {
    await catalogDown.page.waitForTimeout(1500);
    await waitForText(catalogDown.page, ['课程暂时没能加载', 'Courses could not be loaded', '今日任务暂不可用'], 5000);
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
    await forbidden.page.waitForURL((url) => url.hash.includes('/pages/forbidden/forbidden'), { timeout: 10000 }).catch(() => {});
    const titleLocator = forbidden.page.locator('#mobile-forbidden-title');
    const titleSeen = await titleLocator.waitFor({ timeout: 8000 }).then(() => true).catch(() => false);
    const titleText = titleSeen ? norm(await titleLocator.innerText().catch(() => '')) : '';
    const description = titleSeen ? norm(await forbidden.page.locator('#mobile-forbidden-description').innerText().catch(() => '')) : '';
    const text = await bodyText(forbidden.page);
    const stats = requestStats(fixture, forbidden);
    const secondary = await findButton(forbidden.page, COPY.forbiddenAction);
    const forbiddenUrl = forbidden.page.url().includes('/pages/forbidden/forbidden');
    check('auth-403-forbidden-route', forbiddenUrl, { url: forbidden.page.url(), titleText });
    check('auth-403-signed-h1', titleSeen && matchesCopy(titleText, COPY.forbiddenTitle), { titleText, allowed: COPY.forbiddenTitle });
    check('auth-403-neutral-description', Boolean(description) && !/403|forbidden/i.test(description), { description });
    check('auth-403-old-data-hidden', !text.includes(forbidden.expected('A').available), { excerpt: text.slice(0, 300) });
    check('auth-403-secondary-exit', Boolean(secondary), { buttons: (await pageFacts(forbidden.page)).buttons.map((button) => button.text) });
    check('auth-403-zero-domain-writes', stats.domainWrites.length === 0, { domainWrites: stats.domainWrites });
    if (forbidden.state.permissionGap) {
      gap('auth-403-permission-contract', 'fixture returned synthetic HTTP 403 for learner.home.read; the redesigned forbidden page is checked by its signed H1/neutral copy, but no formal permission-error envelope is asserted.');
    }
    evidence.forbidden = { text: text.slice(0, 800), titleText, description, url: forbidden.page.url(), stats };
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

async function waitForDetailCount(fixture, item, before, timeoutMs = 8000) {
  let after = before;
  const deadline = Date.now() + timeoutMs;
  while (after <= before && Date.now() < deadline) {
    await item.page.waitForTimeout(200);
    after = fixture.report.requests.filter((entry) => entry.caseId === item.id && entry.path.startsWith('/api/v1/content/learner/')).length;
  }
  return after;
}

async function elementDisabled(locator) {
  return locator.evaluate((node) => {
    let current = node;
    for (let depth = 0; current && depth < 5; depth += 1) {
      if (current.hasAttribute && (current.hasAttribute('disabled') || current.getAttribute('aria-disabled') === 'true')) return true;
      current = current.parentElement;
    }
    return false;
  }).catch(() => true);
}

async function goHomeViaUi(page) {
  const from = page.url();
  if (from.endsWith('#/') || from.includes('/pages/home/home')) return { method: 'already-home', from, to: from, preWasHome: true };
  for (const label of ['学习', 'Learn']) {
    const groups = [page.locator('uni-tabbar').getByText(label, { exact: true }), page.locator('[role="tab"]').filter({ hasText: label })];
    for (const locator of groups) {
      const count = await locator.count();
      for (let i = 0; i < count; i += 1) {
        const node = locator.nth(i);
        if (!(await node.isVisible().catch(() => false))) continue;
        if (await elementDisabled(node)) continue;
        await node.click().catch(() => {});
        await page.waitForFunction(() => location.hash === '#/' || location.hash.startsWith('#/pages/home/home'), null, { timeout: 8000 }).catch(() => {});
        if (page.url().endsWith('#/') || page.url().includes('/pages/home/home')) {
          await waitForText(page, COPY.h1, 5000);
          return { method: 'tab', label, from, to: page.url(), preWasHome: false };
        }
      }
    }
  }
  const back = page.locator('.mobile-back, button[aria-label="返回"], button[aria-label="Back"]').first();
  if (await back.isVisible().catch(() => false) && !(await elementDisabled(back))) {
    await back.click().catch(() => {});
    await page.waitForFunction(() => location.hash === '#/' || location.hash.startsWith('#/pages/home/home'), null, { timeout: 8000 }).catch(() => {});
    if (page.url().endsWith('#/') || page.url().includes('/pages/home/home')) {
      await waitForText(page, COPY.h1, 5000);
      return { method: 'header-back', from, to: page.url(), preWasHome: false };
    }
  }
  return { method: 'none', from, to: page.url(), preWasHome: false };
}

function attachHomeResponses(page) {
  const responses = [];
  const finished = [];
  page.on('response', (response) => {
    if (response.url().includes('/api/v1/learner/home')) responses.push({ status: response.status(), at: Date.now() });
  });
  page.on('requestfinished', (request) => {
    if (request.url().includes('/api/v1/learner/home')) finished.push({ at: Date.now() });
  });
  return { responses, finished };
}

async function runNavigation(fixture, outDir) {
  const item = await fixture.fresh({ mode: 'ready', caseId: 'navigation' });
  const evidence = {};
  try {
    await waitReadyUi(item.page, fixture, item);
    const expected = item.expected('A');
    await waitForText(item.page, [expected.available], 8000);
    const primary = item.page.locator('.home-task__primary').first();
    const primaryVisible = await primary.isVisible().catch(() => false);
    const primaryText = primaryVisible ? norm(await primary.innerText().catch(() => '')) : '';
    check('navigation-primary-task-visible', primaryVisible && matchesCopy(primaryText, COPY.start), { primaryText });
    const beforeHome = fixture.report.requests.filter((entry) => entry.caseId === item.id && entry.path === '/api/v1/learner/home').length;
    const beforeDetail = fixture.report.requests.filter((entry) => entry.caseId === item.id && entry.path.startsWith('/api/v1/content/learner/')).length;
    await primary.click();
    await item.page.waitForFunction(() => location.hash.includes('/pages/learn/learn'), null, { timeout: 15000 }).catch(() => {});
    const afterDetail = await waitForDetailCount(fixture, item, beforeDetail);
    await waitForText(item.page, [expected.published[0]], 8000);
    const learnText = await bodyText(item.page);
    check('navigation-primary-learn-get', afterDetail > beforeDetail, { beforeDetail, afterDetail, url: item.page.url() });
    check('navigation-primary-learn-dom', matchLearn(item.page.url()) && learnText.includes(expected.published[0]) && learnText.length > 20, { url: item.page.url(), excerpt: learnText.slice(0, 400) });
    const homeBack = await goHomeViaUi(item.page);
    let afterHome = beforeHome;
    const homeDeadline = Date.now() + 10000;
    while (afterHome <= beforeHome && Date.now() < homeDeadline) {
      await item.page.waitForTimeout(200);
      afterHome = fixture.report.requests.filter((entry) => entry.caseId === item.id && entry.path === '/api/v1/learner/home').length;
    }
    check('navigation-return-home-via-tab', homeBack.method === 'tab' && !homeBack.preWasHome && afterHome > beforeHome, { homeBack, beforeHome, afterHome, url: item.page.url() });
    await waitReadyUi(item.page, fixture, item);
    await waitForText(item.page, [expected.available], 8000);
    const courseTitle = expected.published[1];
    const course = item.page.locator('.home-course').nth(1);
    const courseVisible = await course.isVisible().catch(() => false);
    const courseRowText = courseVisible ? norm(await course.innerText().catch(() => '')) : '';
    check('navigation-course-row-visible', courseVisible && courseRowText.includes(courseTitle), { url: item.page.url(), courseTitle, courseRowText });
    const detailRequestsBefore = fixture.report.requests.filter((entry) => entry.caseId === item.id && entry.path.startsWith('/api/v1/content/learner/'));
    const beforeCourseDetail = detailRequestsBefore.length;
    await course.click();
    await item.page.waitForFunction(() => location.hash.includes('/pages/learn/learn'), null, { timeout: 15000 }).catch(() => {});
    const afterCourseDetail = await waitForDetailCount(fixture, item, beforeCourseDetail);
    await waitForText(item.page, [courseTitle], 8000);
    const courseText = await bodyText(item.page);
    const newDetailPaths = fixture.report.requests.filter((entry) => entry.caseId === item.id && entry.path.startsWith('/api/v1/content/learner/')).slice(beforeCourseDetail).map((entry) => entry.path);
    check('navigation-course-learn-get', afterCourseDetail > beforeCourseDetail, { beforeCourseDetail, afterCourseDetail, newDetailPaths, url: item.page.url() });
    check('navigation-course-learn-new-code', newDetailPaths.includes('/api/v1/content/learner/mb007-course-hotel'), { newDetailPaths, expectedDifferentCode: 'mb007-course-hotel' });
    check('navigation-course-learn-dom', matchLearn(item.page.url()) && courseText.includes(courseTitle) && courseText.length > 20, { url: item.page.url(), courseTitle, excerpt: courseText.slice(0, 400) });
    evidence.navigation = { primaryText, primary: { beforeDetail, afterDetail, learnText: learnText.slice(0, 500) }, course: { courseTitle, beforeCourseDetail, afterCourseDetail, newDetailPaths, courseText: courseText.slice(0, 500) } };
    evidence.screenshot = await screenshot(item.page, outDir, '01-navigation-course-learn');
    return { evidence };
  } finally {
    await item.close().catch(() => {});
  }
}

async function runLate(fixture, outDir) {
  const item = await fixture.fresh({ mode: 'ready', owner: 'A', caseId: 'late' });
  const evidence = {};
  const listeners = attachHomeResponses(item.page);
  try {
    await waitReadyUi(item.page, fixture, item);
    const a = item.expected('A');
    const b = item.expected('B');
    await waitForText(item.page, [a.available], 8000);
    check('late-A-home-ready', (await bodyText(item.page)).includes(a.available), { url: item.page.url() });
    const holdStart = Date.now();
    await item.holdNext('/api/v1/learner/home', 'late-A');
    await item.page.locator('.home-course').first().click();
    await item.page.waitForFunction(() => location.hash.includes('/pages/learn/learn'), null, { timeout: 15000 }).catch(() => {});
    await item.page.waitForTimeout(400);
    const homeBack = await goHomeViaUi(item.page);
    if (homeBack.method !== 'tab' || homeBack.preWasHome) {
      gap('late-return-home-via-tab', 'No real Learn tab from learn to a different home target; late overlay is NOT_RUN.');
      return { evidence };
    }
    await waitForText(item.page, COPY.h1, 8000);
    check('late-return-home-via-tab', true, { homeBack, url: item.page.url() });
    const received = await item.waitForHold('late-A', 12000);
    check('late-old-get-received', Boolean(received), { received });
    if (!received) {
      gap('late-old-get-not-received', 'No held old home GET was received; no late proof is claimed.');
      return { evidence };
    }
    await item.armResponse('/api/v1/learner/profile', { status: 401, code: 'UNAUTHORIZED' });
    await item.armResponse('/api/v1/auth/token/refresh', { status: 401, code: 'REFRESH_UNAUTHORIZED' });
    const leaveProfile = await leaveToProfileViaTab(item.page);
    const login = item.page.locator('#mobile-login-identifier');
    const loginSeen = await login.waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
    check('late-profile-401-reaches-login', loginSeen, { leaveProfile, url: item.page.url(), excerpt: (await bodyText(item.page)).slice(0, 300) });
    if (leaveProfile.method !== 'tab' || !loginSeen) {
      gap('late-profile-401-not-prepared', 'Real Profile tab + /learner/profile 401 + refresh 401 did not reach login; late overlay is NOT_RUN.');
      return { evidence };
    }
    item.switchOwner('B');
    await login.fill('qa-mb007-B');
    await item.page.locator('#mobile-login-password').fill('SyntheticOnly123');
    await item.page.locator('.login-submit').click();
    await item.page.waitForURL((url) => url.hash.includes('/pages/profile/profile'), { timeout: 4000 }).catch(() => {});
    const returnNav = await goHomeViaUi(item.page);
    await waitForText(item.page, [b.available], 15000);
    if (returnNav.method !== 'tab' || returnNav.preWasHome) {
      gap('late-B-return-home', 'B could not reach home through a real Learn tab from returnTo=profile; late overlay is NOT_RUN.');
      return { evidence };
    }
    const bReady = await waitReadyUi(item.page, fixture, item);
    const bHomeText = await bodyText(item.page);
    if (!bReady || !bHomeText.includes(b.available)) {
      gap('late-B-home-not-ready', 'B did not reach a ready home DOM; late overlay is NOT_RUN.');
      return { evidence };
    }
    check('late-B-home-ready', true, { heading: bReady.text, url: item.page.url(), returnNav });
    const principals = fixture.report.principals.filter((entry) => entry.caseKey === item.state.caseKey);
    const subjects = [...new Set(principals.map((entry) => entry.subject))];
    check('late-IAM-subject-switched', subjects.some((subject) => subject.includes('-A-')) && subjects.some((subject) => subject.includes('-B-')) && subjects.length >= 2, { principals });
    const heldMs = Date.now() - holdStart;
    if (heldMs >= 7500) {
      gap('late-held-request-timeout-risk', 'Held old home GET exceeded the client request timeout window; no post-timeout fulfill is claimed as late receipt.');
      return { evidence };
    }
    const releaseAt = Date.now();
    const release = await item.releaseHold('late-A');
    let browserAfter = [];
    const responseDeadline = Date.now() + 4000;
    while (browserAfter.length === 0 && Date.now() < responseDeadline) {
      await item.page.waitForTimeout(200);
      browserAfter = listeners.responses.filter((entry) => entry.at >= releaseAt && entry.status === 200);
    }
    const latePacket = {
      received: Boolean(received),
      fulfilled: release.fulfilled === true,
      aborted: release.aborted === true,
      browserResponseObserved: browserAfter.length > 0,
      browserStatus: browserAfter[0]?.status ?? null,
      browserFinishedAfterRelease: listeners.finished.filter((entry) => entry.at >= releaseAt).length,
      release,
    };
    evidence.latePacket = latePacket;
    evidence.release = release;
    check('late-old-get-real-http-200', release.fulfilled === true, release);
    if (!release.fulfilled) {
      gap('late-old-get-aborted', 'Held old GET was not delivered as a real 200; aborted is recorded, not treated as late proof.');
      return { evidence };
    }
    if (!latePacket.browserResponseObserved) {
      gap('late-browser-response-not-observed', 'route.fulfill resolved but the page response event was not observed; browser receipt is NOT claimed.');
    }
    const text = await bodyText(item.page);
    check('late-A-data-does-not-overwrite-B', !text.includes(a.available) && !text.includes(a.published[0]), { excerpt: text.slice(0, 500) });
    check('late-B-data-intact', text.includes(b.available), { excerpt: text.slice(0, 500) });
    evidence.after = { url: item.page.url(), excerpt: text.slice(0, 800), hold: item.holdSummary(), latePacket };
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

async function runLateSame(fixture, outDir) {
  const item = await fixture.fresh({ mode: 'ready', owner: 'A', payloadSequence: true, caseId: 'late-same' });
  const evidence = {};
  const listeners = attachHomeResponses(item.page);
  try {
    await waitReadyUi(item.page, fixture, item);
    const firstTitle = item.payloadTitle(item.state.payloads);
    await waitForText(item.page, [firstTitle], 8000);
    check('late-same-initial-payload', (await bodyText(item.page)).includes(firstTitle), { firstTitle, payloads: item.state.payloads });
    const holdStart = Date.now();
    await item.holdNext('/api/v1/learner/home', 'same-held');
    await item.page.locator('.home-course').first().click();
    await item.page.waitForFunction(() => location.hash.includes('/pages/learn/learn'), null, { timeout: 15000 }).catch(() => {});
    await item.page.waitForTimeout(400);
    const homeBack = await goHomeViaUi(item.page);
    if (homeBack.method === 'none') {
      gap('late-same-return-home-via-tab', 'No real tab/header return from learn to home; same-owner late overlay is NOT_RUN.');
      return { evidence };
    }
    await waitForText(item.page, COPY.h1, 8000);
    check('late-same-return-home-via-tab', homeBack.method === 'tab' && !homeBack.preWasHome, { homeBack, url: item.page.url() });
    const received = await item.waitForHold('same-held', 12000);
    check('late-same-held-get-received', Boolean(received), { received });
    if (!received) {
      gap('late-same-held-not-received', 'No held same-owner home GET was received; no late proof is claimed.');
      return { evidence };
    }
    const heldPayload = received.payload;
    const beforeHomeCount = item.state.counts.home;
    const leave = await leaveToCoursesViaTab(item.page);
    if (leave.method !== 'tab') {
      gap('late-same-courses-tab-unavailable', 'No real unique uni-tabbar Courses tab to leave home; same-owner late overlay is NOT_RUN.');
      return { evidence };
    }
    check('late-same-leave-via-courses-tab', leave.method === 'tab' && leave.count === 1, leave);
    const returnNav = await goHomeViaUi(item.page);
    if (returnNav.method !== 'tab' || returnNav.preWasHome) {
      gap('late-same-return-home', 'No real Learn tab from Courses back to a different home target; same-owner late overlay is NOT_RUN.');
      return { evidence };
    }
    await waitForText(item.page, COPY.h1, 8000);
    let homeCount = item.state.counts.home;
    const homeDeadline = Date.now() + 10000;
    while (homeCount <= beforeHomeCount && Date.now() < homeDeadline) {
      await item.page.waitForTimeout(200);
      homeCount = item.state.counts.home;
    }
    check('late-same-new-home-get', homeCount > beforeHomeCount, { beforeHomeCount, homeCount, returnNav, url: item.page.url() });
    let latest = item.state.payloads;
    const deadline = Date.now() + 12000;
    while (latest <= heldPayload && Date.now() < deadline) {
      await item.page.waitForTimeout(200);
      latest = item.state.payloads;
    }
    const latestTitle = item.payloadTitle(latest);
    await waitForText(item.page, [latestTitle], 8000);
    check('late-same-newer-payload-visible', latest > heldPayload && (await bodyText(item.page)).includes(latestTitle), { heldPayload, latest, latestTitle, returnNav, url: item.page.url() });
    const heldMs = Date.now() - holdStart;
    if (heldMs >= 7500) {
      gap('late-same-held-request-timeout-risk', 'Held same-owner home GET exceeded the client request timeout window; no post-timeout fulfill is claimed as late receipt.');
      return { evidence };
    }
    const releaseAt = Date.now();
    const release = await item.releaseHold('same-held');
    let browserAfter = [];
    const responseDeadline = Date.now() + 4000;
    while (browserAfter.length === 0 && Date.now() < responseDeadline) {
      await item.page.waitForTimeout(200);
      browserAfter = listeners.responses.filter((entry) => entry.at >= releaseAt && entry.status === 200);
    }
    const latePacket = {
      received: Boolean(received),
      fulfilled: release.fulfilled === true,
      aborted: release.aborted === true,
      browserResponseObserved: browserAfter.length > 0,
      browserStatus: browserAfter[0]?.status ?? null,
      browserFinishedAfterRelease: listeners.finished.filter((entry) => entry.at >= releaseAt).length,
      release,
      heldPayload,
      latest,
    };
    evidence.latePacket = latePacket;
    check('late-same-old-get-real-http-200', release.fulfilled === true && release.payload === heldPayload, release);
    if (!release.fulfilled) {
      gap('late-same-old-get-aborted', 'Held same-owner GET was not delivered as a real 200; aborted is recorded, not treated as late proof.');
      return { evidence };
    }
    if (!latePacket.browserResponseObserved) {
      gap('late-same-browser-response-not-observed', 'route.fulfill resolved but the page response event was not observed; browser receipt is NOT claimed.');
    }
    const text = await bodyText(item.page);
    check('late-same-newer-data-not-overwritten', text.includes(latestTitle) && !text.includes(item.payloadTitle(heldPayload)), { excerpt: text.slice(0, 600), heldPayload, latest });
    evidence.after = { url: item.page.url(), excerpt: text.slice(0, 800), hold: item.holdSummary(), latePacket };
    evidence.screenshot = await screenshot(item.page, outDir, '01-late-same-after-old-release');
    return { evidence };
  } catch (error) {
    gap('late-same-step-failed', error.message);
    evidence.error = { message: error.message, stack: error.stack || null, url: item.page.url() };
    return { evidence };
  } finally {
    await item.close().catch(() => {});
  }
}

function attachContentResponses(page) {
  const responses = [];
  const finished = [];
  page.on('response', (response) => {
    if (response.url().includes('/api/v1/content/learner/')) responses.push({ status: response.status(), url: response.url(), at: Date.now() });
  });
  page.on('requestfinished', (request) => {
    if (request.url().includes('/api/v1/content/learner/')) finished.push({ url: request.url(), at: Date.now() });
  });
  return { responses, finished };
}

async function runLearnLate(fixture, outDir) {
  const item = await fixture.fresh({ mode: 'ready', caseId: 'learn-late' });
  const evidence = {};
  const listeners = attachContentResponses(item.page);
  try {
    await waitReadyUi(item.page, fixture, item);
    const expected = item.expected('A');
    await waitForText(item.page, [expected.published[0]], 8000);
    const holdStart = Date.now();
    await item.holdNext('/api/v1/content/learner/mb007-course-airport', 'learn-A');
    await item.page.locator('.home-course').nth(0).click();
    await item.page.waitForFunction(() => location.hash.includes('/pages/learn/learn'), null, { timeout: 15000 }).catch(() => {});
    await item.page.waitForTimeout(500);
    const leave = await goHomeViaUi(item.page);
    if (leave.method !== 'tab' || leave.preWasHome) {
      gap('learn-late-return-home', 'No real Learn tab from learn back to home; learn-late is NOT_RUN.');
      return { evidence };
    }
    await waitForText(item.page, [expected.available], 8000);
    const beforeB = fixture.report.requests.filter((entry) => entry.caseId === item.id && entry.path.startsWith('/api/v1/content/learner/')).length;
    await item.page.locator('.home-course').nth(1).click();
    await item.page.waitForFunction(() => location.hash.includes('/pages/learn/learn'), null, { timeout: 15000 }).catch(() => {});
    let afterB = beforeB;
    const bDeadline = Date.now() + 10000;
    while (afterB <= beforeB && Date.now() < bDeadline) {
      await item.page.waitForTimeout(200);
      afterB = fixture.report.requests.filter((entry) => entry.caseId === item.id && entry.path.startsWith('/api/v1/content/learner/')).length;
    }
    await waitForText(item.page, [expected.published[1]], 10000);
    const bText = await bodyText(item.page);
    const bPaths = fixture.report.requests.filter((entry) => entry.caseId === item.id && entry.path.startsWith('/api/v1/content/learner/')).slice(beforeB).map((entry) => entry.path);
    check('learn-late-B-new-get', afterB > beforeB && bPaths.includes('/api/v1/content/learner/mb007-course-hotel'), { beforeB, afterB, bPaths });
    check('learn-late-B-new-dom', bText.includes(expected.published[1]) && !bText.includes(expected.published[0]), { excerpt: bText.slice(0, 500) });
    const heldMs = Date.now() - holdStart;
    if (heldMs >= 7500) {
      gap('learn-late-held-request-timeout-risk', 'Held course GET exceeded client request timeout; no post-timeout fulfill is claimed.');
      return { evidence };
    }
    const releaseAt = Date.now();
    const release = await item.releaseHold('learn-A');
    let browserAfter = [];
    const responseDeadline = Date.now() + 4000;
    while (browserAfter.length === 0 && Date.now() < responseDeadline) {
      await item.page.waitForTimeout(200);
      browserAfter = listeners.responses.filter((entry) => entry.url.includes('mb007-course-airport') && entry.at >= releaseAt && entry.status === 200);
    }
    const latePacket = { received: release.received === true, fulfilled: release.fulfilled === true, aborted: release.aborted === true, browserResponseObserved: browserAfter.length > 0, release };
    evidence.latePacket = latePacket;
    check('learn-late-old-get-http-200', release.fulfilled === true, release);
    if (!release.fulfilled) gap('learn-late-old-get-aborted', 'Held A GET was not delivered as real 200.');
    if (!latePacket.browserResponseObserved) gap('learn-late-browser-response-not-observed', 'No browser response observed for released A; receipt NOT claimed.');
    const afterText = await bodyText(item.page);
    check('learn-late-B-not-overwritten', afterText.includes(expected.published[1]) && !afterText.includes(expected.published[0]), { excerpt: afterText.slice(0, 500) });
    check('learn-late-within-timeout', heldMs < 7500, { heldMs });
    evidence.after = { url: item.page.url(), excerpt: afterText.slice(0, 700), latePacket };
    evidence.screenshot = await screenshot(item.page, outDir, '01-learn-late-B');
    return { evidence };
  } catch (error) {
    gap('learn-late-step-failed', error.message);
    evidence.error = { message: error.message, stack: error.stack || null, url: item.page.url() };
    return { evidence };
  } finally {
    await item.close().catch(() => {});
  }
}

async function runLearnRetry(fixture, outDir) {
  const item = await fixture.fresh({ mode: 'ready', caseId: 'learn-retry' });
  const evidence = {};
  const listeners = attachContentResponses(item.page);
  try {
    await waitReadyUi(item.page, fixture, item);
    const expected = item.expected('A');
    await waitForText(item.page, [expected.available], 8000);
    const before = fixture.report.requests.filter((entry) => entry.caseId === item.id && entry.path.startsWith('/api/v1/content/learner/')).length;
    await item.armResponse('/api/v1/content/learner/mb007-course-airport', { status: 503, code: 'CONTENT_UNAVAILABLE' });
    await item.page.locator('.home-course').nth(0).click();
    await item.page.waitForFunction(() => location.hash.includes('/pages/learn/learn'), null, { timeout: 15000 }).catch(() => {});
    const retry = await waitForButton(item.page, COPY.retry, 10000);
    const firstResponses = listeners.responses.filter((entry) => entry.url.includes('mb007-course-airport'));
    check('learn-retry-first-503', firstResponses.some((entry) => entry.status === 503), { firstResponses });
    if (!retry) {
      gap('learn-retry-not-prepared', 'Learn page did not expose a retry control; learn-retry is NOT_PREPARED/NOT_RUN.');
      return { evidence };
    }
    await retry.click();
    let after = before;
    const deadline = Date.now() + 10000;
    while (after <= before && Date.now() < deadline) {
      await item.page.waitForTimeout(200);
      after = fixture.report.requests.filter((entry) => entry.caseId === item.id && entry.path.startsWith('/api/v1/content/learner/')).length;
    }
    await waitForText(item.page, [expected.published[0]], 10000);
    const text = await bodyText(item.page);
    const paths = fixture.report.requests.filter((entry) => entry.caseId === item.id && entry.path.startsWith('/api/v1/content/learner/')).slice(before).map((entry) => entry.path);
    check('learn-retry-same-code-new-get', after > before && paths.includes('/api/v1/content/learner/mb007-course-airport'), { before, after, paths });
    check('learn-retry-recovered-dom', text.includes(expected.published[0]) && text.length > 20, { excerpt: text.slice(0, 400) });
    check('learn-retry-zero-domain-writes', requestStats(fixture, item).domainWrites.length === 0, { domainWrites: requestStats(fixture, item).domainWrites });
    evidence.after = { url: item.page.url(), excerpt: text.slice(0, 600), paths };
    evidence.screenshot = await screenshot(item.page, outDir, '01-learn-retry-recovered');
    return { evidence };
  } catch (error) {
    gap('learn-retry-step-failed', error.message);
    evidence.error = { message: error.message, stack: error.stack || null, url: item.page.url() };
    return { evidence };
  } finally {
    await item.close().catch(() => {});
  }
}

function attachPlanResponses(page) {
  const responses = [];
  const finished = [];
  page.on('response', (response) => {
    if (response.url().includes('/api/v1/learning/today')) responses.push({ status: response.status(), at: Date.now() });
  });
  page.on('requestfinished', (request) => {
    if (request.url().includes('/api/v1/learning/today')) finished.push({ at: Date.now() });
  });
  return { responses, finished };
}

async function waitPlanRetry(page, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const blocks = page.locator('.home-line--error, [role="alert"]');
    const count = await blocks.count();
    for (let i = 0; i < count; i += 1) {
      const block = blocks.nth(i);
      if (!(await block.isVisible().catch(() => false))) continue;
      const text = norm(await block.innerText().catch(() => ''));
      if (!/今日计划|Today.?s plan|plan could not/i.test(text)) continue;
      const button = block.locator('button, [role="button"]').first();
      if (await button.isVisible().catch(() => false)) return button;
    }
    await page.waitForTimeout(150);
  }
  return null;
}

async function leaveToCoursesViaTab(page) {
  for (const label of ['课程', 'Courses']) {
    const tab = page.locator('uni-tabbar').getByText(label, { exact: true });
    const count = await tab.count();
    if (count !== 1) continue;
    if (!(await tab.isVisible().catch(() => false))) continue;
    if (await elementDisabled(tab)) continue;
    await tab.click();
    await page.waitForFunction(() => location.hash.includes('/pages/learn/learn'), null, { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(600);
    const text = await bodyText(page);
    if (page.url().includes('/pages/learn/learn') && text.trim().length > 20) return { method: 'tab', label, count, url: page.url(), excerpt: text.slice(0, 300) };
  }
  return { method: 'none' };
}

async function leaveToProfileViaTab(page) {
  for (const label of ['我的', 'Me', 'Profile', '账号']) {
    const tab = page.locator('uni-tabbar').getByText(label, { exact: true });
    const count = await tab.count();
    if (count !== 1) continue;
    if (!(await tab.isVisible().catch(() => false))) continue;
    if (await elementDisabled(tab)) continue;
    await tab.click();
    await page.waitForTimeout(900);
    const url = page.url();
    const leftHome = !(url.endsWith('#/') || url.includes('/pages/home/home'));
    if (leftHome) return { method: 'tab', label, count, url, atLogin: url.includes('/pages/login/login'), excerpt: (await bodyText(page)).slice(0, 300) };
  }
  return { method: 'none' };
}

async function runPlanLate(fixture, outDir) {
  const item = await fixture.fresh({ mode: 'planLate', caseId: 'plan-late' });
  const evidence = {};
  const listeners = attachPlanResponses(item.page);
  try {
    await waitReadyUi(item.page, fixture, item);
    await waitForText(item.page, COPY.h1, 8000);
    const planRetry = await waitPlanRetry(item.page, 10000);
    if (!planRetry) {
      gap('plan-late-not-prepared', 'The current home did not expose the plan-read retry control; plan-late is NOT_PREPARED/NOT_RUN.');
      return { evidence };
    }
    const stats = requestStats(fixture, item);
    check('plan-late-first-today-503', stats.requests.some((entry) => entry.path === '/api/v1/learning/today' && entry.status === 503), { requests: stats.requests.filter((entry) => entry.path === '/api/v1/learning/today') });
    const holdStart = Date.now();
    await item.holdNext('/api/v1/learning/today', 'plan-late-held');
    await planRetry.click();
    const received = await item.waitForHold('plan-late-held', 12000);
    check('plan-late-retry-held', Boolean(received), { received });
    if (!received) {
      gap('plan-late-held-not-received', 'The retried plan GET was not held; plan-late is NOT_RUN.');
      return { evidence };
    }
    const leave = await leaveToCoursesViaTab(item.page);
    if (leave.method === 'none') {
      gap('plan-late-courses-tab-unavailable', 'The real uni-tabbar Courses tab was not uniquely available while the plan retry was held; plan-late is NOT_RUN (no forced/disabled click, no router/history change).');
      return { evidence };
    }
    check('plan-late-leave-via-courses-tab', leave.method === 'tab' && leave.count === 1, leave);
    const back = await goHomeViaUi(item.page);
    if (back.method !== 'tab' || back.preWasHome) {
      gap('plan-late-return-home', 'No real uni-tabbar Learn entry from Courses back to a different home target; plan-late is NOT_RUN.');
      return { evidence };
    }
    check('plan-late-return-home-via-learn-tab', true, { back, url: item.page.url() });
    await waitForText(item.page, COPY.h1, 8000);
    let attempts = item.state.todayAttempts;
    const deadline = Date.now() + 12000;
    while (attempts < 3 && Date.now() < deadline) {
      await item.page.waitForTimeout(200);
      attempts = item.state.todayAttempts;
    }
    const newText = fixture.SYNTHETIC.planLate.new;
    const oldText = fixture.SYNTHETIC.planLate.old;
    await waitForText(item.page, [newText], 10000);
    const beforeText = await bodyText(item.page);
    check('plan-late-new-explanation-visible', attempts >= 3 && beforeText.includes(newText) && !beforeText.includes(oldText), { attempts, back, beforeText: beforeText.slice(0, 500) });
    const heldMs = Date.now() - holdStart;
    if (heldMs >= 7500) {
      gap('plan-late-held-request-timeout-risk', 'Held plan GET exceeded the client request timeout window; no post-timeout fulfill is claimed as late receipt.');
      return { evidence };
    }
    const releaseAt = Date.now();
    const release = await item.releaseHold('plan-late-held');
    let browserAfter = [];
    const responseDeadline = Date.now() + 4000;
    while (browserAfter.length === 0 && Date.now() < responseDeadline) {
      await item.page.waitForTimeout(200);
      browserAfter = listeners.responses.filter((entry) => entry.at >= releaseAt && entry.status === 200);
    }
    const latePacket = {
      received: Boolean(received),
      fulfilled: release.fulfilled === true,
      aborted: release.aborted === true,
      browserResponseObserved: browserAfter.length > 0,
      browserStatus: browserAfter[0]?.status ?? null,
      browserFinishedAfterRelease: listeners.finished.filter((entry) => entry.at >= releaseAt).length,
      release,
      planExplanation: release.planExplanation,
    };
    evidence.latePacket = latePacket;
    check('plan-late-old-get-real-http-200', release.fulfilled === true && release.planExplanation === oldText, release);
    if (!release.fulfilled) {
      gap('plan-late-old-get-aborted', 'Held plan GET was not delivered as a real 200; plan-late is NOT_RUN.');
      return { evidence };
    }
    if (!latePacket.browserResponseObserved) {
      gap('plan-late-browser-response-not-observed', 'route.fulfill resolved but the page response event was not observed; browser receipt is NOT claimed.');
    }
    await item.page.waitForTimeout(800);
    const text = await bodyText(item.page);
    check('plan-late-new-explanation-kept', text.includes(newText) && !text.includes(oldText), { excerpt: text.slice(0, 600), latePacket });
    check('plan-late-zero-domain-writes', requestStats(fixture, item).domainWrites.length === 0, { domainWrites: requestStats(fixture, item).domainWrites });
    evidence.after = { url: item.page.url(), excerpt: text.slice(0, 800), hold: item.holdSummary(), latePacket };
    evidence.screenshot = await screenshot(item.page, outDir, '01-plan-late-after-old-release');
    return { evidence };
  } catch (error) {
    gap('plan-late-step-failed', error.message);
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
    else if (CASE === 'navigation') caseResult = await runNavigation(fixture, outDir);
    else if (CASE === 'retry') caseResult = await runRetry(fixture, outDir);
    else if (CASE === 'empty') caseResult = await runEmpty(fixture, outDir);
    else if (CASE === 'auth') caseResult = await runAuth(fixture, outDir);
    else if (CASE === 'late-same') caseResult = await runLateSame(fixture, outDir);
    else if (CASE === 'plan-late') caseResult = await runPlanLate(fixture, outDir);
    else if (CASE === 'learn-late') caseResult = await runLearnLate(fixture, outDir);
    else if (CASE === 'learn-retry') caseResult = await runLearnRetry(fixture, outDir);
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

  const caseRequests = fixture.report.requests.filter((entry) => inCase(entry, CASE));
  const unknown = fixture.report.unknown.filter((entry) => inCase(entry, CASE));
  const writes = caseRequests.filter((entry) => entry.method !== 'GET' && entry.method !== 'OPTIONS');
  const caseConsoleErrors = fixture.report.consoleErrors.filter((entry) => inCase(entry, CASE));
  const expectedConsoleStatuses = CASE === 'retry' || CASE === 'plan-late' || CASE === 'empty' || CASE === 'learn-retry' ? [503] : ['auth', 'late', 'late-same'].includes(CASE) ? [401, 403] : [];
  const allowedConsolePaths = new Set(caseRequests.filter((entry) => expectedConsoleStatuses.includes(entry.status)).map((entry) => entry.path));
  const expectedHttpConsole = caseConsoleErrors.filter((entry) => entry.path && allowedConsolePaths.has(entry.path)
    && expectedConsoleStatuses.some((status) => entry.message.includes(String(status)) || caseRequests.some((request) => request.path === entry.path && request.status === status)));
  const unexpectedConsoleErrors = caseConsoleErrors.filter((entry) => !expectedHttpConsole.includes(entry));
  check('console-errors-classified', unexpectedConsoleErrors.length === 0, { expectedHttpConsole, unexpectedConsoleErrors, allowedConsolePaths: [...allowedConsolePaths], expectedConsoleStatuses });
  const casePageErrors = fixture.report.pageErrors.filter((entry) => inCase(entry, CASE));
  check('no-page-errors', casePageErrors.length === 0, { pageErrors: casePageErrors });
  check('no-unknown-api', unknown.length === 0, { unknown, note: 'Settled after the case interaction; top-level and detail counts share the same caseKey source.' });
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
    consoleWarnings: fixture.report.consoleWarnings.filter((entry) => inCase(entry, CASE)),
    consoleErrors: caseConsoleErrors,
    consoleClassification: { expectedHttpConsole, unexpectedConsoleErrors, allowedConsolePaths: [...allowedConsolePaths], expectedConsoleStatuses },
    pageErrors: casePageErrors,
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

module.exports = { main, runReady, runSearch, runNavigation, runRetry, runEmpty, runAuth, runLate, runLateSame, runPlanLate, runLearnLate, runLearnRetry, pageFacts, CASES };
