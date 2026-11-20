/* ===================================================================
   Photon Academy - Admin screen "Fee instalments"
   Split a yearly fee into instalments (for example 40% / 30% / 30%) with a due date for each.
   1. Save a schedule for one of your fee structures.  2. Preview who will be billed and how much (nothing is saved).
   3. Press Create fees. The fees then show in each student's and parent's Fees section like any other due.
   The database does all the checking and the arithmetic: each student's instalments always add up exactly to their fee,
   a student's own custom amount is respected, running it twice never creates duplicates, and an instalment you have
   cancelled is never recreated. Fees can be cancelled but never deleted.
   =================================================================== */
(function () {
  'use strict';
  var CLASSES = ['6', '7', '8', '9', '10', '11', '12'], MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function sb() { return window.photonSupabase; }
  function el(tag, attrs) {
    var e = document.createElement(tag); attrs = attrs || {};
    Object.keys(attrs).forEach(function (k) { var v = attrs[k]; if (v === null || v === undefined || v === false) return; if (k === 'class') e.className = v; else if (k === 'style') e.style.cssText = v; else if (k.indexOf('on') === 0) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v); });
    for (var i = 2; i < arguments.length; i++) add(e, arguments[i]); return e;
  }
  function add(p, c) { if (c === null || c === undefined || c === false) return; if (Array.isArray(c)) { c.forEach(function (x) { add(p, x); }); return; } p.appendChild(c.nodeType ? c : document.createTextNode(String(c))); }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); return n; }
  var css = el('style'); css.textContent = [
    '.fs-card{border:var(--ph-w,1.5px) solid var(--line,rgba(127,127,127,.6));border-radius:14px;padding:20px;background:rgba(127,127,127,.09);max-width:980px;margin-bottom:16px}',
    '.fs-card h2{margin:0 0 4px;font-size:20px}.fs-card h3{margin:14px 0 6px;font-size:16px}.fs-muted{opacity:.78;font-size:13.5px}.fs-card p{margin:8px 0}',
    '.fs-btn{border:1px solid var(--line,rgba(127,127,127,.6));background:transparent;color:inherit;border-radius:10px;padding:8px 14px;font:inherit;font-size:13.5px;cursor:pointer}.fs-btn.pri{background:#4fd6e8;border-color:#4fd6e8;color:#06202a;font-weight:600}.fs-btn.bad{border-color:#ff7b7b;color:#ff7b7b}.fs-btn:disabled{opacity:.5;cursor:not-allowed}',
    '.fs-in{box-sizing:border-box;background:transparent;color:inherit;border:1px solid var(--line,rgba(127,127,127,.6));border-radius:10px;padding:8px 10px;font:inherit;font-size:14px;max-width:100%}.fs-in:disabled{opacity:.6}',
    '.fs-lbl{display:block;font-size:13px;margin:10px 0 4px;font-weight:600}.fs-row{display:grid;grid-template-columns:minmax(120px,2fr) 90px minmax(140px,1.4fr) auto;gap:8px;align-items:center;margin:6px 0}',
    '.fs-acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;align-items:center}.fs-msg{min-height:20px;margin-top:8px;font-size:13.5px}.fs-msg.err{color:#ff7b7b}.fs-msg.ok{color:#3ddc97}',
    '.fs-tot{font-size:14px;margin:8px 0}.fs-tot.ok{color:#3ddc97}.fs-tot.bad{color:#f5b942}',
    '.fs-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:12px 0}.fs-tile{border:1.5px solid var(--line,rgba(127,127,127,.6));border-radius:12px;padding:10px 14px}.fs-tile b{display:block;font-size:24px;line-height:1.15;font-family:var(--ph-head,Georgia,serif)}.fs-tile span{display:block;font-size:13.5px}',
    '.fs-wrap{overflow-x:auto;max-width:100%;margin-top:8px}.fs-wrap.tall{max-height:300px;overflow-y:auto}.fs-tbl{border-collapse:collapse;width:100%;font-size:13.5px}.fs-tbl th,.fs-tbl td{text-align:left;padding:6px 10px;border-bottom:1px solid rgba(127,127,127,.35);white-space:nowrap}.fs-tbl th{font-weight:600}',
    '.fs-badge{display:inline-block;border-radius:99px;border:1px solid rgba(127,127,127,.55);padding:1px 10px;font-size:12px;margin-left:6px}.fs-badge.ok{color:#3ddc97;border-color:#3ddc97}.fs-badge.warn{color:#f5b942;border-color:#f5b942}',
    '.fs-item{border:1px solid rgba(127,127,127,.4);border-radius:12px;padding:12px 14px;margin:8px 0}.fs-warn{border:1.5px solid #f5b942;border-radius:12px;padding:10px 14px;margin:12px 0;font-size:14px}',
    '@media(max-width:560px){.fs-row{grid-template-columns:1fr 90px;}}'
  ].join('\n'); document.head.appendChild(css);

  function inr(paise) { var n = Number(paise) || 0, r = n % 100 !== 0; return '\u20B9' + (n / 100).toLocaleString('en-IN', { minimumFractionDigits: r ? 2 : 0, maximumFractionDigits: 2 }); }
  function dnice(s) { var p = String(s || '').slice(0, 10).split('-'); return p.length === 3 ? Number(p[2]) + ' ' + MON[Number(p[1]) - 1] + ' ' + p[0] : ''; }
  function why(e) { var m = (e && e.message) || ''; return /Only an admin|Instalment|Use between|Percentages|Due dates|Give the schedule|no active fee structure|locked|paused|not found|Class is not valid|Instalments must/i.test(m) ? m : 'Something went wrong. Nothing was changed. Please try again.'; }
  // the same split the database uses: whole paise, odd paise fall on the later instalments, parts always add up exactly
  function split(amtPaise, items) {
    var cum = 0, prev = 0, out = [];
    items.forEach(function (it) { cum += Math.round((Number(it.percent) || 0) * 100); var part = Math.floor(amtPaise * cum / 10000) - Math.floor(amtPaise * prev / 10000); out.push(part); prev = cum; });
    return out;
  }
  function totalHundredths(items) { return items.reduce(function (a, it) { return a + Math.round((Number(it.percent) || 0) * 100); }, 0); }

  window.photonAdminFeeSchedules = async function (view) {
    clear(view);
    var plans = [], schedules = [];
    var msg = el('div', { class: 'fs-msg' }), editBox = el('div', {}), runBox = el('div', {}), listBox = el('div', {});
    function say(t, k) { msg.textContent = t || ''; msg.className = 'fs-msg' + (k ? ' ' + k : ''); }
    var newBtn = el('button', { type: 'button', class: 'fs-btn pri' }, 'New instalment schedule');
    view.appendChild(el('div', { class: 'fs-card' }, el('h2', {}, 'Fee instalments'),
      el('div', { class: 'fs-muted' }, 'Split a yearly fee into instalments with a due date for each, then create the fees for a whole class in one go. Students and parents see the instalments in their Fees section.'),
      el('div', { class: 'fs-warn' }, 'Creating fees bills students. Always read the preview first. Fees can be cancelled later in Dues, but they can never be deleted.'),
      el('div', { class: 'fs-acts' }, newBtn), msg));
    view.appendChild(editBox); view.appendChild(runBox); view.appendChild(listBox);

    async function loadAll() {
      var p = await sb().from('fee_plans').select('name,class_name,board,division,amount_paise,active').eq('active', true);
      plans = (p.data || []);
      var s = await sb().from('fee_schedules').select('id,name,plan_name,items,active,locked,created_at').order('created_at', { ascending: false });
      if (s.error) { clear(listBox).appendChild(el('div', { class: 'fs-card' }, el('div', { class: 'fs-muted' }, 'Could not load your schedules. Make sure you are signed in as an admin.'))); return; }
      schedules = s.data || []; renderList();
    }
    function planNames() { var seen = {}, out = []; plans.forEach(function (p) { var k = p.name.toLowerCase(); if (!seen[k]) { seen[k] = 1; out.push(p.name); } }); return out; }

    // ---------- editor ----------
    function openEditor(src, asCopy) {
      clear(runBox);
      var st = { id: asCopy ? null : (src && src.id) || null, locked: !asCopy && !!(src && src.locked), name: src ? (asCopy ? src.name + ' (copy)' : src.name) : '', plan: src ? src.plan_name : (planNames()[0] || ''), active: src ? (asCopy ? true : src.active) : true,
        items: src ? src.items.map(function (i) { return { label: i.label, percent: Number(i.percent), due_date: asCopy ? '' : String(i.due_date).slice(0, 10) }; }) : [{ label: 'Instalment 1', percent: 40, due_date: '' }, { label: 'Instalment 2', percent: 30, due_date: '' }, { label: 'Instalment 3', percent: 30, due_date: '' }] };
      var card = el('div', { class: 'fs-card' }), itemsBox = el('div', {}), totEl = el('div', { class: 'fs-tot' }), exBox = el('div', {}), emsg = el('div', { class: 'fs-msg' });
      var nameIn = el('input', { class: 'fs-in', type: 'text', maxlength: '60', style: 'width:100%;max-width:420px', value: st.name, 'aria-label': 'Schedule name' });
      var planSel = el('select', { class: 'fs-in', disabled: st.locked, 'aria-label': 'Fee structure' });
      planNames().forEach(function (n) { var o = el('option', { value: n }, n); if (n.toLowerCase() === String(st.plan).toLowerCase()) o.selected = true; planSel.appendChild(o); });
      var exIn = el('input', { class: 'fs-in', type: 'number', min: '1', step: '1', style: 'width:140px', 'aria-label': 'Example yearly fee in rupees' });
      function planAmount() { var m = plans.filter(function (p) { return p.name === planSel.value; })[0]; return m ? m.amount_paise : 5000000; }
      exIn.value = String(Math.round(planAmount() / 100));
      planSel.addEventListener('change', function () { st.plan = planSel.value; exIn.value = String(Math.round(planAmount() / 100)); refresh(); showPlanInfo(); });
      var planInfo = el('div', { class: 'fs-muted' });
      function showPlanInfo() {
        var m = plans.filter(function (p) { return p.name === planSel.value; });
        planInfo.textContent = m.length ? 'Yearly fee for this structure: ' + m.map(function (p) { return 'Class ' + p.class_name + (p.board ? ' ' + p.board : '') + (p.division ? ' ' + p.division : '') + ' \u2013 ' + inr(p.amount_paise); }).join('; ') + '. Instalments are worked out from each student\u2019s own fee.' : '';
      }
      function refresh() {
        var th = totalHundredths(st.items), ok = th === 10000;
        totEl.textContent = 'Total: ' + (th / 100) + '%' + (ok ? ' \u2013 correct' : ' \u2013 it must add up to exactly 100%'); totEl.className = 'fs-tot ' + (ok ? 'ok' : 'bad');
        clear(exBox);
        var amt = Math.round((Number(exIn.value) || 0) * 100);
        if (ok && amt > 0 && st.items.length) {
          var parts = split(amt, st.items);
          exBox.appendChild(el('div', { class: 'fs-wrap' }, el('table', { class: 'fs-tbl' }, el('thead', {}, el('tr', {}, ['Instalment', 'Amount', 'Due'].map(function (h) { return el('th', {}, h); }))),
            el('tbody', {}, st.items.map(function (it, i) { return el('tr', {}, el('td', {}, it.label || '(unnamed)'), el('td', {}, inr(parts[i])), el('td', {}, it.due_date ? dnice(it.due_date) : 'set a date')); })))));
        }
      }
      function drawItems() {
        clear(itemsBox);
        st.items.forEach(function (it, i) {
          var lab = el('input', { class: 'fs-in', type: 'text', maxlength: '40', value: it.label, disabled: st.locked, 'aria-label': 'Instalment ' + (i + 1) + ' name' });
          var pct = el('input', { class: 'fs-in', type: 'number', min: '0.01', max: '100', step: '0.01', value: String(it.percent), disabled: st.locked, 'aria-label': 'Instalment ' + (i + 1) + ' percent' });
          var due = el('input', { class: 'fs-in', type: 'date', value: it.due_date, disabled: st.locked, 'aria-label': 'Instalment ' + (i + 1) + ' due date' });
          lab.addEventListener('input', function () { it.label = lab.value; refresh(); }); pct.addEventListener('input', function () { it.percent = pct.value === '' ? 0 : Number(pct.value); refresh(); }); due.addEventListener('input', function () { it.due_date = due.value; refresh(); });
          var rm = el('button', { type: 'button', class: 'fs-btn bad', disabled: st.locked || st.items.length <= 2, 'aria-label': 'Remove instalment ' + (i + 1), onclick: function () { st.items.splice(i, 1); drawItems(); refresh(); } }, 'Remove');
          itemsBox.appendChild(el('div', { class: 'fs-row' }, lab, el('div', {}, pct), due, rm));
        });
      }
      function preset(n, custom) {
        var pcts = custom || (function () { var base = Math.floor(10000 / n), arr = []; for (var i = 0; i < n; i++) arr.push(base); arr[n - 1] += 10000 - base * n; return arr.map(function (h) { return h / 100; }); })();
        var old = st.items; st.items = pcts.map(function (p, i) { return { label: 'Instalment ' + (i + 1), percent: p, due_date: (old[i] && old[i].due_date) || '' }; }); drawItems(); refresh();
      }
      var presets = el('div', { class: 'fs-acts' });
      [['2 equal', function () { preset(2); }], ['3 equal', function () { preset(3); }], ['4 equal', function () { preset(4); }], ['40 / 30 / 30', function () { preset(3, [40, 30, 30]); }], ['50 / 25 / 25', function () { preset(3, [50, 25, 25]); }]].forEach(function (p) { presets.appendChild(el('button', { type: 'button', class: 'fs-btn', disabled: st.locked, onclick: p[1] }, p[0])); });
      var addBtn = el('button', { type: 'button', class: 'fs-btn', disabled: st.locked, onclick: function () { if (st.items.length >= 12) return; st.items.push({ label: 'Instalment ' + (st.items.length + 1), percent: 0, due_date: '' }); drawItems(); refresh(); } }, 'Add an instalment');
      var saveBtn = el('button', { type: 'button', class: 'fs-btn pri' }, st.id ? 'Save changes' : 'Save schedule'), cancelBtn = el('button', { type: 'button', class: 'fs-btn', onclick: function () { clear(editBox); } }, 'Close');
      saveBtn.addEventListener('click', async function () {
        st.name = nameIn.value; st.plan = planSel.value; saveBtn.disabled = true; emsg.textContent = 'Saving\u2026'; emsg.className = 'fs-msg';
        var items = st.items.map(function (i) { return { label: i.label, percent: i.percent, due_date: i.due_date }; });
        var r; try { r = await sb().rpc('admin_save_fee_schedule', { p_id: st.id, p_name: st.name, p_plan_name: st.plan, p_items: items, p_active: st.active }); } catch (e) { r = { error: e }; }
        saveBtn.disabled = false;
        if (r.error) { emsg.textContent = why(r.error); emsg.className = 'fs-msg err'; return; }
        clear(editBox); say('Schedule saved. No fees have been created yet. Use "Create fees" on it below when you are ready.', 'ok'); await loadAll();
      });
      card.appendChild(el('h2', {}, st.id ? (st.locked ? 'Schedule (fees already created)' : 'Edit schedule') : 'New instalment schedule'));
      if (st.locked) card.appendChild(el('div', { class: 'fs-warn' }, 'This schedule has already created fees, so its instalments are locked to keep every student consistent. You can rename it or pause it. To change the split, close this and use "Make a copy".'));
      card.appendChild(el('label', { class: 'fs-lbl' }, 'Schedule name')); card.appendChild(nameIn);
      card.appendChild(el('label', { class: 'fs-lbl' }, 'Fee structure it splits')); card.appendChild(planSel); card.appendChild(planInfo);
      card.appendChild(el('h3', {}, 'Instalments'));
      card.appendChild(el('div', { class: 'fs-muted' }, 'Name, percent of the yearly fee, and due date. Due dates must be in order.'));
      card.appendChild(presets); card.appendChild(itemsBox); card.appendChild(el('div', { class: 'fs-acts' }, addBtn)); card.appendChild(totEl);
      card.appendChild(el('h3', {}, 'Check the amounts')); card.appendChild(el('div', { class: 'fs-muted' }, 'Type any yearly fee to see the split. Odd paise are added to the last instalment so the total is always exact.'));
      card.appendChild(el('div', { style: 'margin:8px 0' }, '\u20B9 ', exIn)); exIn.addEventListener('input', refresh); card.appendChild(exBox);
      card.appendChild(el('div', { class: 'fs-acts' }, saveBtn, cancelBtn)); card.appendChild(emsg);
      clear(editBox).appendChild(card); drawItems(); showPlanInfo(); refresh(); card.scrollIntoView && card.scrollIntoView({ block: 'nearest' });
    }
    newBtn.addEventListener('click', function () { if (!planNames().length) return say('Create a fee structure first (Fees, Fee structure). Instalments split one of those.', 'err'); say(''); openEditor(null, false); });

    // ---------- create fees (preview first) ----------
    function openRun(sc) {
      clear(editBox);
      var card = el('div', { class: 'fs-card' }), res = el('div', {}), rmsg = el('div', { class: 'fs-msg' }), previewed = null;
      var clsSel = el('select', { class: 'fs-in', 'aria-label': 'Class' }, el('option', { value: '' }, 'All classes that match')); CLASSES.forEach(function (c) { clsSel.appendChild(el('option', { value: c }, 'Class ' + c)); });
      var picked = [], MAXSEL = 300;
      var modeSel = el('select', { class: 'fs-in', 'aria-label': 'Who to bill' }, el('option', { value: 'all' }, 'Everyone who matches'), el('option', { value: 'sel' }, 'Selected students only'));
      var selBox = el('div', { style: 'display:none;margin:10px 0' }), chips = el('div', { style: 'display:flex;flex-wrap:wrap;gap:6px;margin:8px 0' }), found = el('div', { class: 'fs-wrap tall' });
      var sIn = el('input', { class: 'fs-in', type: 'search', placeholder: 'Search a student by name', 'aria-label': 'Search a student', maxlength: '60', style: 'width:100%;max-width:360px' }), sTimer = null;
      function resetPrev() { previewed = null; goBtn.disabled = true; goBtn.textContent = 'Create fees'; clear(res); }
      function drawChips() {
        clear(chips); picked.forEach(function (p) { chips.appendChild(el('span', { class: 'fs-badge', style: 'margin:0' }, p.name + (p.cls ? ' \u00B7 ' + p.cls : '') + ' ', el('button', { type: 'button', class: 'fs-btn', style: 'padding:0 6px;margin-left:4px;border-radius:99px', 'aria-label': 'Remove ' + p.name, onclick: function () { picked = picked.filter(function (x) { return x.id !== p.id; }); drawChips(); resetPrev(); } }, '\u00D7'))); });
        if (!picked.length) chips.appendChild(el('span', { class: 'fs-muted' }, 'No student chosen yet. Search by name and press Add.'));
      }
      function addPick(p) { if (picked.some(function (x) { return x.id === p.id; })) return; if (picked.length >= MAXSEL) { rsay('You can choose up to ' + MAXSEL + ' students at a time.', 'err'); return; } picked.push(p); drawChips(); resetPrev(); }
      async function doSearch() {
        var t = sIn.value.trim(); clear(found); if (t.length < 2) return;
        var safe = t.replace(/[%_\\,()]/g, ' ').trim(); if (!safe) return;
        var r; try { r = await sb().from('profiles').select('id,display_name,class_name,board,division').eq('role', 'student').ilike('display_name', '%' + safe + '%').order('display_name').limit(12); } catch (e) { r = { error: e }; }
        if (r.error) { found.appendChild(el('div', { class: 'fs-muted' }, 'Search failed. Please try again.')); return; }
        if (!(r.data || []).length) { found.appendChild(el('div', { class: 'fs-muted' }, 'No student found.')); return; }
        found.appendChild(el('table', { class: 'fs-tbl' }, el('tbody', {}, r.data.map(function (p) { var cl = p.class_name ? 'Class ' + p.class_name + (p.board ? ' ' + p.board : '') + (p.division ? ' ' + p.division : '') : ''; return el('tr', {}, el('td', {}, p.display_name || '(no name)'), el('td', {}, cl), el('td', {}, el('button', { type: 'button', class: 'fs-btn', onclick: function () { addPick({ id: p.id, name: p.display_name || '(no name)', cls: cl }); } }, 'Add'))); }))));
      }
      sIn.addEventListener('input', function () { clearTimeout(sTimer); sTimer = setTimeout(doSearch, 350); });
      selBox.appendChild(sIn); selBox.appendChild(found); selBox.appendChild(chips);
      modeSel.addEventListener('change', function () { selBox.style.display = modeSel.value === 'sel' ? 'block' : 'none'; clsSel.style.display = modeSel.value === 'sel' ? 'none' : ''; resetPrev(); rsay(modeSel.value === 'sel' ? 'Choose the students, then press Preview.' : 'Press Preview.'); });
      var pre = window.__feeInstStudent; window.__feeInstStudent = null;
      var pvBtn = el('button', { type: 'button', class: 'fs-btn' }, 'Preview (saves nothing)'), goBtn = el('button', { type: 'button', class: 'fs-btn pri', disabled: true }, 'Create fees'), closeBtn = el('button', { type: 'button', class: 'fs-btn', onclick: function () { clear(runBox); } }, 'Close');
      function rsay(t, k) { rmsg.textContent = t || ''; rmsg.className = 'fs-msg' + (k ? ' ' + k : ''); }
      clsSel.addEventListener('change', function () { previewed = null; goBtn.disabled = true; goBtn.textContent = 'Create fees'; clear(res); rsay('Class changed. Press Preview again.'); });
      pvBtn.addEventListener('click', async function () {
        pvBtn.disabled = true; goBtn.disabled = true; rsay('Checking\u2026'); clear(res);
        var selMode = modeSel.value === 'sel', cls = selMode ? null : (clsSel.value || null), ids = selMode ? picked.map(function (p) { return p.id; }) : null, r;
        if (selMode && !ids.length) { pvBtn.disabled = false; rsay('Choose at least one student first.', 'err'); return; }
        try { r = await sb().rpc('admin_generate_fee_schedule', { p_schedule: sc.id, p_class: cls, p_dry: true, p_students: ids }); } catch (e) { r = { error: e }; }
        pvBtn.disabled = false;
        if (r.error) { rsay(why(r.error), 'err'); return; }
        var d = r.data; previewed = { cls: cls, ids: ids, d: d }; rsay('This is only a preview. Nothing has been created.');
        res.appendChild(el('div', { class: 'fs-tiles' },
          el('div', { class: 'fs-tile' }, el('b', {}, d.students), el('span', {}, 'students will be billed')),
          el('div', { class: 'fs-tile' }, el('b', {}, d.new_dues), el('span', {}, 'new fees will be created')),
          el('div', { class: 'fs-tile' }, el('b', {}, inr(d.new_total_paise)), el('span', {}, 'total to be billed')),
          el('div', { class: 'fs-tile' }, el('b', {}, d.existing_dues), el('span', {}, 'already exist (skipped)'))));
        if (d.skipped_small) res.appendChild(el('div', { class: 'fs-warn' }, d.skipped_small + (d.skipped_small === 1 ? ' student is' : ' students are') + ' skipped because one instalment would be under \u20B91. Check their custom fee in Fee structure.'));
        if (!d.new_dues) res.appendChild(el('div', { class: 'fs-muted' }, d.students ? 'Every matching student already has these instalments, so there is nothing new to create.' : 'No approved student matches this fee structure for this class. Check the fee structure\u2019s class, board and division, and that students are approved.'));
        if ((d.per_installment || []).length && d.new_dues) res.appendChild(el('div', { class: 'fs-wrap' }, el('table', { class: 'fs-tbl' }, el('thead', {}, el('tr', {}, ['Instalment', 'Due', 'Fees', 'Total'].map(function (h) { return el('th', {}, h); }))),
          el('tbody', {}, d.per_installment.map(function (x) { return el('tr', {}, [el('td', {}, x.label), el('td', {}, dnice(x.due_date)), el('td', {}, x.new_count), el('td', {}, inr(x.new_total_paise))]); })))));
        if ((d.people || []).length) res.appendChild(el('details', { class: 'fs-muted', style: 'margin-top:10px', open: !!previewed.ids || d.people.length <= 8 }, el('summary', {}, 'Who is included (' + d.people.length + ')'),
          el('div', { class: 'fs-wrap tall' }, el('table', { class: 'fs-tbl' }, el('thead', {}, el('tr', {}, ['Student', 'Class', 'Yearly fee', 'New fees'].map(function (h) { return el('th', {}, h); }))),
            el('tbody', {}, d.people.map(function (p) { return el('tr', {}, [el('td', {}, p.name), el('td', {}, (p.class || '') + (p.division ? ' ' + p.division : '')), el('td', {}, inr(p.amount_paise)), el('td', {}, p.new_dues)]); }))))));
        goBtn.disabled = !d.new_dues; goBtn.textContent = d.new_dues ? 'Create ' + d.new_dues + ' fees (' + inr(d.new_total_paise) + ')' : 'Nothing to create';
      });
      goBtn.addEventListener('click', async function () {
        if (!previewed || !previewed.d.new_dues) return;
        var d = previewed.d;
        if (!window.confirm('Create ' + d.new_dues + ' fees totalling ' + inr(d.new_total_paise) + ' for ' + d.students + ' student' + (d.students === 1 ? '' : 's') + '?\n\nThey will appear in each student\u2019s and parent\u2019s Fees section. Fees can be cancelled later but never deleted.')) return;
        goBtn.disabled = true; pvBtn.disabled = true; rsay('Creating\u2026');
        var r; try { r = await sb().rpc('admin_generate_fee_schedule', { p_schedule: sc.id, p_class: previewed.cls, p_dry: false, p_students: previewed.ids }); } catch (e) { r = { error: e }; }
        pvBtn.disabled = false;
        if (r.error) { rsay(why(r.error), 'err'); goBtn.disabled = false; return; }
        clear(runBox); say('Created ' + r.data.new_dues + ' fees totalling ' + inr(r.data.new_total_paise) + ' for ' + r.data.students + ' student' + (r.data.students === 1 ? '' : 's') + '. Check them in Dues.', 'ok'); await loadAll();
      });
      card.appendChild(el('h2', {}, 'Create fees: ' + sc.name));
      card.appendChild(el('div', { class: 'fs-muted' }, 'Fee structure: ' + sc.plan_name + '. Only approved students whose class, board and division match that structure are included. Choose a class, then press Preview.'));
      card.appendChild(el('div', { style: 'margin:10px 0' }, el('label', { class: 'fs-lbl' }, 'Who should be billed'), modeSel)); card.appendChild(el('div', { style: 'margin:10px 0' }, clsSel)); card.appendChild(selBox); drawChips(); if (pre && pre.id) { modeSel.value = 'sel'; selBox.style.display = 'block'; clsSel.style.display = 'none'; picked.push({ id: pre.id, name: pre.name || '(student)', cls: '' }); drawChips(); rsay('Student chosen: ' + (pre.name || '') + '. Press Preview.'); } card.appendChild(el('div', { class: 'fs-acts' }, pvBtn, goBtn, closeBtn)); card.appendChild(rmsg); card.appendChild(res);
      clear(runBox).appendChild(card); card.scrollIntoView && card.scrollIntoView({ block: 'nearest' });
    }

    // ---------- list ----------
    function renderList() {
      clear(listBox);
      var card = el('div', { class: 'fs-card' }, el('h2', {}, 'Your schedules'));
      if (!schedules.length) { card.appendChild(el('div', { class: 'fs-muted', style: 'margin-top:8px' }, 'No schedules yet. Press "New instalment schedule" above to make one.')); listBox.appendChild(card); return; }
      schedules.forEach(function (sc) {
        var parts = (sc.items || []).map(function (i) { return Number(i.percent) + '% ' + i.label + ' (' + dnice(i.due_date) + ')'; }).join(', ');
        var row = el('div', { class: 'fs-item' }, el('b', {}, sc.name), el('span', { class: 'fs-badge' + (sc.active ? ' ok' : ' warn') }, sc.active ? 'Active' : 'Paused'), sc.locked ? el('span', { class: 'fs-badge' }, 'Fees created') : null,
          el('div', { class: 'fs-muted' }, 'Splits "' + sc.plan_name + '" into ' + (sc.items || []).length + ': ' + parts));
        var acts = el('div', { class: 'fs-acts' });
        acts.appendChild(el('button', { type: 'button', class: 'fs-btn pri', disabled: !sc.active, title: sc.active ? '' : 'Activate the schedule first', onclick: function () { say(''); openRun(sc); } }, 'Create fees\u2026'));
        acts.appendChild(el('button', { type: 'button', class: 'fs-btn', onclick: function () { say(''); openEditor(sc, false); } }, sc.locked ? 'View / rename' : 'Edit'));
        acts.appendChild(el('button', { type: 'button', class: 'fs-btn', onclick: function () { say(''); openEditor(sc, true); } }, 'Make a copy'));
        acts.appendChild(el('button', { type: 'button', class: 'fs-btn', onclick: async function () {
          var r; try { r = await sb().rpc('admin_save_fee_schedule', { p_id: sc.id, p_name: sc.name, p_plan_name: sc.plan_name, p_items: sc.items, p_active: !sc.active }); } catch (e) { r = { error: e }; }
          if (r.error) return say(why(r.error), 'err'); say(sc.active ? 'Schedule paused.' : 'Schedule activated.', 'ok'); loadAll();
        } }, sc.active ? 'Pause' : 'Activate'));
        row.appendChild(acts); card.appendChild(row);
      });
      listBox.appendChild(card);
    }
    await loadAll();
  };
  window.PhotonFeeSplit = { split: split };
})();
