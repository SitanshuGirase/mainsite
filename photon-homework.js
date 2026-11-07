/* ===================================================================
   Photon Academy - Homework: submissions, review and feedback
     - Student Space (students): "Homework" card: see tasks, submit an answer and/or link, read feedback
     - Teacher Desk (teachers):  "Homework" card: post homework, review submissions, give marks/feedback,
                                 ask for corrections (the student can then resubmit)
     - Admin panel:              "Homework" screen (all classes)
   Uses Supabase tables `homework` and `homework_submissions` (privacy rules live in the database)
   and shared helpers from photon-marks.js (load that script first).
   =================================================================== */
(function () {
  'use strict';
  var U = function () { return window.PhotonUI; };
  var STAT = { submitted: ['Submitted', 'ok'], reviewed: ['Reviewed', 'ok'], needs_changes: ['Needs changes', 'off'], none: ['Not submitted', 'off'] };
  function sb() { return window.photonSupabase; }
  function today() { return new Date().toISOString().slice(0, 10); }
  function isLate(sub, hw) { return sub && sub.submitted_at && sub.submitted_at.slice(0, 10) > hw.due_date; }
  function badge(el, st) { var s = STAT[st] || STAT.none; return el('span', { class: 'pm-badge ' + s[1] }, s[0]); }
  function safeLink(url) { return /^https:\/\//i.test(url || '') ? url : null; }
  function errText(e) { var m = (e && e.message) || ''; return /already reviewed|Marks cannot|must start with|no marks/i.test(m) ? m : U().friendly(e); }

  /* ---------- student ---------- */
  async function myCard() {
    var u = U(), el = u.el, card = el('div', { class: 'pm-card', id: 'ph-student' }, el('h2', {}, 'Homework'), el('div', { class: 'pm-muted' }, 'Loading\u2026'));
    try {
      var me = await sb().auth.getUser(), uid = me && me.data && me.data.user && me.data.user.id; if (!uid) return null;
      var h = await sb().from('homework').select('*').order('due_date', { ascending: false }).limit(60); if (h.error) throw h.error;
      var s = await sb().from('homework_submissions').select('*').eq('student_id', uid).limit(300); if (s.error) throw s.error;
      var subs = {}; (s.data || []).forEach(function (x) { subs[x.homework_id] = x; });
      var list = h.data || [];
      function draw() {
        u.clear(card); card.appendChild(el('h2', {}, 'Homework'));
        if (!list.length) { card.appendChild(el('div', { class: 'pm-muted' }, 'No homework yet.')); return; }
        var pending = list.filter(function (x) { return !subs[x.id] || subs[x.id].status === 'needs_changes'; }).length;
        card.appendChild(el('div', { class: 'pm-muted' }, pending ? pending + ' to do' : 'You are all caught up.'));
        list.forEach(function (hw) {
          var sub = subs[hw.id], st = sub ? sub.status : 'none', msgBox = el('div', { class: 'pm-msg' });
          var row = el('div', { class: 'pm-row', style: 'display:block' }, el('div', {}, el('b', {}, hw.title), badge(el, st), isLate(sub, hw) ? el('span', { class: 'pm-badge off' }, 'late') : null,
            el('div', { class: 'pm-muted' }, hw.subject + ' \u00B7 due ' + u.fmtDate(hw.due_date) + (hw.due_date < today() && !sub ? ' \u00B7 overdue' : '') + (hw.max_marks ? ' \u00B7 out of ' + hw.max_marks : ''))));
          if (hw.details) row.appendChild(el('div', { style: 'margin-top:6px;white-space:pre-wrap;overflow-wrap:anywhere;font-size:14px' }, hw.details));
          if (sub && (sub.status === 'reviewed' || sub.status === 'needs_changes')) {
            row.appendChild(el('div', { style: 'margin-top:8px;border-left:3px solid #4fd6e8;padding-left:10px;font-size:14px' },
              sub.marks !== null && sub.marks !== undefined ? el('div', {}, el('b', {}, 'Marks: ' + sub.marks + (hw.max_marks ? ' / ' + hw.max_marks : ''))) : null,
              el('div', {}, sub.feedback ? 'Teacher: ' + sub.feedback : (sub.status === 'needs_changes' ? 'Your teacher asked for changes.' : 'Reviewed.'))));
          }
          if (!sub || sub.status !== 'reviewed') {
            var ans = el('textarea', { class: 'pm-in', rows: '4', maxlength: '4000', placeholder: 'Type your answer (optional if you add a link)', 'aria-label': 'Answer for ' + hw.title }, sub && sub.answer ? sub.answer : '');
            var link = el('input', { class: 'pm-in', maxlength: '500', placeholder: 'https:// link to your work (Google Drive, photo link) - optional', value: sub && sub.link ? sub.link : '', 'aria-label': 'Link for ' + hw.title });
            var btn = el('button', { type: 'button', class: 'pm-btn pri' }, sub ? 'Resubmit' : 'Submit');
            btn.onclick = async function () {
              var a = ans.value.trim(), l = link.value.trim();
              if (!a && !l) return u.msg(msgBox, 'Write an answer or add a link first.', 'err');
              if (l && !safeLink(l)) return u.msg(msgBox, 'The link must start with https://', 'err');
              btn.disabled = true; u.msg(msgBox, 'Sending\u2026');
              var r = await sb().from('homework_submissions').upsert({ homework_id: hw.id, student_id: uid, answer: a || null, link: l || null }, { onConflict: 'homework_id,student_id' }).select().single();
              btn.disabled = false;
              if (r.error) return u.msg(msgBox, errText(r.error), 'err');
              subs[hw.id] = r.data || Object.assign({}, sub || {}, { homework_id: hw.id, status: 'submitted', answer: a, link: l, submitted_at: new Date().toISOString() }); draw();
            };
            row.appendChild(el('div', { style: 'margin-top:8px;display:grid;gap:8px' }, ans, link, el('div', {}, btn), msgBox));
          } else if (sub.answer || sub.link) {
            row.appendChild(el('div', { class: 'pm-muted', style: 'margin-top:6px' }, 'Your submission: ' + (sub.answer ? sub.answer.slice(0, 160) + (sub.answer.length > 160 ? '\u2026' : '') : '') + (sub.link ? ' (link added)' : '')));
          }
          card.appendChild(row);
        });
      }
      draw();
    } catch (e) { u.clear(card); card.appendChild(el('h2', {}, 'Homework')); card.appendChild(el('div', { class: 'pm-muted' }, 'Could not load homework right now.')); }
    return card;
  }

  /* ---------- teacher / admin ---------- */
  function staffPanel(opts) {
    var u = U(), el = u.el, admin = !!opts.admin, card = el('div', { class: 'pm-card', id: admin ? 'ph-admin' : 'ph-teacher' });
    var top = el('div', {}), out = el('div', {}), msgBox = el('div', { class: 'pm-msg' }), list = [];
    card.appendChild(el('h2', {}, 'Homework'));
    card.appendChild(el('div', { class: 'pm-muted' }, 'Post homework for a class, then review what students send. You can give marks and feedback, or ask for corrections so the student can resubmit.'));
    card.appendChild(top); card.appendChild(msgBox); card.appendChild(out);

    async function refresh() {
      var r = await sb().from('homework').select('*').order('due_date', { ascending: false }).limit(200); if (r.error) throw r.error; list = r.data || [];
      var c = await sb().from('homework_submissions').select('homework_id,status').limit(6000); var counts = {};
      (c.data || []).forEach(function (x) { var k = counts[x.homework_id] = counts[x.homework_id] || { total: 0, reviewed: 0, needs: 0 }; k.total++; if (x.status === 'reviewed') k.reviewed++; if (x.status === 'needs_changes') k.needs++; });
      drawTop(); drawList(counts);
    }
    function drawTop() {
      u.clear(top);
      u.loadStudents(admin).then(function (studs) {
        var classes = u.numSort(u.uniq(studs.map(function (s) { return s.cls; })));
        if (!classes.length) { top.appendChild(el('p', { class: 'pm-muted' }, admin ? 'No approved students yet.' : 'You have no classes assigned yet.')); return; }
        var title = el('input', { class: 'pm-in', maxlength: '120', placeholder: 'e.g. Chapter 3 exercise' }), subject = el('input', { class: 'pm-in', maxlength: '60', placeholder: 'e.g. Maths' });
        var cls = u.sel(classes), board = u.sel(u.numSort(u.uniq(studs.map(function (s) { return s.board; }))), 'All boards'), div = u.sel(u.numSort(u.uniq(studs.map(function (s) { return s.div; }))), 'All divisions');
        var due = el('input', { class: 'pm-in', type: 'date', value: today() }), max = el('input', { class: 'pm-in', type: 'number', min: '1', max: '1000', step: '0.5', placeholder: 'optional' });
        var details = el('textarea', { class: 'pm-in', rows: '3', maxlength: '3000', placeholder: 'Instructions (optional)' });
        var btn = el('button', { type: 'button', class: 'pm-btn pri' }, 'Post homework');
        btn.onclick = async function () {
          if (title.value.trim().length < 2 || !subject.value.trim()) return u.msg(msgBox, 'Enter a title and subject.', 'err');
          var mx = max.value === '' ? null : u.num(max.value); if (max.value !== '' && (!mx || mx <= 0)) return u.msg(msgBox, 'Maximum marks must be more than 0.', 'err');
          btn.disabled = true; u.msg(msgBox, 'Posting\u2026');
          var r = await sb().from('homework').insert({ title: title.value.trim(), details: details.value.trim() || null, subject: subject.value.trim(), class_name: cls.value, board: board.value || null, division: div.value || null, due_date: due.value, max_marks: mx });
          btn.disabled = false; if (r.error) return u.msg(msgBox, errText(r.error), 'err');
          title.value = ''; details.value = ''; u.msg(msgBox, 'Homework posted.', 'ok'); refresh();
        };
        top.appendChild(el('h3', {}, 'New homework'));
        top.appendChild(el('div', { class: 'pm-form' }, u.field('Title', title), u.field('Subject', subject), u.field('Class', cls), u.field('Board', board), u.field('Division', div), u.field('Due date', due), u.field('Marks (optional)', max)));
        top.appendChild(u.field('Details', details)); top.appendChild(el('div', { style: 'margin-top:8px' }, btn));
      }).catch(function () { top.appendChild(el('p', { class: 'pm-muted' }, 'Could not load your students.')); });
    }
    function drawList(counts) {
      u.clear(out); out.appendChild(el('h3', {}, 'Posted homework (' + list.length + ')'));
      if (!list.length) out.appendChild(el('p', { class: 'pm-muted' }, 'None yet.'));
      list.forEach(function (hw) {
        var k = counts[hw.id] || { total: 0, reviewed: 0, needs: 0 }, rev = el('button', { type: 'button', class: 'pm-btn' }, 'Review (' + k.total + ')'), del = el('button', { type: 'button', class: 'pm-btn bad' }, 'Delete');
        rev.onclick = function () { openReview(hw); };
        del.onclick = async function () { if (!window.confirm('Delete "' + hw.title + '" and every submission for it? This cannot be undone.')) return; var r = await sb().from('homework').delete().eq('id', hw.id); if (r.error) return u.msg(msgBox, errText(r.error), 'err'); u.msg(msgBox, 'Homework deleted.', 'ok'); refresh(); };
        out.appendChild(el('div', { class: 'pm-row' }, el('div', { class: 't' }, el('b', {}, hw.title), el('span', { class: 'pm-badge ' + (hw.due_date < today() ? 'off' : 'ok') }, hw.due_date < today() ? 'past due' : 'open'),
          el('div', { class: 'pm-muted' }, hw.subject + ' \u00B7 Class ' + hw.class_name + (hw.board ? ' \u00B7 ' + hw.board : '') + (hw.division ? ' \u00B7 Div ' + hw.division : '') + ' \u00B7 due ' + u.fmtDate(hw.due_date) + ' \u00B7 ' + k.total + ' submitted, ' + k.reviewed + ' reviewed' + (k.needs ? ', ' + k.needs + ' need changes' : ''))),
          el('div', { style: 'display:flex;gap:6px;flex-wrap:wrap' }, rev, del)));
      });
    }
    async function openReview(hw) {
      u.clear(out); u.msg(msgBox, '');
      out.appendChild(el('button', { type: 'button', class: 'pm-btn', onclick: function () { refresh().catch(function () { }); } }, '\u2190 Back to homework'));
      out.appendChild(el('h3', {}, hw.title + ' \u00B7 ' + hw.subject + ' \u00B7 Class ' + hw.class_name));
      var holder = el('div', {}, el('div', { class: 'pm-muted' }, 'Loading\u2026')); out.appendChild(holder);
      try {
        var studs = (await u.loadStudents(admin)).filter(function (s) { return s.cls === hw.class_name && (!hw.board || s.board === hw.board) && (!hw.division || s.div === hw.division); }).sort(function (a, b) { return a.name.localeCompare(b.name); });
        var r = await sb().from('homework_submissions').select('*').eq('homework_id', hw.id); if (r.error) throw r.error;
        var subs = {}; (r.data || []).forEach(function (x) { subs[x.student_id] = x; });
        u.clear(holder);
        var n = studs.length, got = studs.filter(function (s) { return subs[s.id]; }).length, revd = studs.filter(function (s) { return subs[s.id] && subs[s.id].status === 'reviewed'; }).length, needs = studs.filter(function (s) { return subs[s.id] && subs[s.id].status === 'needs_changes'; }).length;
        holder.appendChild(el('div', { class: 'pm-charts' }, u.chartBox('Submission status', u.pieChart([
          { label: 'Reviewed', value: revd, color: '#3ddc97' }, { label: 'Waiting for review', value: got - revd - needs, color: '#4fd6e8' }, { label: 'Needs changes', value: needs, color: '#f5b942' }, { label: 'Not submitted', value: n - got, color: '#ff6b6b' }]))));
        var missing = studs.filter(function (s) { return !subs[s.id]; });
        if (missing.length) holder.appendChild(el('p', { class: 'pm-muted' }, 'Not submitted yet: ' + missing.map(function (s) { return s.name; }).join(', ')));
        studs.filter(function (s) { return subs[s.id]; }).forEach(function (s) {
          var sub = subs[s.id], mk = el('input', { class: 'pm-in', type: 'number', min: '0', max: hw.max_marks ? String(hw.max_marks) : null, step: '0.5', value: sub.marks == null ? '' : sub.marks, disabled: hw.max_marks ? null : true, placeholder: hw.max_marks ? 'out of ' + hw.max_marks : 'no marks', 'aria-label': 'Marks for ' + s.name, style: 'max-width:140px' }),
            fb = el('textarea', { class: 'pm-in', rows: '2', maxlength: '1000', placeholder: 'Feedback for the student', 'aria-label': 'Feedback for ' + s.name }, sub.feedback || ''), m = el('div', { class: 'pm-msg' }), ok = el('button', { type: 'button', class: 'pm-btn pri' }, 'Mark reviewed'), nc = el('button', { type: 'button', class: 'pm-btn' }, 'Ask for changes');
          async function save(status) {
            var v = mk.value === '' ? null : u.num(mk.value);
            if (hw.max_marks && v !== null && (v < 0 || v > hw.max_marks)) return u.msg(m, 'Marks must be between 0 and ' + hw.max_marks + '.', 'err');
            ok.disabled = nc.disabled = true; u.msg(m, 'Saving\u2026');
            var rr = await sb().from('homework_submissions').update({ status: status, marks: hw.max_marks ? v : null, feedback: fb.value.trim() || null }).eq('id', sub.id); ok.disabled = nc.disabled = false;
            if (rr.error) return u.msg(m, errText(rr.error), 'err'); u.msg(m, status === 'reviewed' ? 'Saved as reviewed.' : 'Sent back for changes.', 'ok'); sub.status = status;
          }
          ok.onclick = function () { save('reviewed'); }; nc.onclick = function () { save('needs_changes'); };
          var lk = safeLink(sub.link);
          holder.appendChild(el('div', { class: 'pm-row', style: 'display:block' }, el('div', {}, el('b', {}, s.name), badge(el, sub.status), isLate(sub, hw) ? el('span', { class: 'pm-badge off' }, 'late') : null),
            sub.answer ? el('div', { style: 'margin:6px 0;white-space:pre-wrap;overflow-wrap:anywhere;font-size:14px' }, sub.answer) : null,
            lk ? el('div', {}, el('a', { href: lk, target: '_blank', rel: 'noopener noreferrer' }, 'Open the student\u2019s link')) : null,
            el('div', { style: 'display:grid;gap:8px;margin-top:8px' }, mk, fb, el('div', { style: 'display:flex;gap:6px;flex-wrap:wrap' }, ok, nc), m)));
        });
        if (!got) holder.appendChild(el('p', { class: 'pm-muted' }, 'No submissions yet.'));
      } catch (e) { u.clear(holder); holder.appendChild(el('p', { class: 'pm-muted' }, 'Could not load submissions. ' + errText(e))); }
    }
    refresh().catch(function (e) { u.msg(msgBox, 'Could not load homework. ' + errText(e), 'err'); });
    return card;
  }

  window.photonAdminHomework = function (view) {
    if (!U()) { view.textContent = 'The Homework screen did not load. Please refresh the page.'; return; }
    U().clear(view); view.appendChild(staffPanel({ admin: true }));
  };

  /* ---------- mounting in Student Space ---------- */
  function findCard(h) { var root = document.getElementById('ss-root'); if (!root) return null; var hs = root.querySelectorAll('h2'); for (var i = 0; i < hs.length; i++) if (hs[i].textContent.trim() === h) return hs[i].closest('.card'); return null; }
  var busy = false;
  function inject() {
    var root = document.getElementById('ss-root'); if (!root || !sb() || !U()) return;
    var sn = findCard('Special notes');
    if (sn && !root.querySelector('#ph-student') && !busy) {
      busy = true;
      myCard().then(function (c) {
        busy = false; if (!c || root.querySelector('#ph-student')) return;
        var a = root.querySelector('#pm-student') || root.querySelector('#pa-student'); if (a) a.after(c); else { var n = findCard('Special notes'); if (n) (n.closest('.cols2') || n).after(c); }
      }, function () { busy = false; });
    }
    var tn = findCard('Add a special note');
    if (tn && !root.querySelector('#ph-teacher')) {
      var p = staffPanel({ admin: false }), a = root.querySelector('#pm-teacher') || root.querySelector('#pa-teacher'); if (a) a.after(p); else (tn.closest('.cols2') || tn).after(p);
    }
  }
  function start() { var root = document.getElementById('ss-root'); if (!root) return; var t = 0; new MutationObserver(function () { clearTimeout(t); t = setTimeout(inject, 300); }).observe(root, { childList: true, subtree: true }); inject(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
