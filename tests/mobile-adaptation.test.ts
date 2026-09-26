import { afterEach, describe, expect, it, vi } from 'vitest'
import { h, nextTick, reactive } from 'vue'
import UiHoverCard from '~/components/ui/UiHoverCard.vue'
import UiTooltip from '~/components/ui/UiTooltip.vue'
import { computeAnchoredPanelPosition, placeAnchoredPanel } from '~/utils/overlayPosition'
import { dropdownPanelClass, menuItemClass } from '~/utils/uiFieldStyles'
import { mountComponent } from './helpers/mountComponent'

const mounted: Array<{ unmount: () => void }> = []

async function mount(render: () => unknown) {
  const instance = await mountComponent({ render })
  mounted.push(instance)
  return instance
}

async function flush() {
  for (let index = 0; index < 6; index += 1) {
    await nextTick()
    await Promise.resolve()
  }
}

afterEach(() => {
  while (mounted.length) mounted.pop()!.unmount()
  vi.useRealTimers()
  document.body.innerHTML = ''
})

function touch(type: string) {
  return new PointerEvent(type, { bubbles: true, pointerType: 'touch' })
}

/* ------------------------------------------------------------------ */

describe('Геометрія з видимою областю (клавіатура)', () => {
  // Телефон 375×740, клавіатура забрала нижні 300px: видимо 0..440.
  const keyboard = { top: 0, left: 0, width: 375, height: 440 }
  const field = { top: 300, bottom: 345, left: 16, right: 359, width: 343, height: 45 }

  it('панель під полем, що лягла б під клавіатуру, перевертається догори', () => {
    const point = computeAnchoredPanelPosition(field, { width: 343, height: 240 }, keyboard, 'bottom-start', 4)
    expect(point.placement).toBe('top-start')
    expect(point.top + 240).toBeLessThanOrEqual(field.top)
  })

  it('з innerHeight та сама панель помилково лишилася б донизу', () => {
    const point = computeAnchoredPanelPosition(field, { width: 343, height: 240 }, { width: 375, height: 740 }, 'bottom-start', 4)
    expect(point.placement).toBe('bottom-start')
  })

  it('зсув видимої області (прокрутка під клавіатурою) враховується в притисканні', () => {
    const scrolled = { top: 120, left: 0, width: 375, height: 440 }
    const point = computeAnchoredPanelPosition(
      { top: 110, bottom: 150, left: 16, right: 116, width: 100, height: 40 },
      { width: 200, height: 100 },
      scrolled,
      'top-start',
    )
    // Згори до видимого краю місця немає — панель іде донизу, а не за край.
    expect(point.placement).toBe('bottom-start')
    expect(point.top).toBeGreaterThanOrEqual(scrolled.top + 8)
  })

  it('висока панель, що не влазить ні з якого боку, отримує висоту, а не наповзає на поле', () => {
    const panel = document.createElement('div')
    Object.defineProperties(panel, {
      scrollHeight: { value: 600 },
      offsetHeight: { value: 600 },
      clientHeight: { value: 600 },
      offsetWidth: { value: 343 },
    })
    const point = placeAnchoredPanel(field, panel, keyboard, 'bottom-start', { gap: 4 })
    expect(point.fits).toBe(false)
    expect(point.height).toBe(point.maxHeight)
    // Панель лежить повністю над полем і в межах видимої області.
    expect(point.top + point.height).toBeLessThanOrEqual(field.top)
    expect(point.top).toBeGreaterThanOrEqual(8)
  })

  it('ширина не виходить за край вузького екрана', () => {
    const point = computeAnchoredPanelPosition(
      { top: 100, bottom: 140, left: 250, right: 359, width: 109, height: 40 },
      { width: 300, height: 100 },
      { width: 320, height: 568 },
    )
    expect(point.left + 300).toBeLessThanOrEqual(320 - 8)
  })
})

