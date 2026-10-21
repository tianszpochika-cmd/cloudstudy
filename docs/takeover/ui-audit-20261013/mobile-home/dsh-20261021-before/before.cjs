// MB007 "before" real-H5 capture. PREPARED ONLY: the author session did not
// launch a browser and claims no UI PASS.
//
// Main-only entry: requiring this file performs no launch and no environment
// validation. Root runs it after review.
//
// Required environment:
//   MB007_CONFIRM_BROWSER=1
//   EXPECTED_HOME_SHA=<64 lowercase hex>   raw sha256 of apps/mobile/src/pages/home/home.vue
//   EXPECTED_I18N_SHA=<64 lowercase hex>   raw sha256 of packages/i18n/src/mobile-experience.ts
// Optional:
//   MB007_RUN_ID (or RUN_ID)               one safe path segment; default mb007-before-<utc>
//
// Exit codes: 0 = four before captures written and harness closed cleanly;
//             1 = capture incomplete (scenario error, unknown API, hash drift, close failure);
//             2 = setup refusal before capture (env/hash/port/browser/run-dir).
// Exit 0 is NOT a UI PASS and NOT a claim that before defects are acceptable.
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
const HOME_FILE = 'apps/mobile/src/pages/home/home.vue';
const I18N_FILE = 'packages/i18n/src/mobile-experience.ts';
const FILES = {
  page: HOME_FILE,
  i18n: I18N_FILE,
  api: 'apps/mobile/src/api/learner-content.ts',
  store: 'apps/mobile/src/stores/learner-content.ts',
  session: 'apps/mobile/src/stores/session.ts',
  navigation: 'apps/mobile/src/auth/navigation.ts',
  depPackage: 'apps/mobile/package.json',
  depLock: 'pnpm-lock.yaml',
};

const SCENARIOS = [
  { index: '01', key: '390x844-light-zh', width: 390, height: 844, locale: 'zh-CN', theme: 'light', textScale: 100 },
  { index: '02', key: '390x844-dark-en', width: 390, height: 844, locale: 'en-US', theme: 'dark', textScale: 100 },
  { index: '03', key: '1280x900-light-zh', width: 1280, height: 900, locale: 'zh-CN', theme: 'light', textScale: 100 },
  { index: '04', key: '320x568-light-zh-text200', width: 320, height: 568, locale: 'zh-CN', theme: 'light', textScale: 200 },
];

function sha256File(relativePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(path.resolve(ROOT, relativePath))).digest('hex');
}

function hashSet() {
  return {
    page: { path: FILES.page, sha256: sha256File(FILES.page) },
    i18n: { path: FILES.i18n, sha256: sha256File(FILES.i18n) },
    api: { path: FILES.api, sha256: sha256File(FILES.api) },
    store: { path: FILES.store, sha256: sha256File(FILES.store) },
    session: { path: FILES.session, sha256: sha256File(FILES.session) },
    navigation: { path: FILES.navigation, sha256: sha256File(FILES.navigation) },
    deps: {
      package: { path: FILES.depPackage, sha256: sha256File(FILES.depPackage) },
      lock: { path: FILES.depLock, sha256: sha256File(FILES.depLock) },
    },
  };
}

function refuse(message) {
  console.error('REFUSED (setup, exit 2): ' + message + ' Nothing was captured.');
  return 2;
}

function readConfig() {
  if (String(process.env.MB007_CONFIRM_BROWSER || '').trim() !== '1') {
    throw new Error('set MB007_CONFIRM_BROWSER=1 to launch this prepared real-H5 capture.');
  }
  const expectedHome = String(process.env.EXPECTED_HOME_SHA || '').trim().toLowerCase();
  const expectedI18n = String(process.env.EXPECTED_I18N_SHA || '').trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(expectedHome)) {
    throw new Error('EXPECTED_HOME_SHA must be an explicit 64-lowercase-hex raw file hash; no default, no auto-accept.');
  }
  if (!/^[0-9a-f]{64}$/.test(expectedI18n)) {
    throw new Error('EXPECTED_I18N_SHA must be an explicit 64-lowercase-hex raw file hash; no default, no auto-accept.');
  }
  const homeSha = sha256File(HOME_FILE);
  const i18nSha = sha256File(I18N_FILE);
  if (homeSha !== expectedHome) {
    throw new Error('EXPECTED_HOME_SHA mismatch: file=' + homeSha + ' expected=' + expectedHome + '.');
  }
  if (i18nSha !== expectedI18n) {
    throw new Error('EXPECTED_I18N_SHA mismatch: file=' + i18nSha + ' expected=' + expectedI18n + '.');
  }
  const explicitRunId = String(process.env.MB007_RUN_ID || process.env.RUN_ID || '').trim();
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '').replace('T', '-');
  const runId = explicitRunId || ('mb007-before-' + stamp);
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(runId)) {
    throw new Error('MB007_RUN_ID/RUN_ID must be one safe path segment (letters, digits, dot, underscore, dash).');
  }
  return { expectedHome, expectedI18n, homeSha, i18nSha, runId };
}

