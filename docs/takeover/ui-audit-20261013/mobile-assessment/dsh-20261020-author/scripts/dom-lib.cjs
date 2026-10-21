// Re-saved for dsh-20261020-author. Shared measurement helpers only.
// Not a browser launcher; callers own Playwright contexts.
const WORD_RE = /[A-Za-z]+(?:['’-][A-Za-z]+)*/g;

// Simulate CSS text scaling by multiplying every computed font size by the factor.
// This is CSS text-size scaling, not browser zoom and not native font scaling.
async function scale(page, factor) {
  await page.evaluate((factor) => {
    if (window.__textScaleRestore) {
      for (const [el, value] of window.__textScaleRestore) el.style.fontSize = value;
      window.__textScaleRestore = null;
    }
    if (!factor || factor === 1) return;
    const root = document.getElementById('assessment-page');
    if (!root) return;
    const nodes = [root, ...root.querySelectorAll('*')];
    const sizes = nodes.map((el) => [el, parseFloat(getComputedStyle(el).fontSize), el.style.fontSize]);
    window.__textScaleRestore = sizes.map(([el, , value]) => [el, value]);
    for (const [el, size] of sizes) el.style.fontSize = size * factor + 'px';
  }, factor);
}

// DOMRange per-word line-fragment test. A word with client rects on more than one
// rounded y coordinate is split inside the word (the failure mode we must not hide
// behind a no-horizontal-overflow check).
async function collect(page, options = {}) {
  const { includeButtons = true } = options;
  return page.evaluate(({ includeButtons, WORD_SRC }) => {
    const WORD_RE = new RegExp(WORD_SRC, 'g');
    const root = document.getElementById('assessment-page');
    const targets = [document.getElementById('assessment-title')].filter(Boolean);
    if (includeButtons && root) targets.push(...root.querySelectorAll('uni-button'));
    const words = [];
    for (const el of targets) {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        for (const m of node.textContent.matchAll(WORD_RE)) {
          const range = document.createRange();
          range.setStart(node, m.index);
          range.setEnd(node, m.index + m[0].length);
          const rects = [...range.getClientRects()]
            .filter((b) => b.width && b.height)
            .map((b) => ({ x: Math.round(b.x), y: Math.round(b.y), width: Math.round(b.width), height: Math.round(b.height) }));
          const lines = new Set(rects.map((b) => b.y));
          words.push({ id: el.id || el.tagName, word: m[0], rects, lineCount: lines.size, split: lines.size > 1 });
        }
      }
    }
    const h1 = document.getElementById('assessment-title');
    const progress = root?.querySelector('[role=progressbar]');
    const meta = root?.querySelector('.assessment-question-meta');
    const received = root?.querySelector('.assessment-received');
    const state = {
      route: location.hash.split('?')[0],
      title: document.title,
      viewport: { width: innerWidth, height: innerHeight },
      textScale: 'CSS computed font sizes multiplied by 2 on #assessment-page subtree; not browser/native zoom',
      h1: h1 ? { text: h1.textContent, fontSize: getComputedStyle(h1).fontSize } : null,
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
      overlay: !!document.querySelector('vite-error-overlay'),
      words,
      splitWords: words.filter((w) => w.split),
      progress: progress ? {
        label: progress.getAttribute('aria-label'),
        valuemin: progress.getAttribute('aria-valuemin'),
        valuemax: progress.getAttribute('aria-valuemax'),
        valuenow: progress.getAttribute('aria-valuenow'),
        valuetext: progress.getAttribute('aria-valuetext'),
      } : null,
      metaText: meta ? meta.innerText : null,
      receivedText: received ? received.innerText : null,
      options: root ? [...root.querySelectorAll('.assessment-option')].map((n) => ({
        id: n.id,
        pressed: n.getAttribute('aria-pressed'),
        disabled: n.hasAttribute('disabled'),
        text: n.innerText,
        height: Math.round(n.getBoundingClientRect().height),
      })) : [],
      buttons: includeButtons && root ? [...root.querySelectorAll('uni-button')].map((n) => {
        const b = n.getBoundingClientRect();
        return {
          id: n.id, text: n.innerText, disabled: n.hasAttribute('disabled'),
          width: Math.round(b.width), height: Math.round(b.height), font: getComputedStyle(n).fontSize,
        };
      }) : [],
      bodyText: root ? root.innerText : '',
    };
    state.rawKey = /mobile\.assessment\.|assessment\.[A-Za-z]+|\{(?:count|total|current|score|full)\}/.test(state.bodyText || '');
    state.hanInEnBody = /[\u3400-\u9fff]/.test(state.bodyText || '');
    return state;
  }, { includeButtons, WORD_SRC: WORD_RE.source });
}

module.exports = { scale, collect };
