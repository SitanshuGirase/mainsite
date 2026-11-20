/* ===================================================================
   Photon Academy - Fees lock (PIN keypad, 3x3 pattern or password; no biometrics)
   The real checking happens in the database: every money action refuses to run unless this browser session was
   unlocked in the last 10 minutes (60 at most). This file only draws the lock screens and calls the secure functions.
   Secrets are sent once to the database and are never stored in the page. Nothing is kept in browser storage.
   =================================================================== */
(function () {
  'use strict';
  var KINDS = [['pin', 'PIN', 'Numbers only, 4 to 8 digits. Not the same digit repeated and not a sequence like 1234.'], ['pattern', 'Pattern', 'Connect 4 to 9 dots on the 3 \u00D7 3 grid. Each dot is used once.'], ['password', 'Password', 'At least 8 characters with letters and at least one number or symbol.']];
  function sb() { return window.photonSupabase; }
  function el(tag, attrs) {
    var e = document.createElement(tag); attrs = attrs || {};
    Object.keys(attrs).forEach(function (k) { var v = attrs[k]; if (v === null || v === undefined || v === false) return; if (k === 'class') e.className = v; else if (k === 'style') e.style.cssText = v; else if (k.indexOf('on') === 0) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v); });
    for (var i = 2; i < arguments.length; i++) add(e, arguments[i]); return e;
  }
  function add(p, c) { if (c === null || c === undefined || c === false) return; if (Array.isArray(c)) { c.forEach(function (x) { add(p, x); }); return; } p.appendChild(c.nodeType ? c : document.createTextNode(String(c))); }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); return n; }
  var css = el('style'); css.textContent = [
    '.fl-card{border:var(--ph-w,1.5px) solid var(--line,rgba(127,127,127,.6));border-radius:14px;padding:20px;background:rgba(127,127,127,.09);max-width:560px;margin:0 auto 16px}',
    '.fl-wide{max-width:900px;margin:0 0 16px}.fl-card h2{margin:0 0 4px;font-size:20px}.fl-muted{opacity:.78;font-size:13.5px}.fl-card p{margin:8px 0}',
    '.fl-btn{border:1px solid var(--line,rgba(127,127,127,.6));background:transparent;color:inherit;border-radius:10px;padding:9px 16px;font:inherit;font-size:14px;cursor:pointer}.fl-btn.pri{background:#4fd6e8;border-color:#4fd6e8;color:#06202a;font-weight:600}.fl-btn.bad{border-color:#ff7b7b;color:#ff7b7b}.fl-btn:disabled{opacity:.5;cursor:not-allowed}',
    '.fl-in{box-sizing:border-box;background:transparent;color:inherit;border:1px solid var(--line,rgba(127,127,127,.6));border-radius:10px;padding:10px 12px;font:inherit;font-size:15px;width:100%;max-width:320px}',
    '.fl-msg{min-height:20px;margin-top:10px;font-size:13.5px}.fl-msg.err{color:#ff7b7b}.fl-msg.ok{color:#3ddc97}.fl-acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px;align-items:center}',
    '.fl-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.fl-tab{border:1.5px solid var(--line,rgba(127,127,127,.6));background:transparent;color:inherit;border-radius:10px;padding:8px 16px;font:inherit;font-size:14px;cursor:pointer}.fl-tab.on{background:#4fd6e8;border-color:#4fd6e8;color:#06202a;font-weight:600}',
    '.fl-pad{display:flex;flex-direction:column;align-items:center;gap:12px;margin:14px 0;outline:none}.fl-dots{display:flex;gap:10px;min-height:20px}.fl-dot{width:14px;height:14px;border-radius:50%;border:2px solid currentColor;box-sizing:border-box}.fl-dot.on{background:currentColor}',
    '.fl-keys{display:grid;grid-template-columns:repeat(3,74px);gap:10px}.fl-key{height:58px;border-radius:14px;border:1.5px solid var(--line,rgba(127,127,127,.6));background:transparent;color:inherit;font:inherit;font-size:22px;cursor:pointer}.fl-key:active{background:rgba(127,127,127,.3)}.fl-key.sm{font-size:14px}',
    '.fl-pat{width:240px;height:240px;max-width:100%;touch-action:none;border:1.5px solid var(--line,rgba(127,127,127,.6));border-radius:16px;color:inherit;user-select:none}.fl-pat line{stroke:#4fd6e8;stroke-width:5;stroke-linecap:round}',
    '.fl-bar{display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap;border:1.5px solid #3ddc97;border-radius:12px;padding:8px 14px;margin:0 0 14px;max-width:900px;font-size:13.5px}',
    '.fl-wrap{overflow-x:auto;max-width:100%;margin-top:8px}.fl-tbl{border-collapse:collapse;width:100%;font-size:13.5px}.fl-tbl th,.fl-tbl td{text-align:left;padding:6px 10px;border-bottom:1px solid rgba(127,127,127,.35);white-space:nowrap}',
    '.fl-badge{display:inline-block;border-radius:99px;border:1px solid rgba(127,127,127,.55);padding:1px 10px;font-size:12px;margin-left:6px}.fl-badge.ok{color:#3ddc97;border-color:#3ddc97}.fl-badge.warn{color:#f5b942;border-color:#f5b942}'
  ].join('\n'); document.head.appendChild(css);

  var SHOW = /PIN|pattern|password|Do not use|Use letters|dot|current lock|Too many|Only an|Unlock Fees|Set up|Another owner|Person not found|Choose a/i;
  function why(e) { var m = (e && e.message) || ''; return SHOW.test(m) ? m : 'Something went wrong. Please try again.'; }
  function kindName(k) { var f = KINDS.filter(function (x) { return x[0] === k; })[0]; return f ? f[1] : 'lock'; }
  function when(s) { if (!s) return ''; try { return new Date(s).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } }

  // ------------------------------------------------------------ the three kinds of pad
  function buildPad(kind, onEnter) {
    var api = { node: null, get: function () { return ''; }, reset: function () { }, focus: function () { } };
    if (kind === 'pin') {
      var val = '', dots = el('div', { class: 'fl-dots' }), keys = el('div', { class: 'fl-keys' });
      var node = el('div', { class: 'fl-pad', tabindex: '0', 'aria-label': 'PIN keypad' }, dots, keys);
      var draw = function () { clear(dots); for (var i = 0; i < Math.max(4, val.length); i++) dots.appendChild(el('span', { class: 'fl-dot' + (i < val.length ? ' on' : '') })); };
      var press = function (k) { if (k === 'C') val = ''; else if (k === 'D') val = val.slice(0, -1); else if (val.length < 8) val += k; draw(); };
      ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'D'].forEach(function (k) { keys.appendChild(el('button', { type: 'button', class: 'fl-key' + (k === 'C' || k === 'D' ? ' sm' : ''), 'aria-label': k === 'C' ? 'Clear' : k === 'D' ? 'Delete' : 'Digit ' + k, onclick: function () { press(k); } }, k === 'C' ? 'Clear' : k === 'D' ? 'Del' : k)); });
      node.addEventListener('keydown', function (e) { if (/^[0-9]$/.test(e.key)) press(e.key); else if (e.key === 'Backspace') press('D'); else if (e.key === 'Enter' && onEnter) onEnter(); else return; e.preventDefault(); });
      draw(); api.node = node; api.get = function () { return val; }; api.reset = function () { val = ''; draw(); }; api.focus = function () { node.focus(); };
    } else if (kind === 'pattern') {
      var NS = 'http://www.w3.org/2000/svg', seq = [], drawing = false;
      var svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', '0 0 200 200'); svg.setAttribute('class', 'fl-pat'); svg.setAttribute('tabindex', '0'); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', 'Pattern grid. Press the digits 1 to 9 to choose dots with the keyboard.');
      var lines = document.createElementNS(NS, 'g'), circles = [];
      svg.appendChild(lines);
      var pos = function (i) { return [40 + (i % 3) * 60, 40 + Math.floor(i / 3) * 60]; };
      for (var i = 0; i < 9; i++) { var c = document.createElementNS(NS, 'circle'); c.setAttribute('cx', pos(i)[0]); c.setAttribute('cy', pos(i)[1]); c.setAttribute('r', '9'); c.setAttribute('fill', 'currentColor'); c.setAttribute('opacity', '.55'); svg.appendChild(c); circles.push(c); }
      var redraw = function () {
        clear(lines);
        for (var k = 1; k < seq.length; k++) { var l = document.createElementNS(NS, 'line'), a = pos(seq[k - 1]), b = pos(seq[k]); l.setAttribute('x1', a[0]); l.setAttribute('y1', a[1]); l.setAttribute('x2', b[0]); l.setAttribute('y2', b[1]); lines.appendChild(l); }
        circles.forEach(function (c, i) { var on = seq.indexOf(i) >= 0; c.setAttribute('r', on ? '13' : '9'); c.setAttribute('opacity', on ? '1' : '.55'); c.setAttribute('fill', on ? '#4fd6e8' : 'currentColor'); });
      };
      var addDot = function (i) { if (i >= 0 && seq.indexOf(i) < 0) { seq.push(i); redraw(); } };
      var at = function (ev) { var r = svg.getBoundingClientRect(), x = (ev.clientX - r.left) / r.width * 200, y = (ev.clientY - r.top) / r.height * 200; for (var i = 0; i < 9; i++) { var p = pos(i); if (Math.hypot(x - p[0], y - p[1]) < 24) return i; } return -1; };
      svg.addEventListener('pointerdown', function (ev) { var i = at(ev); if (i < 0) return; drawing = true; try { svg.setPointerCapture(ev.pointerId); } catch (e) { } addDot(i); ev.preventDefault(); });
      svg.addEventListener('pointermove', function (ev) { if (drawing) addDot(at(ev)); });
      ['pointerup', 'pointercancel'].forEach(function (t) { svg.addEventListener(t, function () { drawing = false; }); });
      svg.addEventListener('keydown', function (e) { if (/^[1-9]$/.test(e.key)) addDot(Number(e.key) - 1); else if (e.key === 'Backspace') { seq.pop(); redraw(); } else if (e.key === 'Enter' && onEnter) onEnter(); else return; e.preventDefault(); });
      var holder = el('div', { class: 'fl-pad' }, svg, el('button', { type: 'button', class: 'fl-btn', onclick: function () { seq = []; redraw(); } }, 'Clear pattern'));
      api.node = holder; api.get = function () { return seq.join('-'); }; api.reset = function () { seq = []; redraw(); }; api.focus = function () { svg.focus(); };
    } else {
      var inp = el('input', { class: 'fl-in', type: 'password', autocomplete: 'off', 'aria-label': 'Password', maxlength: '64' }), shown = false;
      var tg = el('button', { type: 'button', class: 'fl-btn', onclick: function () { shown = !shown; inp.type = shown ? 'text' : 'password'; tg.textContent = shown ? 'Hide' : 'Show'; } }, 'Show');
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter' && onEnter) onEnter(); });
      api.node = el('div', { class: 'fl-pad' }, inp, tg); api.get = function () { return inp.value; }; api.reset = function () { inp.value = ''; }; api.focus = function () { inp.focus(); };
    }
    return api;
  }
  // shows one pad in `stage` and resolves with what was entered when the button is pressed
  function ask(stage, kind, label, btn, note, errText) {
    return new Promise(function (resolve) {
      var msg = el('div', { class: 'fl-msg' + (errText ? ' err' : '') }, errText || ''), pad = buildPad(kind, go), b = el('button', { type: 'button', class: 'fl-btn pri', onclick: go }, btn);
      function go() { var v = pad.get(); if (!v) { msg.textContent = 'Enter it first.'; msg.className = 'fl-msg err'; return; } resolve(v); }
      clear(stage); stage.appendChild(el('div', {}, el('b', {}, label), note ? el('div', { class: 'fl-muted' }, note) : null, pad.node, el('div', { class: 'fl-acts', style: 'justify-content:center' }, b), msg));
      setTimeout(function () { pad.focus(); }, 30);
    });
  }

  // ------------------------------------------------------------ set up or change a lock
  function setupCard(status, done, changing) {
    var card = el('div', { class: 'fl-card' }), stage = el('div', {}), kind = (status && status.kind) || 'pin';
    card.appendChild(el('h2', {}, changing ? 'Change your Fees lock' : 'Set up your Fees lock'));
    card.appendChild(el('div', { class: 'fl-muted' }, 'This lock protects money actions: recording payments, reducing fees, editing fees and the UPI payment settings. It re-locks after 10 idle minutes. Choose one you will remember. There is no biometric option, so it can never lock you out because of a face or fingerprint change.'));
    function start() {
      clear(stage); var tabs = el('div', { class: 'fl-tabs' }), note = el('div', { class: 'fl-muted' });
      function pick(k) { kind = k; [].forEach.call(tabs.children, function (t) { t.className = 'fl-tab' + (t.getAttribute('data-k') === k ? ' on' : ''); }); note.textContent = KINDS.filter(function (x) { return x[0] === k; })[0][2]; }
      KINDS.forEach(function (k) { var t = el('button', { type: 'button', class: 'fl-tab', 'data-k': k[0], onclick: function () { pick(k[0]); } }, k[1]); tabs.appendChild(t); });
      stage.appendChild(el('div', {}, el('b', {}, 'Choose the type of lock'), tabs, note, el('div', { class: 'fl-acts' }, el('button', { type: 'button', class: 'fl-btn pri', onclick: run }, 'Continue'))));
      pick(kind);
    }
    async function run() {
      var cur = '', err = el('div', { class: 'fl-msg err' });
      if (changing) cur = await ask(stage, status.kind, 'Enter your current ' + kindName(status.kind), 'Continue');
      var s1 = await ask(stage, kind, 'Choose your new ' + kindName(kind), 'Continue', KINDS.filter(function (x) { return x[0] === kind; })[0][2]);
      var s2 = await ask(stage, kind, 'Enter it again to confirm', 'Save lock');
      if (s1 !== s2) { start(); stage.appendChild(el('div', { class: 'fl-msg err' }, 'The two entries did not match. Please try again.')); return; }
      clear(stage); stage.appendChild(el('div', { class: 'fl-muted' }, 'Saving\u2026'));
      var r; try { r = await sb().rpc('fee_lock_set', { p_kind: kind, p_secret: s1, p_current: changing ? cur : null }); } catch (e) { r = { error: e }; }
      if (r.error) { start(); stage.appendChild(el('div', { class: 'fl-msg err' }, why(r.error))); return; }
      if (!r.data || !r.data.ok) { start(); stage.appendChild(el('div', { class: 'fl-msg err' }, (r.data && r.data.error) || 'Could not save.')); return; }
      done(kind);
    }
    card.appendChild(stage); start(); return card;
  }

  // ------------------------------------------------------------ unlock screen
  function unlockCard(status, done) {
    var card = el('div', { class: 'fl-card' }), stage = el('div', {}), kind = status.kind;
    card.appendChild(el('h2', {}, 'Fees are locked'));
    card.appendChild(el('div', { class: 'fl-muted' }, 'Enter your ' + kindName(kind) + ' to open the Fees section on this device. It re-locks after 10 idle minutes.'));
    card.appendChild(stage);
    var note = el('div', { class: 'fl-muted', style: 'margin-top:12px' }, 'Forgot it? Another owner can reset it in Fees \u2192 Fees lock, or ask the developer.');
    async function loop(prev) {
      if (status.locked_for) { clear(stage).appendChild(el('div', { class: 'fl-msg err' }, 'Too many wrong tries. Try again in about ' + Math.ceil(status.locked_for / 60) + ' minutes.')); return; }
      var s = await ask(stage, kind, 'Enter your ' + kindName(kind), 'Unlock', null, prev);
      var r; try { r = await sb().rpc('fee_lock_unlock', { p_secret: s }); } catch (e) { r = { error: e }; }
      if (r.error) { await loop(why(r.error)); return; }
      var d = r.data || {};
      if (d.ok) { done(); return; }
      if (d.locked_for) { status.locked_for = d.locked_for; clear(stage).appendChild(el('div', { class: 'fl-msg err' }, 'Too many wrong tries. Try again in about ' + Math.ceil(d.locked_for / 60) + ' minutes.')); return; }
      await loop('That was not correct.' + (d.attempts_left ? ' ' + d.attempts_left + ' ' + (d.attempts_left === 1 ? 'try' : 'tries') + ' left before a 15 minute lock.' : ''));
    }
    loop(); card.appendChild(note); return card;
  }

  // ------------------------------------------------------------ the gate in front of every Fees screen
  var timer = null;
  window.photonFeeGate = async function (view, renderFn) {
    if (timer) { clearInterval(timer); timer = null; }
    var r; try { r = await sb().rpc('fee_lock_status'); } catch (e) { r = { error: e }; }
    if (r.error || !r.data) { return renderFn(view); }
    var s = r.data;
    function again() { return window.photonFeeGate(view, renderFn); }
    clear(view);
    if (!s.enforce) {
      if (s.owner) view.appendChild(el('div', { class: 'fl-muted', style: 'margin:0 0 12px' }, 'Extra protection for money actions (a PIN, pattern or password) is available but not turned on. ', el('a', { href: '#/fee_lock', style: 'color:inherit;text-decoration:underline' }, 'Open Fees lock')));
      var h0 = el('div', {}); view.appendChild(h0); return renderFn(h0);
    }
    if (!s.configured) { view.appendChild(setupCard(s, function () { again(); }, false)); return; }
    if (!s.unlocked) { view.appendChild(unlockCard(s, function () { again(); })); return; }
    var left = el('span', {}, 'Fees unlocked \u00B7 about ' + s.minutes_left + ' min left'), lockBtn = el('button', { type: 'button', class: 'fl-btn', onclick: async function () { try { await sb().rpc('fee_lock_lock'); } catch (e) { } again(); } }, 'Lock now');
    view.appendChild(el('div', { class: 'fl-bar' }, left, lockBtn));
    var holder = el('div', {}); view.appendChild(holder);
    var mins = s.minutes_left, t0 = Date.now();
    timer = setInterval(async function () {
      if (!/^#\/fee_/.test(location.hash) || /^#\/fee_lock/.test(location.hash)) { clearInterval(timer); timer = null; return; }
      var q; try { q = await sb().rpc('fee_lock_status'); } catch (e) { return; }
      if (q.data && q.data.unlocked) left.textContent = 'Fees unlocked \u00B7 about ' + q.data.minutes_left + ' min left';
      else { clearInterval(timer); timer = null; again(); }
    }, 30000);
    return renderFn(holder);
  };
  // other screens call this when the database says Fees are locked
  window.photonFeeRelock = function () { window.dispatchEvent(new HashChangeEvent('hashchange')); };
  window.photonFeeIsLockError = function (e) { return /Fees are locked|Set up your Fees lock/i.test((e && e.message) || ''); };

  // ------------------------------------------------------------ "Fees lock" settings screen
  window.photonAdminFeeLock = async function (view) {
    clear(view);
    var box = el('div', {}), msg = el('div', { class: 'fl-msg' });
    view.appendChild(box);
    async function load() {
      clear(box);
      var r; try { r = await sb().rpc('fee_lock_status'); } catch (e) { r = { error: e }; }
      if (r.error || !r.data) { box.appendChild(el('div', { class: 'fl-card fl-wide' }, el('div', { class: 'fl-muted' }, 'Could not load the Fees lock. Make sure you are signed in as an admin.'))); return; }
      var s = r.data;
      var top = el('div', { class: 'fl-card fl-wide' }, el('h2', {}, 'Fees lock'),
        el('div', { class: 'fl-muted' }, 'An extra lock (PIN keypad, pattern or password) in front of every money action. Each admin sets their own. It is checked by the database, not just on screen, and it re-locks after 10 idle minutes.'),
        el('p', {}, el('b', {}, 'Protection: '), s.enforce ? el('span', { class: 'fl-badge ok' }, 'ON for everyone') : el('span', { class: 'fl-badge warn' }, 'OFF'), '  ', el('b', {}, 'Your lock: '), s.configured ? el('span', { class: 'fl-badge ok' }, kindName(s.kind)) : el('span', { class: 'fl-badge warn' }, 'not set'),
          s.configured ? el('span', { class: 'fl-badge' + (s.unlocked ? ' ok' : '') }, s.unlocked ? 'unlocked, ' + s.minutes_left + ' min left' : 'locked') : null));
      var acts = el('div', { class: 'fl-acts' });
      var area = el('div', {});
      acts.appendChild(el('button', { type: 'button', class: 'fl-btn pri', onclick: function () { clear(area).appendChild(setupCard(s, function () { load(); }, !!s.configured)); } }, s.configured ? 'Change my lock' : 'Set up my lock'));
      if (s.configured) acts.appendChild(el('button', { type: 'button', class: 'fl-btn', onclick: async function () { try { await sb().rpc('fee_lock_lock'); } catch (e) { } load(); } }, 'Lock now'));
      if (s.configured && !s.unlocked) acts.appendChild(el('button', { type: 'button', class: 'fl-btn', onclick: function () { clear(area).appendChild(unlockCard(s, function () { load(); })); } }, 'Unlock'));
      top.appendChild(acts); top.appendChild(msg); box.appendChild(top); box.appendChild(area);
      if (s.owner) {
        var ov; try { ov = await sb().rpc('admin_fee_lock_overview'); } catch (e) { ov = { error: e }; }
        var own = el('div', { class: 'fl-card fl-wide' }, el('h2', {}, 'Protection for everyone (owners only)'));
        if (ov.error || !ov.data) own.appendChild(el('div', { class: 'fl-muted' }, 'Could not load this section.'));
        else {
          var d = ov.data;
          own.appendChild(el('div', { class: 'fl-muted' }, d.enforce ? 'Protection is ON. Every admin who handles fees must set a lock and unlock before any money action.' : 'Protection is OFF. Money actions work as before. When you turn it ON, every admin must set their own lock first, so set yours and tell the others before you switch it on.'));
          var tog = el('button', { type: 'button', class: 'fl-btn ' + (d.enforce ? 'bad' : 'pri'), disabled: !s.configured || !s.unlocked, title: !s.configured ? 'Set your own lock first' : (!s.unlocked ? 'Unlock first' : '') }, d.enforce ? 'Turn protection OFF' : 'Turn protection ON');
          tog.addEventListener('click', async function () {
            if (!window.confirm(d.enforce ? 'Turn the Fees lock OFF? Money actions will no longer ask for a lock.' : 'Turn the Fees lock ON for every admin? Anyone without a lock will be asked to set one before they can do any money action.')) return;
            var q; try { q = await sb().rpc('fee_lock_enforce', { p_on: !d.enforce }); } catch (e) { q = { error: e }; }
            if (q.error) { msg.textContent = why(q.error); msg.className = 'fl-msg err'; return; } load();
          });
          own.appendChild(el('div', { class: 'fl-acts' }, tog)); if (!s.unlocked && s.configured) own.appendChild(el('div', { class: 'fl-muted' }, 'Unlock above to change this.'));
          own.appendChild(el('h2', { style: 'margin-top:18px;font-size:17px' }, 'Admins and their locks'));
          own.appendChild(el('div', { class: 'fl-wrap' }, el('table', { class: 'fl-tbl' }, el('thead', {}, el('tr', {}, ['Admin', 'Lock', 'Set on', 'Wrong tries', 'Status', ''].map(function (h) { return el('th', {}, h); }))),
            el('tbody', {}, (d.people || []).map(function (p) {
              var rb = el('button', { type: 'button', class: 'fl-btn bad', disabled: !p.configured, onclick: async function () {
                if (!window.confirm('Reset the Fees lock of ' + p.name + '? They will have to set a new one before they can do any money action.')) return;
                var q; try { q = await sb().rpc('fee_lock_reset', { p_user: p.id }); } catch (e) { q = { error: e }; }
                if (q.error) { msg.textContent = why(q.error); msg.className = 'fl-msg err'; return; } msg.textContent = 'Reset for ' + p.name + '.'; msg.className = 'fl-msg ok'; load();
              } }, 'Reset');
              return el('tr', {}, el('td', {}, p.name), el('td', {}, p.configured ? kindName(p.kind) : 'not set'), el('td', {}, p.set_at ? when(p.set_at) : ''), el('td', {}, p.failed_count || 0), el('td', {}, p.locked_until ? el('span', { class: 'fl-badge warn' }, 'locked out until ' + when(p.locked_until)) : ''), el('td', {}, rb));
            })))));
          own.appendChild(el('div', { class: 'fl-muted', style: 'margin-top:8px' }, 'Reset is for an admin who forgot their lock. You cannot reset your own: another owner must do it. If you are the only owner, the developer can clear it in the database.'));
          own.appendChild(el('h2', { style: 'margin-top:18px;font-size:17px' }, 'Recent lock activity'));
          var evNames = { created: 'set a lock', changed: 'changed their lock', unlock: 'unlocked Fees', lock: 'locked Fees', bad_attempt: 'entered a wrong lock', locked_out: 'was locked out after wrong tries', reset: 'had their lock reset', protection_on: 'turned protection ON', protection_off: 'turned protection OFF' };
          var ev = d.events || [];
          own.appendChild(ev.length ? el('div', { class: 'fl-wrap' }, el('table', { class: 'fl-tbl' }, el('thead', {}, el('tr', {}, ['When', 'Who', 'What'].map(function (h) { return el('th', {}, h); }))),
            el('tbody', {}, ev.map(function (x) { return el('tr', {}, el('td', {}, when(x.at)), el('td', {}, x.name), el('td', {}, (evNames[x.event] || x.event) + (x.detail ? ' (' + x.detail + ')' : ''))); })))) : el('div', { class: 'fl-muted' }, 'Nothing yet.'));
        }
        box.appendChild(own);
      }
    }
    await load();
  };
})();
