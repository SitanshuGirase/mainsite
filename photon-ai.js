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
    '.ai-msg{min-height:20px;margin-top:8px;font-size:13.5px}',
    '.au-card{margin-bottom:16px}.au-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}',
    '.au-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:12px 0}',
    '.au-tile{border:1.5px solid var(--line,rgba(127,127,127,.6));border-radius:12px;padding:10px 14px}.au-tile b{display:block;font-size:28px;line-height:1.15;font-family:var(--ph-head,Georgia,serif)}.au-tile span{display:block;font-size:13.5px}.au-tile small{display:block;opacity:.75;font-size:12.5px;margin-top:2px}',
    '.au-chart{display:flex;align-items:flex-end;gap:4px;overflow-x:auto;padding:22px 18px 4px 2px;border-bottom:1.5px solid var(--line,rgba(127,127,127,.6));min-height:150px;max-width:100%}',
    '.au-col{flex:1 0 20px;min-width:20px;display:flex;flex-direction:column;align-items:center;justify-content:flex-end}',
    '.au-stack{width:100%;max-width:34px;display:flex;flex-direction:column;border:1px solid rgba(127,127,127,.9);border-radius:4px 4px 0 0;overflow:hidden;box-sizing:border-box}.au-stack.au-zero{border:0}',
    '.au-ok{background:#4fd6e8}.au-bad{background:#ff7b7b}.au-n{font-size:11px;margin-bottom:2px}.au-d{font-size:11px;opacity:.8;margin-top:4px;white-space:nowrap;height:14px}',
    '.au-leg{display:flex;gap:16px;flex-wrap:wrap;font-size:13px;margin:10px 0}.au-leg i{display:inline-block;width:12px;height:12px;border:1px solid rgba(127,127,127,.9);border-radius:3px;margin-right:6px;vertical-align:-2px}',
    '.au-tbl{border-collapse:collapse;width:100%;font-size:13.5px;margin-top:8px}.au-tbl th,.au-tbl td{text-align:left;padding:6px 10px;border-bottom:1px solid rgba(127,127,127,.35)}.au-wrap{overflow-x:auto;max-width:100%}'
  ].join('\n'); document.head.appendChild(css);
 
  var IST = 5.5 * 3600000, MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function istDay(back) { return new Date(Date.now() + IST - back * 86400000).toISOString().slice(0, 10); }
  function dayLabel(s) { var p = String(s).split('-'); return Number(p[2]) + ' ' + MON[Number(p[1]) - 1]; }
  function hr(x) { return (x % 12 || 12) + ' ' + (x >= 12 && x < 24 ? 'pm' : 'am'); }
  function pctOf(a, b) { return b ? Math.round(a * 100 / b) + '%' : '0%'; }
  function tile(n, label, sub) { return el('div', { class: 'au-tile' }, el('b', {}, n), el('span', {}, label), sub ? el('small', {}, sub) : null); }
  function usageCard() {
    var days = 30, card = el('div', { class: 'ai-card au-card' }), body = el('div', {}), tabs = el('div', { class: 'au-tabs' });
    [7, 30, 90].forEach(function (n) {
      var b = el('button', { type: 'button', 'data-n': String(n), class: 'ai-btn' + (n === days ? ' pri' : ''), onclick: function () {
        days = n; [].forEach.call(tabs.children, function (x) { x.className = 'ai-btn' + (Number(x.getAttribute('data-n')) === days ? ' pri' : ''); }); load();
      } }, 'Last ' + n + ' days');
      tabs.appendChild(b);
    });
    card.appendChild(el('h2', {}, 'AI usage'));
    card.appendChild(el('div', { class: 'ai-muted' }, 'How many questions students and visitors asked the AI assistant. Times are India time. What people asked is never stored.'));
    card.appendChild(tabs); card.appendChild(body);
    async function load() {
      while (body.firstChild) body.removeChild(body.firstChild);
      body.appendChild(el('div', { class: 'ai-muted' }, 'Loading\u2026'));
      var r;
      try { r = await window.photonSupabase.rpc('admin_ai_usage', { p_days: days }); } catch (e) { r = { error: e }; }
      while (body.firstChild) body.removeChild(body.firstChild);
      if (r.error || !r.data) { body.appendChild(el('div', { class: 'ai-muted' }, 'Could not load the usage numbers. Make sure you are signed in as an admin.')); return; }
      var d = r.data, total = d.total || 0, blocked = d.blocked || 0;
      if (!total) { body.appendChild(el('div', { class: 'ai-muted', style: 'margin:12px 0' }, 'No questions have been recorded in this period yet. Counting started on 14 Nov 2026, so earlier questions are not included.')); }
      else {
        body.appendChild(el('div', { class: 'au-tiles' },
          tile(total, 'Questions asked', 'in the last ' + days + ' days'),
          tile(d.last_24h || 0, 'Last 24 hours'),
          tile(blocked, 'Blocked by the rate limit', pctOf(blocked, total) + ' of all questions'),
          tile(d.users || 0, 'From signed-in users', pctOf(d.users || 0, total)),
          tile(d.visitors || 0, 'From website visitors', pctOf(d.visitors || 0, total))));
        var byDay = {}, max = 1; (d.daily || []).forEach(function (x) { byDay[x.day] = x; if (x.total > max) max = x.total; });
        var chart = el('div', { class: 'au-chart', role: 'img', 'aria-label': 'Questions per day' });
        for (var i = days - 1; i >= 0; i--) {
          var key = istDay(i), x = byDay[key] || { total: 0, blocked: 0 }, h = x.total ? Math.max(4, Math.round(x.total * 110 / max)) : 0, hb = x.blocked ? Math.max(3, Math.round(x.blocked * 110 / max)) : 0;
          var showLbl = days <= 14 || i % 5 === 0 || i === 0;
          chart.appendChild(el('div', { class: 'au-col', title: dayLabel(key) + ': ' + x.total + ' question' + (x.total === 1 ? '' : 's') + (x.blocked ? ', ' + x.blocked + ' blocked' : '') },
            el('span', { class: 'au-n' }, x.total || ''),
            el('div', { class: 'au-stack' + (x.total ? '' : ' au-zero'), style: 'height:' + h + 'px' }, hb ? el('div', { class: 'au-bad', style: 'height:' + hb + 'px' }) : null, el('div', { class: 'au-ok', style: 'flex:1' })),
            el('span', { class: 'au-d' }, showLbl ? dayLabel(key) : '')));
        }
        body.appendChild(el('div', { class: 'au-wrap' }, chart));
        body.appendChild(el('div', { class: 'au-leg' }, el('span', {}, el('i', { class: 'au-ok' }), 'Answered'), el('span', {}, el('i', { class: 'au-bad' }), 'Blocked (someone asked too many questions in one minute)')));
        if (d.busiest_hour) body.appendChild(el('p', { style: 'margin:6px 0' }, el('b', {}, 'Busiest time of day: '), hr(d.busiest_hour.hour) + ' to ' + hr((d.busiest_hour.hour + 1) % 24) + ' (' + d.busiest_hour.count + ' questions in this period).'));
        var rows = (d.daily || []).slice().reverse();
        body.appendChild(el('details', { class: 'ai-muted', style: 'margin-top:8px' }, el('summary', {}, 'Show the numbers as a table'),
          el('div', { class: 'au-wrap' }, el('table', { class: 'au-tbl' }, el('thead', {}, el('tr', {}, ['Day', 'Questions', 'Signed-in', 'Visitors', 'Blocked'].map(function (h) { return el('th', {}, h); }))),
            el('tbody', {}, rows.map(function (x) { return el('tr', {}, [dayLabel(x.day), x.total, x.users, x.visitors, x.blocked].map(function (c) { return el('td', {}, c); })); }))))));
      }
      body.appendChild(el('p', { class: 'ai-muted', style: 'margin:12px 0 0' }, 'Not tracked yet: which AI provider answered, how many tokens were used, and whether a key is free or paid. Your connected keys are free-tier today. Provider, token and cost tracking for a paid key is the planned next step.'));
    }
    load(); return card;
  }

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
    view.appendChild(usageCard());
    view.appendChild(card);
    ask('ai_status').then(function (d) {
      var on = d.providers.filter(function (p) { return p.keys > 0; });
      while (card.firstChild) card.removeChild(card.firstChild);
      card.appendChild(el('h2', {}, 'AI providers'));
      card.appendChild(el('div', { class: 'ai-muted' }, 'The assistant rotates through every provider that has a key, and skips any that is busy or out of free quota. ' +
        'Mode: ' + d.mode + (d.mode === 'balanced' ? ' (spreads questions across all keys).' : ' (uses them in order, only moving on when one fails).')));
      card.appendChild(el('p', { style: 'margin:12px 0' }, el('b', {}, on.length + ' of ' + d.providers.filter(function (p) { return p.id.indexOf('custom') !== 0; }).length + ' main providers connected'),
        ' \u00B7 ' + on.reduce(function (n, p) { return n + p.keys; }, 0) + ' keys in total'));
      card.appendChild(el('p', { class: 'ai-muted', style: 'margin:0 0 8px' }, 'Web search (Tavily): ' + (d.tavilyKeys ? d.tavilyKeys + ' key' + (d.tavilyKeys === 1 ? '' : 's') + ' connected \u00B7 ' + d.tavilyDepth + ' depth. One Tavily key serves every AI provider; extra keys (comma-separated in TAVILY_API_KEY) rotate when one runs out of monthly credits.' : 'not connected (secret TAVILY_API_KEY). The assistant works, but cannot look things up live.')));
      d.providers.forEach(function (p) {
        var custom = p.id.indexOf('custom') === 0;
        if (custom && !p.keys) return; // hide unused optional slots
        card.appendChild(el('div', { class: 'ai-row' },
          el('div', { class: 't' }, el('b', {}, p.label), el('span', { class: 'ai-badge ' + (p.keys ? 'ok' : 'off') }, p.keys ? p.keys + ' key' + (p.keys === 1 ? '' : 's') + ' connected' : 'not added'),
            p.restingSeconds > 0 ? el('span', { class: 'ai-badge bad' }, 'resting ' + p.restingSeconds + 's') : null,
            p.trains ? el('span', { class: 'ai-badge off', title: 'The free tier of this provider may use prompts to improve its products' }, 'free tier may train on prompts \u00B7 not used for student chats') : null,
            p.excluded ? el('span', { class: 'ai-badge bad' }, 'switched off (AI_EXCLUDE)') : null,
            el('div', { class: 'ai-muted' }, 'Model: ' + (p.models.main || '\u2014') + (p.models.vision ? ' \u00B7 reads photos' : '')),
            p.keys ? null : el('div', { class: 'ai-muted', style: 'margin-top:4px' }, 'Secret name: ', el('span', { class: 'ai-code' }, [p.secret].concat(p.extraSecrets).join(' + ')), ' \u00B7 get a key at ' + p.signup))));
      });
      var out = el('div', { class: 'ai-msg' }), list = el('div');
      var btn = el('button', { type: 'button', class: 'ai-btn pri', onclick: async function () {
        btn.disabled = true; out.textContent = 'Testing every key\u2026 this takes a few seconds.'; while (list.firstChild) list.removeChild(list.firstChild);
        try {
          var t = await ask('ai_test'), good = 0;
          var busyN = 0;
          t.results.sort(function (a, b) { return a.provider < b.provider ? -1 : 1; }).forEach(function (r) {
            if (r.ok) good++; else if (r.busy) busyN++;
            list.appendChild(el('div', { class: 'ai-row' }, el('div', { class: 't' },
              el('b', {}, r.label + ' \u00B7 key ' + r.key), el('span', { class: 'ai-code', style: 'margin-left:8px' }, r.keyHint),
              el('span', { class: 'ai-badge ' + (r.ok ? 'ok' : r.busy ? 'off' : 'bad') }, r.ok ? 'works \u00B7 ' + r.ms + ' ms' : r.busy ? 'key OK \u00B7 busy right now' : 'failed'),
              r.healed ? el('span', { class: 'ai-badge ok' }, 'old model retired \u2192 switched automatically') : null,
              el('div', { class: 'ai-muted' }, 'Model: ' + r.model),
              r.ok ? null : el('div', { class: 'ai-muted' }, (r.hint ? r.hint + ' ' : '') + (r.status ? '(error ' + r.status + ')' : '')),
              r.ok || !r.error ? null : el('details', { class: 'ai-muted' }, el('summary', {}, 'Technical detail'), el('div', { style: 'overflow-wrap:anywhere' }, r.error)))));
          });
          var bad = t.results.length - good - busyN;
          out.textContent = good + ' of ' + t.results.length + ' keys work' + (busyN ? ', ' + busyN + ' valid but busy (free limit used up for now)' : '') + (bad ? ', ' + bad + ' need attention.' : '.');
        } catch (e) { out.textContent = e.message; }
        btn.disabled = false;
      } }, 'Test all keys');
      card.appendChild(el('div', { style: 'margin-top:14px' }, btn)); card.appendChild(out); card.appendChild(list);
      card.appendChild(el('p', { class: 'ai-muted', style: 'margin-top:16px' }, 'Add or change keys in Supabase \u2192 Edge Functions \u2192 Secrets, then press Test. Several keys for one provider go in the same secret, separated by commas. ' +
        'Student questions are sent to these providers, so check each provider\u2019s data terms before relying on its free tier.'));
    }).catch(function (e) { while (card.firstChild) card.removeChild(card.firstChild); card.appendChild(el('h2', {}, 'AI providers')); card.appendChild(el('div', { class: 'ai-muted' }, e.message)); });
  };
})();
 