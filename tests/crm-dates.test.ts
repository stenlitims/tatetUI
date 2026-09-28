import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import UiCalendar from '~/components/ui/UiCalendar.vue'
import UiDateRangePicker from '~/components/ui/UiDateRangePicker.vue'
import { mountComponent } from './helpers/mountComponent'

const TODAY = new Date(2026, 7, 17) // 17 серпня 2026, понеділок

beforeAll(() => {
  HTMLElement.prototype.scrollIntoView ??= () => undefined
})

let mounted: Awaited<ReturnType<typeof mountComponent>> | null = null
afterEach(() => {
  mounted?.unmount()
  mounted = null
})

const days = () => [...mounted!.host.querySelectorAll<HTMLElement>('td [role="gridcell"], td button')]
const focused = () => mounted!.host.querySelector<HTMLElement>('[data-focused="true"]')!
const press = (key: string, init: KeyboardEventInit = {}) => {
  focused().dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...init }))
}

describe('UiCalendar: сітка й семантика', () => {
  it('рендерить рівно 42 комірки в кожному місяці', async () => {
    mounted = await mountComponent(UiCalendar, { today: TODAY, month: new Date(2026, 1, 1) })
    expect(mounted.host.querySelectorAll('td')).toHaveLength(42)
    // Лютий 2026 вміщається в 5 тижнів, але рядків усе одно шість.
    expect(mounted.host.querySelectorAll('tbody tr')).toHaveLength(6)
  })

  it('приховані сусідні дні лишаються комірками', async () => {
    mounted = await mountComponent(UiCalendar, { today: TODAY, showOutsideDays: false })
    expect(mounted.host.querySelectorAll('td')).toHaveLength(42)
    // Кожен рядок має по 7 клітинок — цього вимагає role="grid".
    for (const row of mounted.host.querySelectorAll('tbody tr')) {
      expect(row.querySelectorAll('td')).toHaveLength(7)
    }
  })

  it('день несе повну дату в назві, а число сховане', async () => {
    mounted = await mountComponent(UiCalendar, { today: TODAY })
    const cell = mounted.host.querySelector<HTMLElement>('[aria-current="date"]')!
    expect(cell.getAttribute('aria-label')).toContain('17 серпня 2026')
    expect(cell.getAttribute('aria-label')).toContain('понеділок')
    expect(cell.querySelector('[aria-hidden="true"]')?.textContent).toBe('17')
  })

  it('заголовки колонок мають повну назву дня, а видиму — скорочену', async () => {
    mounted = await mountComponent(UiCalendar, { today: TODAY })
    const first = mounted.host.querySelector('thead th')!
    expect(first.getAttribute('aria-label')).toBe('понеділок')
    expect(first.querySelector('[aria-hidden="true"]')?.textContent).not.toBe('понеділок')
  })

  it('недоступний день лишається фокусованим, а не disabled', async () => {
    mounted = await mountComponent(UiCalendar, {
      today: TODAY,
      disabledDate: (date: Date) => date.getDate() === 20,
    })
    const blocked = [...mounted.host.querySelectorAll<HTMLButtonElement>('td button')]
      .find((el) => el.getAttribute('aria-label')?.includes('20 серпня'))!
    expect(blocked.getAttribute('aria-disabled')).toBe('true')
    expect(blocked.disabled).toBe(false)
  })
})

