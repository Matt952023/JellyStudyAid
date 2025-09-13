(() => {
  // --- Elements
  const root = document.getElementById('timer-widget');
  const progressEl = root.querySelector('.tw-progress');
  const timeEl = document.getElementById('tw-time');
  const btnStart = document.getElementById('tw-start');
  const btnPause = document.getElementById('tw-pause');
  const btnReset = document.getElementById('tw-reset');
  const btnGear = root.querySelector('.tw-settings');
  const dlg = document.getElementById('tw-dialog');
  const form = document.getElementById('tw-form');
  const inMin = document.getElementById('tw-min');
  const inSec = document.getElementById('tw-sec');
  const presetWrap = dlg.querySelector('.tw-presets');

  // --- Ring math
  const R = 52;
  const C = 2 * Math.PI * R;
  progressEl.style.strokeDasharray = `${C} ${C}`;
  const setProgress = (ratio) => {
    const clamped = Math.max(0, Math.min(1, ratio));
    progressEl.style.strokeDashoffset = C * (1 - clamped);
  };

  // --- State
  let totalMs = 25 * 60 * 1000;              // default 25:00
  let remainingMs = totalMs;
  let ticking = false;
  let rafId = null;
  let lastTs = null;

  // Restore last duration if present
  const saved = localStorage.getItem('timer.durationMs');
  if (saved) {
    totalMs = parseInt(saved, 10);
    remainingMs = totalMs;
  }
  render();

  // --- Controls
  btnStart.addEventListener('click', start);
  btnPause.addEventListener('click', pause);
  btnReset.addEventListener('click', reset);
  btnGear.addEventListener('click', openDialog);

  // presets in dialog
  presetWrap.addEventListener('click', (e) => {
    if (!(e.target instanceof HTMLButtonElement)) return;
    e.preventDefault();
    const ms = parseInt(e.target.dataset.preset, 10) * 1000;
    applyNewDuration(ms);
    dlg.close();
  });

  // Save from dialog
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const m = Math.max(0, parseInt(inMin.value || '0', 10));
    const s = Math.max(0, Math.min(59, parseInt(inSec.value || '0', 10)));
    applyNewDuration((m * 60 + s) * 1000);
    dlg.close();
  });

  // Keyboard: T to toggle start/pause; R to reset; G to open dialog
  window.addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (e.key.toLowerCase() === 't') ticking ? pause() : start();
    if (e.key.toLowerCase() === 'r') reset();
    if (e.key.toLowerCase() === 'g') openDialog();
  });

  // --- Core
  function start() {
    if (ticking) return;
    if (remainingMs <= 0) remainingMs = totalMs;
    ticking = true;
    lastTs = performance.now();
    tick();
  }
  function pause() {
    ticking = false;
    cancelAnimationFrame(rafId);
  }
  function reset() {
    ticking = false;
    cancelAnimationFrame(rafId);
    remainingMs = totalMs;
    render();
  }
  function tick(ts) {
    if (!ticking) return;
    const now = ts ?? performance.now();
    const dt = now - lastTs;
    lastTs = now;
    remainingMs -= dt;
    if (remainingMs <= 0) {
      remainingMs = 0;
      render();
      ticking = false;
      chime();
      // quick visual pulse
      root.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.05)' }, { transform: 'scale(1)' }], { duration: 500 });
      return;
    }
    render();
    rafId = requestAnimationFrame(tick);
  }

  function render() {
    const mm = Math.floor(remainingMs / 60000);
    const ss = Math.floor((remainingMs % 60000) / 1000);
    timeEl.textContent = `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
    setProgress(remainingMs / totalMs);
  }

  function applyNewDuration(ms) {
    totalMs = Math.max(1000, ms);
    localStorage.setItem('timer.durationMs', String(totalMs));
    remainingMs = totalMs;
    render();
  }

  function openDialog() {
    inMin.value = String(Math.floor(totalMs / 60000));
    inSec.value = String(Math.floor((totalMs % 60000) / 1000));
    // <dialog> is widely supported; fallback if needed:
    if (typeof dlg.showModal === 'function') dlg.showModal();
    else alert('Enter a new time in mm:ss and click Save.');
  }

  // --- Sound (pure Web Audio, no files)
  function chime() {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    // simple two-beep pattern
    const mkBeep = (t0, freq, dur) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.2, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g).connect(ctx.destination);
      o.start(t0);
      o.stop(t0 + dur);
    };
    const now = ctx.currentTime;
    mkBeep(now, 880, 0.18);
    mkBeep(now + 0.25, 660, 0.22);
  }
})();
