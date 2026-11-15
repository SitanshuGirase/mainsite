/* ===================================================================
   Photon Academy - Admin screen "Security" (owners only)
   Shows what your database really knows: who is signed in right now (device + partly hidden network),
   admin / teacher / staff accounts and their last sign-in, failed parent-code attempts, and recent
   admin and fee changes. Read-only: this screen cannot change or delete anything.
   It cannot show failed Google sign-ins (those happen at Google) or sign-ins after a session has ended.
   =================================================================== */
(function () {
  'use strict';
  function sb() { return window.photonSupabase; }
  function el(tag, attrs) {
    var e = document.createElement(tag); attrs = attrs || {};
    Object.keys(attrs).forEach(function (k) { var v = attrs[k]; if (v === null || v === undefined || v === false) return; if (k === 'class') e.className = v; else if (k === 'style') e.style.cssText = v; else if (k.indexOf('on') === 0) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v); });
    for (var i = 2; i < arguments.length; i++) add(e, arguments[i]); return e;
  }
  function add(p, c) { if (c === null || c === undefined || c === false) return; if (Array.isArray(c)) { c.forEach(function (x) { add(p, x); }); return; } p.appendChild(c.nodeType ? c : document.createTextNode(String(c))); }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); return n; }
  var css = el('style'); css.textContent = [
    '.sc-card{border:var(--ph-w,1.5px) solid var(--line,rgba(127,127,127,.6));border-radius:14px;padding:20px;background:rgba(127,127,127,.09);max-width:980px;margin-bottom:16px}',
    '.sc-card h2{margin:0 0 4px;font-size:20px}.sc-muted{opacity:.78;font-size:13.5px}.sc-btn{border:1px solid var(--line,rgba(127,127,127,.6));background:transparent;color:inherit;border-radius:10px;padding:8px 14px;font:inherit;font-size:13.5px;cursor:pointer}.sc-btn:disabled{opacity:.5;cursor:not-allowed}',
    '.sc-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin:0 0 16px;max-width:980px}.sc-tile{border:1.5px solid var(--line,rgba(127,127,127,.6));border-radius:12px;padding:10px 14px}.sc-tile b{display:block;font-size:28px;line-height:1.15;font-family:var(--ph-head,Georgia,serif)}.sc-tile span{display:block;font-size:13.5px}.sc-tile small{display:block;opacity:.75;font-size:12.5px}',
    '.sc-wrap{overflow-x:auto;max-width:100%;margin-top:8px}.sc-tbl{border-collapse:collapse;width:100%;font-size:13.5px}.sc-tbl th,.sc-tbl td{text-align:left;padding:7px 10px;border-bottom:1px solid rgba(127,127,127,.35);white-space:nowrap}.sc-tbl th{font-weight:600}',
    '.sc-badge{display:inline-block;border-radius:99px;border:1px solid rgba(127,127,127,.55);padding:1px 10px;font-size:12px;margin-left:6px}.sc-badge.warn{color:#f5b942;border-color:#f5b942}.sc-badge.bad{color:#ff7b7b;border-color:#ff7b7b}.sc-badge.ok{color:#3ddc97;border-color:#3ddc97}',
    '.sc-msg{min-height:20px;margin-top:8px;font-size:13.5px}.sc-msg.err{color:#ff7b7b}'
  ].join('\n'); document.head.appendChild(css);

  var ROLE = { admin: 'Admin', teacher: 'Teacher', student: 'Student', parent: 'Parent' };
  var ACTION = { made_admin: 'made an admin', removed_admin: 'admin rights removed', set_staff: 'staff access set', removed_staff: 'staff access removed', made_owner: 'made an owner', removed_owner: 'ownership removed' };
  function when(s) { if (!s) return 'never'; try { return new Date(s).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) { return String(s); } }
  function ago(s) {
    if (!s) return 'never'; var m = Math.round((Date.now() - new Date(s).getTime()) / 60000);
    if (!(m >= 0)) return when(s); if (m < 2) return 'just now'; if (m < 60) return m + ' min ago'; if (m < 1440) return Math.round(m / 60) + ' h ago'; return Math.round(m / 1440) + ' days ago';
  }
  function table(head, rows) {
    return el('div', { class: 'sc-wrap' }, el('table', { class: 'sc-tbl' }, el('thead', {}, el('tr', {}, head.map(function (h) { return el('th', {}, h); }))),
      el('tbody', {}, rows.map(function (r) { return el('tr', {}, r.map(function (c) { return el('td', {}, c); })); }))));
  }
  function tile(n, label, sub) { return el('div', { class: 'sc-tile' }, el('b', {}, n), el('span', {}, label), sub ? el('small', {}, sub) : null); }
  function section(title, note, content) { return el('div', { class: 'sc-card' }, el('h2', {}, title), note ? el('div', { class: 'sc-muted' }, note) : null, content); }

  window.photonAdminSecurity = async function (view) {
    clear(view);
    var msg = el('div', { class: 'sc-msg' }), body = el('div', {}), refresh = el('button', { type: 'button', class: 'sc-btn' }, 'Refresh');
    view.appendChild(el('div', { class: 'sc-card' }, el('h2', {}, 'Security activity'),
      el('div', { class: 'sc-muted' }, 'Only owners can see this page. It is read-only. Network addresses are partly hidden (for example 49.36.x.x), enough to tell whether two sign-ins came from the same place.'),
      el('div', { style: 'margin-top:12px' }, refresh), msg));
    view.appendChild(body);
    async function load() {
      refresh.disabled = true; msg.textContent = 'Loading\u2026'; msg.className = 'sc-msg';
      var r; try { r = await sb().rpc('admin_security_overview'); } catch (e) { r = { error: e }; }
      refresh.disabled = false; clear(body);
      if (r.error || !r.data) { msg.textContent = /Only an owner/i.test((r.error && r.error.message) || '') ? 'Only an owner can view this page.' : 'Could not load security activity. Please try again.'; msg.className = 'sc-msg err'; return; }
      msg.textContent = 'Updated ' + when(r.data.generated_at) + '.';
      var d = r.data, sess = d.sessions || [], people = d.people || [], pa = d.parent_attempts || {}, top = pa.top || [];
      var adminSessions = sess.filter(function (s) { return s.role === 'admin'; }).length;
      var heavy = top.filter(function (x) { return x.failed >= 5; }).length;
      body.appendChild(el('div', { class: 'sc-tiles' },
        tile(d.sessions_total || 0, 'Signed in right now', 'active sessions (one person can have several devices)'),
        tile(adminSessions, 'Admin sessions', sess.length < (d.sessions_total || 0) ? 'among the latest ' + sess.length : null),
        tile(pa.failed_30d || 0, 'Failed parent-code attempts', 'last 30 days, ' + (pa.ok_30d || 0) + ' succeeded'),
        tile(people.filter(function (p) { return p.networks >= 3; }).length, 'Accounts on several networks', 'admins, teachers and staff with 3 or more')));

      body.appendChild(section('Who is signed in right now', 'Each row is one signed-in device. A person you do not recognise, or a device you do not use, is worth checking.',
        sess.length ? table(['Person', 'Device', 'Network', 'Signed in', 'Last active'], sess.map(function (s) {
          return [[s.name, el('span', { class: 'sc-badge' }, ROLE[s.role] || s.role)], s.device || 'Unknown device', s.network || 'unknown', when(s.signed_in_at), ago(s.last_active)];
        })) : el('div', { class: 'sc-muted', style: 'margin-top:8px' }, 'Nobody is signed in.')));

      body.appendChild(section('Admins, teachers and staff', 'Accounts that can change things. \u201CSeveral networks\u201D means 3 or more different places at once, which can be normal (home, phone, academy) but is worth a glance.',
        people.length ? table(['Person', 'Role', 'Last sign-in', 'Devices', 'Networks', ''], people.map(function (p) {
          return [p.name, (ROLE[p.role] || p.role) + (p.staff ? ' + staff access' : ''), when(p.last_sign_in), p.sessions, p.networks, p.networks >= 3 ? el('span', { class: 'sc-badge warn' }, 'Several networks') : (p.sessions === 0 ? el('span', { class: 'sc-badge' }, 'Not signed in') : '')];
        })) : el('div', { class: 'sc-muted', style: 'margin-top:8px' }, 'None found.')));

      body.appendChild(section('Failed parent-code attempts', 'Parents link to a child with a one-time code. Many wrong codes from one person can mean someone is guessing.',
        el('div', {}, top.length ? table(['Person', 'Failed attempts (30 days)', 'Last failed attempt', ''], top.map(function (x) { return [x.name, x.failed, when(x.last_at), x.failed >= 5 ? el('span', { class: 'sc-badge bad' }, 'Possible guessing') : '']; }))
          : el('div', { class: 'sc-muted', style: 'margin-top:8px' }, 'No failed attempts in the last 30 days.'),
          heavy ? el('div', { class: 'sc-msg err' }, heavy + (heavy === 1 ? ' person has' : ' people have') + ' 5 or more failed attempts.') : null)));

      var ac = d.admin_changes || [], fc = d.fee_changes || [];
      body.appendChild(section('Recent admin changes', 'Who gave or removed admin and staff access.',
        ac.length ? table(['When', 'Who did it', 'What happened', 'To'], ac.map(function (x) { return [when(x.at), x.actor || 'unknown', (ACTION[x.action] || String(x.action || '').replace(/_/g, ' ')) + (x.detail ? ' (' + x.detail + ')' : ''), x.target || '']; })) : el('div', { class: 'sc-muted', style: 'margin-top:8px' }, 'No changes recorded yet.')));
      body.appendChild(section('Recent fee changes', 'The latest recorded fee actions.',
        fc.length ? table(['When', 'Who did it', 'What happened', 'Record type'], fc.map(function (x) { return [when(x.at), x.actor, String(x.action || '').replace(/_/g, ' '), String(x.entity || '').replace(/_/g, ' ')]; })) : el('div', { class: 'sc-muted', style: 'margin-top:8px' }, 'No fee changes recorded yet.')));

      body.appendChild(el('div', { class: 'sc-card' }, el('h2', {}, 'What this page cannot show'),
        el('div', { class: 'sc-muted' }, 'Failed Google sign-ins are not visible, because they happen at Google, not in your system. Past sign-ins are not kept once a session ends. A permanent sign-in history is possible as a later add-on. To lock someone out right now, remove their access in Admins & access.')));
    }
    refresh.addEventListener('click', load); await load();
  };
})();
