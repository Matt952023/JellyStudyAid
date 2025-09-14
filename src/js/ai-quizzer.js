// js/ai-quizzer.js
(() => {
  // --- Singleton guard (prevents double init that can cause duplicate UI) ---
  if (window.__AI_QUIZZER_INIT__) return;
  window.__AI_QUIZZER_INIT__ = true;

  // --- If something (hot-reload, etc.) duplicated the panel, keep the first and remove the rest ---
  const allPanels = document.querySelectorAll('#ai-quizzer');
  allPanels.forEach((el, i) => { if (i > 0) el.remove(); });

  const quizzerEl = document.getElementById('ai-quizzer');
  if (!quizzerEl) return;

  // --- Inject minimal CSS so you get fixes immediately (move to styles.css later if you want) ---
  const style = document.createElement('style');
  style.textContent = `
  /* Remove native bottom-right resizer */
  #ai-quizzer { resize: none !important; }

  /* Minimized state: header-only height and hidden body */
  #ai-quizzer.is-minimized { height: var(--quizzer-header-min) !important; }
  #ai-quizzer.is-minimized .quizzer-body { display: none !important; }

  /* Top-left custom resizer: a small square slightly outside the corner ("cut off" look) */
  #ai-quizzer .quizzer-resize-tl{
    position:absolute; top:0; left:0; width:12px; height:12px;
    background:#cbd5e1; border-bottom-right-radius:4px; cursor:nwse-resize;
    transform: translate(-2px, -2px);
    box-shadow: 0 0 0 1px rgba(0,0,0,.08) inset;
    z-index: 2; /* above header bg but tiny so it won't cover header text */
  }

  /* Submit button polish to match "Quiz Me" */
  #ai-quizzer .quizzer-submit{
    padding:.45rem .7rem; border:none; border-radius:8px; font-weight:600; cursor:pointer;
    background:#2563eb; color:#fff;
  }
  #ai-quizzer .quizzer-submit:hover{ background:#1d4ed8; }
  `;
  document.head.appendChild(style);

  // --- Elements
  const headerEl  = quizzerEl.querySelector('.quizzer-header');
  const bodyEl    = quizzerEl.querySelector('.quizzer-body');
  const minBtn    = document.getElementById('quizzer-min');
  const resizerTL = quizzerEl.querySelector('.quizzer-resize-tl');

  const quizMeBtn   = document.getElementById('quiz-me-btn');
  const exportBtn   = document.getElementById('export-quiz-btn');
  const quizList    = document.getElementById('quiz-list');
  const quizStatus  = document.getElementById('quizzer-status');
  const answersBox  = document.getElementById('quiz-answers');

  // --- Keep header height in a CSS var so minimized height equals header height ---
  function setHeaderMinHeight() {
    if (!quizzerEl || !headerEl) return;
    const h = headerEl.getBoundingClientRect().height;
    quizzerEl.style.setProperty('--quizzer-header-min', `${Math.ceil(h)}px`);
  }
  setHeaderMinHeight();
  window.addEventListener('resize', setHeaderMinHeight);

  // --- Minimize toggle (works with injected CSS rules above) ---
  minBtn?.addEventListener('click', () => {
    quizzerEl.classList.toggle('is-minimized');
  });

  // --- Custom top-left resizing (drag the small square) ---
  if (resizerTL) {
    let startX = 0, startY = 0, startW = 0, startH = 0;

    const MIN_W = 280; // matches your CSS min-width
    const MIN_H = 60;  // at least header height; will be clamped below

    function onDrag(e) {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const newW = Math.max(MIN_W, startW - dx);
      const newH = Math.max(Math.max(MIN_H, headerEl?.offsetHeight || MIN_H), startH - dy);
      quizzerEl.style.width  = `${newW}px`;
      quizzerEl.style.height = `${newH}px`;
    }
    function onStop() {
      document.removeEventListener('mousemove', onDrag);
      document.removeEventListener('mouseup', onStop);
    }

    resizerTL.addEventListener('mousedown', (e) => {
      e.preventDefault();
      // Do nothing if minimized
      if (quizzerEl.classList.contains('is-minimized')) return;
      startX = e.clientX;
      startY = e.clientY;
      startW = quizzerEl.offsetWidth;
      startH = quizzerEl.offsetHeight;
      document.addEventListener('mousemove', onDrag);
      document.addEventListener('mouseup', onStop);
    });
  }

  // --- Quiz functionality (with safer "no notes" path) ---
  const API = 'http://localhost:3001'; // use '' if serving from same FastAPI app:contentReference[oaicite:1]{index=1}

  function getNotesText() {
    const el = document.getElementById('np-editor');
    if (!el) return '';
    return (el.innerText || el.textContent || '').replace(/\u00A0/g, ' ').trim();
  }

  let lastQuiz = null; // { questions: string[], notesHash: string }

  quizMeBtn?.addEventListener('click', async () => {
    const notes = getNotesText();
    const words = (notes.match(/\S+/g) || []).length;

    // Fix: previously referenced "data" before it existed when no notes were present:contentReference[oaicite:2]{index=2}
    if (!words) {
      quizStatus.textContent = 'No notes detected in Notes.';
      quizList.innerHTML = '';
      lastQuiz = { questions: [], notesHash: simpleHash(notes) };
      answersBox.value = '';
      if (exportBtn) exportBtn.disabled = true;
      return;
    }

    const n = decideNumQuestions(notes);
    quizStatus.textContent = `Generating ${n} question(s)…`;
    if (quizMeBtn) quizMeBtn.disabled = true;

    try {
      const sampled = sampleNoteChunks(notes, 6);
      const res = await fetch(`${API}/api/quiz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: sampled, n })
      });

      if (!res.ok) {
        const t = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} ${res.statusText} ${t.slice(0, 200)}`);
      }

      const data = await res.json();
      if (!Array.isArray(data.questions)) {
        throw new Error('Bad JSON: questions missing');
      }

      lastQuiz = { questions: data.questions, notesHash: simpleHash(notes) };
      quizList.innerHTML = data.questions
        .map(q => `<li>${escapeHtml(q)}</li>`)
        .join('');
      quizStatus.textContent = data.error ? `Ready (${data.error})` : `Ready`;
      if (exportBtn) exportBtn.disabled = data.questions.length === 0;
    } catch (e) {
      console.error(e);
      quizStatus.textContent = `Failed: ${e.message}`;
      if (exportBtn) exportBtn.disabled = true;
    } finally {
      if (quizMeBtn) quizMeBtn.disabled = false;
    }
  });

  exportBtn?.addEventListener('click', () => {
    if (!lastQuiz) return;
    const answers = answersBox?.value || '';
    const blob = new Blob(
      [formatExport(lastQuiz.questions, answers)],
      { type: 'text/plain;charset=utf-8' }
    );
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), {
      href: url,
      download: `quiz_${new Date().toISOString().slice(0,10)}.txt`
    });
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  // --- Helpers ---
  function decideNumQuestions(text) {
    const count = (text.trim().match(/\S+/g) || []).length;
    if (count < 120) return 1;
    if (count < 260) return 2;
    if (count < 420) return 3;
    if (count < 640) return 4;
    return 5;
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }

  function formatExport(questions, answersText) {
    const header = `AI Quizzer Export\nDate: ${new Date().toLocaleString()}\n\n`;
    const q = questions.map((q,i)=>`${i+1}) ${q}`).join('\n');
    const a = (answersText || '').trim() ? `\n\nAnswers:\n${(answersText || '').trim()}\n` : '\n';
    return header + q + a;
  }

  function simpleHash(s) { // non-crypto hash for caching-ish
    let h = 0; for (let i=0;i<s.length;i++) { h = (h*31 + s.charCodeAt(i)) >>> 0; }
    return h.toString(16);
  }

  function sampleNoteChunks(text, n = 6) {
    const parts = text
      .split(/(?<=[.!?])\s+|\n+/)
      .map(s => s.trim())
      .filter(Boolean);
    if (!parts.length) return text;
    const picks = [];
    const step = Math.max(1, Math.floor(parts.length / n));
    for (let i = 0; i < parts.length && picks.length < n; i += step) {
      const end = Math.min(i + step, parts.length);
      const idx = Math.floor((i + end - 1) / 2);
      picks.push(parts[idx]);
    }
    return picks.join(' ').slice(0, 2000);
  }

  // Expose a tiny API for debugging if needed
  window.__aiQuizzer = { getNotesText, el: quizzerEl };
})();
