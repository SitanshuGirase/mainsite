/* ===================================================================
   Photon Academy - Admin screen "AI knowledge"
   The assistant has no separate knowledge file: it answers questions about the academy from the text of the
   website page the visitor is on. So its knowledge is your website content. This screen shows which content
   it reads, when each part last changed, warns when nothing has changed for a long time, and lets an admin
   clear the answers the assistant has remembered. It never shows or edits secrets.
   =================================================================== */
(function () {
  'use strict';
  var STALE_DAYS = 30, OLD_DAYS = 60, TRACKED_FROM = '15 Nov 2026';
  function sb() { return window.photonSupabase; }
  function el(tag, attrs) {
    var e = document.createElement(tag); attrs = attrs || {};
    Object.keys(attrs).forEach(function (k) { var v = attrs[k]; if (v === null || v === undefined || v === false) return; if (k === 'class') e.className = v; else if (k === 'style') e.style.cssText = v; else if (k.indexOf('on') === 0) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v); });
    for (var i = 2; i < arguments.length; i++) add(e, arguments[i]); return e;
  }
  function add(p, c) { if (c === null || c === undefined || c === false) return; if (Array.isArray(c)) { c.forEach(function (x) { add(p, x); }); return; } p.appendChild(c.nodeType ? c : document.createTextNode(String(c))); }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); return n; }
  var css = el('style'); css.textContent = [
    '.ak-card{border:var(--ph-w,1.5px) solid var(--line,rgba(127,127,127,.6));border-radius:14px;padding:20px;background:rgba(127,127,127,.09);max-width:980px;margin-bottom:16px}',
    '.ak-card h2{margin:0 0 4px;font-size:20px}.ak-muted{opacity:.78;font-size:13.5px}.ak-card p{margin:8px 0}',
    '.ak-btn{border:1px solid var(--line,rgba(127,127,127,.6));background:transparent;color:inherit;border-radius:10px;padding:8px 14px;font:inherit;font-size:13.5px;cursor:pointer}.ak-btn.bad{border-color:#ff7b7b;color:#ff7b7b}.ak-btn:disabled{opacity:.5;cursor:not-allowed}',
    '.ak-banner{border:1.5px solid rgba(127,127,127,.6);border-radius:12px;padding:12px 14px;margin:12px 0;font-size:14px}.ak-banner.ok{border-color:#3ddc97}.ak-banner.warn{border-color:#f5b942}.ak-banner b{display:block;font-size:15px;margin-bottom:2px}',
    '.ak-wrap{overflow-x:auto;max-width:100%;margin-top:8px}.ak-tbl{border-collapse:collapse;width:100%;font-size:13.5px}.ak-tbl th,.ak-tbl td{text-align:left;padding:7px 10px;border-bottom:1px solid rgba(127,127,127,.35);white-space:nowrap}.ak-tbl th{font-weight:600}.ak-tbl a{color:inherit;text-decoration:underline}',
    '.ak-badge{display:inline-block;border-radius:99px;border:1px solid rgba(127,127,127,.55);padding:1px 10px;font-size:12px;margin-left:6px}.ak-badge.warn{color:#f5b942;border-color:#f5b942}',
    '.ak-msg{min-height:20px;margin-top:8px;font-size:13.5px}.ak-msg.err{color:#ff7b7b}.ak-msg.ok{color:#3ddc97}',
    '.ak-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:12px 0;max-width:980px}.ak-tile{border:1.5px solid var(--line,rgba(127,127,127,.6));border-radius:12px;padding:10px 14px}.ak-tile b{display:block;font-size:26px;line-height:1.15;font-family:var(--ph-head,Georgia,serif)}.ak-tile span{display:block;font-size:13.5px}'
  ].join('\n'); document.head.appendChild(css);

  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function dateOf(s) { if (!s) return null; var d = new Date(s); return isNaN(d.getTime()) ? null : d; }
  function nice(s) { var d = dateOf(s); return d ? d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear() : 'unknown'; }
  function daysAgo(s) { var d = dateOf(s); return d ? Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000)) : null; }
  function agoText(s) { var n = daysAgo(s); if (n === null) return 'unknown'; if (n === 0) return 'today'; if (n === 1) return 'yesterday'; if (n < 60) return n + ' days ago'; return Math.round(n / 30) + ' months ago'; }
  function tile(n, label) { return el('div', { class: 'ak-tile' }, el('b', {}, n), el('span', {}, label)); }

  window.photonAdminAIKnowledge = async function (view) {
    clear(view);
    var head = el('div', { class: 'ak-card' }), body = el('div', {}), msg = el('div', { class: 'ak-msg' }), refresh = el('button', { type: 'button', class: 'ak-btn' }, 'Refresh');
    head.appendChild(el('h2', {}, 'AI knowledge'));
    head.appendChild(el('div', { class: 'ak-muted' }, 'The assistant does not have a separate knowledge file. When someone asks about the academy (fees, teachers, subjects, location, timings), it answers from the text of the website page they are on. So what it knows is exactly your website content, listed below.'));
    head.appendChild(el('div', { style: 'margin-top:12px' }, refresh)); head.appendChild(msg);
    view.appendChild(head); view.appendChild(body);
    function say(t, k) { msg.textContent = t || ''; msg.className = 'ak-msg' + (k ? ' ' + k : ''); }

    async function load() {
      refresh.disabled = true; say('Loading\u2026');
      var r; try { r = await sb().rpc('admin_ai_knowledge'); } catch (e) { r = { error: e }; }
      refresh.disabled = false; clear(body);
      if (r.error || !r.data) { say('Could not load this page. Make sure you are signed in as an admin.', 'err'); return; }
      say('');
      var d = r.data, src = d.sources || [], cache = d.cache || {};
      var newest = null; src.forEach(function (s) { var t = dateOf(s.last_changed); if (t && (!newest || t > newest)) newest = t; });
      var n = newest ? daysAgo(newest.toISOString()) : null, total = src.reduce(function (a, s) { return a + (Number(s.rows) || 0); }, 0);
      var stale = n === null || n > STALE_DAYS;
      body.appendChild(el('div', { class: 'ak-card' },
        el('h2', {}, 'How fresh is it?'),
        el('div', { class: 'ak-banner ' + (stale ? 'warn' : 'ok') },
          el('b', {}, newest ? 'Website content last changed ' + agoText(newest.toISOString()) + ' (' + nice(newest.toISOString()) + ')' : 'No dated content found yet'),
          stale ? 'It has been a while. Check that fees, timings, results and teacher details on the website are still correct, because the assistant repeats whatever the website says.' : 'The assistant is working from recently updated content.'),
        el('div', { class: 'ak-tiles' }, tile(total, 'content items the assistant can read'), tile(src.filter(function (s) { return (Number(s.rows) || 0) > 0; }).length, 'of ' + src.length + ' content areas filled in'))));

      var rows = src.map(function (s) {
        var dn = daysAgo(s.last_changed), old = dn !== null && dn > OLD_DAYS, empty = !(Number(s.rows) > 0);
        return el('tr', {},
          el('td', {}, s.label, empty ? el('span', { class: 'ak-badge warn' }, 'Empty') : (old ? el('span', { class: 'ak-badge' }, 'Not updated for a while') : null)),
          el('td', {}, s.published === null || s.published === undefined ? String(s.rows) : s.published + ' shown of ' + s.rows),
          el('td', {}, s.last_changed ? nice(s.last_changed) + ' (' + agoText(s.last_changed) + ')' : 'no date recorded'),
          el('td', {}, el('a', { href: '#/' + s.screen }, 'Open editor')));
      });
      body.appendChild(el('div', { class: 'ak-card' }, el('h2', {}, 'What the assistant reads'),
        el('div', { class: 'ak-muted' }, 'Only items marked as shown appear on the website, so only those reach the assistant. Edits to existing FAQs, faculty, testimonials, quotes, sections and photos are dated from ' + TRACKED_FROM + '; before that, only newly added items have a date.'),
        el('div', { class: 'ak-wrap' }, el('table', { class: 'ak-tbl' }, el('thead', {}, el('tr', {}, ['Content', 'Items', 'Last added or changed', ''].map(function (h) { return el('th', {}, h); }))), el('tbody', {}, rows)))));

      var clearBtn = el('button', { type: 'button', class: 'ak-btn bad', disabled: !(Number(cache.answers) > 0) }, 'Clear remembered answers');
      clearBtn.addEventListener('click', async function () {
        if (!window.confirm('Delete all ' + cache.answers + ' remembered answers? The assistant will simply work them out again the next time they are asked.')) return;
        clearBtn.disabled = true; say('Clearing\u2026');
        var c; try { c = await sb().rpc('admin_ai_cache_clear'); } catch (e) { c = { error: e }; }
        if (c.error) { say('Could not clear them. Please try again.', 'err'); clearBtn.disabled = false; return; }
        await load(); say('Cleared ' + c.data + ' remembered answer' + (c.data === 1 ? '' : 's') + '.', 'ok');
      });
      body.appendChild(el('div', { class: 'ak-card' }, el('h2', {}, 'Remembered answers'),
        el('div', { class: 'ak-muted' }, 'To save time and free AI quota, the assistant remembers answers to everyday questions that need no live search. An answer is matched to the exact page text it was given, so when you change your website text the old answers stop being used automatically. Clearing is only needed if you want every answer worked out fresh.'),
        el('div', { class: 'ak-tiles' }, tile(cache.answers || 0, 'answers remembered'), tile((cache.kb || 0) + ' KB', 'space used'), tile(cache.oldest ? nice(cache.oldest) : '-', 'oldest answer')),
        clearBtn));

      body.appendChild(el('div', { class: 'ak-card' }, el('h2', {}, 'Keeping it accurate'),
        el('p', {}, 'Change facts on the website itself (Site text, Faculty, FAQ and the other editors). There is nothing extra to update for the assistant.'),
        el('p', {}, 'Keep fees, timings and the contact details in the visible text of the page, because the assistant can only repeat what the page shows.'),
        el('p', { class: 'ak-muted' }, 'This page is read-only apart from the clear button. It never shows or changes the AI keys; manage those under AI providers.')));
    }
    refresh.addEventListener('click', load); await load();
  };
})();
