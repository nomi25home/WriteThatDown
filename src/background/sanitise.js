export function sanitiseEvent(evt) {
  return {
    type:       typeof evt.type === 'string'       ? evt.type.substring(0, 20)       : '',
    tagName:    typeof evt.tagName === 'string'     ? evt.tagName.substring(0, 30)    : '',
    text:       typeof evt.text === 'string'        ? evt.text.substring(0, 300)      : '',
    ariaLabel:  typeof evt.ariaLabel === 'string'   ? evt.ariaLabel.substring(0, 200) : '',
    id:         typeof evt.id === 'string'          ? evt.id.substring(0, 100)        : '',
    fieldLabel: typeof evt.fieldLabel === 'string'  ? evt.fieldLabel.substring(0, 100): '',
    key:        typeof evt.key === 'string'         ? evt.key.substring(0, 20)        : '',
    x:          typeof evt.x === 'number'           ? evt.x                           : 0,
    y:          typeof evt.y === 'number'           ? evt.y                           : 0,
  };
}
