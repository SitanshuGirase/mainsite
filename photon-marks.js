/* ===================================================================
   Photon Academy - Test marks and analytics
   One script, three places (same pattern as photon-attendance.js):
     - Student Space (students): "My test marks" card with trend, subject bars, score-band pie
     - Teacher Desk (teachers):  "Test marks" card: create a test, enter marks, publish, charts
     - Admin panel (admin.html): "Marks & analytics" screen (all classes)
   It uses only Supabase tables `tests` and `test_marks` (privacy rules are in the database)
   and the visitor's existing login (window.photonSupabase). Charts are drawn here as small
   SVG/HTML graphics: no chart library, nothing extra to download.
   =================================================================== */
(function () {
  'use strict';

  var BANDS = [
    { label: '80-100%', color: '#3ddc97' },
    { label: '60-79%', color: '#4fd6e8' },
    { label: '40-59%', color: '#f5b942' },
    { label: 'Below 40%', color: '#ff6b6b' }
  ];
  function bandOf(p) { return p >= 80 ? 0 : p >= 60 ? 1 : p >= 40 ? 2 : 3; }

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
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); return n; }
  var NS = 'http://www.w3.org/2000/svg';
  function S(tag, attrs) {
    var e = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    for (var i = 2; i < arguments.length; i++) if (arguments[i]) e.appendChild(arguments[i]);
    return e;
  }
  function sb() { return window.photonSupabase; }
  var ICO = { check: '<path d="M20 6 9 17l-5-5"/>', x: '<path d="M18 6 6 18M6 6l12 12"/>', back: '<path d="M19 12H5M12 19l-7-7 7-7"/>' };
  function ico(n, color) {
    var s = document.createElement('span'); s.setAttribute('aria-hidden', 'true');
    s.style.cssText = 'display:inline-block;width:1.1em;height:1.1em;vertical-align:-.2em;margin-right:.3em;' + (color ? 'color:' + color : '');
    s.innerHTML = '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + ICO[n] + '</svg>';
    return s;
  }
  function num(v) { var n = Number(v); return isFinite(n) ? n : null; }
  function pct(m, mx) { return mx > 0 ? Math.round((m / mx) * 1000) / 10 : 0; }
  function avg(a) { return a.length ? Math.round((a.reduce(function (x, y) { return x + y; }, 0) / a.length) * 10) / 10 : null; }
  function fmtDate(d) { try { return new Date(d + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return d; } }
  function shortDate(d) { try { return new Date(d + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' }); } catch (e) { return d; } }
  function msg(box, text, kind) { box.textContent = text || ''; box.className = 'pm-msg' + (kind ? ' ' + kind : ''); }
  function friendly(e) {
    var m = (e && e.message) || String(e || '');
    if (/row-level security|permission|not allowed/i.test(m)) return 'You are not allowed to do that for this class.';
    if (/Marks cannot be more/i.test(m)) return m;
    return 'Something went wrong. Please try again.';
  }

  var css = el('style', {});
  css.textContent = [
    '.pm-card{border:1px solid rgba(127,127,127,.38);border-radius:14px;padding:18px;margin-top:16px;background:rgba(127,127,127,.09);text-align:left}',
    '.pm-card h2{margin:0 0 4px;font-size:18px}.pm-card h3{margin:16px 0 6px;font:inherit;font-weight:600;font-size:15px}',
    '.pm-muted{opacity:.75;font-size:13px}.pm-msg{min-height:20px;margin-top:8px;font-size:13.5px}.pm-msg.err{color:#ff7b7b}.pm-msg.ok{color:#3ddc97}',
    '.pm-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:10px 0}',
    '.pm-stat{border:1px solid rgba(127,127,127,.38);border-radius:12px;padding:10px 12px}.pm-stat b{display:block;font-size:22px}.pm-stat span{font-size:12.5px;opacity:.75}',
    '.pm-row{display:flex;gap:10px;justify-content:space-between;align-items:center;flex-wrap:wrap;border:1px solid rgba(127,127,127,.38);border-radius:12px;padding:10px 12px;margin:8px 0}',
    '.pm-row .t{flex:1 1 200px;min-width:0;overflow-wrap:anywhere}',
    '.pm-btn{border:1px solid rgba(127,127,127,.5);background:transparent;color:inherit;border-radius:10px;padding:8px 14px;font:inherit;font-size:13.5px;cursor:pointer}',
    '.pm-btn.pri{background:#4fd6e8;border-color:#4fd6e8;color:#06202a;font-weight:600}.pm-btn.bad{border-color:#ff7b7b;color:#ff7b7b}.pm-btn:disabled{opacity:.5;cursor:not-allowed}',
    '.pm-in{width:100%;box-sizing:border-box;background:transparent;color:inherit;border:1px solid rgba(127,127,127,.5);border-radius:10px;padding:8px 10px;font:inherit;font-size:14px}',
    '.pm-form{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:10px 0}.pm-form label{font-size:12.5px;opacity:.8;display:block;margin-bottom:3px}',
    '.pm-badge{display:inline-block;border-radius:99px;border:1px solid rgba(127,127,127,.45);padding:1px 10px;font-size:12px;margin-left:6px}.pm-badge.ok{color:#2fb37c;border-color:#2fb37c}.pm-badge.off{color:#d99a1c;border-color:#d99a1c}',
    '.pm-charts{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;margin:8px 0}',
    '.pm-chart{border:1px solid rgba(127,127,127,.3);border-radius:12px;padding:10px 12px;min-width:0}',
    '.pm-bar{display:grid;grid-template-columns:minmax(70px,32%) 1fr 48px;gap:8px;align-items:center;margin:5px 0;font-size:13px}',
    '.pm-bar .l{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.pm-track{height:12px;border-radius:99px;background:rgba(127,127,127,.22);overflow:hidden}.pm-fill{height:100%;border-radius:99px}',
    '.pm-pie{display:flex;gap:14px;align-items:center;flex-wrap:wrap}.pm-legend div{font-size:13px;margin:3px 0}.pm-legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:6px}',
    '.pm-scroll{overflow-x:auto}.pm-tbl{width:100%;border-collapse:collapse;font-size:14px}.pm-tbl th,.pm-tbl td{padding:6px 8px;border-bottom:1px solid rgba(127,127,127,.25);text-align:left;vertical-align:middle}.pm-tbl input[type=number]{width:84px}'
  ].join('\n');
  document.head.appendChild(css);

  /* ---------------- charts ---------------- */
  function lineChart(points) {
    if (points.length < 2) return el('div', { class: 'pm-muted' }, 'A trend line appears after two tests.');
    var W = 320, H = 150, L = 30, R = 10, T = 10, B = 22, n = points.length;
    var svg = S('svg', { viewBox: '0 0 ' + W + ' ' + H, width: '100%', role: 'img', 'aria-label': 'Score trend line chart' });
    [0, 50, 100].forEach(function (g) {
      var y = T + (100 - g) * (H - T - B) / 100;
      svg.appendChild(S('line', { x1: L, x2: W - R, y1: y, y2: y, stroke: 'currentColor', 'stroke-opacity': '.2' }));
      var t = S('text', { x: L - 4, y: y + 4, 'text-anchor': 'end', 'font-size': '10', fill: 'currentColor', 'fill-opacity': '.7' }); t.textContent = g; svg.appendChild(t);
    });
    var xs = function (i) { return L + i * (W - L - R) / (n - 1); }, ys = function (v) { return T + (100 - Math.max(0, Math.min(100, v))) * (H - T - B) / 100; };
    svg.appendChild(S('polyline', { points: points.map(function (p, i) { return xs(i) + ',' + ys(p.value); }).join(' '), fill: 'none', stroke: '#4fd6e8', 'stroke-width': '2.5', 'stroke-linejoin': 'round' }));
    points.forEach(function (p, i) {
      var c = S('circle', { cx: xs(i), cy: ys(p.value), r: '3.6', fill: '#4fd6e8' }), ti = S('title', {}); ti.textContent = p.label + ': ' + p.value + '%'; c.appendChild(ti); svg.appendChild(c);
    });
    [[0, 'start'], [n - 1, 'end']].forEach(function (a) {
      var t = S('text', { x: xs(a[0]), y: H - 6, 'text-anchor': a[1], 'font-size': '10', fill: 'currentColor', 'fill-opacity': '.7' }); t.textContent = points[a[0]].short; svg.appendChild(t);
    });
    return svg;
  }
  function pieChart(slices) {
    var tot = slices.reduce(function (a, s) { return a + s.value; }, 0);
    if (!tot) return el('div', { class: 'pm-muted' }, 'No data yet.');
    var svg = S('svg', { viewBox: '0 0 120 120', width: '120', height: '120', role: 'img', 'aria-label': 'Pie chart' }), a0 = -Math.PI / 2;
    slices.forEach(function (s) {
      if (s.value <= 0) return;
      var f = s.value / tot, node;
      if (f >= 0.9999) node = S('circle', { cx: 60, cy: 60, r: 55, fill: s.color });
      else {
        var a1 = a0 + f * 2 * Math.PI;
        node = S('path', { d: 'M60 60 L' + (60 + 55 * Math.cos(a0)).toFixed(2) + ' ' + (60 + 55 * Math.sin(a0)).toFixed(2) + ' A55 55 0 ' + (f > 0.5 ? 1 : 0) + ' 1 ' + (60 + 55 * Math.cos(a1)).toFixed(2) + ' ' + (60 + 55 * Math.sin(a1)).toFixed(2) + ' Z', fill: s.color });
        a0 = a1;
      }
      var ti = S('title', {}); ti.textContent = s.label + ': ' + s.value; node.appendChild(ti); svg.appendChild(node);
    });
    return el('div', { class: 'pm-pie' }, svg, el('div', { class: 'pm-legend' }, slices.map(function (s) {
      return el('div', {}, el('i', { style: 'background:' + s.color }), s.label + ' \u00B7 ' + s.value + ' (' + Math.round(s.value * 100 / tot) + '%)');
    })));
  }
  function hbars(items, suffix) {
    if (!items.length) return el('div', { class: 'pm-muted' }, 'No data yet.');
    return el('div', {}, items.map(function (it) {
      var v = Math.max(0, Math.min(100, it.value));
      return el('div', { class: 'pm-bar' }, el('span', { class: 'l', title: it.label }, it.label),
        el('div', { class: 'pm-track' }, el('div', { class: 'pm-fill', style: 'width:' + v + '%;background:' + (it.color || '#4fd6e8') })),
        el('span', {}, it.text !== undefined ? it.text : it.value + (suffix === undefined ? '%' : suffix)));
    }));
  }
  function bandSlices(pcts) {
    var c = [0, 0, 0, 0]; pcts.forEach(function (p) { c[bandOf(p)]++; });
    return BANDS.map(function (b, i) { return { label: b.label, value: c[i], color: b.color }; });
  }
  function chartBox(title, node) { return el('div', { class: 'pm-chart' }, el('h3', { style: 'margin-top:0' }, title), node); }
  function statBox(v, l) { return el('div', { class: 'pm-stat' }, el('b', {}, v), el('span', {}, l)); }
  function colorFor(p) { return p >= 80 ? '#3ddc97' : p >= 60 ? '#4fd6e8' : p >= 40 ? '#f5b942' : '#ff6b6b'; }

  /* ---------------- student card ---------------- */
  async function myCard() {
    var card = el('div', { class: 'pm-card', id: 'pm-student' }, el('h2', {}, 'My test marks'), el('div', { class: 'pm-muted' }, 'Loading\u2026'));
    try {
      var u = await sb().auth.getUser(); var uid = u && u.data && u.data.user && u.data.user.id; if (!uid) return null;
      var r = await sb().from('test_marks').select('marks,absent,tests(id,title,subject,test_date,max_marks,pass_marks)').eq('student_id', uid).limit(300);
      if (r.error) throw r.error;
      var rows = (r.data || []).filter(function (x) { return x.tests; }).map(function (x) {
        var t = x.tests, m = num(x.marks);
        return { id: t.id, title: t.title, subject: t.subject, date: t.test_date, max: Number(t.max_marks), pass: t.pass_marks == null ? null : Number(t.pass_marks), marks: m, absent: !!x.absent, p: (m === null || x.absent) ? null : pct(m, Number(t.max_marks)) };
      }).sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
      clear(card); card.appendChild(el('h2', {}, 'My test marks'));
      var done = rows.filter(function (x) { return x.p !== null; });
      if (!rows.length) { card.appendChild(el('div', { class: 'pm-muted' }, 'No marks yet. Your teachers publish results here after each test.')); return card; }
      var bySub = {}; done.forEach(function (x) { (bySub[x.subject] = bySub[x.subject] || []).push(x.p); });
      var subs = Object.keys(bySub).map(function (k) { return { label: k, value: avg(bySub[k]) }; }).sort(function (a, b) { return b.value - a.value; });
      subs.forEach(function (s) { s.color = colorFor(s.value); });
      card.appendChild(el('div', { class: 'pm-grid' }, statBox(done.length ? avg(done.map(function (x) { return x.p; })) + '%' : '\u2014', 'Average score'), statBox(done.length, 'Tests taken'),
        statBox(subs.length ? subs[0].label : '\u2014', 'Strongest subject'), statBox(subs.length > 1 ? subs[subs.length - 1].label : '\u2014', 'Needs most practice')));
      card.appendChild(el('div', { class: 'pm-charts' },
        chartBox('Score trend', lineChart(done.slice(-12).map(function (x) { return { value: x.p, label: x.title, short: shortDate(x.date) }; }))),
        chartBox('Average by subject', hbars(subs)),
        chartBox('Score bands', pieChart(bandSlices(done.map(function (x) { return x.p; }))))));
      var recent = rows.slice().reverse().slice(0, 8), statsBox = {};
      var body = el('tbody', {}), tbl = el('table', { class: 'pm-tbl' }, el('thead', {}, el('tr', {}, ['Test', 'Date', 'Marks', 'Class average'].map(function (h) { return el('th', {}, h); }))), body);
      recent.forEach(function (x) {
        var cell = el('td', {}, '\u2026'); statsBox[x.id] = cell;
        body.appendChild(el('tr', {}, el('td', {}, x.title + ' \u00B7 ' + x.subject), el('td', {}, fmtDate(x.date)),
          el('td', {}, x.absent ? 'Absent' : x.marks === null ? '\u2014' : x.marks + ' / ' + x.max + ' (' + x.p + '%)'), cell));
      });
      card.appendChild(el('h3', {}, 'Recent tests')); card.appendChild(el('div', { class: 'pm-scroll' }, tbl));
      recent.forEach(function (x) {
        Promise.resolve(sb().rpc('test_class_stats', { p_test: x.id })).then(function (s) {
          var d = s && s.data && s.data[0]; statsBox[x.id].textContent = d ? Math.round(d.avg_marks * 10) / 10 + ' / ' + x.max + (d.n ? ' (' + d.n + ' students)' : '') : 'not enough students yet';
        }, function () { statsBox[x.id].textContent = '\u2014'; });
      });
    } catch (e) { clear(card); card.appendChild(el('h2', {}, 'My test marks')); card.appendChild(el('div', { class: 'pm-muted' }, 'Could not load your marks right now.')); }
    return card;
  }

  /* ---------------- teacher / admin ---------------- */
  var studentsPromise = null;
  async function loadStudents(admin) {
    if (studentsPromise) return studentsPromise;
    studentsPromise = (async function () {
      var r = admin
        ? await sb().from('profiles').select('id,display_name,class_name,division,board').eq('role', 'student').eq('student_status', 'approved').limit(3000)
        : await sb().rpc('teacher_students');
      if (r.error) { studentsPromise = null; throw r.error; }
      return (r.data || []).map(function (s) { return { id: s.id, name: s.display_name || '(no name)', cls: s.class_name, div: s.division, board: s.board }; });
    })();
    return studentsPromise;
  }
  function uniq(a) { var o = {}; a.forEach(function (x) { if (x) o[x] = 1; }); return Object.keys(o); }
  function numSort(a) { return a.sort(function (x, y) { return Number(x) - Number(y) || String(x).localeCompare(String(y)); }); }
  function field(label, node) { return el('div', {}, el('label', {}, label), node); }
  function sel(opts, first) { var s = el('select', { class: 'pm-in' }); if (first) s.appendChild(el('option', { value: '' }, first)); opts.forEach(function (o) { s.appendChild(el('option', { value: o }, o)); }); return s; }

  function staffPanel(opts) {
    var admin = !!opts.admin, card = el('div', { class: 'pm-card', id: admin ? 'pm-admin' : 'pm-teacher' });
    studentsPromise = null;
    var out = el('div', {}), top = el('div', {}), msgBox = el('div', { class: 'pm-msg' });
    card.appendChild(el('h2', {}, admin ? 'Marks & analytics' : 'Test marks'));
    card.appendChild(el('div', { class: 'pm-muted' }, 'Create a test, enter marks, then publish so students can see their result. Students see only their own marks and the class average.'));
    card.appendChild(top); card.appendChild(msgBox); card.appendChild(out);
    var tests = [];

    async function refresh() {
      var r = await sb().from('tests').select('*').order('test_date', { ascending: false }).limit(300);
      if (r.error) throw r.error; tests = r.data || []; drawTop(); drawList();
    }

    function drawTop() {
      clear(top);
      loadStudents(admin).then(function (studs) {
        var classes = numSort(uniq(studs.map(function (s) { return s.cls; })));
        if (!classes.length) { top.appendChild(el('p', { class: 'pm-muted' }, admin ? 'No approved students yet.' : 'You have no classes assigned yet. Ask the admin to give you your classes.')); return; }
        var title = el('input', { class: 'pm-in', placeholder: 'e.g. Unit Test 1', maxlength: '120' }), subject = el('input', { class: 'pm-in', placeholder: 'e.g. Physics', maxlength: '60' });
        var cls = sel(classes), board = sel(numSort(uniq(studs.map(function (s) { return s.board; }))), 'All boards'), div = sel(numSort(uniq(studs.map(function (s) { return s.div; }))), 'All divisions');
        var date = el('input', { class: 'pm-in', type: 'date', value: new Date().toISOString().slice(0, 10) }), max = el('input', { class: 'pm-in', type: 'number', min: '1', max: '1000', step: '0.5', value: '25' }), pass = el('input', { class: 'pm-in', type: 'number', min: '0', step: '0.5', placeholder: 'optional' });
        var btn = el('button', { type: 'button', class: 'pm-btn pri' }, 'Create test');
        btn.onclick = async function () {
          var mx = num(max.value), ps = pass.value === '' ? null : num(pass.value);
          if (title.value.trim().length < 2 || !subject.value.trim()) return msg(msgBox, 'Enter a test name and subject.', 'err');
          if (!mx || mx <= 0) return msg(msgBox, 'Enter the maximum marks.', 'err');
          if (ps !== null && (ps < 0 || ps > mx)) return msg(msgBox, 'Pass marks must be between 0 and the maximum.', 'err');
          btn.disabled = true; msg(msgBox, 'Creating\u2026');
          var r = await sb().from('tests').insert({ title: title.value.trim(), subject: subject.value.trim(), class_name: cls.value, board: board.value || null, division: div.value || null, test_date: date.value, max_marks: mx, pass_marks: ps }).select().single();
          btn.disabled = false;
          if (r.error) return msg(msgBox, friendly(r.error), 'err');
          msg(msgBox, 'Test created. Now enter the marks.', 'ok'); title.value = ''; await refresh(); openMarks(r.data);
        };
        top.appendChild(el('h3', {}, 'New test'));
        top.appendChild(el('div', { class: 'pm-form' }, field('Test name', title), field('Subject', subject), field('Class', cls), field('Board', board), field('Division', div), field('Date', date), field('Maximum marks', max), field('Pass marks', pass)));
        top.appendChild(btn);
      }).catch(function () { top.appendChild(el('p', { class: 'pm-muted' }, 'Could not load your students.')); });
    }

    function drawList() {
      clear(out);
      out.appendChild(el('h3', {}, 'Tests (' + tests.length + ')'));
      if (!tests.length) out.appendChild(el('p', { class: 'pm-muted' }, 'No tests yet.'));
      tests.forEach(function (t) {
        var open = el('button', { type: 'button', class: 'pm-btn' }, 'Marks'), pub = el('button', { type: 'button', class: 'pm-btn' }, t.published ? 'Hide from students' : 'Publish'), del = el('button', { type: 'button', class: 'pm-btn bad' }, 'Delete');
        open.onclick = function () { openMarks(t); };
        pub.onclick = async function () { pub.disabled = true; var r = await sb().from('tests').update({ published: !t.published }).eq('id', t.id); if (r.error) { pub.disabled = false; return msg(msgBox, friendly(r.error), 'err'); } msg(msgBox, t.published ? 'Hidden from students.' : 'Published. Students can now see their result.', 'ok'); refresh(); };
        del.onclick = async function () { if (!window.confirm('Delete "' + t.title + '" and all its marks? This cannot be undone.')) return; var r = await sb().from('tests').delete().eq('id', t.id); if (r.error) return msg(msgBox, friendly(r.error), 'err'); msg(msgBox, 'Test deleted.', 'ok'); refresh(); };
        out.appendChild(el('div', { class: 'pm-row' }, el('div', { class: 't' }, el('b', {}, t.title), el('span', { class: 'pm-badge ' + (t.published ? 'ok' : 'off') }, t.published ? 'published' : 'draft'),
          el('div', { class: 'pm-muted' }, t.subject + ' \u00B7 Class ' + t.class_name + (t.board ? ' \u00B7 ' + t.board : '') + (t.division ? ' \u00B7 Div ' + t.division : '') + ' \u00B7 ' + fmtDate(t.test_date) + ' \u00B7 out of ' + t.max_marks)),
          el('div', { style: 'display:flex;gap:6px;flex-wrap:wrap' }, open, pub, del)));
      });
      out.appendChild(el('h3', {}, 'Charts across ' + (admin ? 'all classes' : 'my classes')));
      var chartsBox = el('div', {}, el('div', { class: 'pm-muted' }, 'Loading\u2026')); out.appendChild(chartsBox); drawOverview(chartsBox);
    }

    async function drawOverview(box) {
      try {
        var studs = await loadStudents(admin), names = {}; studs.forEach(function (s) { names[s.id] = s.name; });
        var r = await sb().from('test_marks').select('marks,absent,student_id,tests(id,class_name,subject,max_marks,pass_marks)').limit(6000);
        if (r.error) throw r.error;
        var rows = (r.data || []).filter(function (x) { return x.tests && x.marks !== null && !x.absent; }).map(function (x) { return { sid: x.student_id, cls: x.tests.class_name, sub: x.tests.subject, p: pct(Number(x.marks), Number(x.tests.max_marks)), pass: x.tests.pass_marks == null ? null : Number(x.marks) >= Number(x.tests.pass_marks) }; });
        clear(box);
        if (!rows.length) { box.appendChild(el('div', { class: 'pm-muted' }, 'Charts appear once marks are entered.')); return; }
        var byCls = {}, bySub = {}, byStu = {}, passN = 0, passD = 0;
        rows.forEach(function (x) { (byCls[x.cls] = byCls[x.cls] || []).push(x.p); (bySub[x.sub] = bySub[x.sub] || []).push(x.p); (byStu[x.sid] = byStu[x.sid] || []).push(x.p); if (x.pass !== null) { passD++; if (x.pass) passN++; } });
        var clsItems = numSort(Object.keys(byCls)).map(function (k) { var v = avg(byCls[k]); return { label: 'Class ' + k, value: v, color: colorFor(v) }; });
        var subItems = Object.keys(bySub).map(function (k) { var v = avg(bySub[k]); return { label: k, value: v, color: colorFor(v) }; }).sort(function (a, b) { return b.value - a.value; }).slice(0, 10);
        var stu = Object.keys(byStu).filter(function (k) { return byStu[k].length >= 2 && names[k]; }).map(function (k) { return { label: names[k], value: avg(byStu[k]) }; }).sort(function (a, b) { return b.value - a.value; });
        box.appendChild(el('div', { class: 'pm-grid' }, statBox(avg(rows.map(function (x) { return x.p; })) + '%', 'Overall average'), statBox(rows.length, 'Marks entered'), statBox(passD ? Math.round(passN * 100 / passD) + '%' : '\u2014', 'Pass rate (tests with pass marks)')));
        box.appendChild(el('div', { class: 'pm-charts' }, chartBox('Average by class', hbars(clsItems)), chartBox('Average by subject', hbars(subItems)), chartBox('Score bands', pieChart(bandSlices(rows.map(function (x) { return x.p; })))),
          chartBox('Top students (2+ tests)', hbars(stu.slice(0, 5).map(function (s) { s.color = '#3ddc97'; return s; }))),
          chartBox('Needs attention (2+ tests)', hbars(stu.length > 5 ? stu.slice(-5).reverse().map(function (s) { s.color = '#ff6b6b'; return s; }) : []))));
      } catch (e) { clear(box); box.appendChild(el('div', { class: 'pm-muted' }, 'Could not load charts right now.')); }
    }

    async function openMarks(t) {
      clear(out); msg(msgBox, '');
      out.appendChild(el('button', { type: 'button', class: 'pm-btn', onclick: function () { refresh().catch(function () { }); } }, ico('back'), 'Back to tests'));
      out.appendChild(el('h3', {}, t.title + ' \u00B7 ' + t.subject + ' \u00B7 out of ' + t.max_marks));
      var holder = el('div', {}, el('div', { class: 'pm-muted' }, 'Loading students\u2026')); out.appendChild(holder);
      try {
        var studs = (await loadStudents(admin)).filter(function (s) { return s.cls === t.class_name && (!t.board || s.board === t.board) && (!t.division || s.div === t.division); }).sort(function (a, b) { return a.name.localeCompare(b.name); });
        var er = await sb().from('test_marks').select('student_id,marks,absent,remark').eq('test_id', t.id); if (er.error) throw er.error;
        var have = {}; (er.data || []).forEach(function (m) { have[m.student_id] = m; });
        clear(holder);
        if (!studs.length) { holder.appendChild(el('p', { class: 'pm-muted' }, 'No students found for this class.')); return; }
        var inputs = [], body = el('tbody', {}), live = el('div', {});
        studs.forEach(function (s) {
          var h = have[s.id] || {}, m = el('input', { type: 'number', class: 'pm-in', min: '0', max: String(t.max_marks), step: '0.5', value: h.marks == null ? '' : h.marks, 'aria-label': 'Marks for ' + s.name }),
            a = el('input', { type: 'checkbox', 'aria-label': 'Absent: ' + s.name }), rm = el('input', { class: 'pm-in', maxlength: '200', value: h.remark || '', placeholder: 'optional', 'aria-label': 'Remark for ' + s.name });
          if (h.absent) { a.checked = true; m.disabled = true; }
          a.onchange = function () { m.disabled = a.checked; if (a.checked) m.value = ''; stats(); }; m.oninput = stats;
          inputs.push({ s: s, m: m, a: a, r: rm }); body.appendChild(el('tr', {}, el('td', {}, s.name), el('td', {}, m), el('td', {}, a), el('td', {}, rm)));
        });
        function stats() {
          var ps = inputs.filter(function (x) { return !x.a.checked && x.m.value !== '' && num(x.m.value) !== null; }).map(function (x) { return { name: x.s.name, p: pct(num(x.m.value), Number(t.max_marks)), v: num(x.m.value) }; });
          clear(live); if (!ps.length) return;
          var passN = t.pass_marks == null ? null : ps.filter(function (x) { return x.v >= Number(t.pass_marks); }).length;
          live.appendChild(el('div', { class: 'pm-grid' }, statBox(avg(ps.map(function (x) { return x.v; })) + ' / ' + t.max_marks, 'Class average'), statBox(Math.max.apply(null, ps.map(function (x) { return x.v; })), 'Highest'), statBox(Math.min.apply(null, ps.map(function (x) { return x.v; })), 'Lowest'), statBox(passN === null ? '\u2014' : Math.round(passN * 100 / ps.length) + '%', 'Passed')));
          live.appendChild(el('div', { class: 'pm-charts' }, chartBox('Score bands', pieChart(bandSlices(ps.map(function (x) { return x.p; })))), chartBox('Each student', hbars(ps.slice().sort(function (a, b) { return b.p - a.p; }).slice(0, 30).map(function (x) { return { label: x.name, value: x.p, color: colorFor(x.p) }; })))));
        }
        var save = el('button', { type: 'button', class: 'pm-btn pri' }, 'Save marks');
        save.onclick = async function () {
          var rows = [], bad = null;
          inputs.forEach(function (x) {
            if (bad) return; var abs = x.a.checked, v = x.m.value === '' ? null : num(x.m.value);
            if (!abs && v === null && !x.r.value.trim() && !have[x.s.id]) return;
            if (!abs && v !== null && (v < 0 || v > Number(t.max_marks))) { bad = x.s.name + ': marks must be between 0 and ' + t.max_marks + '.'; return; }
            rows.push({ test_id: t.id, student_id: x.s.id, marks: abs ? null : v, absent: abs, remark: x.r.value.trim() || null });
          });
          if (bad) return msg(msgBox, bad, 'err'); if (!rows.length) return msg(msgBox, 'Nothing to save yet.', 'err');
          save.disabled = true; msg(msgBox, 'Saving\u2026');
          var r = await sb().from('test_marks').upsert(rows, { onConflict: 'test_id,student_id' }); save.disabled = false;
          if (r.error) return msg(msgBox, friendly(r.error), 'err');
          rows.forEach(function (x) { have[x.student_id] = x; }); msg(msgBox, rows.length + ' marks saved. ' + (t.published ? '' : 'Press Publish on the test list when you want students to see them.'), 'ok');
        };
        holder.appendChild(el('div', { class: 'pm-scroll' }, el('table', { class: 'pm-tbl' }, el('thead', {}, el('tr', {}, ['Student', 'Marks', 'Absent', 'Remark'].map(function (h) { return el('th', {}, h); }))), body)));
        holder.appendChild(el('div', { style: 'margin-top:10px' }, save)); holder.appendChild(live); stats();
      } catch (e) { clear(holder); holder.appendChild(el('p', { class: 'pm-muted' }, 'Could not load this test. ' + friendly(e))); }
    }

    refresh().catch(function (e) { clear(top); msg(msgBox, 'Could not load tests. ' + friendly(e), 'err'); });
    return card;
  }

  window.PhotonUI = { onMount: onMount, ico: ico, lineChart: lineChart, colorFor: colorFor, bandSlices: bandSlices, shortDate: shortDate, pct: pct, el: el, clear: clear, pieChart: pieChart, hbars: hbars, statBox: statBox, chartBox: chartBox, field: field, sel: sel, uniq: uniq, numSort: numSort, fmtDate: fmtDate, msg: msg, friendly: friendly, num: num, avg: avg, loadStudents: loadStudents, sb: sb };
  window.photonAdminMarks = function (view) { clear(view); studentsPromise = null; view.appendChild(staffPanel({ admin: true })); };

  /* ---------------- mounting in Student Space ---------------- */
  function findCard(heading) {
    var root = document.getElementById('ss-root'); if (!root) return null;
    var hs = root.querySelectorAll('h2');
    for (var i = 0; i < hs.length; i++) if (hs[i].textContent.trim() === heading) return hs[i].closest('.card');
    return null;
  }
  var mountingStudent = false;
  function inject() {
    var root = document.getElementById('ss-root'); if (!root || !sb()) return;
    var sn = findCard('Special notes');
    if (sn && !root.querySelector('#pm-student') && !mountingStudent) {
      mountingStudent = true;
      myCard().then(function (c) {
        mountingStudent = false;
        if (!c || root.querySelector('#pm-student')) return;
        var anchor = root.querySelector('#pa-student'); if (anchor) anchor.after(c); else if (findCard('Special notes')) { var n = findCard('Special notes'); (n.closest('.cols2') || n).after(c); }
      }, function () { mountingStudent = false; });
    }
    var tn = findCard('Add a special note');
    if (tn && !root.querySelector('#pm-teacher')) {
      var p = staffPanel({ admin: false }), anchorT = root.querySelector('#pa-teacher');
      if (anchorT) anchorT.after(p); else (tn.closest('.cols2') || tn).after(p);
    }
  }
  /* One shared watcher for every Student Space module. It wakes up only when real elements are added
     (not when the clock changes a text every second), so low-end phones are not kept busy. */
  var mountFns = [], mountObs = null, mountTimer = 0;
  function runMounts() { mountFns.forEach(function (f) { try { f(); } catch (e) { } }); }
  function onMount(fn) {
    mountFns.push(fn);
    var root = document.getElementById('ss-root'); if (!root || mountObs) return;
    mountObs = new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) { var a = muts[i].addedNodes; for (var j = 0; j < a.length; j++) if (a[j].nodeType === 1) { clearTimeout(mountTimer); mountTimer = setTimeout(runMounts, 350); return; } }
    });
    mountObs.observe(root, { childList: true, subtree: true });
  }
  function start() {
    var root = document.getElementById('ss-root'); if (!root) return;
    onMount(inject); inject();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
