import { generateDescription } from './description-generator.js';

let isRecording = false;
let isPaused = false;
let events = [];
let captureQueue = Promise.resolve();

// Restore recording state when the service worker restarts mid-session.
// Chrome can kill the SW after ~30 s of inactivity; without this, any
// CAPTURE_EVENT that wakes the SW sees isRecording=false and is dropped.
chrome.storage.local.get(['isRecording', 'isPaused', 'events'], (result) => {
  if (result.isRecording) {
    isRecording = true;
    isPaused = result.isPaused || false;
    events = result.events || [];
  }
});

// C1 fix: escape all user/page-derived content before injecting into HTML
function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

async function updateStorage() {
  await chrome.storage.local.set({ isRecording, isPaused, events });
}

// H1 fix: only accept messages from this extension's own pages
function isFromExtension(sender) {
  return sender.id === chrome.runtime.id;
}

// H1 fix: only accept CAPTURE_EVENT from a real content-script tab
function isFromContentScript(sender) {
  return sender.id === chrome.runtime.id && !!sender.tab;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'START_RECORDING') {
    if (!isFromExtension(sender)) return;
    isRecording = true;
    isPaused = false;
    events = [];
    captureQueue = Promise.resolve();
    updateStorage();

    const targetTabId = message.tabId;
    if (targetTabId) {
      // Inject (or re-use) the content script, then signal it to start.
      // executeScript is idempotent here because content.js guards against
      // double-registration with window.__wtdActive.
      chrome.scripting.executeScript({
        target: { tabId: targetTabId },
        files: ['src/content/content.js']
      })
      .then(() => {
        chrome.tabs.sendMessage(targetTabId, { action: 'START_CAPTURE' }).catch(() => {});
      })
      .catch(() => {
        // Script may already be present (manifest injection); try sending directly.
        chrome.tabs.sendMessage(targetTabId, { action: 'START_CAPTURE' }).catch(() => {});
      });
    }

  } else if (message.action === 'STOP_RECORDING') {
    if (!isFromExtension(sender)) return;
    isRecording = false;
    isPaused = false;
    updateStorage();
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs?.[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'STOP_CAPTURE' }).catch(() => {});
      }
    });

  } else if (message.action === 'TOGGLE_PAUSE') {
    if (!isFromExtension(sender)) return;
    isPaused = !isPaused;
    updateStorage();
    sendResponse({ isPaused });

  } else if (message.action === 'CAPTURE_EVENT') {
    // H1 fix: must come from a content script in a real tab
    if (!isFromContentScript(sender)) return;

    // respond() is called after the screenshot so the content script knows
    // exactly when to un-hide the recording indicator (no screenshot contamination).
    const doCapture = (respond) => {
      captureQueue = captureQueue.then(async () => {
        const screenshot = await captureScreenshot(sender.tab.id);
        respond({});                         // restore indicator now
        events.push({
          ...sanitiseEvent(message.event),
          description: generateDescription(message.event),
          screenshot,
          timestamp: Date.now()
        });
        updateStorage();
      }).catch(() => { respond({}); });      // always respond so port closes
    };

    if (isRecording && !isPaused) {
      doCapture(sendResponse);
    } else if (isPaused) {
      sendResponse({});                      // paused — nothing to capture
    } else if (!isRecording) {
      // Service worker may have just restarted; the async startup restore hasn't
      // finished yet. Re-read storage synchronously here before discarding.
      chrome.storage.local.get(['isRecording', 'isPaused', 'events'], (result) => {
        if (result.isRecording && !result.isPaused) {
          isRecording = true;
          isPaused = false;
          events = result.events || [];
          doCapture(sendResponse);
        } else {
          sendResponse({});
        }
      });
    }

  } else if (message.action === 'EXPORT_GUIDE') {
    if (!isFromExtension(sender)) return;
    chrome.storage.local.get(['events'], (result) => {
      const storedEvents = result.events || [];
      sendResponse({ data: generateHtmlGuide(storedEvents, message.title || 'User Guide') });
    });

  } else if (message.action === 'EXPORT_MARKDOWN') {
    if (!isFromExtension(sender)) return;
    chrome.storage.local.get(['events'], (result) => {
      const storedEvents = result.events || [];
      sendResponse({ data: generateMarkdownGuide(storedEvents, message.title || 'User Guide') });
    });

  } else if (message.action === 'COPY_GUIDE') {
    if (!isFromExtension(sender)) return;
    chrome.storage.local.get(['events'], (result) => {
      const storedEvents = result.events || [];
      sendResponse({ data: generateClipboardHtml(storedEvents, message.title || 'User Guide') });
    });

  } else if (message.action === 'DELETE_STEP') {
    if (!isFromExtension(sender)) return;
    chrome.storage.local.get(['events'], (result) => {
      const storedEvents = result.events || [];
      const index = storedEvents.findIndex(e => e.timestamp === message.timestamp);
      if (index !== -1) {
        storedEvents.splice(index, 1);
        events = storedEvents;
        chrome.storage.local.set({ events: storedEvents });
      }
    });

  } else if (message.action === 'HIDE_INDICATOR' || message.action === 'SHOW_INDICATOR') {
    // These are handled by content.js directly; background ignores them
  }

  return true;
});

