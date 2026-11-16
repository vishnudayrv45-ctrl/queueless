QL.ready(function () {
  'use strict';
  var el = QL.el, $ = QL.$;

  QL.chrome('board');

  var grid = $('#counters');
  var waiting = $('#waiting');
  var shown = {};          // counter id -> token number currently displayed
  var firstLoad = true;
  var voice = false;

  /* clock */
  function tick() { $('#clock').textContent = new Date().toLocaleTimeString(QL.locale(), { hour: '2-digit', minute: '2-digit' }); }
  tick();
  setInterval(tick, 10000);

  /* optional spoken announcements (the browser needs one click before it may speak) */
  var soundBtn = $('#sound');
  soundBtn.addEventListener('click', function () {
    voice = !voice;
    soundBtn.setAttribute('aria-pressed', String(voice));
    soundBtn.textContent = QL.t(voice ? 'ui.board.voice.on' : 'ui.board.voice.off');
    if (voice) { speak(QL.t('ui.board.voice.say')); }
  });
  function speak(text) {
    try {
      if (!voice || !window.speechSynthesis) { return; }
      var u = new SpeechSynthesisUtterance(text);
      u.lang = QL.speechLang();
      window.speechSynthesis.speak(u);
    } catch (e) { /* ignore */ }
  }
  function spoken(number) { return number.replace('-', ' ').split('').join(' ').replace(/ {2,}/g, ' '); }

  function render(b) {
    QL.clear(grid);
    if (!b.counters.length) {
      grid.appendChild(el('div', { class: 'card empty', text: QL.t('ui.board.nocounters') }));
    }
    b.counters.forEach(function (c) {
      var now = c.current ? c.current.number : '';
      var changed = !firstLoad && now && shown[c.id] !== now;
      shown[c.id] = now;
      grid.appendChild(el('div', { class: 'card board-counter' + (changed ? ' flash' : '') },
        el('div', { class: 'cname', text: QL.counterName(c.name) }),
        el('div', { class: 'csvc', text: QL.svcName(c.serviceCode, c.serviceName) }),
        el('div', { class: 'now' + (now ? '' : ' idle'), text: now || '—' }),
        el('div', { class: 'muted small', text: now ? QL.t('ui.board.come', QL.counterName(c.name)) : (c.waiting ? QL.t('ui.board.calling') : QL.t('ui.board.free')) })));
      if (changed) { speak(QL.t('ui.board.speak', spoken(now), QL.counterName(c.name))); }
    });

    QL.clear(waiting);
    b.services.forEach(function (s) {
      waiting.appendChild(el('tr', null,
        el('td', null, el('strong', { text: s.code + ' · ' }), QL.svcName(s.code, s.name)),
        el('td', { class: 'num', text: String(s.waiting) }),
        el('td', { text: s.waiting === 0 ? '–' : (s.openCounters === 0 ? QL.t('ui.board.nocounter') : QL.minutes(s.estimatedWaitMinutes)) })));
    });
    if (!b.services.length) {
      waiting.appendChild(el('tr', null, el('td', { colspan: '3', class: 'empty', text: QL.t('ui.board.noservices') })));
    }
    $('#updated').textContent = QL.t('ui.board.updated', new Date(b.updatedAt).toLocaleTimeString(QL.locale()));
    firstLoad = false;
  }

  function load() {
    QL.api('/board').then(render).catch(function (err) {
      $('#updated').textContent = err.message;
    });
  }
  load();
  setInterval(function () { if (!document.hidden) { load(); } }, 4000);
});
