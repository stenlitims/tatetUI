import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { h, nextTick, reactive } from 'vue'
import UiCombobox from '~/components/ui/UiCombobox.vue'
import UiMultiSelect from '~/components/ui/UiMultiSelect.vue'
import UiSelect from '~/components/ui/UiSelect.vue'
import { SELECT_SHEET_QUERY, sheetTitleFor } from '~/utils/selectSheet'
import { mountComponent } from './helpers/mountComponent'

/*
 * Мобільний режим списків вибору: на вузькому екрані UiSelect, UiMultiSelect
 * і UiCombobox відкривають нижній sheet (UiDrawer) замість випадайки.
 * Вузький екран імітуємо підміною matchMedia — happy-dom має вікно 1024px.
 */

const CITIES = [
  { value: 'kyiv', label: 'Київ' },
  { value: 'lviv', label: 'Львів' },
  { value: 'odesa', label: 'Одеса' },
]

const MANY = Array.from({ length: 14 }, (_, index) => ({
  value: `c${index}`,
  label: index === 9 ? 'Житомир' : `Місто ${index}`,
}))

let mounted: Awaited<ReturnType<typeof mountComponent>> | null = null
let narrow = true

beforeAll(() => {
  HTMLElement.prototype.scrollIntoView ??= () => undefined
})

beforeEach(() => {
  narrow = true
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query: string) =>
      ({
        matches: query === SELECT_SHEET_QUERY ? narrow : false,
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      }) as MediaQueryList,
  )
})

afterEach(() => {
  mounted?.unmount()
  mounted = null
  document.body.innerHTML = ''
})

async function flush() {
  for (let i = 0; i < 4; i++) await nextTick()
}

