/* ===================================================================
   Photon Academy - Chat (academy-wide room + one room per class)
   - Students: the academy chat and their own class chat. Teachers and admins: every room.
   - Text only (no photos or files) so it never uses file storage. Messages older than 45 days are deleted automatically.
   - No live connection is kept open: the open chat asks for new messages every 8 seconds, only while the tab is visible.
   - Teachers and admins can delete any message and mute a student. A student can delete their own messages.
   - All rules live in the database (functions chat_my_rooms, chat_fetch, chat_send, chat_delete, chat_set_mute, chat_muted_list).
   Used in three places: the student space, the teacher desk (both inject a card) and the admin panel (menu item "Chat").
   =================================================================== */
(function () {
  'use strict';
  var POLL_MS = 8000, MAXLEN = 1000, MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function sb() { return window.photonSupabase; }
  function el(tag, attrs) {
    var e = document.createElement(tag); attrs = attrs || {};
    Object.keys(attrs).forEach(function (k) { var v = attrs[k]; if (v === null || v === undefined || v === false) return; if (k === 'class') e.className = v; else if (k === 'style') e.style.cssText = v; else if (k === 'value') e.value = v; else if (k.indexOf('on') === 0) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v); });
    for (var i = 2; i < arguments.length; i++) add(e, arguments[i]); return e;
  }
  function add(p, c) { if (c === null || c === undefined || c === false) return; if (Array.isArray(c)) { c.forEach(function (x) { add(p, x); }); return; } p.appendChild(c.nodeType ? c : document.createTextNode(String(c))); }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); return n; }
  var css = el('style'); css.textContent = [
    '.pc-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}.pc-tab{border:1px solid var(--line,rgba(127,127,127,.6));background:transparent;color:inherit;border-radius:99px;padding:6px 14px;font:inherit;font-size:13.5px;cursor:pointer}.pc-tab.on{background:#4fd6e8;border-color:#4fd6e8;color:#06202a;font-weight:600}',
    '.pc-dot{display:inline-block;min-width:18px;padding:0 5px;margin-left:6px;border-radius:99px;background:#ff7b7b;color:#fff;font-size:11.5px;line-height:18px;text-align:center}',
    '.pc-list{height:min(380px,55vh);overflow-y:auto;border:1px solid var(--line,rgba(127,127,127,.6));border-radius:12px;padding:10px;background:rgba(127,127,127,.07)}',
    '.pc-day{text-align:center;font-size:12px;opacity:.7;margin:10px 0 6px}.pc-row{display:flex;flex-direction:column;align-items:flex-start;margin:6px 0}.pc-row.mine{align-items:flex-end}',
    '.pc-bub{max-width:88%;border:1px solid rgba(127,127,127,.45);border-radius:14px;padding:7px 11px;background:rgba(127,127,127,.12)}.pc-row.mine .pc-bub{background:rgba(79,214,232,.18);border-color:rgba(79,214,232,.6)}',
    '.pc-who{font-size:12px;opacity:.85;margin-bottom:2px}.pc-who b{font-weight:600}.pc-tag{display:inline-block;margin-left:6px;padding:0 7px;border:1px solid rgba(127,127,127,.6);border-radius:99px;font-size:11px}',
    '.pc-body{white-space:pre-wrap;overflow-wrap:anywhere;font-size:14.5px;line-height:1.45}.pc-meta{display:flex;gap:10px;align-items:center;font-size:11.5px;opacity:.75;margin-top:3px}',
    '.pc-lnk{background:none;border:none;padding:0;color:inherit;text-decoration:underline;cursor:pointer;font:inherit;font-size:11.5px}',
    '.pc-form{display:flex;gap:8px;margin-top:10px;align-items:flex-end}.pc-in{flex:1;min-width:0;box-sizing:border-box;background:transparent;color:inherit;border:1px solid var(--line,rgba(127,127,127,.6));border-radius:12px;padding:9px 11px;font:inherit;font-size:14.5px;resize:none;max-height:140px}',
    '.pc-send{border:none;background:#4fd6e8;color:#06202a;font-weight:600;border-radius:12px;padding:10px 18px;font:inherit;font-size:14px;cursor:pointer}.pc-send:disabled,.pc-in:disabled{opacity:.5;cursor:not-allowed}',
    '.pc-msg{min-height:18px;font-size:13px;margin-top:6px}.pc-msg.err{color:#ff7b7b}.pc-muted{opacity:.78;font-size:13px}.pc-mutelist{margin-top:12px;font-size:13.5px}.pc-mutelist div{display:flex;gap:10px;align-items:center;margin:4px 0}'
  ].join('\n'); document.head.appendChild(css);

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function clock(ts) { var d = new Date(ts); if (isNaN(d)) return ''; var h = d.getHours(), ap = h >= 12 ? 'pm' : 'am'; h = h % 12 || 12; return h + ':' + pad(d.getMinutes()) + ' ' + ap; }
  function dayKey(ts) { var d = new Date(ts); return d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate(); }
  function dayLabel(ts) {
    var d = new Date(ts), t = new Date(); if (dayKey(d) === dayKey(t)) return 'Today'; var y = new Date(t.getTime() - 864e5); if (dayKey(d) === dayKey(y)) return 'Yesterday';
    return d.getDate() + ' ' + MON[d.getMonth()] + (d.getFullYear() !== t.getFullYear() ? ' ' + d.getFullYear() : '');
  }
  async function call(name, args) { var r = await sb().rpc(name, args || {}); if (r.error) throw r.error; return r.data; }
  function say(box, text, bad) { box.textContent = text || ''; box.className = 'pc-msg' + (bad ? ' err' : ''); }
  function friendly(e) { var m = (e && e.message) || ''; return m && m.length < 170 ? m : 'Something went wrong. Please try again.'; }

  function build(opts) {
    opts = opts || {}; var staff = !!opts.staff;
    var rooms = [], cur = null, last = 0, lastDay = '', uid = null, muted = false, busy = false, ticks = 0, timer = null;
    var tabs = el('div', { class: 'pc-tabs', role: 'tablist' }), list = el('div', { class: 'pc-list', 'aria-live': 'polite' }), msg = el('div', { class: 'pc-msg' }), mlist = el('div', { class: 'pc-mutelist' });
    var input = el('textarea', { class: 'pc-in', rows: '1', maxlength: String(MAXLEN), placeholder: 'Write a message', 'aria-label': 'Write a message' });
    var send = el('button', { type: 'button', class: 'pc-send' }, 'Send'), count = el('div', { class: 'pc-muted' });
    var root = el('div', { class: 'pm-card', id: 'pc-chat' }, el('h2', {}, 'Chat'),
      el('div', { class: 'pc-muted' }, 'Messages here are seen by everyone in the room. Be kind and keep it about studies. Teachers can remove messages. Messages are deleted after 45 days.'),
      tabs, list, el('div', { class: 'pc-form' }, input, send), count, msg, staff ? mlist : null);

    function nearBottom() { return list.scrollHeight - list.scrollTop - list.clientHeight < 80; }
    function toBottom() { list.scrollTop = list.scrollHeight; }

    function drawTabs() {
      clear(tabs);
      rooms.forEach(function (r) {
        var b = el('button', { type: 'button', class: 'pc-tab' + (r.id === cur ? ' on' : ''), role: 'tab', 'aria-selected': r.id === cur ? 'true' : 'false', onclick: function () { openRoom(r.id); } }, r.title);
        if (r.unread > 0 && r.id !== cur) b.appendChild(el('span', { class: 'pc-dot', 'aria-label': r.unread + ' new' }, r.unread > 99 ? '99+' : String(r.unread)));
        tabs.appendChild(b);
      });
    }
    function drawComposer() {
      input.disabled = send.disabled = muted || !cur;
      input.placeholder = muted ? 'You are muted. Please ask a teacher.' : 'Write a message';
    }
    function bubble(m) {
      var mine = m.sender_id === uid, isStaff = m.sender_role === 'teacher' || m.sender_role === 'admin';
      var who = el('div', { class: 'pc-who' }, el('b', {}, m.sender_name || 'Student'), isStaff ? el('span', { class: 'pc-tag' }, m.sender_role === 'admin' ? 'Admin' : 'Teacher') : null);
      var meta = el('div', { class: 'pc-meta' }, el('span', {}, clock(m.created_at)));
      var row = el('div', { class: 'pc-row' + (mine ? ' mine' : ''), 'data-id': String(m.id) }, el('div', { class: 'pc-bub' }, who, el('div', { class: 'pc-body' }, m.body), meta));
      if (mine || staff) meta.appendChild(el('button', { type: 'button', class: 'pc-lnk', onclick: function () { del(m, row); } }, 'Delete'));
      if (staff && !mine && m.sender_role === 'student') meta.appendChild(el('button', { type: 'button', class: 'pc-lnk', onclick: function () { mute(m); } }, 'Mute student'));
      return row;
    }
    function append(msgs) {
      var stick = nearBottom() || last === 0;
      msgs.forEach(function (m) {
        var k = dayKey(m.created_at); if (k !== lastDay) { lastDay = k; list.appendChild(el('div', { class: 'pc-day' }, dayLabel(m.created_at))); }
        list.appendChild(bubble(m)); if (m.id > last) last = m.id;
      });
      if (stick) toBottom();
    }
    async function loadRooms(quiet) {
      try { rooms = await call('chat_my_rooms'); } catch (e) { if (!quiet) say(msg, 'The chat could not be loaded. Please refresh the page.', true); return; }
      if (rooms.length) muted = !!rooms[0].muted;
      if (!rooms.length) { clear(list).appendChild(el('div', { class: 'pc-muted' }, 'The chat is not available for your account yet.')); drawTabs(); drawComposer(); return; }
      if (!cur || !rooms.some(function (r) { return r.id === cur; })) { drawTabs(); return openRoom(rooms[0].id); }
      drawTabs(); drawComposer();
    }
    async function openRoom(id) {
      cur = id; last = 0; lastDay = ''; clear(list); say(msg, ''); drawTabs(); drawComposer();
      try { var m = await call('chat_fetch', { p_room: id }); if (cur !== id) return; if (!m.length) list.appendChild(el('div', { class: 'pc-muted', style: 'text-align:center;margin-top:20px' }, 'No messages yet. Say hello!')); else append(m); toBottom(); }
      catch (e) { say(msg, friendly(e), true); }
      var r = rooms.filter(function (x) { return x.id === id; })[0]; if (r) { r.unread = 0; drawTabs(); }
    }
    async function reloadRoom() {
      if (!cur) return; var id = cur;
      try { var m = await call('chat_fetch', { p_room: id }); if (cur !== id) return; var keep = list.scrollTop, stick = nearBottom(); clear(list); last = 0; lastDay = ''; append(m); if (!stick) list.scrollTop = keep; } catch (e) { }
    }
    async function tick(force) {
      if (!root.isConnected) { stop(); return; }
      if ((document.hidden && !force) || busy || !cur) return; busy = true;
      try {
        ticks++;
        if (ticks % 8 === 0) await reloadRoom();                   // picks up messages deleted by others
        else { var m = await call('chat_fetch', { p_room: cur, p_after: last }); if (m.length) { var empty = list.querySelector('.pc-muted'); if (empty && !list.querySelector('.pc-row')) clear(list); append(m); } }
        if (ticks % 3 === 0) await loadRooms(true);               // refreshes the unread counters
      } catch (e) { } finally { busy = false; }
    }
    function onVis() { if (!root.isConnected) { stop(); return; } if (!document.hidden) tick(true); }
    function stop() { if (timer) { clearInterval(timer); timer = null; } document.removeEventListener('visibilitychange', onVis); }

    async function doSend() {
      var t = input.value.trim(); if (!t || !cur || muted) return;
      send.disabled = true; say(msg, '');
      try { await call('chat_send', { p_room: cur, p_body: t }); input.value = ''; input.style.height = ''; count.textContent = ''; var m = await call('chat_fetch', { p_room: cur, p_after: last }); if (m.length) { clear0(); append(m); } toBottom(); }
      catch (e) { say(msg, friendly(e), true); if (/muted/i.test((e && e.message) || '')) { muted = true; } }
      drawComposer(); if (!muted) input.focus();
    }
    function clear0() { if (!list.querySelector('.pc-row')) clear(list); }
    async function del(m, row) {
      if (!window.confirm('Delete this message?')) return;
      try { await call('chat_delete', { p_id: m.id }); if (row.parentNode) row.parentNode.removeChild(row); say(msg, ''); } catch (e) { say(msg, friendly(e), true); }
    }
    async function mute(m) {
      if (!window.confirm('Mute ' + (m.sender_name || 'this student') + ' in all chats? They can still read, but cannot post until you unmute them.')) return;
      try { await call('chat_set_mute', { p_user: m.sender_id, p_on: true }); say(msg, (m.sender_name || 'The student') + ' is muted.'); loadMuted(); } catch (e) { say(msg, friendly(e), true); }
    }
    async function loadMuted() {
      if (!staff) return;
      var rows; try { rows = await call('chat_muted_list'); } catch (e) { return; }
      clear(mlist); if (!rows.length) return;
      mlist.appendChild(el('div', { class: 'pc-muted' }, 'Muted students (' + rows.length + ')'));
      rows.forEach(function (r) {
        mlist.appendChild(el('div', {}, el('span', {}, r.name), el('button', { type: 'button', class: 'pc-lnk', style: 'font-size:13px', onclick: async function () { try { await call('chat_set_mute', { p_user: r.user_id, p_on: false }); loadMuted(); } catch (e) { say(msg, friendly(e), true); } } }, 'Unmute')));
      });
    }

    send.addEventListener('click', doSend);
    input.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); doSend(); } });
    input.addEventListener('input', function () { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 140) + 'px'; count.textContent = input.value.length > MAXLEN - 150 ? input.value.length + ' / ' + MAXLEN : ''; });

    (async function start() {
      clear(list).appendChild(el('div', { class: 'pc-muted' }, 'Loading\u2026')); drawComposer();
      try { var g = await sb().auth.getUser(); uid = g && g.data && g.data.user ? g.data.user.id : null; } catch (e) { }
      await loadRooms(false); loadMuted();
      timer = setInterval(function () { tick(false); }, POLL_MS); document.addEventListener('visibilitychange', onVis);
    })();
    return root;
  }

  // admin panel screen
  window.photonAdminChat = function (view) { clear(view); view.appendChild(build({ staff: true })); };

  // student space (students) and teacher desk (teachers)
  function findCard(h) { var root = document.getElementById('ss-root'); if (!root) return null; var hs = root.querySelectorAll('h2'); for (var i = 0; i < hs.length; i++) if (hs[i].textContent.trim() === h) return hs[i].closest('.card'); return null; }
  function inject() {
    var root = document.getElementById('ss-root'); if (!root || !sb() || root.querySelector('#pc-chat')) return;
    var sn = findCard('Special notes');
    if (sn) { (sn.closest('.cols2') || sn).after(build({ staff: false })); return; }
    var tn = findCard('Add a special note');
    if (tn) (tn.closest('.cols2') || tn).after(build({ staff: true }));
  }
  function start() { var root = document.getElementById('ss-root'); if (!root) return; if (window.PhotonUI && window.PhotonUI.onMount) window.PhotonUI.onMount(inject); inject(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
