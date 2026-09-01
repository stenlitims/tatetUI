import { describe, expect, it } from 'vitest'
import {
  branchSelection,
  cascadeSelect,
  clampWidth,
  columnsMinWidth,
  compareValues,
  flattenTree,
  indexTree,
  mergeColumnSettings,
  reconcileLazySelection,
  windowRange,
  type TreeRow,
} from '~/utils/treeTable'

interface Node extends Record<string, unknown> {
  id: number
  name: string
  children?: Node[]
  /** Гілка, дітей якої ще не завантажили. */
  branch?: boolean
}

/*
 * Дерево, у якого кожен рівень має і «середнього», і останнього сусіда —
 * інакше напрямні лінії неможливо перевірити: вони саме про те, чи є в
 * предка наступний сусід.
 */
const tree: Node[] = [
  {
    id: 1,
    name: 'Довідка',
    children: [
      {
        id: 11,
        name: 'Формати реклами',
        children: [
          { id: 111, name: 'Банерна реклама' },
          { id: 112, name: 'Зовнішня реклама' },
        ],
      },
      { id: 12, name: 'Статті' },
    ],
  },
  { id: 2, name: 'Головна' },
]

function options(expanded: number[], compare: ((a: Node, b: Node) => number) | null = null) {
  return {
    getId: (node: Node) => node.id,
    getChildren: (node: Node) => node.children,
    hasChildren: (node: Node) => node.branch ?? (node.children?.length ?? 0) > 0,
    isExpanded: (id: string | number) => expanded.includes(id as number),
    compare,
  }
}

const ids = (rows: TreeRow<Node>[]) => rows.map((row) => row.id)
const byId = (rows: TreeRow<Node>[], id: number) => rows.find((row) => row.id === id)!

describe('flattenTree', () => {
  it('згорнуте дерево дає лише корені', () => {
    expect(ids(flattenTree(tree, options([])))).toEqual([1, 2])
  })

  it('розгортання додає дітей одразу за батьком і рахує глибину', () => {
    const rows = flattenTree(tree, options([1, 11]))
    expect(ids(rows)).toEqual([1, 11, 111, 112, 12, 2])
    expect(rows.map((row) => row.depth)).toEqual([0, 1, 2, 2, 1, 0])
    expect(rows.map((row) => row.index)).toEqual([0, 1, 2, 3, 4, 5])
  })

  it('parentIndex вказує на батька в ПЛОСКОМУ списку', () => {
    const rows = flattenTree(tree, options([1, 11]))
    expect(byId(rows, 1).parentIndex).toBe(-1)
    expect(byId(rows, 2).parentIndex).toBe(-1)
    expect(byId(rows, 11).parentIndex).toBe(0)
    expect(byId(rows, 111).parentIndex).toBe(1)
    expect(byId(rows, 112).parentIndex).toBe(1)
    expect(byId(rows, 12).parentIndex).toBe(0)
  })

  it('guides описують предків, у яких є наступний сусід', () => {
    const rows = flattenTree(tree, options([1, 11]))
    // 1 має наступного сусіда (2), 11 має наступного сусіда (12) —
    // отже під 111 малюються обидві вертикалі.
    expect(byId(rows, 111).guides).toEqual([true, true])
    expect(byId(rows, 111).hasNextSibling).toBe(true)
    // 112 — останній серед сусідів: коліно без нижньої половини.
    expect(byId(rows, 112).hasNextSibling).toBe(false)
    // 12 — останній на своєму рівні, але його предок 1 сусіда ще має.
    expect(byId(rows, 12).guides).toEqual([true])
    expect(byId(rows, 12).hasNextSibling).toBe(false)
    expect(byId(rows, 2).guides).toEqual([])
  })

  it('posinset і setsize рахуються серед СУСІДІВ, а не в усьому списку', () => {
    const rows = flattenTree(tree, options([1, 11]))
    expect(byId(rows, 111)).toMatchObject({ posinset: 1, setsize: 2 })
    expect(byId(rows, 112)).toMatchObject({ posinset: 2, setsize: 2 })
    expect(byId(rows, 2)).toMatchObject({ posinset: 2, setsize: 2 })
  })

  it('листок лишається згорнутим, навіть якщо його id є в наборі відкритих', () => {
    const rows = flattenTree(tree, options([2]))
    expect(byId(rows, 2).expanded).toBe(false)
    expect(byId(rows, 2).hasChildren).toBe(false)
  })

  it('гілка без завантажених дітей лишається розгорнутою і БЕЗ рядків', () => {
    const lazy: Node[] = [{ id: 9, name: 'Каталог', branch: true }]
    const rows = flattenTree(lazy, options([9]))
    expect(ids(rows)).toEqual([9])
    expect(rows[0]).toMatchObject({ hasChildren: true, expanded: true })
  })

  it('гілка, що виявилась порожньою, лишається гілкою за hasChildren', () => {
    const empty: Node[] = [{ id: 9, name: 'Каталог', branch: true, children: [] }]
    const rows = flattenTree(empty, options([9]))
    expect(ids(rows)).toEqual([9])
    expect(rows[0]).toMatchObject({ hasChildren: true, expanded: true })
  })

  it('сортування переставляє лише сусідів — дитина ніколи не йде перед батьком', () => {
    const desc = (a: Node, b: Node) => compareValues(a.name, b.name, -1)
    const rows = flattenTree(tree, options([1, 11], desc))
    // Спадання перевертає КОЖЕН рівень окремо: «Довідка» перед
    // «Головною», «Зовнішня» перед «Банерною» — але 111 і 112 лишаються
    // під своїм 11, а не спливають до коренів.
    expect(ids(rows)).toEqual([1, 11, 112, 111, 12, 2])
    for (const row of rows) {
      expect(row.parentIndex).toBeLessThan(row.index)
    }
  })

  it('сортування не мутує масив, переданий ззовні', () => {
    const roots = [...tree]
    const order = roots.map((node) => node.id)
    flattenTree(roots, options([1, 11], (a, b) => compareValues(a.name, b.name, -1)))
    expect(roots.map((node) => node.id)).toEqual(order)
    expect(tree[0]!.children!.map((node) => node.id)).toEqual([11, 12])
  })
})

