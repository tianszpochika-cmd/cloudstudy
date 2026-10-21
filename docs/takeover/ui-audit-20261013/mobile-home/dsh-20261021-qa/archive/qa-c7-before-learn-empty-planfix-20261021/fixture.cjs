// TEST PREPARATION ONLY. Importing this module never launches a browser.
// MB007 QA fixture: real mobile H5 login/guard, controlled local API transport.
// It never injects store/token/storage/router/history/business methods, never
// reads request headers/body/cookie, and never claims a real backend/native run.
// Unknown API route/method => HTTP 501 + report.unknown. Synthetic accounts,
// content, plans and IAM summary only. A held GET is released as a real HTTP
// 200 and received/fulfilled/aborted are recorded separately; it is never
// aborted just to manufacture a "late" proof.
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
const STORE = 'apps/mobile/src/stores/learner-content.ts';
const sources = [
  PAGE,
  I18N,
  STORE,
  'apps/mobile/src/api/learner-content.ts',
  'apps/mobile/src/stores/session.ts',
  'apps/mobile/src/auth/navigation.ts',
  'apps/mobile/src/platform/uni-runtime.ts',
  'apps/mobile/src/platform/public-auth-handoff.mjs',
];
const deps = ['apps/mobile/package.json', 'pnpm-lock.yaml'];

const hash = (file) => crypto.createHash('sha256').update(fs.readFileSync(path.resolve(ROOT, file))).digest('hex');
const hashes = () => Object.fromEntries([...sources, ...deps].map((file) => [file, hash(file)]));

const COPY = {
  h1: ['今日学习', "Today's learning"],
  courses: ['课程内容', 'Courses'],
  searchPlaceholder: ['搜索课程', 'Search courses'],
  clearSearch: ['清除搜索', 'Clear search'],
  changeGoal: ['修改目标', 'Change goal'],
  assessment: ['进入测评', 'Take assessment'],
  mistakes: ['错题本', 'Mistakes'],
  retry: ['重试', 'Retry'],
  start: ['开始学习', 'Start learning'],
  continue: ['继续', 'Continue'],
  viewCourses: ['查看课程', 'View courses'],
  noPlanAction: ['开始设置', 'Start setup'],
};

const PERMISSIONS = [
  'learner.home.read',
  'learning.plan.read',
  'learner.target.read',
  'learner.profile.read',
  'learner.preference.read',
  'content.catalog.read',
];

const OWNER_DATA = {
  A: {
    available: '机场值机：换取登机牌',
    inProgress: '酒店入住：确认房型',
    course1: '机场值机：从问候到登机牌',
    course2: '酒店入住：房型与早餐',
    summary1: '值机、托运行李和登机口问路。airport check-in practice.',
    summary2: '入住登记、房型确认和早餐时间。hotel check-in practice.',
  },
  B: {
    available: 'B-only 酒店入住：确认房型',
    inProgress: 'B-only 机场值机：换取登机牌',
    course1: 'B-only 酒店入住：房型与早餐',
    course2: 'B-only 机场值机：从问候到登机牌',
    summary1: 'B owner hotel check-in and breakfast time.',
    summary2: 'B owner airport check-in and boarding pass.',
  },
};

const SYNTHETIC = {
  copy: COPY,
  permissions: PERMISSIONS,
  owners: OWNER_DATA,
  expected: (owner = 'A') => expectedFor(owner),
  planLate: { old: '旧计划解释：等待中的迟到响应。', new: '新计划解释：已按最新目标重排。' },
};

const report = {
  scope: 'MB007_QA_SYNTHETIC_TRANSPORT',
  requests: [],
  unknown: [],
  principals: [],
  pageErrors: [],
  consoleErrors: [],
  consoleWarnings: [],
};

const live = new Set();
let browser = null;
let caseNumber = 0;

function expectedFor(owner = 'A') {
  const data = OWNER_DATA[owner] || OWNER_DATA.A;
  return {
    owner,
    available: data.available,
    inProgress: data.inProgress,
    completed: '退税柜台：材料核对',
    unavailable: '地铁换乘：问路',
    locked: '电话改签：客服沟通',
    published: [data.course1, data.course2],
    unpublished: '退税柜台：未发布草稿',
  };
}

