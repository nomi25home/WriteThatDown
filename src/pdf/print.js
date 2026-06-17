function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

chrome.storage.local.get(['events', 'guideTitle', 'pdfTitle'], (result) => {
  const events = result.events || [];
  const title = result.pdfTitle || result.guideTitle || 'User Guide';

  const stepsHtml = events.map((event, i) => {
    const imgHtml = event.screenshot
      ? `<div class="step-image"><img src="${event.screenshot}" alt="Step ${i + 1}"></div>`
      : '';
    const subHtml = event.subDescription
      ? `<p class="step-sub">${escapeHtml(event.subDescription)}</p>` : '';
    return `
      <div class="step">
        <div class="step-header">
          <div class="step-num">${i + 1}</div>
          <h3 class="step-title">${escapeHtml(event.description)}</h3>
        </div>
        ${imgHtml}
        ${subHtml}
      </div>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      background: #fff; color: #1a1a1a; line-height: 1.6;
      padding: 48px 56px;
    }
    .cover { margin-bottom: 48px; padding-bottom: 24px; border-bottom: 2px solid #e5e5e5; }
    .cover h1 { font-size: 30px; font-weight: 800; color: #000; margin-bottom: 6px; }
    .cover .meta { font-size: 13px; color: #888; }
    .cover .brand { font-size: 13px; color: #0a44ec; font-weight: 600; margin-top: 4px; }
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
      box-shadow: 0 2px 8px rgba(0,0,0,0.08); display: block;
    }
    .step-sub { font-size: 13px; color: #555; line-height: 1.6; padding-left: 44px; }
    @media print {
      body { padding: 0; }
      .step { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="cover">
    <h1>${escapeHtml(title)}</h1>
    <div class="meta">${events.length} step${events.length !== 1 ? 's' : ''}</div>
    <div class="brand">Created with WriteThatDown</div>
  </div>
  ${stepsHtml}
</body>
</html>`;

  // Replace this page's content with the rendered guide, then auto-print.
  // document.write on an extension page works fine and avoids blob: URL
  // restrictions that block programmatic window.print().
  document.open('text/html');
  document.write(html);
  document.close();

  chrome.storage.local.remove(['pdfTitle']);

  // Short delay lets base64 images decode before the print dialog opens
  setTimeout(() => window.print(), 600);
});
