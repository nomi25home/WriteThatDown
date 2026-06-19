// @vitest-environment jsdom
import { describe, test, expect, vi, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Regression tests for the first-field typing capture bug.
// The mousedown flush (lines ~93-112 in content.js) must fire CAPTURE_EVENT
// BEFORE blur occurs when the user clicks away from a field they just typed in.

let messageListener;
let sendMessageSpy;

function startRecording() {
  messageListener?.({ action: 'START_CAPTURE' }, {}, vi.fn());
}

function stopRecording() {
  messageListener?.({ action: 'STOP_CAPTURE' }, {}, vi.fn());
}

beforeAll(() => {
  sendMessageSpy = vi.fn((msg, callback) => {
    if (typeof callback === 'function') callback({});
  });

  global.chrome = {
    runtime: {
      id: 'test-ext-id',
      onMessage: {
        addListener: vi.fn((fn) => { messageListener = fn; }),
        removeListener: vi.fn(),
      },
      sendMessage: sendMessageSpy,
    },
  };

  // Load content.js into this jsdom context.
  // window.__wtdActive is not set yet, so the guard passes and listeners register.
  const code = readFileSync(
    resolve(__dirname, '../src/content/content.js'),
    'utf8',
  );
  // eslint-disable-next-line no-eval
  eval(code);
});

describe('content.js — mousedown flush (first-field typing bug regression)', () => {
  test('mousedown on another element sends CAPTURE_EVENT with typed text', () => {
    startRecording();
    sendMessageSpy.mockClear();

    const input = document.createElement('input');
    input.type = 'text';
    document.body.appendChild(input);
    input.focus(); // fires focus event → seeds focusValues with ''

    input.value = 'hello world';
    input.dispatchEvent(new InputEvent('input', { bubbles: true }));

    const btn = document.createElement('button');
    document.body.appendChild(btn);
    // mousedown on btn (outside input) triggers the flush
    btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

    const captureCall = sendMessageSpy.mock.calls.find(
      c => c[0]?.action === 'CAPTURE_EVENT' && c[0]?.event?.type === 'type',
    );
    expect(captureCall).toBeTruthy();
    expect(captureCall[0].event.text).toBe('hello world');

    input.remove();
    btn.remove();
    stopRecording();
  });

  test('mousedown within the same field does NOT send CAPTURE_EVENT', () => {
    startRecording();
    sendMessageSpy.mockClear();

    const input = document.createElement('input');
    input.type = 'text';
    document.body.appendChild(input);
    input.focus();
    input.value = 'no capture';
    input.dispatchEvent(new InputEvent('input', { bubbles: true }));

    // Mousedown ON the same input — focused.contains(input) is true, so the
    // flush handler must bail out early.
    input.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

    const captureCall = sendMessageSpy.mock.calls.find(
      c => c[0]?.action === 'CAPTURE_EVENT' && c[0]?.event?.type === 'type',
    );
    expect(captureCall).toBeUndefined();

    input.remove();
    stopRecording();
  });

  test('mousedown does NOT send CAPTURE_EVENT when value is unchanged from focus baseline', () => {
    startRecording();
    sendMessageSpy.mockClear();

    const input = document.createElement('input');
    input.type = 'text';
    input.value = 'prefilled'; // value set before focus
    document.body.appendChild(input);
    input.focus(); // seeds focusValues with 'prefilled' — no change to detect

    const btn = document.createElement('button');
    document.body.appendChild(btn);
    btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

    const captureCall = sendMessageSpy.mock.calls.find(
      c => c[0]?.action === 'CAPTURE_EVENT' && c[0]?.event?.type === 'type',
    );
    expect(captureCall).toBeUndefined();

    input.remove();
    btn.remove();
    stopRecording();
  });

  test('password field sends [password] placeholder, not the actual value', () => {
    startRecording();
    sendMessageSpy.mockClear();

    const pwd = document.createElement('input');
    pwd.type = 'password';
    document.body.appendChild(pwd);
    pwd.focus();
    pwd.value = 'secret123';
    pwd.dispatchEvent(new InputEvent('input', { bubbles: true }));

    // blur triggers the password capture path (not mousedown, since isTypeable
    // returns false for password fields — only the blur handler handles them)
    pwd.dispatchEvent(new FocusEvent('blur', { bubbles: true }));

    const captureCall = sendMessageSpy.mock.calls.find(
      c => c[0]?.action === 'CAPTURE_EVENT',
    );
    expect(captureCall).toBeTruthy();
    expect(captureCall[0].event.text).toBe('[password]');

    pwd.remove();
    stopRecording();
  });
});
