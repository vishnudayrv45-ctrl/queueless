QL.ready(function () {
  'use strict';
  var el = QL.el, $ = QL.$;

  QL.chrome('track');

  var input = $('#number');
  var errorBox = $('#lookupError');
  var result = $('#result');
  var timer = null;
  var current = '';          // token number being tracked
  var firstPosition = 0;     // position when tracking began (for the progress bar)
  var lastStatus = '';
  var baseTitle = document.title;
  var scene = null;      // small 3D view of the customer's place in line
  var miniWrap = null;
  var sceneLabels = { youNow: QL.t('ui.scene.youNow'), youAhead: QL.t('ui.scene.youAhead'), serving: QL.t('ui.scene.serving') };

  function stored() {
    try { return JSON.parse(localStorage.getItem('ql_last') || 'null'); } catch (e) { return null; }
  }

  function showError(msg) { errorBox.textContent = msg; errorBox.hidden = !msg; }

  function stop() { if (timer) { clearInterval(timer); timer = null; } }

  function start(number) {
    stop();
    if (scene) { scene.destroy(); scene = null; }
    miniWrap = null;
    current = number;
    firstPosition = 0;
    lastStatus = '';
    load();
    timer = setInterval(function () { if (!document.hidden) { load(); } }, 5000);
  }

  function load() {
    return QL.api('/tokens/' + encodeURIComponent(current)).then(function (t) {
      showError('');
      render(t);
      if (t.status !== 'WAITING' && t.status !== 'CALLED') { stop(); }
    }).catch(function (err) {
      stop();
      QL.clear(result);
      showError(err.message);
    });
  }

  function alertTurn() {
    document.title = QL.t('ui.track.turn');
    try {
      var touched = !navigator.userActivation || navigator.userActivation.hasBeenActive;
      if (navigator.vibrate && touched) { navigator.vibrate([250, 120, 250]); }
    } catch (e) { /* ignore */ }
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (AC) {
        var ac = new AC();
        var osc = ac.createOscillator();
        var gain = ac.createGain();
        osc.connect(gain); gain.connect(ac.destination);
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.0001, ac.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.25, ac.currentTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.7);
        osc.start(); osc.stop(ac.currentTime + 0.75);
      }
    } catch (e) { /* sound is optional */ }
  }

  function miniSceneWrap() {
    if (!miniWrap) {
      miniWrap = el('div', { class: 'mini-scene' }, el('canvas', { role: 'img', 'aria-label': QL.t('ui.scene.aria') }));
    }
    return miniWrap;
  }

  function syncScene(t) {
    var live = t.status === 'WAITING' || t.status === 'CALLED';
    if (!live) {
      if (scene) { scene.destroy(); scene = null; }
      miniWrap = null;
      return;
    }
    var ahead = t.status === 'CALLED' ? 0 : t.ahead;
    if (!scene) {
      scene = QueueScene.mount(miniWrap.firstChild, { labels: sceneLabels, theme: 'light', tracker: true, people: 6, youToken: t.number, ahead: ahead, sway: 0.22 });
      scene.start();
    } else {
      scene.setAhead(ahead);
    }
  }

  function tile(value, label) {
    return el('div', { class: 'tile' }, el('div', { class: 'v', text: value }), el('div', { class: 'l', text: label }));
  }

  function render(t) {
    QL.clear(result);
    var card = el('div', { class: 'card ticket' });
    card.appendChild(el('span', { class: 'eyebrow', text: QL.tokenService(t) }));
    card.appendChild(el('div', { class: 'number', text: t.number }));
    card.appendChild(el('p', null, QL.badge(t.status), ' ', el('span', { class: 'muted', text: QL.priorityLabel(t.priority) })));
    if (t.status === 'WAITING' || t.status === 'CALLED') { card.appendChild(miniSceneWrap()); }

    if (t.status === 'WAITING') {
      if (!firstPosition) { firstPosition = t.position; }
      var pct = firstPosition <= 1 ? 100 : Math.round((1 - (t.position - 1) / firstPosition) * 100);
      document.title = QL.t('ui.track.inline', t.position, baseTitle);

      card.appendChild(el('div', { class: 'tiles' },
        tile(String(t.position), QL.t('ui.ticket.position')),
        tile(String(t.ahead), QL.t('ui.ticket.ahead')),
        tile(t.ahead === 0 ? QL.t('ui.lt1min') : QL.minutes(t.etaMinutes), QL.t('ui.ticket.eta'))));
      card.appendChild(el('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(pct), 'aria-label': QL.t('ui.track.progress') },
        el('span', { style: 'width:' + Math.max(6, pct) + '%' })));
      if (t.openCounters === 0) {
        card.appendChild(el('div', { class: 'notice' }, el('strong', { text: QL.t('ui.notice.nocounter.t') }), QL.t('ui.notice.nocounter.soon')));
      } else if (t.ahead === 0) {
        card.appendChild(el('div', { class: 'notice' }, el('strong', { text: QL.t('ui.notice.next.t') }), QL.t('ui.notice.next.board')));
      }
      card.appendChild(cancelBox(t));
    } else if (t.status === 'CALLED') {
      if (lastStatus !== 'CALLED') { alertTurn(); }
      document.title = QL.t('ui.track.turn');
      card.appendChild(el('div', { class: 'notice notice-strong' }, QL.t('ui.track.goto', QL.counterName(t.counterName) || QL.t('ui.track.thecounter'))));
    } else if (t.status === 'COMPLETED') {
      document.title = baseTitle;
      card.appendChild(el('div', { class: 'notice' }, el('strong', { text: QL.t('ui.track.done.t') }), QL.t('ui.track.done.d')));
      card.appendChild(el('a', { class: 'btn', href: '/', text: QL.t('ui.track.home') }));
    } else if (t.status === 'SKIPPED') {
      document.title = baseTitle;
      card.appendChild(el('div', { class: 'notice' }, el('strong', { text: QL.t('ui.track.skipped.t') }), QL.t('ui.track.skipped.d')));
      card.appendChild(el('a', { class: 'btn btn-primary', href: '/#get-token', text: QL.t('ui.track.newtoken') }));
    } else {
      document.title = baseTitle;
      card.appendChild(el('div', { class: 'notice' }, el('strong', { text: QL.t('ui.track.cancelled') })));
      card.appendChild(el('a', { class: 'btn btn-primary', href: '/#get-token', text: QL.t('ui.track.newtoken') }));
    }

    if (t.status === 'WAITING' || t.status === 'CALLED') {
      card.appendChild(el('p', { class: 'muted small', style: 'margin:14px 0 0', text: QL.t('ui.track.updated', new Date().toLocaleTimeString(QL.locale())) }));
    }
    result.appendChild(el('div', { style: 'margin-top:20px' }, card));
    syncScene(t);
    lastStatus = t.status;
  }

  function cancelBox(t) {
    var saved = stored();
    var phone = el('input', { type: 'tel', inputmode: 'numeric', placeholder: QL.t('ui.cancel.ph'), 'aria-label': QL.t('ui.cancel.aria') });
    if (saved && saved.number === t.number && saved.phone) { phone.value = saved.phone; }
    var msg = el('p', { class: 'form-error', role: 'alert', hidden: true });
    var btn = el('button', { class: 'btn btn-danger', type: 'button', text: QL.t('ui.cancel.btn') });
    btn.addEventListener('click', function () {
      var p = phone.value.replace(/\D/g, '');
      if (p.length !== 10) { msg.textContent = QL.t('ui.cancel.err.phone'); msg.hidden = false; return; }
      if (!window.confirm(QL.t('ui.cancel.confirm', t.number))) { return; }
      btn.disabled = true;
      QL.api('/tokens/' + encodeURIComponent(t.number) + '/cancel', { method: 'POST', body: { phone: p } })
        .then(function () { QL.toast(QL.t('ui.cancel.done')); return load(); })
        .catch(function (err) { msg.textContent = err.message; msg.hidden = false; btn.disabled = false; });
    });
    return el('details', { style: 'margin-top:18px; text-align:left' },
      el('summary', { style: 'cursor:pointer; font-weight:600', text: QL.t('ui.cancel.summary') }),
      el('div', { style: 'margin-top:12px' }, phone, msg, el('div', { style: 'margin-top:10px' }, btn)));
  }

  $('#lookup').addEventListener('submit', function (e) {
    e.preventDefault();
    var n = input.value.trim().toUpperCase();
    if (!n) { showError(QL.t('ui.track.err.number')); return; }
    showError('');
    history.replaceState(null, '', '?t=' + encodeURIComponent(n));
    start(n);
  });

  // Start from ?t=C-014, or from the last token this browser received.
  var fromUrl = new URLSearchParams(location.search).get('t');
  var saved = stored();
  var first = (fromUrl || (saved && saved.number) || '').trim().toUpperCase();
  if (first) { input.value = first; start(first); }
});
