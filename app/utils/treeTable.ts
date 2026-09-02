/**
 * Чиста арифметика дерева-таблиці.
 *
 * Винесено з UiTreeTable з тієї ж причини, що й `tableSelection`: «які
 * рядки видно», «який діапазон рендериться» і «що станеться з набором
 * ключів» — три речі, які мусять перевірятись без DOM. Віртуалізація
 * ламається саме на арифметиці, а очима зсув на пів екрана видно лише
 * тоді, коли до нього доскролили.
 */

import { selectionState, subtractKeys, unionKeys, type SelectionKey } from './tableSelection'

/* ---------------------------------------------------------------- */
/*  Плоский зріз дерева                                             */
/* ---------------------------------------------------------------- */

export interface TreeRow<T> {
  item: T
  id: SelectionKey
  /** Позиція в плоскому списку — вона ж індекс вікна й клавіатури. */
  index: number
  depth: number
  /**
   * Індекс батька в ПЛОСКОМУ списку, -1 для кореня.
   *
   * Порахований тут, щоб ← працювала за O(1). Пошук батька по id на
   * кожне натискання — це скан усього списку щокадру при автоповторі.
   */
  parentIndex: number
  parentId: SelectionKey | null
  hasChildren: boolean
  expanded: boolean
  /**
   * Прапорці вертикальних ліній для колонок ліворуч від коліна.
   *
   * Довжина — `max(0, depth - 1)`, бо остання колонка рядка завжди
   * зайнята КОЛІНОМ, а нульовий рівень ліній не має взагалі: корені між
   * собою драбиною не з'єднуються.
   *
   * `guides[j]` відповідає на питання «чи триває лінія в колонці `j`
   * НИЖЧЕ цього рядка», тобто чи є ще діти в предка, якому ця колонка
   * належить. Це НЕ «чи має предок наступного сусіда» — саме через цю
   * підміну вертикаль з'їжджала на колонку від шеврона батька.
   */
  guides: boolean[]
  /** Чи є наступний сусід у самого рядка — нижня половина «коліна». */
  hasNextSibling: boolean
  /** 1-based позиція серед СУСІДІВ — `aria-posinset`. */
  posinset: number
  /** Кількість сусідів — `aria-setsize`. */
  setsize: number
}

export interface FlattenOptions<T> {
  getId: (item: T) => SelectionKey
  getChildren: (item: T) => T[] | undefined
  hasChildren: (item: T) => boolean
  isExpanded: (id: SelectionKey) => boolean
  /** Порівняння СУСІДІВ. `null` — лишити порядок джерела. */
  compare?: ((a: T, b: T) => number) | null
}

/**
 * Дерево → список видимих рядків. Гілки без розгортання не заходять у
 * дітей, тож у шаблоні лишається один `v-for`.
 */
export function flattenTree<T>(roots: T[], options: FlattenOptions<T>): TreeRow<T>[] {
  const rows: TreeRow<T>[] = []
  const compare = options.compare ?? null

  const walk = (
    nodes: T[],
    depth: number,
    parentIndex: number,
    parentId: SelectionKey | null,
    guides: boolean[],
  ) => {
    /*
     * Копія: сортування на місці мутувало б масив, переданий ззовні.
     *
     * Сортуються ЛИШЕ сусіди. Ієрархія структурно не може сплющитись,
     * бо walk сортує рівно той масив, у який зараз спускається, і
     * ніколи не бачить двох рівнів одночасно.
     */
    const ordered = compare ? [...nodes].sort(compare) : nodes
    const setsize = ordered.length

    for (let i = 0; i < setsize; i++) {
      const item = ordered[i]!
      const id = options.getId(item)
      const hasChildren = options.hasChildren(item)
      /*
       * expanded ВИВОДИТЬСЯ, а не зберігається.
       *
       * Гілка, яка після завантаження виявилась порожньою, тихо стає
       * листком і не тягне за собою aria-expanded. Тим самим рухом
       * знешкоджуються застарілі id після оновлення даних: чистити
       * набір розгорнутих не треба — на вузли, яких уже немає, він не
       * впливає, а чистка воювала б із v-model:expanded.
       */
      const expanded = hasChildren && options.isExpanded(id)
      const hasNextSibling = i < setsize - 1
      const index = rows.length

      rows.push({
        item,
        id,
        index,
        depth,
        parentIndex,
        parentId,
        hasChildren,
        expanded,
        guides,
        hasNextSibling,
        posinset: i + 1,
        setsize,
      })

      if (!expanded) continue
      const children = options.getChildren(item)
      /*
       * `undefined` і `[]` — РІЗНІ стани, і саме тут різниця важить.
       * `undefined` — діти ще їдуть (ліниве завантаження), рядок
       * лишається зайнятим; `[]` — гілка справді порожня. Рядків нуль в
       * обох випадках, але перший ще чекає на споживача.
       */
      if (!children?.length) continue
      /*
       * Діти дістають колонку, у якій стояло коліно цього вузла, —
       * і в ній лінія триває рівно тоді, коли в самого вузла є
       * наступний сусід. Для коренів (depth 0) колонки немає взагалі:
       * коліно кореня не малюється, тож і продовжувати нічого.
       *
       * guides спільний за посиланням для всіх дітей вузла: він лише
       * читається, тож це один масив на гілку, а не на рядок.
       */
      walk(children, depth + 1, index, id, depth === 0 ? [] : [...guides, hasNextSibling])
    }
  }

  walk(roots, 0, -1, null, [])
  return rows
}

