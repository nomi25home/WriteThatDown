import { describe, test, expect } from 'vitest';
import { sanitiseEvent } from '../src/background/sanitise.js';

describe('sanitiseEvent', () => {
  test('passes through valid string and number fields', () => {
    const input = {
      type: 'click', tagName: 'BUTTON', text: 'Submit',
      ariaLabel: 'Submit form', id: 'btn', fieldLabel: 'Submit',
      key: 'Enter', x: 100, y: 200,
    };
    expect(sanitiseEvent(input)).toEqual(input);
  });

  test('replaces non-string fields with empty string', () => {
    const result = sanitiseEvent({
      type: 123, tagName: null, text: undefined,
      ariaLabel: [], id: {}, fieldLabel: true, key: Symbol(),
    });
    expect(result.type).toBe('');
    expect(result.tagName).toBe('');
    expect(result.text).toBe('');
    expect(result.ariaLabel).toBe('');
    expect(result.id).toBe('');
    expect(result.fieldLabel).toBe('');
    expect(result.key).toBe('');
  });

  test('replaces non-number coordinates with 0', () => {
    const result = sanitiseEvent({ x: '50', y: null });
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
  });

  test('truncates type at 20 chars', () => {
    expect(sanitiseEvent({ type: 'x'.repeat(30) }).type.length).toBe(20);
  });

  test('truncates tagName at 30 chars', () => {
    expect(sanitiseEvent({ tagName: 'x'.repeat(40) }).tagName.length).toBe(30);
  });

  test('truncates text at 300 chars', () => {
    expect(sanitiseEvent({ text: 'y'.repeat(400) }).text.length).toBe(300);
  });

  test('truncates ariaLabel at 200 chars', () => {
    expect(sanitiseEvent({ ariaLabel: 'z'.repeat(250) }).ariaLabel.length).toBe(200);
  });

  test('truncates id at 100 chars', () => {
    expect(sanitiseEvent({ id: 'a'.repeat(150) }).id.length).toBe(100);
  });

  test('preserves float coordinates', () => {
    const result = sanitiseEvent({ x: 150.5, y: 300.25 });
    expect(result.x).toBe(150.5);
    expect(result.y).toBe(300.25);
  });

  test('handles empty object — returns all defaults', () => {
    const result = sanitiseEvent({});
    expect(result.type).toBe('');
    expect(result.text).toBe('');
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
  });
});
