let events = [];
let dragSrcIndex = null;

// ── Load ──────────────────────────────────────────────────────────────────

chrome.storage.local.get(['events', 'guideTitle'], (result) => {
  events = result.events || [];
  if (result.guideTitle) {
    document.getElementById('guideTitle').value = result.guideTitle;
  }
  render();
});

// Reflect storage changes made from another context (e.g. new recording)
chrome.storage.onChanged.addListener((changes) => {
  if (changes.events) {
    events = changes.events.newValue || [];
    render();
  }
});

// ── Render ────────────────────────────────────────────────────────────────

function render() {
  const list = document.getElementById('stepsList');
  const empty = document.getElementById('emptyState');
  const countEl = document.getElementById('stepCount');

  countEl.textContent = events.length ? `${events.length} step${events.length !== 1 ? 's' : ''}` : '';
  list.innerHTML = '';

  if (events.length === 0) {
    empty.style.display = '';
    return;
  }
  empty.style.display = 'none';

  events.forEach((event, index) => {
    const card = document.createElement('div');
    card.className = 'step-card';
    card.draggable = true;
    card.dataset.index = index;

    card.innerHTML = `
      <div class="step-header">
        <span class="drag-handle" title="Drag to reorder">⠿</span>
        <div class="step-num">${index + 1}</div>
        <span style="flex:1;font-size:13px;font-weight:600;color:#555;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
          ${escapeHtml(event.description) || '<em style="color:#bbb">No description</em>'}
        </span>
        <div class="step-actions">
          <button class="btn-icon" data-action="up" title="Move up" ${index === 0 ? 'disabled' : ''}>↑</button>
          <button class="btn-icon" data-action="down" title="Move down" ${index === events.length - 1 ? 'disabled' : ''}>↓</button>
          ${event.screenshot ? `<button class="btn-icon" data-action="redact" title="Redact sensitive info">✏️</button>` : ''}
          <button class="btn-icon btn-danger" data-action="delete" title="Delete step">✕</button>
        </div>
      </div>
      <div class="step-body">
        <div class="step-screenshot">
          ${isSafeScreenshot(event.screenshot)
            ? `<img src="${event.screenshot}" alt="Step ${index + 1}">`
            : `<div class="no-screenshot">No screenshot</div>`}
        </div>
        <div class="step-text-panel">
          <div class="text-label">Step title</div>
          <textarea class="desc-input" rows="2" placeholder="e.g. Click the Submit button">${escapeHtml(event.description)}</textarea>
          <div class="text-divider"></div>
          <div class="text-label">Additional notes</div>
          <textarea class="subdesc-input" rows="4" placeholder="Add context, tips, or warnings for this step…">${escapeHtml(event.subDescription || '')}</textarea>
        </div>
      </div>
    `;

    // Auto-resize textareas to fit content on initial render
    requestAnimationFrame(() => card.querySelectorAll('textarea').forEach(autoResize));

    // Description edit
    const descEl = card.querySelector('.desc-input');
    descEl.addEventListener('input', (e) => {
      events[index].description = e.target.value;
      // Also update the preview text in the header
      card.querySelector('.step-header span').innerHTML = escapeHtml(e.target.value) || '<em style="color:#bbb">No description</em>';
      autoResize(e.target);
      save();
    });

    // Sub-description edit
    card.querySelector('.subdesc-input').addEventListener('input', (e) => {
      events[index].subDescription = e.target.value;
      autoResize(e.target);
      save();
    });

    // Action buttons
    card.querySelector('[data-action="up"]').addEventListener('click', () => move(index, -1));
    card.querySelector('[data-action="down"]').addEventListener('click', () => move(index, 1));
    card.querySelector('[data-action="delete"]').addEventListener('click', () => deleteStep(index));
    card.querySelector('[data-action="redact"]')?.addEventListener('click', () => openRedact(index));

    // Drag-and-drop
    card.addEventListener('dragstart', onDragStart);
    card.addEventListener('dragover', onDragOver);
    card.addEventListener('dragleave', onDragLeave);
    card.addEventListener('drop', onDrop);
    card.addEventListener('dragend', onDragEnd);

    list.appendChild(card);
  });
}