describe('windowRange', () => {
  it('порожній набір не рендерить нічого', () => {
    expect(windowRange(0, 36, 0, 600, 5)).toEqual({ start: 0, end: -1, topPad: 0, bottomPad: 0 })
  })

  it('SSR-дефолти дають перший екран, а не порожнечу', () => {
    // scrollTop = 0, viewport = 600 (фолбек до виміру) — той самий
    // діапазон на сервері й у першому клієнтському рендері.
    const range = windowRange(500, 36, 0, 600, 5)
    expect(range.start).toBe(0)
    expect(range.end).toBe(Math.ceil(600 / 36) + 5)
    expect(range.topPad).toBe(0)
  })

  it('тримає інваріант topPad + вікно + bottomPad === повна висота', () => {
    for (const scrollTop of [0, 37, 400, 5_000, 17_964]) {
      const range = windowRange(500, 36, scrollTop, 420, 5)
      const rendered = (range.end - range.start + 1) * 36
      expect(range.topPad + rendered + range.bottomPad).toBe(500 * 36)
    }
  })

  it('позиція скролу за межами набору не дає порожнього вікна', () => {
    // Згорнули гілку: рядків стало 10, а scrollTop лишився від 500.
    const range = windowRange(10, 36, 17_000, 420, 5)
    expect(range.start).toBeLessThanOrEqual(range.end)
    expect(range.end).toBe(9)
  })

  it('нульова висота рядка не ділить на нуль', () => {
    const range = windowRange(10, 0, 100, 420, 5)
    expect(Number.isFinite(range.start)).toBe(true)
    expect(range.end).toBe(9)
  })
})

/* ------------------------------------------------------------------ */
/*  Каскадне виділення                                                */
/* ------------------------------------------------------------------ */

const index = indexTree(tree, {
  getId: (node: Node) => node.id,
  getChildren: (node: Node) => node.children,
})

describe('indexTree', () => {
  it('обходить УСЕ дерево, не лише розгорнуте', () => {
    expect(index.all).toEqual([1, 11, 111, 112, 12, 2])
    expect(index.descendants.get(1)).toEqual([11, 111, 112, 12])
    expect(index.descendants.get(11)).toEqual([111, 112])
    expect(index.descendants.get(2)).toEqual([])
  })

  it('предки йдуть від найближчого до кореня', () => {
    expect(index.ancestors.get(111)).toEqual([11, 1])
    expect(index.ancestors.get(1)).toEqual([])
  })
})

