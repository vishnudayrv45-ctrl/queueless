QL.ready(function () {
  'use strict';
  var el = QL.el, $ = QL.$;

  QL.chrome('track');

  var input = $('#demoPhone');
  var errorBox = $('#demoError');
  var chat = $('#chat');
  var timer = null;
  var current = '';

  function showError(msg) { errorBox.textContent = msg; errorBox.hidden = !msg; }

  input.addEventListener('input', function () { input.value = input.value.replace(/\D/g, '').slice(0, 10); });

  function render(list) {
    QL.clear(chat);
    $('#phone').hidden = false;
    if (!list.length) {
      chat.appendChild(el('p', { class: 'muted small', style: 'text-align:center', text: QL.t('ui.demo.empty') }));
      return;
    }
    list.forEach(function (m) {
      chat.appendChild(el('div', { class: 'bubble' },
        el('span', { class: 'ev', text: QL.has('ui.wa.event.' + m.eventType) ? QL.t('ui.wa.event.' + m.eventType) : m.eventType }),
        m.message,
        el('span', { class: 'at', text: QL.clock(m.createdAt) })));
    });
    chat.lastChild.scrollIntoView({ block: 'nearest' });
  }

  function load() {
    return QL.api('/demo/whatsapp?phone=' + encodeURIComponent(current)).then(function (list) { showError(''); render(list); })
      .catch(function (err) { showError(err.message); });
  }

  function start(phone) {
    current = phone;
    if (timer) { clearInterval(timer); }
    load();
    timer = setInterval(function () { if (!document.hidden) { load(); } }, 4000);
  }

  $('#demoForm').addEventListener('submit', function (e) {
    e.preventDefault();
    if (!/^\d{10}$/.test(input.value)) { showError(QL.t('ui.demo.err.phone')); return; }
    showError('');
    history.replaceState(null, '', '?phone=' + input.value);
    start(input.value);
  });

  var fromUrl = (new URLSearchParams(location.search).get('phone') || '').replace(/\D/g, '').slice(-10);
  if (fromUrl.length === 10) { input.value = fromUrl; start(fromUrl); }
});
