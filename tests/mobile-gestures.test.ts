import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { h, nextTick, reactive } from 'vue'
import UiContextMenu from '~/components/ui/UiContextMenu.vue'
import UiSwipeActions from '~/components/ui/UiSwipeActions.vue'
import UiSwipeStack from '~/components/ui/UiSwipeStack.vue'
import { pushThemeColorSurface, startThemeColor } from '~/utils/themeColor'
import { haptic } from '~/utils/touch'
import { mountComponent } from './helpers/mountComponent'

/*
 * Мобільні жести бібліотеки: дії під рядком, стек екранів зі свайпом
 * «назад», тактильний відгук довгого натискання й колір рядка стану.
 * Свайп — синтетичними PointerEvent із pointerType touch: саме їх слухає
 * utils/swipe.ts.
 */

type Mounted = Awaited<ReturnType<typeof mountComponent>>
let mounted: Mounted[] = []

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

function coarse(matches: boolean) {
  vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
    matches: matches && query.includes('coarse'),
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }) as unknown as MediaQueryList)
}

/** Свайп пальцем від x0 до x1 по горизонталі. */
function swipe(target: Element, x0: number, x1: number, init: PointerEventInit = {}) {
  const fire = (type: string, x: number) =>
    target.dispatchEvent(
      new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 7, isPrimary: true, pointerType: 'touch', clientX: x, clientY: 100, ...init }),
    )
  fire('pointerdown', x0)
  const steps = 6
  for (let i = 1; i <= steps; i += 1) fire('pointermove', x0 + ((x1 - x0) * i) / steps)
  fire('pointerup', x1)
}

afterEach(() => {
  for (const instance of mounted) instance.unmount()
  mounted = []
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.body.replaceChildren()
  document.head.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.remove())
})

/* ------------------------------------------------------------------ */

describe('UiSwipeActions', () => {
  const ACTIONS = [
    { key: 'pin', label: 'Закріпити', tone: 'accent' as const },
    { key: 'delete', label: 'Видалити', tone: 'danger' as const },
  ]

  async function row(onAction = vi.fn(), onRowClick = vi.fn(), group = 'list', id = 'row') {
    await mount(() =>
      h(UiSwipeActions, { actions: ACTIONS, group, onAction }, {
        default: () => h('button', { id, type: 'button', onClick: onRowClick }, 'Рядок'),
      }),
    )
    await flush()
    return { onAction, onRowClick, target: document.getElementById(id)! }
  }

  it('свайп ліворуч відкриває дії, а дотик по дії шле action', async () => {
    const { onAction, target } = await row()
    swipe(target, 300, 120)
    await flush()
    // Клік одразу після свайпу гасить сам жест — дотикаємося, як людина.
    await new Promise((r) => setTimeout(r, 150))
    const buttons = [...document.querySelectorAll<HTMLButtonElement>('[data-swipe-actions] button')]
    expect(buttons.map((b) => b.textContent?.trim())).toEqual(['Закріпити', 'Видалити'])
    // Дві дії по 72px — рядок відсунуто рівно на їхню ширину.
    expect((target.parentElement as HTMLElement).style.transform).toBe('translateX(-144px)')
    buttons[1]!.click()
    await flush()
    expect(onAction).toHaveBeenCalledWith('delete')
    expect((target.parentElement as HTMLElement).style.transform).toBe('translateX(0px)')
  })

  it('короткий повільний свайп повертає рядок на місце', async () => {
    vi.useFakeTimers()
    const { target } = await row()
    swipe(target, 300, 270)
    await flush()
    vi.advanceTimersByTime(300)
    await flush()
    expect(document.querySelector('[data-swipe-actions]')).toBeNull()
  })

  it('дотик по відкритому рядку закриває дії, а не натискає рядок', async () => {
    const { onRowClick, target } = await row()
    swipe(target, 300, 100)
    await flush()
    // Клік одразу після свайпу гасить сам жест — дотикаємося, як людина.
    await new Promise((r) => setTimeout(r, 150))
    target.click()
    await flush()
    expect(onRowClick).not.toHaveBeenCalled()
    expect((target.parentElement as HTMLElement).style.transform).toBe('translateX(0px)')
  })

  it('у групі відкритий лише один рядок', async () => {
    await row(vi.fn(), vi.fn(), 'list', 'first')
    await row(vi.fn(), vi.fn(), 'list', 'second')
    const first = document.getElementById('first')!
    const second = document.getElementById('second')!
    swipe(first, 300, 100)
    await flush()
    expect((first.parentElement as HTMLElement).style.transform).toBe('translateX(-144px)')
    swipe(second, 300, 100)
    await flush()
    expect((second.parentElement as HTMLElement).style.transform).toBe('translateX(-144px)')
    expect((first.parentElement as HTMLElement).style.transform).toBe('translateX(0px)')
  })

  it('миша рядок не свайпає', async () => {
    const { target } = await row()
    swipe(target, 300, 100, { pointerType: 'mouse' })
    await flush()
    expect(document.querySelector('[data-swipe-actions]')).toBeNull()
  })

  it('class дії замінює тон, а не дописується поверх', async () => {
    await mount(() =>
      h(UiSwipeActions, { actions: [{ key: 'mute', label: 'Без звуку', tone: 'accent', class: 'bg-warning text-accent-contrast' }] }, {
        default: () => h('div', { id: 'r' }, 'Рядок'),
      }),
    )
    await flush()
    swipe(document.getElementById('r')!, 300, 150)
    await flush()
    const button = document.querySelector('[data-swipe-actions] button')!
    expect(button.className).toContain('bg-warning')
    expect(button.className).not.toContain('bg-accent-solid')
  })
})

