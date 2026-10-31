/* ===================================================================
   Photon Academy - Notes library
   One script, four places:
     - Public Notes page (index.html): "Browse notes" -> Class > Board > Subject > Chapter > Notes / Practice
     - Teacher Desk (teachers):        "Notes library" card: browse, add (PDF and/or link), hide, delete
     - Admin panel (admin.html):       "Notes library" screen (everything a teacher can do, for every note)
                                        and a "Storage" screen
   Talks only to the notes service (Cloudflare Worker). It borrows the visitor's existing login
   (window.photonSupabase) to prove who they are. Deleting a note removes the record AND its file for good.
   =================================================================== */
(function () {
  'use strict';

  var API = 'https://photon-academy-notes.photonacademy.workers.dev';
  var KINDS = [{ key: 'notes', label: 'Notes' }, { key: 'practice', label: 'Practice questions' }];
  var KLABEL = { notes: 'Notes', practice: 'Practice questions' };
  var SUBJECTS = ['Physics', 'Chemistry', 'Maths', 'Biology', 'Science', 'English', 'Social Science', 'Hindi', 'Gujarati', 'Computer'];
  var CLASSES = ['6', '7', '8', '9', '10', '11', '12'];
  var BOARDS = ['CBSE', 'ICSE', 'GSEB'];
  var LV = ['class_name', 'board', 'subject', 'chapter', 'kind'];
  var LVNAME = ['class', 'board', 'subject', 'chapter', 'type'];
  var MB = 1024 * 1024;

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
  function msg(box, text, kind) { box.textContent = text || ''; box.className = 'pn-msg' + (kind ? ' ' + kind : ''); }
  function fmtSize(b) { if (!b) return '0 KB'; if (b < MB) return Math.max(1, Math.round(b / 1024)) + ' KB'; return (Math.round(b / MB * 10) / 10) + ' MB'; }
  function uniq(a) { var s = {}; return a.filter(function (x) { if (!x || s[x]) return false; s[x] = 1; return true; }); }
  function safeUrl(u) { return /^https?:\/\//i.test(String(u || '')) ? u : null; }
  function nat(a, b) { return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' }); }

  var css = el('style', {});
  css.textContent = [
    '.pn,.pn-card{--pn-ac:#4fd6e8;--pn-ln:rgba(127,127,127,.38);--pn-bg:rgba(127,127,127,.09)}',
    'html[data-theme="light"] .pn,html[data-theme="light"] .pn-card{--pn-ac:#0b7a8f;--pn-ln:rgba(15,30,60,.3);--pn-bg:rgba(15,30,60,.05)}',
    '.pn-card{border:1px solid var(--pn-ln);border-radius:14px;padding:18px;margin-top:16px;text-align:left;background:var(--pn-bg)}',
    '.pn-card h2{margin:0 0 4px;font-size:18px}',
    '.pn-muted{opacity:.75;font-size:13px}',
    '.pn *{box-sizing:border-box}',
    '.pn-crumbs{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:4px 0 12px;font-size:13.5px}',
    '.pn button,.pn-card button{font:inherit}',
    '.pn .pn-crumb,.pn-card .pn-crumb{border:0;background:none;color:var(--pn-ac);cursor:pointer;padding:3px 2px;text-decoration:underline;width:auto !important;margin:0 !important}',
    '.pn-crumbs .cur{font-weight:700}',
    '.pn-ask{font-size:14px;opacity:.85;margin:2px 0 10px}',
    '.pn-tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}',
    '.pn .pn-tile,.pn-card .pn-tile{display:flex !important;flex-direction:column;align-items:flex-start;gap:3px;text-align:left;border:1px solid var(--pn-ln);background:var(--pn-bg);color:inherit;border-radius:12px;padding:14px 14px;cursor:pointer;min-height:72px;width:auto !important;margin:0 !important}',
    '.pn .pn-tile:hover,.pn-card .pn-tile:hover,.pn .pn-tile:focus-visible{border-color:var(--pn-ac);outline:none}',
    '.pn-tile b{font-size:16px}.pn-tile span{font-size:12.5px;opacity:.75}',
    '.pn-search{width:100% !important;max-width:420px;margin:0 0 12px !important;padding:9px 12px;border-radius:10px;border:1px solid var(--pn-ln);background:transparent;color:inherit;font:inherit;font-size:14px}',
    '.pn-doc{display:flex;gap:12px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;border:1px solid var(--pn-ln);background:var(--pn-bg);border-radius:12px;padding:12px 14px;margin:8px 0}',
    '.pn-doc .t{flex:1 1 200px;min-width:0;overflow-wrap:anywhere}.pn-doc .t b{display:block;font-size:15px}',
    '.pn-path{font-size:12px;opacity:.7}',
    '.pn-acts{display:flex;gap:8px;flex-wrap:wrap;align-items:center}',
    '.pn .pn-btn,.pn-card .pn-btn,.pn a.pn-btn{display:inline-block;text-decoration:none;border:1px solid var(--pn-ln);background:transparent;color:inherit;border-radius:10px;padding:7px 12px;font:inherit;font-size:13px;cursor:pointer;width:auto !important;margin:0 !important;line-height:1.3}',
    '.pn a.pn-btn:not(.pri){color:inherit !important}',
    '.pn .pn-btn.pri,.pn-card .pn-btn.pri,.pn a.pn-btn.pri{background:var(--pn-ac);border-color:var(--pn-ac);color:#06202a !important;font-weight:600}',
    'html[data-theme="light"] .pn .pn-btn.pri,html[data-theme="light"] .pn-card .pn-btn.pri,html[data-theme="light"] .pn a.pn-btn.pri{color:#fff !important}',
    '.pn-btn.bad{color:#ff7b7b;border-color:rgba(255,123,123,.55)}',
    'html[data-theme="light"] .pn-btn.bad{color:#c62828;border-color:rgba(198,40,40,.5)}',
    '.pn-btn.on{background:rgba(79,214,232,.18);border-color:var(--pn-ac)}',
    '.pn-btn:disabled{opacity:.5;cursor:not-allowed}',
    '.pn-badge{display:inline-block;border-radius:99px;border:1px solid var(--pn-ln);padding:1px 9px;font-size:11.5px;margin-right:6px;opacity:.9}',
    '.pn-badge.warn{border-color:#f5b942;color:#f5b942}html[data-theme="light"] .pn-badge.warn{color:#8a5a00;border-color:#8a5a00}',
    '.pn-empty{opacity:.75;padding:14px 0;font-size:14px}',
    '.pn-msg{min-height:20px;margin-top:8px;font-size:13.5px}.pn-msg.ok{color:#3ddc97}.pn-msg.bad{color:#ff8b8b}',
    'html[data-theme="light"] .pn-msg.ok{color:#0a7d4f}html[data-theme="light"] .pn-msg.bad{color:#c62828}',
    '.pn-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0 4px}',
    '.pn-form{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-top:10px}',
    '.pn-form label{display:flex !important;flex-direction:column !important;align-items:flex-start !important;gap:5px;font-size:12.5px;opacity:.95;margin:0 !important}',
    '.pn-form .wide{grid-column:1/-1}',
    '.pn-in{width:100% !important;max-width:100%;margin:0 !important;padding:9px 10px;border-radius:10px;border:1px solid var(--pn-ln);background:rgba(127,127,127,.08);color:inherit;font:inherit;font-size:14px}',
    'html[data-theme="light"] .pn-in{background:#fff;color:#0b1220}',
    '.pn-in option{color:#0b1220}',
    '.pn-seg{display:flex;gap:8px;flex-wrap:wrap}',
    '.pn-meter{height:8px;border-radius:99px;background:rgba(127,127,127,.25);overflow:hidden;margin:6px 0}',
    '.pn-meter i{display:block;height:100%;border-radius:99px;background:var(--pn-ac)}',
    '.pn-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:12px 0}',
    '.pn-stat{border:1px solid var(--pn-ln);border-radius:12px;padding:12px;background:var(--pn-bg)}.pn-stat b{display:block;font-size:20px}.pn-stat span{font-size:12.5px;opacity:.75}',
    '.pn-hint{font-size:12px;opacity:.7;font-weight:400}'
  ].join('\n');
  document.head.appendChild(css);

  /* ---------------- talking to the notes service ---------------- */
  async function session() {
    var sb = window.photonSupabase;
    if (!sb) return null;
    try { var r = await sb.auth.getSession(); return (r && r.data && r.data.session) || null; } catch (e) { return null; }
  }
  async function call(path, opts) {
    opts = opts || {};
    var headers = {}, init = { method: opts.method || 'GET', headers: headers };
    if (!opts.anon) {
      var s = await session();
      if (!s) throw new Error('Please sign in again.');
      headers.Authorization = 'Bearer ' + s.access_token;
    }
    if (opts.form) init.body = opts.form;
    else if (opts.body !== undefined) { init.body = JSON.stringify(opts.body); headers['Content-Type'] = 'application/json'; }
    var res;
    try { res = await fetch(API + path, init); }
    catch (e) { throw new Error('Could not reach the notes service. Check your internet and try again.'); }
    var data = null;
    try { data = await res.json(); } catch (e) { /* not JSON */ }
    if (!res.ok) throw new Error((data && (data.error || data.message)) || 'Something went wrong (' + res.status + ').');
    return data;
  }
  async function fetchAll(anon) {
    var items = [], offset = 0, total = 1;
    while (items.length < total && offset < 1000) {
      var d = await call('/api/documents?limit=100&offset=' + offset, { anon: anon });
      total = d.total || 0;
      if (!d.items || !d.items.length) break;
      items = items.concat(d.items); offset += d.items.length;
    }
    return items;
  }
  function isPublicDoc(d) { return d.published && d.visibility === 'public'; }

  async function openAuthed(doc, download) {
    var w = download ? null : window.open('', '_blank');
    try {
      var s = await session();
      if (!s) throw new Error('Please sign in again.');
      var res = await fetch(API + '/api/documents/' + doc.id + '/file' + (download ? '?download=1' : ''), { headers: { Authorization: 'Bearer ' + s.access_token } });
      if (!res.ok) throw new Error('Could not open this file (' + res.status + ').');
      var url = URL.createObjectURL(await res.blob());
      if (!download && w) { w.location = url; }
      else {
        var a = el('a', { href: url, download: (doc.file && doc.file.name) || 'file' });
        document.body.appendChild(a); a.click(); a.remove();
      }
      setTimeout(function () { URL.revokeObjectURL(url); }, 120000);
    } catch (e) { if (w) w.close(); window.alert(e.message); }
  }

  /* ---------------- the browser: Class > Board > Subject > Chapter > Type ---------------- */
  function groupVal(d, k) {
    var v = d[k];
    if (v) return String(v);
    return k === 'class_name' ? 'All classes' : k === 'board' ? 'All boards' : k === 'kind' ? 'Other material' : 'General';
  }
  function showVal(k, v) {
    if (k === 'class_name' && /^\d+$/.test(v)) return 'Class ' + v;
    if (k === 'kind') return KLABEL[v] || v;
    return v;
  }
  function sortVals(k, vals) {
    return vals.slice().sort(function (a, b) {
      if (k === 'kind') { var o = { notes: 0, practice: 1 }; return (o[a] === undefined ? 9 : o[a]) - (o[b] === undefined ? 9 : o[b]); }
      if (k === 'class_name') { var na = /^\d+$/.test(a), nb = /^\d+$/.test(b); if (na && nb) return Number(a) - Number(b); if (na) return -1; if (nb) return 1; }
      if (a === 'General' || a === 'All boards') return 1;
      if (b === 'General' || b === 'All boards') return -1;
      return nat(a, b);
    });
  }

  function notesBrowser(docs, o) {
    o = o || {};
    var state = { path: [], q: '' };
    var root = el('div', { class: 'pn' });
    var msgBox = el('div', { class: 'pn-msg' });

    function canEdit(d) { return !!o.admin || (o.uid && d.created_by === o.uid); }
    function under(path) {
      return docs.filter(function (d) { return path.every(function (v, i) { return groupVal(d, LV[i]) === v; }); });
    }
    function pathLabel(d) { return LV.map(function (k) { return showVal(k, groupVal(d, k)); }).join(' \u203A '); }

    function docRow(d, showPath) {
      var src = [];
      var fileUrl = API + '/api/documents/' + d.id + '/file';
      if (d.has_file) {
        if (isPublicDoc(d)) {
          src.push(el('a', { class: 'pn-btn pri', href: fileUrl, target: '_blank', rel: 'noopener' }, 'Open ' + (d.file && /pdf/i.test(d.file.type || '') ? 'PDF' : 'file')));
          src.push(el('a', { class: 'pn-btn', href: fileUrl + '?download=1', rel: 'noopener' }, 'Download'));
        } else {
          src.push(el('button', { type: 'button', class: 'pn-btn pri', onclick: function () { openAuthed(d, false); } }, 'Open ' + (d.file && /pdf/i.test(d.file.type || '') ? 'PDF' : 'file')));
          src.push(el('button', { type: 'button', class: 'pn-btn', onclick: function () { openAuthed(d, true); } }, 'Download'));
        }
      }
      if (safeUrl(d.external_url)) src.push(el('a', { class: 'pn-btn' + (d.has_file ? '' : ' pri'), href: d.external_url, target: '_blank', rel: 'noopener noreferrer' }, 'Open link \u2197'));
      var staff = [];
      if (o.staff && canEdit(d)) {
        staff.push(el('button', { type: 'button', class: 'pn-btn', onclick: function (ev) { togglePublished(d, ev.target); } }, d.published ? 'Hide' : 'Show'));
        staff.push(el('button', { type: 'button', class: 'pn-btn bad', onclick: function (ev) { removeDoc(d, ev.target); } }, 'Delete'));
      }
      var badges = [];
      if (o.staff) {
        badges.push(el('span', { class: 'pn-badge' + (d.published ? '' : ' warn') }, d.published ? (d.visibility === 'public' ? 'Public' : 'Students only') : 'Hidden'));
        if (d.has_file) badges.push(el('span', { class: 'pn-badge' }, fmtSize(d.file && d.file.size)));
      }
      return el('div', { class: 'pn-doc' },
        el('div', { class: 't' }, badges, el('b', {}, (d.has_file ? '\uD83D\uDCC4 ' : '\uD83D\uDD17 ') + d.title),
          d.description ? el('div', { class: 'pn-muted' }, d.description) : null,
          showPath ? el('div', { class: 'pn-path' }, pathLabel(d)) : null),
        el('div', { class: 'pn-acts' }, src, staff));
    }

    async function togglePublished(d, btn) {
      btn.disabled = true;
      try {
        var r = await call('/api/documents/' + d.id, { method: 'PATCH', body: { published: !d.published } });
        d.published = r.document.published; msg(msgBox, d.published ? 'Now visible.' : 'Hidden. Nobody but staff can see it.', 'ok');
        if (o.onChange) o.onChange(); draw();
      } catch (e) { msg(msgBox, e.message, 'bad'); btn.disabled = false; }
    }
    async function removeDoc(d, btn) {
      if (!window.confirm('Delete "' + d.title + '" permanently?\n\nThe note' + (d.has_file ? ' and its uploaded file are' : ' is') + ' removed for good. This cannot be undone.')) return;
      btn.disabled = true;
      try {
        await call('/api/documents/' + d.id, { method: 'DELETE' });
        var i = docs.indexOf(d); if (i >= 0) docs.splice(i, 1);
        // if that was the last note in this folder, step back out of it
        while (state.path.length && !under(state.path).length) state.path.pop();
        msg(msgBox, 'Deleted permanently.', 'ok');
        if (o.onChange) o.onChange(); draw();
      } catch (e) { msg(msgBox, e.message, 'bad'); btn.disabled = false; }
    }

    function crumbs() {
      var bar = el('div', { class: 'pn-crumbs' });
      bar.appendChild(el('button', { type: 'button', class: 'pn-crumb' + (state.path.length ? '' : ' cur'), onclick: function () { state.path = []; draw(); } }, 'All classes'));
      state.path.forEach(function (v, i) {
        bar.appendChild(el('span', { 'aria-hidden': 'true' }, '\u203A'));
        var last = i === state.path.length - 1;
        bar.appendChild(el('button', { type: 'button', class: 'pn-crumb' + (last ? ' cur' : ''), onclick: function () { state.path = state.path.slice(0, i + 1); draw(); } }, showVal(LV[i], v)));
      });
      return bar;
    }

    function draw() {
      clear(root);
      if (!docs.length) { root.appendChild(el('div', { class: 'pn-empty' }, o.staff ? 'No notes yet. Use "Add notes" to upload the first one.' : 'No notes have been added yet.')); root.appendChild(msgBox); return; }
      var search = el('input', { type: 'search', class: 'pn-search', placeholder: 'Search notes', 'aria-label': 'Search notes', value: state.q });
      search.addEventListener('input', function () { state.q = search.value; var pos = search.selectionStart; draw(); var again = root.querySelector('.pn-search'); if (again) { again.focus(); try { again.setSelectionRange(pos, pos); } catch (e) { /* */ } } });
      root.appendChild(search);
      var q = state.q.trim().toLowerCase();
      if (q) {
        var hit = docs.filter(function (d) { return (d.title + ' ' + (d.subject || '') + ' ' + (d.chapter || '') + ' ' + (d.description || '')).toLowerCase().indexOf(q) >= 0; });
        root.appendChild(el('div', { class: 'pn-ask' }, hit.length + ' result' + (hit.length === 1 ? '' : 's')));
        hit.forEach(function (d) { root.appendChild(docRow(d, true)); });
        root.appendChild(msgBox); return;
      }
      root.appendChild(crumbs());
      var lvl = state.path.length, here = under(state.path);
      if (lvl >= LV.length) {
        root.appendChild(el('div', { class: 'pn-ask' }, here.length + ' item' + (here.length === 1 ? '' : 's')));
        here.sort(function (a, b) { return (a.sort_order - b.sort_order) || nat(a.title, b.title); }).forEach(function (d) { root.appendChild(docRow(d, false)); });
      } else {
        var k = LV[lvl], counts = {};
        here.forEach(function (d) { var v = groupVal(d, k); counts[v] = (counts[v] || 0) + 1; });
        root.appendChild(el('div', { class: 'pn-ask' }, 'Choose a ' + LVNAME[lvl] + ':'));
        var tiles = el('div', { class: 'pn-tiles' });
        sortVals(k, Object.keys(counts)).forEach(function (v) {
          tiles.appendChild(el('button', { type: 'button', class: 'pn-tile', onclick: function () { state.path = state.path.concat([v]); draw(); window.scrollTo && root.scrollIntoView && root.scrollIntoView({ block: 'nearest' }); } },
            el('b', {}, showVal(k, v)), el('span', {}, counts[v] + ' item' + (counts[v] === 1 ? '' : 's'))));
        });
        root.appendChild(tiles);
      }
      root.appendChild(msgBox);
    }
    root._docs = docs; root._redraw = draw;
    draw();
    return root;
  }

  /* ---------------- storage meter (staff) ---------------- */
  function meterBox(info) {
    var pct = Math.min(100, info.percent_used || 0);
    return el('div', {},
      el('div', { class: 'pn-muted' }, 'Storage used: ' + fmtSize(info.used_bytes) + ' of ' + fmtSize(info.limit_bytes) + ' (' + (info.percent_used || 0) + '%)'),
      el('div', { class: 'pn-meter', role: 'img', 'aria-label': pct + ' percent of storage used' }, el('i', { style: 'width:' + Math.max(pct, 1) + '%' + (pct >= 85 ? ';background:#ff6b6b' : '') })));
  }

  /* ---------------- the staff panel: browse + add ---------------- */
  function notesPanel(opts) {
    var admin = !!opts.admin;
    var card = el('div', { class: 'pn-card', id: admin ? 'pn-admin' : 'pn-teacher' }, el('h2', {}, 'Notes library'), el('div', { class: 'pn-empty' }, 'Loading\u2026'));
    Promise.all([fetchAll(false), call('/api/storage'), session()]).then(function (r) { build(r[0], r[1], r[2]); })
      .catch(function (e) { clear(card).appendChild(el('h2', {}, 'Notes library')); card.appendChild(el('div', { class: 'pn-empty' }, e.message)); });

    function build(docs, store, sess) {
      var uid = sess && sess.user && sess.user.id;
      var info = { v: store };
      clear(card);
      card.appendChild(el('h2', {}, 'Notes library'));
      card.appendChild(el('div', { class: 'pn-muted' }, admin ? 'Add, hide or delete notes for every class. They appear on the public Notes page.' : 'Add notes and practice questions, and manage the ones you added. Admins can change anything.'));
      var meterHolder = el('div');
      function paintMeter() { clear(meterHolder).appendChild(meterBox(info.v)); }
      paintMeter();
      card.appendChild(meterHolder);

      var browsePane = el('div'), addPane = el('div');
      var browser = null;
      function mountBrowser() { clear(browsePane); browser = notesBrowser(docs, { staff: true, admin: admin, uid: uid, onChange: refreshMeter }); browsePane.appendChild(browser); }
      async function refreshMeter() { try { info.v = await call('/api/storage'); paintMeter(); } catch (e) { /* keep old */ } }

      var tabs = el('div', { class: 'pn-tabs' }), tb = {};
      [['browse', 'Browse & manage'], ['add', '\uFF0B Add notes']].forEach(function (d) {
        tb[d[0]] = el('button', { type: 'button', class: 'pn-btn', onclick: function () { show(d[0]); } }, d[1]); tabs.appendChild(tb[d[0]]);
      });
      function show(k) {
        browsePane.style.display = k === 'browse' ? '' : 'none'; addPane.style.display = k === 'add' ? '' : 'none';
        tb.browse.className = 'pn-btn' + (k === 'browse' ? ' on' : ''); tb.add.className = 'pn-btn' + (k === 'add' ? ' on' : '');
      }
      mountBrowser();
      buildAdd(addPane, docs, info, function () { mountBrowser(); refreshMeter(); show('browse'); });
      card.appendChild(tabs); card.appendChild(browsePane); card.appendChild(addPane);
      show(docs.length ? 'browse' : 'add');
    }
    return card;
  }

  function buildAdd(pane, docs, info, done) {
    var cls = el('select', { class: 'pn-in', required: true }, el('option', { value: '' }, 'Choose class\u2026'),
      CLASSES.map(function (c) { return el('option', { value: c }, 'Class ' + c); }), el('option', { value: '__all' }, 'All classes'));
    var board = el('select', { class: 'pn-in', required: true }, el('option', { value: '' }, 'Choose board\u2026'),
      BOARDS.map(function (b) { return el('option', { value: b }, b); }), el('option', { value: '__all' }, 'All boards'));
    var subjList = el('datalist', { id: 'pn-subjects' }), chapList = el('datalist', { id: 'pn-chapters' });
    function fillLists() {
      clear(subjList); clear(chapList);
      uniq(SUBJECTS.concat(docs.map(function (d) { return d.subject; }))).forEach(function (s) { subjList.appendChild(el('option', { value: s })); });
      uniq(docs.filter(function (d) { return !subject.value.trim() || d.subject === subject.value.trim(); }).map(function (d) { return d.chapter; })).forEach(function (s) { chapList.appendChild(el('option', { value: s })); });
    }
    var subject = el('input', { class: 'pn-in', list: 'pn-subjects', maxlength: '60', placeholder: 'e.g. Physics', required: true });
    var chapter = el('input', { class: 'pn-in', list: 'pn-chapters', maxlength: '120', placeholder: 'e.g. Electricity', required: true });
    subject.addEventListener('input', fillLists);
    var kind = el('select', { class: 'pn-in' }, KINDS.map(function (k) { return el('option', { value: k.key }, k.label); }));
    var title = el('input', { class: 'pn-in', maxlength: '200', placeholder: 'e.g. Electricity \u2014 full chapter notes', required: true });
    var desc = el('input', { class: 'pn-in', maxlength: '500', placeholder: 'Optional short description' });
    var file = el('input', { type: 'file', class: 'pn-in', accept: '.pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg,.webp,.txt,.xls,.xlsx,.csv,.zip' });
    var link = el('input', { type: 'url', class: 'pn-in', maxlength: '2000', placeholder: 'https://\u2026 (Google Drive, website, video)' });
    var vis = el('select', { class: 'pn-in' }, el('option', { value: 'public' }, 'Everyone \u2014 shown on the public Notes page'), el('option', { value: 'students' }, 'Signed-in students of that class only'));
    var pub = el('input', { type: 'checkbox', checked: true, style: 'width:auto;margin:0' });
    var out = el('div', { class: 'pn-msg' });
    var go = el('button', { type: 'button', class: 'pn-btn pri' }, 'Add notes');
    fillLists();

    function f(label, input, hint, wide) { return el('label', { class: wide ? 'wide' : '' }, label, hint ? el('span', { class: 'pn-hint' }, hint) : null, input); }
    pane.appendChild(el('div', { class: 'pn-form' },
      f('Class', cls), f('Board', board), f('Subject', subject, null), f('Chapter', chapter), f('Type', kind),
      f('Title', title, null, true), f('Description', desc, null, true),
      f('PDF or document (up to ' + fmtSize(info.v.max_file_bytes) + ')', file, 'PDF, Word, PowerPoint, Excel, image, text', true),
      f('\u2026and/or a link', link, 'You can add a file, a link, or both', true),
      f('Who can see it', vis, null, true),
      el('label', { class: 'wide', style: 'flex-direction:row !important;align-items:center !important;gap:8px' }, pub, 'Show it now (untick to save it hidden)')));
    pane.appendChild(el('div', { class: 'pn-acts', style: 'margin-top:12px' }, go));
    pane.appendChild(datalistHolder(subjList, chapList));
    pane.appendChild(out);

    function datalistHolder(a, b) { var d = el('div', { style: 'display:none' }); d.appendChild(a); d.appendChild(b); return d; }

    go.addEventListener('click', async function () {
      msg(out, '');
      var fl = file.files && file.files[0], lk = link.value.trim();
      if (!cls.value) return msg(out, 'Choose a class (or "All classes").', 'bad');
      if (!board.value) return msg(out, 'Choose a board (or "All boards").', 'bad');
      if (!subject.value.trim()) return msg(out, 'Type the subject.', 'bad');
      if (!chapter.value.trim()) return msg(out, 'Type the chapter.', 'bad');
      if (title.value.trim().length < 2) return msg(out, 'Type a title.', 'bad');
      if (!fl && !lk) return msg(out, 'Add a PDF/file, a link, or both.', 'bad');
      if (lk && !safeUrl(lk)) return msg(out, 'The link must start with http:// or https://', 'bad');
      if (fl && fl.size > info.v.max_file_bytes) return msg(out, 'That file is ' + fmtSize(fl.size) + '. The limit is ' + fmtSize(info.v.max_file_bytes) + '.', 'bad');
      go.disabled = true; msg(out, 'Saving\u2026');
      var created = null;
      try {
        var body = { title: title.value.trim(), description: desc.value.trim() || null, subject: subject.value.trim(), chapter: chapter.value.trim(), kind: kind.value,
          class_name: cls.value === '__all' ? null : cls.value, board: board.value === '__all' ? null : board.value,
          visibility: vis.value, published: !!pub.checked, external_url: lk || null, tag: kind.value === 'practice' ? 'Practice' : 'Notes' };
        created = (await call('/api/documents', { method: 'POST', body: body })).document;
        if (fl) {
          msg(out, 'Uploading ' + fl.name + '\u2026');
          var fd = new FormData(); fd.append('file', fl, fl.name);
          created = (await call('/api/documents/' + created.id + '/file', { method: 'POST', form: fd })).document;
        }
        docs.push(created);
        msg(out, 'Added. It is now in ' + [cls.value === '__all' ? 'all classes' : 'Class ' + cls.value, board.value === '__all' ? 'all boards' : board.value, subject.value.trim(), chapter.value.trim()].join(' \u203A ') + '.', 'ok');
        title.value = ''; desc.value = ''; file.value = ''; link.value = '';
        fillLists();
        done();
      } catch (e) {
        if (created && fl) { try { await call('/api/documents/' + created.id, { method: 'DELETE' }); } catch (e2) { /* best effort */ } }
        msg(out, (fl && created ? 'Upload failed, nothing was saved. ' : '') + e.message, 'bad');
      }
      go.disabled = false;
    });
  }

  /* ---------------- admin: storage screen ---------------- */
  window.photonAdminStorage = function (view) {
    clear(view);
    var card = el('div', { class: 'pn-card' }, el('h2', {}, 'Storage'), el('div', { class: 'pn-empty' }, 'Loading\u2026'));
    view.appendChild(card);
    function load() {
      Promise.all([call('/api/storage'), fetchAll(false)]).then(function (r) {
        var info = r[0], docs = r[1];
        var files = docs.filter(function (d) { return d.has_file && d.file; }).sort(function (a, b) { return (b.file.size || 0) - (a.file.size || 0); });
        var left = Math.max(0, info.limit_bytes - info.used_bytes);
        clear(card).appendChild(el('h2', {}, 'Storage'));
        card.appendChild(el('div', { class: 'pn-muted' }, 'Where your notes and PDFs are kept (Cloudflare). Deleting a note frees its space straight away.'));
        card.appendChild(meterBox(info));
        card.appendChild(el('div', { class: 'pn-stats' },
          stat(fmtSize(info.used_bytes), 'used'), stat(fmtSize(left), 'left'), stat(String(docs.length), 'notes in total'),
          stat(String(files.length), 'uploaded files'), stat(fmtSize(info.max_file_bytes), 'biggest file allowed'),
          stat(String(info.max_uploads_per_day), 'uploads per teacher per day')));
        if (info.percent_used >= 85) card.appendChild(el('div', { class: 'pn-badge warn' }, 'Storage is almost full. Delete old files below.'));
        card.appendChild(el('h3', { style: 'margin:16px 0 6px;font-size:15px' }, 'Largest files'));
        if (!files.length) card.appendChild(el('div', { class: 'pn-empty' }, 'No uploaded files yet.'));
        files.slice(0, 15).forEach(function (d) {
          var btn = el('button', { type: 'button', class: 'pn-btn bad', onclick: async function () {
            if (!window.confirm('Delete "' + d.title + '" permanently?\n\nThe note and its file are removed for good. This cannot be undone.')) return;
            btn.disabled = true;
            try { await call('/api/documents/' + d.id, { method: 'DELETE' }); load(); } catch (e) { btn.disabled = false; window.alert(e.message); }
          } }, 'Delete');
          card.appendChild(el('div', { class: 'pn-doc' },
            el('div', { class: 't' }, el('b', {}, d.title), el('div', { class: 'pn-path' }, [d.class_name ? 'Class ' + d.class_name : 'All classes', d.board, d.subject, d.chapter].filter(Boolean).join(' \u203A ') + ' \u00B7 ' + (d.file.name || ''))),
            el('div', { class: 'pn-acts' }, el('b', {}, fmtSize(d.file.size)), btn)));
        });
        card.appendChild(el('p', { class: 'pn-muted', style: 'margin-top:14px' }, 'Student photos, fee receipts and form uploads are kept in Supabase. Check them in the Supabase dashboard under Storage.'));
      }).catch(function (e) { clear(card).appendChild(el('h2', {}, 'Storage')); card.appendChild(el('div', { class: 'pn-empty' }, e.message)); });
    }
    function stat(big, small) { return el('div', { class: 'pn-stat' }, el('b', {}, big), el('span', {}, small)); }
    load();
  };
  window.photonAdminNotes = function (view) { clear(view); view.appendChild(notesPanel({ admin: true })); };

  /* ---------------- public Notes page ---------------- */
  function mountPublic() {
    var sec = document.getElementById('notes'), grid = document.getElementById('notesGrid');
    if (!sec || !grid || document.getElementById('pn-public')) return;
    fetchAll(true).then(function (docs) {
      if (!docs.length || document.getElementById('pn-public')) return;
      var box = el('div', { id: 'pn-public', style: 'margin:0 0 28px' }, el('h3', { style: 'margin:0 0 8px;font-size:20px' }, 'Browse notes by class'),
        el('div', { class: 'pn-muted', style: 'margin-bottom:8px' }, 'Pick your class, board, subject and chapter. Free to read and download.'),
        notesBrowser(docs, { staff: false }));
      grid.parentNode.insertBefore(box, grid);
    }).catch(function () { /* service unreachable: hide quietly */ });
  }

  /* ---------------- teacher desk ---------------- */
  function injectTeacher() {
    var root = document.getElementById('ss-root');
    if (!root || root.querySelector('#pn-teacher')) return;
    var anchor = root.querySelector('#pa-teacher');
    if (!anchor) {
      var hs = root.querySelectorAll('h2');
      for (var i = 0; i < hs.length; i++) if (hs[i].textContent.trim() === 'Add a special note') { var c = hs[i].closest('.card'); anchor = c && (c.closest('.cols2') || c); }
    }
    if (!anchor) return;
    anchor.after(notesPanel({ admin: false }));
  }
  function startTeacher() {
    var root = document.getElementById('ss-root');
    if (!root) return;
    var timer = 0;
    new MutationObserver(function () { clearTimeout(timer); timer = setTimeout(injectTeacher, 250); }).observe(root, { childList: true, subtree: true });
    injectTeacher();
  }

  function start() { mountPublic(); startTeacher(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