describe('cascadeSelect', () => {
  it('позначення гілки бере сам вузол і всіх нащадків', () => {
    expect(cascadeSelect([], index, 11, true)).toEqual([11, 111, 112])
  })

  it('зняття гілки прибирає рівно її, лишаючи решту в тому ж порядку', () => {
    const selected = cascadeSelect([7], index, 1, true)
    expect(selected).toEqual([7, 1, 11, 111, 112, 12])
    expect(cascadeSelect(selected, index, 11, false)).toEqual([7, 1, 12])
  })

  it('незбиральні вузли не потрапляють у каскад', () => {
    const canSelect = (id: string | number) => id !== 111
    expect(cascadeSelect([], index, 11, true, canSelect)).toEqual([11, 112])
  })
})

describe('branchSelection', () => {
  it('частково обрана гілка дає indeterminate, а не порожній прапорець', () => {
    expect(branchSelection(index, 11, new Set([111]))).toEqual({
      checked: false,
      indeterminate: true,
    })
  })

  it('обраний вузол ніколи не показується як indeterminate', () => {
    expect(branchSelection(index, 11, new Set([11, 111]))).toEqual({
      checked: true,
      indeterminate: false,
    })
  })

  it('листок без нащадків не буває indeterminate', () => {
    expect(branchSelection(index, 2, new Set([1]))).toEqual({
      checked: false,
      indeterminate: false,
    })
  })
})

describe('reconcileLazySelection', () => {
  it('доливає щойно завантажених нащадків до позначеної гілки', () => {
    expect(reconcileLazySelection([11], index)).toEqual([11, 111, 112])
  })

  it('ідемпотентна і повертає ВХІДНИЙ масив, коли додавати нічого', () => {
    const current = [11, 111, 112]
    expect(reconcileLazySelection(current, index)).toBe(current)
  })
})

/* ------------------------------------------------------------------ */
/*  Колонки                                                           */
/* ------------------------------------------------------------------ */

describe('compareValues', () => {
  it('«Розділ 10» йде після «Розділ 9», а не перед ним', () => {
    expect(compareValues('Розділ 10', 'Розділ 9', 1)).toBeGreaterThan(0)
  })

  it('порожні значення в кінці за обох напрямків', () => {
    expect(compareValues(null, 'Аа', 1)).toBeGreaterThan(0)
    expect(compareValues(null, 'Аа', -1)).toBeGreaterThan(0)
    expect(compareValues('', 5, 1)).toBeGreaterThan(0)
  })

  it('числа порівнюються як числа', () => {
    expect(compareValues(9, 10, 1)).toBeLessThan(0)
  })
})

describe('clampWidth / columnsMinWidth', () => {
  it('ширина затискається в межі й округлюється', () => {
    expect(clampWidth(12)).toBe(40)
    expect(clampWidth(10_000)).toBe(800)
    expect(clampWidth(120.6)).toBe(121)
    expect(clampWidth(Number.NaN)).toBe(120)
  })

  it('мінімум таблиці враховує flex-колонку і колонку прапорців', () => {
    // Колонка без width рахується як 120: інакше за table-layout: fixed
    // залишку не лишається й вона схлопується в нуль.
    expect(columnsMinWidth([{ width: 200 }, {}], 44)).toBe(364)
  })
})

describe('mergeColumnSettings', () => {
  const incoming = [
    { value: 'name', text: 'Назва', width: 240 },
    { value: 'alias', text: 'Alias', width: 160 },
    { value: 'sort', text: 'Сорт.', width: 80 },
  ]

  it('без збереженого — дефолти з props плюс явна видимість', () => {
    expect(mergeColumnSettings(incoming, null)).toEqual([
      { value: 'name', text: 'Назва', width: 240, visible: true },
      { value: 'alias', text: 'Alias', width: 160, visible: true },
      { value: 'sort', text: 'Сорт.', width: 80, visible: true },
    ])
  })

  it('збережений порядок і ширини переважають', () => {
    const merged = mergeColumnSettings(incoming, [
      { value: 'sort', width: 60, visible: false },
      { value: 'name', width: 300 },
    ])
    expect(merged.map((header) => header.value)).toEqual(['sort', 'name', 'alias'])
    expect(merged[0]).toMatchObject({ width: 60, visible: false })
    expect(merged[1]).toMatchObject({ width: 300 })
  })

  it('нова колонка стає поруч зі своїм сусідом, а не в хвіст', () => {
    const merged = mergeColumnSettings(incoming, [
      { value: 'sort' },
      { value: 'name' },
    ])
    // alias у props іде за name — отже і тут має стати одразу за ним.
    expect(merged.map((header) => header.value)).toEqual(['sort', 'name', 'alias'])
  })

  it('закріплена колонка виходить першою і видимою попри збережене', () => {
    const merged = mergeColumnSettings(
      incoming,
      [{ value: 'sort' }, { value: 'name', visible: false }],
      'name',
    )
    expect(merged.map((header) => header.value)).toEqual(['name', 'sort', 'alias'])
    expect(merged[0]!.visible).toBe(true)
  })
})

