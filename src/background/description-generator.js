export function generateDescription(event) {
  if (event.type === 'type') {
    const into = event.fieldLabel ? ` into "${event.fieldLabel}"` : '';
    return `Type "${event.text}"${into}`;
  }

  if (event.type === 'word') {
    return `Type "${event.text}"`;
  }

  if (event.type === 'keypress') {
    return `Press the ${event.key} key`;
  }

  if (event.type === 'click') {
    const label = event.ariaLabel || event.text;
    const text = label ? `"${label}"` : '';
    const tag = event.tagName.toLowerCase();

    if (tag === 'button' || tag === 'input' || tag === 'a') {
      const type = tag === 'a' ? 'link' : 'button';
      return text ? `Click the ${type} ${text}` : `Click the ${type}`;
    }

    if (text) {
      return `Click ${text}`;
    }

    if (event.id) {
      return `Click the element with ID ${event.id}`;
    }

    return `Click the element`;
  }

  return 'Perform an action';
}