// ── Edit actions ──────────────────────────────────────────────────────────

function move(index, dir) {
  const target = index + dir;
  if (target < 0 || target >= events.length) return;
  [events[index], events[target]] = [events[target], events[index]];
  save();
  render();
}

function deleteStep(index) {
  events.splice(index, 1);
  save();
  render();
}

// ── Drag-and-drop ─────────────────────────────────────────────────────────

function onDragStart(e) {
  dragSrcIndex = parseInt(e.currentTarget.dataset.index);
  e.currentTarget.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}

function onDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  e.currentTarget.classList.add('drag-over');
}

function onDragLeave(e) {
  e.currentTarget.classList.remove('drag-over');
}

function onDrop(e) {
  e.preventDefault();
  const dropIndex = parseInt(e.currentTarget.dataset.index);
  e.currentTarget.classList.remove('drag-over');
  if (dragSrcIndex === null || dragSrcIndex === dropIndex) return;

  const [moved] = events.splice(dragSrcIndex, 1);
  events.splice(dropIndex, 0, moved);
  save();
  render();
}

function onDragEnd(e) {
  e.currentTarget.classList.remove('dragging');
  dragSrcIndex = null;
}

// ── Persistence ───────────────────────────────────────────────────────────

let saveTimer = null;

function save() {
  clearTimeout(saveTimer);
  setStatus('Saving…', false);
  saveTimer = setTimeout(() => {
    chrome.storage.local.set({ events }, () => {
      setStatus('Saved', true);
      setTimeout(() => setStatus(''), 2000);
    });
  }, 400);
}

function setStatus(text, saved = false) {
  const el = document.getElementById('saveStatus');
  el.textContent = text;
  el.className = 'save-status' + (saved ? ' saved' : '');
}

// ── Title ─────────────────────────────────────────────────────────────────

document.getElementById('guideTitle').addEventListener('input', (e) => {
  chrome.storage.local.set({ guideTitle: e.target.value });
});

// ── Export / Copy ─────────────────────────────────────────────────────────

function getTitle() {
  return document.getElementById('guideTitle').value || 'User Guide';
}

document.getElementById('exportPdfBtn').addEventListener('click', () => {
  chrome.storage.local.set({ pdfTitle: getTitle() }, () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/pdf/print.html') });
  });
});

document.getElementById('exportMdBtn').addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'EXPORT_MARKDOWN', title: getTitle() }, (response) => {
    if (response?.data) download(response.data, 'guide.md', 'text/markdown');
  });
});

