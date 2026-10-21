'use strict';
// PREPARED_NOT_RUN. Static coverage plan for the frozen MB006 assessment page.
// Copy strings below are transcribed from the frozen i18n files; they are
// assertions on rendered text, not new copy.

const PAGE = 'apps/mobile/src/pages/assessment/assessment.vue';
const I18N = 'packages/i18n/src/mobile-experience.ts';
const EXPECTED_PAGE_SHA256 = '86620ed0dbc2cb25afb4bbae35734a345b9e8066afa806684f99ccb678a5312d';
const EXPECTED_I18N_SHA256 = '6ac6800e179de0ba15ab3607918b2f8427d364e19306eaf8f2a146f016247380';

const BASE = 'http://127.0.0.1:18183';
const LOCALES = ['zh-CN', 'en-US'];
const THEMES = ['light', 'dark', 'high-contrast', 'system'];
const WIDTHS = [320, 390, 768, 1280];
const HEIGHTS = { 320: 568, 390: 844, 768: 1024, 1280: 900 };

const TITLES = {
  guide: { 'zh-CN': '水平测评', 'en-US': 'Level check' },
  question: { 'zh-CN': '水平测评', 'en-US': 'Level check' },
  report: { 'zh-CN': '测评结果', 'en-US': 'Your result' },
  'retest-confirm': { 'zh-CN': '测评结果', 'en-US': 'Your result' },
  'retest-cancelled': { 'zh-CN': '测评结果', 'en-US': 'Your result' },
};

const COPY = {
  'zh-CN': { start: '开始测评', submit: '提交答案', selected: '已选', retestConfirm: '确认重测', retestTitle: '重新测评？' },
  'en-US': { start: 'Start assessment', submit: 'Submit answer', selected: 'Selected', retestConfirm: 'Confirm new assessment', retestTitle: 'Start a new assessment?' },
};

const CONTROL_IDS = {
  guide: ['assessment-back', 'assessment-settings', 'assessment-start', 'assessment-home'],
  question: ['assessment-back', 'assessment-settings', 'assessment-option-A', 'assessment-option-B', 'assessment-option-C', 'assessment-option-D', 'assessment-submit'],
  report: ['assessment-back', 'assessment-settings', 'assessment-today', 'assessment-retest'],
  'retest-confirm': ['assessment-back', 'assessment-settings', 'assessment-today', 'assessment-retest', 'assessment-retest-cancel', 'assessment-retest-confirm'],
  'retest-cancelled': ['assessment-back', 'assessment-settings', 'assessment-today', 'assessment-retest'],
};

// Exact semantic palette from packages/design-tokens/src/mobile.ts +
// official-site.ts at the frozen revision. Compared against computed custom
// properties per resolved theme; mismatch is a hard failure, not a guess.
const PALETTE = {
  light: {
    '--yx-brand': [89, 55, 209],
    '--yx-brand-soft': [238, 235, 252],
    '--yx-action': [89, 55, 209],
    '--yx-on-brand': [255, 255, 255],
    '--yx-text-primary': [36, 38, 55],
    '--yx-text-secondary': [104, 109, 128],
    '--yx-surface-page': [247, 248, 252],
    '--yx-surface-card': [255, 255, 255],
    '--yx-surface-soft': [240, 241, 247],
    '--yx-border': [228, 229, 239],
    '--yx-focus': [89, 55, 209],
    '--yx-success-soft': [234, 240, 237],
    '--yx-danger': [165, 43, 70],
  },
  dark: {
    '--yx-brand': [195, 181, 250],
    '--yx-brand-soft': [48, 43, 73],
    '--yx-action': [89, 55, 209],
    '--yx-on-brand': [255, 255, 255],
    '--yx-text-primary': [244, 246, 255],
    '--yx-text-secondary': [178, 183, 205],
    '--yx-surface-page': [22, 25, 37],
    '--yx-surface-card': [34, 38, 56],
    '--yx-surface-soft': [40, 45, 64],
    '--yx-border': [54, 59, 80],
    '--yx-focus': [195, 181, 250],
    '--yx-success-soft': [37, 55, 48],
    '--yx-danger': [255, 179, 190],
  },
  'high-contrast': {
    '--yx-brand': [195, 181, 250],
    '--yx-brand-soft': [48, 43, 73],
    '--yx-action': [89, 55, 209],
    '--yx-on-brand': [255, 255, 255],
    '--yx-text-primary': [255, 255, 255],
    '--yx-text-secondary': [226, 230, 241],
    '--yx-surface-page': [0, 0, 0],
    '--yx-surface-card': [13, 16, 24],
    '--yx-surface-soft': [40, 45, 64],
    '--yx-border': [226, 230, 241],
    '--yx-focus': [195, 181, 250],
    '--yx-success-soft': [37, 55, 48],
    '--yx-danger': [255, 179, 190],
  },
};

