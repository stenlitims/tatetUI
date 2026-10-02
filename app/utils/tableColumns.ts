/**
 * Колонки таблиці: ширини, порівняння значень і зведення збереженої
 * розкладки. Спільне для UiTable і UiTreeTable.
 *
 * Винесено окремо від `treeTable.ts` навмисно. Бібліотека копіюється
 * файлами, і «щоб узяти Table, скопіюй ще й утиліти дерева» — погана
 * угода: арифметика дерева (обхід, вікно, каскад виділення) плоскій
 * таблиці не потрібна взагалі. Спільне тут — рівно те, що обидві
 * таблиці й справді ділять, і саме тому їхні колонки поводяться
 * однаково без жодної синхронізації руками.
 */

export const COLUMN_MIN_WIDTH = 40
export const COLUMN_MAX_WIDTH = 800
export const COLUMN_DEFAULT_WIDTH = 120

/*
 * Date зводиться до мітки часу ДО будь-яких порівнянь. Без цього дата
 * падала в гілку рядків, і `toString()` сортував за назвою дня тижня:
 * «Fri…» < «Mon…» < «Thu…» — хронологія виходила випадковою. Невалідна
 * дата і NaN — порожні: компаратор, що повертає NaN, ламає sort цілком.
 */
function sortable(value: unknown): unknown {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.getTime()
  if (typeof value === 'number' && Number.isNaN(value)) return null
  return value
}

/**
 * Порівняння значень комірок.
 *
 * Наївні `<` і `>` ставлять «Розділ 10» перед «Розділ 9», а кирилицю
 * сортують за кодами символів. Порожні значення завжди в кінці,
 * незалежно від напрямку: рядок без даних не має витісняти заповнені з
 * початку. Дати порівнюються хронологічно.
 */
export function compareValues(rawA: unknown, rawB: unknown, direction: 1 | -1): number {
  const a = sortable(rawA)
  const b = sortable(rawB)
  const aEmpty = a === null || a === undefined || a === ''
  const bEmpty = b === null || b === undefined || b === ''
  if (aEmpty && bEmpty) return 0
  if (aEmpty) return 1
  if (bEmpty) return -1

  if (typeof a === 'number' && typeof b === 'number') return direction * (a - b)
  if (typeof a === 'boolean' && typeof b === 'boolean') {
    return direction * (Number(a) - Number(b))
  }

  return direction * String(a).localeCompare(String(b), 'uk', {
    numeric: true,
    sensitivity: 'base',
  })
}

export function clampWidth(width: number): number {
  if (!Number.isFinite(width)) return COLUMN_DEFAULT_WIDTH
  return Math.min(COLUMN_MAX_WIDTH, Math.max(COLUMN_MIN_WIDTH, Math.round(width)))
}

/**
 * Мінімальна ширина таблиці.
 *
 * Ширина flex-колонки входить у мінімум, а не виключається з нього: за
 * `table-layout: fixed` колонка без width отримує ЗАЛИШОК, і якщо
 * мінімум дорівнює сумі фіксованих, залишку не лишається — flex-колонка
 * схлопується в нуль.
 */
export function columnsMinWidth(headers: { width?: number }[], selectionWidth: number): number {
  const columns = headers.reduce((sum, header) => sum + (header.width ?? COLUMN_DEFAULT_WIDTH), 0)
  return columns + selectionWidth
}

/**
 * Скільки колонок, видимих ТИПОВО, користувач сховав.
 *
 * Прихована колонка — єдина частина розкладки, якої не видно в самій
 * таблиці: порядок і ширини читаються оком, відсутність — ні. Кнопка
 * налаштувань ховається до наведення, тож без окремого сигналу шлях назад
 * до схованої колонки був би невидимим двічі. Колонки, сховані дефолтами
 * споживача, не рахуються: це його рішення, а не зміна користувача.
 */
export function countHiddenByUser(
  current: { value: string; visible?: boolean }[],
  defaults: { value: string; visible?: boolean }[],
): number {
  const visibleByDefault = new Set(
    defaults.filter((header) => header.visible !== false).map((header) => header.value),
  )
  return current.filter((header) => header.visible === false && visibleByDefault.has(header.value)).length
}

export interface StoredColumn {
  value: string
  width?: number
  visible?: boolean
}

/**
 * Зведення збереженої розкладки зі свіжими колонками.
 *
 * Нова колонка вставляється ПІСЛЯ найближчого лівого сусіда, а не в
 * кінець: інакше колонка, додана через пів року, стрибала б у хвіст у
 * кожного користувача, який колись міняв порядок.
 *
 * `pinned` (колонка ієрархії) завжди виходить першою і видимою — вона
 * несе відступ, шеврон і напрямні, а збережена розкладка зі старої
 * версії цілком могла її сховати або відсунути.
 */
export function mergeColumnSettings<H extends { value: string; width?: number; visible?: boolean }>(
  incoming: H[],
  saved: StoredColumn[] | null,
  pinned?: string,
): H[] {
  const normalize = (header: H, stored?: StoredColumn): H => ({
    ...header,
    width: stored?.width ?? header.width ?? COLUMN_DEFAULT_WIDTH,
    visible: stored?.visible ?? header.visible !== false,
  })

  let ordered: H[]

  if (!saved) {
    ordered = incoming.map((header) => normalize(header))
  } else {
    const pool = new Map(incoming.map((header) => [header.value, header]))
    ordered = []

    // Спершу — у збереженому порядку: перевпорядкування користувача живе.
    for (const stored of saved) {
      const original = pool.get(stored.value)
      if (!original) continue
      ordered.push(normalize(original, stored))
      pool.delete(stored.value)
    }

    // Далі — нові колонки, кожна поруч зі своїм сусідом із props.
    for (let i = 0; i < incoming.length; i++) {
      const header = incoming[i]!
      if (!pool.has(header.value)) continue
      let insertAt = ordered.length
      for (let j = i - 1; j >= 0; j--) {
        const previous = ordered.findIndex((h) => h.value === incoming[j]!.value)
        if (previous !== -1) {
          insertAt = previous + 1
          break
        }
      }
      ordered.splice(insertAt, 0, normalize(header))
      pool.delete(header.value)
    }
  }

  if (!pinned) return ordered
  const at = ordered.findIndex((header) => header.value === pinned)
  if (at === -1) return ordered
  const [column] = ordered.splice(at, 1)
  ordered.unshift({ ...column!, visible: true })
  return ordered
}