function resolveRunDirectory(runId) {
  const out = path.resolve(RUNS_ROOT, runId);
  if (path.dirname(out) !== RUNS_ROOT) throw new Error('run directory escaped runs/.');
  if (fs.existsSync(out)) throw new Error('run directory already exists: ' + out + '; refusing to overwrite prior results or screenshots.');
  return out;
}

function probe(url) {
  return new Promise((resolve) => {
    const request = http.get(url, (response) => {
      response.resume();
      resolve(response.statusCode || 0);
    });
    request.on('error', () => resolve(0));
    request.setTimeout(3000, () => { request.destroy(); resolve(0); });
  });
}

function collectFacts() {
  const one = (selector) => document.querySelector(selector);
  const all = (selector) => Array.from(document.querySelectorAll(selector));
  const text = (node, max = 200) => String((node && node.textContent) || '').replace(/\s+/g, ' ').trim().slice(0, max);
  const cls = (node) => String((node && node.getAttribute && node.getAttribute('class')) || '').slice(0, 160);
  const shown = (node) => Boolean(node && node.getClientRects().length > 0);
  const box = (node) => {
    if (!node) return null;
    const rect = node.getBoundingClientRect();
    const round = (value) => Math.round(value * 10) / 10;
    return {
      x: round(rect.x),
      y: round(rect.y),
      width: round(rect.width),
      height: round(rect.height),
      top: round(rect.top + window.scrollY),
      bottom: round(rect.bottom + window.scrollY),
    };
  };
  const style = (node) => {
    if (!node) return null;
    const computed = getComputedStyle(node);
    return {
      fontFamily: computed.fontFamily,
      fontSize: computed.fontSize,
      fontWeight: computed.fontWeight,
      lineHeight: computed.lineHeight,
      letterSpacing: computed.letterSpacing,
      color: computed.color,
      backgroundColor: computed.backgroundColor,
      overflowX: computed.overflowX,
      overflowY: computed.overflowY,
      whiteSpace: computed.whiteSpace,
      textOverflow: computed.textOverflow,
      clientWidth: node.clientWidth,
      scrollWidth: node.scrollWidth,
      clientHeight: node.clientHeight,
      scrollHeight: node.scrollHeight,
      overflowsX: node.scrollWidth > node.clientWidth + 1,
      overflowsY: node.scrollHeight > node.clientHeight + 1,
    };
  };

  const typeSelectors = [
    '.v2-home-greet-kicker',
    '.v2-home-greet-title',
    '.v2-home-eyebrow',
    '.v2-home-hi',
    '.v2-home-sub',
    '.v2-home-card-title',
    '.v2-home-card-desc',
    '.v2-home-kpi-value',
    '.v2-home-kpi-label',
    '.task-title',
    '.task-description',
    '.task-warning',
    '.task-button',
    '.content-title',
    '.content-description',
    '.v2-home-continue',
    '.v2-home-card-action',
  ];
  const typography = [];
  for (const selector of typeSelectors) {
    all(selector).slice(0, 6).forEach((node, index) => {
      typography.push({ selector, index, text: text(node, 120), visible: shown(node), box: box(node), ...style(node) });
    });
  }

  const buttons = all('button').slice(0, 80).map((node, index) => {
    const computed = getComputedStyle(node);
    return {
      index,
      class: cls(node),
      text: text(node, 80),
      ariaLabel: node.getAttribute('aria-label'),
      disabled: node.hasAttribute('disabled') || node.getAttribute('aria-disabled') === 'true',
      visible: shown(node),
      box: box(node),
      fontSize: computed.fontSize,
      lineHeight: computed.lineHeight,
      minHeight: computed.minHeight,
      padding: computed.padding,
      borderWidth: computed.borderWidth,
    };
  });
  const smallTargets = buttons.filter((button) => button.visible && button.box
    && (button.box.width < 44 || button.box.height < 44)).length;

  const tasks = all('.task-row').map((row) => {
    const button = row.querySelector('button');
    return {
      title: text(row.querySelector('.task-title')),
      description: text(row.querySelector('.task-description'), 300),
      warning: text(row.querySelector('.task-warning'), 200),
      buttonText: text(button, 60),
      buttonDisabled: Boolean(button && (button.hasAttribute('disabled') || button.getAttribute('aria-disabled') === 'true')),
      buttonVisible: shown(button),
    };
  });
  const content = all('.content-row').map((row) => ({
    title: text(row.querySelector('.content-title'), 160),
    summary: text(row.querySelector('.content-description'), 300),
    buttonVisible: shown(row),
  }));
  const kpis = all('.v2-home-kpi').map((node) => ({
    value: text(node.querySelector('.v2-home-kpi-value'), 40),
    label: text(node.querySelector('.v2-home-kpi-label'), 60),
  }));
  const headings = {
    greet: text(one('.v2-home-greet-title'), 160),
    hero: text(one('.v2-home-hi'), 160),
    cardTitles: all('.v2-home-card-title').map((node) => text(node, 160)),
  };
  const main = one('.v2-home-body');
  const html = main ? main.outerHTML : '';
  const overflow = [];
  for (const node of all('.v2-home-body, .v2-home-body *')) {
    if (!(node instanceof HTMLElement)) continue;
    if (node.scrollWidth <= node.clientWidth + 1 && node.scrollHeight <= node.clientHeight + 1) continue;
    const computed = getComputedStyle(node);
    overflow.push({
      tag: node.tagName.toLowerCase(),
      class: cls(node),
      text: text(node, 100),
      clientWidth: node.clientWidth,
      scrollWidth: node.scrollWidth,
      clientHeight: node.clientHeight,
      scrollHeight: node.scrollHeight,
      overflowX: computed.overflowX,
      overflowY: computed.overflowY,
      whiteSpace: computed.whiteSpace,
    });
  }

  return {
    url: location.href,
    hash: location.hash,
    routeKey: location.hash.split('?')[0],
    lang: document.documentElement.lang || null,
    dataTheme: document.documentElement.dataset.theme || null,
    dataUiLocale: document.documentElement.dataset.uiLocale || null,
    dataContentLocale: document.documentElement.dataset.contentLocale || null,
    bodyTextLength: ((document.body && document.body.innerText) || '').trim().length,
    mainTextLength: main ? (main.innerText || '').trim().length : 0,
    mainTextExcerpt: text(main, 1600),
    headings,
    tasks,
    taskTitles: tasks.map((task) => task.title),
    contentRows: content,
    contentTitles: content.map((item) => item.title),
    kpis,
    typography,
    buttons,
    smallTargets,
    overflowCount: overflow.length,
    overflow: overflow.slice(0, 40),
    mainDomExcerpt: {
      length: html.length,
      truncated: html.length > 12000,
      excerpt: html.slice(0, 12000),
    },
    documentScroll: {
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
    },
    bodyScroll: {
      scrollWidth: document.body.scrollWidth,
      clientWidth: document.body.clientWidth,
      scrollHeight: document.body.scrollHeight,
      clientHeight: document.body.clientHeight,
    },
  };
}