function tasksFor(owner) {
  const data = OWNER_DATA[owner] || OWNER_DATA.A;
  return [
    { taskId: `available-${owner}`, taskType: 'LESSON', title: data.available, description: '跟着对话完成值机与行李托运。', minutes: 8, status: 'AVAILABLE', contentCode: 'mb007-course-airport', contentVersionPin: 7001 },
    { taskId: `in-progress-${owner}`, taskType: 'LESSON', title: data.inProgress, description: '继续上次的入住登记练习。', minutes: 5, status: 'IN_PROGRESS', contentCode: 'mb007-course-hotel', contentVersionPin: 7002 },
    { taskId: `completed-${owner}`, taskType: 'LESSON', title: '退税柜台：材料核对', description: '这一项已经完成。', minutes: 5, status: 'COMPLETED', contentCode: 'mb007-course-refund-draft' },
    { taskId: `unavailable-${owner}`, taskType: 'LESSON', title: '地铁换乘：问路', description: '这一版正在更新。', minutes: 4, status: 'UNAVAILABLE', unavailableReason: '内容版本正在更新，暂时不能开始。' },
    { taskId: `locked-${owner}`, taskType: 'LESSON', title: '电话改签：客服沟通', description: '完成前一课后解锁。', minutes: 6, status: 'LOCKED' },
  ];
}

function contentFor(owner) {
  const data = OWNER_DATA[owner] || OWNER_DATA.A;
  return [
    { contentCode: 'mb007-course-airport', contentType: 'COURSE', title: data.course1, summary: data.summary1, contentLocale: 'en-US', contentVersionId: 7001, availability: 'PUBLISHED' },
    { contentCode: 'mb007-course-hotel', contentType: 'COURSE', title: data.course2, summary: data.summary2, contentLocale: 'en-US', contentVersionId: 7002, availability: 'PUBLISHED' },
    { contentCode: 'mb007-course-refund-draft', contentType: 'COURSE', title: '退税柜台：未发布草稿', summary: '未发布内容不应出现在学习书架。', contentLocale: 'en-US', contentVersionId: 7003, availability: 'UNPUBLISHED' },
  ];
}

function isHomeUrl(url) {
  const raw = String(url || '');
  const hashPart = raw.includes('#') ? raw.slice(raw.indexOf('#')) : '';
  const key = hashPart.split('?')[0];
  return key === '#/' || key === '#/pages/home/home';
}

function routeKey(url) {
  const raw = String(url || '');
  const hashPart = raw.includes('#') ? raw.slice(raw.indexOf('#')) : '';
  return hashPart.split('?')[0];
}

async function init() {
  if (!browser) browser = await chromium.launch();
  return browser;
}

async function close() {
  for (const item of [...live]) {
    try { await item.close(); } catch { /* context already gone */ }
  }
  if (browser) await browser.close();
  browser = null;
}

