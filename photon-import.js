/* ===================================================================
   Photon Academy - Admin screen "Bulk import"
   Upload a CSV of students (and teachers, owners only). The file is read in the browser, checked by the
   database first (nothing is saved during the check), and only saved when you press Import.
   People who have already signed in with a VERIFIED Google email are updated at once. Everyone else is
   approved automatically the first time they sign in with that same Google email.
   No accounts or passwords are created here, and admin accounts can never be changed by an import.
   =================================================================== */
(function () {
  'use strict';
  var MAX_ROWS = 500, MAX_BYTES = 1000000;
  var ALIASES = {
    email: ['email', 'e-mail', 'gmail', 'google email', 'email address', 'gmail address', 'mail', 'mail id', 'email id'],
    name: ['name', 'student name', 'full name', 'teacher name', 'display name'],
    role: ['role', 'type'],
    'class': ['class', 'std', 'standard', 'grade', 'class name'],
    board: ['board'],
    division: ['division', 'div', 'section'],
    school: ['school', 'school name'],
    phone: ['phone', 'mobile', 'phone number', 'mobile number', 'contact', 'student phone', 'student mobile', 'contact number'],
    parent_name: ['parent name', 'parent', 'father name', 'mother name', 'guardian', 'guardian name', 'fathers name'],
    parent_phone: ['parent phone', 'parent mobile', 'parent number', 'father phone', 'father mobile', 'guardian phone', 'parent contact', 'parent contact number'],
    dob: ['dob', 'date of birth', 'birth date', 'birthday']
  };
  var TEMPLATE = 'email,name,role,class,board,division,school,phone,parent_name,parent_phone,dob\r\n' +
    'student.one@gmail.com,Student One,student,10,CBSE,A,Example High School,9876543210,Parent Name,9123456780,2010-05-31\r\n' +
    'student.two@gmail.com,Student Two,student,12,GSEB,B,,,,,\r\n';

  function sb() { return window.photonSupabase; }
  function el(tag, attrs) {
    var e = document.createElement(tag); attrs = attrs || {};
    Object.keys(attrs).forEach(function (k) { var v = attrs[k]; if (v === null || v === undefined || v === false) return; if (k === 'class') e.className = v; else if (k === 'style') e.style.cssText = v; else if (k.indexOf('on') === 0) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v); });
    for (var i = 2; i < arguments.length; i++) add(e, arguments[i]); return e;
  }
  function add(p, c) { if (c === null || c === undefined || c === false) return; if (Array.isArray(c)) { c.forEach(function (x) { add(p, x); }); return; } p.appendChild(c.nodeType ? c : document.createTextNode(String(c))); }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); return n; }
  var css = el('style'); css.textContent = [
    '.pi-card{border:1px solid rgba(127,127,127,.38);border-radius:14px;padding:18px;background:rgba(127,127,127,.09);max-width:900px;margin-bottom:16px}',
    '.pi-card h2{margin:0 0 4px;font-size:18px}.pi-muted{opacity:.75;font-size:13px}.pi-card ol{margin:8px 0 0 18px;padding:0;font-size:14px}.pi-card li{margin:4px 0}',
    '.pi-btn{border:1px solid rgba(127,127,127,.5);background:transparent;color:inherit;border-radius:10px;padding:8px 14px;font:inherit;font-size:13.5px;cursor:pointer}.pi-btn.pri{background:#4fd6e8;border-color:#4fd6e8;color:#06202a;font-weight:600}.pi-btn.bad{border-color:#ff7b7b;color:#ff7b7b}.pi-btn:disabled{opacity:.5;cursor:not-allowed}',
    '.pi-in{box-sizing:border-box;max-width:100%;font:inherit;font-size:14px;color:inherit}',
    '.pi-msg{min-height:20px;margin-top:8px;font-size:13.5px}.pi-msg.err{color:#ff7b7b}.pi-msg.ok{color:#3ddc97}',
    '.pi-acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;align-items:center}',
    '.pi-stats{display:flex;gap:10px;flex-wrap:wrap;margin:10px 0}.pi-stat{border:1px solid rgba(127,127,127,.38);border-radius:12px;padding:8px 14px;min-width:90px}.pi-stat b{display:block;font-size:20px}.pi-stat.good b{color:#3ddc97}.pi-stat.bad b{color:#ff7b7b}',
    '.pi-wrap{overflow-x:auto;max-width:100%;margin-top:8px}.pi-tbl{border-collapse:collapse;width:100%;font-size:13.5px}.pi-tbl th,.pi-tbl td{text-align:left;padding:6px 10px;border-bottom:1px solid rgba(127,127,127,.25);white-space:nowrap}.pi-tbl td.w{white-space:normal;min-width:180px}'
  ].join('\n'); document.head.appendChild(css);

  function norm(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
  var LOOKUP = {}; Object.keys(ALIASES).forEach(function (f) { ALIASES[f].forEach(function (a) { LOOKUP[norm(a)] = f; }); });

  function parseCsv(text) {
    text = String(text || '').replace(/^\ufeff/, '');
    var first = text.split(/\r?\n/, 1)[0] || '', delim = ',', best = -1;
    [',', ';', '\t'].forEach(function (d) { var n = first.split(d).length; if (n > best) { best = n; delim = d; } });
    var rows = [], row = [], cur = '', q = false;
    for (var i = 0; i < text.length; i++) {
      var c = text.charAt(i);
      if (q) { if (c === '"') { if (text.charAt(i + 1) === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
      else if (c === '"') q = true;
      else if (c === delim) { row.push(cur); cur = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text.charAt(i + 1) === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
      else cur += c;
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (x) { return String(x).trim() !== ''; }); });
  }
  function mapRows(table) {
    if (!table.length) return { error: 'The file is empty.' };
    var idx = {}, ignored = [];
    table[0].forEach(function (h, i) { var f = LOOKUP[norm(h)]; if (f && idx[f] === undefined) idx[f] = i; else if (String(h).trim()) ignored.push(String(h).trim().slice(0, 30)); });
    if (idx.email === undefined) return { error: 'I could not find an email column. The first row must have headings, and one must be "email" (or "gmail").' };
    var out = table.slice(1).map(function (r) {
      var o = {}; Object.keys(idx).forEach(function (f) { var v = r[idx[f]]; if (v !== undefined && String(v).trim() !== '') o[f] = String(v).trim().slice(0, 300); }); return o;
    });
    return { rows: out, ignored: ignored };
  }
  function when(s) { if (!s) return ''; try { return new Date(s).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return ''; } }
  function why(e) { var m = (e && e.message) || ''; return /Only an admin|Only an owner|Import at most|Rows must be/i.test(m) ? m : 'Something went wrong. Please try again.'; }
  function save(name, text) {
    var url = URL.createObjectURL(new Blob(['\ufeff' + text], { type: 'text/csv;charset=utf-8' })), a = el('a', { href: url, download: name });
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }
  function table(head, body) {
    return el('div', { class: 'pi-wrap' }, el('table', { class: 'pi-tbl' },
      el('thead', {}, el('tr', {}, head.map(function (h) { return el('th', {}, h); }))),
      el('tbody', {}, body.map(function (r) { return el('tr', {}, r.map(function (c, i) { return el('td', { class: i === r.length - 1 && head[head.length - 1] === 'Reason' ? 'w' : '' }, c); })); }))));
  }

  window.photonAdminImport = async function (view) {
    clear(view);
    var rows = null, busy = false;
    var msg = el('div', { class: 'pi-msg' }), resBox = el('div', {}), listBox = el('div', {});
    var importBtn = el('button', { type: 'button', class: 'pi-btn pri', disabled: true }, 'Import');
    var fileIn = el('input', { type: 'file', accept: '.csv,text/csv,text/plain', class: 'pi-in', 'aria-label': 'Choose a CSV file' });
    function say(t, k) { msg.textContent = t || ''; msg.className = 'pi-msg' + (k ? ' ' + k : ''); }

    view.appendChild(el('div', { class: 'pi-card' }, el('h2', {}, 'Bulk import'),
      el('div', { class: 'pi-muted' }, 'Add many students at once from a spreadsheet. Nobody gets a password: each person signs in with their own Google account, and is placed in the right class automatically the first time they use the same Google email you list here.'),
      el('ol', {}, el('li', {}, 'Download the template and fill one person per row. The Google email is required.'),
        el('li', {}, 'In Excel or Google Sheets choose Save as CSV, then pick the file below.'),
        el('li', {}, 'Check the result. Nothing is saved until you press Import.')),
      el('div', { class: 'pi-acts' }, el('button', { type: 'button', class: 'pi-btn', onclick: function () { save('photon-import-template.csv', TEMPLATE); } }, 'Download CSV template')),
      el('div', { class: 'pi-muted', style: 'margin-top:10px' }, 'Columns: email, name, role (student or teacher), class (6 to 12), board (CBSE, ICSE or GSEB), division (A, B or C), school, phone, parent_name, parent_phone, dob (like 2012-05-31). Teachers can be imported by owners only. Admin accounts are never changed. Up to ' + MAX_ROWS + ' people per file.')));

    view.appendChild(el('div', { class: 'pi-card' }, el('h2', {}, 'Choose your file'), fileIn, el('div', { class: 'pi-acts' }, importBtn), msg, resBox));
    view.appendChild(el('div', { class: 'pi-card' }, el('h2', {}, 'Waiting for first sign-in'), el('div', { class: 'pi-muted' }, 'People you listed who have not signed in yet. They are approved automatically the first time they sign in with that Google email.'), listBox));

    function showCheck(r, ignored) {
      clear(resBox);
      var rej = r.rejected || [];
      resBox.appendChild(el('div', { class: 'pi-stats' },
        el('div', { class: 'pi-stat good' }, el('b', {}, r.ok), 'ready to import'),
        el('div', { class: 'pi-stat' }, el('b', {}, r.apply_now), 'will be updated at once'),
        el('div', { class: 'pi-stat' }, el('b', {}, Math.max(0, r.ok - r.apply_now)), 'wait for first sign-in'),
        el('div', { class: 'pi-stat' + (rej.length ? ' bad' : '') }, el('b', {}, rej.length), 'skipped')));
      if (rej.length) {
        resBox.appendChild(el('div', { class: 'pi-muted' }, 'Skipped rows are not imported. Row 1 is the first person under your heading row. Fix them in your sheet and upload again if needed.'));
        resBox.appendChild(table(['Row', 'Email', 'Reason'], rej.slice(0, 200).map(function (x) { return [x.row, x.email || '(empty)', x.reason]; })));
        if (rej.length > 200) resBox.appendChild(el('div', { class: 'pi-muted' }, 'Showing the first 200 skipped rows.'));
      }
      if (ignored && ignored.length) resBox.appendChild(el('div', { class: 'pi-muted', style: 'margin-top:8px' }, 'Columns not used: ' + ignored.join(', ') + '.'));
      importBtn.textContent = r.ok ? 'Import ' + r.ok + (r.ok === 1 ? ' person' : ' people') : 'Nothing to import';
      importBtn.disabled = !r.ok;
    }
    async function check(list, ignored) {
      busy = true; importBtn.disabled = true; say('Checking\u2026');
      var r = await sb().rpc('admin_import_roster', { p_rows: list, p_apply: false });
      busy = false;
      if (r.error) { say(why(r.error), 'err'); clear(resBox); return; }
      say('Checked. Nothing has been saved yet.'); showCheck(r.data, ignored);
    }
    fileIn.addEventListener('change', function () {
      var f = fileIn.files && fileIn.files[0]; rows = null; clear(resBox); importBtn.disabled = true; importBtn.textContent = 'Import';
      if (!f) return say('');
      if (f.size > MAX_BYTES) return say('That file is too large. Please upload a CSV smaller than 1 MB.', 'err');
      var rd = new FileReader();
      rd.onerror = function () { say('Could not read that file.', 'err'); };
      rd.onload = function () {
        var m = mapRows(parseCsv(rd.result));
        if (m.error) return say(m.error, 'err');
        if (!m.rows.length) return say('The file has headings but no people in it.', 'err');
        if (m.rows.length > MAX_ROWS) return say('This file has ' + m.rows.length + ' people. Please upload at most ' + MAX_ROWS + ' at a time.', 'err');
        rows = m.rows; check(rows, m.ignored);
      };
      rd.readAsText(f);
    });
    importBtn.addEventListener('click', async function () {
      if (!rows || busy) return;
      if (!window.confirm('Import this list now? People already signed in are updated immediately; the others are approved when they first sign in.')) return;
      busy = true; importBtn.disabled = true; say('Importing\u2026');
      var r = await sb().rpc('admin_import_roster', { p_rows: rows, p_apply: true });
      busy = false;
      if (r.error) { say(why(r.error), 'err'); importBtn.disabled = false; return; }
      var d = r.data || {}; rows = null; fileIn.value = ''; clear(resBox); importBtn.textContent = 'Import';
      say('Imported ' + d.ok + (d.ok === 1 ? ' person' : ' people') + '. ' + d.apply_now + ' updated at once' + ((d.rejected || []).length ? ', ' + d.rejected.length + ' skipped' : '') + '.', 'ok');
      loadList();
    });

    async function loadList() {
      var r = await sb().from('import_roster').select('email,role,class_name,board,division,display_name,imported_at,claimed_at').order('imported_at', { ascending: false }).limit(300);
      clear(listBox);
      if (r.error) { listBox.appendChild(el('div', { class: 'pi-muted' }, 'Could not load this list.')); return; }
      var all = r.data || [], waiting = all.filter(function (x) { return !x.claimed_at; }), done = all.length - waiting.length;
      listBox.appendChild(el('div', { class: 'pi-muted', style: 'margin-top:6px' }, waiting.length + ' waiting' + ' \u00B7 ' + done + ' already signed in' + (all.length >= 300 ? ' (showing the latest 300)' : '')));
      if (!waiting.length) { listBox.appendChild(el('div', { class: 'pi-muted', style: 'margin-top:8px' }, 'Nobody is waiting.')); return; }
      listBox.appendChild(table(['Email', 'Name', 'Role', 'Class', 'Added', ''], waiting.map(function (x) {
        var b = el('button', { type: 'button', class: 'pi-btn bad', onclick: async function () {
          if (!window.confirm('Remove ' + x.email + ' from the waiting list?')) return;
          b.disabled = true; var d = await sb().rpc('admin_roster_remove', { p_email: x.email });
          if (d.error) { say(why(d.error), 'err'); b.disabled = false; return; }
          say('Removed.', 'ok'); loadList();
        } }, 'Remove');
        return [x.email, x.display_name || '', x.role, x.role === 'student' ? [x.class_name || '', x.board ? ' ' + x.board : '', x.division ? ' ' + x.division : ''].join('') : '', when(x.imported_at), b];
      })));
    }
    await loadList();
  };
  window.PhotonImport = { parseCsv: parseCsv, mapRows: mapRows };
})();
