/* Photon Academy - admin screen "AI providers"
   Shows which free AI providers have keys in Supabase, and tests every key with one tap.
   It only ever sees provider names, how many keys, and the last 4 characters. Keys are never sent to the browser. */
(function () {
  'use strict';
  function el(tag, attrs) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'class') e.className = v; else if (k === 'style') e.style.cssText = v;
      else if (k.indexOf('on') === 0) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v);
    });
    for (var i = 2; i < arguments.length; i++) (function add(c) {
      if (c === null || c === undefined || c === false) return;
      if (Array.isArray(c)) return c.forEach(add);
      e.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
    })(arguments[i]);
    return e;
  }
  var css = el('style'); css.textContent = [
    '.ai-card{border:1px solid rgba(127,127,127,.38);border-radius:14px;padding:18px;background:rgba(127,127,127,.09);max-width:900px}',
    '.ai-card h2{margin:0 0 4px;font-size:18px}.ai-muted{opacity:.75;font-size:13px}',
    '.ai-row{display:flex;gap:12px;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;border:1px solid rgba(127,127,127,.38);border-radius:12px;padding:12px 14px;margin:8px 0;background:rgba(127,127,127,.06)}',
    '.ai-row .t{flex:1 1 260px;min-width:0;overflow-wrap:anywhere}.ai-row b{font-size:15px}',
    '.ai-badge{display:inline-block;border-radius:99px;border:1px solid rgba(127,127,127,.45);padding:1px 10px;font-size:12px;margin-left:6px}',
    '.ai-badge.ok{color:#3ddc97;border-color:#3ddc97}.ai-badge.off{color:#f5b942;border-color:#f5b942}.ai-badge.bad{color:#ff7b7b;border-color:#ff7b7b}',
    '.ai-code{font-family:ui-monospace,Menlo,monospace;font-size:12.5px;background:rgba(127,127,127,.18);border-radius:6px;padding:1px 6px}',
    '.ai-btn{border:1px solid rgba(127,127,127,.5);background:transparent;color:inherit;border-radius:10px;padding:8px 14px;font:inherit;font-size:13.5px;cursor:pointer}',
    '.ai-btn.pri{background:#4fd6e8;border-color:#4fd6e8;color:#06202a;font-weight:600}.ai-btn:disabled{opacity:.5;cursor:not-allowed}',
    '.ai-msg{min-height:20px;margin-top:8px;font-size:13.5px}'
  ].join('\n'); document.head.appendChild(css);

  async function ask(action) {
    var sb = window.photonSupabase;
    if (!sb) throw new Error('Not signed in.');
    var r = await sb.functions.invoke('ai-chat', { body: { action: action } });
    if (r.error) throw new Error('Could not reach the AI service. Make sure you are signed in as admin.');
    if (r.data && r.data.error) throw new Error(r.data.error);
    return r.data;
  }

  window.photonAdminAI = function (view) {
    while (view.firstChild) view.removeChild(view.firstChild);
    var card = el('div', { class: 'ai-card' }, el('h2', {}, 'AI providers'), el('div', { class: 'ai-muted' }, 'Loading\u2026'));
    view.appendChild(card);
    ask('ai_status').then(function (d) {
      var on = d.providers.filter(function (p) { return p.keys > 0; });
      while (card.firstChild) card.removeChild(card.firstChild);
      card.appendChild(el('h2', {}, 'AI providers'));
      card.appendChild(el('div', { class: 'ai-muted' }, 'The assistant rotates through every provider that has a key, and skips any that is busy or out of free quota. ' +
        'Mode: ' + d.mode + (d.mode === 'balanced' ? ' (spreads questions across all keys).' : ' (uses them in order, only moving on when one fails).')));
      card.appendChild(el('p', { style: 'margin:12px 0' }, el('b', {}, on.length + ' of ' + d.providers.filter(function (p) { return p.id.indexOf('custom') !== 0; }).length + ' main providers connected'),
        ' \u00B7 ' + on.reduce(function (n, p) { return n + p.keys; }, 0) + ' keys in total'));
      d.providers.forEach(function (p) {
        var custom = p.id.indexOf('custom') === 0;
        if (custom && !p.keys) return; // hide unused optional slots
        card.appendChild(el('div', { class: 'ai-row' },
          el('div', { class: 't' }, el('b', {}, p.label), el('span', { class: 'ai-badge ' + (p.keys ? 'ok' : 'off') }, p.keys ? p.keys + ' key' + (p.keys === 1 ? '' : 's') + ' connected' : 'not added'),
            p.restingSeconds > 0 ? el('span', { class: 'ai-badge bad' }, 'resting ' + p.restingSeconds + 's') : null,
            el('div', { class: 'ai-muted' }, 'Model: ' + (p.models.main || '\u2014') + (p.models.vision ? ' \u00B7 reads photos' : '')),
            p.keys ? null : el('div', { class: 'ai-muted', style: 'margin-top:4px' }, 'Secret name: ', el('span', { class: 'ai-code' }, [p.secret].concat(p.extraSecrets).join(' + ')), ' \u00B7 get a key at ' + p.signup))));
      });
      var out = el('div', { class: 'ai-msg' }), list = el('div');
      var btn = el('button', { type: 'button', class: 'ai-btn pri', onclick: async function () {
        btn.disabled = true; out.textContent = 'Testing every key\u2026 this takes a few seconds.'; while (list.firstChild) list.removeChild(list.firstChild);
        try {
          var t = await ask('ai_test'), good = 0;
          t.results.sort(function (a, b) { return a.provider < b.provider ? -1 : 1; }).forEach(function (r) {
            if (r.ok) good++;
            list.appendChild(el('div', { class: 'ai-row' }, el('div', { class: 't' },
              el('b', {}, r.label + ' \u00B7 key ' + r.key), el('span', { class: 'ai-code', style: 'margin-left:8px' }, r.keyHint),
              el('span', { class: 'ai-badge ' + (r.ok ? 'ok' : 'bad') }, r.ok ? 'works \u00B7 ' + r.ms + ' ms' : 'failed'),
              r.ok ? null : el('div', { class: 'ai-muted' }, (r.status ? 'Error ' + r.status + ': ' : '') + (r.error || 'no answer') + ' (model ' + r.model + ')'))));
          });
          out.textContent = good + ' of ' + t.results.length + ' keys work.' + (good < t.results.length ? ' For a failed key, check the secret value, or set <PROVIDER>_MODEL to a model that exists on your account.' : '');
        } catch (e) { out.textContent = e.message; }
        btn.disabled = false;
      } }, 'Test all keys');
      card.appendChild(el('div', { style: 'margin-top:14px' }, btn)); card.appendChild(out); card.appendChild(list);
      card.appendChild(el('p', { class: 'ai-muted', style: 'margin-top:16px' }, 'Add or change keys in Supabase \u2192 Edge Functions \u2192 Secrets, then press Test. Several keys for one provider go in the same secret, separated by commas. ' +
        'Student questions are sent to these providers, so check each provider\u2019s data terms before relying on its free tier.'));
    }).catch(function (e) { while (card.firstChild) card.removeChild(card.firstChild); card.appendChild(el('h2', {}, 'AI providers')); card.appendChild(el('div', { class: 'ai-muted' }, e.message)); });
  };
})();