document.getElementById('copyBtn').addEventListener('click', async () => {
  const btn = document.getElementById('copyBtn');
  chrome.runtime.sendMessage({ action: 'COPY_GUIDE', title: getTitle() }, async (response) => {
    if (!response?.data) return;
    try {
      const blobHtml = new Blob([response.data], { type: 'text/html' });
      // M3 fix: use DOMParser instead of regex to extract safe plaintext
      const doc = new DOMParser().parseFromString(response.data, 'text/html');
      const blobText = new Blob([doc.body.innerText || ''], { type: 'text/plain' });
      await navigator.clipboard.write([new ClipboardItem({ 'text/html': blobHtml, 'text/plain': blobText })]);
      const orig = btn.textContent;
      btn.textContent = 'Copied!';
      btn.style.background = '#16a34a';
      setTimeout(() => { btn.textContent = orig; btn.style.background = ''; }, 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  });
});

// ── Helpers ───────────────────────────────────────────────────────────────

function download(data, filename, type) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function isSafeScreenshot(url) {
  return typeof url === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(url);
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

// ── Redaction ─────────────────────────────────────────────────────────────

let redactIndex = null;
let redactRects = [];      // committed rects [{x,y,w,h}]
let redactFuture = [];     // redo stack
let redactImg = null;
let drawing = false;
let startX = 0, startY = 0;

const modal    = document.getElementById('redactModal');
const canvas   = document.getElementById('redactCanvas');
const ctx      = canvas.getContext('2d');

function openRedact(index) {
  redactIndex = index;
  redactRects  = [];
  redactFuture = [];

  redactImg = new Image();
  redactImg.onload = () => {
    canvas.width  = redactImg.naturalWidth;
    canvas.height = redactImg.naturalHeight;
    drawCanvas();
    syncUndoRedo();
    modal.classList.add('open');
  };
  redactImg.src = events[index].screenshot;
}

function drawCanvas(preview = null) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(redactImg, 0, 0);

  const all = preview ? [...redactRects, preview] : redactRects;
  for (const r of all) drawRedactBox(r, preview && r === preview);
}

function drawRedactBox(r, isPreview = false) {
  // Black fill
  ctx.fillStyle = isPreview ? 'rgba(0,0,0,0.55)' : '#111';
  ctx.fillRect(r.x, r.y, r.w, r.h);

  // Label: only when box is large enough and not a live preview
  if (!isPreview && r.w > 60 && r.h > 20) {
    const label = '■ REDACTED';
    const fontSize = Math.min(14, r.h * 0.38);
    ctx.font = `bold ${fontSize}px -apple-system, Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2, r.w - 12);
  }
}

function canvasPos(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (canvas.width  / rect.width),
    y: (e.clientY - rect.top)  * (canvas.height / rect.height),
  };
}

function syncUndoRedo() {
  document.getElementById('redactUndoBtn').disabled = redactRects.length === 0;
  document.getElementById('redactRedoBtn').disabled = redactFuture.length === 0;
}

canvas.addEventListener('mousedown', (e) => {
  drawing = true;
  const pos = canvasPos(e);
  startX = pos.x;
  startY = pos.y;
});

canvas.addEventListener('mousemove', (e) => {
  if (!drawing) return;
  const pos = canvasPos(e);
  const w = pos.x - startX, h = pos.y - startY;
  drawCanvas({
    x: w < 0 ? pos.x : startX,
    y: h < 0 ? pos.y : startY,
    w: Math.abs(w), h: Math.abs(h),
  });
});

canvas.addEventListener('mouseup', (e) => {
  if (!drawing) return;
  drawing = false;
  const pos = canvasPos(e);
  const w = pos.x - startX, h = pos.y - startY;
  if (Math.abs(w) > 6 && Math.abs(h) > 6) {
    redactRects.push({
      x: w < 0 ? pos.x : startX,
      y: h < 0 ? pos.y : startY,
      w: Math.abs(w), h: Math.abs(h),
    });
    redactFuture = [];   // new action clears redo stack
  }
  drawCanvas();
  syncUndoRedo();
});

canvas.addEventListener('mouseleave', () => {
  if (drawing) { drawing = false; drawCanvas(); }
});

document.getElementById('redactUndoBtn').addEventListener('click', () => {
  if (!redactRects.length) return;
  redactFuture.push(redactRects.pop());
  drawCanvas();
  syncUndoRedo();
});

document.getElementById('redactRedoBtn').addEventListener('click', () => {
  if (!redactFuture.length) return;
  redactRects.push(redactFuture.pop());
  drawCanvas();
  syncUndoRedo();
});

document.getElementById('redactClearBtn').addEventListener('click', () => {
  redactFuture = [...redactRects.reverse(), ...redactFuture]; // all become redoable
  redactRects = [];
  drawCanvas();
  syncUndoRedo();
});

document.getElementById('redactCancelBtn').addEventListener('click', () => {
  // M1 fix: warn if boxes were drawn but not applied
  if (redactRects.length > 0) {
    if (!confirm('You have unsaved redactions. Cancel anyway? The original screenshot will be kept.')) return;
  }
  closeRedact();
});

document.getElementById('redactApplyBtn').addEventListener('click', () => {
  if (redactRects.length === 0) { closeRedact(); return; }
  events[redactIndex].screenshot = canvas.toDataURL('image/jpeg', 0.85);
  save();
  render();
  closeRedact();
});

function closeRedact() {
  modal.classList.remove('open');
  redactIndex  = null;
  redactRects  = [];
  redactFuture = [];
}

document.addEventListener('keydown', (e) => {
  if (!modal.classList.contains('open')) return;
  if (e.key === 'Escape') { closeRedact(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
    e.preventDefault();
    document.getElementById('redactUndoBtn').click();
  }
  if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
    e.preventDefault();
    document.getElementById('redactRedoBtn').click();
  }
});
