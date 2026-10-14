/** Plain-text translation callback. A reactive locale inside it updates rendered labels. */
export type UiTextTranslator = (message: string, values?: Record<string, unknown>) => string

let translate: UiTextTranslator | undefined

/** Configure once before mounting. Omit the callback to restore Ukrainian defaults. */
export function setUiTextTranslator(translator?: UiTextTranslator): void {
  translate = translator
}

/** Built-in UI labels; arbitrary values remain text and are never interpreted as HTML. */
export function uiText(message: string, values: Record<string, unknown> = {}): string {
  if (translate) return translate(message, values)
  return message.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    Object.prototype.hasOwnProperty.call(values, name) ? String(values[name] ?? '') : placeholder)
}