/* ------------------------------------------------------------------ */
/*  Поведінка UiTreeTable в DOM                                       */
/* ------------------------------------------------------------------ */

import { afterEach, beforeAll } from 'vitest'
import { nextTick } from 'vue'
import UiTreeTable from '~/components/ui/UiTreeTable.vue'
import { mountComponent } from './helpers/mountComponent'

beforeAll(() => {
  // happy-dom не має ані scrollTo, ані scrollIntoView; віртуалізація
  // кличе перше, а фокус — друге.
  HTMLElement.prototype.scrollTo ??= () => undefined
  HTMLElement.prototype.scrollIntoView ??= () => undefined
})

const headers = [
  { value: 'name', text: 'Структура', width: 200, sortable: true },
  { value: 'items', text: 'Товарів', width: 100, sortable: true },
]

/** Дерево з `roots` коренів по `kids` дітей — рівно стільки рядків, скільки треба. */
function makeTree(roots: number, kids: number): Node[] {
  return Array.from({ length: roots }, (_, r) => ({
    id: r + 1,
    name: `Корінь ${r + 1}`,
    items: r,
    children: Array.from({ length: kids }, (_, k) => ({
      id: (r + 1) * 1000 + k,
      name: `Дитина ${r + 1}.${k + 1}`,
      items: k,
    })),
  }))
}

let mounted: Awaited<ReturnType<typeof mountComponent>> | null = null

afterEach(() => {
  mounted?.unmount()
  mounted = null
  document.body.innerHTML = ''
})

const host = () => mounted!.host
const rows = () => [...host().querySelectorAll<HTMLElement>('tbody tr[aria-level]')]
const spacers = () => [...host().querySelectorAll<HTMLElement>('tbody tr[aria-hidden="true"]')]

describe('UiTreeTable: віртуалізація', () => {
  it('тримає в DOM вікно, а повну кількість повідомляє через aria-rowcount', async () => {
    const tree = makeTree(60, 4)
    const expanded = tree.map((node) => node.id)
    mounted = await mountComponent(UiTreeTable, { headers, items: tree, expanded })

    const table = host().querySelector('table')!
    expect(table.getAttribute('role')).toBe('treegrid')
    // 60 коренів + 240 дітей, плюс рядок шапки.
    expect(table.getAttribute('aria-rowcount')).toBe('301')
    // У DOM — лише вікно: інакше сенсу у віртуалізації немає.
    expect(rows().length).toBeLessThan(40)
  })

  it('розпірки добирають рівно ту висоту, якої бракує до повного полотна', async () => {
    const tree = makeTree(60, 4)
    const expanded = tree.map((node) => node.id)
    mounted = await mountComponent(UiTreeTable, { headers, items: tree, expanded })

    const padding = spacers().reduce(
      (sum, spacer) => sum + Number.parseFloat(spacer.style.height || '0'),
      0,
    )
    // Саме цей інваріант тримає хвіст списку на місці.
    expect(rows().length * 36 + padding).toBe(300 * 36)
    for (const spacer of spacers()) expect(spacer.getAttribute('aria-hidden')).toBe('true')
  })

  it('нижче порогу рендерить усе — Ctrl+F і друк лишаються робочими', async () => {
    const tree = makeTree(4, 2)
    const expanded = tree.map((node) => node.id)
    mounted = await mountComponent(UiTreeTable, { headers, items: tree, expanded })

    expect(rows()).toHaveLength(12)
    expect(spacers()).toHaveLength(0)
  })

  it('висота рядка — контракт: кожна комірка рівно rowHeight, без запасу на межу', async () => {
    mounted = await mountComponent(UiTreeTable, {
      headers,
      items: makeTree(3, 0),
      rowHeight: 44,
    })
    const cells = [...rows()[0]!.querySelectorAll<HTMLElement>('td > div')]
    expect(cells.length).toBeGreaterThan(0)
    for (const cell of cells) expect(cell.style.height).toBe('44px')
  })
})