/* ---------------------------------------------------------------- */
/*  Вікно віртуалізації                                             */
/* ---------------------------------------------------------------- */

export interface WindowRange {
  /** Перший рендерений рядок. */
  start: number
  /** Останній рендерений рядок включно. `-1`, коли рядків немає. */
  end: number
  /** Висота верхньої розпірки в пікселях. */
  topPad: number
  /** Висота нижньої розпірки в пікселях. */
  bottomPad: number
}

/**
 * Діапазон рядків для рендеру плюс висоти розпірок.
 *
 * Інваріант, який тримає всю віртуалізацію:
 * `topPad + (end - start + 1) * rowHeight + bottomPad === total * rowHeight`.
 * Порушити його — означає зсунути хвіст списку, і саме тому це чиста
 * функція з тестом, а не вираз усередині шаблону.
 */
export function windowRange(
  total: number,
  rowHeight: number,
  scrollTop: number,
  viewport: number,
  overscan: number,
): WindowRange {
  if (!(total > 0)) return { start: 0, end: -1, topPad: 0, bottomPad: 0 }

  const height = Number.isFinite(rowHeight) && rowHeight > 0 ? rowHeight : 1
  const pad = Number.isFinite(overscan) ? Math.max(0, Math.floor(overscan)) : 0
  const top = Number.isFinite(scrollTop) ? Math.max(0, scrollTop) : 0
  const view = Number.isFinite(viewport) ? Math.max(0, viewport) : 0

  // Клампимо start зверху теж: позиція скролу може пережити скорочення
  // набору (згорнули гілку), і тоді start сам по собі вийшов би за хвіст.
  const start = Math.min(total - 1, Math.max(0, Math.floor(top / height) - pad))
  const end = Math.min(total - 1, Math.max(start, Math.ceil((top + view) / height) + pad))

  return {
    start,
    end,
    topPad: start * height,
    bottomPad: Math.max(0, (total - 1 - end) * height),
  }
}

/* ---------------------------------------------------------------- */
/*  Пошук і фільтри                                                 */
/* ---------------------------------------------------------------- */

export interface FilterOptions<T> {
  getId: (item: T) => SelectionKey
  getChildren: (item: T) => T[] | undefined
  /** Копія вузла з іншим списком дітей. Вихідне дерево не мутується. */
  withChildren: (item: T, children: T[]) => T
  /** Чи підходить САМ вузол. Предки збігу лишаються попри це. */
  matches: (item: T) => boolean
}

export interface FilteredTree<T> {
  items: T[]
  /** Ключі вузлів, які збіглися САМІ, — для лічильника «знайдено N». */
  matched: SelectionKey[]
  /** Гілки результату. Під фільтром їх треба розгорнути, інакше збіг лишиться захованим. */
  expand: SelectionKey[]
}

/**
 * Фільтрує дерево, зберігаючи предків збігів.
 *
 * Плоский `filter` тут не працює принципово: вузол, що збігся, без
 * предків втрачає єдине, що робить його зрозумілим, — місце в ієрархії.
 * Тому вузол лишається, якщо збігся сам АБО якщо збігся хтось у його
 * піддереві.
 *
 * Діти фільтруються завжди, навіть у вузла, що збігся сам. Інакше
 * фільтр «лише активні» показував би вимкнених дітей активної теки —
 * тобто рівно те, що просили сховати. Наслідок: тека, у якої не лишилось
 * жодної дитини, рендериться як листок.
 */
export function filterTree<T>(roots: T[], options: FilterOptions<T>): FilteredTree<T> {
  const matched: SelectionKey[] = []
  const expand: SelectionKey[] = []

  const walk = (nodes: T[]): T[] => {
    const kept: T[] = []
    for (const item of nodes) {
      const children = options.getChildren(item)
      const keptChildren = children?.length ? walk(children) : []
      const self = options.matches(item)
      if (!self && !keptChildren.length) continue

      const id = options.getId(item)
      if (self) matched.push(id)
      if (keptChildren.length) expand.push(id)

      /*
       * Той самий об'єкт, якщо піддерево не змінилось.
       *
       * Без цієї перевірки кожне натискання клавіші в пошуку роздає
       * НОВИЙ об'єкт кожному вузлу, :key лишається, але вміст рядка
       * вважається зміненим — і Vue перемальовує все дерево замість
       * кількох рядків, що справді змінились.
       */
      const childCount = children?.length ?? 0
      const same =
        childCount === keptChildren.length &&
        keptChildren.every((child, index) => child === children![index])
      kept.push(same ? item : options.withChildren(item, keptChildren))
    }
    return kept
  }

  return { items: walk(roots), matched, expand }
}