describe('UiCalendar: клавіатура', () => {
  it('рівно один день у табуляції', async () => {
    mounted = await mountComponent(UiCalendar, { today: TODAY, months: 2 })
    const tabbable = [...mounted.host.querySelectorAll('td button')].filter((el) => el.getAttribute('tabindex') === '0')
    expect(tabbable).toHaveLength(1)
  })

  it('стрілки рухають фокус на день і на тиждень', async () => {
    mounted = await mountComponent(UiCalendar, { today: TODAY })
    expect(focused().getAttribute('aria-label')).toContain('17 серпня')

    press('ArrowRight'); await nextTick()
    expect(focused().getAttribute('aria-label')).toContain('18 серпня')

    press('ArrowDown'); await nextTick()
    expect(focused().getAttribute('aria-label')).toContain('25 серпня')

    press('ArrowUp'); await nextTick()
    press('ArrowLeft'); await nextTick()
    expect(focused().getAttribute('aria-label')).toContain('17 серпня')
  })

  it('Home і End ідуть на межі тижня', async () => {
    mounted = await mountComponent(UiCalendar, { today: new Date(2026, 7, 19) })
    press('Home'); await nextTick()
    expect(focused().getAttribute('aria-label')).toContain('17 серпня')
    press('End'); await nextTick()
    expect(focused().getAttribute('aria-label')).toContain('23 серпня')
  })

  it('PageUp/PageDown гортають місяць, Shift — рік', async () => {
    const seen: Date[] = []
    mounted = await mountComponent(UiCalendar, {
      today: TODAY,
      'onUpdate:month': (value: Date) => seen.push(value),
    })
    press('PageDown'); await nextTick()
    expect(focused().getAttribute('aria-label')).toContain('17 вересня')
    expect(seen.at(-1)!.getMonth()).toBe(8)

    press('PageUp', { shiftKey: true }); await nextTick()
    expect(focused().getAttribute('aria-label')).toContain('2025')
  })

  it('рух затискається по min/max, а не блокується', async () => {
    mounted = await mountComponent(UiCalendar, {
      today: TODAY,
      min: new Date(2026, 7, 16),
      max: new Date(2026, 7, 18),
    })
    press('ArrowLeft'); await nextTick()
    expect(focused().getAttribute('aria-label')).toContain('16 серпня')
    // Далі межі фокус не йде, але й не застрягає в помилці.
    press('ArrowLeft'); await nextTick()
    expect(focused().getAttribute('aria-label')).toContain('16 серпня')
  })

  it('Enter обирає день', async () => {
    const picked: unknown[] = []
    mounted = await mountComponent(UiCalendar, {
      today: TODAY,
      'onUpdate:modelValue': (value: unknown) => picked.push(value),
    })
    press('Enter'); await nextTick()
    expect((picked.at(-1) as Date).getDate()).toBe(17)
  })
})

describe('UiCalendar: діапазон', () => {
  it('модель оновлюється лише коли відомі обидва кінці', async () => {
    const emitted: unknown[] = []
    mounted = await mountComponent(UiCalendar, {
      mode: 'range', today: TODAY, modelValue: null,
      'onUpdate:modelValue': (value: unknown) => emitted.push(value),
    })
    const cell = (label: string) =>
      [...mounted!.host.querySelectorAll<HTMLButtonElement>('td button')]
        .find((el) => el.getAttribute('aria-label')?.includes(label))!

    cell('10 серпня').click(); await nextTick()
    // Перший клік назовні не виходить.
    expect(emitted).toHaveLength(0)

    cell('19 серпня').click(); await nextTick()
    expect(emitted).toHaveLength(1)
    const [start, end] = emitted[0] as [Date, Date]
    expect(start.getDate()).toBe(10)
    expect(end.getDate()).toBe(19)
  })

  it('перевернутий вибір нормалізується', async () => {
    const emitted: unknown[] = []
    mounted = await mountComponent(UiCalendar, {
      mode: 'range', today: TODAY, modelValue: null,
      'onUpdate:modelValue': (value: unknown) => emitted.push(value),
    })
    const cell = (label: string) =>
      [...mounted!.host.querySelectorAll<HTMLButtonElement>('td button')]
        .find((el) => el.getAttribute('aria-label')?.includes(label))!
    cell('19 серпня').click(); await nextTick()
    cell('10 серпня').click(); await nextTick()
    const [start, end] = emitted[0] as [Date, Date]
    expect(start.getDate()).toBe(10)
    expect(end.getDate()).toBe(19)
  })

  it('кінці діапазону названі словами, і всі дні між ними виділені', async () => {
    mounted = await mountComponent(UiCalendar, {
      mode: 'range', today: TODAY,
      modelValue: [new Date(2026, 7, 10), new Date(2026, 7, 12)],
    })
    const labels = [...mounted.host.querySelectorAll('td button')].map((el) => el.getAttribute('aria-label')!)
    expect(labels.find((l) => l.includes('10 серпня'))).toContain('початок періоду')
    expect(labels.find((l) => l.includes('12 серпня'))).toContain('кінець періоду')

    const selected = [...mounted.host.querySelectorAll('td[aria-selected="true"]')]
    expect(selected).toHaveLength(3)
  })
})

