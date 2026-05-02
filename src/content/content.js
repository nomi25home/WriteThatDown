let recording = false;
let currentWord = '';
let recordingIndicator = null;

function createRecordingIndicator() {
  const indicator = document.createElement('div');
  indicator.id = 'writethatdown-recording-indicator';
  indicator.style.position = 'fixed';
  indicator.style.top = '20px';
  indicator.style.right = '20px';
  indicator.style.width = '12px';
  indicator.style.height = '12px';
  indicator.style.backgroundColor = 'red';
  indicator.style.borderRadius = '50%';
  indicator.style.zIndex = '1000000';
  indicator.style.boxShadow = '0 0 0 rgba(255, 0, 0, 0.4)';
  indicator.style.pointerEvents = 'none';

  const style = document.createElement('style');
  style.textContent = `
    @keyframes writethatdown-pulse {
      0% { box-shadow: 0 0 0 0px rgba(255, 0, 0, 0.7); }
      70% { box-shadow: 0 0 0 10px rgba(255, 0, 0, 0); }
      100% { box-shadow: 0 0 0 0px rgba(255, 0, 0, 0); }
    }
    #writethatdown-recording-indicator {
      animation: writethatdown-pulse 2s infinite;
    }
  `;
  document.head.appendChild(style);
  document.body.appendChild(indicator);
  return indicator;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'START_CAPTURE') {
    recording = true;
    if (!recordingIndicator) {
      recordingIndicator = createRecordingIndicator();
    }
    console.log('Content script: capture started');
  } else if (message.action === 'STOP_CAPTURE') {
    recording = false;
    if (recordingIndicator) {
      recordingIndicator.remove();
      recordingIndicator = null;
    }
    console.log('Content script: capture stopped');
  }
});

document.addEventListener('click', (e) => {
  if (!recording) return;

  showClickPointer(e.clientX, e.clientY);

    const element = e.target;
    const eventData = {
      type: 'click',
      tagName: element.tagName,
      text: element.innerText?.trim().substring(0, 50),
      ariaLabel: element.getAttribute('aria-label') || element.getAttribute('title'),
      id: element.id,
      className: element.className,
      xpath: getXPath(element),
      x: (e.clientX / window.innerWidth) * 100,
      y: (e.clientY / window.innerHeight) * 100
    };

  chrome.runtime.sendMessage({ action: 'CAPTURE_EVENT', event: eventData });
}, true);

document.addEventListener('keydown', (e) => {
  if (!recording) return;

  if (e.key === ' ') {
    if (currentWord.length > 0) {
      chrome.runtime.sendMessage({ action: 'CAPTURE_EVENT', event: { type: 'word', text: currentWord } });
      currentWord = '';
    }
  } else if (e.key === 'Enter') {
    if (currentWord.length > 0) {
      chrome.runtime.sendMessage({ action: 'CAPTURE_EVENT', event: { type: 'word', text: currentWord } });
      currentWord = '';
    }
  } else if (e.key === 'Backspace') {
    currentWord = currentWord.slice(0, -1);
  } else if (e.key.length === 1) {
    currentWord += e.key;
  }
}, true);

function showClickPointer(x, y) {
  const pointer = document.createElement('div');
  pointer.style.position = 'fixed';
  pointer.style.left = `${x - 5}px`;
  pointer.style.top = `${y - 5}px`;
  pointer.style.width = '10px';
  pointer.style.height = '10px';
  pointer.style.backgroundColor = 'red';
  pointer.style.borderRadius = '50%';
  pointer.style.pointerEvents = 'none';
  pointer.style.zIndex = '999999';
  pointer.style.transition = 'opacity 0.5s ease-out, transform 0.5s ease-out';

  document.body.appendChild(pointer);

  requestAnimationFrame(() => {
    pointer.style.opacity = '0';
    pointer.style.transform = 'scale(2)';
    setTimeout(() => {
      pointer.remove();
    }, 500);
  });
}

function getXPath(element) {
  if (element.id !== '') return `id("${element.id}")`;
  if (element === document.body) return element.tagName;

  let ix = 0;
  let siblings = element.parentNode.childNodes;
  for (let i = 0; i < siblings.length; i++) {
    let sibling = siblings[i];
    if (sibling === element) return `${getXPath(element.parentNode)}/${element.tagName}[${(ix + 1)}]`;
    if (sibling.nodeType === 1 && sibling.tagName === element.tagName) ix++;
  }
}