describe('UiTreeTable: ARIA-геометрія', () => {
  it('рівень, позиція і розмір набору рахуються серед сусідів', async () => {
    const tree = makeTree(2, 3)
    mounted = await mountComponent(UiTreeTable, { headers, items: tree, expanded: [1] })

    const first = rows()[0]!
    expect(first.getAttribute('aria-level')).toBe('1')
    expect(first.getAttribute('aria-setsize')).toBe('2')
    expect(first.getAttribute('aria-expanded')).toBe('true')

    const child = rows()[1]!
    expect(child.getAttribute('aria-level')).toBe('2')
    expect(child.getAttribute('aria-posinset')).toBe('1')
    expect(child.getAttribute('aria-setsize')).toBe('3')
    // Листок НЕ має aria-expanded: інакше скрінрідер обіцяє гілку там,
    // де розгортати нічого.
    expect(child.hasAttribute('aria-expanded')).toBe(false)
  })

  it('колонка ієрархії — rowheader, решта — gridcell', async () => {
    mounted = await mountComponent(UiTreeTable, { headers, items: makeTree(1, 0) })
    const cells = [...rows()[0]!.querySelectorAll('td')]
    expect(cells[0]!.getAttribute('role')).toBe('rowheader')
    expect(cells[1]!.getAttribute('role')).toBe('gridcell')
  })

  it('сортована колонка несе aria-sort, несортована — ні', async () => {
    mounted = await mountComponent(UiTreeTable, {
      headers: [headers[0]!, { value: 'items', text: 'Товарів', width: 100 }],
      items: makeTree(1, 0),
      sort: { by: 'name', dir: 'desc' },
    })
    const ths = [...host().querySelectorAll('thead th')]
    expect(ths[0]!.getAttribute('aria-sort')).toBe('descending')
    expect(ths[1]!.hasAttribute('aria-sort')).toBe(false)
  })
})

describe('UiTreeTable: клавіатура', () => {
  const press = (row: HTMLElement, key: string) =>
    row.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))

  it('→ спершу розгортає гілку, а вже потім спускається до дитини', async () => {
    mounted = await mountComponent(UiTreeTable, { headers, items: makeTree(2, 2) })
    expect(rows()).toHaveLength(2)

    press(rows()[0]!, 'ArrowRight')
    await nextTick()
    expect(rows()).toHaveLength(4)

    press(rows()[0]!, 'ArrowRight')
    await nextTick()
    await nextTick()
    expect(document.activeElement).toBe(rows()[1])
  })

  it('← спершу згортає гілку, а вже потім підіймається до батька', async () => {
    mounted = await mountComponent(UiTreeTable, { headers, items: makeTree(2, 2), expanded: [1] })

    // З дитини — до батька.
    press(rows()[1]!, 'ArrowLeft')
    await nextTick()
    await nextTick()
    expect(document.activeElement).toBe(rows()[0])
    expect(rows()).toHaveLength(4)

    // З батька — згортання.
    press(rows()[0]!, 'ArrowLeft')
    await nextTick()
    expect(rows()).toHaveLength(2)
  })

  it('Home і End ходять по КРАЯХ списку, а не по вікну', async () => {
    const tree = makeTree(60, 4)
    mounted = await mountComponent(UiTreeTable, {
      headers,
      items: tree,
      expanded: tree.map((node) => node.id),
    })

    press(rows()[0]!, 'End')
    await nextTick()
    await nextTick()
    // Останній рядок лежав далеко за вікном — компонент мусив зсунути
    // вікно, а не мовчки нікуди не сфокусуватись.
    const active = document.activeElement as HTMLElement
    expect(active.getAttribute('aria-rowindex')).toBe('301')
  })

  it('* розкриває всіх сусідів рівня', async () => {
    mounted = await mountComponent(UiTreeTable, { headers, items: makeTree(3, 2) })
    press(rows()[0]!, '*')
    await nextTick()
    expect(rows()).toHaveLength(9)
  })
})

describe('UiTreeTable: сортування', () => {
  it('переставляє сусідів, не ламаючи вкладеності', async () => {
    mounted = await mountComponent(UiTreeTable, {
      headers,
      items: makeTree(3, 2),
      expanded: [1, 2, 3],
      sort: { by: 'name', dir: 'desc' },
    })

    const levels = rows().map((row) => Number(row.getAttribute('aria-level')))
    // Кожна дитина йде одразу за своїм батьком: рівень 2 ніколи не
    // з'являється раніше за рівень 1.
    expect(levels[0]).toBe(1)
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i]!).toBeLessThanOrEqual(levels[i - 1]! + 1)
    }
    const names = rows().map((row) => row.textContent?.trim() ?? '')
    expect(names[0]).toContain('Корінь 3')
  })

  it('третій клік по заголовку скидає сортування', async () => {
    const seen: unknown[] = []
    mounted = await mountComponent(UiTreeTable, {
      headers,
      items: makeTree(2, 0),
      'onUpdate:sort': (value: unknown) => seen.push(value),
    })
    const button = host().querySelector<HTMLElement>('thead th button')!
    button.click()
    await nextTick()
    button.click()
    await nextTick()
    button.click()
    await nextTick()
    expect(seen).toEqual([{ by: 'name', dir: 'asc' }, { by: 'name', dir: 'desc' }, null])
  })
})

