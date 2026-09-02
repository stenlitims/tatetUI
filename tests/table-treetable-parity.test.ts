/**
 * Спільна стилістика UiTable і UiTreeTable.
 *
 * Обидві таблиці ділять панель налаштувань, арифметику колонок і той
 * самий каркас: `border-separate`, роздільники-псевдоелементи, закріплена
 * перша колонка з тінню, оверлей оновлення. Розходження тут — це не
 * косметика: воно означає, що спільний код десь знову роздвоївся.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import UiTable from '~/components/ui/UiTable.vue'
import UiTreeTable from '~/components/ui/UiTreeTable.vue'
import { mountComponent } from './helpers/mountComponent'
const headers = [
  { value: 'name', text: 'Назва', width: 200, sortable: true },
  { value: 'sum', text: 'Сума', width: 100, align: 'right' as const },
]

const flatItems = [
  { id: 1, name: 'Альфа', sum: 10 },
  { id: 2, name: 'Бета', sum: 20 },
]

const treeItems = [{ id: 1, name: 'Альфа', sum: 10 }, { id: 2, name: 'Бета', sum: 20 }]

let mounted: Awaited<ReturnType<typeof mountComponent>> | null = null

afterEach(() => {
  mounted?.unmount()
  mounted = null
  document.body.innerHTML = ''
})

describe('утиліти колонок спільні', () => {
  it('обидві таблиці сортують «Розділ 10» після «Розділ 9»', async () => {
    const items = [
      { id: 1, name: 'Розділ 10', sum: 1 },
      { id: 2, name: 'Розділ 9', sum: 2 },
    ]
    mounted = await mountComponent(UiTable, {
      headers,
      items,
      sort: { by: 'name', dir: 'asc' },
    })
    const flat = [...mounted.host.querySelectorAll('tbody tr')].map((row) =>
      row.textContent?.trim().split(/\s+/)[0],
    )
    mounted.unmount()

    mounted = await mountComponent(UiTreeTable, {
      headers,
      items,
      sort: { by: 'name', dir: 'asc' },
    })
    const tree = [...mounted.host.querySelectorAll('tbody tr[aria-level]')].map((row) =>
      row.textContent?.trim().split(/\s+/)[0],
    )
    expect(flat).toEqual(['Розділ', 'Розділ'])
    expect(tree).toEqual(flat)
  })
})

describe('UiTable: каркас як у дерева', () => {
  it('таблиця border-separate, а роздільник рядка — псевдоелемент комірки', async () => {
    mounted = await mountComponent(UiTable, { headers, items: flatItems })
    const table = mounted.host.querySelector<HTMLTableElement>('table')!
    expect(table.className).toContain('border-separate')
    expect(table.style.borderSpacing).toBe('0')

    const cell = mounted.host.querySelector<HTMLElement>('tbody td')!
    // relative обов'язковий: без нього after: позиціонується не по комірці.
    expect(cell.className).toContain('relative')
    expect(cell.className).toContain('after:bg-line')
    // Роздільник однаковий на ВСІХ комірках; останній рядок гасить його
    // правилом у scoped-CSS (утиліта `last:[&>td]:after:hidden` не
    // генерується Tailwind — перевірено на зібраному CSS).
    const cells = [...mounted.host.querySelectorAll<HTMLElement>('tbody td')]
    expect(cells.every((el) => el.className.includes('after:bg-line'))).toBe(true)
  })

  it('stickyColumn закріплює першу колонку, а з прапорцями — за їхньою', async () => {
    mounted = await mountComponent(UiTable, { headers, items: flatItems, stickyColumn: true })
    let cells = [...mounted.host.querySelectorAll<HTMLElement>('tbody tr:first-child td')]
    expect(cells[0]!.className).toContain('sticky')
    expect(cells[0]!.style.left).toBe('0px')
    // Друга колонка не закріплюється ніколи.
    expect(cells[1]!.className).not.toContain('sticky')

    await mounted.update({ selectable: true, selected: [] })
    cells = [...mounted.host.querySelectorAll<HTMLElement>('tbody tr:first-child td')]
    expect(cells[0]!.className).toContain('left-0')
    expect(cells[1]!.style.left).toBe('44px')
  })

  it('loading з наявними даними показує оверлей, а не скелетон', async () => {
    mounted = await mountComponent(UiTable, { headers, items: flatItems, loading: true })
    expect(mounted.host.querySelectorAll('tbody tr')).toHaveLength(2)
    expect(mounted.host.textContent).toContain('Оновлення…')
    expect(mounted.host.querySelector('table')?.getAttribute('aria-busy')).toBe('true')
    // Оверлей — поза контейнером прокрутки, інакше він їхав би з рядками.
    const overlay = [...mounted.host.querySelectorAll<HTMLElement>('div')].find((el) =>
      el.textContent?.includes('Оновлення…'),
    )!
    expect(overlay.closest('[class*="overflow-auto"]')).toBeNull()
  })

  it('зміна density згори застосовується без зміни колонок', async () => {
    mounted = await mountComponent(UiTable, { headers, items: flatItems, density: 'md' })
    const cell = () => mounted!.host.querySelector<HTMLElement>('tbody td')!
    expect(cell().className).toContain('py-2.5')
    await mounted.update({ density: 'sm' })
    expect(cell().className).toContain('py-1.5')
  })
})

describe('спільна панель налаштувань', () => {
  it('плоска таблиця дозволяє рухати першу колонку, дерево — ні', async () => {
    mounted = await mountComponent(UiTable, { headers, items: flatItems, tableId: 'parity-flat' })
    mounted.host.querySelector<HTMLButtonElement>('[aria-label="Налаштування колонок"]')!.click()
    await nextTick()
    await nextTick()
    const up = [...document.body.querySelectorAll<HTMLButtonElement>('[aria-label^="Перемістити"]')]
    // Перша колонка: «вище» вимкнено (нікуди), «нижче» доступне.
    expect(up[0]!.disabled).toBe(true)
    expect(up[1]!.disabled).toBe(false)
    mounted.unmount()
    document.body.innerHTML = ''

    mounted = await mountComponent(UiTreeTable, {
      headers,
      items: treeItems,
      tableId: 'parity-tree',
    })
    mounted.host.querySelector<HTMLButtonElement>('[aria-label="Налаштування колонок"]')!.click()
    await nextTick()
    await nextTick()
    const treeButtons = [
      ...document.body.querySelectorAll<HTMLButtonElement>('[aria-label^="Перемістити"]'),
    ]
    // Колонка ієрархії закріплена: обидві кнопки вимкнені.
    expect(treeButtons[0]!.disabled).toBe(true)
    expect(treeButtons[1]!.disabled).toBe(true)
  })

  it('перестановка колонки в панелі доходить до таблиці', async () => {
    const updates: unknown[][] = []
    mounted = await mountComponent(UiTable, {
      headers,
      items: flatItems,
      tableId: 'parity-move',
      'onUpdate:headers': (next: unknown[]) => updates.push(next),
    })
    mounted.host.querySelector<HTMLButtonElement>('[aria-label="Налаштування колонок"]')!.click()
    await nextTick()
    await nextTick()
    const down = document.body.querySelector<HTMLButtonElement>(
      '[aria-label="Перемістити «Назва» нижче"]',
    )!
    down.click()
    await nextTick()
    const order = [...mounted.host.querySelectorAll('thead th')].map((th) => th.textContent?.trim())
    expect(order).toEqual(['Сума', 'Назва'])
    expect((updates.at(-1) as { value: string }[]).map((h) => h.value)).toEqual(['sum', 'name'])
  })
})