/* ---------------------------------------------------------------- */
/*  Індекс піддерев                                                 */
/* ---------------------------------------------------------------- */

export interface TreeKeyIndex {
  /** id → ключі піддерева БЕЗ самого вузла, у порядку обходу. */
  descendants: Map<SelectionKey, SelectionKey[]>
  /** id → ключі предків, від найближчого до кореня. */
  ancestors: Map<SelectionKey, SelectionKey[]>
  /** Усі ключі дерева в порядку обходу. */
  all: SelectionKey[]
}

export interface IndexOptions<T> {
  getId: (item: T) => SelectionKey
  getChildren: (item: T) => T[] | undefined
}

/**
 * Індекс усього дерева — включно зі згорнутими гілками.
 *
 * Каскад виділення і «розгорнути до вузла» питають про вузли, яких зараз
 * немає на екрані, тож обхід тут повний. Дорого: мемоізуйте в `computed`
 * і не будуйте взагалі, поки виділення вимкнене.
 */
export function indexTree<T>(roots: T[], options: IndexOptions<T>): TreeKeyIndex {
  const descendants = new Map<SelectionKey, SelectionKey[]>()
  const ancestors = new Map<SelectionKey, SelectionKey[]>()
  const all: SelectionKey[] = []

  const walk = (nodes: T[], chain: SelectionKey[]): SelectionKey[] => {
    const collected: SelectionKey[] = []
    for (const item of nodes) {
      const id = options.getId(item)
      all.push(id)
      ancestors.set(id, chain)
      const children = options.getChildren(item)
      const sub = children?.length ? walk(children, [id, ...chain]) : []
      descendants.set(id, sub)
      collected.push(id, ...sub)
    }
    return collected
  }

  walk(roots, [])
  return { descendants, ancestors, all }
}

/* ---------------------------------------------------------------- */
/*  Каскадне виділення                                              */
/* ---------------------------------------------------------------- */

/** Ключі гілки — сам вузол разом із усіма нащадками. */
export function branchKeys(
  index: TreeKeyIndex,
  id: SelectionKey,
  canSelect?: (id: SelectionKey) => boolean,
): SelectionKey[] {
  const keys = [id, ...(index.descendants.get(id) ?? [])]
  return canSelect ? keys.filter(canSelect) : keys
}

/**
 * Перемикання гілки. Нових примітивів не додає — це `unionKeys` /
 * `subtractKeys` над ключами піддерева.
 */
export function cascadeSelect(
  current: SelectionKey[],
  index: TreeKeyIndex,
  id: SelectionKey,
  next: boolean,
  canSelect?: (id: SelectionKey) => boolean,
): SelectionKey[] {
  const keys = branchKeys(index, id, canSelect)
  return next ? unionKeys(current, keys) : subtractKeys(current, keys)
}

/**
 * Стан прапорця гілки.
 *
 * Асиметрія навмисна: `checked` береться з САМОГО вузла, а не з
 * `selectionState([id, ...descendants])`. Інакше набір, що прийшов із
 * сервера з дітьми, але без батька, показував би повністю обрану гілку
 * як `indeterminate`.
 */
export function branchSelection(
  index: TreeKeyIndex,
  id: SelectionKey,
  selected: ReadonlySet<SelectionKey>,
): { checked: boolean; indeterminate: boolean } {
  if (selected.has(id)) return { checked: true, indeterminate: false }
  const descendants = index.descendants.get(id) ?? []
  return { checked: false, indeterminate: selectionState(descendants, selected) !== 'none' }
}

/**
 * Доливає щойно завантажених нащадків до вже позначених гілок.
 *
 * Ліниве завантаження робить виділення матеріалізованим не одразу: тека
 * позначена, а її дітей на той момент ще не було. Без цього кроку
 * розгортання показало б непозначених дітей під позначеним батьком.
 *
 * Ідемпотентна і повертає ВХІДНИЙ масив, коли додавати нічого — тож
 * виклик у watch можна гасити звичайним порівнянням по посиланню.
 */
export function reconcileLazySelection(
  current: SelectionKey[],
  index: TreeKeyIndex,
  canSelect?: (id: SelectionKey) => boolean,
): SelectionKey[] {
  const chosen = new Set(current)
  const add: SelectionKey[] = []
  for (const id of current) {
    for (const child of index.descendants.get(id) ?? []) {
      if (chosen.has(child)) continue
      if (canSelect && !canSelect(child)) continue
      chosen.add(child)
      add.push(child)
    }
  }
  return add.length ? unionKeys(current, add) : current
}

/* ---------------------------------------------------------------- */
/*  Колонки                                                         */
/*                                                                  */
/*  Живуть у tableColumns.ts — їх ділить із плоским UiTable.         */
/*  Ре-експорту тут немає навмисно: Nuxt автоімпортує обидва модулі, */
/*  і однакове ім'я у двох файлах дає дубльований автоімпорт, який   */
/*  збірка розв'язує на свій розсуд. Імпортуйте звідти напряму.      */
/* ---------------------------------------------------------------- */
