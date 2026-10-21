'use strict';
// PREPARED_NOT_RUN. In-page measurement helpers. `collect` is serialized by
// Playwright into the frozen H5 page; it only reads DOM geometry, computed
// styles and accessibility attributes. It never reads cookies/storage,
// request bodies/headers or product store state, and never mutates DOM content.

/**
 * @param {{state:string, locale:string, theme:string, width:number, height:number,
 *          textScale:(number|null), expectedTitle:string,
 *          expectedControlIds:string[]}} cfg
 */
function collect(cfg) {
  const errors = [];
  const out = {
    state: cfg.state,
    locale: cfg.locale,
    themeRequested: cfg.theme,
    textScale: cfg.textScale || null,
    errors,
  };
  const root = document.getElementById('assessment-page');
  if (!root) { out.fatal = 'assessment-root-missing'; return out; }

  const winW = window.innerWidth, winH = window.innerHeight;
  const rectOf = el => {
    const r = el.getBoundingClientRect();
    return { x: round(r.x), y: round(r.y), width: round(r.width), height: round(r.height), top: round(r.top), right: round(r.right), bottom: round(r.bottom), left: round(r.left) };
  };
  function round(n) { return Math.round(n * 100) / 100; }
  function px(v) { const n = parseFloat(v); return Number.isFinite(n) ? round(n) : null; }

  function parseColor(input) {
    if (!input) return null;
    const str = String(input).trim();
    if (str === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
    const m = str.match(/rgba?\(([^)]+)\)/i);
    if (m) {
      const p = m[1].split(/[\s,\/]+/).filter(Boolean).map(Number);
      if (p.length >= 3 && p.slice(0, 3).every(Number.isFinite)) return { r: p[0], g: p[1], b: p[2], a: p.length > 3 && Number.isFinite(p[3]) ? p[3] : 1 };
      return null;
    }
    const hex = str.match(/^#([0-9a-f]{3,8})$/i);
    if (hex) {
      let h = hex[1];
      if (h.length === 3 || h.length === 4) h = h.split('').map(c => c + c).join('');
      const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
      const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
      return { r, g, b, a };
    }
    try {
      const probe = document.createElement('span');
      probe.style.color = str;
      probe.style.display = 'none';
      document.body.appendChild(probe);
      const c = getComputedStyle(probe).color;
      probe.remove();
      if (c !== str) return parseColor(c);
    } catch (e) { /* unparsable */ }
    return null;
  }
  const blend = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 });
  const chan = v => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
  const lum = c => 0.2126 * chan(c.r) + 0.7152 * chan(c.g) + 0.0722 * chan(c.b);
  const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
  const rgbArr = c => c ? [Math.round(c.r), Math.round(c.g), Math.round(c.b)] : null;

  function bgOf(el) {
    const layers = [];
    let n = el;
    while (n && n.nodeType === 1) {
      const c = parseColor(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0) layers.push(c);
      n = n.parentElement;
    }
    let acc = { r: 255, g: 255, b: 255, a: 1 };
    for (let i = layers.length - 1; i >= 0; i--) acc = blend(layers[i], acc);
    return acc;
  }

  function visible(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0;
  }

  function directText(el) {
    let text = '';
    for (const n of el.childNodes) if (n.nodeType === 3) text += n.nodeValue;
    return text.replace(/\s+/g, ' ').trim();
  }

  // Effective glyph size can live on a nested span (uni-text/uni-button slots).
  function effectiveFontSize(el) {
    let max = px(getComputedStyle(el).fontSize) || 0;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (!node.nodeValue || !node.nodeValue.trim()) continue;
      const parent = node.parentElement;
      if (!parent) continue;
      const size = px(getComputedStyle(parent).fontSize);
      if (size && size > max) max = size;
    }
    return round(max);
  }

  try {
    out.viewport = {
      width: winW, height: winH, dpr: window.devicePixelRatio,
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
      innerWidth: winW,
    };
    out.url = { origin: location.origin, pathname: location.pathname, hash: location.hash };
    out.overlay = !!document.querySelector('vite-error-overlay, #vite-error-overlay');
    out.document = {
      htmlLang: document.documentElement.lang || null,
      datasetTheme: document.documentElement.dataset.theme || null,
      datasetUiLocale: document.documentElement.dataset.uiLocale || null,
      datasetContentLocale: document.documentElement.dataset.contentLocale || null,
      title: document.title,
    };
    out.present = {
      guide: !!document.getElementById('assessment-guide'),
      question: !!document.getElementById('assessment-question'),
      report: !!document.getElementById('assessment-report'),
      retestConfirm: !!document.getElementById('assessment-retest-confirmation'),
      pending: !!document.getElementById('assessment-pending'),
    };
    out.shell = (() => {
      const shell = document.querySelector('.assessment-shell');
      if (!shell) return null;
      const r = rectOf(shell);
      return { ...r, centeredDelta: round(Math.abs((r.left + r.width / 2) - winW / 2)) };
    })();
    out.root = { rect: rectOf(root), background: rgbArr(parseColor(getComputedStyle(root).backgroundColor)) };
  } catch (e) { errors.push('frame:' + e.message); }

  // Theme palette, normalized through computed color so hex/short-hex compare.
  try {
    const probe = document.createElement('span');
    probe.style.display = 'none';
    document.body.appendChild(probe);
    const names = ['--yx-brand', '--yx-brand-soft', '--yx-action', '--yx-on-brand', '--yx-text-primary', '--yx-text-secondary', '--yx-surface-page', '--yx-surface-card', '--yx-surface-soft', '--yx-border', '--yx-focus', '--yx-success-soft', '--yx-danger'];
    const palette = {};
    for (const name of names) {
      const raw = getComputedStyle(root).getPropertyValue(name).trim();
      let parsed = null;
      if (raw) {
        probe.style.color = '';
        probe.style.color = raw;
        const computed = getComputedStyle(probe).color;
        parsed = parseColor(computed);
      }
      palette[name] = { raw, rgb: rgbArr(parsed), alpha: parsed ? round(parsed.a) : null };
    }
    probe.remove();
    out.palette = palette;
  } catch (e) { errors.push('palette:' + e.message); out.palette = {}; }

  // H1 must exist, be visible, carry an accurate title and keep its 28px size.
  try {
    const h1 = document.getElementById('assessment-title');
    out.h1 = h1 ? {
      text: (h1.textContent || '').trim(),
      expected: cfg.expectedTitle,
      match: (h1.textContent || '').trim() === cfg.expectedTitle,
      visible: visible(h1),
      rect: rectOf(h1),
      role: h1.getAttribute('role'),
      ariaLevel: h1.getAttribute('aria-level'),
      fontSize: effectiveFontSize(h1),
      hostFontSize: px(getComputedStyle(h1).fontSize),
      fontWeight: px(getComputedStyle(h1).fontWeight),
      color: getComputedStyle(h1).color,
    } : null;
  } catch (e) { errors.push('h1:' + e.message); out.h1 = null; }

  // Actual uni-button hosts. An empty array is a failure, never a pass.
  try {
    const hosts = [...root.querySelectorAll('uni-button')];
    const plainButtons = [...root.querySelectorAll('button')];
    out.controls = {
      host: 'uni-button',
      count: hosts.length,
      plainButtonCount: plainButtons.length,
      expectedIds: cfg.expectedControlIds,
      list: hosts.map(el => {
        const cs = getComputedStyle(el);
        const r = rectOf(el);
        const text = (el.innerText || '').replace(/\s+/g, ' ').trim();
        const disabledAttr = el.hasAttribute('disabled');
        const ariaDisabled = el.getAttribute('aria-disabled') === 'true';
        return {
          id: el.id || null,
          classes: typeof el.className === 'string' ? el.className : '',
          text,
          ariaLabel: el.getAttribute('aria-label'),
          ariaPressed: el.getAttribute('aria-pressed'),
          disabled: disabledAttr || ariaDisabled,
          disabledAttr,
          ariaDisabled,
          visible: visible(el),
          rect: r,
          fontSize: px(cs.fontSize),
          fontWeight: px(cs.fontWeight),
          color: cs.color,
          background: rgbArr(parseColor(cs.backgroundColor)),
          borderColor: cs.borderColor,
          borderWidth: px(cs.borderTopWidth),
          opacity: px(cs.opacity),
          role: el.getAttribute('role'),
          tabIndex: el.getAttribute('tabindex'),
        };
      }),
    };
    const ids = out.controls.list.map(c => c.id).filter(Boolean);
    out.controls.missing = cfg.expectedControlIds.filter(id => !ids.includes(id));
    out.controls.extra = ids.filter(id => !cfg.expectedControlIds.includes(id));
    out.controls.disabled = out.controls.list.filter(c => c.disabled).map(c => ({ id: c.id, ariaDisabled: c.ariaDisabled, opacity: c.opacity, contrastExempt: true }));
  } catch (e) { errors.push('controls:' + e.message); out.controls = null; }

  try {
    const complete = document.querySelector('#assessment-report .assessment-complete, #assessment-skipped .assessment-complete');
    out.complete = complete ? {
      text: (complete.textContent || '').replace(/\s+/g, ' ').trim(),
      iconCount: complete.querySelectorAll('svg, img, uni-image').length,
      color: getComputedStyle(complete.querySelector('uni-text') || complete).color,
    } : null;
  } catch (e) { errors.push('complete:' + e.message); out.complete = null; }

  try {
    const inputs = [...root.querySelectorAll('input, textarea, select, [contenteditable="true"]')];
    out.inputs = { count: inputs.length, list: inputs.map(el => ({ tag: el.tagName.toLowerCase(), type: el.getAttribute('type'), id: el.id || null })) };
  } catch (e) { errors.push('inputs:' + e.message); out.inputs = null; }

  try {
    out.options = {
      count: [...root.querySelectorAll('.assessment-option')].length,
      list: [...root.querySelectorAll('.assessment-option')].map(el => {
        const cs = getComputedStyle(el);
        const sel = el.querySelector('.assessment-selected');
        return {
          id: el.id || null,
          key: (el.querySelector('.assessment-option-key')?.textContent || '').trim(),
          text: (el.querySelector('.assessment-option-text')?.textContent || '').trim(),
          fontSize: effectiveFontSize(el),
          hostFontSize: px(cs.fontSize),
          rect: rectOf(el),
          ariaPressed: el.getAttribute('aria-pressed'),
          selectedClass: el.classList.contains('is-selected'),
          selectedLabel: sel ? (sel.textContent || '').replace(/\s+/g, ' ').trim() : '',
          selectedHasIcon: sel ? sel.querySelectorAll('svg, img, uni-image').length > 0 : false,
        };
      }),
    };
  } catch (e) { errors.push('options:' + e.message); out.options = null; }

  try {
    out.selected = (() => {
      const el = document.getElementById('assessment-option-A');
      if (!el) return null;
      const sel = el.querySelector('.assessment-selected');
      return {
        ariaPressed: el.getAttribute('aria-pressed'),
        classSelected: el.classList.contains('is-selected'),
        label: sel ? (sel.textContent || '').replace(/\s+/g, ' ').trim() : '',
        labelVisible: sel ? visible(sel) : false,
        iconCount: sel ? sel.querySelectorAll('svg, img, uni-image').length : 0,
        background: rgbArr(parseColor(getComputedStyle(el).backgroundColor)),
        borderColor: getComputedStyle(el).borderColor,
      };
    })();
  } catch (e) { errors.push('selected:' + e.message); out.selected = null; }

  try {
    const bar = document.querySelector('[role=progressbar]');
    const fill = document.querySelector('.assessment-progress-value');
    out.progress = bar ? {
      ariaNow: Number(bar.getAttribute('aria-valuenow')),
      ariaMin: bar.getAttribute('aria-valuemin'),
      ariaMax: bar.getAttribute('aria-valuemax'),
      ariaText: bar.getAttribute('aria-valuetext'),
      fillWidth: fill ? rectOf(fill).width : null,
      trackWidth: fill && fill.parentElement ? rectOf(fill.parentElement).width : null,
    } : null;
    const feedback = document.querySelector('.assessment-feedback');
    out.feedback = feedback ? { text: (feedback.textContent || '').trim(), role: feedback.getAttribute('role') } : null;
    const error = document.getElementById('assessment-error');
    out.error = error ? { text: (error.textContent || '').trim(), role: error.getAttribute('role') } : null;
    const conf = document.getElementById('assessment-retest-confirmation');
    out.confirmation = conf ? {
      role: conf.getAttribute('role'),
      title: (document.getElementById('assessment-retest-title')?.textContent || '').trim(),
      confirm: (document.getElementById('assessment-retest-confirm')?.textContent || '').trim(),
      cancel: (document.getElementById('assessment-retest-cancel')?.textContent || '').trim(),
    } : null;
  } catch (e) { errors.push('state-signals:' + e.message); }

  // Text typography, contrast, clipping and intra-word wrapping.
  try {
    const textEls = [];
    for (const el of root.querySelectorAll('*')) {
      const text = directText(el);
      if (text) textEls.push({ el, text });
    }
    const samples = [], textViolations = [], sizeViolations = [], clips = [], overflowGlyphs = [], splits = [], textOutside = [], textRects = [];
    for (const { el, text } of textEls) {
      if (!visible(el)) continue;
      const cs = getComputedStyle(el);
      const size = px(cs.fontSize);
      if (size === null) continue;
      const weight = px(cs.fontWeight) || 400;
      const large = size >= 24 || (size >= 18.66 && weight >= 700);
      const fg = parseColor(cs.color);
      const bg = bgOf(el);
      const disabled = !!el.closest('uni-button[disabled], uni-button[aria-disabled="true"]');
      const r = rectOf(el);
      const rawRatio = fg ? ratio(fg, bg) : null;
      const entry = {
        id: el.id || null,
        classes: typeof el.className === 'string' ? el.className : '',
        text: text.slice(0, 60),
        tag: el.tagName.toLowerCase(),
        fontSize: size,
        fontWeight: weight,
        large,
        disabled,
        color: rgbArr(fg),
        background: rgbArr(bg),
        ratio: rawRatio === null ? null : round(rawRatio),
        rect: r,
      };
      if (rawRatio !== null) {
        if (rawRatio < (large ? 3 : 4.5)) textViolations.push({ ...entry, ratioRaw: round(rawRatio) });
      }
      if (!disabled && size < 13.8) sizeViolations.push(entry);
      const clippedBy = efIsClipped(el);
      if (clippedBy) clips.push({ ...entry, clippedBy });
      const outside = efOutsideAncestor(el, r);
      if (outside) textOutside.push({ ...entry, ancestor: outside });
      if (!disabled) textRects.push({ el, text, rect: r });
      // Range-based token checks: Latin/digit tokens must not split lines or
      // leave their element box. CJK single characters legitimately wrap.
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        const raw = node.nodeValue || '';
        const re = /[A-Za-z0-9]+(?:[.'’\-][A-Za-z0-9]+)*/g;
        let m;
        while ((m = re.exec(raw))) {
          const token = m[0];
          const range = document.createRange();
          range.setStart(node, m.index);
          range.setEnd(node, m.index + token.length);
          const rects = [...range.getClientRects()].filter(x => x.width > 0.5 && x.height > 0.5);
          const lines = new Set(rects.map(x => Math.round(x.top)));
          if (lines.size > 1) splits.push({ id: el.id || null, classes: entry.classes, token, lines: lines.size });
          for (const rr of rects) {
            if (rr.right > r.right + 1.5 || rr.left < r.left - 1.5 || rr.bottom > r.bottom + 1.5 || rr.top < r.top - 1.5) {
              overflowGlyphs.push({ id: el.id || null, token, tokenRect: { left: round(rr.left), right: round(rr.right), top: round(rr.top), bottom: round(rr.bottom) }, elementRect: r });
              break;
            }
          }
        }
      }
      samples.push(entry);
    }
    samples.sort((a, b) => (a.ratio === null ? 99 : a.ratio) - (b.ratio === null ? 99 : b.ratio));
    out.typography = {
      textElementCount: textEls.length,
      sizeViolations,
      h1FontSize: out.h1 ? out.h1.fontSize : null,
      sampleCount: samples.length,
      samples: samples.slice(0, 60),
      minRatio: samples.filter(s => !s.disabled && s.ratio !== null).reduce((m, s) => Math.min(m, s.ratio), 99),
    };
    out.contrast = { textViolations, textMeasured: samples.filter(s => s.ratio !== null).length };
    out.clipping = clips;
    out.textOverflow = overflowGlyphs;
    out.textOutside = textOutside;
    out.wordSplits = splits;

    function efIsClipped(el) {
      const r = el.getBoundingClientRect();
      let p = el.parentElement;
      while (p && p !== document.documentElement) {
        const cs = getComputedStyle(p);
        if (/(hidden|clip)/.test(cs.overflowX + cs.overflowY)) {
          const pr = p.getBoundingClientRect();
          if (r.right > pr.right + 1 || r.left < pr.left - 1 || r.bottom > pr.bottom + 1 || r.top < pr.top - 1) {
            return { id: p.id || null, classes: typeof p.className === 'string' ? p.className : '', rect: rectOf(p) };
          }
        }
        p = p.parentElement;
      }
      return null;
    }

    // Text that visually leaves its nearest sized box (e.g. a 200% glyph in a
    // fixed 32px key circle) is reported separately from overflow-hidden clips.
    function efOutsideAncestor(el, r) {
      let p = el.parentElement, depth = 0;
      while (p && p !== root && depth < 4) {
        const cs = getComputedStyle(p);
        if (!/(hidden|clip|auto|scroll)/.test(cs.overflowX + cs.overflowY)) {
          const pr = p.getBoundingClientRect();
          if (r.right > pr.right + 2 || r.left < pr.left - 2 || r.bottom > pr.bottom + 2 || r.top < pr.top - 2) {
            return { id: p.id || null, classes: typeof p.className === 'string' ? p.className : '', rect: rectOf(p) };
          }
        }
        p = p.parentElement;
        depth++;
      }
      return null;
    }

    // Control boundaries (not decorative rules): border vs the adjacent
    // surface, and for selected options border vs the selected fill.
    const borderSamples = [], borderViolations = [];
    for (const c of (out.controls ? out.controls.list : [])) {
      if (!c.visible || c.borderWidth === null || c.borderWidth < 1) continue;
      const el = document.getElementById(c.id);
      if (!el) continue;
      const border = parseColor(getComputedStyle(el).borderTopColor);
      const parent = bgOf(el.parentElement);
      const own = bgOf(el);
      if (!border) continue;
      const vsParent = ratio(blend(border, parent), parent);
      const vsOwn = ratio(blend(border, own), own);
      const entry = { id: c.id, border: rgbArr(border), vsParentBackground: round(vsParent), vsOwnBackground: round(vsOwn), disabled: c.disabled };
      borderSamples.push(entry);
      if (!c.disabled) {
        if (vsParent < 3) borderViolations.push(entry);
        if (el.classList.contains('is-selected') && vsOwn < 3) borderViolations.push({ ...entry, selected: true });
      }
    }
    out.contrast.borderSamples = borderSamples;
    out.contrast.borderViolations = borderViolations;

    // Horizontal overflow: document-level and any visible descendant.
    const over = [];
    for (const el of root.querySelectorAll('*')) {
      if (!visible(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.right > winW + 1 || r.left < -1) over.push({ id: el.id || null, classes: typeof el.className === 'string' ? el.className : '', rect: rectOf(el) });
    }
    out.overflow = { documentHorizontal: document.documentElement.scrollWidth > winW + 1, elements: over };
  } catch (e) { errors.push('typography:' + e.message); }

  // Overlap between interactive peers and between visible text glyph boxes.
  try {
    const hits = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    const controls = (out.controls ? out.controls.list : []).filter(c => c.visible);
    const overlaps = [];
    for (let i = 0; i < controls.length; i++) {
      for (let j = i + 1; j < controls.length; j++) {
        const area = hits(controls[i].rect, controls[j].rect);
        if (area > 1) overlaps.push({ kind: 'control', a: controls[i].id, b: controls[j].id, area: round(area) });
      }
    }
    const textEls = [...root.querySelectorAll('*')].filter(el => directText(el) && visible(el) && !el.closest('uni-button[disabled]'));
    for (let i = 0; i < textEls.length; i++) {
      for (let j = i + 1; j < textEls.length; j++) {
        const a = textEls[i], b = textEls[j];
        if (a.contains(b) || b.contains(a)) continue;
        const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
        const area = hits(ra, rb);
        if (area > 4) overlaps.push({ kind: 'text', a: a.id || a.className || a.tagName, b: b.id || b.className || b.tagName, area: round(area) });
      }
    }
    out.overlaps = overlaps;
  } catch (e) { errors.push('overlap:' + e.message); out.overlaps = []; }

  // Report facts are read from the rendered report, not from product state.
  try {
    const report = document.getElementById('assessment-report');
    out.report = report ? {
      text: (report.innerText || '').replace(/\s+/g, ' ').trim(),
      level: (report.querySelector('.assessment-level')?.textContent || '').trim(),
      score: (report.querySelector('.assessment-score')?.textContent || '').trim(),
      counted: (report.querySelector('.assessment-result-facts')?.textContent || '').replace(/\s+/g, ' ').trim(),
      feedback: (report.querySelector('.assessment-feedback')?.textContent || '').trim(),
      retestDialog: !!document.getElementById('assessment-retest-confirmation'),
    } : null;
  } catch (e) { errors.push('report:' + e.message); out.report = null; }

  return out;
}

/**
 * Test-only 200% text enlargement: doubles the computed font-size of every
 * element that owns direct text, using inline style only. No text, attribute
 * content, visibility, handler or product store is changed. Idempotent per
 * element via a page-global WeakSet. Documented as a simulation, not a native
 * font-scale setting.
 */
function applyTextScale(scale) {
  const root = document.getElementById('assessment-page');
  if (!root) return { applied: 0, reason: 'root-missing' };
  const key = '__dshTextScale-' + scale;
  if (!window[key]) window[key] = new WeakSet();
  const seen = window[key];
  let applied = 0;
  for (const el of root.querySelectorAll('*')) {
    let hasText = false;
    for (const n of el.childNodes) if (n.nodeType === 3 && n.nodeValue && n.nodeValue.trim()) { hasText = true; break; }
    if (!hasText || seen.has(el)) continue;
    const size = parseFloat(getComputedStyle(el).fontSize);
    if (!Number.isFinite(size) || size <= 0) continue;
    el.style.fontSize = (size * scale) + 'px';
    seen.add(el);
    applied++;
  }
  return { applied, scale };
}

module.exports = { collect, applyTextScale };
