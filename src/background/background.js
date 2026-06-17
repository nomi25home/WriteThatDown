import { generateDescription } from './description-generator.js';

let isRecording = false;
let isPaused = false;
let events = [];
let captureQueue = Promise.resolve();

async function updateStorage() {
  await chrome.storage.local.set({ isRecording, isPaused, events });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'START_RECORDING') {
    isRecording = true;
    isPaused = false;
    events = [];
    captureQueue = Promise.resolve();
    updateStorage();
    console.log('Recording started...');

    const targetTabId = message.tabId;
    if (targetTabId) {
      chrome.scripting.executeScript({
        target: { tabId: targetTabId },
        files: ['src/content/content.js']
      })
      .then(() => {
        setTimeout(() => {
          chrome.tabs.sendMessage(targetTabId, { action: 'START_CAPTURE' })
            .then(() => console.log('START_CAPTURE sent successfully'))
            .catch(err => console.warn('START_CAPTURE failed:', err));
        }, 100);
      })
      .catch(err => console.error('Failed to inject content script:', err));
    } else {
      console.error('START_RECORDING received without tabId');
    }
  } else if (message.action === 'STOP_RECORDING') {
    isRecording = false;
    isPaused = false;
    updateStorage();
    console.log('Recording stopped. Total events:', events.length);
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'STOP_CAPTURE' })
          .then(() => console.log('STOP_CAPTURE sent successfully'))
          .catch(err => console.warn('STOP_CAPTURE failed:', err));
      }
    });
  } else if (message.action === 'TOGGLE_PAUSE') {
    isPaused = !isPaused;
    updateStorage();
    console.log(`Recording ${isPaused ? 'paused' : 'resumed'}`);
    sendResponse({ isPaused });
  } else if (message.action === 'CAPTURE_EVENT') {
    if (isRecording && !isPaused) {
      captureQueue = captureQueue.then(async () => {
        const screenshot = await captureScreenshot(message.event, sender.tab.id);
        events.push({
          ...message.event,
          description: generateDescription(message.event),
          screenshot,
          timestamp: Date.now()
        });
        updateStorage();
      }).catch(err => console.error('Capture failed, continuing queue:', err));
    }
  } else if (message.action === 'EXPORT_PDF') {
    chrome.storage.local.get(['events'], (result) => {
      const storedEvents = result.events || [];
      sendResponse({ data: generatePdfHtml(storedEvents, message.title || 'User Guide') });
    });
  } else if (message.action === 'EXPORT_GUIDE') {
    chrome.storage.local.get(['events'], (result) => {
      const storedEvents = result.events || [];
      sendResponse({ data: generateHtmlGuide(storedEvents, message.title || 'User Guide') });
    });
  } else if (message.action === 'EXPORT_MARKDOWN') {
    chrome.storage.local.get(['events'], (result) => {
      const storedEvents = result.events || [];
      sendResponse({ data: generateMarkdownGuide(storedEvents, message.title || 'User Guide') });
    });
  } else if (message.action === 'COPY_GUIDE') {
    chrome.storage.local.get(['events'], (result) => {
      const storedEvents = result.events || [];
      sendResponse({ data: generateClipboardHtml(storedEvents, message.title || 'User Guide') });
    });
  } else if (message.action === 'DELETE_STEP') {
    chrome.storage.local.get(['events'], (result) => {
      const storedEvents = result.events || [];
      const index = storedEvents.findIndex(e => e.timestamp === message.timestamp);
      if (index !== -1) {
        storedEvents.splice(index, 1);
        events = storedEvents;
        chrome.storage.local.set({ events: storedEvents });
        console.log('Step deleted from storage');
      }
    });
  }
  return true;
});

async function captureScreenshot(event, tabId) {
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'jpeg', quality: 50 });
    return dataUrl;
  } catch (error) {
    console.error('Screenshot failed:', error);
    return null;
  }
}