const sheet = () => document.querySelector<HTMLElement>('[role="dialog"]')
const sheetOptions = () => [...(sheet()?.querySelectorAll<HTMLElement>('li[role="option"]:not([aria-disabled])') ?? [])]
const key = (target: Element, name: string) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }))
const type = (input: HTMLInputElement, value: string) => {
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

function selectState(initial: string | null = null, extra: Record<string, unknown> = {}) {
  const state = reactive({ value: initial as string | number | null })
  const props = {
    modelValue: initial,
    options: CITIES,
    'onUpdate:modelValue': (value: string | number | null) => {
      state.value = value
      mounted?.props && (mounted.props.modelValue = value)
    },
    ...extra,
  }
  return { state, props }
}

describe('UiSelect: sheet на вузькому екрані', () => {
  it('тап відкриває sheet, а не випадайку; поле лишається без клавіатури', async () => {
    const { props } = selectState(null, { label: 'Місто' })
    mounted = await mountComponent(UiSelect, props)
    await flush()
    const field = mounted.host.querySelector<HTMLInputElement>('input[role="combobox"]')!
    expect(field.readOnly).toBe(true)
    expect(field.getAttribute('aria-haspopup')).toBe('dialog')

    // pointerdown ще не відкриває: фон не має з'являтися під пальцем.
    field.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await flush()
    expect(sheet()).toBeNull()

    field.click()
    await flush()
    expect(sheet()).not.toBeNull()
    expect(sheet()!.textContent).toContain('Місто')
    expect(document.querySelector('.z-\\[1100\\]')).toBeNull()
    expect(field.getAttribute('aria-expanded')).toBe('true')
  })

  it('вибір пункту віддає значення й закриває sheet', async () => {
    const { state, props } = selectState()
    mounted = await mountComponent(UiSelect, props)
    await flush()
    mounted.host.querySelector<HTMLInputElement>('input')!.click()
    await flush()
    sheetOptions()[1]!.click()
    await flush()
    expect(state.value).toBe('lviv')
    expect(mounted.host.querySelector('input')!.getAttribute('aria-expanded')).toBe('false')
  })

  it('заголовок береться із зовнішнього <label for>, коли label не передано', async () => {
    const wrapper = document.createElement('div')
    wrapper.innerHTML = '<label for="city-field">Категорія</label><input id="city-field" />'
    document.body.append(wrapper)
    const input = wrapper.querySelector('input')!
    expect(sheetTitleFor(input, undefined, undefined, 'Оберіть')).toBe('Категорія')
    expect(sheetTitleFor(input, 'Свій', undefined, undefined)).toBe('Свій')
    expect(sheetTitleFor(null, undefined, ' Країна ', undefined)).toBe('Країна')
    expect(sheetTitleFor(null, undefined, undefined, 'Оберіть')).toBe('Оберіть')
  })

  it('пошук з’являється лише в довгому списку й фільтрує його, не чіпаючи поле', async () => {
    const short = selectState()
    mounted = await mountComponent(UiSelect, short.props)
    await flush()
    mounted.host.querySelector<HTMLInputElement>('input')!.click()
    await flush()
    expect(sheet()!.querySelector('input[enterkeyhint="search"]')).toBeNull()
    mounted.unmount()
    document.body.innerHTML = ''

    const long = selectState('c0', { options: MANY })
    mounted = await mountComponent(UiSelect, long.props)
    await flush()
    const field = mounted.host.querySelector<HTMLInputElement>('input')!
    field.click()
    await flush()
    const search = sheet()!.querySelector<HTMLInputElement>('input[enterkeyhint="search"]')!
    expect(search).not.toBeNull()
    // Фокус пошуку НЕ віддаємо: клавіатура не вилазить сама.
    expect(document.activeElement).not.toBe(search)
    type(search, 'жито')
    await flush()
    expect(sheetOptions().map((node) => node.textContent?.trim())).toEqual(['Житомир'])
    expect(field.value).toBe('Місто 0')
  })

  it('клавіатура: Enter на полі відкриває, стрілка й Enter у списку обирають', async () => {
    const { state, props } = selectState('kyiv')
    mounted = await mountComponent(UiSelect, props)
    await flush()
    const field = mounted.host.querySelector<HTMLInputElement>('input')!
    key(field, 'Enter')
    await flush()
    const list = sheet()!.querySelector<HTMLElement>('[role="listbox"]')!
    expect(list.getAttribute('tabindex')).toBe('0')
    key(list, 'ArrowDown')
    await flush()
    expect(list.getAttribute('aria-activedescendant')).toBe(sheetOptions()[1]!.id)
    key(list, 'Enter')
    await flush()
    expect(state.value).toBe('lviv')
  })

  it('mobileSheet: false лишає випадайку й на вузькому екрані', async () => {
    const { props } = selectState(null, { mobileSheet: false })
    mounted = await mountComponent(UiSelect, props)
    await flush()
    const field = mounted.host.querySelector<HTMLInputElement>('input')!
    expect(field.readOnly).toBe(false)
    field.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await flush()
    expect(sheet()).toBeNull()
    expect(document.querySelector('[role="listbox"]')).not.toBeNull()
  })

  it('на широкому екрані — звичайна випадайка', async () => {
    narrow = false
    const { props } = selectState()
    mounted = await mountComponent(UiSelect, props)
    await flush()
    const field = mounted.host.querySelector<HTMLInputElement>('input')!
    field.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    await flush()
    expect(sheet()).toBeNull()
    expect(field.getAttribute('aria-haspopup')).toBeNull()
  })
})

describe('UiMultiSelect: sheet на вузькому екрані', () => {
  function multiState(initial: (string | number)[] = [], extra: Record<string, unknown> = {}) {
    const state = reactive({ value: [...initial] })
    return {
      state,
      props: {
        modelValue: initial,
        options: CITIES,
        label: 'Міста',
        'onUpdate:modelValue': (value: (string | number)[]) => {
          state.value = value
          mounted?.props && (mounted.props.modelValue = value)
        },
        ...extra,
      },
    }
  }

  it('пункти перемикаються, sheet лишається відкритим, «Готово» закриває', async () => {
    const { state, props } = multiState()
    mounted = await mountComponent(UiMultiSelect, props)
    await flush()
    const trigger = mounted.host.querySelector<HTMLButtonElement>('button[role="combobox"]')!
    trigger.click()
    await flush()
    expect(sheet()!.textContent).toContain('Міста')
    sheetOptions()[0]!.click()
    sheetOptions()[2]!.click()
    await flush()
    expect(state.value).toEqual(['kyiv', 'odesa'])
    expect(sheet()).not.toBeNull()

    const done = [...sheet()!.querySelectorAll('button')].find((node) => node.textContent?.trim() === 'Готово')!
    done.click()
    await flush()
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })

  it('«Вибрати все» і «Зняти все» — текстові кнопки в sheet', async () => {
    const { state, props } = multiState(['lviv'])
    mounted = await mountComponent(UiMultiSelect, props)
    await flush()
    mounted.host.querySelector<HTMLButtonElement>('button[role="combobox"]')!.click()
    await flush()
    const button = (text: string) =>
      [...sheet()!.querySelectorAll('button')].find((node) => node.textContent?.trim() === text)!
    button('Вибрати все').click()
    await flush()
    expect(state.value).toEqual(['kyiv', 'lviv', 'odesa'])
    button('Зняти все').click()
    await flush()
    expect(state.value).toEqual([])
  })

  it('фокус у sheet не закриває його як «фокус пішов геть»', async () => {
    const { props } = multiState()
    mounted = await mountComponent(UiMultiSelect, props)
    await flush()
    const trigger = mounted.host.querySelector<HTMLButtonElement>('button[role="combobox"]')!
    trigger.focus()
    trigger.click()
    await flush()
    const list = sheet()!.querySelector<HTMLElement>('[role="listbox"]')!
    trigger.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: list }))
    await flush()
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
  })
})

