import { describe, test, expect } from 'vitest';
import { generateDescription } from '../src/background/description-generator.js';

describe('generateDescription', () => {
  test('type event with fieldLabel', () => {
    expect(generateDescription({ type: 'type', text: 'hello', fieldLabel: 'Search' }))
      .toBe('Type "hello" into "Search"');
  });

  test('type event without fieldLabel', () => {
    expect(generateDescription({ type: 'type', text: 'hello' }))
      .toBe('Type "hello"');
  });

  test('word event', () => {
    expect(generateDescription({ type: 'word', text: 'foo' }))
      .toBe('Type "foo"');
  });

  test('keypress event', () => {
    expect(generateDescription({ type: 'keypress', key: 'Enter' }))
      .toBe('Press the Enter key');
  });

  test('click on button with text', () => {
    expect(generateDescription({ type: 'click', tagName: 'BUTTON', text: 'Save', ariaLabel: '' }))
      .toBe('Click the button "Save"');
  });

  test('click on button with ariaLabel (preferred over text)', () => {
    expect(generateDescription({ type: 'click', tagName: 'BUTTON', ariaLabel: 'Close dialog', text: '' }))
      .toBe('Click the button "Close dialog"');
  });

  test('click on anchor', () => {
    expect(generateDescription({ type: 'click', tagName: 'A', text: 'Home', ariaLabel: '' }))
      .toBe('Click the link "Home"');
  });

  test('click on anchor without text', () => {
    expect(generateDescription({ type: 'click', tagName: 'A', ariaLabel: '', text: '', id: '' }))
      .toBe('Click the link');
  });

  test('click on unlabelled div with id', () => {
    expect(generateDescription({ type: 'click', tagName: 'DIV', ariaLabel: '', text: '', id: 'hero' }))
      .toBe('Click the element with ID hero');
  });

  test('click on unlabelled div without id', () => {
    expect(generateDescription({ type: 'click', tagName: 'DIV', ariaLabel: '', text: '', id: '' }))
      .toBe('Click the element');
  });

  test('click with text but no special tag', () => {
    expect(generateDescription({ type: 'click', tagName: 'SPAN', ariaLabel: '', text: 'Menu', id: '' }))
      .toBe('Click "Menu"');
  });

  test('unknown type falls back to generic message', () => {
    expect(generateDescription({ type: 'scroll' }))
      .toBe('Perform an action');
  });
});
