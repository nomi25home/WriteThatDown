export function generateDescription(event) {
  if (event.type === 'word') {
    return `Type "${event.text}"`;
  }

  if (event.type === 'keypress') {
    return `Press the ${event.key} key`;
  }

  if (event.type === 'click') {
    const text = event.text ? `"${event.text}"` : '';
    const tag = event.tagName.toLowerCase();

    if (tag === 'button' || tag === 'input' || tag === 'a') {
      return `Click the ${text} ${tag === 'a' ? 'link' : 'button'}`;
    }

    if (event.id) {
      return `Click the element with ID ${event.id}`;
    }

    return `Click the ${text || 'element'}`;
  }

  return 'Perform an action';
}