function groupList(c, groups) {
  return groups.filter(g => {
    if (g === 'compact') return c.width <= 390;
    if (g === 'wide') return c.width >= 768;
    if (g === 'theme') return c.theme === 'high-contrast' || c.theme === 'system';
    return false;
  });
}

function buildPlan() {
  const plan = [];
  for (const locale of LOCALES) {
    for (const theme of THEMES) {
      for (const width of WIDTHS) {
        const id = `${locale}__${theme}__${width}`;
        // Named system contexts: 390 is emulated dark on entry (named
        // "system follows dark"); 768 performs a live media light<->dark switch.
        const colorScheme = theme === 'system' && width === 390 ? 'dark' : 'light';
        const systemLiveSwitch = theme === 'system' && width === 768;
        plan.push({
          id, locale, theme, width, height: HEIGHTS[width], colorScheme,
          textScale: null, short: false, systemLiveSwitch,
        });
      }
    }
  }
  // Extra declared contexts, not 200% repetitions of all 32.
  plan.push({
    id: 'en-US__dark__320__text200__short',
    locale: 'en-US', theme: 'dark', width: 320, height: 568, colorScheme: 'light',
    textScale: 200, short: true, systemLiveSwitch: false, extra: 'text200+short',
  });
  plan.push({
    id: 'zh-CN__light__390__short',
    locale: 'zh-CN', theme: 'light', width: 390, height: 640, colorScheme: 'light',
    textScale: null, short: true, systemLiveSwitch: false, extra: 'short',
  });
  for (const c of plan) c.groups = groupList(c, ['compact', 'wide', 'theme']);
  return plan;
}

const PLAN = buildPlan();
const STATE_ORDER = ['guide', 'question', 'report', 'retest-confirm', 'retest-cancelled'];
const SHOTS = {
  guide: '01-guide.png',
  question: '02-question-selected.png',
  report: '03-report.png',
  'retest-confirm': '05-retest-confirmation.png',
  'retest-cancelled': '06-retest-cancelled.png',
};
const REPORT_FULL = '04-report-fullpage.png';
const QUESTION_FULL = '02b-question-fullpage.png';
const SYSTEM_SWITCH_SHOT = '01b-guide-system-dark.png';
const SYSTEM_SWITCH_CONTEXT = 'en-US__system__768';

function expectedPalette(theme, colorScheme) {
  const resolved = theme === 'system' ? (colorScheme === 'dark' ? 'dark' : 'light') : theme;
  return { resolved, palette: PALETTE[resolved] };
}

function expectedResolved(theme, colorScheme) {
  return theme === 'system' ? (colorScheme === 'dark' ? 'dark' : 'light') : theme;
}

function plannedScreenshots(selected) {
  const base = selected.length * (STATE_ORDER.length + 1); // + report fullPage
  const extraSwitch = selected.some(c => c.systemLiveSwitch) ? 1 : 0;
  const extraText200 = selected.some(c => c.textScale === 200) ? 1 : 0;
  const extraNarrow = selected.filter(c => c.width === 320).length * 2; // guide + question fullPage
  return base + extraSwitch + extraText200 + extraNarrow;
}

module.exports = {
  BASE, PAGE, I18N, EXPECTED_PAGE_SHA256, EXPECTED_I18N_SHA256,
  LOCALES, THEMES, WIDTHS, HEIGHTS, TITLES, COPY, CONTROL_IDS, PALETTE,
  PLAN, STATE_ORDER, SHOTS, REPORT_FULL, QUESTION_FULL, SYSTEM_SWITCH_SHOT, SYSTEM_SWITCH_CONTEXT,
  expectedPalette, expectedResolved, plannedScreenshots,
};
