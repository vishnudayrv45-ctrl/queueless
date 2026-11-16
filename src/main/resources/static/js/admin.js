QL.ready(function () {
  'use strict';
  var el = QL.el, $ = QL.$, clear = QL.clear;

  QL.chrome('admin');

  var app = $('#app');
  var timer = null;
  var active = null;
  var activeName = 'desk';
  var uid = 0;
  var lastError = '';

  /* ----------------------------- helpers ----------------------------- */
  function admin(path, method, body) {
    return QL.api('/admin' + path, { admin: true, method: method || 'GET', body: body });
  }

  // For actions the user clicked: show a toast on failure and carry on.
  function guard(promise, okMessage) {
    return promise.then(function (r) {
      if (okMessage) { QL.toast(okMessage); }
      return r;
    }).catch(function (e) {
      if (e.status !== 401) { QL.toast(e.message, 'error'); }
      return undefined;
    });
  }

  // For background refreshes: only complain when the message changes, so we never spam.
  function soft(e) {
    if (e.status === 401) { return; }
    if (e.message !== lastError) { QL.toast(e.message, 'error'); lastError = e.message; }
  }

  function field(label, input, hint) {
    var id = 'f' + (++uid);
    input.id = id;
    return el('div', { class: 'field' },
      el('label', { for: id, text: label }), input,
      hint ? el('p', { class: 'hint', text: hint }) : null);
  }
  function option(value, text, selected) {
    return el('option', { value: String(value), text: text, selected: !!selected });
  }
  function fillServices(select, services, selectedId, onlyActive) {
    clear(select);
    services.filter(function (s) { return !onlyActive || s.active; }).forEach(function (s) {
      select.appendChild(option(s.id, QL.svcName(s.code, s.name) + ' (' + s.code + ')', String(s.id) === String(selectedId)));
    });
  }
  function priorityOptions(selected) {
    return ['NORMAL', 'SENIOR', 'DISABLED'].map(function (p) { return option(p, QL.priorityLabel(p), p === selected); });
  }
  function sameJson(holder, data) {
    var j = JSON.stringify(data);
    if (holder.last === j) { return true; }
    holder.last = j;
    return false;
  }

  /* ------------------------------ login ------------------------------ */
  function showLogin(message) {
    stopPolling();
    clear(app);
    var err = el('p', { class: 'form-error', role: 'alert', text: message || '', hidden: !message });
    var user = el('input', { type: 'text', autocomplete: 'username', required: true });
    var pass = el('input', { type: 'password', autocomplete: 'current-password', required: true });
    var btn = el('button', { class: 'btn btn-primary', type: 'submit', style: 'width:100%', text: QL.t('ui.admin.signin') });
    var form = el('form', { novalidate: true },
      field(QL.t('ui.admin.username'), user), field(QL.t('ui.admin.password'), pass), err, btn);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      err.hidden = true;
      if (!user.value.trim() || !pass.value) { err.textContent = QL.t('ui.admin.err.creds'); err.hidden = false; return; }
      btn.disabled = true;
      QL.api('/admin/login', { method: 'POST', body: { username: user.value.trim(), password: pass.value } })
        .then(function (r) { QL.setAdminToken(r.token); showApp(); })
        .catch(function (ex) { err.textContent = ex.message; err.hidden = false; btn.disabled = false; });
    });
    app.appendChild(el('div', { class: 'card login-card' },
      el('h1', { style: 'font-size:1.7rem', text: QL.t('ui.admin.login.h1') }),
      el('p', { class: 'muted', text: QL.t('ui.admin.login.sub') }),
      form));
    user.focus();
  }

  document.addEventListener('ql-unauthorized', function () { showLogin(QL.t('ui.admin.session.ended')); });

  /* ------------------------------ shell ------------------------------ */
  var TABS = [['desk', QL.t('ui.admin.tab.desk')], ['tokens', QL.t('ui.admin.tab.tokens')], ['counters', QL.t('ui.admin.tab.counters')],
    ['services', QL.t('ui.admin.tab.services')], ['whatsapp', QL.t('ui.admin.tab.whatsapp')]];
  var PANELS = { desk: deskPanel, tokens: tokensPanel, counters: countersPanel, services: servicesPanel, whatsapp: whatsappPanel };

  function showApp() {
    clear(app);
    var statsBox = el('div', { class: 'stats', id: 'stats' });
    var tabBar = el('div', { class: 'tabs', role: 'tablist' });
    var panel = el('div', { id: 'panel', role: 'tabpanel' });

    TABS.forEach(function (t) {
      var b = el('button', { class: 'tab', type: 'button', role: 'tab', 'data-tab': t[0], text: t[1], 'aria-selected': 'false' });
      b.addEventListener('click', function () { select(t[0]); });
      tabBar.appendChild(b);
    });

    var logout = el('button', { class: 'btn btn-small', type: 'button', text: QL.t('ui.admin.signout') });
    logout.addEventListener('click', function () {
      admin('/logout', 'POST').catch(function () { /* already gone */ }).then(function () {
        QL.setAdminToken('');
        showLogin('');
      });
    });

    app.appendChild(el('div', { class: 'container page' },
      el('div', { class: 'toolbar', style: 'justify-content:space-between;align-items:center' },
        el('div', null, el('h1', { style: 'font-size:1.8rem;margin:0', text: QL.t('ui.admin.h1') }),
          el('p', { class: 'muted', style: 'margin:0', text: QL.t('ui.admin.today', new Date().toLocaleDateString(QL.locale(), { weekday: 'long', day: 'numeric', month: 'long' })) })),
        logout),
      statsBox, tabBar, panel));

    select(activeName);
    startPolling();
  }

  function select(name) {
    activeName = name;
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (b) {
      b.setAttribute('aria-selected', String(b.getAttribute('data-tab') === name));
    });
    var panel = $('#panel');
    clear(panel);
    active = PANELS[name]();
    active.mount(panel);
    refreshAll(true);
  }

  function refreshStats() {
    return admin('/stats').then(function (s) {
      var box = $('#stats');
      if (!box) { return; }
      clear(box);
      [[QL.t('ui.stat.total'), s.total], [QL.t('ui.stat.waiting'), s.waiting], [QL.t('ui.stat.serving'), s.serving], [QL.t('ui.stat.completed'), s.completed],
        [QL.t('ui.stat.skipped'), s.skipped], [QL.t('ui.stat.cancelled'), s.cancelled], [QL.t('ui.stat.avgwait'), s.avgWaitMinutes], [QL.t('ui.stat.avgsvc'), s.avgServiceMinutes]
      ].forEach(function (x) {
        box.appendChild(el('div', { class: 'stat' }, el('div', { class: 'v', text: String(x[1]) }), el('div', { class: 'l', text: x[0] })));
      });
      lastError = '';
    }).catch(soft);
  }

  function refreshAll(force) {
    refreshStats();
    if (active) { active.refresh(force); }
  }

  function startPolling() {
    stopPolling();
    timer = setInterval(function () { if (!document.hidden) { refreshAll(false); } }, 5000);
  }
  function stopPolling() { if (timer) { clearInterval(timer); timer = null; } }

  /* --------------------------- queue desk tab --------------------------- */
  function deskPanel() {
    var box, hold = { last: '' };

    function card(c) {
      var cur = c.current;
      var currentBox = el('div', { class: 'desk-current' + (cur ? ' active' : '') },
        cur ? [
          el('div', { class: 'tn', text: cur.number }),
          el('div', { style: 'font-weight:600', text: cur.customerName }),
          el('div', { class: 'muted small', text: QL.priorityLabel(cur.priority) + ' · ' + QL.t('ui.desk.called', '', QL.clock(cur.calledAt)).replace(/^\s*·\s*/, '') })
        ] : el('div', { class: 'muted', text: c.open ? QL.t('ui.desk.nobody') : QL.t('ui.desk.closed') }));

      var actions = el('div', { class: 'btn-row' });
      if (cur) {
        actions.appendChild(button(QL.t('ui.desk.complete'), 'btn btn-primary', function () {
          guard(admin('/tokens/' + cur.id + '/complete', 'POST'), QL.t('ui.desk.completed', cur.number)).then(function () { refreshAll(true); });
        }));
        actions.appendChild(button(QL.t('ui.desk.skip'), 'btn', function () {
          if (!window.confirm(QL.t('ui.desk.skip.confirm', cur.number))) { return; }
          guard(admin('/tokens/' + cur.id + '/skip', 'POST'), QL.t('ui.desk.skipped', cur.number)).then(function () { refreshAll(true); });
        }));
      } else {
        var next = button(c.waiting ? QL.t('ui.desk.callnext.n', c.waiting) : QL.t('ui.desk.callnext'), 'btn btn-primary', function () {
          guard(admin('/counters/' + c.id + '/call-next', 'POST')).then(function (t) {
            if (t) { QL.toast(QL.t('ui.desk.calledto', t.number, QL.counterName(c.name))); }
            refreshAll(true);
          });
        });
        next.disabled = !c.open || c.waiting === 0;
        actions.appendChild(next);
      }
      var toggle = button(c.open ? QL.t('ui.desk.close') : QL.t('ui.desk.open'), 'btn btn-small', function () {
        guard(admin('/counters/' + c.id, 'PUT', { name: c.name, serviceId: c.serviceId, open: !c.open }),
          QL.t(c.open ? 'ui.desk.wasclosed' : 'ui.desk.wasopened', QL.counterName(c.name))).then(function () { refreshAll(true); });
      });

      return el('div', { class: 'card desk-card' },
        el('div', { class: 'desk-head' },
          el('div', null, el('h3', { text: QL.counterName(c.name) }), el('span', { class: 'muted small', text: QL.svcName(c.serviceCode, c.serviceName) })),
          el('span', { class: 'tag', text: c.open ? QL.t('ui.tag.open') : QL.t('ui.tag.closed') })),
        currentBox, actions, el('div', null, toggle));
    }

    return {
      mount: function (c) { box = el('div', { class: 'desk-grid' }); c.appendChild(box); },
      refresh: function (force) {
        if (force) { hold.last = ''; }
        return admin('/counters').then(function (list) {
          if (sameJson(hold, list)) { return; }
          clear(box);
          if (!list.length) {
            box.appendChild(el('div', { class: 'card empty', text: QL.t('ui.desk.nocounters') }));
            return;
          }
          list.forEach(function (c) { box.appendChild(card(c)); });
        }).catch(soft);
      }
    };
  }

  function button(text, cls, onClick) {
    var b = el('button', { class: cls, type: 'button', text: text });
    b.addEventListener('click', onClick);
    return b;
  }

  /* ----------------------------- tokens tab ----------------------------- */
  function tokensPanel() {
    var tableBox, serviceFilter, statusFilter, hold = { last: '' };
    var services = [];

    var ORDER = { CALLED: 0, WAITING: 1, COMPLETED: 2, SKIPPED: 2, CANCELLED: 2 };

    function sorted(list) {
      return list.slice().sort(function (a, b) {
        if (ORDER[a.status] !== ORDER[b.status]) { return ORDER[a.status] - ORDER[b.status]; }
        if (a.status === 'WAITING') { return a.serviceName.localeCompare(b.serviceName) || a.position - b.position; }
        return b.id - a.id;
      });
    }

    function row(t) {
      var priorityCell;
      if (t.status === 'WAITING') {
        var sel = el('select', { 'aria-label': QL.t('ui.tok.priority.aria', t.number) }, priorityOptions(t.priority));
        sel.addEventListener('change', function () {
          guard(admin('/tokens/' + t.id + '/priority', 'PUT', { priority: sel.value }), QL.t('ui.tok.priority.updated', t.number))
            .then(function () { refreshAll(true); });
        });
        priorityCell = sel;
      } else {
        priorityCell = QL.priorityLabel(t.priority);
      }
      var where = t.status === 'WAITING' ? '#' + t.position + ' · ~' + QL.minutes(t.etaMinutes)
        : (QL.counterName(t.counterName) || '–');
      var actions = el('div', { class: 'item-actions' });
      if (t.status === 'WAITING') {
        actions.appendChild(button(QL.t('ui.tok.print'), 'btn btn-small', function () { QL.printSlip(t, { showName: true }); }));
      }
      if (t.status === 'WAITING' || t.status === 'CALLED') {
        actions.appendChild(button(QL.t('ui.tok.cancel'), 'btn btn-danger btn-small', function () {
          if (!window.confirm(QL.t('ui.tok.cancel.confirm', t.number))) { return; }
          guard(admin('/tokens/' + t.id + '/cancel', 'POST'), QL.t('ui.tok.cancelled', t.number)).then(function () { refreshAll(true); });
        }));
      }
      if (!actions.firstChild) { actions.textContent = '–'; }
      return el('tr', null,
        el('td', { class: 'num', text: t.number }),
        el('td', { text: t.customerName }),
        el('td', { text: QL.tokenService(t) }),
        el('td', null, priorityCell),
        el('td', null, QL.badge(t.status)),
        el('td', { text: where }),
        el('td', { text: QL.clock(t.createdAt) }),
        el('td', null, actions));
    }

    function walkInForm() {
      var name = el('input', { type: 'text', maxlength: '80' });
      var phone = el('input', { type: 'tel', inputmode: 'numeric', placeholder: QL.t('ui.home.form.phone.ph') });
      var svc = el('select');
      var pri = el('select', null, priorityOptions('NORMAL'));
      var autoPrint = el('input', { type: 'checkbox', checked: true });
      var waBox = el('input', { type: 'checkbox', checked: true });
      var waRow = el('div', { class: 'field', hidden: true }, el('label', { class: 'inline-check' }, waBox, QL.t('ui.walk.wa')));
      QL.api('/config').then(function (c) { waRow.hidden = !c.whatsappEnabled; }).catch(function () { /* optional */ });
      var result = el('div', { 'aria-live': 'polite', style: 'margin-top:14px' });
      var err = el('p', { class: 'form-error', role: 'alert', hidden: true });
      phone.addEventListener('input', function () { phone.value = phone.value.replace(/\D/g, '').slice(0, 10); });
      var form = el('form', { novalidate: true },
        el('div', { class: 'grid-2' }, field(QL.t('ui.walk.name'), name),
          field(QL.t('ui.walk.phone'), phone, QL.t('ui.walk.phone.hint'))),
        waRow,
        el('div', { class: 'grid-2' }, field(QL.t('ui.walk.service'), svc), field(QL.t('ui.walk.priority'), pri)),
        el('div', { class: 'field' }, el('label', { class: 'inline-check' }, autoPrint, QL.t('ui.walk.autoprint'))),
        err, el('button', { class: 'btn btn-primary', type: 'submit', text: QL.t('ui.walk.issue') }), result);
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        err.hidden = true;
        if (!name.value.trim()) { err.textContent = QL.t('ui.walk.err.name'); err.hidden = false; return; }
        if (phone.value && !/^\d{10}$/.test(phone.value)) { err.textContent = QL.t('ui.walk.err.phone'); err.hidden = false; return; }
        if (!svc.value) { err.textContent = QL.t('ui.walk.err.service'); err.hidden = false; return; }
        guard(admin('/tokens', 'POST', { name: name.value.trim(), phone: phone.value, serviceId: Number(svc.value), priority: pri.value,
          whatsapp: !!phone.value && !waRow.hidden && waBox.checked, lang: QL.lang })).then(function (t) {
          if (t) {
            QL.toast(QL.t('ui.walk.toast', t.number, name.value.trim()));
            clear(result);
            result.appendChild(el('div', { class: 'notice', style: 'margin:0' },
              el('strong', { text: t.number }), ' ' + QL.t('ui.walk.issued', '', t.customerName).replace(/^\s+/, '') + ' ',
              button(QL.t('ui.tok.print'), 'btn btn-small', function () { QL.printSlip(t, { showName: true }); })));
            if (autoPrint.checked) { QL.printSlip(t, { showName: true }); }
            name.value = ''; phone.value = ''; pri.value = 'NORMAL';
            refreshAll(true);
          }
        });
      });
      form.setServices = function (list) { fillServices(svc, list, svc.value, true); };
      return form;
    }

    var walkIn = walkInForm();

    return {
      mount: function (c) {
        serviceFilter = el('select', null, option('', QL.t('ui.tok.all.services')));
        statusFilter = el('select', null,
          option('', QL.t('ui.tok.all.statuses')), option('WAITING', QL.statusLabel('WAITING')), option('CALLED', QL.statusLabel('CALLED')),
          option('COMPLETED', QL.statusLabel('COMPLETED')), option('SKIPPED', QL.statusLabel('SKIPPED')), option('CANCELLED', QL.statusLabel('CANCELLED')));
        serviceFilter.addEventListener('change', function () { refreshAll(true); });
        statusFilter.addEventListener('change', function () { refreshAll(true); });
        tableBox = el('div', { class: 'table-wrap' });

        c.appendChild(el('details', { class: 'card', style: 'margin-bottom:18px' },
          el('summary', { style: 'cursor:pointer;font-weight:650', text: QL.t('ui.walk.summary') }),
          el('div', { style: 'margin-top:16px' }, walkIn)));
        c.appendChild(el('div', { class: 'toolbar' },
          field(QL.t('ui.tok.filter.service'), serviceFilter), field(QL.t('ui.tok.filter.status'), statusFilter)));
        c.appendChild(tableBox);

        admin('/services').then(function (list) {
          services = list;
          var keep = serviceFilter.value;
          clear(serviceFilter);
          serviceFilter.appendChild(option('', QL.t('ui.tok.all.services')));
          list.forEach(function (s) { serviceFilter.appendChild(option(s.id, QL.svcName(s.code, s.name), String(s.id) === keep)); });
          walkIn.setServices(list);
        }).catch(soft);
      },
      refresh: function (force) {
        if (force) { hold.last = ''; }
        var q = [];
        if (serviceFilter.value) { q.push('serviceId=' + encodeURIComponent(serviceFilter.value)); }
        if (statusFilter.value) { q.push('status=' + encodeURIComponent(statusFilter.value)); }
        return admin('/tokens' + (q.length ? '?' + q.join('&') : '')).then(function (list) {
          if (sameJson(hold, list)) { return; }
          clear(tableBox);
          if (!list.length) {
            tableBox.appendChild(el('div', { class: 'empty', text: QL.t('ui.tok.empty') }));
            return;
          }
          tableBox.appendChild(el('table', { class: 'data' },
            el('thead', null, el('tr', null, [QL.t('ui.tok.th.token'), QL.t('ui.tok.th.name'), QL.t('ui.tok.th.service'), QL.t('ui.tok.th.priority'), QL.t('ui.tok.th.status'), QL.t('ui.tok.th.where'), QL.t('ui.tok.th.issued'), ''].map(function (h) { return el('th', { text: h }); }))),
            el('tbody', null, sorted(list).map(row))));
        }).catch(soft);
      }
    };
  }

  /* ---------------------------- counters tab ---------------------------- */
  function countersPanel() {
    var listBox, formTitle, name, svc, open, err, saveBtn, cancelBtn;
    var editingId = null, services = [], hold = { last: '' };

    function resetForm() {
      editingId = null;
      name.value = ''; open.checked = true; err.hidden = true;
      formTitle.textContent = QL.t('ui.ctr.add.h');
      saveBtn.textContent = QL.t('ui.ctr.add');
      cancelBtn.hidden = true;
      fillServices(svc, services, svc.value, true);
    }

    function edit(c) {
      editingId = c.id;
      name.value = c.name;
      fillServices(svc, services, c.serviceId, false);
      open.checked = c.open;
      err.hidden = true;
      formTitle.textContent = QL.t('ui.ctr.edit.h', c.name);
      saveBtn.textContent = QL.t('ui.btn.save');
      cancelBtn.hidden = false;
      name.focus();
    }

    function item(c) {
      return el('div', { class: 'item' },
        el('div', null,
          el('div', { class: 't', text: QL.counterName(c.name) }),
          el('div', { class: 'muted small', text: QL.svcName(c.serviceCode, c.serviceName) + ' · ' + (c.open ? QL.t('ui.tag.open') : QL.t('ui.tag.closed')) + (c.current ? ' · ' + QL.t('ui.ctr.serving', c.current.number) : '') })),
        el('div', { class: 'item-actions' },
          button(QL.t('ui.btn.edit'), 'btn btn-small', function () { edit(c); }),
          button(QL.t('ui.btn.delete'), 'btn btn-danger btn-small', function () {
            if (!window.confirm(QL.t('ui.ctr.delete.confirm', c.name))) { return; }
            guard(admin('/counters/' + c.id, 'DELETE'), QL.t('ui.ctr.deleted', c.name)).then(function () {
              if (editingId === c.id) { resetForm(); }
              refreshAll(true);
            });
          })));
    }

    return {
      mount: function (c) {
        name = el('input', { type: 'text', maxlength: '40' });
        svc = el('select');
        open = el('input', { type: 'checkbox', checked: true });
        err = el('p', { class: 'form-error', role: 'alert', hidden: true });
        formTitle = el('h2', { style: 'font-size:1.25rem', text: QL.t('ui.ctr.add.h') });
        saveBtn = el('button', { class: 'btn btn-primary', type: 'submit', text: QL.t('ui.ctr.add') });
        cancelBtn = button(QL.t('ui.btn.cancel'), 'btn', function () { resetForm(); });
        cancelBtn.hidden = true;
        listBox = el('div', { class: 'item-list' });

        var form = el('form', { novalidate: true },
          field(QL.t('ui.ctr.name'), name, QL.t('ui.ctr.name.hint')),
          field(QL.t('ui.ctr.service'), svc),
          el('div', { class: 'field' }, el('label', { class: 'inline-check' }, open, QL.t('ui.ctr.isopen'))),
          err, el('div', { class: 'btn-row' }, saveBtn, cancelBtn));
        form.addEventListener('submit', function (e) {
          e.preventDefault();
          err.hidden = true;
          if (!name.value.trim()) { err.textContent = QL.t('ui.ctr.err.name'); err.hidden = false; return; }
          if (!svc.value) { err.textContent = QL.t('ui.ctr.err.service'); err.hidden = false; return; }
          var body = { name: name.value.trim(), serviceId: Number(svc.value), open: open.checked };
          var wasEditing = editingId !== null;
          var req = wasEditing ? admin('/counters/' + editingId, 'PUT', body) : admin('/counters', 'POST', body);
          guard(req, QL.t(wasEditing ? 'ui.ctr.updated' : 'ui.ctr.added')).then(function (r) {
            if (r) { resetForm(); refreshAll(true); }
          });
        });

        c.appendChild(el('div', { class: 'split' },
          el('div', null, el('h2', { style: 'font-size:1.25rem', text: QL.t('ui.ctr.h') }), listBox),
          el('div', { class: 'card' }, formTitle, form)));

        admin('/services').then(function (list) { services = list; fillServices(svc, services, svc.value, true); }).catch(soft);
      },
      refresh: function (force) {
        if (force) { hold.last = ''; }
        return admin('/counters').then(function (list) {
          if (sameJson(hold, list)) { return; }
          clear(listBox);
          if (!list.length) { listBox.appendChild(el('div', { class: 'card empty', text: QL.t('ui.ctr.empty') })); }
          list.forEach(function (c) { listBox.appendChild(item(c)); });
        }).catch(soft);
      }
    };
  }

  /* ---------------------------- services tab ---------------------------- */
  function servicesPanel() {
    var listBox, formTitle, name, code, desc, mins, activeBox, err, saveBtn, cancelBtn;
    var editingId = null, hold = { last: '' };

    function resetForm() {
      editingId = null;
      name.value = ''; code.value = ''; desc.value = ''; mins.value = '5'; activeBox.checked = true; err.hidden = true;
      formTitle.textContent = QL.t('ui.svc.add.h');
      saveBtn.textContent = QL.t('ui.svc.add');
      cancelBtn.hidden = true;
    }

    function edit(s) {
      editingId = s.id;
      name.value = s.name; code.value = s.code; desc.value = s.description || '';
      mins.value = String(s.avgServiceMinutes); activeBox.checked = s.active; err.hidden = true;
      formTitle.textContent = QL.t('ui.ctr.edit.h', s.name);
      saveBtn.textContent = QL.t('ui.btn.save');
      cancelBtn.hidden = false;
      name.focus();
    }

    function item(s) {
      return el('div', { class: 'item' },
        el('div', null,
          el('div', { class: 't' }, QL.svcName(s.code, s.name), ' ', el('span', { class: 'tag', text: s.code })),
          el('div', { class: 'muted small', text: (s.active ? QL.t('ui.svc.active') : QL.t('ui.svc.inactive')) + ' · ' + QL.t('ui.svc.line', '', s.avgServiceMinutes, s.waiting).replace(/^\s*·\s*/, '') })),
        el('div', { class: 'item-actions' },
          button(QL.t('ui.btn.edit'), 'btn btn-small', function () { edit(s); }),
          button(QL.t('ui.btn.delete'), 'btn btn-danger btn-small', function () {
            if (!window.confirm(QL.t('ui.svc.delete.confirm', s.name))) { return; }
            guard(admin('/services/' + s.id, 'DELETE'), QL.t('ui.ctr.deleted', s.name)).then(function () {
              if (editingId === s.id) { resetForm(); }
              refreshAll(true);
            });
          })));
    }

    return {
      mount: function (c) {
        name = el('input', { type: 'text', maxlength: '60' });
        code = el('input', { type: 'text', maxlength: '3', style: 'text-transform:uppercase', autocapitalize: 'characters' });
        desc = el('input', { type: 'text', maxlength: '255' });
        mins = el('input', { type: 'number', min: '1', max: '120', value: '5' });
        activeBox = el('input', { type: 'checkbox', checked: true });
        err = el('p', { class: 'form-error', role: 'alert', hidden: true });
        formTitle = el('h2', { style: 'font-size:1.25rem', text: QL.t('ui.svc.add.h') });
        saveBtn = el('button', { class: 'btn btn-primary', type: 'submit', text: QL.t('ui.svc.add') });
        cancelBtn = button(QL.t('ui.btn.cancel'), 'btn', function () { resetForm(); });
        cancelBtn.hidden = true;
        listBox = el('div', { class: 'item-list' });

        var form = el('form', { novalidate: true },
          field(QL.t('ui.svc.name'), name),
          field(QL.t('ui.svc.code'), code, QL.t('ui.svc.code.hint')),
          field(QL.t('ui.svc.desc'), desc),
          field(QL.t('ui.svc.mins'), mins, QL.t('ui.svc.mins.hint')),
          el('div', { class: 'field' }, el('label', { class: 'inline-check' }, activeBox, QL.t('ui.svc.isactive'))),
          err, el('div', { class: 'btn-row' }, saveBtn, cancelBtn));
        form.addEventListener('submit', function (e) {
          e.preventDefault();
          err.hidden = true;
          if (!name.value.trim()) { err.textContent = QL.t('ui.svc.err.name'); err.hidden = false; return; }
          if (!/^[A-Za-z]{1,3}$/.test(code.value.trim())) { err.textContent = QL.t('ui.svc.err.code'); err.hidden = false; return; }
          var m = Number(mins.value);
          if (!(m >= 1 && m <= 120)) { err.textContent = QL.t('ui.svc.err.mins'); err.hidden = false; return; }
          var body = { name: name.value.trim(), code: code.value.trim().toUpperCase(), description: desc.value.trim(), avgServiceMinutes: Math.round(m), active: activeBox.checked };
          var wasEditing = editingId !== null;
          var req = wasEditing ? admin('/services/' + editingId, 'PUT', body) : admin('/services', 'POST', body);
          guard(req, QL.t(wasEditing ? 'ui.svc.updated' : 'ui.svc.added')).then(function (r) {
            if (r) { resetForm(); refreshAll(true); }
          });
        });

        c.appendChild(el('div', { class: 'split' },
          el('div', null, el('h2', { style: 'font-size:1.25rem', text: QL.t('ui.svc.h') }), listBox),
          el('div', { class: 'card' }, formTitle, form)));
      },
      refresh: function (force) {
        if (force) { hold.last = ''; }
        return admin('/services').then(function (list) {
          if (sameJson(hold, list)) { return; }
          clear(listBox);
          if (!list.length) { listBox.appendChild(el('div', { class: 'card empty', text: QL.t('ui.svc.empty') })); }
          list.forEach(function (s) { listBox.appendChild(item(s)); });
        }).catch(soft);
      }
    };
  }

  /* ---------------------------- WhatsApp tab ---------------------------- */
  function whatsappPanel() {
    var box, hold = { last: '' }, historyBox, enable, threshold, modeLine;

    function eventLabel(e) { return QL.has('ui.wa.event.' + e) ? QL.t('ui.wa.event.' + e) : e; }
    function statusLabel(s) { return QL.has('ui.wa.status.' + s) ? QL.t('ui.wa.status.' + s) : s; }

    function loadSettings() {
      return admin('/settings').then(function (s) {
        enable.checked = s.whatsappEnabled;
        threshold.value = String(s.approachThreshold);
        modeLine.textContent = QL.t('ui.wa.mode') + ': ' + (QL.has('ui.wa.mode.' + s.mode) ? QL.t('ui.wa.mode.' + s.mode) : s.mode);
      }).catch(soft);
    }

    function historyRow(n) {
      var cells = [
        el('td', { text: QL.clock(n.createdAt) }),
        el('td', { class: 'num', text: n.tokenNumber }),
        el('td', { text: eventLabel(n.eventType) }),
        el('td', { text: n.to }),
        el('td', null, el('span', { class: 'tag', text: statusLabel(n.status) }),
          n.attempts > 1 ? el('div', { class: 'muted small', text: QL.t('ui.wa.attempts', n.attempts) }) : null,
          n.error ? el('div', { class: 'form-error small', text: n.error }) : null),
        el('td', null, el('div', { class: 'wa-text', text: n.message }),
          n.status === 'FAILED' ? button(QL.t('ui.wa.retry'), 'btn btn-small', function () {
            guard(admin('/notifications/' + n.id + '/retry', 'POST'), QL.t('ui.wa.retried')).then(function () { refreshAll(true); });
          }) : null)
      ];
      return el('tr', null, cells);
    }

    return {
      mount: function (c) {
        enable = el('input', { type: 'checkbox', id: 'waEnable' });
        threshold = el('select', null, option(3, '3'), option(4, '4'), option(5, '5'));
        modeLine = el('p', { class: 'muted small', style: 'margin:0 0 6px' });
        historyBox = el('div', { class: 'table-wrap' });
        var save = el('button', { class: 'btn btn-primary', type: 'submit', text: QL.t('ui.wa.save') });
        var form = el('form', { novalidate: true },
          el('div', { class: 'field switch-row' }, enable,
            el('div', null, el('label', { for: 'waEnable', text: QL.t('ui.wa.enable') }), el('p', { class: 'hint', text: QL.t('ui.wa.enable.hint') }))),
          field(QL.t('ui.wa.threshold'), threshold, QL.t('ui.wa.threshold.hint')),
          el('div', { class: 'btn-row' }, save,
            el('a', { class: 'btn', href: '/whatsapp-demo.html', target: '_blank', rel: 'noopener', text: QL.t('ui.demo.h1') })));
        form.addEventListener('submit', function (e) {
          e.preventDefault();
          guard(admin('/settings', 'PUT', { whatsappEnabled: enable.checked, approachThreshold: Number(threshold.value) }), QL.t('ui.wa.saved'))
            .then(function () { loadSettings(); });
        });
        c.appendChild(el('div', { class: 'card', style: 'margin-bottom:22px' },
          el('h2', { style: 'font-size:1.25rem', text: QL.t('ui.wa.h') }), modeLine, form));
        c.appendChild(el('h2', { style: 'font-size:1.25rem', text: QL.t('ui.wa.history') }));
        c.appendChild(historyBox);
        loadSettings();
      },
      refresh: function (force) {
        if (force) { hold.last = ''; }
        return admin('/notifications').then(function (list) {
          if (sameJson(hold, list)) { return; }
          clear(historyBox);
          if (!list.length) { historyBox.appendChild(el('div', { class: 'empty', text: QL.t('ui.wa.history.empty') })); return; }
          historyBox.appendChild(el('table', { class: 'data' },
            el('thead', null, el('tr', null, ['time', 'token', 'event', 'to', 'status', 'message'].map(function (k) { return el('th', { text: QL.t('ui.wa.th.' + k) }); }))),
            el('tbody', null, list.map(historyRow))));
        }).catch(soft);
      }
    };
  }

  /* ------------------------------- start ------------------------------- */
  if (QL.adminToken()) { showApp(); } else { showLogin(''); }
});
