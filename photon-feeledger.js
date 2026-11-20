/* ===================================================================
   Photon Academy - Admin screen "Student fees"
   One place to see every student's fees, then open a student to:
   record a payment (any amount, any time), reduce a fee, add a fee with a custom amount,
   edit the date or note, cancel a fee, void a payment, reverse a reduction,
   or bill the student in instalments.
   The database does every check and keeps the audit record. This screen only calls protected functions.
   Money records are never deleted: a fee is cancelled, a payment is voided, a reduction is reversed.
   =================================================================== */
(function () {
  'use strict';
  var CLASSES = ['6', '7', '8', '9', '10', '11', '12'], MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var METHODS = { cash: 'Cash', bank: 'Bank transfer', upi: 'UPI', other: 'Other' };
  var KINDS = { hardship: 'Hardship', merit: 'Merit', sibling: 'Sibling', staff: 'Staff child', other: 'Other' };
  var FILTERS = { all: 'All', balance: 'With balance', overdue: 'Overdue', paid: 'Fully paid', concession: 'With reductions' };
  function sb() { return window.photonSupabase; }
  function el(tag, attrs) {
    var e = document.createElement(tag); attrs = attrs || {};
    Object.keys(attrs).forEach(function (k) { var v = attrs[k]; if (v === null || v === undefined || v === false) return; if (k === 'class') e.className = v; else if (k === 'style') e.style.cssText = v; else if (k === 'value') e.value = v; else if (k.indexOf('on') === 0) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v); });
    for (var i = 2; i < arguments.length; i++) add(e, arguments[i]); return e;
  }
  function add(p, c) { if (c === null || c === undefined || c === false) return; if (Array.isArray(c)) { c.forEach(function (x) { add(p, x); }); return; } p.appendChild(c.nodeType ? c : document.createTextNode(String(c))); }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); return n; }
  var css = el('style'); css.textContent = [
    '.fg-card{border:var(--ph-w,1.5px) solid var(--line,rgba(127,127,127,.6));border-radius:14px;padding:18px;background:rgba(127,127,127,.09);max-width:1100px;margin-bottom:16px}',
    '.fg-card h2{margin:0 0 4px;font-size:20px}.fg-card h3{margin:16px 0 6px;font-size:16px}.fg-muted{opacity:.78;font-size:13.5px}.fg-card p{margin:8px 0}',
    '.fg-btn{border:1px solid var(--line,rgba(127,127,127,.6));background:transparent;color:inherit;border-radius:10px;padding:8px 14px;font:inherit;font-size:13.5px;cursor:pointer}.fg-btn.pri{background:#4fd6e8;border-color:#4fd6e8;color:#06202a;font-weight:600}.fg-btn.bad{border-color:#ff7b7b;color:#ff7b7b}.fg-btn.sm{padding:4px 10px;font-size:12.5px}.fg-btn:disabled{opacity:.5;cursor:not-allowed}',
    '.fg-in{box-sizing:border-box;background:transparent;color:inherit;border:1px solid var(--line,rgba(127,127,127,.6));border-radius:10px;padding:8px 10px;font:inherit;font-size:14px;max-width:100%}',
    '.fg-lbl{display:block;font-size:13px;margin:10px 0 4px;font-weight:600}.fg-bar{display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end}.fg-bar>div{display:flex;flex-direction:column}',
    '.fg-acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;align-items:center}.fg-msg{min-height:20px;margin-top:8px;font-size:13.5px}.fg-msg.err{color:#ff7b7b}.fg-msg.ok{color:#3ddc97}',
    '.fg-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(135px,1fr));gap:10px;margin:12px 0}.fg-tile{border:1.5px solid var(--line,rgba(127,127,127,.6));border-radius:12px;padding:10px 14px}.fg-tile b{display:block;font-size:22px;line-height:1.15;font-family:var(--ph-head,Georgia,serif)}.fg-tile span{display:block;font-size:13px}',
    '.fg-wrap{overflow-x:auto;max-width:100%;margin-top:8px}.fg-tbl{border-collapse:collapse;width:100%;font-size:13.5px}.fg-tbl th,.fg-tbl td{text-align:left;padding:6px 10px;border-bottom:1px solid rgba(127,127,127,.35);white-space:nowrap;vertical-align:top}.fg-tbl th{font-weight:600}.fg-tbl td.n,.fg-tbl th.n{text-align:right}.fg-tbl tr.fg-click{cursor:pointer}.fg-tbl tr.fg-click:hover{background:rgba(127,127,127,.12)}.fg-wrapt{white-space:normal!important;min-width:160px;max-width:300px}',
    '.fg-badge{display:inline-block;border-radius:99px;border:1px solid rgba(127,127,127,.55);padding:1px 10px;font-size:12px}.fg-badge.ok{color:#3ddc97;border-color:#3ddc97}.fg-badge.warn{color:#f5b942;border-color:#f5b942}.fg-badge.bad{color:#ff7b7b;border-color:#ff7b7b}',
    '.fg-warn{border:1.5px solid #f5b942;border-radius:12px;padding:10px 14px;margin:12px 0;font-size:14px}.fg-prev{border:1px dashed rgba(127,127,127,.6);border-radius:12px;padding:10px 14px;margin:10px 0;font-size:14px;line-height:1.6}',
    '.fg-form{border:1.5px solid #4fd6e8;border-radius:12px;padding:14px;margin:12px 0}.fg-form .fg-in{width:100%;max-width:420px}.fg-inline{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.fg-inline .fg-in{width:auto;flex:1;min-width:120px}'
  ].join('\n'); document.head.appendChild(css);

  function inr(p) { var n = Number(p) || 0, r = n % 100 !== 0; return '\u20B9' + (n / 100).toLocaleString('en-IN', { minimumFractionDigits: r ? 2 : 0, maximumFractionDigits: 2 }); }
  function dnice(s) { var p = String(s || '').slice(0, 10).split('-'); return p.length === 3 ? Number(p[2]) + ' ' + MON[Number(p[1]) - 1] + ' ' + p[0] : ''; }
  function dtnice(s) { if (!s) return ''; var d = new Date(s); return isNaN(d) ? '' : d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear(); }
  function toPaise(v) { var n = Number(String(v == null ? '' : v).replace(/[\u20B9,\s]/g, '')); if (!isFinite(n) || n <= 0 || n > 100000) return null; return Math.round(n * 100); }
  function today() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function classLabel(r) { return r.class ? 'Class ' + r.class + (r.board ? ' ' + r.board : '') + (r.division ? ' ' + r.division : '') : ''; }

  // calls the database; turns a "Fees are locked" answer into the unlock pad
  async function call(name, args) {
    var r; try { r = await sb().rpc(name, args || {}); } catch (e) { r = { error: e }; }
    if (r.error) {
      if (window.photonFeeIsLockError && window.photonFeeIsLockError(r.error)) { var x = new Error('Fees are locked. Unlock them to continue.'); x.locked = true; throw x; }
      throw r.error;
    }
    return r.data;
  }
  function showErr(box, e) {
    if (e && e.locked) { box.textContent = 'Fees are locked. Opening the unlock pad\u2026'; box.className = 'fg-msg err'; if (window.photonFeeRelock) window.photonFeeRelock(); return; }
    var m = (e && e.message) || ''; box.textContent = m && m.length < 220 ? m : 'Something went wrong. Nothing was changed. Please try again.'; box.className = 'fg-msg err';
  }
  function tile(v, label) { return el('div', { class: 'fg-tile' }, el('b', {}, v), el('span', {}, label)); }
  function table(heads, rows, numCols) {
    numCols = numCols || [];
    return el('div', { class: 'fg-wrap' }, el('table', { class: 'fg-tbl' },
      el('thead', {}, el('tr', {}, heads.map(function (h, i) { return el('th', { class: numCols.indexOf(i) >= 0 ? 'n' : '' }, h); }))),
      el('tbody', {}, rows)));
  }
  function td(c, n) { return el('td', { class: n ? 'n' : '' }, c); }

  window.photonAdminFeeLedger = async function (view) {
    clear(view);
    var F = window.__feeLedgerFilter = window.__feeLedgerFilter || { cls: '', q: '', filter: 'all' };
    var root = el('div'); view.appendChild(root);
    showList();

    // ===================================================== LIST OF STUDENTS
    function showList() {
      clear(root);
      var msg = el('div', { class: 'fg-msg' }), tiles = el('div'), tbl = el('div'), seq = 0, timer = null;
      var cls = el('select', { class: 'fg-in', 'aria-label': 'Class' }, el('option', { value: '' }, 'All classes'), CLASSES.map(function (c) { return el('option', { value: c }, 'Class ' + c); }));
      var q = el('input', { class: 'fg-in', type: 'search', placeholder: 'Search by name', 'aria-label': 'Search by name', maxlength: '60' });
      var flt = el('select', { class: 'fg-in', 'aria-label': 'Show' }, Object.keys(FILTERS).map(function (k) { return el('option', { value: k }, FILTERS[k]); }));
      cls.value = F.cls; q.value = F.q; flt.value = F.filter;
      root.appendChild(el('div', { class: 'fg-card' }, el('h2', {}, 'Student fees'),
        el('div', { class: 'fg-muted' }, 'See what every student owes and has paid. Open a student to record a payment (any amount, any time), reduce a fee, or add a fee with a custom amount.'),
        el('div', { class: 'fg-bar', style: 'margin-top:12px' }, el('div', {}, el('label', { class: 'fg-lbl', style: 'margin-top:0' }, 'Class'), cls), el('div', {}, el('label', { class: 'fg-lbl', style: 'margin-top:0' }, 'Name'), q), el('div', {}, el('label', { class: 'fg-lbl', style: 'margin-top:0' }, 'Show'), flt)), msg));
      root.appendChild(el('div', { class: 'fg-card' }, tiles, tbl));
      async function load() {
        var my = ++seq; msg.textContent = 'Loading\u2026'; msg.className = 'fg-msg';
        var d; try { d = await call('admin_fee_ledger', { p_class: F.cls || null, p_q: F.q || null, p_filter: F.filter }); } catch (e) { if (my === seq) showErr(msg, e); return; }
        if (my !== seq) return; msg.textContent = '';
        var t = d.totals || {};
        clear(tiles).appendChild(el('div', { class: 'fg-tiles' }, tile(t.students || 0, 'students'), tile(inr(t.fee_total), 'total fees'), tile(inr(t.concessions), 'reductions given'), tile(inr(t.paid), 'paid'), tile(inr(t.balance), 'balance'), tile(inr(t.overdue), 'overdue')));
        var rows = d.rows || [];
        clear(tbl);
        if (!rows.length) { tbl.appendChild(el('p', { class: 'fg-muted' }, 'No students match this view.')); return; }
        if (d.count > rows.length) tbl.appendChild(el('div', { class: 'fg-warn' }, 'Showing the first ' + rows.length + ' of ' + d.count + ' students. Use the class, name or Show filters to narrow the list.'));
        tbl.appendChild(table(['Student', 'Class', 'Fees', 'Reductions', 'Paid', 'Balance', 'Overdue', 'Next due', ''], rows.map(function (r) {
          var tr = el('tr', { class: 'fg-click', onclick: function () { showStudent(r.id); } },
            td(r.name), td(classLabel(r)), td(inr(r.fee_total), 1), td(r.concessions ? inr(r.concessions) : '-', 1), td(inr(r.paid), 1),
            td(r.balance > 0 ? inr(r.balance) : (r.fee_total > 0 ? el('span', { class: 'fg-badge ok' }, 'Paid') : '-'), 1),
            td(r.overdue > 0 ? el('span', { class: 'fg-badge bad' }, inr(r.overdue)) : '-', 1), td(r.next_due ? dnice(r.next_due) : '-'),
            td(el('button', { type: 'button', class: 'fg-btn sm', onclick: function (ev) { ev.stopPropagation(); showStudent(r.id); } }, 'Open')));
          return tr;
        }), [2, 3, 4, 5, 6]));
      }
      cls.addEventListener('change', function () { F.cls = cls.value; load(); });
      flt.addEventListener('change', function () { F.filter = flt.value; load(); });
      q.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(function () { F.q = q.value.trim(); load(); }, 350); });
      load();
    }

    // ===================================================== ONE STUDENT
    async function showStudent(id, flash) {
      clear(root);
      var msg = el('div', { class: 'fg-msg' }), formBox = el('div'), body = el('div');
      var back = el('button', { type: 'button', class: 'fg-btn', onclick: showList }, '\u2190 All students');
      root.appendChild(el('div', { class: 'fg-acts', style: 'margin:0 0 10px' }, back));
      root.appendChild(msg); root.appendChild(formBox); root.appendChild(body);
      if (flash) { msg.textContent = flash; msg.className = 'fg-msg ok'; } else { msg.textContent = 'Loading\u2026'; }
      var D; try { D = await call('admin_fee_student', { p_student: id }); } catch (e) { return showErr(msg, e); }
      if (!flash) msg.textContent = '';
      var st = D.student, T = D.totals, dues = D.dues || [], pays = D.payments || [], cons = D.concessions || [];
      var openDues = dues.filter(function (d) { return d.status === 'open'; });
      var payable = openDues.filter(function (d) { return d.balance > 0; });
      function reload(m) { showStudent(id, m); }

      // generic inline form
      function openForm(title, intro, fields, okLabel, danger, onOk, extra) {
        var fmsg = el('div', { class: 'fg-msg' }), ok = el('button', { type: 'button', class: 'fg-btn ' + (danger ? 'bad' : 'pri') }, okLabel), no = el('button', { type: 'button', class: 'fg-btn', onclick: function () { clear(formBox); } }, 'Cancel');
        var card = el('div', { class: 'fg-form' }, el('h3', { style: 'margin-top:0' }, title), intro ? el('div', { class: 'fg-muted' }, intro) : null, fields, extra || null, el('div', { class: 'fg-acts' }, ok, no), fmsg);
        ok.addEventListener('click', async function () {
          fmsg.textContent = ''; ok.disabled = true;
          try { await onOk(fmsg); } catch (e) { if (e && e.silent) { ok.disabled = false; return; } showErr(fmsg, e); ok.disabled = false; }
        });
        clear(formBox).appendChild(card); card.scrollIntoView && card.scrollIntoView({ block: 'nearest' }); return card;
      }
      function fail(box, t) { box.textContent = t; box.className = 'fg-msg err'; var e = new Error(t); e.silent = true; return e; }
      function dueLabel(d) { return d.title + ' \u00B7 due ' + dnice(d.due_date) + ' \u00B7 balance ' + inr(d.balance); }
      function dueSelect(list, pre) {
        var s = el('select', { class: 'fg-in', 'aria-label': 'Fee' }, list.map(function (d) { return el('option', { value: d.id }, dueLabel(d)); }));
        if (pre && list.some(function (d) { return d.id === pre; })) s.value = pre; return s;
      }
      function find(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }
      function lbl(t) { return el('label', { class: 'fg-lbl' }, t); }

      // ---- record a payment
      function payForm(pre) {
        if (!payable.length) { msg.textContent = 'This student has no open fee with a balance. Add a fee first.'; msg.className = 'fg-msg err'; return; }
        var due = dueSelect(payable, pre), amt = el('input', { class: 'fg-in', type: 'text', inputmode: 'decimal', placeholder: 'Amount in rupees' }), full = el('button', { type: 'button', class: 'fg-btn sm' }, 'Pay full balance');
        var me = el('select', { class: 'fg-in', 'aria-label': 'Method' }, Object.keys(METHODS).map(function (k) { return el('option', { value: k }, METHODS[k]); }));
        var ref = el('input', { class: 'fg-in', type: 'text', maxlength: '80', placeholder: 'Optional: UPI reference, cheque no.' }), nt = el('input', { class: 'fg-in', type: 'text', maxlength: '200', placeholder: 'Optional note' });
        full.addEventListener('click', function () { var d = find(payable, due.value); if (d) amt.value = (d.balance / 100); });
        openForm('Record a payment', 'Any amount, any time. A part payment is fine: the rest stays as the balance.',
          [lbl('Fee'), due, lbl('Amount received (\u20B9)'), el('div', { class: 'fg-inline' }, amt, full), lbl('Method'), me, lbl('Reference'), ref, lbl('Note'), nt],
          'Record payment', false, async function (fm) {
            var d = find(payable, due.value), p = toPaise(amt.value);
            if (!d) throw fail(fm, 'Choose a fee.');
            if (p === null) throw fail(fm, 'Enter the amount in rupees (up to \u20B91,00,000).');
            if (p > d.balance) throw fail(fm, 'This is more than the balance of ' + inr(d.balance) + '.');
            var rc = await call('admin_record_fee_payment', { p_due_id: d.id, p_amount_paise: p, p_method: me.value, p_ref: ref.value.trim() || null, p_note: nt.value.trim() || null });
            reload('Payment of ' + inr(p) + ' recorded.' + (rc ? ' Receipt ' + (typeof rc === 'object' ? JSON.stringify(rc) : rc) + '.' : ''));
          });
      }

      // ---- reduce a fee
      function reduceForm(pre) {
        if (!openDues.length) { msg.textContent = 'This student has no open fee to reduce.'; msg.className = 'fg-msg err'; return; }
        var due = dueSelect(openDues, pre);
        var mode = el('select', { class: 'fg-in', 'aria-label': 'How' }, el('option', { value: 'amount' }, 'Reduce by an amount (\u20B9)'), el('option', { value: 'percent' }, 'Reduce by a percent (%)'), el('option', { value: 'set_total' }, 'Set a new total fee (\u20B9)'));
        var val = el('input', { class: 'fg-in', type: 'text', inputmode: 'decimal' }), kind = el('select', { class: 'fg-in', 'aria-label': 'Category' }, Object.keys(KINDS).map(function (k) { return el('option', { value: k }, KINDS[k]); }));
        var why = el('textarea', { class: 'fg-in', rows: '2', maxlength: '300', placeholder: 'Why? At least 10 characters. Kept as a private record.' }), prev = el('div', { class: 'fg-prev' });
        function calc() {
          var d = find(openDues, due.value); if (!d) return null; var m = mode.value, v = Number(String(val.value).replace(/[\u20B9,%\s]/g, '')), red = null;
          if (isFinite(v) && v > 0) { if (m === 'amount') red = Math.round(v * 100); else if (m === 'percent') red = v <= 100 ? Math.floor(d.amount * v / 100) : null; else red = d.amount - Math.round(v * 100); }
          return { d: d, red: red };
        }
        function draw() {
          var c = calc(); clear(prev); if (!c) return;
          var d = c.d, paidNote = 'Already paid: ' + inr(d.paid);
          if (c.red === null) { prev.textContent = 'Current fee ' + inr(d.amount) + '. ' + paidNote + '. Enter a value to see the new fee.'; return; }
          var nf = d.amount - c.red;
          if (c.red < 100) { prev.textContent = 'The reduction must be at least \u20B91.'; return; }
          if (nf < 100) { prev.textContent = 'The fee cannot go below \u20B91. To waive a whole fee, cancel it instead.'; return; }
          if (nf < d.paid) { prev.textContent = 'Already paid ' + inr(d.paid) + ', so the fee cannot be reduced below that.'; return; }
          prev.appendChild(document.createTextNode('Current fee ' + inr(d.amount) + '  \u2192  reduction ' + inr(c.red) + '  \u2192  new fee ' + inr(nf) + '. ' + paidNote + '. New balance ' + inr(nf - d.paid) + (nf === d.paid ? ' (the fee will be closed as paid).' : '.')));
        }
        [due, mode, val].forEach(function (x) { x.addEventListener('input', draw); x.addEventListener('change', draw); });
        mode.addEventListener('change', function () { val.placeholder = mode.value === 'percent' ? 'Percent, for example 25' : 'Rupees'; });
        val.placeholder = 'Rupees';
        openForm('Reduce a fee', 'Works even after payments, but never below what was already paid. The reason is for your records only: students never see it.',
          [lbl('Fee'), due, lbl('How'), mode, lbl('Value'), val, lbl('Category'), kind, lbl('Reason'), why], 'Reduce fee', false, async function (fm) {
            var c = calc(); if (!c || c.red === null) throw fail(fm, 'Enter a value for the reduction.');
            if (String(why.value).trim().length < 10) throw fail(fm, 'Please write the reason in at least 10 characters.');
            var v = Number(String(val.value).replace(/[\u20B9,%\s]/g, '')), pv = mode.value === 'percent' ? v : Math.round(v * 100);
            if (!window.confirm('Reduce "' + c.d.title + '" from ' + inr(c.d.amount) + ' to ' + inr(c.d.amount - c.red) + '?\n\nThis is recorded with your name and the reason.')) throw fail(fm, 'Not changed.');
            await call('admin_give_fee_concession', { p_due: c.d.id, p_mode: mode.value, p_value: pv, p_kind: kind.value, p_reason: String(why.value).trim() });
            reload('Fee reduced.');
          }, prev);
        draw();
      }

      // ---- add a fee with a custom amount
      function addForm() {
        var title = el('input', { class: 'fg-in', type: 'text', maxlength: '120', placeholder: 'For example: Yearly tuition 2026-27' }), amt = el('input', { class: 'fg-in', type: 'text', inputmode: 'decimal', placeholder: 'Rupees' });
        var dt = el('input', { class: 'fg-in', type: 'date', value: today() }), nt = el('input', { class: 'fg-in', type: 'text', maxlength: '200', placeholder: 'Optional note' });
        openForm('Add a fee with a custom amount', 'Use this for a special fee, for example a low yearly fee for a student who needs help. The student and parent will see it in their Fees section. Payments can then be recorded in any amounts and on any dates.',
          [lbl('Fee name'), title, lbl('Amount (\u20B9)'), amt, lbl('Due date'), dt, lbl('Note'), nt], 'Add fee', false, async function (fm) {
            var p = toPaise(amt.value), t = title.value.trim();
            if (t.length < 2) throw fail(fm, 'Give the fee a name.');
            if (p === null) throw fail(fm, 'Enter the amount in rupees (up to \u20B91,00,000).');
            if (!dt.value) throw fail(fm, 'Choose a due date.');
            if (!window.confirm('Bill ' + (st.name || 'this student') + ' ' + inr(p) + ' for "' + t + '", due ' + dnice(dt.value) + '?\n\nThey will see it in their Fees section. A fee can be cancelled later but never deleted.')) throw fail(fm, 'Not added.');
            await call('admin_create_fee_due', { p_student_id: id, p_title: t, p_amount_paise: p, p_due_date: dt.value, p_note: nt.value.trim() || null });
            reload('Fee added.');
          });
      }

      // ---- edit date / note
      function editForm(d) {
        var dt = el('input', { class: 'fg-in', type: 'date', value: String(d.due_date || '').slice(0, 10) }), nt = el('input', { class: 'fg-in', type: 'text', maxlength: '200', value: d.note || '' });
        var amt = el('input', { class: 'fg-in', type: 'text', inputmode: 'decimal', value: d.amount / 100, disabled: d.has_payments });
        openForm('Edit: ' + d.title, d.has_payments ? 'The amount cannot be changed because a payment exists. To lower it, use Reduce.' : 'You can change the amount because nothing has been paid yet.',
          [lbl('Due date'), dt, lbl('Note'), nt, lbl('Amount (\u20B9)'), amt], 'Save', false, async function (fm) {
            var np = null; if (!d.has_payments) { var p = toPaise(amt.value); if (p === null) throw fail(fm, 'Enter the amount in rupees.'); if (p !== d.amount) np = p; }
            if (!dt.value) throw fail(fm, 'Choose a due date.');
            await call('admin_edit_fee_due', { p_due_id: d.id, p_due_date: dt.value, p_note: nt.value.trim() || null, p_amount_paise: np });
            reload('Saved.');
          });
      }

      // ---- cancel a fee / void a payment / reverse a reduction (reason needed)
      function reasonForm(title, intro, okLabel, rpcName, argName, idVal, doneMsg, minLen) {
        var why = el('textarea', { class: 'fg-in', rows: '2', maxlength: '300', placeholder: 'Reason (kept as a record)' });
        openForm(title, intro, [lbl('Reason'), why], okLabel, true, async function (fm) {
          var r = String(why.value).trim(); if (r.length < minLen) throw fail(fm, 'Please write a reason (at least ' + minLen + ' characters).');
          if (!window.confirm(title + '?\n\nThis is recorded with your name and the reason. Money records are never deleted.')) throw fail(fm, 'Not changed.');
          var a = {}; a[argName[0]] = idVal; a[argName[1]] = r; await call(rpcName, a); reload(doneMsg);
        });
      }

      // ---------- page
      var nm = st.name || '(no name)';
      body.appendChild(el('div', { class: 'fg-card' }, el('h2', {}, nm),
        el('div', { class: 'fg-muted' }, [classLabel(st), st.parent_name ? ' \u00B7 Parent: ' + st.parent_name : '', st.parent_phone ? ' \u00B7 ' + st.parent_phone : ''].join('')),
        el('div', { class: 'fg-tiles' }, tile(inr(T.fee_total), 'total fees'), tile(inr(T.concessions), 'reductions'), tile(inr(T.paid), 'paid'), tile(inr(T.balance), 'balance'), tile(inr(T.overdue), 'overdue')),
        el('div', { class: 'fg-acts' },
          el('button', { type: 'button', class: 'fg-btn pri', onclick: function () { msg.textContent = ''; payForm(); } }, 'Record a payment'),
          el('button', { type: 'button', class: 'fg-btn', onclick: function () { msg.textContent = ''; reduceForm(); } }, 'Reduce a fee'),
          el('button', { type: 'button', class: 'fg-btn', onclick: function () { msg.textContent = ''; addForm(); } }, 'Add a fee'),
          el('button', { type: 'button', class: 'fg-btn', onclick: function () { window.__feeInstStudent = { id: id, name: nm }; location.hash = '#/fee_inst'; } }, 'Bill this student in instalments'))));

      // dues
      var dueRows = dues.map(function (d) {
        var badge = d.status === 'paid' ? el('span', { class: 'fg-badge ok' }, 'Paid') : d.status === 'cancelled' ? el('span', { class: 'fg-badge' }, 'Cancelled') : d.overdue ? el('span', { class: 'fg-badge bad' }, 'Overdue') : el('span', { class: 'fg-badge warn' }, 'Open');
        var acts = [];
        if (d.status === 'open') {
          if (d.balance > 0) acts.push(el('button', { type: 'button', class: 'fg-btn sm', onclick: function () { msg.textContent = ''; payForm(d.id); } }, 'Pay'));
          acts.push(el('button', { type: 'button', class: 'fg-btn sm', onclick: function () { msg.textContent = ''; reduceForm(d.id); } }, 'Reduce'));
          acts.push(el('button', { type: 'button', class: 'fg-btn sm', onclick: function () { msg.textContent = ''; editForm(d); } }, 'Edit'));
          acts.push(el('button', { type: 'button', class: 'fg-btn sm bad', onclick: function () { msg.textContent = ''; reasonForm('Cancel the fee "' + d.title + '"', d.has_payments ? 'A payment exists on this fee. Void it first if the family should be refunded.' : 'The student will no longer owe this fee.', 'Cancel fee', 'admin_cancel_fee_due', ['p_due_id', 'p_reason'], d.id, 'Fee cancelled.', 3); } }, 'Cancel'));
        }
        return el('tr', {}, td(el('div', {}, d.title, d.note ? el('div', { class: 'fg-muted' }, d.note) : null)), td(dnice(d.due_date)), td(inr(d.original), 1), td(d.concession ? '-' + inr(d.concession) : '-', 1), td(inr(d.amount), 1), td(inr(d.paid), 1), td(d.status === 'cancelled' ? '-' : inr(d.balance), 1), td(badge), td(el('div', { class: 'fg-inline', style: 'flex-wrap:nowrap' }, acts)));
      });
      body.appendChild(el('div', { class: 'fg-card' }, el('h2', {}, 'Fees'), dues.length ? table(['Fee', 'Due', 'Original', 'Reduction', 'Fee', 'Paid', 'Balance', 'Status', ''], dueRows, [2, 3, 4, 5, 6]) : el('p', { class: 'fg-muted' }, 'No fees yet. Use Add a fee or Bill this student in instalments.')));

      // payments
      var payRows = pays.map(function (p) {
        var sb2 = p.status === 'verified' ? el('span', { class: 'fg-badge ok' }, 'Received') : p.status === 'submitted' ? el('span', { class: 'fg-badge warn' }, 'Waiting to be confirmed') : el('span', { class: 'fg-badge' }, p.status === 'voided' ? 'Voided' : 'Rejected');
        return el('tr', {}, td(p.receipt_no || '-'), td(p.title), td(inr(p.amount), 1), td(METHODS[p.method] || p.method || ''), td(p.ref || ''), td(dtnice(p.at)), td(sb2),
          td(p.status === 'verified' ? el('button', { type: 'button', class: 'fg-btn sm bad', onclick: function () { msg.textContent = ''; reasonForm('Void payment ' + (p.receipt_no || '') + ' of ' + inr(p.amount), 'Use this if a payment was entered by mistake. The fee goes back to owing that amount.', 'Void payment', 'admin_void_fee_payment', ['p_payment_id', 'p_reason'], p.id, 'Payment voided.', 3); } }, 'Void') : ''));
      });
      body.appendChild(el('div', { class: 'fg-card' }, el('h2', {}, 'Payments'), pays.length ? table(['Receipt', 'Fee', 'Amount', 'Method', 'Reference', 'Date', 'Status', ''], payRows, [2]) : el('p', { class: 'fg-muted' }, 'No payments yet.')));

      // reductions
      var conRows = cons.map(function (c) {
        return el('tr', {}, td(c.title), td(KINDS[c.kind] || c.kind), td(inr(c.amount), 1), td(inr(c.before) + ' \u2192 ' + inr(c.after)), el('td', { class: 'fg-wrapt' }, c.reason || ''), td(c.by), td(dtnice(c.at)),
          td(c.reversed_at ? el('span', { class: 'fg-badge' }, 'Reversed ' + dtnice(c.reversed_at)) : el('button', { type: 'button', class: 'fg-btn sm bad', onclick: function () { msg.textContent = ''; reasonForm('Reverse the reduction of ' + inr(c.amount), 'The fee goes back up by this amount.', 'Reverse reduction', 'admin_reverse_fee_concession', ['p_id', 'p_reason'], c.id, 'Reduction reversed.', 3); } }, 'Reverse')));
      });
      if (cons.length) body.appendChild(el('div', { class: 'fg-card' }, el('h2', {}, 'Reductions'), el('div', { class: 'fg-muted' }, 'Only admins can see these reasons.'), table(['Fee', 'Category', 'Amount', 'Fee change', 'Reason', 'By', 'Date', ''], conRows, [2])));
    }
  };
})();
