export function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

export function isSafeScreenshot(url) {
  return typeof url === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(url);
}

export async function copyToClipboard(htmlData, btn) {
  const blobHtml = new Blob([htmlData], { type: 'text/html' });
  const doc = new DOMParser().parseFromString(htmlData, 'text/html');
  const blobText = new Blob([doc.body.innerText || ''], { type: 'text/plain' });
  const orig = btn.textContent;
  try {
    await navigator.clipboard.write([
      new ClipboardItem({ 'text/html': blobHtml, 'text/plain': blobText }),
    ]);
    btn.textContent = 'Copied!';
    btn.style.background = '#16a34a';
    btn.style.color = '#fff';
    btn.style.borderColor = '#16a34a';
    setTimeout(() => {
      btn.textContent = orig;
      btn.style.background = '';
      btn.style.color = '';
      btn.style.borderColor = '';
    }, 2000);
  } catch (err) {
    console.error('Failed to copy:', err);
    btn.textContent = 'Copy failed';
    setTimeout(() => { btn.textContent = orig; }, 2000);
  }
}
