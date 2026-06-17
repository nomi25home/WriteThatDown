let recording = false;
let recordingIndicator = null;
const focusValues = new WeakMap(); // tracks value on focus so we can detect changes

function createRecordingIndicator() {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes wtd-dot-pulse {
      0%, 100% { opacity: 1; }
      50%       { opacity: 0.3; }
    }
    @keyframes wtd-fade-in {
      from { opacity: 0; transform: translateY(-8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    #writethatdown-recording-indicator {
      animation: wtd-fade-in 0.3s ease-out forwards;
    }
    #writethatdown-recording-indicator .wtd-dot {
      animation: wtd-dot-pulse 1.2s ease-in-out infinite;
    }
  `;
  document.head.appendChild(style);

  const indicator = document.createElement('div');
  indicator.id = 'writethatdown-recording-indicator';
  indicator.innerHTML = `
    <div class="wtd-dot" style="
      width: 8px; height: 8px; border-radius: 50%;
      background: #e53e3e; flex-shrink: 0;
    "></div>
    <span style="
      font-size: 12px; font-weight: 700; letter-spacing: 0.02em;
      color: #fff; white-space: nowrap;
    ">✍️ Writing it down…</span>
  `;
  indicator.style.cssText = `
    position: fixed; top: 16px; right: 16px;
    display: flex; align-items: center; gap: 8px;
    background: rgba(20, 20, 20, 0.88);
    backdrop-filter: blur(6px);
    border: 1px solid rgba(229, 62, 62, 0.5);
    border-radius: 20px;
    padding: 6px 14px 6px 10px;
    z-index: 1000000; pointer-events: none;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  `;

  document.body.appendChild(indicator);
  return indicator;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'START_CAPTURE') {
    recording = true;
    if (!recordingIndicator) {
      recordingIndicator = createRecordingIndicator();
    }
    // Pre-seed focusValues for any field already focused when recording starts
    const active = document.activeElement;
    if (active && (isTypeable(active) || isPasswordField(active))) {
      focusValues.set(active, active.value ?? active.innerText ?? '');
    }
  } else if (message.action === 'STOP_CAPTURE') {
    recording = false;
    if (recordingIndicator) {
      recordingIndicator.remove();
      recordingIndicator = null;
    }
    console.log('Content script: capture stopped');
  } else if (message.action === 'HIDE_INDICATOR') {
    if (recordingIndicator) recordingIndicator.style.display = 'none';
    sendResponse({});
  } else if (message.action === 'SHOW_INDICATOR') {
    if (recordingIndicator) recordingIndicator.style.display = '';
    sendResponse({});
  }
});

document.addEventListener('click', (e) => {
  if (!recording) return;

  showClickHighlight(e.target);

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

  // Hide the indicator, wait for the browser to repaint, then capture
  if (recordingIndicator) recordingIndicator.style.display = 'none';
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      chrome.runtime.sendMessage({ action: 'CAPTURE_EVENT', event: eventData }, () => {
        if (recordingIndicator) recordingIndicator.style.display = '';
      });
    });
  });
}, true);

// Remember the value when focus enters a typeable field
document.addEventListener('focus', (e) => {
  if (!recording) return;
  const el = e.target;
  if (isTypeable(el)) focusValues.set(el, el.value ?? el.innerText ?? '');
}, true);

// When focus leaves, if the value changed emit a single "type" event
document.addEventListener('blur', (e) => {
  if (!recording) return;
  const el = e.target;

  // C2 fix: for password fields, record interaction but never the value
  if (isPasswordField(el)) {
    const label = el.getAttribute('placeholder') || el.getAttribute('aria-label')
      || el.getAttribute('name') || el.id || 'password field';
    chrome.runtime.sendMessage({
      action: 'CAPTURE_EVENT',
      event: { type: 'type', text: '[password]', fieldLabel: label }
    });
    return;
  }

  if (!isTypeable(el)) return;
  const before = focusValues.get(el) ?? '';
  const after  = el.value ?? el.innerText ?? '';
  if (after.trim() && after !== before) {
    const label = el.getAttribute('placeholder')
      || el.getAttribute('aria-label')
      || el.getAttribute('name')
      || el.id
      || null;
    chrome.runtime.sendMessage({
      action: 'CAPTURE_EVENT',
      event: { type: 'type', text: after.trim().substring(0, 200), fieldLabel: label }
    });
  }
}, true);

function isTypeable(el) {
  const tag = el.tagName?.toLowerCase();
  if (tag === 'textarea') return true;
  if (tag === 'input') {
    const t = (el.type || 'text').toLowerCase();
    // C2 fix: never capture password field values
    return ['text','email','search','url','number','tel'].includes(t);
  }
  return el.isContentEditable;
}

function isPasswordField(el) {
  return el.tagName?.toLowerCase() === 'input' && el.type?.toLowerCase() === 'password';
}

function showClickHighlight(element) {
  const rect = element.getBoundingClientRect();

  // Fallback to a small square at center if element has no dimensions
  const width = Math.max(rect.width, 30);
  const height = Math.max(rect.height, 30);
  const left = rect.left + (rect.width - width) / 2;
  const top = rect.top + (rect.height - height) / 2;

  const highlight = document.createElement('div');
  highlight.style.cssText = `
    position: fixed;
    left: ${left}px;
    top: ${top}px;
    width: ${width}px;
    height: ${height}px;
    border: 3px solid #e53e3e;
    border-radius: 4px;
    background: rgba(229, 62, 62, 0.1);
    pointer-events: none;
    z-index: 999999;
    box-sizing: border-box;
    transition: opacity 0.4s ease-out;
  `;
  document.body.appendChild(highlight);

  requestAnimationFrame(() => {
    setTimeout(() => {
      highlight.style.opacity = '0';
      setTimeout(() => highlight.remove(), 400);
    }, 300);
  });
}

function getXPath(element) {
  // M4 fix: escape quotes in id to prevent malformed XPath
  if (element.id !== '') return `id("${element.id.replace(/"/g, '&quot;')}")`;
  if (element === document.body) return element.tagName;

  let ix = 0;
  const siblings = element.parentNode.childNodes;
  for (let i = 0; i < siblings.length; i++) {
    const sibling = siblings[i];
    if (sibling === element) return `${getXPath(element.parentNode)}/${element.tagName}[${ix + 1}]`;
    if (sibling.nodeType === 1 && sibling.tagName === element.tagName) ix++;
  }
}
