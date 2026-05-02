async function updateUI(isRecording, isPaused = false) {
  document.getElementById('startBtn').disabled = isRecording;
  document.getElementById('stopBtn').disabled = !isRecording;
  document.getElementById('pauseBtn').disabled = !isRecording;
  document.getElementById('exportHtmlBtn').disabled = isRecording;
  document.getElementById('exportMdBtn').disabled = isRecording;

  const pauseBtn = document.getElementById('pauseBtn');
  pauseBtn.textContent = isPaused ? 'Resume' : 'Pause';
  pauseBtn.classList.toggle('pause-active', isPaused);
}

chrome.storage.local.get(['isRecording', 'isPaused'], (result) => {
  updateUI(result.isRecording || false, result.isPaused || false);
});

document.getElementById('startBtn').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.runtime.sendMessage({ action: 'START_RECORDING', tabId: tab.id });
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

document.getElementById('exportHtmlBtn').addEventListener('click', () => {
  const title = document.getElementById('guideTitle').value;
  chrome.runtime.sendMessage({ action: 'EXPORT_GUIDE', title }, (response) => {
    if (response && response.data) {
      const blob = new Blob([response.data], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'guide.html';
      a.click();
      URL.revokeObjectURL(url);
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
