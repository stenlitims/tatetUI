/**
 * Чиста логіка стану UiSidebar — поза компонентом, щоб покривати тестами
 * без рендеру (правило дому: поведінка → utils → тести).
 *
 * Рівень сховища зроблено «тупим»: компонент не таїть у собі стан, а
 * випромінює `update:collapsed`, тож персистентність живе парою функцій —
 * читання при монтуванні та запис при кожній зміні. Саме так робить
 * UiResizablePanels зі своїм storageKey.
 */

/** Валідні значення, які компонент пише сам: '1' | '0'. */
export type StoredCollapsed = '1' | '0'

/**
 * Читає збережений стан із сховища. Повертає null у трьох випадках —
 * ключа немає, сховище недоступне (private mode/quota) або в ньому
 * сміття: сміття не має вмикати випадковий стан.
 */
export function readStoredCollapsed(key: string): boolean | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(key)
    if (raw === '1') return true
    if (raw === '0') return false
    return null
  } catch {
    return null
  }
}

/**
 * Пише стан у сховище. Недоступне сховище мовчки пропускає запис:
 * персистентність — найкраще зусилля, а не контракт.
 */
export function persistCollapsed(key: string, value: boolean): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, value ? '1' : '0')
  } catch {
    // private mode / quota — стан живе до перезавантаження.
  }
}