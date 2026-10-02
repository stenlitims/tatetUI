/**
 * Кнопка налаштувань колонок у куті шапки.
 *
 * Розкладку happy-dom не рахує, тож перевіряється те, що її задає: де
 * кнопка стоїть у DOM, які класи позиціювання отримує і за яких умов.
 * Кожна перевірка тут ловить конкретний тихий дефект — кнопку, що
 * повернулася рядком над таблицею, кут, що прилип до верху без липкої
 * шапки, або крапку, сховану разом з іконкою.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import UiTable from '~/components/ui/UiTable.vue'
import UiTreeTable from '~/components/ui/UiTreeTable.vue'
import TableColumnSettings from '~/components/ui/table/ColumnSettings.vue'
import { countHiddenByUser } from '~/utils/tableColumns'
import { mountComponent } from './helpers/mountComponent'

const headers = [
  { value: 'name', text: 'Назва', width: 200, sortable: true },
  { value: 'sum', text: 'Сума', width: 100, align: 'right' as const },
]

const items = [
  { id: 1, name: 'Альфа', sum: 10 },
  { id: 2, name: 'Бета', sum: 20 },
]

const TRIGGER = '[aria-label^="Налаштування колонок"]'

let mounted: Awaited<ReturnType<typeof mountComponent>> | null = null

afterEach(() => {
  mounted?.unmount()
  mounted = null
  document.body.innerHTML = ''
  localStorage.clear()
})

function corner(host: HTMLElement) {
  return host.querySelector<HTMLElement>('.group\\/corner')
}

async function openPanel(host: HTMLElement) {
  corner(host)!.querySelector<HTMLButtonElement>('button')!.click()
  await nextTick()
  await nextTick()
  return document.body.querySelector<HTMLElement>('[role="dialog"][aria-label="Налаштування колонок"]')!
}

describe('UiTable: кнопка в куті шапки', () => {
  it('живе всередині контейнера прокрутки, а не рядком над таблицею', async () => {
    mounted = await mountComponent(UiTable, { headers, items, tableId: 'corner-place' })
    const triggers = mounted.host.querySelectorAll(TRIGGER)
    expect(triggers).toHaveLength(1)

    const scroller = mounted.host.querySelector('.overflow-auto')!
    expect(scroller.contains(triggers[0]!)).toBe(true)

    // Та сама клітинка сітки, що й таблиця, — накладка, а не сусід.
    const zone = corner(mounted.host)!
    const table = scroller.querySelector('table')!
    for (const el of [zone, table]) {
      expect(el.className).toContain('col-start-1')
      expect(el.className).toContain('row-start-1')
    }
    expect(zone.className).toContain('sticky')
    expect(zone.className).toContain('right-0')

    // Перед таблицею в DOM: Tab доходить до налаштувань, не обходячи рядки.
    expect(zone.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('кріпиться до верху лише разом із липкою шапкою', async () => {
    mounted = await mountComponent(UiTable, {
      headers,
      items,
      tableId: 'corner-sticky',
      stickyHeader: true,
      maxHeight: '20rem',
    })
    expect(corner(mounted.host)!.className).toContain('top-0')

    // Шапка без власного контейнера прокрутки не липне — кут теж.
    await mounted.update({ maxHeight: undefined })
    expect(corner(mounted.host)!.className).not.toContain('top-0')

    await mounted.update({ fill: true })
    expect(corner(mounted.host)!.className).toContain('top-0')

    await mounted.update({ stickyHeader: false })
    expect(corner(mounted.host)!.className).not.toContain('top-0')
  })

  it('без tableId немає ні кнопки, ні рядка над таблицею', async () => {
    mounted = await mountComponent(UiTable, { headers, items })
    expect(mounted.host.querySelector(TRIGGER)).toBeNull()
    const root = mounted.host.firstElementChild!
    expect(root.querySelector(':scope > .mb-2')).toBeNull()
  })

  it('з мобільними картками кнопка дублюється в рядку над ними, лише нижче md', async () => {
    mounted = await mountComponent(UiTable, { headers, items, tableId: 'corner-cards', mobileCards: true })
    const triggers = [...mounted.host.querySelectorAll<HTMLElement>(TRIGGER)]
    expect(triggers).toHaveLength(2)

    const scroller = mounted.host.querySelector('.overflow-auto')!
    const [toolbar] = triggers.filter((button) => !scroller.contains(button))
    const row = toolbar!.closest('.mb-2')!
    expect(row.className).toContain('md:hidden')
    // Поруч із сортуванням, яке на картках теж живе в цьому рядку.
    expect(row.querySelector('select')).not.toBeNull()
  })

  it('каркас ізолює z-index шапки від липкої шапки сторінки', async () => {
    mounted = await mountComponent(UiTable, { headers, items, tableId: 'corner-iso' })
    const frame = mounted.host.querySelector('.overflow-auto')!.parentElement!
    expect(frame.className).toContain('isolate')
    expect(frame.className).toContain('group/table')
  })

  it('остання колонка шапки віддає місце кнопці лише на дотику', async () => {
    mounted = await mountComponent(UiTable, { headers, items, tableId: 'corner-reserve' })
    const ths = () => [...mounted!.host.querySelectorAll<HTMLElement>('thead th')]
    expect(ths().at(-1)!.className).toContain('pointer-coarse:pe-9')
    expect(ths()[0]!.className).not.toContain('pointer-coarse:pe-')

    await mounted.update({ density: 'sm' })
    expect(ths().at(-1)!.className).toContain('pointer-coarse:pe-8')

    await mounted.update({ tableId: undefined })
    expect(ths().at(-1)!.className).not.toContain('pointer-coarse:pe-')
  })

  it('схована користувачем колонка вмикає крапку й називає себе в мітці', async () => {
    mounted = await mountComponent(UiTable, { headers, items, tableId: 'corner-dot' })
    const button = () => corner(mounted!.host)!.querySelector<HTMLButtonElement>('button')!
    expect(button().getAttribute('aria-label')).toBe('Налаштування колонок')
    expect(button().querySelector('.bg-accent-solid')).toBeNull()

    const panel = await openPanel(mounted.host)
    const sum = [...panel.querySelectorAll('label')].find((label) => label.textContent?.includes('Сума'))!
    sum.querySelector<HTMLInputElement>('input')!.click()
    await nextTick()

    expect(button().getAttribute('aria-label')).toBe('Налаштування колонок (приховано: 1)')
    const dot = button().querySelector<HTMLElement>('.bg-accent-solid')!
    expect(dot).not.toBeNull()
    // Крапку видно і в спокої: між нею й кнопкою немає вузла з opacity-0.
    expect(dot.parentElement).toBe(button())
    expect(button().className).not.toContain('opacity-0')
  })

  it('колонка, схована дефолтами споживача, крапки не вмикає', async () => {
    mounted = await mountComponent(UiTable, {
      headers: [...headers, { value: 'note', text: 'Примітка', width: 120, visible: false }],
      items,
      tableId: 'corner-defaults',
    })
    const button = corner(mounted.host)!.querySelector<HTMLButtonElement>('button')!
    expect(button.getAttribute('aria-label')).toBe('Налаштування колонок')
    expect(button.querySelector('.bg-accent-solid')).toBeNull()
  })
})

describe('UiTreeTable: той самий кут', () => {
  it('кнопка в контейнері прокрутки, кут липне до верху завжди', async () => {
    mounted = await mountComponent(UiTreeTable, { headers, items, tableId: 'tree-corner' })
    const triggers = mounted.host.querySelectorAll(TRIGGER)
    expect(triggers).toHaveLength(1)
    expect(mounted.host.querySelector('.overflow-auto')!.contains(triggers[0]!)).toBe(true)

    const zone = corner(mounted.host)!
    // Шапка дерева липка безумовно — і кут разом із нею.
    expect(zone.className).toContain('top-0')
    expect(zone.className).toContain('right-0')

    const frame = mounted.host.querySelector('.overflow-auto')!.parentElement!
    expect(frame.className).toContain('isolate')
    expect([...mounted.host.querySelectorAll<HTMLElement>('thead th')].at(-1)!.className)
      .toContain('pointer-coarse:pe-9')
  })

  it('рядок над картками — лише з mobileCards і лише нижче md', async () => {
    mounted = await mountComponent(UiTreeTable, {
      headers,
      items,
      tableId: 'tree-cards',
      mobileCards: true,
    })
    const scroller = mounted.host.querySelector('.overflow-auto')!
    const outside = [...mounted.host.querySelectorAll<HTMLElement>(TRIGGER)].filter(
      (button) => !scroller.contains(button),
    )
    expect(outside).toHaveLength(1)
    expect(outside[0]!.closest('.mb-2')!.className).toContain('md:hidden')
  })
})

describe('ColumnSettings: підкладка кута', () => {
  const settingsProps = {
    headers: headers.map((header) => ({ ...header, visible: true })),
    density: 'md' as const,
    densityToggle: true,
    trigger: 'corner' as const,
  }

  it('відкриває останні 4px лише там, де праворуч край таблиці', async () => {
    mounted = await mountComponent(TableColumnSettings, settingsProps)
    const backdrop = () => mounted!.host.querySelector<HTMLElement>('.group\\/corner > span[aria-hidden="true"]')!
    // Край останньої колонки з її хватом ресайзу — смуга відкрита.
    expect(backdrop().className).toContain('right-1')

    // Посеред прокрутки там шматок чужого заголовка — закрито до краю.
    await mounted.update({ overflowsRight: true })
    expect(backdrop().className).toContain('right-0')
    expect(backdrop().className).not.toContain('right-1')
  })

  it('кутовий корінь без власного position — його задає хост', async () => {
    mounted = await mountComponent(TableColumnSettings, settingsProps)
    const root = mounted.host.querySelector<HTMLElement>('.group\\/corner')!
    expect(root.className).not.toMatch(/\b(relative|absolute|sticky|fixed)\b/)
  })
})

describe('countHiddenByUser', () => {
  const defaults = [
    { value: 'a' },
    { value: 'b' },
    { value: 'c', visible: false },
  ]

  it('рахує лише колонки, видимі типово', () => {
    expect(countHiddenByUser([{ value: 'a' }, { value: 'b' }, { value: 'c', visible: false }], defaults)).toBe(0)
    expect(countHiddenByUser([{ value: 'a', visible: false }, { value: 'b' }, { value: 'c', visible: false }], defaults)).toBe(1)
  })

  it('показана користувачем типово схована колонка не рахується', () => {
    expect(countHiddenByUser([{ value: 'a' }, { value: 'b', visible: false }, { value: 'c', visible: true }], defaults)).toBe(1)
  })

  it('колонка, якої вже немає в дефолтах, не рахується', () => {
    expect(countHiddenByUser([{ value: 'gone', visible: false }], defaults)).toBe(0)
  })
})
