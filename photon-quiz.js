/* ===================================================================
   Photon Academy - Online timed multiple-choice tests
     - Student Space (students): "Online tests": start, answer with a countdown, see score and review
     - Teacher Desk (teachers) and Admin panel: create a test, add questions (one by one or paste many),
       publish, see results, per-question difficulty, reset a student's attempt
   Marking happens inside the database: students never receive the correct answers while taking a test,
   cannot change their score, and cannot submit twice. Time is counted from the server's start time.
   Needs photon-marks.js loaded first (shared charts and helpers).
   =================================================================== */
(function () {
  'use strict';
  var U = function () { return window.PhotonUI; };
  function sb() { return window.photonSupabase; }
  function el() { return U().el.apply(null, arguments); }
  var LET = 'ABCDEF';
  function err(e) { var m = (e && e.message) || ''; return /already submitted|not available|not for your class|not opened|has closed|no questions|time for this test|not started|sign in/i.test(m) ? m.replace(/^.*?:\s*/, '') : U().friendly(e); }
  function mmss(ms) { var s = Math.max(0, Math.round(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  function dt(s) { try { return new Date(s).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) { return s; } }

  /* ---------------- pasted-questions parser ---------------- */
  function parseMcq(text) {
    var blocks = String(text || '').replace(/\r/g, '').split(/\n\s*\n+/), items = [], errors = [];
    blocks.forEach(function (b, bi) {
      var lines = b.split('\n').map(function (l) { return l.trim(); }).filter(Boolean); if (!lines.length) return;
      var q = [], opts = [], ans = null, marks = 1, exp = '', m;
      lines.forEach(function (l) {
        if ((m = /^(?:answer|ans|correct)\s*[:\-]?\s*\(?([A-Fa-f])\)?/i.exec(l))) ans = LET.indexOf(m[1].toUpperCase());
        else if ((m = /^marks?\s*[:\-]?\s*([0-9.]+)/i.exec(l))) marks = Number(m[1]) || 1;
        else if ((m = /^(?:explanation|exp)\s*[:\-]\s*(.+)/i.exec(l))) exp = m[1];
        else if ((m = /^\(?([A-Fa-f])[\)\.\:]\s*(.+)$/.exec(l)) && (opts.length || m[1].toUpperCase() === 'A')) opts.push(m[2].trim());
        else if (!opts.length) q.push(l);
      });
      var qt = q.join(' ').replace(/^(?:Q(?:uestion)?\s*\d+|\d+)\s*[\.\):\-]\s*/i, '').trim();
      if (!qt) return errors.push('Block ' + (bi + 1) + ': no question text.');
      if (opts.length < 2) return errors.push('Block ' + (bi + 1) + ' ("' + qt.slice(0, 30) + '"): needs at least two options like A) ...');
      if (opts.length > 6) return errors.push('Block ' + (bi + 1) + ': at most 6 options.');
      if (ans === null || ans >= opts.length) return errors.push('Block ' + (bi + 1) + ' ("' + qt.slice(0, 30) + '"): add a line like Answer: B');
      items.push({ question: qt.slice(0, 1000), options: opts.map(function (o) { return o.slice(0, 300); }), correct: ans, marks: marks > 0 && marks <= 100 ? marks : 1, explanation: exp ? exp.slice(0, 1000) : null });
    });
    return { items: items, errors: errors };
  }

  /* ---------------- student ---------------- */
  async function myCard() {
    var u = U(), card = el('div', { class: 'pm-card', id: 'pq-student' }, el('h2', {}, 'Online tests'), el('div', { class: 'pm-muted' }, 'Loading\u2026')), uid, timer = null, guard = null;
    function leave() { if (timer) clearInterval(timer); timer = null; if (guard) window.removeEventListener('beforeunload', guard); guard = null; }
    async function list() {
      leave(); u.clear(card); card.appendChild(el('h2', {}, 'Online tests'));
      var q = await sb().from('quizzes').select('id,title,subject,duration_min,opens_at,closes_at,show_answers').order('created_at', { ascending: false }).limit(40);
      var a = await sb().from('quiz_attempts').select('quiz_id,started_at,submitted_at,score,max_score,late').eq('student_id', uid);
      if (q.error || a.error) { card.appendChild(el('div', { class: 'pm-muted' }, 'Could not load tests right now.')); return; }
      var at = {}; (a.data || []).forEach(function (x) { at[x.quiz_id] = x; });
      if (!q.data.length) { card.appendChild(el('div', { class: 'pm-muted' }, 'No tests yet. Your teacher will publish them here.')); return; }
      var now = Date.now();
      q.data.forEach(function (z) {
        var t = at[z.id], row = el('div', { class: 'pm-row' }), info = el('div', { class: 't' }, el('b', {}, z.title)), btns = el('div', { style: 'display:flex;gap:6px;flex-wrap:wrap' }), sub = z.subject + ' \u00B7 ' + z.duration_min + ' min';
        if (t && t.submitted_at) {
          var pc = t.max_score ? Math.round(t.score * 1000 / t.max_score) / 10 : 0;
          info.appendChild(el('span', { class: 'pm-badge ok' }, 'Done \u00B7 ' + t.score + ' / ' + t.max_score + ' (' + pc + '%)')); if (t.late) info.appendChild(el('span', { class: 'pm-badge off' }, 'late'));
          if (z.show_answers) btns.appendChild(el('button', { type: 'button', class: 'pm-btn', onclick: function () { review(z); } }, 'Review answers'));
        } else if (t && now < Date.parse(t.started_at) + z.duration_min * 60000 + 90000) {
          info.appendChild(el('span', { class: 'pm-badge off' }, 'in progress')); btns.appendChild(el('button', { type: 'button', class: 'pm-btn pri', onclick: function () { run(z); } }, 'Continue'));
        } else if (t) { info.appendChild(el('span', { class: 'pm-badge off' }, 'time over \u00B7 ask your teacher')); }
        else if (z.opens_at && now < Date.parse(z.opens_at)) { sub += ' \u00B7 opens ' + dt(z.opens_at); info.appendChild(el('span', { class: 'pm-badge off' }, 'not open yet')); }
        else if (z.closes_at && now > Date.parse(z.closes_at)) { info.appendChild(el('span', { class: 'pm-badge off' }, 'closed')); }
        else { if (z.closes_at) sub += ' \u00B7 closes ' + dt(z.closes_at); btns.appendChild(el('button', { type: 'button', class: 'pm-btn pri', onclick: function () { if (window.confirm('Start "' + z.title + '"? The ' + z.duration_min + '-minute timer starts now and cannot be paused.')) run(z); } }, 'Start test')); }
        info.appendChild(el('div', { class: 'pm-muted' }, sub)); row.appendChild(info); row.appendChild(btns); card.appendChild(row);
      });
    }
    async function run(z) {
      u.clear(card); card.appendChild(el('h2', {}, z.title)); var box = el('div', {}, el('div', { class: 'pm-muted' }, 'Starting\u2026')); card.appendChild(box);
      var r = await sb().rpc('quiz_start', { p_quiz: z.id });
      if (r.error || !r.data || !r.data[0]) { u.clear(box); box.appendChild(el('div', { class: 'pm-msg err' }, err(r.error))); box.appendChild(el('button', { type: 'button', class: 'pm-btn', onclick: list }, u.ico('back'), 'Back')); return; }
      var d = r.data[0], qs = d.questions || [], key = 'pq:' + d.attempt_id, saved = {}, done = false;
      try { saved = JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch (e) { saved = {}; }
      var remain = d.duration_min * 60000 - (Date.parse(d.server_now) - Date.parse(d.started_at)), endAt = Date.now() + remain;
      u.clear(box);
      var clock = el('b', { style: 'font-size:22px' }, mmss(remain)), prog = el('span', { class: 'pm-muted' }), msgBox = el('div', { class: 'pm-msg' });
      box.appendChild(el('div', { class: 'pm-row', style: 'position:sticky;top:0;z-index:5;background:var(--pm-bg,#0f1a30)' }, el('span', {}, 'Time left: ', clock), prog));
      box.appendChild(el('div', { class: 'pm-muted' }, 'Pick one answer for each question. Do not close this page. When the time ends, your answers are sent automatically.'));
      function count() { var n = Object.keys(saved).length; prog.textContent = n + ' of ' + qs.length + ' answered'; }
      qs.forEach(function (q, i) {
        var opts = el('div', { style: 'display:grid;gap:6px;margin-top:6px' });
        (q.options || []).forEach(function (o, k) {
          var inp = el('input', { type: 'radio', name: 'q' + i, value: String(k), style: 'margin-right:8px' }); if (saved[q.id] === k) inp.checked = true;
          inp.onchange = function () { saved[q.id] = k; try { localStorage.setItem(key, JSON.stringify(saved)); } catch (e) { } count(); };
          opts.appendChild(el('label', { style: 'display:flex;align-items:flex-start;border:1px solid rgba(127,127,127,.38);border-radius:10px;padding:8px 10px;cursor:pointer' }, inp, el('span', { style: 'overflow-wrap:anywhere' }, LET[k] + ') ' + o)));
        });
        box.appendChild(el('div', { class: 'pm-row', style: 'display:block' }, el('b', { style: 'overflow-wrap:anywhere' }, (i + 1) + '. ' + q.question), el('span', { class: 'pm-muted' }, ' (' + q.marks + (Number(q.marks) === 1 ? ' mark)' : ' marks)')), opts));
      });
      var send = el('button', { type: 'button', class: 'pm-btn pri' }, 'Submit test'); box.appendChild(el('div', { style: 'margin-top:10px' }, send)); box.appendChild(msgBox); count();
      guard = function (e) { if (!done) { e.preventDefault(); e.returnValue = ''; } }; window.addEventListener('beforeunload', guard);
      async function submit(auto) {
        if (done) return; if (!auto && Object.keys(saved).length < qs.length && !window.confirm((qs.length - Object.keys(saved).length) + ' question(s) are not answered. Submit anyway?')) return;
        done = true; send.disabled = true; u.msg(msgBox, 'Sending your answers\u2026');
        var s = await sb().rpc('quiz_submit', { p_quiz: z.id, p_answers: saved });
        if (s.error) { done = false; send.disabled = false; return u.msg(msgBox, err(s.error) + ' Your answers are saved on this phone. Try again.', 'err'); }
        try { localStorage.removeItem(key); } catch (e) { } leave(); result(z, s.data[0], null);
      }
      send.onclick = function () { submit(false); };
      timer = setInterval(function () { var left = endAt - Date.now(); clock.textContent = mmss(left); if (left < 60000) clock.style.color = '#ff6b6b'; if (left <= 0) { clearInterval(timer); timer = null; submit(true); } }, 1000);
    }
    function result(z, d, rev) {
      leave(); u.clear(card); card.appendChild(el('h2', {}, z.title + ' \u00B7 result'));
      var pc = d.max_score ? Math.round(d.score * 1000 / d.max_score) / 10 : 0, review = rev || d.review;
      card.appendChild(el('div', { class: 'pm-grid' }, u.statBox(d.score + ' / ' + d.max_score, 'Your score'), u.statBox(pc + '%', 'Percentage'), d.late ? u.statBox('Late', 'Submitted after the time') : null));
      if (review) {
        var right = review.filter(function (x) { return x.chosen !== null && x.chosen === x.correct; }).length, skipped = review.filter(function (x) { return x.chosen === null || x.chosen === undefined; }).length;
        card.appendChild(el('div', { class: 'pm-charts' }, u.chartBox('Your answers', u.pieChart([{ label: 'Correct', value: right, color: '#3ddc97' }, { label: 'Wrong', value: review.length - right - skipped, color: '#ff6b6b' }, { label: 'Skipped', value: skipped, color: '#f5b942' }]))));
        if (review[0] && review[0].question !== undefined) review.forEach(function (x, i) {
          card.appendChild(el('div', { class: 'pm-row', style: 'display:block' }, el('b', { style: 'overflow-wrap:anywhere' }, (i + 1) + '. ' + x.question),
            (x.options || []).map(function (o, k) { var good = k === x.correct, mine = k === x.chosen; return el('div', { style: 'margin:4px 0;padding:5px 8px;border-radius:8px;border:1px solid ' + (good ? '#3ddc97' : mine ? '#ff6b6b' : 'rgba(127,127,127,.3)') }, LET[k] + ') ' + o, good ? [' ', u.ico('check', '#3ddc97'), 'correct'] : null, mine && !good ? [' ', u.ico('x', '#ff6b6b'), 'your answer'] : null, mine && good ? ' (your answer)' : null); }),
            x.explanation ? el('div', { class: 'pm-muted', style: 'margin-top:4px' }, 'Why: ' + x.explanation) : null));
        });
      } else card.appendChild(el('div', { class: 'pm-muted' }, 'Your teacher has chosen not to show the answers.'));
      card.appendChild(el('div', { style: 'margin-top:10px' }, el('button', { type: 'button', class: 'pm-btn', onclick: list }, u.ico('back'), 'Back to tests')));
    }
    async function review(z) {
      var r = await sb().rpc('quiz_result', { p_quiz: z.id }); if (r.error || !r.data || !r.data[0]) return;
      result(z, r.data[0], r.data[0].review);
    }
    try { var me = await sb().auth.getUser(); uid = me && me.data && me.data.user && me.data.user.id; if (!uid) return null; await list(); } catch (e) { u.clear(card); card.appendChild(el('h2', {}, 'Online tests')); card.appendChild(el('div', { class: 'pm-muted' }, 'Could not load tests right now.')); }
    return card;
  }

  /* ---------------- teacher / admin ---------------- */
  function staffPanel(opts) {
    var u = U(), admin = !!opts.admin, card = el('div', { class: 'pm-card', id: admin ? 'pq-admin' : 'pq-teacher' }), top = el('div', {}), out = el('div', {}), msgBox = el('div', { class: 'pm-msg' }), list = [], qCount = {}, aCount = {};
    card.appendChild(el('h2', {}, 'Online tests')); card.appendChild(el('div', { class: 'pm-muted' }, 'Create a timed multiple-choice test, add questions, publish it, then see results. Marking is automatic and answers stay hidden while students take the test.'));
    card.appendChild(top); card.appendChild(msgBox); card.appendChild(out);
    async function refresh() {
      var r = await sb().from('quizzes').select('*').order('created_at', { ascending: false }).limit(200); if (r.error) throw r.error; list = r.data || [];
      var qq = await sb().from('quiz_questions').select('quiz_id').limit(6000), aa = await sb().from('quiz_attempts').select('quiz_id,submitted_at').limit(8000); qCount = {}; aCount = {};
      (qq.data || []).forEach(function (x) { qCount[x.quiz_id] = (qCount[x.quiz_id] || 0) + 1; }); (aa.data || []).forEach(function (x) { var k = aCount[x.quiz_id] = aCount[x.quiz_id] || { n: 0, done: 0 }; k.n++; if (x.submitted_at) k.done++; });
      drawTop(); drawList();
    }
    function drawTop() {
      u.clear(top);
      u.loadStudents(admin).then(function (studs) {
        var classes = u.numSort(u.uniq(studs.map(function (s) { return s.cls; })));
        if (!classes.length) { top.appendChild(el('p', { class: 'pm-muted' }, admin ? 'No approved students yet.' : 'You have no classes assigned yet.')); return; }
        var title = el('input', { class: 'pm-in', maxlength: '120', placeholder: 'e.g. Chapter 2 quick test' }), subject = el('input', { class: 'pm-in', maxlength: '60', placeholder: 'e.g. Science' }), cls = u.sel(classes), board = u.sel(u.numSort(u.uniq(studs.map(function (s) { return s.board; }))), 'All boards'), div = u.sel(u.numSort(u.uniq(studs.map(function (s) { return s.div; }))), 'All divisions');
        var dur = el('input', { class: 'pm-in', type: 'number', min: '1', max: '300', value: '20' }), opens = el('input', { class: 'pm-in', type: 'datetime-local' }), closes = el('input', { class: 'pm-in', type: 'datetime-local' }), show = el('input', { type: 'checkbox', checked: true }), btn = el('button', { type: 'button', class: 'pm-btn pri' }, 'Create test');
        btn.onclick = async function () {
          var d = Number(dur.value); if (title.value.trim().length < 2 || !subject.value.trim()) return u.msg(msgBox, 'Enter a name and subject.', 'err'); if (!(d >= 1 && d <= 300)) return u.msg(msgBox, 'Minutes must be between 1 and 300.', 'err');
          if (opens.value && closes.value && new Date(closes.value) <= new Date(opens.value)) return u.msg(msgBox, 'The closing time must be after the opening time.', 'err');
          btn.disabled = true; var r = await sb().from('quizzes').insert({ title: title.value.trim(), subject: subject.value.trim(), class_name: cls.value, board: board.value || null, division: div.value || null, duration_min: d, opens_at: opens.value ? new Date(opens.value).toISOString() : null, closes_at: closes.value ? new Date(closes.value).toISOString() : null, show_answers: show.checked }).select().single(); btn.disabled = false;
          if (r.error) return u.msg(msgBox, u.friendly(r.error), 'err'); title.value = ''; u.msg(msgBox, 'Test created. Add the questions now.', 'ok'); await refresh(); openQuestions(r.data);
        };
        top.appendChild(el('h3', {}, 'New test')); top.appendChild(el('div', { class: 'pm-form' }, u.field('Test name', title), u.field('Subject', subject), u.field('Class', cls), u.field('Board', board), u.field('Division', div), u.field('Minutes allowed', dur), u.field('Opens (optional)', opens), u.field('Closes (optional)', closes)));
        top.appendChild(el('label', { style: 'display:block;margin:6px 0;font-size:14px' }, show, ' Show correct answers to students after they submit')); top.appendChild(btn);
      }).catch(function () { top.appendChild(el('p', { class: 'pm-muted' }, 'Could not load your students.')); });
    }
    function drawList() {
      u.clear(out); out.appendChild(el('h3', {}, 'Tests (' + list.length + ')')); if (!list.length) out.appendChild(el('p', { class: 'pm-muted' }, 'None yet.'));
      list.forEach(function (z) {
        var nq = qCount[z.id] || 0, na = aCount[z.id] || { n: 0, done: 0 };
        var qb = el('button', { type: 'button', class: 'pm-btn', onclick: function () { openQuestions(z); } }, 'Questions (' + nq + ')'), rb = el('button', { type: 'button', class: 'pm-btn', onclick: function () { openResults(z); } }, 'Results (' + na.done + ')'), pb = el('button', { type: 'button', class: 'pm-btn' }, z.published ? 'Hide' : 'Publish'), db = el('button', { type: 'button', class: 'pm-btn bad' }, 'Delete');
        pb.onclick = async function () { if (!z.published && !nq) return u.msg(msgBox, 'Add at least one question before publishing.', 'err'); var r = await sb().from('quizzes').update({ published: !z.published }).eq('id', z.id); if (r.error) return u.msg(msgBox, u.friendly(r.error), 'err'); u.msg(msgBox, z.published ? 'Hidden from students.' : 'Published. Students of that class can start it' + (z.opens_at ? ' from the opening time.' : ' now.'), 'ok'); refresh(); };
        db.onclick = async function () { if (!window.confirm('Delete "' + z.title + '", its questions and all results? This cannot be undone.')) return; var r = await sb().from('quizzes').delete().eq('id', z.id); if (r.error) return u.msg(msgBox, u.friendly(r.error), 'err'); u.msg(msgBox, 'Test deleted.', 'ok'); refresh(); };
        out.appendChild(el('div', { class: 'pm-row' }, el('div', { class: 't' }, el('b', {}, z.title), el('span', { class: 'pm-badge ' + (z.published ? 'ok' : 'off') }, z.published ? 'published' : 'draft'), el('div', { class: 'pm-muted' }, z.subject + ' \u00B7 Class ' + z.class_name + (z.board ? ' \u00B7 ' + z.board : '') + (z.division ? ' \u00B7 Div ' + z.division : '') + ' \u00B7 ' + z.duration_min + ' min' + (z.opens_at ? ' \u00B7 opens ' + dt(z.opens_at) : '') + (z.closes_at ? ' \u00B7 closes ' + dt(z.closes_at) : '') + ' \u00B7 ' + na.n + ' started')), el('div', { style: 'display:flex;gap:6px;flex-wrap:wrap' }, qb, rb, pb, db)));
      });
    }
    function back() { return el('button', { type: 'button', class: 'pm-btn', onclick: function () { refresh().catch(function () { }); } }, u.ico('back'), 'Back to tests'); }
    async function openQuestions(z) {
      u.clear(out); u.msg(msgBox, ''); out.appendChild(back()); out.appendChild(el('h3', {}, z.title + ' \u00B7 questions'));
      var holder = el('div', {}, el('div', { class: 'pm-muted' }, 'Loading\u2026')); out.appendChild(holder);
      var r = await sb().from('quiz_questions').select('*').eq('quiz_id', z.id).order('position', { ascending: true }).order('created_at', { ascending: true }); if (r.error) { u.clear(holder); holder.appendChild(el('p', { class: 'pm-muted' }, 'Could not load questions.')); return; }
      var qs = r.data || [], started = (aCount[z.id] || { n: 0 }).n > 0; u.clear(holder);
      if (started) holder.appendChild(el('p', { class: 'pm-msg err' }, 'Students have already started this test, so questions are locked. Reset the attempts in Results first, or make a new test.'));
      qs.forEach(function (q, i) {
        var del = el('button', { type: 'button', class: 'pm-btn bad', disabled: started }, 'Delete');
        del.onclick = async function () { var d = await sb().from('quiz_questions').delete().eq('id', q.id); if (d.error) return u.msg(msgBox, u.friendly(d.error), 'err'); qCount[z.id] = Math.max(0, (qCount[z.id] || 1) - 1); openQuestions(z); };
        holder.appendChild(el('div', { class: 'pm-row', style: 'display:block' }, el('div', { style: 'display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap' }, el('b', { style: 'overflow-wrap:anywhere' }, (i + 1) + '. ' + q.question + ' (' + q.marks + ')'), del),
          q.options.map(function (o, k) { return el('div', { style: 'margin:3px 0;font-size:14px;' + (k === q.correct ? 'color:#2fb37c;font-weight:600' : '') }, LET[k] + ') ' + o, k === q.correct ? [' ', u.ico('check', '#2fb37c')] : null); })));
      });
      if (started) return;
      var qt = el('textarea', { class: 'pm-in', rows: '2', maxlength: '1000', placeholder: 'Question' }), os = [0, 1, 2, 3, 4, 5].map(function (k) { return el('input', { class: 'pm-in', maxlength: '300', placeholder: 'Option ' + LET[k] + (k > 3 ? ' (optional)' : '') }); }), rad = [0, 1, 2, 3, 4, 5].map(function (k) { return el('input', { type: 'radio', name: 'corr', value: String(k), 'aria-label': 'Correct answer ' + LET[k] }); }), mk = el('input', { class: 'pm-in', type: 'number', min: '0.5', max: '100', step: '0.5', value: '1', style: 'max-width:100px' }), ex = el('input', { class: 'pm-in', maxlength: '1000', placeholder: 'Explanation (optional, shown after the test)' }), add1 = el('button', { type: 'button', class: 'pm-btn pri' }, 'Add question');
      rad[0].checked = true;
      add1.onclick = async function () {
        var opts = [], correct = -1; os.forEach(function (o, k) { if (o.value.trim()) { if (rad[k].checked) correct = opts.length; opts.push(o.value.trim()); } });
        if (!qt.value.trim()) return u.msg(msgBox, 'Type the question.', 'err'); if (opts.length < 2) return u.msg(msgBox, 'Give at least two options.', 'err'); if (correct < 0) return u.msg(msgBox, 'Choose which option is correct (the round button).', 'err');
        add1.disabled = true; var d = await sb().from('quiz_questions').insert({ quiz_id: z.id, position: qs.length + 1, question: qt.value.trim(), options: opts, correct: correct, marks: Number(mk.value) || 1, explanation: ex.value.trim() || null }); add1.disabled = false;
        if (d.error) return u.msg(msgBox, u.friendly(d.error), 'err'); qCount[z.id] = (qCount[z.id] || 0) + 1; u.msg(msgBox, 'Question added.', 'ok'); openQuestions(z);
      };
      holder.appendChild(el('h3', {}, 'Add one question')); holder.appendChild(qt);
      holder.appendChild(el('div', { style: 'display:grid;gap:6px;margin-top:6px' }, os.map(function (o, k) { return el('div', { style: 'display:grid;grid-template-columns:24px 1fr;gap:8px;align-items:center' }, rad[k], o); })));
      holder.appendChild(el('div', { style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:8px 0' }, el('span', { class: 'pm-muted' }, 'Marks'), mk, ex)); holder.appendChild(add1);
      var paste = el('textarea', { class: 'pm-in', rows: '9', placeholder: 'Q1. What is the SI unit of force?\nA) Joule\nB) Newton\nC) Watt\nD) Pascal\nAnswer: B\nExplanation: Force is measured in newtons.\n\nQ2. Next question...' }), prev = el('div', { class: 'pm-muted' }), addN = el('button', { type: 'button', class: 'pm-btn pri' }, 'Add all these questions');
      holder.appendChild(el('h3', {}, 'Or paste many questions at once')); holder.appendChild(el('div', { class: 'pm-muted' }, 'Leave a blank line between questions. Options start with A) B) C) D). Add a line "Answer: B". Optional lines: "Marks: 2" and "Explanation: ...".')); holder.appendChild(paste); holder.appendChild(prev); holder.appendChild(el('div', { style: 'margin-top:8px' }, addN));
      paste.oninput = function () { var p = parseMcq(paste.value); u.clear(prev); if (!paste.value.trim()) return; prev.appendChild(el('div', {}, p.items.length + ' question(s) ready.')); p.errors.slice(0, 5).forEach(function (e) { prev.appendChild(el('div', { style: 'color:#ff7b7b' }, e)); }); };
      addN.onclick = async function () {
        var p = parseMcq(paste.value); if (p.errors.length) return u.msg(msgBox, 'Fix these first: ' + p.errors[0], 'err'); if (!p.items.length) return u.msg(msgBox, 'Paste some questions first.', 'err'); if (p.items.length > 100) return u.msg(msgBox, 'Add at most 100 at a time.', 'err');
        addN.disabled = true; var d = await sb().from('quiz_questions').insert(p.items.map(function (x, i) { return Object.assign({ quiz_id: z.id, position: qs.length + i + 1 }, x); })); addN.disabled = false;
        if (d.error) return u.msg(msgBox, u.friendly(d.error), 'err'); qCount[z.id] = (qCount[z.id] || 0) + p.items.length; u.msg(msgBox, p.items.length + ' questions added.', 'ok'); openQuestions(z);
      };
    }
    async function openResults(z) {
      u.clear(out); u.msg(msgBox, ''); out.appendChild(back()); out.appendChild(el('h3', {}, z.title + ' \u00B7 results')); var holder = el('div', {}, el('div', { class: 'pm-muted' }, 'Loading\u2026')); out.appendChild(holder);
      try {
        var studs = (await u.loadStudents(admin)).filter(function (s) { return s.cls === z.class_name && (!z.board || s.board === z.board) && (!z.division || s.div === z.division); }), names = {}; studs.forEach(function (s) { names[s.id] = s.name; });
        var r = await sb().from('quiz_attempts').select('*').eq('quiz_id', z.id); if (r.error) throw r.error; var qr = await sb().from('quiz_questions').select('id,question,correct').eq('quiz_id', z.id).order('position', { ascending: true });
        var at = r.data || [], done = at.filter(function (a) { return a.submitted_at; }); u.clear(holder);
        var pcs = done.map(function (a) { return a.max_score ? Math.round(a.score * 1000 / a.max_score) / 10 : 0; });
        holder.appendChild(el('div', { class: 'pm-grid' }, u.statBox(done.length + ' / ' + studs.length, 'Submitted'), u.statBox(pcs.length ? u.avg(pcs) + '%' : '\u2014', 'Average'), u.statBox(pcs.length ? Math.max.apply(null, pcs) + '%' : '\u2014', 'Highest'), u.statBox(pcs.length ? Math.min.apply(null, pcs) + '%' : '\u2014', 'Lowest')));
        if (pcs.length) {
          var diff = (qr.data || []).map(function (q, i) { var n = 0, ok = 0; done.forEach(function (a) { if (a.answers && a.answers[q.id] !== undefined) { n++; if (a.answers[q.id] === q.correct) ok++; } }); var v = done.length ? Math.round(ok * 100 / done.length) : 0; return { label: 'Q' + (i + 1), value: v, color: u.colorFor(v) }; });
          holder.appendChild(el('div', { class: 'pm-charts' }, u.chartBox('Score bands', u.pieChart(u.bandSlices(pcs))), u.chartBox('% who got each question right', u.hbars(diff))));
        }
        var body = el('tbody', {});
        at.slice().sort(function (a, b) { return (b.score || 0) - (a.score || 0); }).forEach(function (a) {
          var rs = el('button', { type: 'button', class: 'pm-btn bad' }, 'Reset'); rs.onclick = async function () { if (!window.confirm('Reset this attempt? ' + (names[a.student_id] || 'The student') + ' can take the test again.')) return; var d = await sb().from('quiz_attempts').delete().eq('id', a.id); if (d.error) return u.msg(msgBox, u.friendly(d.error), 'err'); aCount[z.id] = { n: Math.max(0, (aCount[z.id] || { n: 1 }).n - 1), done: 0 }; openResults(z); };
          var mins = a.submitted_at ? Math.round((Date.parse(a.submitted_at) - Date.parse(a.started_at)) / 6000) / 10 : null;
          body.appendChild(el('tr', {}, el('td', {}, names[a.student_id] || 'Student'), el('td', {}, a.submitted_at ? a.score + ' / ' + a.max_score : 'in progress'), el('td', {}, mins === null ? '\u2014' : mins + ' min' + (a.late ? ' (late)' : '')), el('td', {}, rs)));
        });
        if (at.length) holder.appendChild(el('div', { class: 'pm-scroll' }, el('table', { class: 'pm-tbl' }, el('thead', {}, el('tr', {}, ['Student', 'Score', 'Time taken', ''].map(function (h) { return el('th', {}, h); }))), body)));
        var missing = studs.filter(function (s) { return !at.some(function (a) { return a.student_id === s.id; }); }); if (missing.length) holder.appendChild(el('p', { class: 'pm-muted' }, 'Not started: ' + missing.map(function (s) { return s.name; }).join(', ')));
      } catch (e) { u.clear(holder); holder.appendChild(el('p', { class: 'pm-muted' }, 'Could not load results.')); }
    }
    refresh().catch(function (e) { u.msg(msgBox, 'Could not load tests. ' + err(e), 'err'); }); return card;
  }

  window.photonAdminQuiz = function (view) { if (!U()) { view.textContent = 'The Online tests screen did not load. Please refresh the page.'; return; } U().clear(view); view.appendChild(staffPanel({ admin: true })); };
  window.PhotonQuizParse = parseMcq;

  /* ---------------- mounting ---------------- */
  function findCard(h) { var root = document.getElementById('ss-root'); if (!root) return null; var hs = root.querySelectorAll('h2'); for (var i = 0; i < hs.length; i++) if (hs[i].textContent.trim() === h) return hs[i].closest('.card'); return null; }
  var busy = false;
  function inject() {
    var root = document.getElementById('ss-root'); if (!root || !sb() || !U()) return;
    if (findCard('Special notes') && !root.querySelector('#pq-student') && !busy) {
      busy = true; myCard().then(function (c) { busy = false; if (!c || root.querySelector('#pq-student')) return; var a = root.querySelector('#ph-student') || root.querySelector('#pm-student'); if (a) a.after(c); else { var n = findCard('Special notes'); if (n) (n.closest('.cols2') || n).after(c); } }, function () { busy = false; });
    }
    var tn = findCard('Add a special note');
    if (tn && !root.querySelector('#pq-teacher')) { var p = staffPanel({ admin: false }), a = root.querySelector('#ph-teacher') || root.querySelector('#pm-teacher') || root.querySelector('#pa-teacher'); if (a) a.after(p); else (tn.closest('.cols2') || tn).after(p); }
  }
  function start() { var root = document.getElementById('ss-root'); if (!root) return; if (window.PhotonUI && window.PhotonUI.onMount) window.PhotonUI.onMount(inject); inject(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
