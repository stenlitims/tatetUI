import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { createSSRApp, h, nextTick } from 'vue'
import { renderToString } from '@vue/server-renderer'
import UiCalendar from '~/components/ui/UiCalendar.vue'
import UiCheckbox from '~/components/ui/UiCheckbox.vue'
import UiCombobox from '~/components/ui/UiCombobox.vue'
import UiDatePicker from '~/components/ui/UiDatePicker.vue'
import UiDateRangePicker from '~/components/ui/UiDateRangePicker.vue'
import UiFileUpload from '~/components/ui/UiFileUpload.vue'
import UiInlineEdit from '~/components/ui/UiInlineEdit.vue'
import UiInput from '~/components/ui/UiInput.vue'
import UiInputOtp from '~/components/ui/UiInputOtp.vue'
import UiMultiSelect from '~/components/ui/UiMultiSelect.vue'
import UiNumberInput from '~/components/ui/UiNumberInput.vue'
import UiRadioGroup from '~/components/ui/UiRadioGroup.vue'
import UiSelect from '~/components/ui/UiSelect.vue'
import UiSlider from '~/components/ui/UiSlider.vue'
import UiTagInput from '~/components/ui/UiTagInput.vue'
import UiTextarea from '~/components/ui/UiTextarea.vue'
import { toDateKey } from '~/utils/calendar'
import { clearButtonClass, dropdownSearchInputClass, fieldClass } from '~/utils/uiFieldStyles'
import { mountComponent } from './helpers/mountComponent'

/*
 * Регресійні тести для полів форми. Кожен блок відтворює конкретний баг,
 * який жив у бібліотеці: тест мусить падати на старому коді.
 */

const CITIES = [
  { value: 'kyiv', label: 'Київ' },
  { value: 'lviv', label: 'Львів' },
  { value: 'odesa', label: 'Одеса' },
]

let mounted: Awaited<ReturnType<typeof mountComponent>> | null = null

beforeAll(() => {
  HTMLElement.prototype.scrollIntoView ??= () => undefined
})

afterEach(() => {
  mounted?.unmount()
  mounted = null
  document.body.innerHTML = ''
})

/** Два такти: open() у полях вимірює панель після другого nextTick. */
async function settle() {
  await nextTick()
  await nextTick()
}

const host = () => mounted!.host
const key = (target: Element, name: string, init: KeyboardEventInit = {}) => {
  const event = new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true, ...init })
  target.dispatchEvent(event)
  return event
}
const type = (input: HTMLInputElement, value: string) => {
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
}
const narrowScreen = () =>
  vi.spyOn(window, 'matchMedia').mockReturnValue({
    matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  } as unknown as MediaQueryList)

describe('текст полів на телефоні — 16px, iOS не зумує', () => {
  // Корінь документа 15px, тож `text-base` = 15px: iOS зумував кожне поле.
  it('fieldClass і пошук у панелі — піксельні 16px, не text-base', () => {
    for (const size of ['sm', 'md', 'lg'] as const) {
      const classes = fieldClass(size).split(' ')
      expect(classes).toContain('text-[16px]')
      expect(classes).not.toContain('text-base')
    }
    expect(dropdownSearchInputClass.split(' ')).toContain('text-[16px]')
  })

  it('UiTextarea тримає 16px', async () => {
    mounted = await mountComponent(UiTextarea, { modelValue: '' })
    expect(host().querySelector('textarea')!.classList.contains('text-[16px]')).toBe(true)
  })

  it('UiTagInput тримає 16px (раніше text-sm — 13px)', async () => {
    mounted = await mountComponent(UiTagInput, { modelValue: [] })
    expect(host().querySelector('input')!.classList.contains('text-[16px]')).toBe(true)
  })

  it('невидиме поле UiInputOtp тримає 16px (успадковувало 15px)', async () => {
    mounted = await mountComponent(UiInputOtp, { modelValue: '' })
    expect(host().querySelector('input')!.classList.contains('text-[16px]')).toBe(true)
  })
})

