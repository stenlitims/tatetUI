import { describe, expect, it } from 'vitest'
import {
  keysBetween,
  selectionState,
  subtractKeys,
  unionKeys,
} from '~/utils/tableSelection'

describe('tableSelection', () => {
  it('selectionState розрізняє none / some / all', () => {
    expect(selectionState([1, 2, 3], new Set())).toBe('none')
    expect(selectionState([1, 2, 3], new Set([2]))).toBe('some')
    expect(selectionState([1, 2, 3], new Set([1, 2, 3]))).toBe('all')
    // Порожня сторінка не «вибрана вся».
    expect(selectionState([], new Set([1]))).toBe('none')
    // Ключі поза сторінкою на її стан не впливають.
    expect(selectionState([1, 2], new Set([1, 2, 99]))).toBe('all')
  })

  it('unionKeys не плодить дублів і зберігає порядок', () => {
    expect(unionKeys([1, 2], [2, 3])).toEqual([1, 2, 3])
    expect(unionKeys([], ['a', 'a'])).toEqual(['a'])
    expect(unionKeys([3, 1], [2])).toEqual([3, 1, 2])
  })

  it('subtractKeys лишає решту в тому ж порядку', () => {
    expect(subtractKeys([1, 2, 3], [2])).toEqual([1, 3])
    expect(subtractKeys([1, 2, 3], [9])).toEqual([1, 2, 3])
    expect(subtractKeys([1, 2, 3], [1, 2, 3])).toEqual([])
  })

  it('keysBetween працює в обидва боки й у порядку показу', () => {
    const shown = [10, 20, 30, 40, 50]
    expect(keysBetween(shown, 20, 40)).toEqual([20, 30, 40])
    expect(keysBetween(shown, 40, 20)).toEqual([20, 30, 40])
    expect(keysBetween(shown, 30, 30)).toEqual([30])
  })

  it('невідомий якір не тягне за собою всю таблицю', () => {
    // Якір зник (сторінка змінилась) — виділяємо лише ціль.
    expect(keysBetween([1, 2, 3], 99, 2)).toEqual([2])
  })
})

/* ------------------------------------------------------------------ */
/*  Поведінка UiTable з selectable                                    */
/* ------------------------------------------------------------------ */

import { afterEach, vi } from 'vitest'
import { nextTick } from 'vue'
import UiTable from '~/components/ui/UiTable.vue'
import { mountComponent } from './helpers/mountComponent'

const headers = [
  { value: 'name', text: 'Назва', width: 200, flex: true, sortable: true },
  { value: 'sum', text: 'Сума', width: 100, align: 'right' as const },
]
const rows = [
  { id: 1, name: 'Альфа', sum: 10 },
  { id: 2, name: 'Бета', sum: 20 },
  { id: 3, name: 'Гама', sum: 30 },
  { id: 4, name: 'Дельта', sum: 40, locked: true },
]

let table: Awaited<ReturnType<typeof mountComponent>> | null = null
afterEach(() => {
  table?.unmount()
  table = null
})

const boxes = () => [...table!.host.querySelectorAll<HTMLInputElement>('tbody input[type="checkbox"]')]
const master = () => table!.host.querySelector<HTMLInputElement>('thead input[type="checkbox"]')!

