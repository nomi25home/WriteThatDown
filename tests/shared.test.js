import { describe, test, expect } from 'vitest';
import { escapeHtml, isSafeScreenshot } from '../src/utils/shared.js';

describe('escapeHtml', () => {
  test('escapes &', () => expect(escapeHtml('a&b')).toBe('a&amp;b'));
  test('escapes <', () => expect(escapeHtml('<b>')).toBe('&lt;b&gt;'));
  test('escapes >', () => expect(escapeHtml('a>b')).toBe('a&gt;b'));
  test('escapes "', () => expect(escapeHtml('"hi"')).toBe('&quot;hi&quot;'));
  test("escapes '", () => expect(escapeHtml("it's")).toBe('it&#x27;s'));
  test('handles empty string', () => expect(escapeHtml('')).toBe(''));
  test('handles default param (undefined)', () => expect(escapeHtml()).toBe(''));
  test('coerces number to string', () => expect(escapeHtml(42)).toBe('42'));
  test('passes safe text through unchanged', () => expect(escapeHtml('hello world')).toBe('hello world'));
  test('escapes multiple special chars in one string', () =>
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;',
    ));
});

describe('isSafeScreenshot', () => {
  test('accepts jpeg data URL', () => expect(isSafeScreenshot('data:image/jpeg;base64,/9j/')).toBe(true));
  test('accepts png data URL', () => expect(isSafeScreenshot('data:image/png;base64,iVBO')).toBe(true));
  test('accepts webp data URL', () => expect(isSafeScreenshot('data:image/webp;base64,UklG')).toBe(true));
  test('rejects javascript: URL', () => expect(isSafeScreenshot('javascript:alert(1)')).toBe(false));
  test('rejects https URL', () => expect(isSafeScreenshot('https://evil.com/img.jpg')).toBe(false));
  test('rejects gif data URL', () => expect(isSafeScreenshot('data:image/gif;base64,R0lG')).toBe(false));
  test('rejects data URL without base64 marker', () =>
    expect(isSafeScreenshot('data:image/png,abc')).toBe(false));
  test('rejects null', () => expect(isSafeScreenshot(null)).toBe(false));
  test('rejects undefined', () => expect(isSafeScreenshot(undefined)).toBe(false));
  test('rejects empty string', () => expect(isSafeScreenshot('')).toBe(false));
});
