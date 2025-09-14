// timer.js (hardened)
(() => {
  const init = () => {
    const root = document.getElementById('timer-widget');
    if (!root) return; // timer not on this page

    const progressEl = root.querySelector('.tw-progress');
    const timeEl     = root.querySelector('#tw-time');
    const btnStart   = root.querySelector('#tw-start');
    const btnPause   = root.querySelector('#tw-pause');
    const btnReset   = root.querySelector('#tw-reset');
    const btnGear    = root.querySelector('.tw-settings');

    // Dialog (optional)
    const dlg        = document.getElementById('tw-dialog') || null;
    const form       = document.getElementById('tw-form') || null;
    const inMin      = document.getElementById('tw-min') || null;
    const inSec      = document.getElementById('tw-sec') || null;
    const presetWrap = dlg?.querySelector?.('.tw-presets') || null;

    // Helpers
    const on = (el, ev, fn) => el && el.addEventListener(ev, fn);

    // Ring math
    const R = 52;
    const C = 2 * Math.PI * R;
    if (progressEl) {
      progressEl.style.strokeDasharray = `${C} ${C}`;
    }
    const setProgress = (ratio) => {
      if (!progressEl) return;
      const clamped = Math.max(0, Math.min(1, ratio));
      progressEl.style.strokeDashoffset = C * (1 - clamped);
    };

    // State
    let totalMs     = 25 * 60 * 1000;
    let remainingMs = totalMs;
    let ticking     = false;
    let rafId       = null;
    let lastTs      = null;

    const saved = localStorage.getItem('timer.durationMs');
    if (saved) {
      const n = parseInt(saved, 10);
      if (!Number.isNaN(n) && n > 0) {
        totalMs = n;
        remainingMs = totalMs;
      }
    }
    render();

    // Listeners (safe)
    on(btnStart, 'click', start);
    on(btnPause, 'click', pause);
    on(btnReset, 'click', reset);
    on(btnGear,  'click', openDialog);
    on(presetWrap, 'click', (e) => {
      if (!(e.target instanceof HTMLButtonElement)) return;
      e.preventDefault();
      const seconds = parseInt(e.target.dataset.preset || '0', 10);
      if (!Number.isNaN(seconds) && seconds > 0) {
        applyNewDuration(seconds * 1000);
        dlg?.close?.();
      }
    });
    on(form, 'submit', (e) => {
      e.preventDefault();
      const m = Math.max(0, parseInt(inMin?.value || '0', 10));
      const s = Math.max(0, Math.min(59, parseInt(inSec?.value || '0', 10)));
      applyNewDuration((m * 60 + s) * 1000);
      dlg?.close?.();
    });

    // Core
    function start() {
      if (ticking) return;
      if (remainingMs <= 0) remainingMs = totalMs;
      ticking = true;
      lastTs = performance.now();
      tick();
    }
    function pause() {
      ticking = false;
      if (rafId) cancelAnimationFrame(rafId);
    }
    function reset() {
      ticking = false;
      if (rafId) cancelAnimationFrame(rafId);
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
        root.animate(
          [{ transform: 'scale(1)' }, { transform: 'scale(1.05)' }, { transform: 'scale(1)' }],
          { duration: 500 }
        );
        return;
      }
      render();
      rafId = requestAnimationFrame(tick);
    }

    function render() {
      const mm = Math.floor(remainingMs / 60000);
      const ss = Math.floor((remainingMs % 60000) / 1000);
      if (timeEl) timeEl.textContent = `${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
      if (totalMs > 0) setProgress(remainingMs / totalMs);
    }

    function applyNewDuration(ms) {
      totalMs = Math.max(1000, ms);
      localStorage.setItem('timer.durationMs', String(totalMs));
      remainingMs = totalMs;
      render();
    }

    function openDialog() {
      if (!dlg) return;
      if (inMin) inMin.value = String(Math.floor(totalMs / 60000));
      if (inSec) inSec.value = String(Math.floor((totalMs % 60000) / 1000));
      if (typeof dlg.showModal === 'function') dlg.showModal();
    }

    // Sound
    function chime({ repeats = 3, interval = 0.8 } = {}) {
      // Reuse a single AudioContext (avoids creating too many)
      const ctx = window.__timerAudioCtx || new (window.AudioContext || window.webkitAudioContext)();
      window.__timerAudioCtx = ctx;

      const mkBeep = (t0, freq, dur, gain = 0.22, type = 'sine') => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, t0);

        // Smooth attack/decay envelope (no clicks)
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

        o.connect(g).connect(ctx.destination);
        o.start(t0);
        o.stop(t0 + dur);
      };

      const now = ctx.currentTime + 0.05; // tiny scheduling offset

      for (let i = 0; i < repeats; i++) {
        const t = now + i * interval;

        // Two-note chime per ring (slightly longer than your original)
        // "ding"
        mkBeep(t,        1046.5, 0.35, 0.25, 'sine'); // C6
        // "dong"
        mkBeep(t + 0.16, 784.0,  0.55, 0.22, 'sine'); // G5
      }
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
