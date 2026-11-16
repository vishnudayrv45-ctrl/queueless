QL.ready(function () {
  'use strict';
  var el = QL.el, $ = QL.$;

  QL.chrome('home');

  var sceneLabels = { youNow: QL.t('ui.scene.youNow'), youAhead: QL.t('ui.scene.youAhead'), serving: QL.t('ui.scene.serving') };

  /* ------------------------- language picker ------------------------- */
  var pick = $('#langPick');
  QL.langs.forEach(function (l) {
    var chip = el('button', { class: 'lang-chip', type: 'button', lang: l[0], text: l[1], 'aria-pressed': String(l[0] === QL.lang) });
    chip.addEventListener('click', function () { QL.setLang(l[0]); });
    pick.appendChild(chip);
  });

  /* ------------------------- SevaGate intro ------------------------- */
  var intro = $('#intro');
  var introScene = null;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function closeIntro() {
    if (!intro || intro.classList.contains('hide')) { return; }
    try { sessionStorage.setItem('ql_intro', '1'); } catch (e) { /* ignore */ }
    intro.classList.add('hide');
    document.body.style.overflow = '';
    setTimeout(function () { if (introScene) { introScene.destroy(); introScene = null; } }, 900);
    var main = $('#main');
    if (main) { main.setAttribute('tabindex', '-1'); main.focus({ preventScroll: true }); }
  }

  if (intro && getComputedStyle(intro).display !== 'none') {
    if (reduce) {
      closeIntro();
    } else {
      document.body.style.overflow = 'hidden';
      introScene = QueueScene.mount($('#introCanvas'), {
        labels: sceneLabels, theme: 'dark', people: 8, cycle: 1.7, speed: 1.9, showYou: false, startNo: 41, sway: 0.4, zoom: 0.8, yShift: 0.74
      });
      introScene.start();
      $('#introSkip').addEventListener('click', closeIntro);
      $('#introEnter').addEventListener('click', closeIntro);
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape' || e.key === 'Enter') { closeIntro(); } });
      setTimeout(closeIntro, 7500);
      $('#introEnter').focus({ preventScroll: true });
    }
  }

  /* --------------------------- hero scene --------------------------- */
  var narrow = window.innerWidth < 600;
  var hero = QueueScene.mount($('#heroCanvas'), { labels: sceneLabels, theme: 'light', people: narrow ? 5 : 7, cycle: 2.8, yShift: narrow ? 0.6 : 0.56 });
  hero.start();

  /* ------------------------- resume banner -------------------------- */
  function lastToken() {
    try { return JSON.parse(localStorage.getItem('ql_last') || 'null'); } catch (e) { return null; }
  }
  function remember(number, phone) {
    try { localStorage.setItem('ql_last', JSON.stringify({ number: number, phone: phone })); } catch (e) { /* ignore */ }
  }
  var last = lastToken();
  if (last && last.number) {
    var box = $('#resume');
    box.hidden = false;
    box.className = 'notice';
    box.style.marginTop = '22px';
    box.appendChild(el('span', { text: QL.t('ui.home.resume') + ' ' }));
    box.appendChild(el('strong', { text: last.number }));
    box.appendChild(document.createTextNode(' · '));
    box.appendChild(el('a', { href: '/track.html?t=' + encodeURIComponent(last.number), text: QL.t('ui.home.resume.link') }));
  }

  /* ------------------------- services list -------------------------- */
  var list = $('#serviceList');
  var selected = null;
  var serviceTimer = null;

  function renderServices(services) {
    var current = selected;
    QL.clear(list);
    if (!services.length) {
      list.appendChild(el('p', { class: 'muted', text: QL.t('ui.home.noservices') }));
      $('#submitBtn').disabled = true;
      return;
    }
    $('#submitBtn').disabled = false;
    if (!services.some(function (s) { return String(s.id) === String(current); })) { current = services[0].id; }
    selected = current;

    services.forEach(function (s) {
      var wait = s.waiting === 0 ? QL.t('ui.home.svc.none') : QL.t('ui.home.svc.waiting', s.waiting, QL.minutes(s.estimatedWaitMinutes));
      if (s.openCounters === 0) { wait = QL.t('ui.home.svc.nocounter'); }
      var desc = QL.svcDesc(s.code, s.name, s.description);
      var id = 'svc-' + s.id;
      var input = el('input', { type: 'radio', name: 'service', id: id, value: s.id, checked: String(s.id) === String(current) });
      input.addEventListener('change', function () { selected = s.id; });
      list.appendChild(el('label', { class: 'service-option', for: id },
        input,
        el('span', { class: 'box' },
          el('span', { class: 'name', text: QL.svcName(s.code, s.name) }),
          desc ? el('span', { class: 'desc', text: desc }) : null,
          el('span', { class: 'meta', text: wait }))));
    });
  }

  function loadServices() {
    QL.api('/services').then(renderServices).catch(function (err) {
      QL.clear(list);
      list.appendChild(el('p', { class: 'form-error', text: err.message }));
    });
  }
  loadServices();
  serviceTimer = setInterval(function () {
    if (!document.hidden && !$('#tokenForm').hidden) { loadServices(); }
  }, 15000);

  /* ------------------- WhatsApp option (admin can switch it off) ------------------- */
  var config = { whatsappEnabled: false, whatsappMode: 'DEMO' };
  QL.api('/config').then(function (c) {
    config = c;
    $('#waField').hidden = !c.whatsappEnabled;
  }).catch(function () { /* the form works without it */ });

  /* --------------------------- submit form -------------------------- */
  var form = $('#tokenForm');
  var errorBox = $('#formError');

  function showError(message) {
    errorBox.textContent = message;
    errorBox.hidden = !message;
  }

  $('#phone').addEventListener('input', function (e) {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10);
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    showError('');
    var name = $('#name').value.trim();
    var phone = $('#phone').value.trim();
    if (!selected) { return showError(QL.t('ui.home.err.service')); }
    if (!name) { $('#name').focus(); return showError(QL.t('ui.home.err.name')); }
    if (!/^\d{10}$/.test(phone)) { $('#phone').focus(); return showError(QL.t('ui.home.err.phone')); }

    var btn = $('#submitBtn');
    btn.disabled = true;
    btn.textContent = QL.t('ui.home.form.submitting');
    QL.api('/tokens', {
      method: 'POST',
      body: { name: name, phone: phone, serviceId: Number(selected), priority: $('#priority').value,
        whatsapp: config.whatsappEnabled && $('#waOptin').checked, lang: QL.lang }
    }).then(function (token) {
      remember(token.number, phone);
      showTicket(token, config.whatsappEnabled && $('#waOptin').checked ? phone : '');
    }).catch(function (err) {
      showError(err.message);
      btn.disabled = false;
      btn.textContent = QL.t('ui.home.form.submit');
    });
  });

  function tile(value, label) {
    return el('div', { class: 'tile' }, el('div', { class: 'v', text: value }), el('div', { class: 'l', text: label }));
  }

  function showTicket(t, waPhone) {
    var card = $('#tokenCard');
    QL.clear(card);
    card.classList.add('ticket');
    var next = t.ahead === 0;
    card.appendChild(el('span', { class: 'eyebrow', text: QL.t('ui.ticket.eyebrow') }));
    card.appendChild(el('div', { class: 'number', text: t.number }));
    card.appendChild(el('p', { class: 'muted', text: QL.tokenService(t) + ' · ' + QL.priorityLabel(t.priority) }));
    var wrap = el('div', { class: 'mini-scene' }, el('canvas', { role: 'img', 'aria-label': QL.t('ui.scene.aria') }));
    card.appendChild(wrap);
    card.appendChild(el('div', { class: 'tiles' },
      tile(String(t.position), QL.t('ui.ticket.position')),
      tile(String(t.ahead), QL.t('ui.ticket.ahead')),
      tile(next ? QL.t('ui.lt1min') : QL.minutes(t.etaMinutes), QL.t('ui.ticket.eta'))));
    if (t.openCounters === 0) {
      card.appendChild(el('div', { class: 'notice' }, el('strong', { text: QL.t('ui.notice.nocounter.t') }),
        QL.t('ui.notice.nocounter.saved')));
    } else if (next) {
      card.appendChild(el('div', { class: 'notice' }, el('strong', { text: QL.t('ui.notice.next.t') }), QL.t('ui.notice.next.stay')));
    }
    if (waPhone) {
      var wa = el('div', { class: 'notice' }, QL.t('ui.wa.on'));
      if (String(config.whatsappMode).toUpperCase() === 'DEMO') {
        wa.appendChild(document.createTextNode(' '));
        wa.appendChild(el('a', { href: '/whatsapp-demo.html?phone=' + encodeURIComponent(waPhone), text: QL.t('ui.wa.demo.link') }));
      }
      card.appendChild(wa);
    }
    card.appendChild(el('p', { class: 'muted small', text: QL.t('ui.ticket.save') }));
    card.appendChild(el('div', { class: 'btn-row', style: 'justify-content:center' },
      el('a', { class: 'btn btn-primary', href: '/track.html?t=' + encodeURIComponent(t.number), text: QL.t('ui.ticket.track') }),
      el('button', { class: 'btn', type: 'button', text: QL.t('ui.ticket.print'), onclick: function () { QL.printSlip(t); } }),
      el('a', { class: 'btn', href: '/board.html', text: QL.t('ui.ticket.board') })));
    QueueScene.mount(wrap.firstChild, { labels: sceneLabels, theme: 'light', tracker: true, people: 6, youToken: t.number, ahead: t.ahead, sway: 0.22 }).start();
    card.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
    if (serviceTimer) { clearInterval(serviceTimer); }
  }
});
