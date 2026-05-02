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
    const pointerHtml = event.type === 'click'
      ? `<div class="click-pointer" style="left: ${event.x}%; top: ${event.y}%;"></div>`
      : '';

    return `
    <div class="step" data-index="${index}">
      <div class="step-header">
        <span class="step-number">Step ${index + 1}</span>
        <p class="step-description" contenteditable="true" title="Click to edit">${event.description}</p>
        <div class="step-controls">
          <button class="move-btn" onclick="moveStep(this, -1)" title="Move Up">↑</button>
          <button class="move-btn" onclick="moveStep(this, 1)" title="Move Down">↓</button>
          <button class="delete-btn" onclick="deleteStep(this, ${event.timestamp})" title="Delete Step">🗑️</button>
        </div>
      </div>
      <div class="step-image">
        <div class="image-container">
          <img src="${event.screenshot || ''}" alt="Step ${index + 1} Screenshot">
          ${pointerHtml}
        </div>
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
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; background: #f9f9f9; }
        h1 { text-align: center; color: #333; margin-bottom: 20px; }
        .toolbar { display: flex; justify-content: center; gap: 10px; margin-bottom: 30px; }
        .toolbar-btn { padding: 8px 16px; cursor: pointer; border-radius: 6px; border: 1px solid #ddd; background: white; font-size: 14px; font-weight: 500; transition: all 0.2s; }
        .toolbar-btn:hover { background: #f0f0f0; }
        .toolbar-btn.active { background: #007bff; color: white; border-color: #007bff; }
        .step { background: white; border-radius: 12px; padding: 24px; margin-bottom: 40px; box-shadow: 0 4px 20px rgba(0,0,0,0.05); position: relative; overflow: hidden; }
        .step-header { display: flex; align-items: center; gap: 15px; margin-bottom: 20px; }
        .step-number { background: #007bff; color: white; font-weight: bold; padding: 4px 12px; border-radius: 12px; font-size: 14px; }
        .step-description { font-size: 18px; color: #444; margin: 0; outline: none; border-bottom: 1px dashed transparent; transition: border-color 0.2s; flex: 1; }
        .step-description:hover { border-bottom-color: #ccc; cursor: text; }
        .step-description:focus { border-bottom-color: #007bff; background: #fcfcfc; }
        .step-controls { display: flex; gap: 4px; }
        .move-btn { padding: 4px 8px; cursor: pointer; border: 1px solid #ddd; background: #f9f9f9; border-radius: 4px; font-size: 12px; }
        .move-btn:hover { background: #eee; }
        .delete-btn { padding: 4px 8px; cursor: pointer; border: 1px solid #ddd; background: #fff0f0; border-radius: 4px; font-size: 12px; color: #d9534f; }
        .delete-btn:hover { background: #d9534f; color: white; }
        .step-image { position: relative; }
        .image-container { position: relative; display: inline-block; width: 100%; cursor: default; }
        .image-container.redacting { cursor: crosshair; }
        .step-image img { width: 100%; border-radius: 8px; border: 1px solid #eee; display: block; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .click-pointer {
          position: absolute;
          width: 14px;
          height: 14px;
          background: red;
          border: 2px solid white;
          border-radius: 50%;
          transform: translate(-50%, -50%);
          pointer-events: none;
          z-index: 10;
          box-shadow: 0 0 6px rgba(0,0,0,0.3);
        }
        .redaction-box {
          position: absolute;
          background: #808080;
          border: 1px solid #666;
          z-index: 11;
          pointer-events: auto;
        }
        @media print {
          body { background: white; margin: 0; padding: 0; }
          .toolbar, .step-controls { display: none !important; }
          .step { box-shadow: none; border: 1px solid #eee; page-break-inside: avoid; }
          .step-description { border-bottom: none; }
        }
      </style>
    </head>
    <body>
      <h1>${title}</h1>
      <div class="toolbar">
        <button class="toolbar-btn" id="redactToggle" onclick="toggleRedactMode()">Enable Redaction Mode</button>
        <button class="toolbar-btn" onclick="window.print()">Print to PDF</button>
      </div>
      <div id="guide-content">
        ${stepsHtml}
      </div>
      <script>
        function moveStep(btn, direction) {
          const step = btn.closest('.step');
          const container = document.getElementById('guide-content');
          if (direction === -1 && step.previousElementSibling) {
            container.insertBefore(step, step.previousElementSibling);
          } else if (direction === 1 && step.nextElementSibling) {
            container.insertBefore(step.nextElementSibling, step);
          }
          updateStepNumbers();
        }

        function updateStepNumbers() {
          document.querySelectorAll('.step-number').forEach((span, i) => {
            span.textContent = 'Step ' + (i + 1);
          });
        }

        function deleteStep(btn, timestamp) {
          if (confirm('Are you sure you want to delete this step?')) {
            const step = btn.closest('.step');
            step.remove();
            updateStepNumbers();
            chrome.runtime.sendMessage({ action: 'DELETE_STEP', timestamp: timestamp });
          }
        }

        let redactMode = false;
        function toggleRedactMode() {
          redactMode = !redactMode;
          const btn = document.getElementById('redactToggle');
          btn.textContent = redactMode ? 'Disable Redaction Mode' : 'Enable Redaction Mode';
          btn.classList.toggle('active', redactMode);

          document.querySelectorAll('.image-container').forEach(container => {
            container.classList.toggle('redacting', redactMode);
          });
        }

        document.addEventListener('mousedown', e => {
          if (!redactMode) return;
          const container = e.target.closest('.image-container');
          if (!container) return;

          const rect = container.getBoundingClientRect();
          const startX = e.clientX - rect.left;
          const startY = e.clientY - rect.top;

          const box = document.createElement('div');
          box.className = 'redaction-box';
          box.style.left = startX + 'px';
          box.style.top = startY + 'px';
          box.style.width = '0px';
          box.style.height = '0px';
          container.appendChild(box);

          const onMouseMove = (moveEvent) => {
            const currentX = moveEvent.clientX - rect.left;
            const currentY = moveEvent.clientY - rect.top;

            const left = Math.min(startX, currentX);
            const top = Math.min(startY, currentY);
            const width = Math.abs(startX - currentX);
            const height = Math.abs(startY - currentY);

            box.style.left = left + 'px';
            box.style.top = top + 'px';
            box.style.width = width + 'px';
            box.style.height = height + 'px';
          };

          const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            if (parseInt(box.style.width) < 5 && parseInt(box.style.height) < 5) {
              box.remove();
            }
          };

          document.addEventListener('mousemove', onMouseMove);
          document.addEventListener('mouseup', onMouseUp);
        });
      </script>
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