/* ------------------------------------------------------------------ */

describe('UiSwipeStack', () => {
  async function stack(props: Record<string, unknown> = {}) {
    const onBack = vi.fn()
    const state = reactive({ open: true })
    await mount(() =>
      h(UiSwipeStack, { open: state.open, onBack, ...props }, {
        base: () => h('div', { id: 'base' }, 'Список'),
        page: () => h('div', { id: 'page' }, 'Деталі'),
      }),
    )
    await flush()
    return { onBack, state, page: document.getElementById('page')! }
  }

  it('нижній екран лишається змонтованим і inert під верхнім', async () => {
    const { state } = await stack()
    const base = document.getElementById('base')!
    expect(base.parentElement!.hasAttribute('inert')).toBe(true)
    state.open = false
    await flush()
    expect(document.getElementById('base')).toBe(base)
    expect(base.parentElement!.hasAttribute('inert')).toBe(false)
  })

  it('свайп праворуч далі ~40% ширини — подія back', async () => {
    vi.useFakeTimers()
    const { onBack, page } = await stack()
    swipe(page, 10, window.innerWidth * 0.6)
    await flush()
    vi.advanceTimersByTime(400)
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('короткий свайп повертає екран на місце', async () => {
    vi.useFakeTimers()
    const { onBack, page } = await stack()
    swipe(page, 10, 60)
    await flush()
    vi.advanceTimersByTime(400)
    await flush()
    expect(onBack).not.toHaveBeenCalled()
    expect(page.parentElement!.style.transform).toBe('')
  })

  it('swipe=false — жесту немає', async () => {
    vi.useFakeTimers()
    const { onBack, page } = await stack({ swipe: false })
    swipe(page, 10, window.innerWidth * 0.8)
    vi.advanceTimersByTime(400)
    expect(onBack).not.toHaveBeenCalled()
  })
})

/* ------------------------------------------------------------------ */

describe('UiContextMenu: тактильний відгук', () => {
  let vibrate: ReturnType<typeof vi.fn>
  beforeEach(() => {
    vibrate = vi.fn()
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true })
  })

  async function longPress(props: Record<string, unknown>) {
    vi.useFakeTimers()
    coarse(true)
    const state = reactive({ open: false })
    await mount(() =>
      h(UiContextMenu, { modelValue: state.open, 'onUpdate:modelValue': (v: boolean) => (state.open = v), ...props }, {
        default: ({ targetAttrs }: { targetAttrs: Record<string, unknown> }) => h('div', { ...targetAttrs, id: 'target', tabindex: 0 }, 'Ціль'),
        content: () => h('button', { role: 'menuitem' }, 'Дія'),
      }),
    )
    document.getElementById('target')!.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, pointerId: 3, isPrimary: true, pointerType: 'touch', clientX: 20, clientY: 20 }),
    )
    vi.advanceTimersByTime(700)
    return state
  }

  it('haptic — довге натискання дає короткий відгук', async () => {
    const state = await longPress({ haptic: true })
    expect(state.open).toBe(true)
    expect(vibrate).toHaveBeenCalledTimes(1)
  })

  it('без haptic — меню відкривається мовчки', async () => {
    const state = await longPress({})
    expect(state.open).toBe(true)
    expect(vibrate).not.toHaveBeenCalled()
  })
})

/* ------------------------------------------------------------------ */

describe('Дрібниці дотику', () => {
  it('haptic вібрує лише на дотиковому пристрої', () => {
    const vibrate = vi.fn()
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true })
    coarse(false)
    haptic()
    expect(vibrate).not.toHaveBeenCalled()
    vi.restoreAllMocks()
    coarse(true)
    haptic()
    expect(vibrate).toHaveBeenCalledTimes(1)
  })

  it('theme-color — колір токена теми, поверхня кладе свій поверх', () => {
    document.head.insertAdjacentHTML(
      'beforeend',
      '<meta name="theme-color" media="(prefers-color-scheme: light)" content="#ffffff"><meta name="theme-color" media="(prefers-color-scheme: dark)" content="#000000">',
    )
    document.documentElement.style.setProperty('--bg-card', '#fafafa')
    document.documentElement.style.setProperty('--stage', '#0f0d0a')
    const stop = startThemeColor()
    const metas = () => [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')]
    expect(metas().map((m) => m.content)).toEqual(['#fafafa'])
    const pop = pushThemeColorSurface('--stage')
    expect(metas()[0]!.content).toBe('#0f0d0a')
    pop()
    expect(metas()[0]!.content).toBe('#fafafa')
    stop()
    document.documentElement.style.removeProperty('--bg-card')
    document.documentElement.style.removeProperty('--stage')
  })
})
