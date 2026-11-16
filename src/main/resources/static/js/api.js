/*
 * Shared helpers for every QueueLess page:
 *  - api()        talks to the Java backend
 *  - el()         builds DOM nodes safely (never inserts user text as HTML)
 *  - toast()      small messages
 *  - chrome()     the common header (with the language menu) and footer
 *  - t()          translated text for the chosen language (texts come from the Java
 *                 messages_xx.properties files through /api/i18n/{lang})
 *  - ready()      run a function once the texts are loaded
 */
(function (global) {
  'use strict';

  var ADMIN_KEY = 'ql_admin_token';

  /* ----------------------------- languages ----------------------------- */
  // Names are shown in their own script so people can always find their language.
  var LANGS = [['en', 'English'], ['hi', 'हिन्दी'], ['kn', 'ಕನ್ನಡ'], ['ta', 'தமிழ்'], ['te', 'తెలుగు'], ['ml', 'മലയാളം']];
  var LANG_KEY = 'ql_lang';
  // Only used if the server cannot be reached, so the error message can still be read.
  var FALLBACK = {
    'ui.err.network': 'Cannot reach the QueueLess server. Check that it is running.',
    'ui.err.generic': 'Something went wrong. Please try again.'
  };

  function isLang(code) { return LANGS.some(function (l) { return l[0] === code; }); }
  function pickLang() {
    var saved = '';
    try { saved = localStorage.getItem(LANG_KEY) || ''; } catch (e) { /* storage blocked */ }
    if (isLang(saved)) { return saved; }
    var browser = String(navigator.language || 'en').slice(0, 2).toLowerCase();
    return isLang(browser) ? browser : 'en';
  }
  var lang = pickLang();
  var bundle = {};
  var loaded = false;
  var waiters = [];

  document.documentElement.lang = lang;
  document.documentElement.classList.add('lang-' + lang);

  function setLang(code) {
    if (!isLang(code) || code === lang) { return; }
    try { localStorage.setItem(LANG_KEY, code); } catch (e) { /* ignore */ }
    location.reload();          // the page is rebuilt in the new language; no data is touched
  }

  function t(key) {
    var text = bundle[key];
    if (text === undefined) { text = FALLBACK[key]; }
    if (text === undefined) { return key; }
    var args = arguments;
    return text.replace(/\{(\d)\}/g, function (m, i) { var v = args[Number(i) + 1]; return v === undefined ? m : v; });
  }
  function has(key) { return bundle[key] !== undefined; }

  // Fills in every element marked with data-i18n (text), data-i18n-ph (placeholder), data-i18n-aria (aria-label).
  function applyStatic() {
    function each(attr, fn) {
      Array.prototype.forEach.call(document.querySelectorAll('[' + attr + ']'), function (node) { fn(node, t(node.getAttribute(attr))); });
    }
    each('data-i18n', function (n, v) { n.textContent = v; });
    each('data-i18n-ph', function (n, v) { n.setAttribute('placeholder', v); });
    each('data-i18n-aria', function (n, v) { n.setAttribute('aria-label', v); });
    each('data-i18n-content', function (n, v) { n.setAttribute('content', v); });
    var title = document.querySelector('title[data-i18n]');
    if (title) { document.title = title.textContent; }
  }

  function ready(fn) { if (loaded) { fn(); } else { waiters.push(fn); } }
  function finishLoading() {
    loaded = true;
    applyStatic();
    document.documentElement.classList.remove('i18n-wait');
    var list = waiters; waiters = [];
    list.forEach(function (fn) { fn(); });
  }
  fetch('/api/i18n/' + lang, { headers: { 'Accept': 'application/json' } })
    .then(function (res) { return res.ok ? res.json() : {}; })
    .catch(function () { return {}; })
    .then(function (data) { bundle = data || {}; finishLoading(); });

  /* Dates and times follow the language but always use 0-9 digits. */
  function locale() { return lang + '-IN-u-nu-latn'; }
  function speechLang() { return { en: 'en-IN', hi: 'hi-IN', kn: 'kn-IN', ta: 'ta-IN', te: 'te-IN', ml: 'ml-IN' }[lang]; }

  // Sample services and "Counter N" have translations; names an admin typed stay exactly as typed.
  function codeOf(number) { var i = String(number || '').indexOf('-'); return i > 0 ? number.slice(0, i) : ''; }
  function svcName(code, name) {
    var c = String(code || '').toUpperCase();
    if (has('service.' + c + '.default') && String(name).toLowerCase() === bundle['service.' + c + '.default'].toLowerCase() && has('service.' + c + '.name')) {
      return bundle['service.' + c + '.name'];
    }
    return name;
  }
  function svcDesc(code, name, desc) {
    var c = String(code || '').toUpperCase();
    if (has('service.' + c + '.default') && String(name).toLowerCase() === bundle['service.' + c + '.default'].toLowerCase() && has('service.' + c + '.desc')) {
      return bundle['service.' + c + '.desc'];
    }
    return desc || '';
  }
  function tokenService(tok) { return svcName(codeOf(tok.number), tok.serviceName); }
  function counterName(name) {
    var m = /^counter\s*(\d+)$/i.exec(String(name || '').trim());
    return m ? t('counter.n', m[1]) : name;
  }

  /* ----------------------------- API calls ----------------------------- */
  function adminToken() {
    try { return sessionStorage.getItem(ADMIN_KEY) || ''; } catch (e) { return ''; }
  }
  function setAdminToken(token) {
    try {
      if (token) { sessionStorage.setItem(ADMIN_KEY, token); } else { sessionStorage.removeItem(ADMIN_KEY); }
    } catch (e) { /* storage blocked: the session just lasts until the page is reloaded */ }
  }

  function api(path, opts) {
    opts = opts || {};
    var headers = { 'Accept': 'application/json', 'Accept-Language': lang };
    var init = { method: opts.method || 'GET', headers: headers };
    if (opts.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(opts.body);
    }
    if (opts.admin) { headers['X-Admin-Token'] = adminToken(); }

    return fetch('/api' + path, init).then(function (res) {
      if (res.status === 204) { return null; }
      return res.text().then(function (text) {
        var data = null;
        try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
        if (!res.ok) {
          if (res.status === 401 && opts.admin) {
            setAdminToken('');
            document.dispatchEvent(new CustomEvent('ql-unauthorized'));
          }
          var err = new Error((data && data.error) || t('ui.err.generic'));
          err.status = res.status;
          throw err;
        }
        return data;
      });
    }, function () {
      throw new Error(t('ui.err.network'));
    });
  }

  /* ------------------------------- DOM -------------------------------- */
  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        var val = attrs[key];
        if (val === null || val === undefined || val === false) { return; }
        if (key === 'class') { node.className = val; }
        else if (key === 'text') { node.textContent = val; }
        else if (key.slice(0, 2) === 'on' && typeof val === 'function') { node.addEventListener(key.slice(2), val); }
        else if (val === true) { node.setAttribute(key, ''); }
        else { node.setAttribute(key, val); }
      });
    }
    for (var i = 2; i < arguments.length; i++) { append(node, arguments[i]); }
    return node;
  }
  function append(node, child) {
    if (child === null || child === undefined || child === false) { return; }
    if (Array.isArray(child)) { child.forEach(function (c) { append(node, c); }); return; }
    node.appendChild(typeof child === 'object' ? child : document.createTextNode(String(child)));
  }
  function clear(node) { while (node.firstChild) { node.removeChild(node.firstChild); } return node; }
  function $(sel, root) { return (root || document).querySelector(sel); }

  /* ------------------------------ toasts ------------------------------ */
  function toast(message, kind) {
    var host = $('#toasts');
    if (!host) {
      host = el('div', { id: 'toasts', 'aria-live': 'polite' });
      document.body.appendChild(host);
    }
    var t = el('div', { class: 'toast' + (kind === 'error' ? ' toast-error' : ''), role: kind === 'error' ? 'alert' : 'status', text: message });
    host.appendChild(t);
    setTimeout(function () { t.classList.add('toast-out'); }, kind === 'error' ? 5200 : 3200);
    setTimeout(function () { if (t.parentNode) { t.parentNode.removeChild(t); } }, kind === 'error' ? 5600 : 3600);
  }

  /* ---------------------------- formatting ---------------------------- */
  function priorityLabel(p) { return has('ui.priority.' + p) ? t('ui.priority.' + p) : p; }
  function statusLabel(s) { return has('ui.status.' + s) ? t('ui.status.' + s) : s; }
  function badge(status) {
    return el('span', { class: 'badge badge-' + String(status).toLowerCase(), text: statusLabel(status) });
  }
  function minutes(n) {
    if (n <= 0) { return t('eta.soon'); }
    if (n < 60) { return t('eta.min', n); }
    var h = Math.floor(n / 60), m = n % 60;
    return m ? t('eta.hourmin', h, m) : t('eta.hour', h);
  }
  function clock(iso) {
    if (!iso) { return '–'; }
    var d = new Date(iso);
    return d.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });
  }
  function dateTime(iso) { return new Date(iso).toLocaleString(locale()); }

  /* --------------------------- printable slip --------------------------- */
  // Fills a (blank) document with a small token slip. Built with DOM calls, so names can never inject HTML.
  function buildSlip(doc, tok, opts) {
    opts = opts || {};
    doc.documentElement.lang = lang;
    var style = doc.createElement('style');
    style.textContent =
      'body{font-family:"Noto Sans","Noto Sans Devanagari","Noto Sans Kannada","Noto Sans Tamil","Noto Sans Telugu","Noto Sans Malayalam","Nirmala UI",system-ui,Arial,sans-serif;margin:0;padding:12px;text-align:center;color:#000;width:72mm}' +
      '.brand{font-weight:700;font-size:16px;letter-spacing:.04em}' +
      '.svc{font-size:14px;margin:6px 0}' +
      '.num{font-size:54px;font-weight:800;letter-spacing:2px;margin:8px 0;border:3px solid #000;border-radius:8px;padding:6px 0}' +
      '.row{font-size:13px;margin:3px 0}' +
      '.note{font-size:12px;margin-top:10px;border-top:1px dashed #000;padding-top:8px}' +
      '@page{margin:6mm}';
    doc.head.appendChild(style);
    function add(cls, text) {
      var d = doc.createElement('div');
      d.className = cls;
      d.textContent = text;
      doc.body.appendChild(d);
    }
    add('brand', 'QueueLess');
    add('svc', tokenService(tok));
    add('num', tok.number);
    if (opts.showName && tok.customerName) { add('row', t('ui.slip.name', tok.customerName)); }
    if (tok.priority && tok.priority !== 'NORMAL') { add('row', t('ui.slip.priority', priorityLabel(tok.priority))); }
    add('row', t('ui.slip.wait', tok.ahead, tok.ahead === 0 ? t('eta.soon') : minutes(tok.etaMinutes)));
    add('row', dateTime(tok.createdAt));
    add('note', t('ui.slip.note'));
  }

  // Prints the slip through a hidden frame (no pop-up window, so pop-up blockers do not interfere).
  function printSlip(tok, opts) {
    var frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    document.body.appendChild(frame);
    buildSlip(frame.contentDocument, tok, opts);
    setTimeout(function () {
      try { frame.contentWindow.focus(); frame.contentWindow.print(); } catch (e) { toast(t('ui.slip.printfail'), 'error'); }
      setTimeout(function () { if (frame.parentNode) { frame.parentNode.removeChild(frame); } }, 2000);
    }, 150);
  }

  /* ------------------------ header and footer ------------------------- */
  function logo() {
    return el('span', { class: 'brand-mark', 'aria-hidden': 'true' },
      svg('0 0 24 24', 'M5 19V9a3 3 0 0 1 6 0v10M13 19V9a3 3 0 0 1 6 0v10M3 19h18'));
  }
  function svg(viewBox, d) {
    var ns = 'http://www.w3.org/2000/svg';
    var s = document.createElementNS(ns, 'svg');
    s.setAttribute('viewBox', viewBox);
    s.setAttribute('fill', 'none');
    s.setAttribute('stroke', 'currentColor');
    s.setAttribute('stroke-width', '2');
    s.setAttribute('stroke-linecap', 'round');
    s.setAttribute('stroke-linejoin', 'round');
    var p = document.createElementNS(ns, 'path');
    p.setAttribute('d', d);
    s.appendChild(p);
    return s;
  }

  function languageSelect() {
    var sel = el('select', { class: 'lang-select', 'aria-label': t('ui.lang.label'), title: t('ui.lang.label') });
    LANGS.forEach(function (l) { sel.appendChild(el('option', { value: l[0], text: l[1], selected: l[0] === lang })); });
    sel.addEventListener('change', function () { setLang(sel.value); });
    return el('label', { class: 'lang-menu' },
      svg('0 0 24 24', 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z'),
      el('span', { class: 'sr-only', text: t('ui.lang.label') }), sel);
  }

  function chrome(active) {
    var links = [
      ['home', '/', t('ui.nav.get')],
      ['track', '/track.html', t('ui.nav.track')],
      ['board', '/board.html', t('ui.nav.board')],
      ['admin', '/admin.html', t('ui.nav.staff')]
    ];
    var nav = el('nav', { class: 'nav', 'aria-label': t('ui.nav.aria') });
    links.forEach(function (l) {
      nav.appendChild(el('a', { href: l[1], class: l[0] === active ? 'active' : '', 'aria-current': l[0] === active ? 'page' : null, text: l[2] }));
    });
    var header = el('header', { class: 'site-header' },
      el('div', { class: 'container header-row' },
        el('a', { class: 'brand', href: '/', 'aria-label': t('ui.nav.home') }, logo(), el('span', { text: 'QueueLess' })),
        el('div', { class: 'header-right' }, nav, languageSelect())));
    document.body.insertBefore(header, document.body.firstChild);

    var footer = el('footer', { class: 'site-footer' },
      el('div', { class: 'container' },
        el('span', { text: t('ui.footer') })));
    document.body.appendChild(footer);
  }

  global.QL = {
    api: api, el: el, clear: clear, $: $, toast: toast,
    priorityLabel: priorityLabel, statusLabel: statusLabel, badge: badge,
    minutes: minutes, clock: clock, dateTime: dateTime, chrome: chrome, buildSlip: buildSlip, printSlip: printSlip,
    adminToken: adminToken, setAdminToken: setAdminToken,
    // language support
    t: t, has: has, ready: ready, applyStatic: applyStatic, setLang: setLang, locale: locale, speechLang: speechLang,
    langs: LANGS, svcName: svcName, svcDesc: svcDesc, tokenService: tokenService, counterName: counterName, codeOf: codeOf,
    get lang() { return lang; }
  };
})(window);