describe('атрибути доходять до нативного контролу', () => {
  it('UiInput: aria-label, maxlength, inputmode — на <input>, class — на обгортці', async () => {
    mounted = await mountComponent(UiInput, {
      modelValue: '',
      'aria-label': 'Пошук',
      maxlength: 5,
      inputmode: 'numeric',
      'data-testid': 'search',
      class: 'mt-4',
    })
    const root = host().firstElementChild as HTMLElement
    const input = host().querySelector('input')!
    expect(input.getAttribute('aria-label')).toBe('Пошук')
    expect(input.getAttribute('maxlength')).toBe('5')
    expect(input.getAttribute('inputmode')).toBe('numeric')
    expect(input.dataset.testid).toBe('search')
    expect(root.classList.contains('mt-4')).toBe(true)
    expect(input.classList.contains('mt-4')).toBe(false)
    expect(root.hasAttribute('aria-label')).toBe(false)
    expect(root.hasAttribute('maxlength')).toBe(false)
  })

  it('слухач споживача теж на полі, а не на обгортці', async () => {
    const pasted = vi.fn()
    mounted = await mountComponent(UiInput, { modelValue: '', onPaste: pasted })
    host().querySelector('input')!.dispatchEvent(new Event('paste'))
    expect(pasted).toHaveBeenCalledTimes(1)
  })

  const cases: Array<[string, unknown, Record<string, unknown>, string]> = [
    ['UiTextarea', UiTextarea, { modelValue: '' }, 'textarea'],
    ['UiSelect', UiSelect, { modelValue: null, options: CITIES }, 'input[role="combobox"]'],
    ['UiCombobox', UiCombobox, { modelValue: null, options: CITIES }, 'input[role="combobox"]'],
    ['UiMultiSelect', UiMultiSelect, { modelValue: [], options: CITIES }, 'button[role="combobox"]'],
    ['UiCheckbox', UiCheckbox, {}, 'input[type="checkbox"]'],
    ['UiNumberInput', UiNumberInput, { modelValue: null }, 'input[role="spinbutton"]'],
    ['UiTagInput', UiTagInput, { modelValue: [] }, 'input[role="combobox"]'],
    ['UiInputOtp', UiInputOtp, { modelValue: '' }, 'input'],
    ['UiSlider', UiSlider, { modelValue: 10 }, 'input[type="range"]'],
    ['UiDatePicker', UiDatePicker, { modelValue: null }, 'input'],
    ['UiDateRangePicker', UiDateRangePicker, {}, 'button[aria-haspopup="dialog"]'],
  ]

  it.each(cases)('%s: aria-label і data-* — на контролі', async (_name, component, props, selector) => {
    mounted = await mountComponent(component as never, {
      ...props,
      'aria-label': 'Назва',
      'data-testid': 'field',
      class: 'col-span-2',
    })
    const control = host().querySelector<HTMLElement>(selector)!
    expect(control.getAttribute('aria-label')).toBe('Назва')
    expect(control.dataset.testid).toBe('field')
    expect((host().firstElementChild as HTMLElement).classList.contains('col-span-2')).toBe(true)
    expect(host().querySelectorAll('[data-testid="field"]')).toHaveLength(1)
  })

  it('UiInlineEdit має один корінь: class доходить без попередження Vue', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    mounted = await mountComponent(UiInlineEdit, { modelValue: 'x', class: 'w-40' })
    expect((host().firstElementChild as HTMLElement).classList.contains('w-40')).toBe(true)
    expect(warn.mock.calls.some(([message]) => String(message).includes('Extraneous'))).toBe(false)
  })
})