describe('UiDateRangePicker', () => {
  it('на вузькому екрані показує ОДИН місяць — інакше ламається roving tabindex', async () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    } as unknown as MediaQueryList)
    mounted = await mountComponent(UiDateRangePicker, { today: TODAY })
    mounted.host.querySelector('button')!.click()
    await nextTick(); await nextTick()

    const grids = document.body.querySelectorAll('[role="grid"]')
    expect(grids).toHaveLength(1)
    const tabbable = [...document.body.querySelectorAll('td button')].filter((el) => el.getAttribute('tabindex') === '0')
    expect(tabbable).toHaveLength(1)
  })

  it('на широкому — два місяці, але все ще один tabindex=0', async () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    } as unknown as MediaQueryList)
    mounted = await mountComponent(UiDateRangePicker, { today: TODAY })
    mounted.host.querySelector('button')!.click()
    await nextTick(); await nextTick()

    expect(document.body.querySelectorAll('[role="grid"]')).toHaveLength(2)
    const tabbable = [...document.body.querySelectorAll('td button')].filter((el) => el.getAttribute('tabindex') === '0')
    expect(tabbable).toHaveLength(1)
  })

  it('пресет за межами min/max зі списку зникає', async () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    } as unknown as MediaQueryList)
    mounted = await mountComponent(UiDateRangePicker, {
      today: TODAY,
      min: new Date(2026, 7, 10), // десять днів тому
    })
    mounted.host.querySelector('button')!.click()
    await nextTick(); await nextTick()

    const labels = [...document.body.querySelectorAll('[role="dialog"] button')].map((el) => el.textContent?.trim())
    expect(labels).toContain('Останні 7 днів')
    // «Останні 30 днів» вийшли б за min — пропозиція, яку календар відхилить.
    expect(labels).not.toContain('Останні 30 днів')
  })

  it('пресет дає обʼєкт {start,end} і окрему подію', async () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    } as unknown as MediaQueryList)
    const values: unknown[] = []
    const presets: unknown[] = []
    mounted = await mountComponent(UiDateRangePicker, {
      today: TODAY,
      'onUpdate:modelValue': (value: unknown) => values.push(value),
      onPresetSelect: (preset: unknown) => presets.push(preset),
    })
    mounted.host.querySelector('button')!.click()
    await nextTick(); await nextTick()

    const seven = [...document.body.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')]
      .find((el) => el.textContent?.trim() === 'Останні 7 днів')!
    seven.click()
    await nextTick()

    const range = values.at(-1) as { start: Date; end: Date }
    expect(range.start.getDate()).toBe(11)
    expect(range.end.getDate()).toBe(17)
    expect(presets).toHaveLength(1)
  })

  it('Tab докручує смугу пресетів до пресету цілим, тап — ні', async () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    } as unknown as MediaQueryList)
    mounted = await mountComponent(UiDateRangePicker, { today: TODAY })
    mounted.host.querySelector('button')!.click()
    await nextTick(); await nextTick()

    // Шпигун — після відкриття: фокус переходить у календар, і це не пресет.
    const scrolled: unknown[] = []
    vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(function (this: HTMLElement, options) {
      scrolled.push([this.textContent?.trim(), options])
    })
    const preset = (label: string) =>
      [...document.body.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find((el) => el.textContent?.trim() === label)!

    // Тап: пресет без :focus-visible. Прокрутка зсунула б його з-під пальця.
    preset('Цей місяць').dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    expect(scrolled).toEqual([])

    preset('Останні 30 днів').focus()
    expect(scrolled).toEqual([['Останні 30 днів', { block: 'nearest', inline: 'nearest' }]])
    // Докручений пресет стає на ту саму відстань від краю панелі, що й перший.
    expect(preset('Сьогодні').parentElement!.className.split(/\s+/)).toContain('scroll-px-3')
  })

  it('тригер має dialog-семантику й очищення', async () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    } as unknown as MediaQueryList)
    const values: unknown[] = []
    mounted = await mountComponent(UiDateRangePicker, {
      today: TODAY,
      modelValue: { start: new Date(2026, 7, 1), end: new Date(2026, 7, 17) },
      'onUpdate:modelValue': (value: unknown) => values.push(value),
    })
    const trigger = mounted.host.querySelector('button')!
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(trigger.textContent).toContain('01.08.2026')

    mounted.host.querySelector<HTMLButtonElement>('[aria-label="Очистити період"]')!.click()
    await nextTick()
    expect(values.at(-1)).toBeNull()
  })

  it('помилка має пріоритет в описі й role=alert', async () => {
    mounted = await mountComponent(UiDateRangePicker, {
      today: TODAY,
      hint: 'Підказка',
      error: 'Оберіть коректний період',
    })
    const trigger = mounted.host.querySelector<HTMLButtonElement>('button')!
    const described = trigger.getAttribute('aria-describedby')!
    expect(described.split(' ')).toHaveLength(1)
    const error = mounted.host.querySelector<HTMLElement>(`#${described}`)!
    expect(error.textContent).toContain('Оберіть коректний період')
    expect(error.getAttribute('role')).toBe('alert')
  })
})
