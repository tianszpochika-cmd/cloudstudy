// TEST PREPARATION ONLY. Importing this module never launches a browser.
// MB007 "before" fixture: real mobile H5 page + real login/guard, synthetic API.
// Boundaries:
//   - Intercepts only local /api/v1/* (H5 18183, gateway 18070, IAM 18087).
//   - Never reads request headers/body/token/cookie; records method + path only.
//   - Never injects store, token, storage, component, router or history.
//   - UI locale/theme use the product's existing public-auth handoff
//     (login URL ?uiLocale=&theme=) plus synthetic /learner/preferences.
//   - Unknown/malformed API route => 501 + report.unknown, never a broad 200.
//   - Synthetic content only; no production title/account is copied here.
'use strict';

const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
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
const HOME_PATH = '/pages/home/home';
const PAGE = 'apps/mobile/src/pages/home/home.vue';
const I18N = 'packages/i18n/src/mobile-experience.ts';
const sources = [
  PAGE,
  I18N,
  'apps/mobile/src/api/learner-content.ts',
  'apps/mobile/src/stores/learner-content.ts',
  'apps/mobile/src/stores/session.ts',
  'apps/mobile/src/auth/navigation.ts',
];
const deps = ['apps/mobile/package.json', 'pnpm-lock.yaml'];

const hash = (file) => crypto.createHash('sha256').update(fs.readFileSync(path.resolve(ROOT, file))).digest('hex');
const hashes = () => Object.fromEntries([...sources, ...deps].map((file) => [file, hash(file)]));

const TASKS = [
  {
    taskId: 'mb007-task-available',
    taskType: 'LESSON',
    title: '机场值机：换取登机牌',
    description: '跟着对话完成值机与行李托运。',
    minutes: 8,
    status: 'AVAILABLE',
    contentCode: 'mb007-course-airport',
    contentVersionPin: 7001,
  },
  {
    taskId: 'mb007-task-completed',
    taskType: 'LESSON',
    title: '酒店入住：确认房型',
    description: '复习入住登记、房型和早餐时间。',
    minutes: 5,
    status: 'COMPLETED',
    contentCode: 'mb007-course-hotel',
    contentVersionPin: 7002,
  },
  {
    taskId: 'mb007-task-unavailable',
    taskType: 'LESSON',
    title: '退税柜台：材料核对',
    description: '这一版正在更新。',
    minutes: 5,
    status: 'UNAVAILABLE',
    unavailableReason: '内容版本正在更新，暂时不能开始。',
  },
];

const CONTENT = [
  {
    contentCode: 'mb007-course-airport',
    contentType: 'COURSE',
    title: '机场值机：从问候到登机牌',
    summary: '值机、托运行李和登机口问路。',
    contentLocale: 'en-US',
    contentVersionId: 7001,
    availability: 'PUBLISHED',
  },
  {
    contentCode: 'mb007-course-hotel',
    contentType: 'COURSE',
    title: '酒店入住：房型与早餐',
    summary: '入住登记、房型确认和早餐时间。',
    contentLocale: 'en-US',
    contentVersionId: 7002,
    availability: 'PUBLISHED',
  },
  {
    contentCode: 'mb007-course-refund-draft',
    contentType: 'COURSE',
    title: '退税柜台：未发布草稿',
    summary: '未发布内容不应出现在学习书架。',
    contentLocale: 'en-US',
    contentVersionId: 7003,
    availability: 'UNPUBLISHED',
  },
];

const SYNTHETIC = {
  tasks: TASKS.map((task) => ({
    title: task.title,
    status: task.status,
    hasContentCode: Boolean(task.contentCode),
  })),
  publishedContentTitles: CONTENT.filter((item) => item.availability === 'PUBLISHED').map((item) => item.title),
  unpublishedContentTitle: CONTENT.find((item) => item.availability !== 'PUBLISHED').title,
  targetMinutes: 15,
  completedMinutes: 5,
};

const report = {
  scope: 'MB007_BEFORE_SYNTHETIC_TRANSPORT',
  requests: [],
  unknown: [],
  pageErrors: [],
  consoleErrors: [],
  consoleWarnings: [],
};

const live = new Set();
let browser = null;
let caseNumber = 0;

function themeMode(theme) {
  return theme === 'dark' ? 'DARK' : theme === 'light' ? 'LIGHT' : 'SYSTEM';
}

function routeKey(url) {
  const raw = String(url || '');
  const hashPart = raw.includes('#') ? raw.slice(raw.indexOf('#')) : '';
  return hashPart.split('?')[0];
}