describe('UiCombobox: sheet на вузькому екрані', () => {
  it('пошук набирається в sheet, вибір закриває й лишає назву в полі', async () => {
    const searches: string[] = []
    const state = reactive({ value: null as string | number | null })
    mounted = await mountComponent(UiCombobox, {
      modelValue: null,
      options: CITIES,
      label: 'Місто',
      'onUpdate:modelValue': (value: string | number | null) => {
        state.value = value
        mounted!.props.modelValue = value
      },
      onSearch: (value: string) => searches.push(value),
    })
    await flush()
    const field = mounted.host.querySelector<HTMLInputElement>('input[role="combobox"]')!
    expect(field.readOnly).toBe(true)
    field.click()
    await flush()
    const search = sheet()!.querySelector<HTMLInputElement>('input[enterkeyhint="search"]')!
    type(search, 'льв')
    await flush()
    expect(searches).toEqual(['льв'])
    sheetOptions()[1]!.click()
    await flush()
    expect(state.value).toBe('lviv')
    expect(field.value).toBe('Львів')
  })

  it('повторне відкриття скидає старий запит у споживача', async () => {
    const searches: string[] = []
    mounted = await mountComponent(UiCombobox, {
      modelValue: null,
      options: CITIES,
      onSearch: (value: string) => searches.push(value),
    })
    await flush()
    const field = mounted.host.querySelector<HTMLInputElement>('input')!
    field.click()
    await flush()
    type(sheet()!.querySelector<HTMLInputElement>('input[enterkeyhint="search"]')!, 'ки')
    key(sheet()!.querySelector<HTMLInputElement>('input[enterkeyhint="search"]')!, 'Escape')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flush()
    expect(field.getAttribute('aria-expanded')).toBe('false')

    field.click()
    await flush()
    expect(searches).toEqual(['ки', ''])
  })

  it('запит коротший за minChars не показує ні списку, ні «нічого не знайдено»', async () => {
    mounted = await mountComponent(UiCombobox, {
      modelValue: null,
      options: [],
      minChars: 3,
    })
    await flush()
    mounted.host.querySelector<HTMLInputElement>('input')!.click()
    await flush()
    const search = sheet()!.querySelector<HTMLInputElement>('input[enterkeyhint="search"]')!
    type(search, 'ки')
    await flush()
    expect(sheet()!.querySelectorAll('li').length).toBe(0)
    type(search, 'киї')
    await flush()
    expect(sheet()!.textContent).toContain('Нічого не знайдено')
  })
})

describe('sheet усередині іншого оверлея', () => {
  it('sheet селекта отримує шар вище за батьківську модалку', async () => {
    const { default: UiModal } = await import('~/components/ui/UiModal.vue')
    const state = reactive({ value: null as string | number | null })
    mounted = await mountComponent({
      render: () =>
        h(UiModal, { modelValue: true, title: 'Форма' }, {
          default: () =>
            h(UiSelect, {
              modelValue: state.value,
              options: CITIES,
              label: 'Місто',
              'onUpdate:modelValue': (value: string | number | null) => (state.value = value),
            }),
        }),
    })
    await flush()
    const field = document.querySelector<HTMLInputElement>('input[role="combobox"]')!
    field.click()
    await flush()
    const overlays = [...document.querySelectorAll<HTMLElement>('[data-ui-overlay]')]
    expect(overlays.length).toBe(2)
    const [modal, select] = overlays.map((node) => Number(node.style.zIndex))
    expect(select).toBeGreaterThan(modal!)
  })
})