async function applyTextScale(page, scale) {
  if (scale === 100) return { method: 'none', factor: 1 };
  const factor = scale / 100;
  await page.evaluate(({ factor: value }) => {
    const root = document.querySelector('.yx-page');
    if (!root) return;
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
  return {
    method: `test-only computed font-size/line-height x${factor} inline styles on the .yx-page subtree; no store/token/component/router/storage change`,
    factor,
  };
}

async function captureScenario(fixture, spec, outDir) {
  const startedAt = new Date().toISOString();
  const item = await fixture.fresh({
    locale: spec.locale,
    theme: spec.theme,
    width: spec.width,
    height: spec.height,
    caseId: spec.key,
  });
  try {
    const textScale = await applyTextScale(item.page, spec.textScale);
    await item.page.evaluate(() => window.scrollTo(0, 0));
    await item.page.waitForTimeout(150);
    const facts = await item.page.evaluate(collectFacts);
    const caseId = item.state.id;
    const requests = fixture.report.requests.filter((entry) => entry.caseId === caseId);
    const writes = requests.filter((entry) => entry.method !== 'GET' && entry.method !== 'OPTIONS');
    const unknown = fixture.report.unknown.filter((entry) => entry.caseId === caseId);
    const publishedTitles = fixture.SYNTHETIC.publishedContentTitles;
    const unpublishedTitle = fixture.SYNTHETIC.unpublishedContentTitle;
    const visiblePublishedTitles = publishedTitles.filter((title) => facts.contentTitles.includes(title));
    const taskRows = fixture.SYNTHETIC.tasks.map((expected) => {
      const row = facts.tasks.find((task) => task.title === expected.title) || null;
      return {
        title: expected.title,
        expectedStatus: expected.status,
        expectedHasContentCode: expected.hasContentCode,
        rowPresent: Boolean(row),
        buttonText: row ? row.buttonText : null,
        buttonDisabled: row ? row.buttonDisabled : null,
        buttonVisible: row ? row.buttonVisible : null,
      };
    });
    const fullName = `${spec.index}-${spec.key}-full.png`;
    const viewportName = `${spec.index}-${spec.key}-viewport.png`;
    const fullPath = path.join(outDir, fullName);
    const viewportPath = path.join(outDir, viewportName);
    await item.page.screenshot({ path: fullPath, fullPage: true });
    await item.page.evaluate(() => window.scrollTo(0, 0));
    await item.page.waitForTimeout(120);
    await item.page.screenshot({ path: viewportPath, fullPage: false });

    return {
      key: spec.key,
      viewport: { width: spec.width, height: spec.height },
      locale: spec.locale,
      theme: spec.theme,
      textScale: spec.textScale,
      textScaleMethod: textScale.method,
      startedAt,
      finishedAt: new Date().toISOString(),
      url: facts.url,
      hash: facts.hash,
      routeKey: facts.routeKey,
      canonicalHome: facts.routeKey === '#/' || facts.routeKey === '#/pages/home/home',
      lang: facts.lang,
      dataTheme: facts.dataTheme,
      dataUiLocale: facts.dataUiLocale,
      dataContentLocale: facts.dataContentLocale,
      bodyTextLength: facts.bodyTextLength,
      mainTextLength: facts.mainTextLength,
      mainTextExcerpt: facts.mainTextExcerpt,
      headings: facts.headings,
      taskObservation: taskRows,
      identity: {
        homeBodyVisible: facts.mainTextLength > 0,
        taskRowCount: facts.tasks.length,
        primaryTaskTitleVisible: facts.taskTitles.includes(fixture.SYNTHETIC.tasks[0].title),
        primaryTaskButtonVisible: facts.tasks.some((task) => task.title === fixture.SYNTHETIC.tasks[0].title
          && task.buttonVisible && task.buttonText === '查看课程' && !task.buttonDisabled),
        catalogRowCount: facts.contentTitles.length,
        primaryCourseTitleVisible: facts.contentTitles.includes(publishedTitles[0]),
        courseTitleVisible: facts.contentTitles.find((title) => publishedTitles.includes(title)) || null,
      },
      contentPublishObservation: {
        expectedPublishedCount: publishedTitles.length,
        expectedPublishedTitles: publishedTitles,
        unpublishedTitle,
        visibleContentTitles: facts.contentTitles,
        visibleExpectedPublishedTitles: visiblePublishedTitles,
        unpublishedVisible: facts.contentTitles.includes(unpublishedTitle),
        observedOnlyPublishedVisible: facts.contentTitles.length === publishedTitles.length
          && visiblePublishedTitles.length === publishedTitles.length
          && !facts.contentTitles.includes(unpublishedTitle),
        note: 'Observation from rendered .content-row rows; this is not a UI PASS.',
      },
      kpis: facts.kpis,
      typography: facts.typography,
      buttons: facts.buttons,
      smallTargets: facts.smallTargets,
      overflowCount: facts.overflowCount,
      overflow: facts.overflow,
      mainDomExcerpt: facts.mainDomExcerpt,
      documentScroll: facts.documentScroll,
      bodyScroll: facts.bodyScroll,
      counts: { ...item.state.counts },
      api: {
        requestCount: requests.length,
        writeCount: writes.length,
        authWriteCount: writes.filter((entry) => entry.path.startsWith('/api/v1/auth/')).length,
        domainWriteCount: writes.filter((entry) => !entry.path.startsWith('/api/v1/auth/')).length,
        writes,
        unknown,
      },
      consoleWarnings: fixture.report.consoleWarnings.filter((entry) => entry.caseId === caseId),
      consoleErrors: fixture.report.consoleErrors.filter((entry) => entry.caseId === caseId),
      pageErrors: fixture.report.pageErrors.filter((entry) => entry.caseId === caseId),
      screenshots: {
        fullpage: { file: fullName, absolutePath: fullPath },
        viewport: { file: viewportName, absolutePath: viewportPath },
      },
    };
  } finally {
    await item.close().catch(() => {});
  }
}

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

  const sourceHashesBefore = hashSet();
  const scenarios = [];
  const failures = [];
  for (const spec of SCENARIOS) {
    try {
      scenarios.push(await captureScenario(fixture, spec, outDir));
    } catch (error) {
      failures.push({ scenario: spec.key, message: error.message, stack: error.stack || null });
    }
  }

  const unknown = fixture.report.unknown.slice();
  const allWrites = fixture.report.requests.filter((entry) => entry.method !== 'GET' && entry.method !== 'OPTIONS');
  let closed = false;
  let closeError = null;
  try {
    await fixture.close();
    closed = true;
  } catch (error) {
    closeError = error.message;
  }

  const sourceHashesAfter = hashSet();
  const sourcesStable = JSON.stringify(sourceHashesBefore) === JSON.stringify(sourceHashesAfter);
  const captureComplete = scenarios.length === SCENARIOS.length && failures.length === 0;
  const captureStatus = closed && captureComplete && sourcesStable && unknown.length === 0
    ? 'BEFORE_CAPTURED'
    : 'CAPTURE_INCOMPLETE';
  const payload = {
    scope: 'MB007_BEFORE_REAL_H5_CAPTURE',
    preparedBy: 'DSH author session (prepared, not executed)',
    preparedAt: '2026-10-21',
    runId: config.runId,
    runDirectory: outDir,
    startedAt: scenarios.length ? scenarios[0].startedAt : new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    base: BASE,
    environment: {
      mb007ConfirmBrowser: process.env.MB007_CONFIRM_BROWSER === '1',
      expectedHomeSha: config.expectedHome,
      expectedI18nSha: config.expectedI18n,
    },
    rawHashes: {
      home: { path: HOME_FILE, sha256: config.homeSha, expected: config.expectedHome, match: config.homeSha === config.expectedHome },
      i18n: { path: I18N_FILE, sha256: config.i18nSha, expected: config.expectedI18n, match: config.i18nSha === config.expectedI18n },
    },
    sourceHashesBefore,
    sourceHashesAfter,
    sourcesStable,
    scenarios,
    api: {
      requestCount: fixture.report.requests.length,
      writeCount: allWrites.length,
      authWriteCount: allWrites.filter((entry) => entry.path.startsWith('/api/v1/auth/')).length,
      domainWriteCount: allWrites.filter((entry) => !entry.path.startsWith('/api/v1/auth/')).length,
      unknownCount: unknown.length,
      unknown,
      requests: fixture.report.requests,
    },
    consoleWarnings: fixture.report.consoleWarnings,
    consoleErrors: fixture.report.consoleErrors,
    pageErrors: fixture.report.pageErrors,
    harness: {
      browserLaunched: true,
      closed,
      closeError,
      captureComplete,
      scenarioCount: scenarios.length,
      expectedScenarioCount: SCENARIOS.length,
      failures,
    },
    ui: {
      status: 'NOT_ASSESSED',
      note: 'Before evidence only. No UI PASS, no completion claim, and no before defect is normalized away.',
    },
    captureStatus,
  };

  try {
    fs.writeFileSync(path.join(outDir, 'results.json'), JSON.stringify(payload, null, 2));
  } catch (error) {
    console.error('CAPTURE WRITE FAILED: ' + error.message);
    return 1;
  }

  console.log(JSON.stringify({
    runId: config.runId,
    absoluteOutputPath: outDir,
    captureStatus,
    uiStatus: payload.ui.status,
    scenarios: scenarios.map((scenario) => ({ key: scenario.key, screenshots: scenario.screenshots })),
    closed,
    captureComplete,
    sourcesStable,
    unknownApiCount: unknown.length,
    writeCount: allWrites.length,
    failures,
    results: path.join(outDir, 'results.json'),
  }, null, 2));

  return captureStatus === 'BEFORE_CAPTURED' ? 0 : 1;
}

if (require.main === module) {
  main().then((code) => {
    process.exitCode = code;
  }).catch((error) => {
    console.error('UNEXPECTED FAILURE: ' + (error && error.stack ? error.stack : error));
    process.exitCode = 1;
  });
}

module.exports = {
  main,
  captureScenario,
  applyTextScale,
  collectFacts,
  hashSet,
  SCENARIOS,
  BASE,
};