// Sanitise incoming event fields to safe types/lengths before storing
function sanitiseEvent(evt) {
  return {
    type:       typeof evt.type === 'string'       ? evt.type.substring(0, 20)  : '',
    tagName:    typeof evt.tagName === 'string'     ? evt.tagName.substring(0, 30) : '',
    text:       typeof evt.text === 'string'        ? evt.text.substring(0, 300)  : '',
    ariaLabel:  typeof evt.ariaLabel === 'string'   ? evt.ariaLabel.substring(0, 200) : '',
    id:         typeof evt.id === 'string'          ? evt.id.substring(0, 100)   : '',
    fieldLabel: typeof evt.fieldLabel === 'string'  ? evt.fieldLabel.substring(0, 100) : '',
    key:        typeof evt.key === 'string'         ? evt.key.substring(0, 20)   : '',
    x:          typeof evt.x === 'number'           ? evt.x : 0,
    y:          typeof evt.y === 'number'           ? evt.y : 0,
  };
}

async function captureScreenshot(tabId) {
  try {
    return await chrome.tabs.captureVisibleTab(null, { format: 'jpeg', quality: 50 });
  } catch {
    return null;
  }
}

// Clipboard-optimized: inline styles only, no <head>/<style> blocks.
// C1 fix: all user-derived strings escaped before injection.
function generateClipboardHtml(events, title) {
  const steps = events.map((event, index) => {
    const imgHtml = event.screenshot
      ? `<img src="${event.screenshot}" alt="Step ${index + 1}" style="width:100%;max-width:700px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.12);display:block;margin-bottom:12px;">`
      : '';
    const subHtml = event.subDescription
      ? `<p style="font-size:14px;color:#555;margin:0 0 16px 0;line-height:1.6;">${escapeHtml(event.subDescription)}</p>`
      : '';
    return `
      <div style="margin-bottom:40px;">
        <p style="font-size:16px;font-weight:bold;color:#111;margin:0 0 10px 0;">${index + 1}. ${escapeHtml(event.description)}</p>
        ${imgHtml}
        ${subHtml}
      </div>`;
  }).join('');

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:700px;color:#333;line-height:1.6;">
      <h1 style="font-size:28px;color:#000;margin:0 0 6px 0;">${escapeHtml(title)}</h1>
      <p style="font-size:15px;color:#666;margin:0 0 32px 0;">Step-by-step guide</p>
      ${steps}
      <p style="font-size:12px;color:#999;border-top:1px solid #eee;padding-top:12px;margin-top:40px;">
        Created with <strong style="color:#0a44ec;">WriteThatDown</strong>
      </p>
    </div>`;
}

function generateHtmlGuide(events, title) {
  const stepsHtml = events.map((event, index) => {
    const subHtml = event.subDescription
      ? `<p class="step-sub">${escapeHtml(event.subDescription)}</p>`
      : '';
    return `
    <div class="step">
      <h3 class="step-title">${index + 1}. ${escapeHtml(event.description)}</h3>
      <div class="step-image">
        <img src="${event.screenshot || ''}" alt="Step ${index + 1} Screenshot">
      </div>
      ${subHtml}
    </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; max-width: 850px; margin: 0 auto; padding: 40px 20px; background: white; color: #333; line-height: 1.6; }
    .header { text-align: center; margin-bottom: 40px; }
    .header h1 { font-size: 32px; color: #000; margin-bottom: 10px; }
    .header .subtitle { font-size: 18px; color: #666; }
    .intro-section { background: #f8f9fa; padding: 20px; border-radius: 12px; margin-bottom: 40px; text-align: center; border: 1px solid #eee; }
    .intro-text { font-size: 16px; color: #444; margin: 0; }
    .step { margin-bottom: 50px; }
    .step-title { font-size: 20px; font-weight: bold; margin: 24px 0 16px 0; color: #000; }
    .step-image { width: 100%; margin-bottom: 14px; }
    .step-image img { width: 100%; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); display: block; }
    .step-sub { font-size: 15px; color: #555; line-height: 1.6; margin: 0 0 20px 0; }
    .footer { text-align: center; margin-top: 60px; padding-top: 20px; border-top: 1px solid #eee; font-size: 14px; }
    .footer a { text-decoration: none; color: #000; }
    @media print { body { padding: 0; } .step { page-break-inside: avoid; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>${escapeHtml(title)}</h1>
    <div class="subtitle">Quick Guide</div>
  </div>
  <div class="intro-section">
    <p class="intro-text">This guide will equip you with the skills to efficiently complete the process described in this task.</p>
  </div>
  <div class="guide-content">${stepsHtml}</div>
  <div class="footer">
    <a href="#" target="_blank" rel="noreferrer">Powered by <strong style="color:#0a44ec">WriteThatDown</strong></a>
  </div>
</body>
</html>`;
}

function generateMarkdownGuide(events, title) {
  let md = `# ${title}\n\n`;
  events.forEach((event, index) => {
    md += `## Step ${index + 1}: ${event.description}\n\n`;
    if (event.screenshot) md += `![Step ${index + 1} Screenshot](${event.screenshot})\n\n`;
    if (event.subDescription) md += `${event.subDescription}\n\n`;
    md += `---\n\n`;
  });
  return md;
}
