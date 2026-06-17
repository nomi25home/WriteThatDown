// Guard: if the script was already injected (manifest + executeScript), skip
// re-registering all event listeners to avoid duplicates.
if (window.__wtdActive) {
  // Already running — just ensure the message listener is live (it is).
  // Nothing else to do; the existing instance handles everything.
} else {
window.__wtdActive = true;

let recording = false;
let recordingIndicator = null;
const focusValues   = new WeakMap(); // baseline value at first focus
const inputSnapshot = new WeakMap(); // most recent value seen via input event

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
    position: fixed; bottom: 20px; right: 20px;
    display: flex; align-items: center; gap: 7px;
    background: rgba(20, 20, 20, 0.82);
    backdrop-filter: blur(6px);
    border: 1px solid rgba(229, 62, 62, 0.45);
    border-radius: 20px;
    padding: 5px 12px 5px 9px;
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
      focusValues.set(active, currentValue(active));
    }
  } else if (message.action === 'STOP_CAPTURE') {
    recording = false;
    if (recordingIndicator) {
      recordingIndicator.remove();
      recordingIndicator = null;
    }
  } else if (message.action === 'HIDE_INDICATOR') {
    if (recordingIndicator) recordingIndicator.style.display = 'none';
    sendResponse({});
  } else if (message.action === 'SHOW_INDICATOR') {
    if (recordingIndicator) recordingIndicator.style.display = '';
    sendResponse({});
  }
});

// Flush any in-progress typing when the user mousedowns on a different element.
// mousedown fires BEFORE blur (and before our click handler), so without this
// flush the blur event can race the service-worker queue and the first typed
// field in a session is occasionally dropped.
document.addEventListener('mousedown', (e) => {
  if (!recording) return;
  const focused = document.activeElement;
  // Skip if clicking within the same field (includes contentEditable children)
  if (!focused || focused.contains(e.target) || focused === document.body) return;
  if (!isTypeable(focused)) return;
  const before = focusValues.get(focused) ?? '';
  const after  = currentValue(focused);
  if (after.trim() && after !== before) {
    const label = focused.getAttribute('placeholder')
      || focused.getAttribute('aria-label')
      || focused.getAttribute('name')
      || focused.id || null;
    chrome.runtime.sendMessage({
      action: 'CAPTURE_EVENT',
      event: { type: 'type', text: after.trim().substring(0, 200), fieldLabel: label }
    });
    focusValues.set(focused, after);
  }
}, true);

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

// Remember the value when focus enters a typeable field.
// Only seed on the FIRST focus per element per session — re-focusing (e.g.
// after alt-tab) must not overwrite the baseline or the change goes undetected.
document.addEventListener('focus', (e) => {
  if (!recording) return;
  const el = e.target;
  if (isTypeable(el) && !focusValues.has(el)) {
    focusValues.set(el, currentValue(el));
  }
}, true);

// Track every keystroke so we always have the real value, even for
// React/Draft.js/Slate fields where el.value can lag at blur time.
document.addEventListener('input', (e) => {
  if (!recording) return;
  const el = e.target;
  if (isTypeable(el)) inputSnapshot.set(el, currentValue(el));
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
  const after  = currentValue(el);
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
    // Advance baseline so a second visit to the same field only captures new text
    focusValues.set(el, after);
  }
}, true);

// Best available current value for a field: prefer the snapshot from the last
// input event (always fresh), fall back to the DOM property.
function currentValue(el) {
  return inputSnapshot.get(el) ?? el.value ?? el.innerText ?? '';
}

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
  if (element.id !== '') {
    const id = element.id;
    // XPath 1.0 has no escape sequence; choose delimiter based on content
    if (!id.includes('"'))  return `id("${id}")`;
    if (!id.includes("'"))  return `id('${id}')`;
    // Both quote types present: use concat() to build the string safely
    const parts = id.split('"').map(p => `"${p}"`).join(`,"'"`,);
    return `id(concat(${parts}))`;
  }
  if (element === document.body) return element.tagName;

  let ix = 0;
  const siblings = element.parentNode.childNodes;
  for (let i = 0; i < siblings.length; i++) {
    const sibling = siblings[i];
    if (sibling === element) return `${getXPath(element.parentNode)}/${element.tagName}[${ix + 1}]`;
    if (sibling.nodeType === 1 && sibling.tagName === element.tagName) ix++;
  }
}

} // end window.__wtdActive guard