function isHomeUrl(url) {
  const key = routeKey(url);
  return key === '#/' || key === '#/pages/home/home';
}

async function init() {
  if (!browser) browser = await chromium.launch();
  return browser;
}

async function close() {
  for (const item of [...live]) {
    try { await item.close(); } catch { /* context already closed */ }
  }
  if (browser) await browser.close();
  browser = null;
}

async function waitHome(page, state, timeoutMs = 25000) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    last = await page.evaluate(() => {
      const body = document.querySelector('.v2-home-body');
      return {
        url: location.href,
        hash: location.hash,
        bodyPresent: Boolean(body),
        bodyVisible: Boolean(body && body.getClientRects().length > 0),
        bodyTextLength: body ? (body.innerText || '').trim().length : 0,
      };
    });
    if (last && last.bodyVisible && last.bodyTextLength > 0 && state.counts.home > 0 && state.counts.catalog > 0) return last;
    await page.waitForTimeout(200);
  }
  throw new Error('home not ready: ' + JSON.stringify({ url: page.url(), last, counts: state.counts }));
}

async function fresh(options = {}) {
  if (!browser) throw new Error('Call init() explicitly; this module never launches on require');
  const {
    locale = 'zh-CN',
    theme = 'light',
    width = 390,
    height = 844,
    caseId = null,
  } = options;
  if (locale !== 'zh-CN' && locale !== 'en-US') throw new Error('locale must be zh-CN or en-US');
  if (theme !== 'light' && theme !== 'dark') throw new Error('theme must be light or dark');
  const id = ++caseNumber;
  const context = await browser.newContext({
    viewport: { width, height },
    colorScheme: theme === 'dark' ? 'dark' : 'light',
    reducedMotion: 'reduce',
    hasTouch: false,
  });
  const state = {
    id,
    caseId,
    locale,
    theme,
    width,
    height,
    subject: `ui-mb007-before-${id}`,
    counts: {
      login: 0, refresh: 0, principal: 0, profile: 0, targets: 0,
      preferences: 0, home: 0, catalog: 0, today: 0, GET: 0, write: 0,
    },
  };
  const permissions = [
    'learning.plan.read',
    'learner.target.read',
    'learner.profile.read',
    'learner.preference.read',
    'assessment.placement.read',
  ];
  const tokenPair = () => ({
    accessToken: 'synthetic-mb007-access-token-not-a-credential',
    refreshToken: null,
    deviceId: `synthetic-device-${id}`,
    sessionId: `synthetic-session-${id}`,
    adultGate: { status: 'PASSED', learningAccess: 'ELIGIBLE' },
  });
  const principal = () => ({
    principal: {
      subject: state.subject,
      permissions,
      roles: ['learner'],
      adultGate: 'PASSED',
      adultLearningAccess: 'ELIGIBLE',
    },
    adultGate: { status: 'PASSED', learningAccess: 'ELIGIBLE' },
    learningAccess: 'ELIGIBLE',
    permissions,
    consentState: {
      accepted: true,
      unsatisfiedPurposes: [],
      requiredPurposes: ['ACCOUNT_TERMS', 'PRIVACY_NOTICE', 'ADULT_LEARNING_ELIGIBILITY'],
      version: 'b30-consent-v1',
    },
  });
  const preferences = () => ({
    uiLocale: locale,
    contentLocale: 'en-US',
    timezone: 'Asia/Shanghai',
    themeMode: themeMode(theme),
    highContrast: false,
    motionMode: 'REDUCED',
    stateVersion: 0,
  });

  await context.route('**/*', async (route) => {
    const request = route.request();
    let url;
    try { url = new URL(request.url()); } catch { return route.abort(); }
    if (url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') return route.abort();
    const apiPath = url.pathname;
    if (!apiPath.startsWith('/api/v1/')) return route.continue();
    const method = request.method();
    report.requests.push({ caseId: id, method, path: apiPath });
    if (method === 'GET') state.counts.GET += 1;
    if (method !== 'GET' && method !== 'OPTIONS') state.counts.write += 1;
    const headers = {
      'content-type': 'application/json',
      'access-control-allow-origin': BASE,
      'access-control-allow-credentials': 'true',
      'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      'access-control-allow-headers': 'content-type,authorization,idempotency-key,if-match,accept-language',
    };
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers, body: '' });

    let status = 200;
    let data;
    if (method === 'POST' && apiPath === '/api/v1/auth/login') {
      state.counts.login += 1;
      data = tokenPair();
    } else if (method === 'POST' && apiPath === '/api/v1/auth/token/refresh') {
      state.counts.refresh += 1;
      data = tokenPair();
    } else if (method === 'GET' && (apiPath === '/api/v1/iam/principal/me' || apiPath === '/api/v1/iam/permissions')) {
      state.counts.principal += 1;
      data = principal();
    } else if (method === 'GET' && apiPath === '/api/v1/learner/profile') {
      state.counts.profile += 1;
      data = {
        stateVersion: 0,
        status: 'ACTIVE',
        birthYear: 1990,
        ageConfirmed: true,
        privacyConsent: true,
        termsConsent: true,
        uiLocale: locale,
        contentLocale: 'en-US',
      };
    } else if (method === 'GET' && apiPath === '/api/v1/learner/targets') {
      state.counts.targets += 1;
      data = {
        goalCode: 'FOUNDATION',
        dailyQuotaMinutes: 15,
        targetLevel: 'A1',
        status: 'ACTIVE',
        stateVersion: 0,
      };
    } else if (method === 'GET' && apiPath === '/api/v1/learner/preferences') {
      state.counts.preferences += 1;
      data = preferences();
    } else if (method === 'GET' && apiPath === '/api/v1/learner/home') {
      state.counts.home += 1;
      data = {
        projectionVersion: 4,
        contentEpoch: 7,
        tasks: TASKS,
        targetMinutes: 15,
        completedMinutes: 5,
        contentStatus: 'READY',
        stale: false,
        dailyStream: { completedMinutes: 5, targetMinutes: 15 },
      };
    } else if (method === 'GET' && apiPath === '/api/v1/content/learner/catalog') {
      state.counts.catalog += 1;
      data = { items: CONTENT };
    } else if (method === 'GET' && apiPath === '/api/v1/learning/today') {
      state.counts.today += 1;
      data = {
        planId: 'plan_mb007_synthetic_1',
        status: 'ACTIVE',
        planVersion: 3,
        targetMinutes: 15,
        emptyReason: null,
        explanation: null,
        firstLearning: null,
        algorithmVersion: 'SM2_Q03_V1',
        deferredCount: 1,
        items: [
          { itemId: 'plan-item-1', arrangement: 'DUE' },
          { itemId: 'plan-item-2', arrangement: 'DUE' },
          { itemId: 'plan-item-3', arrangement: 'DEFERRED' },
        ],
      };
    } else {
      status = 501;
      data = { code: 'SYNTHETIC_UNKNOWN_ROUTE' };
      report.unknown.push({ caseId: id, method, path: apiPath, status: 501 });
    }
    await route.fulfill({ status, headers, body: status === 204 ? '' : JSON.stringify(data) });
  });

  const page = await context.newPage();
  page.on('pageerror', (error) => report.pageErrors.push({
    caseId: id,
    name: error.name,
    message: error.message,
    stack: error.stack || null,
  }));
  page.on('console', (message) => {
    const type = message.type();
    if (type === 'warning') {
      report.consoleWarnings.push({ caseId: id, message: message.text() });
      return;
    }
    if (type !== 'error') return;
    let consolePath = null;
    try {
      const location = message.location();
      if (location && location.url) consolePath = new URL(location.url).pathname;
    } catch { consolePath = null; }
    report.consoleErrors.push({ caseId: id, message: message.text(), path: consolePath });
  });

  const loginUrl = `${BASE}/#/pages/login/login`
    + `?theme=${encodeURIComponent(theme)}&uiLocale=${encodeURIComponent(locale)}`
    + `&returnTo=${encodeURIComponent(HOME_PATH)}`;

  try {
    await page.goto(loginUrl, { waitUntil: 'networkidle' });
    await page.locator('#mobile-login-identifier').waitFor({ timeout: 20000 });
    await page.locator('#mobile-login-identifier').fill(state.subject);
    await page.locator('#mobile-login-password').fill('SyntheticOnly123');
    await page.locator('.login-submit').click();
    await page.waitForURL((url) => isHomeUrl(url.toString()), { timeout: 30000 });
    await waitHome(page, state, 25000);
  } catch (error) {
    await context.close().catch(() => {});
    throw error;
  }

  const item = {
    page,
    context,
    state,
    close: async () => {
      try { await context.close(); } finally { live.delete(item); }
    },
  };
  live.add(item);
  return item;
}

module.exports = {
  BASE,
  PAGE,
  I18N,
  HOME_PATH,
  sources,
  deps,
  report,
  hash,
  hashes,
  init,
  close,
  fresh,
  isHomeUrl,
  routeKey,
  SYNTHETIC,
};
