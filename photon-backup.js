/* ===================================================================
   Photon Academy - Admin screen "Backup & export" + system status
   - Download any Supabase table as a CSV (opens in Excel / Google Sheets)
   - Download one full backup file (JSON) of all the academy's records
   - Status checks for the database, file store service and attendance service
   Read-only: this screen only READS data. It never changes or deletes anything.
   Secrets are never exported (AI keys and API-key tables are left out on purpose).
   Attendance records live on Neon: use Admin > Attendance > Reports > Download CSV for those.
   =================================================================== */
(function () {
  'use strict';
  var GROUPS = [
    ['Students and teachers', ['profiles', 'teacher_classes']],
    ['Fees', ['fee_plans', 'fee_student_overrides', 'fee_dues', 'fee_payments', 'fee_audit']],
    ['Tests and marks', ['tests', 'test_marks']],
    ['Homework', ['homework', 'homework_submissions']],
    ['Timetable and schedule', ['class_timetable', 'timetable_changes', 'schedule_items', 'schedule_done']],
    ['Announcements and notes', ['announcements', 'announcement_media', 'student_notes', 'notes']],
    ['Enquiries', ['forms', 'form_submissions']],
    ['Website content', ['site_content', 'faculty', 'faqs', 'testimonials', 'quotes', 'site_photos', 'custom_sections']]
  ];
  var CHECKS = [
    ['Attendance service (Neon)', 'https://br-proud-mountain-azsuoe88-attendance.compute.c-3.ap-southeast-1.aws.neon.tech/health'],
    ['Notes and file service (Cloudflare)', 'https://photon-academy-notes.photonacademy.workers.dev/']
  ];
  function el(tag, attrs) {
    var e = document.createElement(tag); attrs = attrs || {};
    Object.keys(attrs).forEach(function (k) { var v = attrs[k]; if (v === null || v === undefined || v === false) return; if (k === 'class') e.className = v; else if (k === 'style') e.style.cssText = v; else if (k.indexOf('on') === 0) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v); });
    for (var i = 2; i < arguments.length; i++) add(e, arguments[i]); return e;
  }
  function add(p, c) { if (c === null || c === undefined || c === false) return; if (Array.isArray(c)) { c.forEach(function (x) { add(p, x); }); return; } p.appendChild(c.nodeType ? c : document.createTextNode(String(c))); }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); return n; }
  var css = el('style'); css.textContent = [
    '.pb-card{border:1px solid rgba(127,127,127,.38);border-radius:14px;padding:18px;background:rgba(127,127,127,.09);max-width:900px;margin-bottom:16px}',
    '.pb-card h2{margin:0 0 4px;font-size:18px}.pb-muted{opacity:.75;font-size:13px}',
    '.pb-row{display:flex;gap:10px;justify-content:space-between;align-items:center;flex-wrap:wrap;border:1px solid rgba(127,127,127,.38);border-radius:12px;padding:8px 12px;margin:6px 0}',
    '.pb-btn{border:1px solid rgba(127,127,127,.5);background:transparent;color:inherit;border-radius:10px;padding:7px 13px;font:inherit;font-size:13.5px;cursor:pointer}.pb-btn.pri{background:#4fd6e8;border-color:#4fd6e8;color:#06202a;font-weight:600}.pb-btn:disabled{opacity:.5;cursor:not-allowed}',
    '.pb-badge{display:inline-block;border-radius:99px;border:1px solid rgba(127,127,127,.45);padding:1px 10px;font-size:12px;margin-left:6px}.pb-badge.ok{color:#3ddc97;border-color:#3ddc97}.pb-badge.bad{color:#ff7b7b;border-color:#ff7b7b}.pb-badge.off{color:#f5b942;border-color:#f5b942}',
    '.pb-msg{min-height:20px;margin-top:8px;font-size:13.5px}'
  ].join('\n'); document.head.appendChild(css);

  function csvCell(v) {
    if (v === null || v === undefined) return '';
    if (typeof v === 'object') v = JSON.stringify(v);
    v = String(v);
    if (/^[=+\-@\t\r]/.test(v)) v = "'" + v; // stops spreadsheet formulas in exported text
    return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }
  function toCsv(rows) {
    if (!rows.length) return '';
    var cols = []; rows.forEach(function (r) { Object.keys(r).forEach(function (k) { if (cols.indexOf(k) < 0) cols.push(k); }); });
    return '\ufeff' + [cols.map(csvCell).join(',')].concat(rows.map(function (r) { return cols.map(function (c) { return csvCell(r[c]); }).join(','); })).join('\r\n');
  }
  function save(name, text, type) {
    var url = URL.createObjectURL(new Blob([text], { type: type })), a = el('a', { href: url, download: name });
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }
  async function fetchAll(table) {
    var sb = window.photonSupabase, out = [], from = 0, step = 1000, ordered = true;
    for (var guard = 0; guard < 50; guard++) {
      var q = sb.from(table).select('*'); if (ordered) q = q.order('id', { ascending: true });
      var r = await q.range(from, from + step - 1);
      if (r.error && ordered && /column|order/i.test(r.error.message || '')) { ordered = false; guard--; continue; }
      if (r.error) throw r.error;
      var d = r.data || []; out = out.concat(d); if (d.length < step) break; from += step;
    }
    return out;
  }
  function stamp() { return new Date().toISOString().slice(0, 10); }
  function why(e) { var m = (e && e.message) || ''; return /relation|does not exist|schema cache/i.test(m) ? 'table not found' : /permission|row-level/i.test(m) ? 'no access' : 'could not read'; }

  window.photonAdminBackup = function (view) {
    clear(view);
    var msg = el('div', { class: 'pb-msg' });
    var top = el('div', { class: 'pb-card' }, el('h2', {}, 'Backup & export'),
      el('div', { class: 'pb-muted' }, 'Download your academy\u2019s records. The backup file contains personal data (names, phone numbers, fees), so keep it somewhere private and do not share it. Nothing here changes or deletes data. Attendance records are on Neon: use Attendance > Reports > Download CSV. Notes files stay in Notes library.'));
    var full = el('button', { type: 'button', class: 'pb-btn pri', style: 'margin-top:12px' }, 'Download full backup (one file)');
    full.onclick = async function () {
      full.disabled = true; var bundle = { app: 'photon-academy', created_at: new Date().toISOString(), tables: {}, skipped: {} }, n = 0;
      for (var g = 0; g < GROUPS.length; g++) for (var i = 0; i < GROUPS[g][1].length; i++) {
        var t = GROUPS[g][1][i]; msg.textContent = 'Reading ' + t + '\u2026';
        try { bundle.tables[t] = await fetchAll(t); n += bundle.tables[t].length; } catch (e) { bundle.skipped[t] = why(e); }
      }
      save('photon-backup-' + stamp() + '.json', JSON.stringify(bundle, null, 1), 'application/json');
      var sk = Object.keys(bundle.skipped); msg.textContent = 'Backup downloaded: ' + n + ' records.' + (sk.length ? ' Skipped: ' + sk.map(function (k) { return k + ' (' + bundle.skipped[k] + ')'; }).join(', ') + '.' : ''); full.disabled = false;
    };
    top.appendChild(full); top.appendChild(msg); view.appendChild(top);
    var status = el('div', { class: 'pb-card' }, el('h2', {}, 'System status'), el('div', { class: 'pb-muted' }, 'Quick checks that each service answers right now.'));
    view.appendChild(status); runStatus(status);
    GROUPS.forEach(function (g) {
      var c = el('div', { class: 'pb-card' }, el('h2', {}, g[0]));
      g[1].forEach(function (t) {
        var b = el('button', { type: 'button', class: 'pb-btn' }, 'Download CSV'), note = el('span', { class: 'pb-muted' });
        b.onclick = async function () {
          b.disabled = true; note.textContent = 'Reading\u2026';
          try { var rows = await fetchAll(t); if (!rows.length) note.textContent = 'Empty, nothing to download.'; else { save(t + '-' + stamp() + '.csv', toCsv(rows), 'text/csv;charset=utf-8'); note.textContent = rows.length + ' rows downloaded.'; } }
          catch (e) { note.textContent = 'Failed: ' + why(e) + '.'; }
          b.disabled = false;
        };
        c.appendChild(el('div', { class: 'pb-row' }, el('span', {}, t), el('span', { style: 'display:flex;gap:10px;align-items:center;flex-wrap:wrap' }, note, b)));
      });
      view.appendChild(c);
    });
  };
  async function runStatus(box) {
    function line(name, state, text) { box.appendChild(el('div', { class: 'pb-row' }, el('span', {}, name), el('span', { class: 'pb-badge ' + state }, text))); }
    try { var t0 = Date.now(), r = await window.photonSupabase.from('profiles').select('id', { count: 'exact', head: true }); line('Database and login (Supabase)', r.error ? 'bad' : 'ok', r.error ? 'problem' : 'working \u00B7 ' + (Date.now() - t0) + ' ms'); } catch (e) { line('Database and login (Supabase)', 'bad', 'problem'); }
    for (var i = 0; i < CHECKS.length; i++) {
      var c = CHECKS[i]; try { var s = Date.now(), res = await fetch(c[1], { cache: 'no-store' }); line(c[0], res.ok ? 'ok' : 'bad', res.ok ? 'working \u00B7 ' + (Date.now() - s) + ' ms' : 'error ' + res.status); } catch (e) { line(c[0], 'off', 'could not check from here'); }
    }
  }
  window.PhotonBackup = { toCsv: toCsv };
})();
