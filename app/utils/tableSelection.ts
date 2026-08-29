/**
 * Чиста арифметика виділення рядків таблиці.
 *
 * Винесено з UiTable з тієї ж причини, що й `computeVisiblePages`: логіку
 * «що станеться з набором ключів» треба перевіряти без DOM.
 */

export type SelectionKey = string | number

export type SelectionState = 'none' | 'some' | 'all'

/**
 * Стан заголовкового прапорця відносно ПОТОЧНОЇ сторінки.
 *
 * `some` — це саме `indeterminate`, а не «трохи вибрано»: без нього
 * заголовковий чекбокс показував би порожній стан там, де частина рядків
 * уже вибрана.
 */
export function selectionState(
  pageKeys: SelectionKey[],
  selected: ReadonlySet<SelectionKey>,
): SelectionState {
  if (!pageKeys.length) return 'none'
  let hit = 0
  for (const key of pageKeys) if (selected.has(key)) hit += 1
  if (hit === 0) return 'none'
  return hit === pageKeys.length ? 'all' : 'some'
}

/** Додає ключі, зберігаючи порядок і не плодячи дублів. */
export function unionKeys(current: SelectionKey[], add: SelectionKey[]): SelectionKey[] {
  const seen = new Set(current)
  const next = [...current]
  for (const key of add) {
    if (seen.has(key)) continue
    seen.add(key)
    next.push(key)
  }
  return next
}

/** Прибирає ключі, лишаючи решту в тому ж порядку. */
export function subtractKeys(current: SelectionKey[], remove: SelectionKey[]): SelectionKey[] {
  const drop = new Set(remove)
  return current.filter((key) => !drop.has(key))
}

/**
 * Ключі між якорем і ціллю включно, у порядку ПОКАЗУ.
 *
 * Порядок береться з відсортованого списку, а не з вихідних даних: Shift
 * виділяє те, що користувач бачить між двома рядками, а не те, що лежало
 * між ними до сортування.
 */
export function keysBetween(
  orderedKeys: SelectionKey[],
  anchor: SelectionKey,
  target: SelectionKey,
): SelectionKey[] {
  const from = orderedKeys.indexOf(anchor)
  const to = orderedKeys.indexOf(target)
  if (from === -1 || to === -1) return [target]
  const [start, end] = from <= to ? [from, to] : [to, from]
  return orderedKeys.slice(start, end + 1)
}
