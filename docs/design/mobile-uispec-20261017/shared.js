/* 语学星移动端 UI 稿共享层
 * - 主题：?theme=light|dark → localStorage['uispec-theme'] → 浅色
 * - 组件：图标集、状态栏、导航栏、TabBar、Toast、弹层、对话框、表单校验、提交中
 * - 状态：document.documentElement[data-screen-state] 驱动 [data-state-block]
 * 仅用于 docs/design 原型，依赖 shared.css。 */
(function () {
  'use strict';

  /* ---------- 主题（尽早应用，避免闪烁） ---------- */

  var THEME_KEY = 'uispec-theme';

  function readStoredTheme() {
    try { return localStorage.getItem(THEME_KEY); } catch (e) { return null; }
  }

  function readQueryTheme() {
    try {
      var value = new URLSearchParams(location.search).get('theme');
      return value === 'dark' || value === 'light' ? value : null;
    } catch (e) { return null; }
  }

  function initialTheme() {
    return readQueryTheme() || readStoredTheme() || 'light';
  }

  function applyTheme(theme) {
    var next = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* 隐私模式忽略 */ }
    document.querySelectorAll('[data-theme-set]').forEach(function (btn) {
      btn.setAttribute('aria-pressed', String(btn.getAttribute('data-theme-set') === next));
    });
    document.dispatchEvent(new CustomEvent('uispec:theme', { detail: { theme: next } }));
    return next;
  }

  applyTheme(initialTheme());

  /* ---------- 图标集（内联 SVG，24 栅格，1.75 描边） ---------- */

  var ICONS = {
    'arrow-left': '<path d="M15 5l-7 7 7 7"/>',
    'chevron-left': '<path d="M15 5l-7 7 7 7"/>',
    'arrow-right': '<path d="M5 12h14M13 6l6 6-6 6"/>',
    'chevron-right': '<path d="M9 5l7 7-7 7"/>',
    'chevron-down': '<path d="M5 9l7 7 7-7"/>',
    'chevron-up': '<path d="M5 15l7-7 7 7"/>',
    'arrow-up-right': '<path d="M7 17L17 7M9 7h8v8"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
    'check-circle': '<circle cx="12" cy="12" r="9"/><path d="M8 12.3l2.7 2.7L16.5 9"/>',
    'alert-circle': '<circle cx="12" cy="12" r="9"/><path d="M12 7.4v5.1"/><circle cx="12" cy="16.4" r="0.9" fill="currentColor" stroke="none"/>',
    'alert-triangle': '<path d="M12 4.3l8.6 15.2H3.4z"/><path d="M12 9.8v4.1"/><circle cx="12" cy="16.8" r="0.9" fill="currentColor" stroke="none"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.2"/><circle cx="12" cy="8" r="0.9" fill="currentColor" stroke="none"/>',
    eye: '<path d="M2.6 12S6.2 6 12 6s9.4 6 9.4 6-3.6 6-9.4 6-9.4-6-9.4-6z"/><circle cx="12" cy="12" r="2.5"/>',
    'eye-off': '<path d="M4 4l16 16"/><path d="M9.9 5.2A10.9 10.9 0 0 1 12 5c5.8 0 9.4 7 9.4 7a17.6 17.6 0 0 1-3.2 4.2M6.6 7.4C4.2 9.1 2.6 12 2.6 12s3.6 7 9.4 7c1.3 0 2.5-.3 3.6-.8"/><path d="M10.2 10.2a2.5 2.5 0 0 0 3.6 3.6"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8.5 10.5V8a3.5 3.5 0 1 1 7 0v2.5"/>',
    mail: '<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M3.8 7.2l7.1 5.3a2 2 0 0 0 2.2 0l7.1-5.3"/>',
    phone: '<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M10.5 18.5h3"/>',
    user: '<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c.9-3.4 3.6-5 7-5s6.1 1.6 7 5"/>',
    users: '<circle cx="9" cy="9" r="3.2"/><path d="M3 19c.8-3 3.1-4.5 6-4.5s5.2 1.5 6 4.5"/><path d="M15.5 6.2a3.2 3.2 0 0 1 0 5.9M17 14.7c2 .5 3.4 1.9 4 4.3"/>',
    home: '<path d="M4 10.5L12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19z"/><path d="M9.5 20.5v-6h5v6"/>',
    book: '<path d="M5 4.5h9.5A2.5 2.5 0 0 1 17 7v13H7.5A2.5 2.5 0 0 1 5 17.5z"/><path d="M5 17.5A2.5 2.5 0 0 1 7.5 15H17"/>',
    pencil: '<path d="M4 20l4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10z"/><path d="M13.5 7.5l3 3"/>',
    sparkles: '<path d="M12 3.5l1.7 4.3 4.3 1.7-4.3 1.7L12 15.5l-1.7-4.3L6 9.5l4.3-1.7z"/><path d="M18.5 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',
    grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6"/>',
    play: '<path d="M8 5.5l10 6.5-10 6.5z" fill="currentColor" stroke-linejoin="round"/>',
    pause: '<path d="M8.5 5v14M15.5 5v14"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M8.5 21h7"/>',
    headphones: '<path d="M4.5 15v-3a7.5 7.5 0 0 1 15 0v3"/><rect x="3" y="13.5" width="4" height="6.5" rx="2"/><rect x="17" y="13.5" width="4" height="6.5" rx="2"/>',
    volume: '<path d="M4 9.5h3.5L12 5.5v13L7.5 14.5H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5.3l3.2 1.9"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/>',
    flame: '<path d="M12 3.5c3.5 3.5 5.5 6 5.5 9a5.5 5.5 0 0 1-11 0c0-2.2 1-4 2.8-6 .2 1.6.8 2.7 1.7 3.3.4-2.3.6-4 .1-6.3z"/>',
    trophy: '<path d="M8 4.5h8v5.2a4 4 0 0 1-8 0z"/><path d="M8 6H4.8v1.3A3.5 3.5 0 0 0 8 10.8M16 6h3.2v1.3a3.5 3.5 0 0 1-3.2 3.5M12 13.7v3.3M8.5 20.5h7M9.5 17h5l.4 3.5h-5.8z"/>',
    star: '<path d="M12 4l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L4.2 9.7l5.4-.8z"/>',
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="0.9" fill="currentColor" stroke="none"/>',
    refresh: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.8 4.5v4.8h-4.8"/>',
    download: '<path d="M12 4v10.5M7.5 10.5L12 15l4.5-4.5M5 19.5h14"/>',
    share: '<circle cx="6" cy="12" r="2.4"/><circle cx="18" cy="6" r="2.4"/><circle cx="18" cy="18" r="2.4"/><path d="M8.2 10.9l7.6-3.8M8.2 13.1l7.6 3.8"/>',
    settings: '<circle cx="12" cy="12" r="3.1"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.4 15.4L20 20"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    more: '<circle cx="5.5" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="18.5" cy="12" r="1.2" fill="currentColor" stroke="none"/>',
    trash: '<path d="M4.5 6.5h15M9.5 6.5V4.5h5v2M6.5 6.5l.8 13h9.4l.8-13M10 10.5v5.5M14 10.5v5.5"/>',
    'log-out': '<path d="M14 4.5H6.5A1.5 1.5 0 0 0 5 6v12a1.5 1.5 0 0 0 1.5 1.5H14"/><path d="M16.5 8.5L20 12l-3.5 3.5M20 12H10"/>',
    chart: '<path d="M4.5 19.5h15M7.5 16v-5M12 16V6.5M16.5 16v-7"/>',
    gift: '<rect x="4" y="8.5" width="16" height="4" rx="1"/><path d="M5.5 12.5v7h13v-7M12 8.5v11"/><path d="M12 8.5c-1-2.5-2.3-3.5-3.8-3.5a2 2 0 1 0 0 3.5zM12 8.5c1-2.5 2.3-3.5 3.8-3.5a2 2 0 1 1 0 3.5z"/>',
    shield: '<path d="M12 3.5l7 3v5.2c0 4.2-2.9 7.4-7 8.8-4.1-1.4-7-4.6-7-8.8V6.5z"/><path d="M8.8 12l2.2 2.2 4.2-4.2"/>',
    bell: '<path d="M18 9.5a6 6 0 0 0-12 0c0 4-1.5 5.5-2 6.5h16c-.5-1-2-2.5-2-6.5z"/><path d="M10 19.5a2.2 2.2 0 0 0 4 0"/>',
    image: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="M4.5 17l4.5-4.5 3.5 3.5 2.5-2.5 4.5 4.5"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l2.8-2.8a4 4 0 1 0-5.7-5.7l-1.2 1.2"/><path d="M14 10a4 4 0 0 0-5.7 0l-2.8 2.8a4 4 0 1 0 5.7 5.7l1.2-1.2"/>',
    globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.4 2.5 3.6 5.3 3.6 8.5S14.4 18 12 20.5c-2.4-2.5-3.6-5.3-3.6-8.5S9.6 6 12 3.5z"/>',
    filter: '<path d="M4 5.5h16l-6.2 7.2V19l-3.6 1.5v-7.8z"/>',
    bookmark: '<path d="M7 4.5h10v16l-5-3.5-5 3.5z"/>',
    'map-pin': '<path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
    key: '<circle cx="8.5" cy="15.5" r="3.5"/><path d="M11 13L20 4M17 7l2 2M15 9l2 2"/>',
    sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4"/>',
    moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/>',
    'rotate-ccw': '<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.2 4.5v4.8h4.8"/>'
  };

  var ICON_ALIASES = {
    back: 'arrow-left',
    chevron: 'chevron-right',
    warning: 'alert-triangle',
    error: 'alert-circle',
    success: 'check-circle',
    profile: 'user',
    world: 'sparkles',
    practice: 'pencil',
    course: 'book',
    setting: 'settings'
  };

  function icon(name, size, extraClass) {
    var key = ICON_ALIASES[name] || name;
    var body = ICONS[key];
    if (!body) body = ICONS['alert-circle'];
    var px = size || 24;
    var cls = 'icon' + (extraClass ? ' ' + extraClass : '');
    return '<svg class="' + cls + '" width="' + px + '" height="' + px + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + body + '</svg>';
  }

  /* ---------- 框内骨架 ---------- */

  var STATUS_SIGNAL = '<svg width="18" height="12" viewBox="0 0 18 12" aria-hidden="true"><path d="M1 9.8V11M4.7 7.6V11M8.4 5.4V11M12.1 3.1V11M15.8 1V11" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
  var STATUS_WIFI = '<svg width="17" height="12" viewBox="0 0 17 12" aria-hidden="true"><path d="M2 4.3a10 10 0 0 1 13 0M4.4 6.9a6.4 6.4 0 0 1 8.2 0M6.8 9.3a2.8 2.8 0 0 1 3.4 0" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="8.5" cy="11" r="1" fill="currentColor"/></svg>';
  var STATUS_BATTERY = '<svg width="25" height="12" viewBox="0 0 25 12" aria-hidden="true"><rect x="0.8" y="0.8" width="20" height="10.4" rx="3" fill="none" stroke="currentColor" stroke-opacity="0.45" stroke-width="1.2"/><rect x="2.6" y="2.6" width="16.4" height="6.8" rx="1.7" fill="currentColor"/><path d="M22.8 4.2v3.6" stroke="currentColor" stroke-opacity="0.45" stroke-width="1.4" stroke-linecap="round"/></svg>';

  function statusBarHTML() {
    return '<div class="statusbar" aria-hidden="true"><span>9:41</span><span class="statusbar__icons">' + STATUS_SIGNAL + STATUS_WIFI + STATUS_BATTERY + '</span></div>';
  }

  function navbarHTML(el) {
    var title = el.getAttribute('data-title') || '';
    var back = el.getAttribute('data-back');
    var backHTML = '';
    if (back !== 'none') {
      var href = back || '';
      var tag = href ? 'a' : 'button';
      var attrs = href ? ' href="' + href + '"' : ' type="button" data-back-action';
      backHTML = '<' + tag + ' class="navbar__back" aria-label="返回"' + attrs + '>' + icon('arrow-left', 24) + '</' + tag + '>';
    }
    var action = el.getAttribute('data-action') || '';
    return '<div class="navbar">' + backHTML + '<div class="navbar__title">' + title + '</div><div class="navbar__action">' + action + '</div></div>';
  }

  var TABS = [
    { id: 'home', label: '学习', icon: 'home', href: 'home.html' },
    { id: 'practice', label: '练习', icon: 'pencil', href: 'b2-practice.html' },
    { id: 'world', label: '成长', icon: 'sparkles', href: 'world.html' },
    { id: 'learn', label: '课程', icon: 'book', href: 'learn.html' },
    { id: 'profile', label: '我的', icon: 'user', href: 'profile.html' }
  ];

  function tabbarHTML(el) {
    var active = el.getAttribute('data-active') || 'home';
    var prefix = el.getAttribute('data-prefix') || '';
    return '<nav class="tabbar" aria-label="主导航">' + TABS.map(function (tab) {
      var selected = tab.id === active;
      return '<a class="tabbar__item' + (selected ? ' is-selected' : '') + '" href="' + prefix + tab.href + '"' + (selected ? ' aria-current="page"' : '') + '>' + icon(tab.icon, 24) + '<span>' + tab.label + '</span></a>';
    }).join('') + '</nav>';
  }

  /* ---------- 工具条 ---------- */

  var STATE_LABELS = {
    normal: '正常',
    loading: '加载',
    empty: '空',
    error: '错误',
    forbidden: '无权限',
    offline: '离线',
    success: '成功'
  };

  function buildToolbar(el) {
    var states = (el.getAttribute('data-states') || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    var html = '<span class="proto-toolbar__label">主题</span><div class="proto-toolbar__group" role="group" aria-label="主题切换">' +
      '<button type="button" class="proto-toolbar__btn" data-theme-set="light" aria-pressed="false">浅色</button>' +
      '<button type="button" class="proto-toolbar__btn" data-theme-set="dark" aria-pressed="false">深色</button></div>';
    if (states.length) {
      html += '<span class="proto-toolbar__spacer"></span><span class="proto-toolbar__label">状态</span><div class="proto-toolbar__group" role="group" aria-label="页面状态切换">' +
        states.map(function (state) {
          return '<button type="button" class="proto-toolbar__btn" data-state-set="' + state + '" aria-pressed="false">' + (STATE_LABELS[state] || state) + '</button>';
        }).join('') + '</div>';
    }
    el.classList.add('proto-toolbar');
    el.innerHTML = html;
  }

  function setScreenState(state) {
    var next = STATE_LABELS[state] ? state : 'normal';
    document.documentElement.dataset.screenState = next;
    document.querySelectorAll('[data-state-set]').forEach(function (btn) {
      btn.setAttribute('aria-pressed', String(btn.getAttribute('data-state-set') === next));
    });
    document.dispatchEvent(new CustomEvent('uispec:state', { detail: { state: next } }));
    return next;
  }

  /* ---------- Toast ---------- */

  function toastHost() {
    var host = document.querySelector('.phone .toast-host');
    if (host) return host;
    host = document.querySelector('.toast-host--fixed');
    if (!host) {
      host = document.createElement('div');
      host.className = 'toast-host toast-host--fixed';
      host.setAttribute('role', 'status');
      host.setAttribute('aria-live', 'polite');
      document.body.appendChild(host);
    }
    return host;
  }

  function toast(message, kind, duration) {
    var type = kind === 'ok' || kind === 'bad' ? kind : 'info';
    var host = toastHost();
    var el = document.createElement('div');
    el.className = 'toast toast--' + type;
    el.setAttribute('role', 'status');
    el.innerHTML = icon(type === 'ok' ? 'check-circle' : type === 'bad' ? 'alert-circle' : 'info', 18) + '<span>' + message + '</span>';
    host.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('is-visible'); });
    setTimeout(function () {
      el.classList.remove('is-visible');
      setTimeout(function () { el.remove(); }, 220);
    }, duration || 2000);
    return el;
  }

  /* ---------- 弹层 / 对话框 ---------- */

  function openOverlay(id) {
    var el = document.getElementById(id);
    if (!el) return null;
    el.classList.add('is-open');
    el.removeAttribute('aria-hidden');
    var focusable = el.querySelector('button, [href], input, select, textarea');
    if (focusable) setTimeout(function () { focusable.focus({ preventScroll: true }); }, 60);
    return el;
  }

  function closeOverlay(el) {
    if (!el) return;
    el.classList.remove('is-open');
    el.setAttribute('aria-hidden', 'true');
  }

  function closeAllOverlays() {
    document.querySelectorAll('.overlay-layer.is-open').forEach(closeOverlay);
  }

  /* ---------- 按钮状态 ---------- */

  function setBusy(button, busy, label) {
    if (!button) return;
    if (busy) {
      if (button.dataset.busy === '1') return;
      button.dataset.busy = '1';
      var labelEl = button.querySelector('.btn__label');
      if (labelEl) {
        button.dataset.idleLabel = labelEl.textContent;
        if (label) labelEl.textContent = label;
      } else {
        button.dataset.idleHTML = button.innerHTML;
        button.innerHTML = '<span class="btn__spinner"></span><span class="btn__label">' + (label || '处理中…') + '</span>';
      }
      button.classList.add('is-busy');
      button.setAttribute('aria-busy', 'true');
      button.disabled = true;
    } else {
      if (button.dataset.busy !== '1') return;
      button.dataset.busy = '';
      var idle = button.querySelector('.btn__label');
      if (button.dataset.idleHTML) {
        button.innerHTML = button.dataset.idleHTML;
        delete button.dataset.idleHTML;
      } else if (idle) {
        idle.textContent = button.dataset.idleLabel || idle.textContent;
        delete button.dataset.idleLabel;
      }
      button.classList.remove('is-busy');
      button.removeAttribute('aria-busy');
      button.disabled = false;
    }
  }

  /* ---------- 表单 ---------- */

  function fieldOf(input) {
    return input.closest('.field');
  }

  function setFieldError(fieldOrInput, message) {
    var field = fieldOrInput && fieldOrInput.classList && fieldOrInput.classList.contains('field') ? fieldOrInput : fieldOf(fieldOrInput);
    if (!field) return;
    var error = field.querySelector('.field__error');
    var input = field.querySelector('input, textarea');
    field.classList.add('is-invalid');
    if (error) error.textContent = message;
    if (input) input.setAttribute('aria-invalid', 'true');
  }

  function clearFieldError(fieldOrInput) {
    var field = fieldOrInput && fieldOrInput.classList && fieldOrInput.classList.contains('field') ? fieldOrInput : fieldOf(fieldOrInput);
    if (!field) return;
    field.classList.remove('is-invalid');
    var input = field.querySelector('input, textarea');
    if (input) input.removeAttribute('aria-invalid');
  }

  function focusFirstInvalid(scope) {
    var root = scope || document;
    var invalid = root.querySelector('.field.is-invalid input, .field.is-invalid textarea');
    if (invalid) invalid.focus({ preventScroll: false });
    return invalid;
  }

  function validateDemoForm(form) {
    var fields = Array.prototype.slice.call(form.querySelectorAll('.field'));
    var firstInvalid = null;
    fields.forEach(function (field) {
      var input = field.querySelector('input, textarea');
      if (!input) return;
      var required = input.required || input.hasAttribute('data-required-message');
      if (!required) return;
      var value = (input.value || '').trim();
      clearFieldError(field);
      if (!value) {
        var message = input.getAttribute('data-required-message') || ('请填写' + (field.querySelector('.field__label') ? field.querySelector('.field__label').textContent : '此项'));
        setFieldError(field, message);
        if (!firstInvalid) firstInvalid = input;
      }
    });
    if (firstInvalid) {
      firstInvalid.focus();
      toast('请检查标红的字段', 'bad');
      return false;
    }
    return true;
  }

  /* ---------- 初始化与事件委托 ---------- */

  function renderPlaceholders(root) {
    root.querySelectorAll('[data-ui="statusbar"]').forEach(function (el) { if (!el.dataset.rendered) { el.outerHTML = statusBarHTML(); } });
    root.querySelectorAll('[data-ui="navbar"]').forEach(function (el) { if (!el.dataset.rendered) { el.outerHTML = navbarHTML(el); } });
    root.querySelectorAll('[data-ui="tabbar"]').forEach(function (el) { if (!el.dataset.rendered) { el.outerHTML = tabbarHTML(el); } });
  }

  function refreshSwatches() {
    document.querySelectorAll('[data-token]').forEach(function (el) {
      var name = el.getAttribute('data-token');
      var value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      var code = el.querySelector('.gallery-swatch__code');
      if (code && value) code.textContent = value.toUpperCase();
    });
  }

  function init() {
    renderPlaceholders(document);
    document.querySelectorAll('[data-ui="toolbar"]').forEach(function (el) {
      if (!el.classList.contains('proto-toolbar')) buildToolbar(el);
    });
    var initial = document.documentElement.dataset.screenState;
    setScreenState(initial && STATE_LABELS[initial] ? initial : 'normal');
    applyTheme(document.documentElement.dataset.theme || initialTheme());
    refreshSwatches();
    renderDemoIcons();
  }

  function renderDemoIcons() {
    document.querySelectorAll('[data-icon]').forEach(function (el) {
      if (el.dataset.rendered) return;
      var size = parseInt(el.getAttribute('data-icon-size') || '24', 10);
      el.innerHTML = icon(el.getAttribute('data-icon'), size);
      el.dataset.rendered = '1';
    });
    document.querySelectorAll('[data-icon-gallery]').forEach(function (host) {
      if (host.dataset.rendered) return;
      host.innerHTML = Object.keys(ICONS).sort().map(function (name) {
        return '<span class="icon-grid__cell" title="' + name + '">' + icon(name, 24) + '<span>' + name + '</span></span>';
      }).join('');
      host.dataset.rendered = '1';
    });
  }

  document.addEventListener('DOMContentLoaded', init);

  document.addEventListener('click', function (event) {
    var target = event.target;

    var themeBtn = target.closest('[data-theme-set]');
    if (themeBtn) {
      applyTheme(themeBtn.getAttribute('data-theme-set'));
      refreshSwatches();
      return;
    }

    var stateBtn = target.closest('[data-state-set]');
    if (stateBtn) {
      setScreenState(stateBtn.getAttribute('data-state-set'));
      return;
    }

    var backBtn = target.closest('[data-back-action]');
    if (backBtn) {
      if (document.referrer && history.length > 1) history.back();
      else location.href = 'home.html';
      return;
    }

    var openBtn = target.closest('[data-open-overlay]');
    if (openBtn) {
      event.preventDefault();
      openOverlay(openBtn.getAttribute('data-open-overlay'));
      return;
    }

    var closeBtn = target.closest('[data-close]');
    if (closeBtn) {
      event.preventDefault();
      var layer = closeBtn.closest('.overlay-layer');
      closeOverlay(layer);
      return;
    }

    var toastBtn = target.closest('[data-toast]');
    if (toastBtn) {
      event.preventDefault();
      toast(toastBtn.getAttribute('data-toast'), toastBtn.getAttribute('data-toast-kind') || 'info');
      var layerForToast = toastBtn.closest('.overlay-layer');
      if (layerForToast) closeOverlay(layerForToast);
      return;
    }

    var eyeBtn = target.closest('[data-toggle-password]');
    if (eyeBtn) {
      event.preventDefault();
      var field = eyeBtn.closest('.field');
      var input = field && field.querySelector('input');
      if (!input) return;
      var show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      eyeBtn.innerHTML = icon(show ? 'eye-off' : 'eye', 19);
      eyeBtn.setAttribute('aria-label', show ? '隐藏密码' : '显示密码');
      eyeBtn.setAttribute('aria-pressed', String(show));
      return;
    }

    var chip = target.closest('.chip[data-toggle], .segmented__item[data-toggle]');
    if (chip && !chip.disabled) {
      var group = chip.closest('[data-select="single"]');
      if (group) {
        group.querySelectorAll('.is-selected').forEach(function (item) {
          item.classList.remove('is-selected');
          item.setAttribute('aria-pressed', 'false');
          if (item.classList.contains('segmented__item')) item.setAttribute('aria-selected', 'false');
        });
      }
      var next = !chip.classList.contains('is-selected');
      chip.classList.toggle('is-selected', next);
      chip.setAttribute('aria-pressed', String(next));
      chip.setAttribute('aria-selected', String(next));
      chip.dispatchEvent(new CustomEvent('uispec:toggle', { bubbles: true, detail: { selected: next, value: chip.getAttribute('data-value') } }));
      return;
    }

    var toggle = target.closest('.switch[data-toggle], .switch:not([disabled])');
    if (toggle && toggle.classList.contains('switch') && !toggle.disabled) {
      event.preventDefault();
      var checked = toggle.getAttribute('aria-checked') !== 'true';
      toggle.setAttribute('aria-checked', String(checked));
      toggle.dispatchEvent(new CustomEvent('uispec:switch', { bubbles: true, detail: { checked: checked } }));
      return;
    }

    var busyDemo = target.closest('[data-busy-demo]');
    if (busyDemo) {
      event.preventDefault();
      if (busyDemo.classList.contains('is-busy')) return;
      setBusy(busyDemo, true, busyDemo.getAttribute('data-busy-label') || '正在提交…');
      setTimeout(function () {
        setBusy(busyDemo, false);
        toast(busyDemo.getAttribute('data-done-toast') || '已完成', 'ok');
      }, parseInt(busyDemo.getAttribute('data-busy-ms') || '1400', 10));
      return;
    }

    var reload = target.closest('[data-demo-reload]');
    if (reload) {
      event.preventDefault();
      var live = document.getElementById(reload.getAttribute('data-live'));
      var wait = document.getElementById(reload.getAttribute('data-wait'));
      if (!live || !wait) return;
      live.hidden = true;
      wait.hidden = false;
      setTimeout(function () {
        wait.hidden = true;
        live.hidden = false;
        toast(reload.getAttribute('data-toast') || '已更新', 'ok');
      }, 1200);
      return;
    }

    var dialogConfirm = target.closest('[data-dialog-confirm]');
    if (dialogConfirm) {
      event.preventDefault();
      var dialogLayer = dialogConfirm.closest('.overlay-layer');
      closeOverlay(dialogLayer);
      var message = dialogConfirm.getAttribute('data-dialog-confirm');
      if (message) toast(message, dialogConfirm.getAttribute('data-confirm-kind') || 'ok');
      return;
    }
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      var open = document.querySelectorAll('.overlay-layer.is-open');
      if (open.length) closeOverlay(open[open.length - 1]);
    }
    if ((event.key === 'Enter' || event.key === ' ') && event.target.classList && event.target.classList.contains('switch')) {
      event.preventDefault();
      event.target.click();
    }
  });

  document.addEventListener('submit', function (event) {
    var form = event.target.closest('[data-demo-form]');
    if (!form) return;
    event.preventDefault();
    if (!validateDemoForm(form)) return;
    var submit = form.querySelector('[type="submit"]');
    if (submit) {
      setBusy(submit, true, submit.getAttribute('data-busy-label') || '正在提交…');
      setTimeout(function () {
        setBusy(submit, false);
        toast(form.getAttribute('data-success-toast') || '已提交', 'ok');
      }, 1200);
    }
  });

  document.addEventListener('input', function (event) {
    var field = event.target.closest && event.target.closest('.field');
    if (field && field.classList.contains('is-invalid') && event.target.value.trim()) clearFieldError(field);
  });

  document.addEventListener('uispec:theme', refreshSwatches);

  window.UISpec = {
    icon: icon,
    icons: ICONS,
    statusBar: statusBarHTML,
    navbar: navbarHTML,
    tabbar: tabbarHTML,
    toast: toast,
    setTheme: applyTheme,
    getTheme: function () { return document.documentElement.dataset.theme || 'light'; },
    toggleTheme: function () { return applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'); },
    setScreenState: setScreenState,
    getScreenState: function () { return document.documentElement.dataset.screenState || 'normal'; },
    openOverlay: openOverlay,
    closeOverlay: closeOverlay,
    closeAllOverlays: closeAllOverlays,
    setBusy: setBusy,
    setFieldError: setFieldError,
    clearFieldError: clearFieldError,
    focusFirstInvalid: focusFirstInvalid,
    validateForm: validateDemoForm
  };
})();
