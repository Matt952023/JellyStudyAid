// notepad.js
(() => {
  const STORAGE_KEY = 'studyhub.notepad.v1';  // stores HTML so formatting persists
  const editor = document.getElementById('np-editor');
  const statusEl = document.getElementById('np-status');
  const countsEl = document.getElementById('np-counts');

  // Toolbar buttons
  const toolbar = document.querySelector('.np-toolbar');
  const undoBtn = document.getElementById('np-undo');
  const redoBtn = document.getElementById('np-redo');
  const exportBtn = document.getElementById('np-export');
  const importInput = document.getElementById('np-import');
  const clearBtn = document.getElementById('np-clear');

  // --- Utilities ---
  const now = () => new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  const setStatus = (text) => { statusEl.textContent = text; };

  const updateCounts = () => {
    const text = editor.innerText || '';
    const words = (text.trim().match(/\S+/g) || []).length;
    const chars = text.replace(/\s/g, '').length;
    countsEl.textContent = `${words} words • ${chars} chars`;
  };

  const save = () => {
    localStorage.setItem(STORAGE_KEY, editor.innerHTML);
    setStatus(`Saved ${now()}`);
  };

  const load = () => {
    const html = localStorage.getItem(STORAGE_KEY);
    if (html) editor.innerHTML = html;
    updateCounts();
    setStatus('Loaded');
    // place caret at end on first load
    placeCaretAtEnd(editor);
  };

  // Robust block formatting for headings/paragraphs
  function applyBlock(tagName) {
    // tagName expected like 'P','H1'...'H6'
    editor.focus();

    // Try formatBlock (most browsers)
    let ok = document.execCommand('formatBlock', false, tagName);

    // Some engines prefer values like '<H1>'
    if (!ok) ok = document.execCommand('formatBlock', false, `<${tagName}>`);

    // Fallback: wrap current block manually if selection is collapsed
    if (!ok) {
        const sel = window.getSelection();
        if (!sel.rangeCount) return;
        const range = sel.getRangeAt(0);
        const block = (function getBlock(n) {
        const BLOCKS = ['P','DIV','LI','H1','H2','H3','H4','H5','H6','PRE'];
        let el = n.nodeType === 1 ? n : n.parentElement;
        while (el && el !== editor) {
            if (BLOCKS.includes(el.tagName)) return el;
            el = el.parentElement;
        }
        return null;
        })(range.startContainer);

        if (block && block !== editor) {
        const wrapper = document.createElement(tagName);
        // Move children into wrapper
        while (block.firstChild) wrapper.appendChild(block.firstChild);
        block.parentNode.replaceChild(wrapper, block);

        // Restore caret at end of new block
        const r = document.createRange();
        r.selectNodeContents(wrapper);
        r.collapse(false);
        sel.removeAllRanges();
        sel.addRange(r);
        ok = true;
        }
    }

    if (ok) {
        queueSave();
        updateCounts();
    }
  }

  const formatSelect = document.getElementById('np-format-block');
    if (formatSelect) {
    formatSelect.addEventListener('change', () => {
        const val = formatSelect.value; // 'p', 'h1'..'h6'
        applyBlock(val.toUpperCase());
    });
  }


  function placeCaretAtEnd(el) {
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function getClosestBlock(node) {
    // Return the nearest block element inside #np-editor
    const BLOCKS = ['P','DIV','LI','H1','H2','H3','H4','H5','H6','PRE'];
    let el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    while (el && el !== editor) {
        if (BLOCKS.includes(el.tagName)) return el;
        el = el.parentElement;
    }
    return editor; // fallback
  }

  function caretInfoWithinBlock() {
    const sel = window.getSelection();
    if (!sel.rangeCount) return null;
    const range = sel.getRangeAt(0);
    const block = getClosestBlock(range.startContainer);
    // Build a range from block start to caret to measure text before caret
    const r0 = document.createRange();
    r0.selectNodeContents(block);
    r0.setEnd(range.startContainer, range.startOffset);
    const pre = r0.toString(); // respects visible text (with pre-wrap we keep spaces)
    return { block, preText: pre };
  }

  function insertPlainText(text) {
  // Try the modern way first
    const ok = document.execCommand('insertText', false, text);
    if (!ok) {
        // Fallback: manual range insertion
        const sel = window.getSelection();
        if (!sel.rangeCount) return;
        const range = sel.getRangeAt(0);
        range.deleteContents();
        range.insertNode(document.createTextNode(text));
        // Move caret to after inserted text
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
    }
  }

  // Debounced autosave
  let saveTimer;
  const queueSave = () => {
    setStatus('Saving…');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 400);
  };

  // --- Formatting via document.execCommand (simple & supported) ---
  toolbar.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-cmd]');
    if (!btn) return;
    const cmd = btn.dataset.cmd;
    editor.focus();
    document.execCommand(cmd, false, null);
    queueSave();
    updateCounts();
  });

  // Undo / Redo
  undoBtn.addEventListener('click', () => { document.execCommand('undo'); queueSave(); updateCounts(); });
  redoBtn.addEventListener('click', () => { document.execCommand('redo'); queueSave(); updateCounts(); });

  // Typing updates counts + autosave
  editor.addEventListener('input', () => {
    updateCounts();
    queueSave();
  });

  // Keyboard shortcuts: Ctrl/Cmd+B/I/U
  // Single unified key handler: Bold/Italic/Underline, Headings, Tab indent/unindent
  editor.addEventListener('keydown', (e) => {
    const meta = e.ctrlKey || e.metaKey;

    // --- 1) Tab / Shift+Tab: 4-space indent ---
    if (e.key === 'Tab') {
        e.preventDefault();

        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return;
        const range = sel.getRangeAt(0);

        // Simple case: collapsed caret + plain indent
        if (!e.shiftKey && sel.isCollapsed) {
        insertPlainText('    ');      // requires your existing helper
        queueSave();
        updateCounts();
        return;
        }

        // Multi-line indent or unindent
        const startBlock = getClosestBlock(range.startContainer); // requires your helper
        const endBlock   = getClosestBlock(range.endContainer);

        // Collect affected blocks
        const blocks = [];
        let cursor = startBlock;
        while (cursor) {
        blocks.push(cursor);
        if (cursor === endBlock) break;

        // Find next sibling block within editor
        const nextBlock = (() => {
            if (cursor.nextSibling) {
            return cursor.nextSibling.nodeType === 1
                    ? cursor.nextSibling
                    : cursor.nextSibling.nextElementSibling;
            }
            let p = cursor.parentElement;
            while (p && p !== editor && !p.nextElementSibling) p = p.parentElement;
            if (!p || p === editor) return null;
            return p.nextElementSibling;
        })();

        cursor = nextBlock;
        while (cursor && cursor.nodeType !== 1) cursor = cursor.nextSibling;
        if (cursor && !editor.contains(cursor)) break;
        }

        // Apply indent/unindent to each block
        blocks.forEach(block => {
        // Work on the first text node in the block
        const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, null);
        const tn = walker.nextNode();
        if (!tn) return;

        if (e.shiftKey) {
            // UNINDENT: remove up to 4 leading spaces
            const remove = (tn.nodeValue.match(/^ {1,4}/)?.[0]?.length) || 0;
            if (remove > 0) tn.nodeValue = tn.nodeValue.slice(remove);
        } else {
            // INDENT: add 4 spaces
            tn.nodeValue = '    ' + tn.nodeValue;
        }
        });

        queueSave();
        updateCounts();
        return; // don't fall through to meta-handling
    }

    // --- 2) Formatting shortcuts when Ctrl/Cmd is held ---
    if (meta) {
        const k = e.key.toLowerCase();

        // Bold / Italic / Underline
        if (k === 'b' || k === 'i' || k === 'u') {
        e.preventDefault();
        const map = { b: 'bold', i: 'italic', u: 'underline' };
        document.execCommand(map[k]);
        queueSave();
        updateCounts();
        return;
        }

        // Headers: Ctrl/Cmd+1..6 -> H1..H6, Ctrl/Cmd+0 -> Paragraph
        if (k === '0') {
        e.preventDefault();
        applyBlock('P');        // uses your applyBlock() from previous step
        return;
        }
        if (/^[1-6]$/.test(k)) {
        e.preventDefault();
        applyBlock(`H${k}`);    // uses your applyBlock()
        return;
        }
    }
  }, true); // (capture=true helps win over browser defaults in some cases



  // Export to .txt (plain text) – keeps it simple for sharing
  exportBtn.addEventListener('click', () => {
    const blob = new Blob([editor.innerText], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `JellyVerse-Notes-${new Date().toISOString().slice(0,10)}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  // Import .txt or .html
  importInput.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    if (file.name.endsWith('.html')) {
      editor.innerHTML = text;
    } else {
      // Wrap plain text in <p> lines for nicer editing
      const safe = text
        .split(/\r?\n/)
        .map(line => line ? `<p>${escapeHtml(line)}</p>` : '<p><br></p>')
        .join('');
      editor.innerHTML = safe;
    }
    updateCounts();
    save();
    e.target.value = '';
  });

  // Clear
  clearBtn.addEventListener('click', () => {
    if (!confirm('Clear all notes? This cannot be undone.')) return;
    editor.innerHTML = '';
    updateCounts();
    save();
  });

  function escapeHtml(s) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return s.replace(/[&<>"']/g, m => map[m]);
  }

  // Init
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') save();
  });
  window.addEventListener('beforeunload', save);
  load();
})();