describe('UiTreeTable: каскадне виділення', () => {
  const boxes = () => [...host().querySelectorAll<HTMLInputElement>('tbody input[type="checkbox"]')]
  const master = () => host().querySelector<HTMLInputElement>('thead input[type="checkbox"]')!

  it('вибір гілки бере всіх нащадків, зокрема згорнутих', async () => {
    const seen: Array<Array<string | number>> = []
    mounted = await mountComponent(UiTreeTable, {
      headers,
      items: makeTree(2, 2),
      selectable: true,
      'onUpdate:selected': (value: Array<string | number>) => seen.push(value),
    })
    // Гілка згорнута — її дітей на екрані немає, але вони мають потрапити.
    boxes()[0]!.click()
    await nextTick()
    expect(seen.at(-1)).toEqual([1, 1000, 1001])
  })

  it('батько показує indeterminate, поки обрано частину', async () => {
    mounted = await mountComponent(UiTreeTable, {
      headers,
      items: makeTree(1, 2),
      expanded: [1],
      selectable: true,
      selected: [1000],
    })
    expect(boxes()[0]!.indeterminate).toBe(true)
    expect(boxes()[0]!.getAttribute('aria-checked')).toBe('mixed')
    expect(master().indeterminate).toBe(true)
  })

  it('Space на рядку перемикає гілку — прапорці в Tab-порядку не потрібні', async () => {
    const seen: Array<Array<string | number>> = []
    mounted = await mountComponent(UiTreeTable, {
      headers,
      items: makeTree(1, 2),
      selectable: true,
      'onUpdate:selected': (value: Array<string | number>) => seen.push(value),
    })
    rows()[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
    await nextTick()
    expect(seen.at(-1)).toEqual([1, 1000, 1001])
  })

  it('доливає щойно завантажених дітей до вже позначеної гілки', async () => {
    const seen: Array<Array<string | number>> = []
    const lazy: Node[] = [{ id: 1, name: 'Каталог', branch: true }]
    mounted = await mountComponent(UiTreeTable, {
      headers,
      items: lazy,
      selectable: true,
      selected: [1],
      hasChildren: (item: Node) => item.branch ?? (item.children?.length ?? 0) > 0,
      'onUpdate:selected': (value: Array<string | number>) => seen.push(value),
    })
    expect(seen).toHaveLength(0)

    await mounted.update({
      items: [{ id: 1, name: 'Каталог', branch: true, children: [{ id: 11, name: 'Розділ' }] }],
    })
    await nextTick()
    expect(seen.at(-1)).toEqual([1, 11])
  })
})

describe('UiTreeTable: ліниве завантаження', () => {
  it('розгортання незавантаженої гілки повідомляє loaded: false', async () => {
    const seen: Array<{ id: string | number; loaded: boolean }> = []
    const lazy: Node[] = [{ id: 1, name: 'Каталог', branch: true }]
    mounted = await mountComponent(UiTreeTable, {
      headers,
      items: lazy,
      hasChildren: (item: Node) => item.branch ?? false,
      onExpand: (payload: { id: string | number; loaded: boolean }) => seen.push(payload),
    })

    rows()[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    await nextTick()
    expect(seen.at(-1)).toMatchObject({ id: 1, loaded: false })
    // Рядків не додалось, але гілка вже відкрита й позначена зайнятою.
    expect(rows()).toHaveLength(1)
    expect(rows()[0]!.getAttribute('aria-expanded')).toBe('true')
  })

  it('loadingIds ставить рядку aria-busy', async () => {
    const lazy: Node[] = [{ id: 1, name: 'Каталог', branch: true }]
    mounted = await mountComponent(UiTreeTable, {
      headers,
      items: lazy,
      loadingIds: [1],
      hasChildren: (item: Node) => item.branch ?? false,
    })
    expect(rows()[0]!.getAttribute('aria-busy')).toBe('true')
  })
})
