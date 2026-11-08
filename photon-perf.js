/* ===================================================================
   Photon Academy - adaptive smoothness ("lite mode" auto-switch)
   Instead of guessing from the phone model, this measures how smoothly the page actually runs
   right after it loads. If it is choppy (under about 30 frames a second) it switches on lite mode
   (no blur glass, no looping animations, no 3D cube) and remembers that for 14 days, so the next
   visit starts smooth straight away. Fast devices are never changed.
   Manual switch: add ?lite=1 (always lite) or ?lite=0 (never lite) to the address.
   =================================================================== */
(function () {
  'use strict';
  var d = document.documentElement, KEY = 'photon-lite-auto', DAYS = 14;
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  if (d.classList.contains('lite') || ls('photon-lite') === '0' || ls('photon-lite') === '1') return;
  if (matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) { d.classList.add('lite'); return; }
  var saved = Number(ls(KEY) || 0);
  if (saved && Date.now() - saved < DAYS * 86400000) { d.classList.add('lite'); return; }
  if (!window.requestAnimationFrame || !window.performance) return;

  var deltas = [], last = 0, started = 0, done = false;
  function frame(t) {
    if (done) return;
    if (document.hidden) { last = 0; return requestAnimationFrame(frame); }
    if (last) { var dt = t - last; if (dt < 400) deltas.push(dt); }   // ignore long gaps (tab switches)
    last = t;
    if (!started) started = t;
    if (t - started < 2500) return requestAnimationFrame(frame);
    finish();
  }
  function finish() {
    done = true;
    if (deltas.length < 20) return;
    deltas.sort(function (a, b) { return a - b; });
    var median = deltas[Math.floor(deltas.length / 2)], p90 = deltas[Math.floor(deltas.length * 0.9)];
    if (median > 34 || p90 > 70) { d.classList.add('lite'); ls(KEY, String(Date.now())); var cube = document.getElementById('ss-cube'); if (cube) cube.textContent = ''; }
  }
  function begin() { setTimeout(function () { requestAnimationFrame(frame); }, 800); }
  if (document.readyState === 'complete') begin(); else window.addEventListener('load', begin);
})();
