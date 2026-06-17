async function updateUI(isRecording, isPaused = false) {
  document.getElementById('startBtn').disabled = isRecording;
  document.getElementById('stopBtn').disabled = !isRecording;
  document.getElementById('pauseBtn').disabled = !isRecording;
  document.getElementById('editBtn').disabled = isRecording;
  document.getElementById('exportPdfBtn').disabled = isRecording;
  document.getElementById('exportMdBtn').disabled = isRecording;
  document.getElementById('copyClipboardBtn').disabled = isRecording;

  const pauseBtn = document.getElementById('pauseBtn');
  pauseBtn.textContent = isPaused ? 'Resume' : 'Pause';
  pauseBtn.classList.toggle('pause-active', isPaused);
}

chrome.storage.local.get(['isRecording', 'isPaused'], (result) => {
  updateUI(result.isRecording || false, result.isPaused || false);
});

document.getElementById('startBtn').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const title = document.getElementById('guideTitle').value.trim();
  chrome.storage.local.set({ guideTitle: title || 'User Guide' }, () => {
    chrome.runtime.sendMessage({ action: 'START_RECORDING', tabId: tab.id });
  });
  updateUI(true);
});

document.getElementById('stopBtn').addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'STOP_RECORDING' });
  updateUI(false);
});

document.getElementById('pauseBtn').addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'TOGGLE_PAUSE' }, (response) => {
    if (response && response.isPaused !== undefined) {
      updateUI(true, response.isPaused);
    }
  });
});

document.getElementById('editBtn').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('src/editor/editor.html') });
});

document.getElementById('exportPdfBtn').addEventListener('click', () => {
  const title = document.getElementById('guideTitle').value || 'User Guide';
  chrome.storage.local.set({ pdfTitle: title }, () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/pdf/print.html') });
  });
});

document.getElementById('copyClipboardBtn').addEventListener('click', async () => {
  const btn = document.getElementById('copyClipboardBtn');
  const title = document.getElementById('guideTitle').value;

  chrome.runtime.sendMessage({ action: 'COPY_GUIDE', title }, async (response) => {
    if (response && response.data) {
      try {
        const blobHtml = new Blob([response.data], { type: 'text/html' });
        // M3 fix: use DOMParser instead of regex to extract safe plaintext
        const doc = new DOMParser().parseFromString(response.data, 'text/html');
        const blobText = new Blob([doc.body.innerText || ''], { type: 'text/plain' });

        await navigator.clipboard.write([
          new ClipboardItem({ 'text/html': blobHtml, 'text/plain': blobText })
        ]);

        const original = btn.textContent;
        btn.textContent = 'Copied!';
        btn.style.background = '#22c55e';
        btn.style.color = 'white';
        btn.style.borderColor = '#16a34a';
        setTimeout(() => {
          btn.textContent = original;
          btn.style.background = '';
          btn.style.color = '';
          btn.style.borderColor = '';
        }, 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
        btn.textContent = 'Copy failed';
        setTimeout(() => { btn.textContent = 'Copy to Clipboard'; }, 2000);
      }
    }
  });
});

document.getElementById('exportMdBtn').addEventListener('click', () => {
  const title = document.getElementById('guideTitle').value;
  chrome.runtime.sendMessage({ action: 'EXPORT_MARKDOWN', title }, (response) => {
    if (response && response.data) {
      const blob = new Blob([response.data], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'guide.md';
      a.click();
      URL.revokeObjectURL(url);
    }
  });
});