describe('UiTable: вибір рядків', () => {
  it('без selectable розмітка не змінюється взагалі', async () => {
    table = await mountComponent(UiTable, { headers, items: rows, keyRow: 'id' })
    expect(table.host.querySelectorAll('input[type="checkbox"]')).toHaveLength(0)
    expect(table.host.querySelectorAll('thead th')).toHaveLength(2)
    expect(table.host.querySelectorAll('col')).toHaveLength(2)
  })

  it('додає колонку прапорців і враховує її в мінімальній ширині', async () => {
    table = await mountComponent(UiTable, { headers, items: rows, keyRow: 'id', selectable: true })
    expect(table.host.querySelectorAll('thead th')).toHaveLength(3)
    expect(table.host.querySelectorAll('col')).toHaveLength(3)
    // 200 + 100 + 44 колонки прапорців.
    const min = table.host.querySelector('table')!.style.minWidth
    expect(min).toBe('344px')
  })

  it('заголовковий прапорець показує indeterminate на частковому виборі', async () => {
    table = await mountComponent(UiTable, {
      headers, items: rows, keyRow: 'id', selectable: true, selected: [1],
    })
    expect(master().indeterminate).toBe(true)
    expect(master().checked).toBe(false)

    // Усі ДОСТУПНІ (без locked) — це вже «all».
    await table.update({ selected: [1, 2, 3, 4] })
    expect(master().indeterminate).toBe(false)
    expect(master().checked).toBe(true)
  })

  it('«обрати всі» ОБ\'ЄДНУЄ з наявним набором, не замінює його', async () => {
    const seen: Array<Array<string | number>> = []
    table = await mountComponent(UiTable, {
      headers, items: rows, keyRow: 'id', selectable: true,
      selected: [99], // ключ з ІНШОЇ сторінки
      selectableRow: (item: Record<string, unknown>) => !item.locked,
      'onUpdate:selected': (value: Array<string | number>) => seen.push(value),
    })
    master().click()
    await nextTick()
    // Ключ 99 вцілів, 4 (недоступний) не потрапив.
    expect(seen.at(-1)).toEqual([99, 1, 2, 3])
  })

  it('зняття вибору забирає лише ключі поточної сторінки', async () => {
    const seen: Array<Array<string | number>> = []
    table = await mountComponent(UiTable, {
      headers, items: rows, keyRow: 'id', selectable: true,
      // Вся сторінка вибрана — тоді клік по шапці саме ЗНІМАЄ вибір.
      // З частковим вибором той самий клік навпаки добирає решту.
      selected: [99, 1, 2, 3, 4],
      'onUpdate:selected': (value: Array<string | number>) => seen.push(value),
    })
    expect(master().checked).toBe(true)
    master().click()
    await nextTick()
    expect(seen.at(-1)).toEqual([99])
  })

  it('selectableRow виключає рядок із вибору', async () => {
    table = await mountComponent(UiTable, {
      headers, items: rows, keyRow: 'id', selectable: true,
      selectableRow: (item: Record<string, unknown>) => !item.locked,
    })
    expect(boxes().at(-1)!.disabled).toBe(true)
    expect(boxes()[0]!.disabled).toBe(false)
  })

  it('Shift+клік виділяє діапазон у порядку показу', async () => {
    const seen: Array<Array<string | number>> = []
    table = await mountComponent(UiTable, {
      headers, items: rows, keyRow: 'id', selectable: true, selected: [],
      'onUpdate:selected': (value: Array<string | number>) => {
        seen.push(value)
        table!.props.selected = value
      },
    })
    // Якір без Shift.
    boxes()[0]!.click()
    await nextTick()
    expect(seen.at(-1)).toEqual([1])

    // Shift ловиться на комірці ДО того, як UiCheckbox емітить change.
    const cell = boxes()[2]!.closest('td')!
    cell.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, shiftKey: true }))
    boxes()[2]!.click()
    await nextTick()
    expect(seen.at(-1)).toEqual([1, 2, 3])
  })

  it('кожен прапорець має власне ім\'я з назви рядка', async () => {
    table = await mountComponent(UiTable, { headers, items: rows, keyRow: 'id', selectable: true })
    const labels = [...table.host.querySelectorAll('tbody .sr-only')].map((el) => el.textContent)
    expect(labels[0]).toBe('Обрати рядок Альфа')
    expect(table.host.querySelector('thead .sr-only')?.textContent).toBe('Обрати всі рядки на сторінці')
  })

  it('панель «Вибрано N» зʼявляється лише з вибором', async () => {
    table = await mountComponent(UiTable, { headers, items: rows, keyRow: 'id', selectable: true, selected: [] })
    expect(table.host.textContent).not.toContain('Вибрано')

    await table.update({ selected: [1, 2] })
    expect(table.host.querySelector('[role="status"]')?.textContent?.trim()).toBe('Вибрано 2')
  })

  it('порожній стан розтягується на всі колонки, включно з прапорцями', async () => {
    table = await mountComponent(UiTable, { headers, items: [], keyRow: 'id', selectable: true })
    const cell = table.host.querySelector('tbody td')!
    expect(cell.getAttribute('colspan')).toBe('3')
  })

  it('сортування не плутає вибір, бо він ключується по keyRow', async () => {
    table = await mountComponent(UiTable, {
      headers, items: rows, keyRow: 'id', selectable: true, selected: [1],
      sort: { by: 'name', dir: 'desc' },
    })
    // Після сортування «Альфа» — останній рядок, але вибраним лишається саме він.
    const checked = boxes().filter((box) => box.checked)
    expect(checked).toHaveLength(1)
    const row = checked[0]!.closest('tr')!
    expect(row.textContent).toContain('Альфа')
  })
})