// Clipboard-optimized: inline styles only, no <head>/<style> blocks.
// Pastes cleanly into Gmail, Outlook, Word, PowerPoint, Google Docs/Slides/Keep.
function generateClipboardHtml(events, title) {
  const steps = events.map((event, index) => {
    const imgHtml = event.screenshot
      ? `<img src="${event.screenshot}" alt="Step ${index + 1}" style="width:100%;max-width:700px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.12);display:block;margin-bottom:12px;">`
      : '';
    const subHtml = event.subDescription
      ? `<p style="font-size:14px;color:#555;margin:0 0 16px 0;line-height:1.6;">${event.subDescription}</p>`
      : '';
    return `
      <div style="margin-bottom:40px;">
        <p style="font-size:16px;font-weight:bold;color:#111;margin:0 0 10px 0;">${index + 1}. ${event.description}</p>
        ${imgHtml}
        ${subHtml}
      </div>`;
  }).join('');

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:700px;color:#333;line-height:1.6;">
      <h1 style="font-size:28px;color:#000;margin:0 0 6px 0;">${title}</h1>
      <p style="font-size:15px;color:#666;margin:0 0 32px 0;">Step-by-step guide</p>
      ${steps}
      <p style="font-size:12px;color:#999;border-top:1px solid #eee;padding-top:12px;margin-top:40px;">
        Created with <strong style="color:#0a44ec;">WriteThatDown</strong>
      </p>
    </div>`;
}

function generatePdfHtml(events, title) {
  const stepsHtml = events.map((event, index) => {
    const imgHtml = event.screenshot
      ? `<div class="step-image"><img src="${event.screenshot}" alt="Step ${index + 1}"></div>`
      : '';
    const subHtml = event.subDescription
      ? `<p class="step-sub">${event.subDescription}</p>` : '';
    return `
      <div class="step">
        <div class="step-header">
          <div class="step-num">${index + 1}</div>
          <h3 class="step-title">${event.description}</h3>
        </div>
        ${imgHtml}
        ${subHtml}
      </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      background: #fff; color: #1a1a1a; line-height: 1.6;
      padding: 48px 56px;
    }

    /* Cover */
    .cover { margin-bottom: 48px; padding-bottom: 24px; border-bottom: 2px solid #e5e5e5; }
    .cover h1 { font-size: 30px; font-weight: 800; color: #000; margin-bottom: 6px; }
    .cover .meta { font-size: 13px; color: #888; }
    .cover .brand { font-size: 13px; color: #0a44ec; font-weight: 600; margin-top: 4px; }

    /* Steps */
    .step { margin-bottom: 44px; page-break-inside: avoid; }
    .step-header { display: flex; align-items: flex-start; gap: 14px; margin-bottom: 14px; }
    .step-num {
      width: 30px; height: 30px; border-radius: 50%;
      background: #0a44ec; color: #fff;
      font-size: 13px; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; margin-top: 2px;
    }
    .step-title { font-size: 16px; font-weight: 700; color: #111; line-height: 1.4; }
    .step-image { margin-bottom: 12px; }
    .step-image img {
      width: 100%; border-radius: 8px;
      border: 1px solid #e8e8e8;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
      display: block;
    }
    .step-sub { font-size: 13px; color: #555; line-height: 1.6; padding-left: 44px; }

    /* Print tweaks */
    @media print {
      body { padding: 0; }
      .no-print { display: none !important; }
      .step { page-break-inside: avoid; }
    }

    /* Print-prompt banner (hidden when printing) */
    .print-banner {
      position: fixed; bottom: 0; left: 0; right: 0;
      background: #111; color: #fff;
      display: flex; align-items: center; justify-content: center; gap: 16px;
      padding: 14px 20px; font-size: 14px; z-index: 9999;
    }
    .print-banner button {
      background: #0a44ec; color: #fff; border: none;
      padding: 8px 20px; border-radius: 6px; font-size: 14px;
      font-weight: 600; cursor: pointer;
    }
    .print-banner button:hover { background: #a80000; }
  </style>
</head>
<body>

  <div class="cover">
    <h1>${title}</h1>
    <div class="meta">${events.length} step${events.length !== 1 ? 's' : ''}</div>
    <div class="brand">Created with WriteThatDown</div>
  </div>

  ${stepsHtml}

  <div class="print-banner no-print" id="printBanner">
    <span>Save this guide as a PDF using your browser's print dialog</span>
    <button onclick="window.print()">Save as PDF</button>
    <button onclick="document.getElementById('printBanner').remove()" style="background:#444;">Dismiss</button>
  </div>

  <script>
    // Auto-open print dialog after images load
    window.addEventListener('load', () => {
      setTimeout(() => window.print(), 800);
    });
  </script>
</body>
</html>`;
}

function generateHtmlGuide(events, title) {
  const stepsHtml = events.map((event, index) => {
    const subHtml = event.subDescription
      ? `<p class="step-sub">${event.subDescription}</p>`
      : '';
    return `
    <div class="step">
      <h3 class="step-title">${index + 1}. ${event.description}</h3>
      <div class="step-image">
        <img src="${event.screenshot || ''}" alt="Step ${index + 1} Screenshot">
      </div>
      ${subHtml}
    </div>
  `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>${title}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; max-width: 850px; margin: 0 auto; padding: 40px 20px; background: white; color: #333; line-height: 1.6; }
        .header { text-align: center; margin-bottom: 40px; }
        .header h1 { font-size: 32px; color: #000; margin-bottom: 10px; }
        .header .subtitle { font-size: 18px; color: #666; }
        .intro-section { background: #f8f9fa; padding: 20px; border-radius: 12px; margin-bottom: 40px; text-align: center; border: 1px solid #eee; }
        .intro-text { font-size: 16px; color: #444; margin: 0; }
        .step { margin-bottom: 50px; }
        .step-title { font-size: 20px; font-weight: bold; margin: 24px 0 16px 0; color: #000; border-bottom: none; }
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
        <h1>${title}</h1>
        <div class="subtitle">Quick Guide</div>
      </div>
      <div class="intro-section">
        <p class="intro-text">This guide will equip you with the skills to efficiently complete the process described in this task.</p>
      </div>
      <div class="guide-content">
        ${stepsHtml}
      </div>
      <div class="footer">
        <a href="#" target="_blank" rel="noreferrer">Powered by <strong style="color:#0a44ec">WriteThatDown</strong></a>
      </div>
    </body>
    </html>
  `;
}

function generateMarkdownGuide(events, title) {
  let md = `# ${title}\n\n`;
  events.forEach((event, index) => {
    md += `## Step ${index + 1}: ${event.description}\n\n`;
    if (event.screenshot) {
      md += `![Step ${index + 1} Screenshot](${event.screenshot})\n\n`;
    }
    if (event.subDescription) {
      md += `${event.subDescription}\n\n`;
    }
    md += `---\n\n`;
  });
  return md;
}