describe('UiSelect', () => {
  it('показує назву, коли опції приходять уже після значення', async () => {
    mounted = await mountComponent(UiSelect, { modelValue: 'lviv', options: [] })
    const input = host().querySelector('input')!
    expect(input.value).toBe('')
    await mounted.update({ options: CITIES })
    expect(input.value).toBe('Львів')
  })

  it('перша літера в закритому полі вже фільтрує, і Enter бере знайдене', async () => {
    const picked: unknown[] = []
    mounted = await mountComponent(UiSelect, {
      modelValue: null,
      options: CITIES,
      'onUpdate:modelValue': (value: unknown) => picked.push(value),
    })
    const input = host().querySelector('input')!
    input.focus()
    type(input, 'О')
    await settle()
    const labels = [...document.body.querySelectorAll('[role="option"]')].map((option) => option.textContent?.trim())
    expect(labels).toEqual(['Одеса'])
    key(input, 'Enter')
    expect(picked).toEqual(['odesa'])
  })

  it('клік у відкрите поле не закриває список і не стирає запит', async () => {
    mounted = await mountComponent(UiSelect, { modelValue: null, options: CITIES })
    const input = host().querySelector('input')!
    input.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await settle()
    type(input, 'Льв')
    await settle()
    // Клік усередині поля — лише переставити каретку.
    input.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await settle()
    expect(input.getAttribute('aria-expanded')).toBe('true')
    expect(input.value).toBe('Льв')
  })

  it('без фільтра Enter і пробіл відкривають список, пробіл у списку обирає', async () => {
    const picked: unknown[] = []
    mounted = await mountComponent(UiSelect, {
      modelValue: null,
      options: CITIES,
      filterable: false,
      'onUpdate:modelValue': (value: unknown) => picked.push(value),
    })
    const input = host().querySelector('input')!
    expect(key(input, 'Enter').defaultPrevented).toBe(true)
    await settle()
    expect(input.getAttribute('aria-expanded')).toBe('true')

    key(input, 'Escape')
    await settle()
    expect(input.getAttribute('aria-expanded')).toBe('false')

    key(input, ' ')
    await settle()
    expect(input.getAttribute('aria-expanded')).toBe('true')
    key(input, ' ')
    expect(picked).toEqual(['kyiv'])
  })
})

describe('UiCombobox', () => {
  it('новий пошук без обраного пункту не стирає поле й хрестик', async () => {
    mounted = await mountComponent(UiCombobox, {
      modelValue: null,
      options: CITIES,
      'onUpdate:modelValue': (value: unknown) => { mounted!.props.modelValue = value },
    })
    const input = host().querySelector('input')!
    input.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await settle()
    document.body.querySelector<HTMLElement>('[role="option"]')!.click()
    await settle()
    expect(input.value).toBe('Київ')

    input.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await settle()
    type(input, 'Льв')
    // Відповідь сервера на новий запит — без «Києва».
    await mounted.update({ options: [{ value: 'lviv', label: 'Львів' }] })
    key(input, 'Escape')
    await settle()

    expect(mounted.props.modelValue).toBe('kyiv')
    expect(input.value).toBe('Київ')
    expect(host().querySelector('button')?.textContent).toContain('Очистити вибір')
  })

  it('selectedLabel показує значення форми редагування до першого пошуку', async () => {
    mounted = await mountComponent(UiCombobox, { modelValue: 42, options: [], selectedLabel: 'Київ' })
    expect(host().querySelector('input')!.value).toBe('Київ')
  })

  it('minChars: перша літера після кліку в поле не стирається', async () => {
    const searches: string[] = []
    mounted = await mountComponent(UiCombobox, {
      modelValue: null,
      options: [],
      minChars: 2,
      onSearch: (query: string) => searches.push(query),
    })
    const input = host().querySelector('input')!
    input.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await settle()
    type(input, 'К')
    await settle()
    expect(input.value).toBe('К')
    expect(input.getAttribute('aria-expanded')).toBe('false')
    expect(searches).toEqual([])

    type(input, 'Ки')
    await settle()
    expect(searches).toEqual(['Ки'])
    expect(input.getAttribute('aria-expanded')).toBe('true')
  })
})

