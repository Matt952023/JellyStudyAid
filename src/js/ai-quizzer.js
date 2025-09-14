// ===== AI Quizzer =====
const quizMeBtn = document.getElementById('quiz-me-btn');
const exportBtn = document.getElementById('export-quiz-btn');
const quizList = document.getElementById('quiz-list');
const quizStatus = document.getElementById('quizzer-status');
const answersBox = document.getElementById('quiz-answers');

document.getElementById('quizzer-close').addEventListener('click', () => {
  document.getElementById('ai-quizzer').style.display = 'none';
});
document.getElementById('quizzer-min').addEventListener('click', () => {
  const body = document.querySelector('#ai-quizzer .quizzer-body');
  body.style.display = body.style.display === 'none' ? 'flex' : 'none';
});

// Helper: try to read notes from your notepad (adjust ids if yours differ)
function getNotesText() {
  const candidates = [
    document.getElementById('notepad'),
    document.getElementById('editor'),
    document.querySelector('[data-notepad]'),
  ].filter(Boolean);

  if (!candidates.length) return '';
  const el = candidates[0];
  return el.value != null ? el.value : el.innerText || el.textContent || '';
}

// Decide 1–5 questions based on length (tweak thresholds if you like)
function decideNumQuestions(text) {
  const words = (text.trim().match(/\S+/g) || []).length;
  if (words < 120) return 1;
  if (words < 260) return 2;
  if (words < 420) return 3;
  if (words < 640) return 4;
  return 5;
}

let lastQuiz = null; // { questions: string[], notesHash: string }

quizMeBtn.addEventListener('click', async () => {
  const notes = getNotesText().trim();
  if (!notes) {
    quizStatus.textContent = 'No notes found. Please add notes to your notepad first.';
    quizList.innerHTML = '';
    exportBtn.disabled = true;
    return;
  }

  const n = decideNumQuestions(notes);
  quizStatus.textContent = 'Generating quiz…';
  quizMeBtn.disabled = true;

  try {
    const res = await fetch('/api/quiz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes, n })
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json(); // { questions: [...] }

    if (!Array.isArray(data.questions) || data.questions.length === 0) {
      throw new Error('No questions received');
    }

    quizList.innerHTML = data.questions.map(q => `<li>${escapeHtml(q)}</li>`).join('');
    quizStatus.textContent = `Ready — ${data.questions.length} question(s) generated.`;
    exportBtn.disabled = false;
    lastQuiz = { questions: data.questions, notesHash: simpleHash(notes) };
  } catch (err) {
    console.error(err);
    quizStatus.textContent = 'Could not generate quiz (check backend/API key). Using a local fallback.';
    // Fallback: naive questions made from headings/sentences
    const fallback = fallbackQuestionsFrom(notes, n);
    quizList.innerHTML = fallback.map(q => `<li>${escapeHtml(q)}</li>`).join('');
    exportBtn.disabled = false;
    lastQuiz = { questions: fallback, notesHash: simpleHash(notes) };
  } finally {
    quizMeBtn.disabled = false;
  }
});

exportBtn.addEventListener('click', () => {
  if (!lastQuiz) return;
  const answers = answersBox.value || '';
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

// --- tiny helpers ---
function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function formatExport(questions, answersText) {
  const header = `AI Quizzer Export\nDate: ${new Date().toLocaleString()}\n\n`;
  const q = questions.map((q,i)=>`${i+1}) ${q}`).join('\n');
  const a = answersText.trim() ? `\n\nAnswers:\n${answersText.trim()}\n` : '\n';
  return header + q + a;
}

function simpleHash(s) { // not crypto, just cache-ish
  let h = 0; for (let i=0;i<s.length;i++) { h = (h*31 + s.charCodeAt(i)) >>> 0; }
  return h.toString(16);
}

function fallbackQuestionsFrom(text, n) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const seeds = lines.filter(l => l.length > 10).slice(0, 10);
  const qs = [];
  for (let i=0;i<n;i++) {
    const base = seeds[i % Math.max(1, seeds.length)];
    qs.push(`Explain: ${base.replace(/[:.;]+$/,'')}?`);
  }
  return qs;
}