async function fresh(options = {}) {
  if (!browser) throw new Error('Call init() explicitly; this module never launches on require');
  const {
    mode = 'ready',
    owner = 'A',
    locale = 'zh-CN',
    theme = 'light',
    colorScheme = null,
    width = 390,
    height = 844,
    caseId = null,
    waitReady = true,
    waitForHomeUrl = true,
    payloadSequence = false,
  } = options;
  if (!['light', 'dark', 'system', 'high-contrast'].includes(theme)) throw new Error('theme must be light, dark, system or high-contrast');
  const resolvedColorScheme = colorScheme || (theme === 'dark' ? 'dark' : 'light');
  if (resolvedColorScheme !== 'light' && resolvedColorScheme !== 'dark') throw new Error('colorScheme must be light or dark');
  const id = ++caseNumber;
  const caseKey = caseId || `case-${id}`;
  const context = await browser.newContext({
    viewport: { width, height },
    colorScheme: resolvedColorScheme,
    reducedMotion: 'reduce',
    hasTouch: false,
  });
  const state = {
    id,
    caseId,
    caseKey,
    mode,
    owner,
    locale,
    theme,
    payloadSequence,
    payloads: 0,
    generation: 0,
    homeAttempts: 0,
    todayAttempts: 0,
    counts: {
      login: 0, refresh: 0, principal: 0, profile: 0, targets: 0,
      preferences: 0, home: 0, catalog: 0, today: 0, contentDetail: 0,
      reviewQueue: 0, notifications: 0, support: 0, GET: 0, write: 0,
    },
    armed: [],
    holdNext: [],
    holds: [],
    events: [],
    permissionGap: false,
  };

  const tokenPair = () => ({
    accessToken: 'synthetic-mb007-qa-token-not-a-credential',
    refreshToken: null,
    deviceId: `qa-device-${id}`,
    sessionId: `qa-session-${id}`,
    adultGate: { status: 'PASSED', learningAccess: 'ELIGIBLE' },
  });
  const principal = () => {
    const subject = `qa-mb007-${state.owner}-${id}`;
    report.principals.push({ caseKey, subject, owner: state.owner, at: new Date().toISOString() });
    return {
      principal: { subject, permissions: PERMISSIONS, roles: ['learner'], adultGate: 'PASSED', adultLearningAccess: 'ELIGIBLE' },
      adultGate: { status: 'PASSED', learningAccess: 'ELIGIBLE' },
      learningAccess: 'ELIGIBLE',
      permissions: PERMISSIONS,
      consentState: { accepted: true, unsatisfiedPurposes: [], requiredPurposes: ['ACCOUNT_TERMS', 'PRIVACY_NOTICE', 'ADULT_LEARNING_ELIGIBILITY'], version: 'synthetic-summary-only' },
    };
  };
  const preferences = () => ({
    uiLocale: locale,
    contentLocale: 'en-US',
    timezone: 'Asia/Shanghai',
    themeMode: theme === 'system' ? 'SYSTEM' : theme === 'dark' ? 'DARK' : 'LIGHT',
    highContrast: theme === 'high-contrast',
    motionMode: 'REDUCED',
    stateVersion: 0,
  });
  const errorBody = (code) => ({ error: { code, message: 'Synthetic transport response; not a formal contract.' } });
  const emptyMode = () => ['emptyNO_PLAN', 'COMPLETED', 'NO_DUE_REVIEW', 'NO_CONTENT', 'stale'].includes(mode);

  function homeBody() {
    state.generation += 1;
    state.payloads += 1;
    const data = OWNER_DATA[state.owner] || OWNER_DATA.A;
    const tasks = emptyMode() ? [] : tasksFor(state.owner);
    if (payloadSequence && tasks.length) tasks[0] = { ...tasks[0], title: `G${state.payloads} ${tasks[0].title}` };
    const completedMinutes = mode === 'stale' ? 0 : payloadSequence ? state.payloads : 5;
    return {
      projectionVersion: state.generation,
      contentEpoch: 7,
      payloadSequence: state.payloads,
      tasks,
      targetMinutes: 15,
      completedMinutes,
      contentStatus: mode === 'NO_CONTENT' ? 'EMPTY' : mode === 'catalogUNAVAILABLE' ? 'UNAVAILABLE' : 'READY',
      stale: mode === 'stale',
      degradedReason: mode === 'stale' ? 'Synthetic stale projection; no fresh plan or progress fact.' : undefined,
      dailyStream: { completedMinutes, targetMinutes: 15 },
      ownerLabel: state.owner,
      titleHint: data.available,
    };
  }

  function planBody(todayAttempt = 0) {
    if (mode === 'planLate') {
      if (todayAttempt >= 3) {
        return {
          planId: 'plan_mb007_qa_new', status: 'ACTIVE', planVersion: 5,
          targetMinutes: 15, emptyReason: null,
          explanation: '新计划解释：已按最新目标重排。',
          firstLearning: null, algorithmVersion: 'SM2_Q03_V1', deferredCount: 0, items: [],
        };
      }
      return {
        planId: 'plan_mb007_qa_old', status: 'ACTIVE', planVersion: 4,
        targetMinutes: 15, emptyReason: null,
        explanation: '旧计划解释：等待中的迟到响应。',
        firstLearning: null, algorithmVersion: 'SM2_Q03_V1', deferredCount: 1,
        items: [{ itemId: 'old-plan-item-1', arrangement: 'DUE' }],
      };
    }
    const emptyPlan = (reason) => ({
      planId: '', status: 'EMPTY', planVersion: 0, targetMinutes: 15,
      emptyReason: reason, explanation: null, firstLearning: null,
      algorithmVersion: 'SM2_Q03_V1', deferredCount: 0, items: [],
    });
    if (mode === 'emptyNO_PLAN') return emptyPlan('NO_PLAN');
    if (mode === 'COMPLETED') return emptyPlan('COMPLETED');
    if (mode === 'NO_DUE_REVIEW') return emptyPlan('NO_DUE_REVIEW');
    if (mode === 'NO_CONTENT') return emptyPlan('NO_CONTENT');
    if (mode === 'stale') {
      return { planId: '', status: 'UNKNOWN', planVersion: 0, targetMinutes: 15, emptyReason: null, explanation: null, firstLearning: null, algorithmVersion: 'SM2_Q03_V1', deferredCount: 0, items: [] };
    }
    return {
      planId: 'plan_mb007_qa_synthetic_1', status: 'ACTIVE', planVersion: 3,
      targetMinutes: 15, emptyReason: null, explanation: null, firstLearning: null,
      algorithmVersion: 'SM2_Q03_V1', deferredCount: 1,
      items: [{ itemId: 'plan-item-1', arrangement: 'DUE' }, { itemId: 'plan-item-2', arrangement: 'DUE' }, { itemId: 'plan-item-3', arrangement: 'DEFERRED' }],
    };
  }

  function catalogBody() {
    if (mode === 'NO_CONTENT') return { items: [] };
    return { items: contentFor(state.owner) };
  }

  function detailBody(code) {
    const item = contentFor(state.owner).find((entry) => entry.contentCode === code);
    if (!item) return null;
    return {
      contentCode: item.contentCode,
      contentVersionId: item.contentVersionId,
      contentType: 'COURSE',
      title: item.title,
      summary: item.summary,
      contentLocale: 'en-US',
      items: [
        { itemId: `${item.contentCode}:item:1`, itemType: 'LESSON', text: 'Synthetic lesson item. No formal report, plan or legal text is produced.' },
      ],
    };
  }

  function matches(spec, method, apiPath) {
    if (spec.method && spec.method !== method) return false;
    return spec.path.endsWith('*') ? apiPath.startsWith(spec.path.slice(0, -1)) : apiPath === spec.path;
  }

  function takeArmed(method, apiPath) {
    const index = state.armed.findIndex((spec) => matches(spec, method, apiPath));
    if (index < 0) return null;
    const [spec] = state.armed.splice(index, 1);
    return { status: spec.status, data: spec.data };
  }

  function autoHold(apiPath, attempt) {
    if (apiPath !== '/api/v1/learner/home') return null;
    if (mode === 'loadinghold' && attempt === 1) return 'loading-held';
    if (mode === 'retry503Hold' && attempt === 2) return 'retry-held';
    return null;
  }

  function takeHold(apiPath, method, attempt) {
    const manualIndex = state.holdNext.findIndex((spec) => matches(spec, method, apiPath));
    if (manualIndex >= 0) {
      const [spec] = state.holdNext.splice(manualIndex, 1);
      return spec.label || 'manual-held';
    }
    const label = autoHold(apiPath, attempt);
    return label || null;
  }

  function recordHold(label, route, requestRecord, data, headers) {
    const held = {
      id: `${state.id}-${state.events.length + 1}`,
      label,
      route,
      requestRecord,
      data,
      status: 200,
      headers,
      receivedAt: new Date().toISOString(),
    };
    state.holds.push(held);
    requestRecord.held = true;
    state.events.push({ kind: 'received', label, path: requestRecord.path, owner: state.owner, generation: state.generation, payload: data.payloadSequence ?? null, at: held.receivedAt });
    return held;
  }

  async function releaseHold(label) {
    const index = state.holds.findIndex((held) => !label || held.label === label);
    if (index < 0) return { received: false, fulfilled: false, aborted: false, error: 'no held request' };
    const [held] = state.holds.splice(index, 1);
    try {
      await held.route.fulfill({ status: held.status, headers: held.headers, body: JSON.stringify(held.data) });
      held.requestRecord.status = held.status;
      held.requestRecord.held = false;
      const event = { kind: 'fulfilled', label: held.label, path: held.requestRecord.path, owner: held.owner, generation: held.generation, payload: held.data.payloadSequence ?? null, status: held.status, at: new Date().toISOString() };
      state.events.push(event);
      return { received: true, fulfilled: true, aborted: false, label: held.label, status: held.status, owner: held.owner, generation: held.generation, payload: held.data.payloadSequence ?? null, planExplanation: held.data.explanation ?? null };
    } catch (error) {
      const event = { kind: 'aborted', label: held.label, path: held.requestRecord.path, owner: held.owner, generation: held.generation, error: error.message, at: new Date().toISOString() };
      state.events.push(event);
      return { received: true, fulfilled: false, aborted: true, label: held.label, error: error.message, owner: held.owner, generation: held.generation, payload: held.data.payloadSequence ?? null };
    }
  }

  async function waitForHold(label, timeoutMs = 10000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const event = state.events.find((entry) => entry.kind === 'received' && (!label || entry.label === label));
      if (event) return event;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return null;
  }

  function holdSummary() {
    return {
      received: state.events.filter((entry) => entry.kind === 'received').length,
      fulfilled: state.events.filter((entry) => entry.kind === 'fulfilled').length,
      aborted: state.events.filter((entry) => entry.kind === 'aborted').length,
      pending: state.holds.length,
      events: state.events.slice(),
    };
  }

  await context.route('**/*', async (route) => {
    const request = route.request();
    let url;
    try { url = new URL(request.url()); } catch { return route.abort(); }
    if (url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') return route.abort();
    const apiPath = url.pathname;
    if (!apiPath.startsWith('/api/v1/')) return route.continue();
    const method = request.method();
    const requestRecord = { caseId: id, caseKey, method, path: apiPath, status: null, held: false };
    report.requests.push(requestRecord);
    if (method === 'GET') state.counts.GET += 1;
    if (method !== 'GET' && method !== 'OPTIONS') state.counts.write += 1;
    const headers = {
      'content-type': 'application/json',
      'access-control-allow-origin': BASE,
      'access-control-allow-credentials': 'true',
      'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      'access-control-allow-headers': 'content-type,authorization,idempotency-key,if-match,accept-language',
    };
    if (method === 'OPTIONS') {
      requestRecord.status = 204;
      return route.fulfill({ status: 204, headers, body: '' });
    }

    const armed = takeArmed(method, apiPath);
    if (armed) {
      requestRecord.status = armed.status;
      return route.fulfill({ status: armed.status, headers, body: JSON.stringify(armed.data) });
    }

    let status = 200;
    let data;
    let attempt = null;
    if (method === 'POST' && apiPath === '/api/v1/auth/login') {
      state.counts.login += 1;
      data = tokenPair();
    } else if (method === 'POST' && apiPath === '/api/v1/auth/token/refresh') {
      state.counts.refresh += 1;
      if (mode === 'home401') {
        status = 401;
        data = errorBody('REFRESH_UNAUTHORIZED');
      } else {
        data = tokenPair();
      }
    } else if (method === 'GET' && (apiPath === '/api/v1/iam/principal/me' || apiPath === '/api/v1/iam/permissions')) {
      state.counts.principal += 1;
      data = principal();
    } else if (method === 'GET' && apiPath === '/api/v1/learner/profile') {
      state.counts.profile += 1;
      data = { stateVersion: 0, status: 'ACTIVE', birthYear: 1990, ageConfirmed: true, privacyConsent: true, termsConsent: true, uiLocale: locale, contentLocale: 'en-US' };
    } else if (method === 'GET' && apiPath === '/api/v1/learner/targets') {
      state.counts.targets += 1;
      data = { goalCode: 'FOUNDATION', dailyQuotaMinutes: 15, targetLevel: 'A1', status: 'ACTIVE', stateVersion: 0 };
    } else if (method === 'GET' && apiPath === '/api/v1/learner/preferences') {
      state.counts.preferences += 1;
      data = preferences();
    } else if (method === 'GET' && apiPath === '/api/v1/learner/home') {
      state.counts.home += 1;
      state.homeAttempts += 1;
      attempt = state.homeAttempts;
      if ((mode === 'home503' || mode === 'retry503Hold') && attempt === 1) {
        status = 503;
        data = errorBody('SERVICE_UNAVAILABLE');
      } else if (mode === 'home401' && attempt === 1) {
        status = 401;
        data = errorBody('UNAUTHORIZED');
      } else if (mode === 'home403' && attempt === 1) {
        status = 403;
        state.permissionGap = true;
        data = errorBody('PERMISSION_DENIED');
      } else {
        data = homeBody();
      }
    } else if (method === 'GET' && apiPath === '/api/v1/content/learner/catalog') {
      state.counts.catalog += 1;
      if (mode === 'catalogUNAVAILABLE') {
        status = 503;
        data = errorBody('CONTENT_UNAVAILABLE');
      } else {
        data = catalogBody();
      }
    } else if (method === 'GET' && apiPath === '/api/v1/learning/today') {
      state.counts.today += 1;
      state.todayAttempts += 1;
      attempt = state.todayAttempts;
      if (mode === 'planLate' && attempt === 1) {
        status = 503;
        data = errorBody('PLAN_UNAVAILABLE');
      } else {
        data = planBody(attempt);
      }
    } else if (method === 'GET' && apiPath === '/api/v1/learning/review-queue') {
      state.counts.reviewQueue += 1;
      data = { items: [], emptyStatus: 'EMPTY', emptyCopy: 'No due reviews.', history: [], projectionVersion: 'mb007-qa-empty-1' };
    } else if (method === 'GET' && apiPath === '/api/v1/notifications/preferences') {
      state.counts.notifications += 1;
      data = { items: [], meta: { hasMore: false, nextCursor: null } };
    } else if (method === 'GET' && apiPath === '/api/v1/support/tickets') {
      state.counts.support += 1;
      data = { data: { ticketCopy: '', supportNumber: '' } };
    } else if (method === 'GET' && apiPath.startsWith('/api/v1/content/learner/')) {
      state.counts.contentDetail += 1;
      const code = decodeURIComponent(apiPath.slice('/api/v1/content/learner/'.length));
      const detail = detailBody(code);
      if (!detail) {
        status = 404;
        data = errorBody('CONTENT_NOT_FOUND');
      } else {
        data = detail;
      }
    } else {
      status = 501;
      data = { code: 'SYNTHETIC_UNKNOWN_ROUTE' };
      report.unknown.push({ caseId: id, caseKey, method, path: apiPath, status: 501 });
    }

    requestRecord.status = status;
    if (status === 200 && method === 'GET' && (apiPath === '/api/v1/learner/home' || apiPath === '/api/v1/learning/today')) {
      const label = takeHold(apiPath, method, attempt);
      if (label) {
        recordHold(label, route, requestRecord, data, headers);
        return;
      }
    }
    await route.fulfill({ status, headers, body: JSON.stringify(data) });
  });

  const page = await context.newPage();
  page.on('pageerror', (error) => report.pageErrors.push({ caseId: id, caseKey, name: error.name, message: error.message, stack: error.stack || null }));
  page.on('console', (message) => {
    const type = message.type();
    if (type === 'warning') {
      report.consoleWarnings.push({ caseId: id, caseKey, message: message.text() });
      return;
    }
    if (type !== 'error') return;
    let consolePath = null;
    try {
      const location = message.location();
      if (location && location.url) consolePath = new URL(location.url).pathname;
    } catch { consolePath = null; }
    report.consoleErrors.push({ caseId: id, caseKey, message: message.text(), path: consolePath });
  });

  const loginUrl = `${BASE}/#/pages/login/login?theme=${encodeURIComponent(theme)}&uiLocale=${encodeURIComponent(locale)}&returnTo=${encodeURIComponent(HOME_PATH)}`;
  try {
    await page.goto(loginUrl, { waitUntil: 'networkidle' });
    await page.locator('#mobile-login-identifier').waitFor({ timeout: 20000 });
    await page.locator('#mobile-login-identifier').fill(`qa-mb007-${state.owner}`);
    await page.locator('#mobile-login-password').fill('SyntheticOnly123');
    await page.locator('.login-submit').click();
    if (waitForHomeUrl) {
      await page.waitForURL((url) => isHomeUrl(url.toString()), { timeout: 30000 });
    } else {
      await page.waitForTimeout(1500);
    }
    if (waitReady) {
      const deadline = Date.now() + 25000;
      while (Date.now() < deadline) {
        if (state.counts.home >= 1 && (state.counts.catalog >= 1 || mode === 'catalogUNAVAILABLE')) break;
        await page.waitForTimeout(150);
      }
    }
  } catch (error) {
    await context.close().catch(() => {});
    throw error;
  }

  const item = {
    id,
    page,
    context,
    state,
    mode,
    expected: (owner = state.owner) => expectedFor(owner),
    payloadTitle: (sequence = state.payloads) => `G${sequence} ${(OWNER_DATA[state.owner] || OWNER_DATA.A).available}`,
    armResponse: (specPath, response = {}) => state.armed.push({
      path: specPath,
      method: response.method || 'GET',
      status: response.status || 500,
      data: response.data || { error: { code: response.code || 'SYNTHETIC_ARMED', message: 'Synthetic transport response.' } },
    }),
    holdNext: (specPath, label = 'manual-held', method = 'GET') => state.holdNext.push({ path: specPath, label, method }),
    releaseHold,
    waitForHold,
    holdSummary,
    switchOwner: (nextOwner) => { state.owner = nextOwner; return state.owner; },
    close: async () => {
      for (const held of state.holds) {
        state.events.push({ kind: 'aborted', label: held.label, path: held.requestRecord.path, owner: held.owner, generation: held.generation, error: 'context closed before release', at: new Date().toISOString() });
      }
      state.holds = [];
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
  STORE,
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
  expectedFor,
  SYNTHETIC,
  COPY,
};
