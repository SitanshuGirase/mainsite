/* ===================================================================
   Photon Academy - Attendance
   One script, three places:
     - Student Space (students):  a "My attendance" card (percentage, months, recent days)
     - Teacher Desk (teachers):   an "Attendance" card: mark a class register, view reports, download CSV
     - Admin panel (admin.html):  an "Attendance" screen (same tools for every class, plus a change log)

   It talks only to the attendance service (hosted on Neon). It never writes to Supabase;
   it borrows the visitor's existing login (window.photonSupabase) to prove who they are.
   =================================================================== */
(function () {
  'use strict';

  var API = 'https://br-proud-mountain-azsuoe88-attendance.compute.c-3.ap-southeast-1.aws.neon.tech';
  var STATUS = [
    { key: 'present', short: 'P', label: 'Present', color: '#3ddc97' },
    { key: 'late', short: 'L', label: 'Late', color: '#f5b942' },
    { key: 'absent', short: 'A', label: 'Absent', color: '#ff6b6b' },
    { key: 'excused', short: 'E', label: 'Excused', color: '#8aa4ff' }
  ];
  var LABEL = {}; STATUS.forEach(function (s) { LABEL[s.key] = s; });

  /* ---------------- helpers ---------------- */
  function el(tag, attrs) {
    var e = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'class') e.className = v;
      else if (k === 'style') e.style.cssText = v;
      else if (k.indexOf('on') === 0) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) add(e, arguments[i]);
    return e;
  }
  function add(p, c) {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { add(p, x); }); return; }
    p.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); return node; }
  function fmtDay(d) { try { return new Date(d + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }); } catch (e) { return d; } }
  function fmtMonth(m) { try { return new Date(m + '-01T00:00:00').toLocaleDateString(undefined, { month: 'short', year: 'numeric' }); } catch (e) { return m; } }
  function fmtWhen(iso) { try { return new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) { return iso; } }
  function addDays(d, n) { var t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); }
  var DARKER = { '#3ddc97': '#0a7d4f', '#f5b942': '#8a5a00', '#ff6b6b': '#c62828', '#8aa4ff': '#3a55c8', '#8b97ad': '#5b6578' };
  function tx(c) { return document.documentElement.getAttribute('data-theme') === 'light' && DARKER[c] ? DARKER[c] : c; }
  function pctColor(p) { return tx(p === null || p === undefined ? '#8b97ad' : p >= 85 ? '#3ddc97' : p >= 75 ? '#f5b942' : '#ff6b6b'); }
  function fillColor(p) { return p === null || p === undefined ? '#8b97ad' : p >= 85 ? '#3ddc97' : p >= 75 ? '#f5b942' : '#ff6b6b'; }
  function pctText(p) { return p === null || p === undefined ? '\u2014' : p + '%'; }
  function msg(box, text, kind) { box.textContent = text || ''; box.className = 'pa-msg' + (kind ? ' ' + kind : ''); }

  var css = el('style', {});
  css.textContent = [
    '.pa-card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:18px;margin-top:16px;text-align:left}',
    '.pa-card h2{margin:0 0 4px;font-size:18px}',
    '.pa-card h3{margin:16px 0 6px;font:inherit;font-weight:600;font-size:15px}',
    '.pa-muted{opacity:.72;font-size:13px}',
    '.pa-card .pa-top select.pa-in{width:auto !important}',
    '.pa-top{display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap}',
    '.pa-card .pa-btn{border:1px solid rgba(255,255,255,.22);background:transparent;color:inherit;border-radius:10px;padding:7px 12px;font:inherit;font-size:13px;cursor:pointer;width:auto !important;margin:0 !important}',
    '.pa-card .pa-btn.pri{background:#4fd6e8;color:#06202a;border-color:#4fd6e8;font-weight:600}',
    '.pa-card .pa-btn.on{background:rgba(79,214,232,.18);border-color:#4fd6e8}',
    '.pa-btn:disabled{opacity:.5;cursor:not-allowed}',
    '.pa-in{background:rgba(8,14,26,.6);border:1px solid rgba(255,255,255,.16);color:inherit;border-radius:10px;padding:8px 10px;font:inherit;font-size:14px;width:auto;max-width:100%;margin:0}',
    '.pa-bar{display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;margin:12px 0}',
    '.pa-card .pa-bar > label{display:flex !important;flex-direction:column !important;align-items:flex-start !important;gap:4px;font-size:12.5px;opacity:.9;margin:0 !important}',
    '.pa-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0 4px}',
    '.pa-msg{min-height:20px;margin-top:8px;font-size:13.5px}',
    '.pa-msg.ok{color:#3ddc97}.pa-msg.bad{color:#ff8b8b}',
    '.pa-big{font-size:44px;font-weight:700;line-height:1}',
    '.pa-hero{display:flex;gap:22px;align-items:center;flex-wrap:wrap;margin:14px 0}',
    '.pa-chips{display:flex;gap:8px;flex-wrap:wrap}',
    '.pa-chip{border-radius:99px;padding:5px 12px;font-size:13px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05)}',
    '.pa-chip b{margin-left:5px}',
    '.pa-track{height:8px;border-radius:99px;background:rgba(255,255,255,.1);overflow:hidden}',
    '.pa-fill{height:100%;border-radius:99px}',
    '.pa-month{display:grid;grid-template-columns:90px 1fr auto;gap:10px;align-items:center;margin:8px 0;font-size:13.5px}',
    '.pa-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}',
    '.pa-table{width:100%;border-collapse:collapse;font-size:13.5px}',
    '.pa-table th,.pa-table td{padding:8px 9px;border-bottom:1px solid rgba(255,255,255,.09);text-align:left;white-space:nowrap}',
    '.pa-table th{opacity:.7;font-weight:600;font-size:12.5px}',
    '.pa-table td.n,.pa-table th.n{text-align:right}',
    '.pa-pill{display:inline-block;border-radius:99px;padding:2px 10px;font-size:12px;font-weight:700;color:#06121a}',
    '.pa-row{display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap;padding:9px 0;border-bottom:1px solid rgba(255,255,255,.08)}',
    '.pa-name{flex:1 1 150px;min-width:0;overflow-wrap:anywhere}',
    '.pa-seg{display:flex;gap:5px;align-items:center}',
    '.pa-seg button{width:38px;height:34px;border-radius:9px;border:1px solid rgba(255,255,255,.2);background:transparent;color:inherit;font:inherit;font-weight:700;cursor:pointer;padding:0;margin:0}',
    '.pa-seg button.x{width:28px;opacity:.6;font-weight:400}',
    '.pa-seg button:disabled{opacity:.45;cursor:not-allowed}',
    '.pa-note{flex:1 1 100%;margin-top:2px}',
    '.pa-banner{padding:10px 12px;border-radius:10px;background:rgba(245,185,66,.12);border:1px solid rgba(245,185,66,.4);font-size:13.5px;margin:10px 0}',
    '.pa-empty{opacity:.7;padding:14px 0;font-size:14px}',
    '.pa-detail td{background:rgba(255,255,255,.03);white-space:normal}'
  ].join('\n');
  document.head.appendChild(css);

  /* ---------------- talking to the attendance service ---------------- */
  async function token() {
    var sb = window.photonSupabase;
    if (!sb) throw new Error('The page is still loading. Please try again.');
    var r = await sb.auth.getSession();
    var s = r && r.data && r.data.session;
    if (!s) throw new Error('Please sign in again.');
    return s.access_token;
  }
  async function call(path, opts) {
    opts = opts || {};
    var t = await token();
    var init = { method: opts.method || 'GET', headers: Object.assign({ Authorization: 'Bearer ' + t }, opts.headers || {}) };
    if (opts.body !== undefined) { init.body = JSON.stringify(opts.body); init.headers['Content-Type'] = 'application/json'; }
    var res;
    try { res = await fetch(API + path, init); }
    catch (e) { throw new Error('Could not reach the attendance service. Check your internet and try again.'); }
    if (opts.raw && res.ok) return res;
    var data = null;
    try { data = await res.json(); } catch (e) { /* not JSON */ }
    if (!res.ok) throw new Error((data && data.error) || 'Something went wrong (' + res.status + ').');
    return data;
  }
  function qs(o) {
    var p = [];
    Object.keys(o).forEach(function (k) { if (o[k] !== undefined && o[k] !== null && o[k] !== '') p.push(encodeURIComponent(k) + '=' + encodeURIComponent(o[k])); });
    return p.length ? '?' + p.join('&') : '';
  }

  /* =================================================================
     STUDENT: "My attendance"
     ================================================================= */
  function myCard() {
    var body = el('div', {}, el('div', { class: 'pa-empty' }, 'Loading\u2026'));
    var range = el('select', { class: 'pa-in', 'aria-label': 'Period' },
      el('option', { value: '30' }, 'Last 30 days'), el('option', { value: '90', selected: true }, 'Last 3 months'),
      el('option', { value: '180' }, 'Last 6 months'), el('option', { value: '365' }, 'Last year'));
    range.value = '90';
    var card = el('div', { class: 'pa-card', id: 'pa-student' },
      el('div', { class: 'pa-top' }, el('h2', {}, 'My attendance'), range), body);

    async function load() {
      clear(body).appendChild(el('div', { class: 'pa-empty' }, 'Loading\u2026'));
      try {
        var me = await call('/api/me');
        var d = await call('/api/my' + qs({ from: addDays(me.today, -(Number(range.value) - 1)), to: me.today }));
        draw(d);
      } catch (e) { clear(body).appendChild(el('div', { class: 'pa-empty' }, e.message)); }
    }

    function draw(d) {
      clear(body);
      var s = d.summary;
      if (!s.days) { body.appendChild(el('div', { class: 'pa-empty' }, 'No attendance has been marked for this period yet.')); return; }
      body.appendChild(el('div', { class: 'pa-hero' },
        el('div', {}, el('div', { class: 'pa-big', style: 'color:' + pctColor(s.percent) }, pctText(s.percent)),
          el('div', { class: 'pa-muted' }, s.days + ' day' + (s.days === 1 ? '' : 's') + ' marked')),
        el('div', { class: 'pa-chips' }, STATUS.map(function (st) {
          return el('span', { class: 'pa-chip', style: 'border-color:' + st.color + '66' }, st.label, el('b', { style: 'color:' + tx(st.color) }, s[st.key]));
        }))));
      if (s.percent !== null && s.percent < 75) {
        body.appendChild(el('div', { class: 'pa-banner' }, 'Your attendance is below 75%. Please try to attend regularly, and speak to your teacher if something is getting in the way.'));
      }
      body.appendChild(el('div', { class: 'pa-muted' }, 'Attendance counts Present and Late days out of Present, Late and Absent days. Excused days are not counted against you.'));
      body.appendChild(el('h3', {}, 'By month'));
      d.months.forEach(function (m) {
        body.appendChild(el('div', { class: 'pa-month' },
          el('span', {}, fmtMonth(m.month)),
          el('div', { class: 'pa-track' }, el('div', { class: 'pa-fill', style: 'width:' + (m.percent || 0) + '%;background:' + fillColor(m.percent) })),
          el('span', { style: 'color:' + pctColor(m.percent) + ';font-weight:700' }, pctText(m.percent))));
      });
      body.appendChild(el('h3', {}, 'Recent days'));
      var rows = d.records.slice(0, 20).map(function (r) {
        var st = LABEL[r.status];
        return el('tr', {}, el('td', {}, fmtDay(r.date)), el('td', {}, r.subject || 'Full day'),
          el('td', {}, el('span', { class: 'pa-pill', style: 'background:' + st.color }, st.label)));
      });
      body.appendChild(el('div', { class: 'pa-scroll' }, el('table', { class: 'pa-table' },
        el('thead', {}, el('tr', {}, el('th', {}, 'Date'), el('th', {}, 'Subject'), el('th', {}, 'Status'))), el('tbody', {}, rows))));
    }

    range.addEventListener('change', load);
    load();
    return card;
  }

  /* =================================================================
     STAFF (teachers and admins): mark, report, change log
     ================================================================= */
  function classOptions(students) {
    var by = {};
    students.forEach(function (s) { var c = s.class_name || '?'; (by[c] = by[c] || []).push(s); });
    var out = [];
    Object.keys(by).sort(function (a, b) { return (Number(a) - Number(b)) || a.localeCompare(b); }).forEach(function (c) {
      var list = by[c], seen = {};
      out.push({ label: 'Class ' + c + ' \u2014 everyone (' + list.length + ')', f: { class_name: c, board: '', division: '' } });
      list.forEach(function (s) { var k = (s.board || '') + '|' + (s.division || ''); (seen[k] = seen[k] || { board: s.board || '', division: s.division || '', n: 0 }).n++; });
      var combos = Object.keys(seen).map(function (k) { return seen[k]; });
      if (combos.length > 1) combos.sort(function (a, b) { return (a.board + a.division).localeCompare(b.board + b.division); }).forEach(function (x) {
        out.push({ label: 'Class ' + c + (x.board ? ' \u00B7 ' + x.board : '') + (x.division ? ' \u00B7 Division ' + x.division : '') + ' (' + x.n + ')', f: { class_name: c, board: x.board, division: x.division } });
      });
    });
    return out;
  }

  function staffPanel(opts) {
    var admin = !!opts.admin;
    var card = el('div', { class: 'pa-card', id: admin ? 'pa-admin' : 'pa-teacher' },
      el('h2', {}, 'Attendance'), el('div', { class: 'pa-empty' }, 'Loading\u2026'));
    Promise.all([call('/api/me'), call('/api/roster')]).then(function (r) { build(r[0], r[1].students); })
      .catch(function (e) { clear(card).appendChild(el('h2', {}, 'Attendance')); card.appendChild(el('div', { class: 'pa-empty' }, e.message)); });

    function build(me, students) {
      clear(card);
      card.appendChild(el('h2', {}, 'Attendance'));
      if (!students.length) {
        card.appendChild(el('div', { class: 'pa-empty' }, admin ? 'There are no approved students yet.' : 'No students are assigned to you yet. Ask the academy admin to add your classes.'));
        return;
      }
      var classes = classOptions(students);
      var panes = {}, tabBtns = {};
      var tabs = el('div', { class: 'pa-tabs' });
      var holder = el('div');
      var defs = [['mark', 'Mark attendance', markPane], ['report', 'Reports', reportPane]];
      if (admin) defs.push(['log', 'Change log', logPane]);
      defs.forEach(function (d) {
        var b = el('button', { type: 'button', class: 'pa-btn', onclick: function () { show(d[0]); } }, d[1]);
        tabBtns[d[0]] = b; tabs.appendChild(b);
      });
      function show(k) {
        defs.forEach(function (d) {
          if (d[0] === k && !panes[k]) { panes[k] = d[2](me, classes); holder.appendChild(panes[k]); }
          if (panes[d[0]]) panes[d[0]].style.display = d[0] === k ? '' : 'none';
          tabBtns[d[0]].className = 'pa-btn' + (d[0] === k ? ' on' : '');
        });
      }
      card.appendChild(el('div', { class: 'pa-muted' }, admin ? 'Mark any class, see reports for everyone, and review every change.' : 'You can mark attendance for your own students, up to ' + me.teacher_edit_days + ' days back.'));
      card.appendChild(tabs); card.appendChild(holder);
      show('mark');
    }
    return card;
  }

  function classSelect(classes, withAll) {
    var s = el('select', { class: 'pa-in' });
    if (withAll) s.appendChild(el('option', { value: '' }, 'All classes'));
    classes.forEach(function (c, i) { s.appendChild(el('option', { value: String(i) }, c.label)); });
    s._filter = function () { return s.value === '' ? { class_name: '', board: '', division: '' } : classes[Number(s.value)].f; };
    return s;
  }
  function field(label, input) { return el('label', {}, label, input); }

  /* ---------- mark a register ---------- */
  function markPane(me, classes) {
    var admin = me.role === 'admin';
    var cls = classSelect(classes, false);
    var date = el('input', { type: 'date', class: 'pa-in', value: me.today, max: me.today, min: addDays(me.today, -(admin ? 365 : me.teacher_edit_days)) });
    var subject = el('input', { class: 'pa-in', list: 'pa-subjects', placeholder: 'Full day', maxlength: '40', style: 'width:150px' });
    var list = el('datalist', { id: 'pa-subjects' }, ['Physics', 'Chemistry', 'Maths', 'Biology', 'English', 'Science', 'Social Science'].map(function (s) { return el('option', { value: s }); }));
    var body = el('div'), out = el('div', { class: 'pa-msg' });
    var saveBtn = el('button', { type: 'button', class: 'pa-btn pri' }, 'Save attendance');
    var allBtn = el('button', { type: 'button', class: 'pa-btn' }, 'Mark everyone present');
    var summary = el('span', { class: 'pa-muted' });
    var data = null, dirty = false, seq = 0;

    function filter() { return cls._filter(); }
    function paramsOf() { var f = filter(); return { date: date.value, subject: subject.value.trim(), class_name: f.class_name, board: f.board, division: f.division }; }

    async function load() {
      var my = ++seq;
      data = null; saveBtn.disabled = true; allBtn.disabled = true; // nothing can be saved while the register is loading
      msg(out, ''); clear(body).appendChild(el('div', { class: 'pa-empty' }, 'Loading\u2026'));
      try {
        var d = await call('/api/register' + qs(paramsOf()));
        if (my !== seq) return;
        data = d; dirty = false; draw();
      } catch (e) { if (my === seq) { clear(body).appendChild(el('div', { class: 'pa-empty' }, e.message)); data = null; } }
    }
    var last = { c: cls.value, d: date.value, s: subject.value };
    function onChange() {
      if (cls.value === last.c && date.value === last.d && subject.value.trim() === last.s.trim()) return; // nothing really changed
      if (dirty && !window.confirm('You have unsaved changes. Discard them?')) { cls.value = last.c; date.value = last.d; subject.value = last.s; return; }
      last = { c: cls.value, d: date.value, s: subject.value };
      load();
    }
    [cls, date, subject].forEach(function (c) { c.addEventListener('change', onChange); });

    function counts() {
      var c = { present: 0, late: 0, absent: 0, excused: 0, none: 0 };
      data.students.forEach(function (s) { c[s.status || 'none']++; });
      return c;
    }
    function updateSummary() {
      var c = counts();
      summary.textContent = STATUS.map(function (s) { return c[s.key] + ' ' + s.label.toLowerCase(); }).join(' \u00B7 ') + ' \u00B7 ' + c.none + ' not marked';
    }

    function draw() {
      clear(body);
      var locked = !data.editable;
      if (!data.students.length) { body.appendChild(el('div', { class: 'pa-empty' }, 'No students in this class.')); saveBtn.disabled = true; allBtn.disabled = true; return; }
      if (locked) {
        body.appendChild(el('div', { class: 'pa-banner' }, data.date > data.today
          ? 'You cannot mark attendance for a future date.'
          : 'This date is locked. Teachers can change the last ' + me.teacher_edit_days + ' days; ask an admin to change older dates.'));
      }
      saveBtn.disabled = locked; allBtn.disabled = locked;
      data.students.forEach(function (s, i) {
        var seg = el('div', { class: 'pa-seg' });
        var noteRow = el('input', { class: 'pa-in pa-note', maxlength: '200', placeholder: 'Note (optional)', style: s.note ? '' : 'display:none', value: s.note || '' });
        noteRow.addEventListener('input', function () { s.note = noteRow.value; dirty = true; });
        function paint() {
          clear(seg);
          STATUS.forEach(function (st) {
            var on = s.status === st.key;
            seg.appendChild(el('button', {
              type: 'button', title: st.label, 'aria-label': st.label + ' for ' + s.name, 'aria-pressed': on ? 'true' : 'false', disabled: locked,
              style: on ? 'background:' + st.color + ';border-color:' + st.color + ';color:#06121a' : '',
              onclick: function () { s.status = st.key; dirty = true; paint(); updateSummary(); }
            }, st.short));
          });
          seg.appendChild(el('button', { type: 'button', class: 'x', title: 'Clear', 'aria-label': 'Clear ' + s.name, disabled: locked, onclick: function () { s.status = null; dirty = true; paint(); updateSummary(); } }, '\u00D7'));
          seg.appendChild(el('button', { type: 'button', class: 'x', title: 'Add a note', 'aria-label': 'Note for ' + s.name, disabled: locked, onclick: function () { noteRow.style.display = noteRow.style.display === 'none' ? '' : 'none'; } }, '\u270E'));
        }
        paint();
        body.appendChild(el('div', { class: 'pa-row' },
          el('div', { class: 'pa-name' }, (i + 1) + '. ' + s.name, s.marked_by ? el('span', { class: 'pa-muted' }, '  \u00B7 marked by ' + s.marked_by) : null),
          seg, noteRow));
      });
      updateSummary();
    }

    allBtn.addEventListener('click', function () {
      if (!data) return;
      data.students.forEach(function (s) { if (!s.status) s.status = 'present'; });
      dirty = true; draw();
    });
    saveBtn.addEventListener('click', async function () {
      if (!data || !data.editable) return;
      saveBtn.disabled = true; msg(out, 'Saving\u2026');
      try {
        var p = paramsOf();
        var r = await call('/api/register', { method: 'PUT', body: { date: p.date, subject: p.subject, class_name: p.class_name, board: p.board, division: p.division,
          records: data.students.map(function (s) { return { student_id: s.id, status: s.status || null, note: s.note || '' }; }) } });
        msg(out, 'Saved. ' + r.saved + ' marked' + (r.cleared ? ', ' + r.cleared + ' cleared' : '') + '.', 'ok');
        dirty = false; await load(); msg(out, 'Saved.', 'ok');
      } catch (e) { msg(out, e.message, 'bad'); }
      saveBtn.disabled = !(data && data.editable);
    });

    var pane = el('div', {},
      el('div', { class: 'pa-bar' }, field('Class', cls), field('Date', date), field('Subject', subject), list),
      el('div', { class: 'pa-bar', style: 'margin-top:0' }, allBtn, summary),
      body, el('div', { class: 'pa-bar' }, saveBtn), out);
    load();
    return pane;
  }

  /* ---------- reports ---------- */
  function reportPane(me, classes) {
    var admin = me.role === 'admin';
    var cls = classSelect(classes, true);
    var from = el('input', { type: 'date', class: 'pa-in', value: me.today.slice(0, 8) + '01', max: me.today });
    var to = el('input', { type: 'date', class: 'pa-in', value: me.today, max: me.today });
    var subject = el('input', { class: 'pa-in', list: 'pa-subjects', placeholder: 'All subjects', maxlength: '40', style: 'width:150px' });
    var go = el('button', { type: 'button', class: 'pa-btn pri' }, 'Show report');
    var csv = el('button', { type: 'button', class: 'pa-btn' }, 'Download CSV');
    var body = el('div'), out = el('div', { class: 'pa-msg' });

    function params() { var f = cls._filter(); return { from: from.value, to: to.value, subject: subject.value.trim(), class_name: f.class_name, board: f.board, division: f.division }; }

    async function run() {
      msg(out, ''); clear(body).appendChild(el('div', { class: 'pa-empty' }, 'Loading\u2026'));
      try { draw(await call('/api/report' + qs(params()))); }
      catch (e) { clear(body).appendChild(el('div', { class: 'pa-empty' }, e.message)); }
    }
    function draw(d) {
      clear(body);
      if (!d.students.length) { body.appendChild(el('div', { class: 'pa-empty' }, 'No students found.')); return; }
      var t = d.totals;
      body.appendChild(el('div', { class: 'pa-hero' },
        el('div', {}, el('div', { class: 'pa-big', style: 'color:' + pctColor(t.percent) }, pctText(t.percent)), el('div', { class: 'pa-muted' }, 'overall')),
        el('div', { class: 'pa-chips' }, STATUS.map(function (st) { return el('span', { class: 'pa-chip', style: 'border-color:' + st.color + '66' }, st.label, el('b', { style: 'color:' + tx(st.color) }, t[st.key])); }))));
      var tbody = el('tbody');
      d.students.forEach(function (s) {
        var tr = el('tr', { style: 'cursor:pointer', title: 'Show this student\u2019s days' },
          el('td', {}, s.name), el('td', {}, 'Class ' + (s.class_name || '?') + (s.board ? ' \u00B7 ' + s.board : '') + (s.division ? ' \u00B7 ' + s.division : '')),
          el('td', { class: 'n' }, s.present), el('td', { class: 'n' }, s.late), el('td', { class: 'n' }, s.absent), el('td', { class: 'n' }, s.excused), el('td', { class: 'n' }, s.days),
          el('td', { class: 'n' }, el('span', { class: 'pa-pill', style: 'background:' + fillColor(s.percent) }, pctText(s.percent))));
        var detailRow = null;
        tr.addEventListener('click', async function () {
          if (detailRow) { detailRow.remove(); detailRow = null; return; }
          detailRow = el('tr', { class: 'pa-detail' }, el('td', { colspan: '8' }, 'Loading\u2026'));
          tr.after(detailRow);
          try {
            var h = await call('/api/student/' + s.id + qs({ from: d.from, to: d.to }));
            var cell = clear(detailRow.firstChild);
            if (!h.records.length) { cell.textContent = 'No attendance marked in this period.'; return; }
            h.records.slice(0, 40).forEach(function (r) {
              var st = LABEL[r.status];
              cell.appendChild(el('span', { class: 'pa-chip', style: 'display:inline-block;margin:3px 6px 3px 0;border-color:' + st.color + '88' }, fmtDay(r.date) + (r.subject ? ' \u00B7 ' + r.subject : ''), el('b', { style: 'color:' + tx(st.color) }, st.label)));
            });
          } catch (e) { clear(detailRow.firstChild).textContent = e.message; }
        });
        tbody.appendChild(tr);
      });
      body.appendChild(el('div', { class: 'pa-scroll' }, el('table', { class: 'pa-table' },
        el('thead', {}, el('tr', {}, el('th', {}, 'Student'), el('th', {}, 'Class'), ['Present', 'Late', 'Absent', 'Excused', 'Days'].map(function (h) { return el('th', { class: 'n' }, h); }), el('th', { class: 'n' }, '%'))), tbody)));
      body.appendChild(el('div', { class: 'pa-muted', style: 'margin-top:8px' }, 'Percent = (Present + Late) \u00F7 (Present + Late + Absent). Excused days are not counted. Tap a student to see their days.'));
    }

    go.addEventListener('click', run);
    csv.addEventListener('click', async function () {
      csv.disabled = true; msg(out, 'Preparing the file\u2026');
      try {
        var p = params(); p.format = 'csv';
        var res = await call('/api/report' + qs(p), { raw: true });
        var blob = await res.blob();
        var url = URL.createObjectURL(blob);
        var a = el('a', { href: url, download: 'attendance_' + from.value + '_to_' + to.value + '.csv' });
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
        msg(out, 'Downloaded.', 'ok');
      } catch (e) { msg(out, e.message, 'bad'); }
      csv.disabled = false;
    });
    var pane = el('div', {}, el('div', { class: 'pa-bar' }, field('Class', cls), field('From', from), field('To', to), field('Subject', subject), go, csv), out, body);
    run();
    return pane;
  }

  /* ---------- change log (admin) ---------- */
  function logPane() {
    var body = el('div', {}, el('div', { class: 'pa-empty' }, 'Loading\u2026'));
    var verbs = { mark: 'Marked', change: 'Changed', clear: 'Cleared' };
    call('/api/audit?limit=200').then(function (d) {
      clear(body);
      if (!d.items.length) { body.appendChild(el('div', { class: 'pa-empty' }, 'No changes yet.')); return; }
      body.appendChild(el('div', { class: 'pa-scroll' }, el('table', { class: 'pa-table' },
        el('thead', {}, el('tr', {}, ['When', 'By', 'Action', 'Student', 'Date', 'Class', 'Change'].map(function (h) { return el('th', {}, h); }))),
        el('tbody', {}, d.items.map(function (i) {
          var ch = i.action === 'change' ? (i.old_status + ' \u2192 ' + i.new_status) : i.action === 'clear' ? (i.old_status + ' removed') : i.new_status;
          return el('tr', {}, el('td', {}, fmtWhen(i.at)), el('td', {}, i.actor_name || '\u2014'), el('td', {}, verbs[i.action] || i.action), el('td', {}, i.student_name || ''),
            el('td', {}, fmtDay(i.date)), el('td', {}, (i.class_name ? 'Class ' + i.class_name : '') + (i.subject ? ' \u00B7 ' + i.subject : '')), el('td', {}, ch));
        })))));
    }).catch(function (e) { clear(body).appendChild(el('div', { class: 'pa-empty' }, e.message)); });
    return body;
  }

  /* ---------------- plug into the pages ---------------- */
  window.photonAdminAttendance = function (view) { clear(view); view.appendChild(staffPanel({ admin: true })); };

  function findCard(heading) {
    var root = document.getElementById('ss-root');
    if (!root) return null;
    var hs = root.querySelectorAll('h2');
    for (var i = 0; i < hs.length; i++) if (hs[i].textContent.trim() === heading) return hs[i].closest('.card');
    return null;
  }
  function inject() {
    var root = document.getElementById('ss-root');
    if (!root) return;
    var sn = findCard('Special notes');
    if (sn && !root.querySelector('#pa-student')) {
      var docs = root.querySelector('#pd-student');
      var c = myCard();
      if (docs) docs.before(c); else (sn.closest('.cols2') || sn).after(c);
    }
    var tn = findCard('Add a special note');
    if (tn && !root.querySelector('#pa-teacher')) {
      var docsT = root.querySelector('#pd-teacher');
      var t = staffPanel({ admin: false });
      if (docsT) docsT.before(t); else (tn.closest('.cols2') || tn).after(t);
    }
  }
  function start() {
    var root = document.getElementById('ss-root');
    if (!root) return;
    var timer = 0;
    new MutationObserver(function () { clearTimeout(timer); timer = setTimeout(inject, 150); }).observe(root, { childList: true, subtree: true });
    inject();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