describe('UiDateRangePicker', () => {
  const TODAY = new Date(2026, 7, 17)

  it('відкриття переносить фокус у календар', async () => {
    narrowScreen()
    mounted = await mountComponent(UiDateRangePicker, { today: TODAY })
    host().querySelector('button')!.click()
    await settle()
    const active = document.activeElement as HTMLElement
    expect(active.closest('[role="gridcell"]')).not.toBeNull()
    expect(active.getAttribute('aria-label')).toContain('17 серпня')
  })

  it('Escape закриває лише панель: далі подія не йде, фокус — на тригер', async () => {
    narrowScreen()
    const outer = vi.fn()
    document.addEventListener('keydown', outer)
    mounted = await mountComponent(UiDateRangePicker, { today: TODAY })
    const trigger = host().querySelector('button')!
    trigger.click()
    await settle()
    key(document.activeElement!, 'Escape')
    await settle()
    document.removeEventListener('keydown', outer)

    expect(outer).not.toHaveBeenCalled()
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(trigger)
  })

  it('Escape на самому тригері теж не доходить до document', async () => {
    narrowScreen()
    const outer = vi.fn()
    document.addEventListener('keydown', outer)
    mounted = await mountComponent(UiDateRangePicker, { today: TODAY })
    const trigger = host().querySelector('button')!
    trigger.click()
    await settle()
    key(trigger, 'Escape')
    await settle()
    document.removeEventListener('keydown', outer)
    expect(outer).not.toHaveBeenCalled()
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })

  it('Tab з останнього елемента панелі закриває її й повертає фокус на тригер', async () => {
    narrowScreen()
    mounted = await mountComponent(UiDateRangePicker, { today: TODAY, presets: [] })
    const trigger = host().querySelector('button')!
    trigger.click()
    await settle()
    const tab = key(document.activeElement!, 'Tab')
    await settle()
    // Вперед — без preventDefault: браузер продовжить Tab уже від тригера.
    expect(tab.defaultPrevented).toBe(false)
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(trigger)
  })

  it('поле форми несе локальні дати, а не UTC', async () => {
    mounted = await mountComponent(UiDateRangePicker, {
      today: TODAY,
      name: 'period',
      modelValue: { start: new Date(2026, 8, 24), end: new Date(2026, 8, 30) },
    })
    expect(host().querySelector<HTMLInputElement>('input[type="hidden"]')!.value).toBe('2026-09-24/2026-09-30')
    expect(toDateKey(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
})

describe('UiCalendar', () => {
  const TODAY = new Date(2026, 8, 24)

  it('Enter на кнопці «Наступний місяць» не обирає сфокусований день', async () => {
    const picked: unknown[] = []
    mounted = await mountComponent(UiCalendar, {
      today: TODAY,
      'onUpdate:modelValue': (value: unknown) => picked.push(value),
    })
    const next = host().querySelector<HTMLButtonElement>('[aria-label="Наступний місяць"]')!
    expect(key(next, 'Enter').defaultPrevented).toBe(false)
    expect(key(next, ' ').defaultPrevented).toBe(false)
    expect(picked).toHaveLength(0)
  })

  it('після гортання кнопками в сітці лишається рівно одна зупинка Tab', async () => {
    mounted = await mountComponent(UiCalendar, { today: TODAY })
    const next = host().querySelector<HTMLButtonElement>('[aria-label="Наступний місяць"]')!
    next.click()
    await settle()
    next.click()
    await settle()
    const stops = [...host().querySelectorAll('td button[tabindex="0"]')]
    expect(stops).toHaveLength(1)
    expect(stops[0]!.getAttribute('aria-label')).toContain('24 листопада')
  })

  it('два місяці: спільні дні на межі не дублюють зупинку Tab', async () => {
    mounted = await mountComponent(UiCalendar, { today: new Date(2026, 8, 30), months: 2 })
    let stops = [...host().querySelectorAll<HTMLElement>('td button[tabindex="0"]')]
    expect(stops).toHaveLength(1)

    stops[0]!.focus()
    key(stops[0]!, 'ArrowRight')
    await settle()
    stops = [...host().querySelectorAll<HTMLElement>('td button[tabindex="0"]')]
    expect(stops).toHaveLength(1)
    expect(stops[0]!.getAttribute('aria-label')).toContain('1 жовтня')
    // Фокус — на справжньому 1 жовтня у правому місяці, а не на бляклій копії зліва.
    const [, october] = [...host().querySelectorAll('table')]
    expect(october!.contains(document.activeElement)).toBe(true)
  })
})

describe('UiRadioGroup', () => {
  it('без name радіо все одно одна група, і required не блокує форму назавжди', async () => {
    mounted = await mountComponent(UiRadioGroup, {
      modelValue: 'a',
      required: true,
      options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }],
    })
    const radios = [...host().querySelectorAll<HTMLInputElement>('input[type="radio"]')]
    const names = new Set(radios.map((radio) => radio.name))
    expect(names.size).toBe(1)
    expect([...names][0]).not.toBe('')
    expect(radios.some((radio) => radio.validity.valueMissing)).toBe(false)
  })
})

describe('UiSlider', () => {
  it('змінна заливки стоїть на самому range: правило .ui-slider її більше не перебиває', async () => {
    mounted = await mountComponent(UiSlider, { modelValue: 60, label: 'Гучність' })
    const range = host().querySelector<HTMLInputElement>('input[type="range"]')!
    expect(range.style.getPropertyValue('--fill-percent')).toBe('60%')
  })
})

describe('UiNumberInput', () => {
  it('порожнє поле з межами не вимикає степери', async () => {
    mounted = await mountComponent(UiNumberInput, { modelValue: null, min: 1, max: 99 })
    const [minus, plus] = [...host().querySelectorAll('button')]
    expect(minus!.disabled).toBe(false)
    expect(plus!.disabled).toBe(false)
  })

  it('на межі степер вимикається, як і раніше', async () => {
    mounted = await mountComponent(UiNumberInput, { modelValue: 99, min: 1, max: 99 })
    const [minus, plus] = [...host().querySelectorAll('button')]
    expect(minus!.disabled).toBe(false)
    expect(plus!.disabled).toBe(true)
  })

  it('одиниця видима й тоді, коли є степери', async () => {
    mounted = await mountComponent(UiNumberInput, { modelValue: 5, unit: 'кг' })
    expect(host().querySelectorAll('button')).toHaveLength(2)
    expect(host().textContent).toContain('кг')
  })
})

describe('UiTagInput', () => {
  it('SSR і гідратація без розбіжностей', async () => {
    const globals = globalThis as unknown as { document: Document | undefined }
    const realDocument = globals.document!
    const render = () =>
      createSSRApp({ render: () => h('div', [h(UiTagInput, { modelValue: ['vip'], label: 'Мітки', hint: 'Enter додає' })]) })

    // Сервер не має document — саме так там і рендериться компонент.
    globals.document = undefined
    let html = ''
    try {
      html = await renderToString(render())
    } finally {
      globals.document = realDocument
    }

    const container = document.createElement('div')
    container.innerHTML = html
    document.body.append(container)
    const messages: string[] = []
    const capture = (...args: unknown[]) => void messages.push(args.map(String).join(' '))
    vi.spyOn(console, 'warn').mockImplementation(capture)
    vi.spyOn(console, 'error').mockImplementation(capture)
    const app = render()
    app.mount(container)
    await settle()
    app.unmount()

    expect(messages.filter((message) => message.includes('Hydration'))).toEqual([])
  })

  it('name віддає формі мітки, а не недописаний текст', async () => {
    mounted = await mountComponent(UiTagInput, { modelValue: ['vip', 'b2b'], name: 'tags' })
    const named = [...host().querySelectorAll<HTMLInputElement>('[name="tags"]')]
    expect(named.map((field) => [field.type, field.value])).toEqual([
      ['hidden', 'vip'],
      ['hidden', 'b2b'],
    ])
    expect(host().querySelector('input[role="combobox"]')!.hasAttribute('name')).toBe(false)
  })

  it('size змінює саме поле', async () => {
    mounted = await mountComponent(UiTagInput, { modelValue: [], size: 'sm' })
    const shell = () => host().querySelector('input')!.parentElement!.className
    const small = shell()
    await mounted.update({ size: 'lg' })
    expect(shell()).not.toBe(small)
    expect(shell()).toContain('md:min-h-10')
  })

  it('на межі max поле лишається у фокусі, а Backspace прибирає мітку', async () => {
    const updates: string[][] = []
    mounted = await mountComponent(UiTagInput, {
      modelValue: ['a', 'b'],
      max: 2,
      'onUpdate:modelValue': (value: string[]) => { updates.push(value); mounted!.props.modelValue = value },
    })
    const input = host().querySelector<HTMLInputElement>('input[role="combobox"]')!
    expect(input.disabled).toBe(false)
    expect(input.readOnly).toBe(true)
    input.focus()
    key(input, 'Backspace')
    key(input, 'Backspace')
    await settle()
    expect(updates.at(-1)).toEqual(['a'])
    expect(document.activeElement).toBe(input)
    expect(input.readOnly).toBe(false)
  })

  it('фокус і помилка — із загального контракту полів', async () => {
    mounted = await mountComponent(UiTagInput, { modelValue: [], error: 'Помилка' })
    const shell = host().querySelector('input')!.parentElement!.className
    expect(shell).toContain('focus-within:ring-danger/30')
    expect(shell).not.toContain('ring-offset')
  })
})

describe('UiMultiSelect', () => {
  const MANY = Array.from({ length: 7 }, (_, index) => ({ value: index, label: `Пункт ${index}` }))

  it('фокус пішов за межі поля й панелі — панель закривається', async () => {
    const outside = document.createElement('button')
    document.body.append(outside)
    mounted = await mountComponent(UiMultiSelect, { modelValue: [], options: CITIES })
    const trigger = host().querySelector<HTMLButtonElement>('[role="combobox"]')!
    trigger.click()
    await settle()
    expect(trigger.getAttribute('aria-expanded')).toBe('true')

    trigger.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: outside }))
    await settle()
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })

  it('Tab із тригера закриває панель', async () => {
    mounted = await mountComponent(UiMultiSelect, { modelValue: [], options: CITIES })
    const trigger = host().querySelector<HTMLButtonElement>('[role="combobox"]')!
    trigger.click()
    await settle()
    key(trigger, 'Tab')
    await settle()
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })

  it('Shift+Tab із пошуку повертає фокус на тригер', async () => {
    mounted = await mountComponent(UiMultiSelect, { modelValue: [], options: MANY })
    const trigger = host().querySelector<HTMLButtonElement>('[role="combobox"]')!
    trigger.click()
    await settle()
    const search = document.body.querySelector<HTMLInputElement>('input[aria-label="Пошук опцій"]')!
    expect(document.activeElement).toBe(search)

    expect(key(search, 'Tab', { shiftKey: true }).defaultPrevented).toBe(true)
    await settle()
    expect(document.activeElement).toBe(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })

  it('Tab з останньої кнопки панелі закриває її з фокусом на тригері', async () => {
    mounted = await mountComponent(UiMultiSelect, { modelValue: [], options: MANY })
    const trigger = host().querySelector<HTMLButtonElement>('[role="combobox"]')!
    trigger.click()
    await settle()
    const clearAll = document.body.querySelector<HTMLButtonElement>('[aria-label="Зняти все"]')!
    clearAll.focus()
    expect(key(clearAll, 'Tab').defaultPrevented).toBe(false)
    await settle()
    expect(document.activeElement).toBe(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })

  it('required: зірочка, aria-required і нативна перевірка форми', async () => {
    mounted = await mountComponent(UiMultiSelect, {
      modelValue: [],
      options: CITIES,
      label: 'Міста',
      required: true,
    })
    const form = document.createElement('form')
    document.body.append(form)
    form.append(host())
    const trigger = host().querySelector('[role="combobox"]')!
    expect(trigger.getAttribute('aria-required')).toBe('true')
    expect(host().querySelector('label')!.textContent).toContain('*')
    expect(form.checkValidity()).toBe(false)

    await mounted.update({ modelValue: ['kyiv'] })
    expect(form.checkValidity()).toBe(true)
  })
})

describe('UiInlineEdit', () => {
  function collect() {
    const events: string[] = []
    return {
      events,
      listeners: {
        onEdit: () => events.push('edit'),
        onSave: () => events.push('save'),
        onCancel: () => events.push('cancel'),
        'onUpdate:modelValue': () => events.push('update'),
      },
    }
  }

  it('емітить edit, а незмінене значення на blur — це cancel, не save', async () => {
    const { events, listeners } = collect()
    mounted = await mountComponent(UiInlineEdit, { modelValue: 'Значення', ...listeners })
    host().querySelector('button')!.click()
    await nextTick()
    host().querySelector('input')!.dispatchEvent(new FocusEvent('blur'))
    await nextTick()
    expect(events).toEqual(['edit', 'cancel'])
  })

  it('змінене значення зберігається, як і раніше', async () => {
    const { events, listeners } = collect()
    mounted = await mountComponent(UiInlineEdit, { modelValue: 'Значення', ...listeners })
    host().querySelector('button')!.click()
    await nextTick()
    const input = host().querySelector('input')!
    type(input, 'Інше')
    key(input, 'Enter')
    await nextTick()
    expect(events).toEqual(['edit', 'update', 'save'])
  })
})

describe('UiFileUpload', () => {
  it('після вибору інпут спорожняється — той самий файл можна обрати знову', async () => {
    const selected: File[][] = []
    mounted = await mountComponent(UiFileUpload, { onSelect: (files: File[]) => selected.push(files) })
    const input = host().querySelector<HTMLInputElement>('input[type="file"]')!
    const file = new File(['x'], 'a.pdf', { type: 'application/pdf' })
    const writes: string[] = []
    Object.defineProperty(input, 'files', { configurable: true, get: () => [file] as unknown as FileList })
    Object.defineProperty(input, 'value', {
      configurable: true,
      get: () => 'C:\\fakepath\\a.pdf',
      set: (value: string) => void writes.push(value),
    })
    input.dispatchEvent(new Event('change', { bubbles: true }))
    expect(selected.map((files) => files.map(({ name }) => name))).toEqual([['a.pdf']])
    expect(writes).toContain('')
  })
})

describe('UiCheckbox', () => {
  it('пояснення не дублюється в назві, а в описі — лише одне з помилки/підказки', async () => {
    mounted = await mountComponent(UiCheckbox, {
      label: 'Згода',
      description: 'Умови сервісу',
      hint: 'Підказка',
      error: 'Обовʼязково',
    })
    const input = host().querySelector('input')!
    const text = (id: string) => host().querySelector(`#${id}`)?.textContent?.trim()
    expect(text(input.getAttribute('aria-labelledby')!)).toBe('Згода')
    const described = input.getAttribute('aria-describedby')!.split(' ')
    expect(described.map(text)).toEqual(['Умови сервісу', 'Обовʼязково'])
  })

  it('без видимої мітки aria-labelledby не перебиває aria-label', async () => {
    mounted = await mountComponent(UiCheckbox, { 'aria-label': 'Обрати рядок' })
    const input = host().querySelector('input')!
    expect(input.hasAttribute('aria-labelledby')).toBe(false)
    expect(input.getAttribute('aria-label')).toBe('Обрати рядок')
  })
})

describe('кнопки очищення: спільний клас і зона дотику 45×45', () => {
  const ZONE = 'pointer-coarse:after:h-12'

  it('клас із uiFieldStyles несе невидиму зону', () => {
    expect(clearButtonClass).toContain(ZONE)
  })

  it.each([
    ['UiInput', UiInput, { modelValue: 'x', clearable: true }, '[aria-label="Очистити поле"]'],
    ['UiSelect', UiSelect, { modelValue: 'kyiv', options: CITIES, clearable: true }, 'button'],
    ['UiCombobox', UiCombobox, { modelValue: 'kyiv', options: CITIES }, 'button'],
    ['UiDateRangePicker', UiDateRangePicker, {
      modelValue: { start: new Date(2026, 7, 1), end: new Date(2026, 7, 2) },
    }, '[aria-label="Очистити період"]'],
    ['UiTagInput', UiTagInput, { modelValue: ['vip'] }, '[aria-label="Видалити vip"]'],
  ] as Array<[string, unknown, Record<string, unknown>, string]>)('%s', async (_name, component, props, selector) => {
    mounted = await mountComponent(component as never, props)
    expect(host().querySelector(selector)!.className).toContain(ZONE)
  })
})

describe('UiInput: префікс, суфікс і лічильник', () => {
  it('префікс і суфікс приклеєні до поля й входять у доступну назву', async () => {
    mounted = await mountComponent(UiInput, { modelValue: '', label: 'Ціна', prefix: '≈', suffix: 'грн' })
    const input = host().querySelector('input')!
    const ids = input.getAttribute('aria-labelledby')!.split(' ')
    expect(ids.map((id) => host().querySelector(`#${id}`)?.textContent?.trim())).toEqual(['Ціна', '≈', 'грн'])
    expect(input.classList.contains('rounded-l-none')).toBe(true)
    expect(input.classList.contains('rounded-r-none')).toBe(true)
  })

  it('без префікса й суфікса назву дає звичайний <label for>', async () => {
    mounted = await mountComponent(UiInput, { modelValue: '', label: 'Ім’я' })
    expect(host().querySelector('input')!.hasAttribute('aria-labelledby')).toBe(false)
  })

  it('maxLength і лічильник — як в UiTextarea, лічильник останній у черзі описів', async () => {
    mounted = await mountComponent(UiInput, { modelValue: 'Привіт', maxLength: 20, showCount: true })
    const input = host().querySelector('input')!
    expect(input.maxLength).toBe(20)
    expect(host().textContent).toContain('6 / 20')
    expect(host().querySelector(`#${input.getAttribute('aria-describedby')}`)?.textContent).toContain('6 / 20')

    await mounted.update({ hint: 'Коротко' })
    expect(host().querySelector(`#${input.getAttribute('aria-describedby')}`)?.textContent).toBe('Коротко')
  })
})
