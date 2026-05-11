import { generateDescription } from './description-generator.js';

let isRecording = false;
let isPaused = false;
let events = [];

async function updateStorage() {
  await chrome.storage.local.set({ isRecording, isPaused, events });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'START_RECORDING') {
    isRecording = true;
    isPaused = false;
    events = [];
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
      captureScreenshot(message.event, sender.tab.id).then(screenshot => {
        events.push({
          ...message.event,
          description: generateDescription(message.event),
          screenshot,
          timestamp: Date.now()
        });
        updateStorage();
      });
    }
  } else if (message.action === 'EXPORT_GUIDE') {
    const htmlGuide = generateHtmlGuide(events, message.title || 'User Guide');
    sendResponse({ data: htmlGuide });
  } else if (message.action === 'EXPORT_MARKDOWN') {
    const mdGuide = generateMarkdownGuide(events, message.title || 'User Guide');
    sendResponse({ data: mdGuide });
  } else if (message.action === 'DELETE_STEP') {
    const index = events.findIndex(e => e.timestamp === message.timestamp);
    if (index !== -1) {
      events.splice(index, 1);
      updateStorage();
      console.log('Step deleted from storage');
    }
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

function generateHtmlGuide(events, title) {
  const stepsHtml = events.map((event, index) => {
    return `
    <div class="step">
      <h3 class="step-title">${index + 1}. ${event.description}</h3>
      <div class="step-image">
        <img src="${event.screenshot || ''}" alt="Step ${index + 1} Screenshot">
      </div>
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
        .step-image { width: 100%; margin-bottom: 20px; }
        .step-image img { width: 100%; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); display: block; }

        .footer { text-align: center; margin-top: 60px; padding-top: 20px; border-top: 1px solid #eee; font-size: 14px; }
        .footer a { text-decoration: none; color: #000; }
        .footer strong { color: #CB0000; }

        @media print {
          body { padding: 0; }
          .step { page-break-inside: avoid; }
        }
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
        <a href="#" target="_blank" rel="noreferrer">Powered by <strong style="color:#CB0000">WriteThatDown</strong></a>
      </div>
    </body>
    </html>
  `;
}


function generateMarkdownGuide(events, title) {
  let md = `# ${title}\n\n`;

  events.forEach((event, index) => {
    md += `## Step ${index + 1}\n${event.description}\n\n`;
    if (event.screenshot) {
      md += `![Step ${index + 1} Screenshot](${event.screenshot})\n\n`;
    }
    md += `---\n\n`;
  });

  return md;
}
