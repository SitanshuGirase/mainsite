/* ===================================================================
   Photon Academy - Analytics
     - Admin panel "Analytics" screen: people, fees, enquiries, homework, teacher activity, attendance
     - Teacher Desk "At a glance" card: my students, attendance, homework waiting for review
   Read-only. Every section loads on its own, so one slow or unavailable part never blocks the rest.
   Uses the shared charts from photon-marks.js (load that first). Attendance comes from the Neon service.
   =================================================================== */
(function () {
  'use strict';
  var API = 'https://br-proud-mountain-azsuoe88-attendance.compute.c-3.ap-southeast-1.aws.neon.tech';
  var U = function () { return window.PhotonUI; };
  function sb() { return window.photonSupabase; }
  function rs(p) { return '\u20B9' + (Number(p || 0) / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 }); }
  function iso(d) { return d.toISOString().slice(0, 10); }
  function mkey(s) { return String(s || '').slice(0, 7); }
  function lastMonths(n) { var out = [], d = new Date(); d.setDate(1); for (var i = n - 1; i >= 0; i--) { var x = new Date(d.getFullYear(), d.getMonth() - i, 1); out.push(x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0')); } return out; }
  function monthLabel(k) { try { return new Date(k + '-01T00:00:00').toLocaleDateString(undefined, { month: 'short', year: '2-digit' }); } catch (e) { return k; } }
  function countBars(map, color, limit) {
    var ks = Object.keys(map).sort(function (a, b) { return map[b] - map[a]; }).slice(0, limit || 12), mx = Math.max.apply(null, ks.map(function (k) { return map[k]; }).concat([1]));
    return ks.map(function (k) { return { label: k, value: Math.round(map[k] * 100 / mx), text: String(map[k]), color: color || '#4fd6e8' }; });
  }
  function section(title, build, hint) {
    var u = U(), el = u.el, box = el('div', {}, el('div', { class: 'pm-muted' }, 'Loading\u2026')), card = el('div', { class: 'pm-card' }, el('h2', {}, title), hint ? el('div', { class: 'pm-muted' }, hint) : null, box);
    Promise.resolve().then(build).then(function (node) { u.clear(box); if (node) box.appendChild(node); else card.remove(); }, function () { u.clear(box); box.appendChild(el('div', { class: 'pm-muted' }, 'Not available right now.')); });
    return card;
  }
  async function attReport(days) {
    var s = await sb().auth.getSession(), t = s && s.data && s.data.session && s.data.session.access_token; if (!t) throw new Error('no session');
    var to = new Date(), from = new Date(Date.now() - (days - 1) * 86400000);
    var r = await fetch(API + '/api/report?from=' + iso(from) + '&to=' + iso(to), { headers: { Authorization: 'Bearer ' + t } });
    if (!r.ok) throw new Error('attendance ' + r.status); return r.json();
  }
  function attNode(d, label) {
    var u = U(), el = u.el, st = (d.students || []).filter(function (s) { return s.percent !== null && s.percent !== undefined; });
    if (!st.length) return el('div', { class: 'pm-muted' }, 'No attendance marked in this period yet.');
    var byCls = {}; st.forEach(function (s) { var k = s.class_name || '?', o = byCls[k] = byCls[k] || { a: 0, b: 0 }; o.a += (s.present || 0) + (s.late || 0); o.b += (s.present || 0) + (s.late || 0) + (s.absent || 0); });
    var items = Object.keys(byCls).sort(function (a, b) { return Number(a) - Number(b); }).filter(function (k) { return byCls[k].b > 0; }).map(function (k) { var v = Math.round(byCls[k].a * 1000 / byCls[k].b) / 10; return { label: 'Class ' + k, value: v, color: u.colorFor(v) }; });
    var low = st.filter(function (s) { return s.percent < 75; }).length, t = d.totals || {};
    return el('div', {}, el('div', { class: 'pm-grid' }, u.statBox(t.percent == null ? '\u2014' : t.percent + '%', 'Overall attendance ' + label), u.statBox(low, 'Students below 75%'), u.statBox(st.length, 'Students with records')),
      el('div', { class: 'pm-charts' }, u.chartBox('Attendance by class', u.hbars(items)),
        u.chartBox('Students by level', u.pieChart([{ label: '85% and above', value: st.filter(function (s) { return s.percent >= 85; }).length, color: '#3ddc97' }, { label: '75% to 84%', value: st.filter(function (s) { return s.percent >= 75 && s.percent < 85; }).length, color: '#f5b942' }, { label: 'Below 75%', value: low, color: '#ff6b6b' }]))));
  }

  var peoplePromise = null;
  function loadPeople() { return peoplePromise || (peoplePromise = Promise.resolve(sb().from('profiles').select('id,display_name,role,student_status,class_name,board,created_at').limit(3000)).then(function (r) { if (r.error) { peoplePromise = null; throw r.error; } return r.data || []; })); }

  /* ---------- admin ---------- */
  window.photonAdminAnalytics = function (view) {
    var u = U(); if (!u) { view.textContent = 'The Analytics screen did not load. Please refresh the page.'; return; }
    var el = u.el; u.clear(view); peoplePromise = null;
    view.appendChild(el('div', { class: 'pm-card' }, el('h2', {}, 'Analytics'), el('div', { class: 'pm-muted' }, 'A live picture of the academy. Each part loads on its own. Test marks have their own screen: Marks & analytics.')));
    view.appendChild(section('People', async function () {
      var rows = await loadPeople(), stu = rows.filter(function (x) { return x.role === 'student'; }), ok = stu.filter(function (x) { return x.student_status === 'approved'; }), pend = stu.filter(function (x) { return x.student_status === 'pending'; });
      var mo = lastMonths(1)[0], newM = ok.filter(function (x) { return mkey(x.created_at) === mo; }).length;
      var byCls = {}, byBoard = {}, bySt = { Approved: 0, Pending: 0, Rejected: 0 }, bySign = {};
      stu.forEach(function (x) { bySt[x.student_status === 'approved' ? 'Approved' : x.student_status === 'rejected' ? 'Rejected' : 'Pending']++; });
      ok.forEach(function (x) { var c = 'Class ' + (x.class_name || '?'); byCls[c] = (byCls[c] || 0) + 1; var b = x.board || 'Not set'; byBoard[b] = (byBoard[b] || 0) + 1; });
      lastMonths(6).forEach(function (k) { bySign[monthLabel(k)] = 0; }); stu.forEach(function (x) { var l = monthLabel(mkey(x.created_at)); if (l in bySign) bySign[l]++; });
      var months = lastMonths(6).map(function (k) { return monthLabel(k); }), mxS = Math.max.apply(null, months.map(function (k) { return bySign[k]; }).concat([1]));
      return el('div', {}, el('div', { class: 'pm-grid' }, u.statBox(ok.length, 'Approved students'), u.statBox(pend.length, 'Waiting for approval'), u.statBox(rows.filter(function (x) { return x.role === 'teacher'; }).length, 'Teachers'), u.statBox(newM, 'Joined this month')),
        el('div', { class: 'pm-charts' }, u.chartBox('Students by class', u.hbars(countBars(byCls, '#4fd6e8', 10))), u.chartBox('By board', u.pieChart(Object.keys(byBoard).map(function (k, i) { return { label: k, value: byBoard[k], color: ['#4fd6e8', '#7c6cf0', '#f5b942', '#3ddc97', '#ff6b6b'][i % 5] }; }))),
          u.chartBox('Account status', u.pieChart([{ label: 'Approved', value: bySt.Approved, color: '#3ddc97' }, { label: 'Pending', value: bySt.Pending, color: '#f5b942' }, { label: 'Rejected', value: bySt.Rejected, color: '#ff6b6b' }])),
          u.chartBox('New sign-ups by month', u.hbars(months.map(function (k) { return { label: k, value: Math.round(bySign[k] * 100 / mxS), text: String(bySign[k]) }; })))));
    }));
    view.appendChild(section('Fees', async function () {
      var d = await sb().from('fee_dues').select('id,amount_paise,due_date,status').limit(5000), p = await sb().from('fee_payments').select('due_id,amount_paise,status,reviewed_at,submitted_at').limit(8000);
      if (d.error || p.error) throw (d.error || p.error);
      var today = iso(new Date()), ver = {}, collected = {}, pendingConf = 0;
      (p.data || []).forEach(function (x) { if (x.status === 'verified') { ver[x.due_id] = (ver[x.due_id] || 0) + Number(x.amount_paise || 0); var k = mkey(x.reviewed_at || x.submitted_at); collected[k] = (collected[k] || 0) + Number(x.amount_paise || 0); } else if (x.status === 'submitted') pendingConf++; });
      var out = 0, over = 0; (d.data || []).filter(function (x) { return x.status === 'open'; }).forEach(function (x) { var left = Math.max(0, Number(x.amount_paise) - (ver[x.id] || 0)); out += left; if (x.due_date < today) over += left; });
      var months = lastMonths(6), mx = Math.max.apply(null, months.map(function (k) { return collected[k] || 0; }).concat([1])), thisM = months[months.length - 1];
      return el('div', {}, el('div', { class: 'pm-grid' }, u.statBox(rs(collected[thisM] || 0), 'Collected this month'), u.statBox(rs(out), 'Still to collect'), u.statBox(rs(over), 'Overdue'), u.statBox(pendingConf, 'Payments to confirm')),
        el('div', { class: 'pm-charts' }, u.chartBox('Collected per month', u.hbars(months.map(function (k) { return { label: monthLabel(k), value: Math.round((collected[k] || 0) * 100 / mx), text: rs(collected[k] || 0), color: '#3ddc97' }; }))),
          u.chartBox('Still to collect', u.pieChart([{ label: 'Overdue (\u20B9)', value: Math.round(over / 100), color: '#ff6b6b' }, { label: 'Not yet due (\u20B9)', value: Math.round(Math.max(0, out - over) / 100), color: '#4fd6e8' }]))));
    }));
    view.appendChild(section('Enquiries', async function () {
      var r = await sb().from('form_submissions').select('form_title,status,created_at').order('created_at', { ascending: false }).limit(2000); if (r.error) throw r.error;
      var rows = r.data || []; if (!rows.length) return el('div', { class: 'pm-muted' }, 'No form submissions yet.');
      var wk = Date.now() - 7 * 86400000, byForm = {}, weeks = [0, 0, 0, 0, 0, 0];
      rows.forEach(function (x) { byForm[x.form_title || 'Form'] = (byForm[x.form_title || 'Form'] || 0) + 1; var age = Math.floor((Date.now() - new Date(x.created_at).getTime()) / (7 * 86400000)); if (age >= 0 && age < 6) weeks[age]++; });
      var mx = Math.max.apply(null, weeks.concat([1]));
      return el('div', {}, el('div', { class: 'pm-grid' }, u.statBox(rows.length, 'Total enquiries'), u.statBox(rows.filter(function (x) { return x.status === 'new'; }).length, 'New (not reviewed)'), u.statBox(rows.filter(function (x) { return new Date(x.created_at).getTime() > wk; }).length, 'Last 7 days')),
        el('div', { class: 'pm-charts' }, u.chartBox('By form', u.hbars(countBars(byForm, '#7c6cf0', 8))), u.chartBox('Per week (latest first)', u.hbars(weeks.map(function (n, i) { return { label: i === 0 ? 'This week' : i + ' wk ago', value: Math.round(n * 100 / mx), text: String(n), color: '#f5b942' }; })))));
    }));
    view.appendChild(section('Homework', async function () {
      var people = await loadPeople(), hw = await sb().from('homework').select('id,class_name,created_by,created_at').limit(3000), sub = await sb().from('homework_submissions').select('homework_id,status,reviewed_by,reviewed_at').limit(10000);
      if (hw.error || sub.error) throw (hw.error || sub.error);
      var hws = hw.data || []; if (!hws.length) return el('div', { class: 'pm-muted' }, 'No homework posted yet.');
      var stuBy = {}; people.filter(function (x) { return x.role === 'student' && x.student_status === 'approved'; }).forEach(function (x) { stuBy[x.class_name] = (stuBy[x.class_name] || 0) + 1; });
      var cls = {}, hwCls = {}; hws.forEach(function (h) { hwCls[h.id] = h.class_name; cls[h.class_name] = (cls[h.class_name] || 0) + 1; });
      var done = {}; (sub.data || []).forEach(function (s) { var c = hwCls[s.homework_id]; if (c) done[c] = (done[c] || 0) + 1; });
      var items = Object.keys(cls).sort(function (a, b) { return Number(a) - Number(b); }).map(function (c) { var exp = cls[c] * (stuBy[c] || 0), v = exp ? Math.min(100, Math.round((done[c] || 0) * 1000 / exp) / 10) : 0; return { label: 'Class ' + c, value: v, color: u.colorFor(v) }; });
      var all = sub.data || [], wait = all.filter(function (s) { return s.status === 'submitted'; }).length;
      return el('div', {}, el('div', { class: 'pm-grid' }, u.statBox(hws.length, 'Homework posted'), u.statBox(all.length, 'Submissions'), u.statBox(wait, 'Waiting for review')),
        el('div', { class: 'pm-charts' }, u.chartBox('Submission rate by class', u.hbars(items)), u.chartBox('Submission status', u.pieChart([{ label: 'Reviewed', value: all.filter(function (s) { return s.status === 'reviewed'; }).length, color: '#3ddc97' }, { label: 'Waiting', value: wait, color: '#4fd6e8' }, { label: 'Needs changes', value: all.filter(function (s) { return s.status === 'needs_changes'; }).length, color: '#f5b942' }]))));
    }, 'How many students have handed in what was set.'));
    view.appendChild(section('Teacher activity (last 30 days)', async function () {
      var people = await loadPeople(), since = new Date(Date.now() - 30 * 86400000).toISOString();
      var names = {}; people.filter(function (x) { return x.role === 'teacher' || x.role === 'admin'; }).forEach(function (x) { names[x.id] = x.display_name || '(no name)'; });
      var t = await sb().from('tests').select('created_by,created_at').gte('created_at', since).limit(3000), h = await sb().from('homework').select('created_by,created_at').gte('created_at', since).limit(3000), s = await sb().from('homework_submissions').select('reviewed_by,reviewed_at').gte('reviewed_at', since).limit(10000);
      if (t.error || h.error || s.error) throw (t.error || h.error || s.error);
      var act = {}; function bump(id, k) { if (!id) return; var o = act[id] = act[id] || { tests: 0, hw: 0, rev: 0 }; o[k]++; }
      (t.data || []).forEach(function (x) { bump(x.created_by, 'tests'); }); (h.data || []).forEach(function (x) { bump(x.created_by, 'hw'); }); (s.data || []).forEach(function (x) { bump(x.reviewed_by, 'rev'); });
      var ids = Object.keys(act).sort(function (a, b) { return (act[b].tests + act[b].hw + act[b].rev) - (act[a].tests + act[a].hw + act[a].rev); });
      if (!ids.length) return el('div', { class: 'pm-muted' }, 'No teaching activity recorded in the last 30 days. Attendance marking is on the Attendance screen change log.');
      return el('div', { class: 'pm-scroll' }, el('table', { class: 'pm-tbl' }, el('thead', {}, el('tr', {}, ['Teacher', 'Tests created', 'Homework posted', 'Submissions reviewed'].map(function (x) { return el('th', {}, x); }))),
        el('tbody', {}, ids.map(function (id) { var o = act[id]; return el('tr', {}, el('td', {}, names[id] || 'Teacher'), el('td', {}, o.tests), el('td', {}, o.hw), el('td', {}, o.rev)); }))));
    }));
    view.appendChild(section('Attendance (last 30 days)', async function () { return attNode(await attReport(30), 'last 30 days'); }, 'From the attendance service. Slow the first time it wakes up.'));
  };

  /* ---------- teacher: at a glance ---------- */
  function glanceCard() {
    var u = U(), el = u.el, card = el('div', { class: 'pm-card', id: 'pn-glance' }, el('h2', {}, 'My classes at a glance'), el('div', { class: 'pm-muted' }, 'Loading\u2026'));
    (async function () {
      var parts = [], studs = [];
      try { studs = await u.loadStudents(false); } catch (e) { }
      var byCls = {}; studs.forEach(function (s) { var c = 'Class ' + s.cls; byCls[c] = (byCls[c] || 0) + 1; });
      var wait = 0; try { var r = await sb().from('homework_submissions').select('id', { count: 'exact', head: true }).eq('status', 'submitted'); wait = r.count || 0; } catch (e) { }
      var avgP = null; try { var m = await sb().from('test_marks').select('marks,absent,tests(max_marks)').limit(3000); var ps = (m.data || []).filter(function (x) { return x.tests && x.marks !== null && !x.absent; }).map(function (x) { return u.pct(Number(x.marks), Number(x.tests.max_marks)); }); avgP = ps.length ? u.avg(ps) : null; } catch (e) { }
      var att = null; try { att = await attReport(30); } catch (e) { }
      u.clear(card); card.appendChild(el('h2', {}, 'My classes at a glance'));
      var low = att ? (att.students || []).filter(function (s) { return s.percent !== null && s.percent !== undefined && s.percent < 75; }).length : null;
      card.appendChild(el('div', { class: 'pm-grid' }, u.statBox(studs.length, 'My students'), u.statBox(wait, 'Homework to review'), u.statBox(avgP === null ? '\u2014' : avgP + '%', 'Average test score'), u.statBox(low === null ? '\u2014' : low, 'Below 75% attendance')));
      card.appendChild(el('div', { class: 'pm-charts' }, u.chartBox('Students per class', u.hbars(countBars(byCls, '#4fd6e8', 10))), att ? u.chartBox('Attendance (30 days)', attNode(att, '')) : null));
    })();
    return card;
  }
  function findCard(h) { var root = document.getElementById('ss-root'); if (!root) return null; var hs = root.querySelectorAll('h2'); for (var i = 0; i < hs.length; i++) if (hs[i].textContent.trim() === h) return hs[i].closest('.card'); return null; }
  function inject() {
    var root = document.getElementById('ss-root'); if (!root || !sb() || !U()) return;
    var tn = findCard('Add a special note');
    if (tn && !root.querySelector('#pn-glance')) { var host = tn.closest('.cols2') || tn; host.before(glanceCard()); }
  }
  function start() { var root = document.getElementById('ss-root'); if (!root) return; var t = 0; new MutationObserver(function () { clearTimeout(t); t = setTimeout(inject, 500); }).observe(root, { childList: true, subtree: true }); inject(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
