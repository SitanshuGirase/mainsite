/* ===================================================================
   Photon Academy - Admin screen "Admins & access"
   Who can do what:
     Owner  : can add or remove admins, owners and staff access (the director and you)
     Admin  : full admin panel, but cannot change admin accounts
     Staff  : limited access to chosen areas only (Analytics = read-only; Enquiries = manage form submissions)
   Everything is enforced inside the database; this screen only calls its owner-only functions.
   Every change is written to a change log that only owners can read.
   =================================================================== */
(function () {
  'use strict';
  var AREAS = [['analytics', 'Analytics (read-only)', 'Can open the Analytics screen: student, fee, enquiry, homework and test figures. Cannot change anything.'], ['enquiries', 'Enquiries (manage)', 'Can open Form submissions and mark enquiries as reviewed.']];
  function sb() { return window.photonSupabase; }
  function el(tag, attrs) {
    var e = document.createElement(tag); attrs = attrs || {};
    Object.keys(attrs).forEach(function (k) { var v = attrs[k]; if (v === null || v === undefined || v === false) return; if (k === 'class') e.className = v; else if (k === 'style') e.style.cssText = v; else if (k.indexOf('on') === 0) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v); });
    for (var i = 2; i < arguments.length; i++) add(e, arguments[i]); return e;
  }
  function add(p, c) { if (c === null || c === undefined || c === false) return; if (Array.isArray(c)) { c.forEach(function (x) { add(p, x); }); return; } p.appendChild(c.nodeType ? c : document.createTextNode(String(c))); }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); return n; }
  var css = el('style'); css.textContent = [
    '.pd-card{border:1px solid rgba(127,127,127,.38);border-radius:14px;padding:18px;background:rgba(127,127,127,.09);max-width:900px;margin-bottom:16px}',
    '.pd-card h2{margin:0 0 4px;font-size:18px}.pd-card h3{margin:14px 0 6px;font:inherit;font-weight:600;font-size:15px}.pd-muted{opacity:.75;font-size:13px}',
    '.pd-row{border:1px solid rgba(127,127,127,.38);border-radius:12px;padding:10px 12px;margin:8px 0}.pd-top{display:flex;gap:10px;justify-content:space-between;align-items:flex-start;flex-wrap:wrap}',
    '.pd-btn{border:1px solid rgba(127,127,127,.5);background:transparent;color:inherit;border-radius:10px;padding:7px 13px;font:inherit;font-size:13.5px;cursor:pointer}.pd-btn.pri{background:#4fd6e8;border-color:#4fd6e8;color:#06202a;font-weight:600}.pd-btn.bad{border-color:#ff7b7b;color:#ff7b7b}.pd-btn:disabled{opacity:.5;cursor:not-allowed}',
    '.pd-badge{display:inline-block;border-radius:99px;border:1px solid rgba(127,127,127,.45);padding:1px 10px;font-size:12px;margin-left:6px}.pd-badge.own{color:#f5b942;border-color:#f5b942}.pd-badge.adm{color:#3ddc97;border-color:#3ddc97}.pd-badge.stf{color:#4fd6e8;border-color:#4fd6e8}',
    '.pd-in{box-sizing:border-box;background:transparent;color:inherit;border:1px solid rgba(127,127,127,.5);border-radius:10px;padding:8px 10px;font:inherit;font-size:14px;width:100%;max-width:340px}',
    '.pd-msg{min-height:20px;margin-top:8px;font-size:13.5px}.pd-msg.err{color:#ff7b7b}.pd-msg.ok{color:#3ddc97}.pd-acts{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.pd-chk{display:block;margin:6px 0;font-size:14px}.pd-chk small{display:block;opacity:.7;margin-left:24px}',
    '.pd-log{font-size:13px;border-bottom:1px solid rgba(127,127,127,.25);padding:6px 0}'
  ].join('\n'); document.head.appendChild(css);
  function when(s) { if (!s) return 'never'; try { return new Date(s).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch (e) { return s; } }
  function why(e) { var m = (e && e.message) || ''; return /Only an owner|cannot change your own|Remove ownership|at least one owner|Only an admin|already have full|Person not found|Unknown/i.test(m) ? m : 'Something went wrong. Please try again.'; }
  var ACTION = { made_admin: 'made an admin', removed_admin: 'admin rights removed', set_staff: 'staff access set', removed_staff: 'staff access removed', made_owner: 'made an owner', removed_owner: 'ownership removed' };

  function areaPicker(sel) {
    var box = el('div', {}); AREAS.forEach(function (a) { var c = el('input', { type: 'checkbox', value: a[0] }); c.checked = sel.indexOf(a[0]) >= 0; box.appendChild(el('label', { class: 'pd-chk' }, c, ' ' + a[1], el('small', {}, a[2]))); });
    box.value = function () { return [].slice.call(box.querySelectorAll('input:checked')).map(function (i) { return i.value; }); }; return box;
  }

  window.photonAdminAdmins = async function (view) {
    clear(view);
    var acc = window.photonAccess || {}, owner = !!acc.owner, msg = el('div', { class: 'pd-msg' }), listBox = el('div', {}), findBox = el('div', {}), logBox = el('div', {});
    function say(t, k) { msg.textContent = t || ''; msg.className = 'pd-msg' + (k ? ' ' + k : ''); }
    view.appendChild(el('div', { class: 'pd-card' }, el('h2', {}, 'Admins & access'),
      el('div', { class: 'pd-muted' }, 'Owners manage everyone below. Admins have the full panel. Staff see only the areas you choose. ' + (owner ? 'You are an owner, so you can make changes.' : 'Only an owner can make changes here.')), msg));
    view.appendChild(el('div', { class: 'pd-card' }, el('h2', {}, 'People with access'), listBox));
    if (owner) {
      view.appendChild(el('div', { class: 'pd-card' }, el('h2', {}, 'Add someone'), el('div', { class: 'pd-muted' }, 'The person must first sign in once with their Google account (at Student Space). Then search for their name or phone number here.'), findBox));
      view.appendChild(el('div', { class: 'pd-card' }, el('h2', {}, 'Recent changes'), logBox));
    }

    async function act(fn, ok) { say('Saving\u2026'); var r = await fn(); if (r && r.error) return say(why(r.error), 'err'); say(ok, 'ok'); await load(); }
    async function load() {
      var r = await sb().rpc('admin_list'); clear(listBox);
      if (r.error) { listBox.appendChild(el('div', { class: 'pd-muted' }, 'Could not load this list.')); return; }
      (r.data || []).forEach(function (p) {
        var isAdmin = p.role === 'admin', badges = [isAdmin ? (p.is_owner ? el('span', { class: 'pd-badge own' }, 'Owner') : el('span', { class: 'pd-badge adm' }, 'Admin')) : el('span', { class: 'pd-badge stf' }, 'Staff')];
        var row = el('div', { class: 'pd-row' }, el('div', { class: 'pd-top' }, el('div', {}, el('b', {}, p.name), badges, el('div', { class: 'pd-muted' }, 'Last sign-in: ' + when(p.last_sign_in) + (p.phone_hint ? ' \u00B7 phone ending ' + p.phone_hint : '')))));
        if (!isAdmin) row.appendChild(el('div', { class: 'pd-muted', style: 'margin-top:6px' }, 'Access: ' + ((p.areas || []).map(function (a) { return (AREAS.filter(function (x) { return x[0] === a; })[0] || [a, a])[1]; }).join(', ') || 'none')));
        if (owner) {
          var acts = el('div', { class: 'pd-acts' });
          if (isAdmin) {
            if (p.is_owner) acts.appendChild(el('button', { type: 'button', class: 'pd-btn', onclick: function () { if (window.confirm('Remove ownership from ' + p.name + '? They stay an admin.')) act(function () { return sb().rpc('admin_set_owner', { p_user: p.id, p_on: false }); }, 'Ownership removed.'); } }, 'Remove ownership'));
            else {
              acts.appendChild(el('button', { type: 'button', class: 'pd-btn', onclick: function () { if (window.confirm('Make ' + p.name + ' an OWNER? Owners can add and remove admins.')) act(function () { return sb().rpc('admin_set_owner', { p_user: p.id, p_on: true }); }, 'Made an owner.'); } }, 'Make owner'));
              ['teacher', 'student'].forEach(function (role) { acts.appendChild(el('button', { type: 'button', class: 'pd-btn bad', onclick: function () { if (window.confirm('Remove admin rights from ' + p.name + '? They become a ' + role + ' account.')) act(function () { return sb().rpc('admin_set_role', { p_user: p.id, p_role: role }); }, 'Admin rights removed.'); } }, 'Remove admin (' + role + ')')); });
            }
          } else {
            var pick = areaPicker(p.areas || []);
            row.appendChild(pick);
            acts.appendChild(el('button', { type: 'button', class: 'pd-btn pri', onclick: function () { act(function () { return sb().rpc('admin_set_staff', { p_user: p.id, p_areas: pick.value() }); }, 'Staff access saved.'); } }, 'Save access'));
            acts.appendChild(el('button', { type: 'button', class: 'pd-btn bad', onclick: function () { if (window.confirm('Remove all access for ' + p.name + '?')) act(function () { return sb().rpc('admin_set_staff', { p_user: p.id, p_areas: [] }); }, 'Access removed.'); } }, 'Remove access'));
          }
          row.appendChild(acts);
        }
        listBox.appendChild(row);
      });
      if (!(r.data || []).length) listBox.appendChild(el('div', { class: 'pd-muted' }, 'Nobody yet.'));
      if (owner) loadLog();
    }
    async function loadLog() {
      var r = await sb().from('admin_audit').select('*').order('at', { ascending: false }).limit(30); clear(logBox);
      if (r.error || !(r.data || []).length) { logBox.appendChild(el('div', { class: 'pd-muted' }, r.error ? 'Could not load the log.' : 'No changes yet.')); return; }
      r.data.forEach(function (x) { logBox.appendChild(el('div', { class: 'pd-log' }, el('b', {}, x.target_name || 'Someone'), ' \u2014 ' + (ACTION[x.action] || x.action) + (x.detail ? ' (' + x.detail + ')' : ''), el('div', { class: 'pd-muted' }, 'by ' + (x.actor_name || 'unknown') + ' \u00B7 ' + when(x.at)))); });
    }
    if (owner) {
      var q = el('input', { class: 'pd-in', placeholder: 'Name or phone number', maxlength: '60', 'aria-label': 'Search people' }), go = el('button', { type: 'button', class: 'pd-btn pri', style: 'margin-left:8px' }, 'Search'), res = el('div', {});
      go.onclick = async function () {
        clear(res); if (q.value.trim().length < 2) return say('Type at least 2 letters or digits.', 'err'); say('Searching\u2026');
        var r = await sb().rpc('admin_candidates', { p_q: q.value }); if (r.error) return say(why(r.error), 'err'); say('');
        if (!(r.data || []).length) return res.appendChild(el('div', { class: 'pd-muted', style: 'margin-top:8px' }, 'Nobody found. Check the spelling, and make sure they have signed in once.'));
        r.data.forEach(function (c) {
          var picker = areaPicker([]), box = el('div', { style: 'display:none' }, picker, el('button', { type: 'button', class: 'pd-btn pri', onclick: function () { var a = picker.value(); if (!a.length) return say('Tick at least one area.', 'err'); act(function () { return sb().rpc('admin_set_staff', { p_user: c.id, p_areas: a }); }, 'Staff access given to ' + c.name + '.'); clear(res); } }, 'Give this access'));
          res.appendChild(el('div', { class: 'pd-row' }, el('div', { class: 'pd-top' }, el('div', {}, el('b', {}, c.name), el('div', { class: 'pd-muted' }, c.role + (c.class_name ? ' \u00B7 Class ' + c.class_name : '') + (c.phone_hint ? ' \u00B7 phone ending ' + c.phone_hint : ''))),
            el('div', { class: 'pd-acts' }, el('button', { type: 'button', class: 'pd-btn', onclick: function () { box.style.display = box.style.display === 'none' ? 'block' : 'none'; } }, 'Give staff access\u2026'),
              el('button', { type: 'button', class: 'pd-btn bad', onclick: function () { if (window.confirm('Make ' + c.name + ' a FULL ADMIN? They will be able to see and change almost everything. Only do this for someone you fully trust.')) act(function () { return sb().rpc('admin_set_role', { p_user: c.id, p_role: 'admin' }); }, c.name + ' is now an admin.').then(function () { clear(res); }); } }, 'Make admin'))), box));
        });
      };
      q.addEventListener('keydown', function (e) { if (e.key === 'Enter') go.click(); });
      findBox.appendChild(el('div', {}, q, go)); findBox.appendChild(res);
    }
    await load();
  };
})();
