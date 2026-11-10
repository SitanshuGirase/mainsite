/* ===================================================================
   Photon Academy - Parent access
   How it works (no admin work needed):
     1. An approved student opens Student Space > "Invite a parent" and makes a one-time code.
     2. The parent signs in to Student Space with their own Google account and types the code.
     3. The parent then sees ONLY their own child's published marks, homework and fees (read-only).
   Privacy rules live in the database. A code works once and expires after 7 days.
   Student or admin can remove a link at any time. Needs photon-marks.js loaded first (shared charts).
   =================================================================== */
(function () {
  'use strict';
  var U = function () { return window.PhotonUI; };
  function sb() { return window.photonSupabase; }
  function rs(paise) { return '\u20B9' + (Number(paise || 0) / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 }); }
  function today() { return new Date().toISOString().slice(0, 10); }
  function fmtCode(c) { c = String(c || ''); return c.length === 8 ? c.slice(0, 4) + '-' + c.slice(4) : c; }
  var STAT = { submitted: ['Submitted', 'ok'], reviewed: ['Reviewed', 'ok'], needs_changes: ['Needs changes', 'off'], none: ['Not submitted', 'off'] };

  /* ---------- student: invite a parent ---------- */
  function inviteCard() {
    var u = U(), el = u.el, card = el('div', { class: 'pm-card', id: 'pp-invite' }, el('h2', {}, 'Invite a parent'));
    var body = el('div', {}), msgBox = el('div', { class: 'pm-msg' });
    card.appendChild(el('div', { class: 'pm-muted' }, 'Let a parent see your marks, homework and fees. Make a code and give it to them. They sign in here with their own Google account and type it in. Each code works once and lasts 7 days.'));
    card.appendChild(body); card.appendChild(msgBox);
    var btn = el('button', { type: 'button', class: 'pm-btn pri', style: 'margin-top:10px' }, 'Make a parent code');
    var codeBox = el('div', {}), linkBox = el('div', {});
    btn.onclick = async function () {
      btn.disabled = true; u.msg(msgBox, 'Making a code\u2026');
      var r = await sb().rpc('create_parent_code'); btn.disabled = false;
      if (r.error || !r.data || !r.data[0]) return u.msg(msgBox, 'Could not make a code. Please try again.', 'err');
      u.msg(msgBox, ''); u.clear(codeBox);
      var d = r.data[0];
      codeBox.appendChild(el('div', { style: 'margin:12px 0;font-size:28px;font-weight:700;letter-spacing:3px;overflow-wrap:anywhere' }, fmtCode(d.code)));
      codeBox.appendChild(el('div', { class: 'pm-muted' }, 'Valid until ' + u.fmtDate(String(d.expires_at).slice(0, 10)) + '. Only give it to your parent or guardian.'));
    };
    body.appendChild(btn); body.appendChild(codeBox); body.appendChild(linkBox);
    async function loadLinks() {
      var r = await sb().from('parent_links').select('id,created_at'); u.clear(linkBox);
      if (r.error || !r.data || !r.data.length) return;
      linkBox.appendChild(el('h3', {}, 'Linked parents (' + r.data.length + ')'));
      r.data.forEach(function (l, i) {
        var rm = el('button', { type: 'button', class: 'pm-btn bad' }, 'Remove');
        rm.onclick = async function () { if (!window.confirm('Remove this parent\u2019s access to your marks, homework and fees?')) return; var d = await sb().from('parent_links').delete().eq('id', l.id); if (d.error) return u.msg(msgBox, 'Could not remove. Try again.', 'err'); loadLinks(); };
        linkBox.appendChild(el('div', { class: 'pm-row' }, el('span', {}, 'Parent ' + (i + 1) + ' \u00B7 linked ' + u.fmtDate(String(l.created_at).slice(0, 10))), rm));
      });
    }
    loadLinks(); return card;
  }

  /* ---------- parent: link a child ---------- */
  function codeForm(onDone) {
    var u = U(), el = u.el, inp = el('input', { class: 'pm-in', maxlength: '12', placeholder: 'XXXX-XXXX', style: 'max-width:200px;text-transform:uppercase', 'aria-label': 'Parent code' }), msgBox = el('div', { class: 'pm-msg' });
    var btn = el('button', { type: 'button', class: 'pm-btn pri' }, 'Link my child');
    btn.onclick = async function () {
      if (inp.value.replace(/[^A-Za-z0-9]/g, '').length !== 8) return u.msg(msgBox, 'The code has 8 letters and numbers.', 'err');
      btn.disabled = true; u.msg(msgBox, 'Checking\u2026');
      var r = await sb().rpc('redeem_parent_code', { p_code: inp.value }); btn.disabled = false;
      if (r.error) return u.msg(msgBox, /Too many/i.test(r.error.message || '') ? r.error.message : 'Something went wrong. Please try again.', 'err');
      if (!r.data || !r.data.length) return u.msg(msgBox, 'That code is not valid, or it has expired. Ask your child to make a new one.', 'err');
      u.msg(msgBox, 'Linked to ' + (r.data[0].student_name || 'your child') + '.', 'ok'); inp.value = ''; onDone();
    };
    return el('div', {}, el('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px' }, inp, btn), msgBox);
  }

  /* ---------- parent dashboard ---------- */
  async function dashboard(children, reload) {
    var u = U(), el = u.el, card = el('div', { class: 'pm-card', id: 'pp-parent' }, el('h2', {}, 'Parent view'));
    var holder = el('div', {}); card.appendChild(el('div', { class: 'pm-muted' }, 'You can see your child\u2019s published test marks, homework and fee status. This view is read-only.'));
    var pick = u.sel(children.map(function (c) { return c.name + ' \u00B7 Class ' + c.class_name; }));
    if (children.length > 1) card.appendChild(el('div', { style: 'margin:10px 0' }, pick));
    card.appendChild(holder);
    card.appendChild(el('details', { style: 'margin-top:14px' }, el('summary', { style: 'cursor:pointer;font-size:14px' }, 'Link another child'), codeForm(reload)));
    async function show(c) {
      u.clear(holder); holder.appendChild(el('h3', {}, c.name + ' \u00B7 Class ' + c.class_name + (c.board ? ' \u00B7 ' + c.board : '') + (c.division ? ' \u00B7 Div ' + c.division : '')));
      var mk = el('div', {}, el('div', { class: 'pm-muted' }, 'Loading marks\u2026')), hw = el('div', {}, el('div', { class: 'pm-muted' }, 'Loading homework\u2026')), fe = el('div', {}, el('div', { class: 'pm-muted' }, 'Loading fees\u2026'));
      holder.appendChild(mk); holder.appendChild(hw); holder.appendChild(fe);
      holder.appendChild(el('h3', {}, 'Attendance')); holder.appendChild(el('div', { class: 'pm-muted' }, 'Attendance is not shown to parents yet. Please ask the academy if you need your child\u2019s attendance.'));
      marks(c, mk); homework(c, hw); fees(c, fe);
    }
    async function marks(c, box) {
      try {
        var r = await sb().from('test_marks').select('marks,absent,tests(id,title,subject,test_date,max_marks,pass_marks)').eq('student_id', c.id).limit(300); if (r.error) throw r.error;
        var rows = (r.data || []).filter(function (x) { return x.tests; }).map(function (x) { var t = x.tests, m = u.num(x.marks); return { id: t.id, title: t.title, subject: t.subject, date: t.test_date, max: Number(t.max_marks), marks: m, absent: !!x.absent, p: (m === null || x.absent) ? null : u.pct(m, Number(t.max_marks)) }; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; });
        u.clear(box); box.appendChild(el('h3', {}, 'Test marks'));
        var done = rows.filter(function (x) { return x.p !== null; });
        if (!rows.length) { box.appendChild(el('div', { class: 'pm-muted' }, 'No published marks yet.')); return; }
        var bySub = {}; done.forEach(function (x) { (bySub[x.subject] = bySub[x.subject] || []).push(x.p); });
        var subs = Object.keys(bySub).map(function (k) { var v = u.avg(bySub[k]); return { label: k, value: v, color: u.colorFor(v) }; }).sort(function (a, b) { return b.value - a.value; });
        box.appendChild(el('div', { class: 'pm-grid' }, u.statBox(done.length ? u.avg(done.map(function (x) { return x.p; })) + '%' : '\u2014', 'Average score'), u.statBox(done.length, 'Tests taken'), u.statBox(subs.length ? subs[0].label : '\u2014', 'Strongest subject')));
        box.appendChild(el('div', { class: 'pm-charts' }, u.chartBox('Score trend', u.lineChart(done.slice(-12).map(function (x) { return { value: x.p, label: x.title, short: u.shortDate(x.date) }; }))), u.chartBox('Average by subject', u.hbars(subs)), u.chartBox('Score bands', u.pieChart(u.bandSlices(done.map(function (x) { return x.p; }))))));
        var body = el('tbody', {}), recent = rows.slice().reverse().slice(0, 8), cells = {};
        recent.forEach(function (x) { var cell = el('td', {}, '\u2026'); cells[x.id] = cell; body.appendChild(el('tr', {}, el('td', {}, x.title + ' \u00B7 ' + x.subject), el('td', {}, u.fmtDate(x.date)), el('td', {}, x.absent ? 'Absent' : x.marks === null ? '\u2014' : x.marks + ' / ' + x.max + ' (' + x.p + '%)'), cell)); });
        box.appendChild(el('div', { class: 'pm-scroll' }, el('table', { class: 'pm-tbl' }, el('thead', {}, el('tr', {}, ['Test', 'Date', 'Marks', 'Class average'].map(function (h) { return el('th', {}, h); }))), body)));
        recent.forEach(function (x) { Promise.resolve(sb().rpc('test_class_stats', { p_test: x.id })).then(function (s) { var d = s && s.data && s.data[0]; cells[x.id].textContent = d ? Math.round(d.avg_marks * 10) / 10 + ' / ' + x.max : 'not enough students yet'; }, function () { cells[x.id].textContent = '\u2014'; }); });
      } catch (e) { u.clear(box); box.appendChild(el('div', { class: 'pm-muted' }, 'Could not load marks right now.')); }
    }
    async function homework(c, box) {
      try {
        var h = await sb().from('homework').select('*').order('due_date', { ascending: false }).limit(40); if (h.error) throw h.error;
        var s = await sb().from('homework_submissions').select('homework_id,status,marks,feedback,submitted_at').eq('student_id', c.id).limit(200); if (s.error) throw s.error;
        var subs = {}; (s.data || []).forEach(function (x) { subs[x.homework_id] = x; });
        var list = (h.data || []).filter(function (x) { return x.class_name === c.class_name && (!x.board || x.board === c.board) && (!x.division || x.division === c.division); });
        u.clear(box); box.appendChild(el('h3', {}, 'Homework'));
        if (!list.length) { box.appendChild(el('div', { class: 'pm-muted' }, 'No homework yet.')); return; }
        var pending = list.filter(function (x) { return !subs[x.id]; }).length, late = list.filter(function (x) { return !subs[x.id] && x.due_date < today(); }).length;
        box.appendChild(el('div', { class: 'pm-muted' }, list.length + ' tasks \u00B7 ' + pending + ' not submitted' + (late ? ' (' + late + ' overdue)' : '')));
        list.slice(0, 12).forEach(function (x) {
          var sub = subs[x.id], st = STAT[sub ? sub.status : 'none'];
          box.appendChild(el('div', { class: 'pm-row', style: 'display:block' }, el('div', {}, el('b', {}, x.title), el('span', { class: 'pm-badge ' + st[1] }, st[0]),
            el('div', { class: 'pm-muted' }, x.subject + ' \u00B7 due ' + u.fmtDate(x.due_date) + (!sub && x.due_date < today() ? ' \u00B7 overdue' : ''))),
            sub && sub.marks !== null && sub.marks !== undefined ? el('div', { style: 'margin-top:4px;font-size:14px' }, 'Marks: ' + sub.marks + (x.max_marks ? ' / ' + x.max_marks : '')) : null,
            sub && sub.feedback ? el('div', { style: 'margin-top:2px;font-size:14px' }, 'Teacher: ' + sub.feedback) : null));
        });
      } catch (e) { u.clear(box); box.appendChild(el('div', { class: 'pm-muted' }, 'Could not load homework right now.')); }
    }
    async function fees(c, box) {
      try {
        var d = await sb().from('fee_dues').select('id,title,amount_paise,due_date,status').eq('student_id', c.id).order('due_date', { ascending: true }).limit(100); if (d.error) throw d.error;
        var p = await sb().from('fee_payments').select('due_id,amount_paise,status').eq('student_id', c.id).limit(300); if (p.error) throw p.error;
        function sum(id, st) { return (p.data || []).filter(function (x) { return x.due_id === id && x.status === st; }).reduce(function (a, x) { return a + Number(x.amount_paise || 0); }, 0); }
        var open = (d.data || []).filter(function (x) { return x.status === 'open'; }).map(function (x) { var paid = sum(x.id, 'verified'); return { t: x, paid: paid, wait: sum(x.id, 'submitted'), left: Math.max(0, Number(x.amount_paise) - paid) }; }).filter(function (x) { return x.left > 0; });
        u.clear(box); box.appendChild(el('h3', {}, 'Fees'));
        if (!open.length) { box.appendChild(el('div', { class: 'pm-muted' }, 'No fees are due right now.')); return; }
        box.appendChild(el('div', { class: 'pm-grid' }, u.statBox(rs(open.reduce(function (a, x) { return a + x.left; }, 0)), 'Total still to pay')));
        open.forEach(function (x) {
          box.appendChild(el('div', { class: 'pm-row' }, el('div', { class: 't' }, el('b', {}, x.t.title), el('div', { class: 'pm-muted' }, 'Due ' + u.fmtDate(x.t.due_date) + (x.t.due_date < today() ? ' \u00B7 overdue' : '') + (x.wait ? ' \u00B7 a payment of ' + rs(x.wait) + ' is waiting for the academy to confirm' : ''))), el('b', {}, rs(x.left) + (x.paid ? ' left of ' + rs(x.t.amount_paise) : ''))));
        });
        box.appendChild(el('div', { class: 'pm-muted' }, 'Fees are paid by your child from Student Space (UPI), or at the academy.'));
      } catch (e) { u.clear(box); box.appendChild(el('div', { class: 'pm-muted' }, 'Could not load fees right now.')); }
    }
    pick.onchange = function () { show(children[pick.selectedIndex]); };
    show(children[0]); return card;
  }

  /* ---------- mounting ---------- */
  function findCard(heading) { var root = document.getElementById('ss-root'); if (!root) return null; var hs = root.querySelectorAll('h2'); for (var i = 0; i < hs.length; i++) if (hs[i].textContent.trim() === heading) return hs[i].closest('.card'); return null; }
  var busy = false;
  async function inject() {
    var root = document.getElementById('ss-root'); if (!root || !sb() || !U() || busy) return;
    var h1 = root.querySelector('.box h1'), t = h1 ? h1.textContent.trim() : '';
    var pending = /^(Waiting for approval|Complete your profile|Account not approved)$/.test(t);
    var u = U(), el = u.el;
    if (pending && !root.querySelector('#pp-parent') && !root.querySelector('#pp-link')) {
      busy = true;
      try {
        var r = await sb().rpc('parent_children');
        if (!root.querySelector('.box h1') || root.querySelector('#pp-parent') || root.querySelector('#pp-link')) return;
        var box = root.querySelector('.box');
        if (r.data && r.data.length) {
          var reload = function () { var old = root.querySelector('#pp-parent'); if (old) old.remove(); busy = false; inject(); };
          var d = await dashboard(r.data, reload); box.before(d); box.style.display = 'none';
        } else {
          var link = el('div', { class: 'pm-card', id: 'pp-link', style: 'max-width:620px;margin:16px auto' }, el('h2', {}, 'Are you a parent?'),
            el('div', { class: 'pm-muted' }, 'Ask your child to open Student Space > "Invite a parent" and make a code. Then type it here to see their marks, homework and fees.'),
            codeForm(function () { var o = root.querySelector('#pp-link'); if (o) o.remove(); busy = false; inject(); }));
          box.after(link);
        }
      } catch (e) { /* stay quiet: normal student sign-up page still works */ } finally { busy = false; }
    }
    if (!pending && findCard('Special notes') && !root.querySelector('#pp-invite')) {
      var c = inviteCard(), a = root.querySelector('#ph-student') || root.querySelector('#pm-student'); if (a) a.after(c); else { var n = findCard('Special notes'); if (n) (n.closest('.cols2') || n).after(c); }
    }
  }
  function start() { var root = document.getElementById('ss-root'); if (!root) return; if (window.PhotonUI && window.PhotonUI.onMount) window.PhotonUI.onMount(inject); inject(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
