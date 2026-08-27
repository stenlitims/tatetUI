/**
 * Чиста логіка фільтра accept в UiFileUpload.
 *
 * Винесено з matchesAccept в UiFileUpload.vue, щоб перевіряти поведінку
 * (MIME-глоби, розширення, регістр) тестом: компонент викликає функцію.
 */

/** Зіставлення accept: список через кому, MIME (`image/*`) або `.ext`. */
export function matchesAccept(file: File, accept: string): boolean {
  const rules = accept.split(',').map((rule) => rule.trim().toLowerCase())
  const name = file.name.toLowerCase()
  const type = file.type.toLowerCase()
  return rules.some((rule) => {
    if (!rule) return false
    if (rule.startsWith('.')) return name.endsWith(rule)
    if (rule.endsWith('/*')) return type.startsWith(rule.slice(0, -1))
    return type === rule
  })
}

/**
 * Контракт на рівні виклику: порожній accept нічого не фільтрує —
 * приймається все. Компонент викликає саме цю функцію.
 */
export function isFileAccepted(file: File, accept: string | undefined): boolean {
  return !accept?.trim() || matchesAccept(file, accept)
}