describe('Класи мобільного контракту', () => {
  it('панель випадайки — fixed, а не absolute (TagInput відкривався за екраном)', () => {
    expect(dropdownPanelClass.split(' ')).toContain('fixed')
    expect(dropdownPanelClass.split(' ')).not.toContain('absolute')
    expect(dropdownPanelClass).toContain('overscroll-contain')
  })

  it('пункт меню має 45px на телефоні й фокус-кільце', () => {
    expect(menuItemClass).toContain('py-3')
    expect(menuItemClass).toContain('md:py-2')
    expect(menuItemClass).toContain('focus-visible:ring-2')
  })
})

/* ------------------------------------------------------------------ */

describe('UiTooltip на дотику', () => {
  const tooltip = (onClick = () => {}) =>
    h(UiTooltip, { content: 'Видалити назавжди', delay: 200 }, {
      default: ({ describedBy }: any) =>
        h('button', { id: 'hint', 'aria-describedby': describedBy, onClick }, 'Видалити'),
    })

  it('тап не показує підказку — навіть після сумісного mouseenter', async () => {
    vi.useFakeTimers()
    await mount(tooltip)
    const wrapper = document.getElementById('hint')!.parentElement!
    wrapper.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'touch' }))
    wrapper.dispatchEvent(touch('pointerdown'))
    vi.advanceTimersByTime(100)
    wrapper.dispatchEvent(touch('pointerup'))
    vi.advanceTimersByTime(2000)
    await flush()
    expect(document.querySelector('[role="tooltip"]')).toBeNull()
  })

  it('довге натискання показує підказку, гасить клік і ховає її після паузи', async () => {
    vi.useFakeTimers()
    const onClick = vi.fn()
    await mount(() => tooltip(onClick))
    const button = document.getElementById('hint')!
    button.dispatchEvent(touch('pointerdown'))
    vi.advanceTimersByTime(600)
    await flush()
    expect(document.querySelector('[role="tooltip"]')).not.toBeNull()

    button.dispatchEvent(touch('pointerup'))
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(onClick).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1600)
    await flush()
    expect(button.getAttribute('aria-describedby')).toBeNull()
  })

  it('після довгого натискання наступний тап знову клікає', async () => {
    vi.useFakeTimers()
    const onClick = vi.fn()
    await mount(() => tooltip(onClick))
    const button = document.getElementById('hint')!
    button.dispatchEvent(touch('pointerdown'))
    vi.advanceTimersByTime(600)
    button.dispatchEvent(touch('pointerup'))
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    button.dispatchEvent(touch('pointerdown'))
    vi.advanceTimersByTime(80)
    button.dispatchEvent(touch('pointerup'))
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})

describe('UiHoverCard на дотику', () => {
  const card = (state: { open: boolean }) =>
    h(UiHoverCard, { modelValue: state.open, openDelay: 100, 'onUpdate:modelValue': (v: boolean) => (state.open = v) }, {
      trigger: ({ triggerAttrs }: any) => h('a', { ...triggerAttrs, href: '#profile', id: 'profile' }, 'Ігор'),
      default: () => 'Картка',
    })

  it('тап по посиланню картку не відкриває', async () => {
    vi.useFakeTimers()
    const state = reactive({ open: false })
    await mount(() => card(state))
    const trigger = document.getElementById('profile')!
    trigger.dispatchEvent(new Event('touchstart', { bubbles: true }))
    trigger.dispatchEvent(new MouseEvent('mouseenter'))
    trigger.dispatchEvent(new FocusEvent('focus'))
    vi.advanceTimersByTime(1000)
    await flush()
    expect(state.open).toBe(false)
  })

  it('наведення мишею картку відкриває, як і раніше', async () => {
    vi.useFakeTimers()
    const state = reactive({ open: false })
    await mount(() => card(state))
    const trigger = document.getElementById('profile')!
    trigger.dispatchEvent(new MouseEvent('mouseenter'))
    vi.advanceTimersByTime(200)
    await flush()
    expect(state.open).toBe(true)
  })
})
