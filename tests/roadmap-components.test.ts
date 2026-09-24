import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { createSSRApp, h, nextTick } from 'vue'
import { renderToString } from '@vue/server-renderer'
import UiCarousel from '~/components/ui/UiCarousel.vue'
import UiCheckbox from '~/components/ui/UiCheckbox.vue'
import UiContextMenu from '~/components/ui/UiContextMenu.vue'
import UiHoverCard from '~/components/ui/UiHoverCard.vue'
import UiInputOtp from '~/components/ui/UiInputOtp.vue'
import UiNavigationMenu from '~/components/ui/UiNavigationMenu.vue'
import UiPopover from '~/components/ui/UiPopover.vue'
import UiRadioGroup from '~/components/ui/UiRadioGroup.vue'
import UiResizablePanels from '~/components/ui/UiResizablePanels.vue'
import UiScrollArea from '~/components/ui/UiScrollArea.vue'
import UiSidebar from '~/components/ui/UiSidebar.vue'
import { mountComponent } from './helpers/mountComponent'

beforeAll(() => {
  HTMLElement.prototype.scrollIntoView ??= () => undefined
  HTMLElement.prototype.scrollTo ??= () => undefined
})

afterEach(() => {
  document.body.innerHTML = ''
  document.body.removeAttribute('style')
  delete document.body.dataset.overlayScrollLocked
  vi.useRealTimers()
})

describe('roadmap form controls', () => {
  it('Checkbox синхронізує mixed state та серіалізує name окремо від id', async () => {
    const values: boolean[] = []
    const mounted = await mountComponent(UiCheckbox, {
      modelValue: false,
      indeterminate: true,
      id: 'terms-id',
      name: 'terms',
      value: 'accepted',
      label: 'Умови',
      'onUpdate:modelValue': (value: boolean) => values.push(value),
    })
    const input = mounted.host.querySelector<HTMLInputElement>('input')!
    expect(input.id).toBe('terms-id')
    expect(input.name).toBe('terms')
    expect(input.value).toBe('accepted')
    expect(input.indeterminate).toBe(true)
    expect(input.getAttribute('aria-checked')).toBe('mixed')
    input.checked = true
    input.dispatchEvent(new Event('change', { bubbles: true }))
    expect(values).toEqual([true])
    mounted.unmount()
  })

  it('RadioGroup пропускає disabled option у Arrow/Home/End navigation', async () => {
    const values: string[] = []
    const mounted = await mountComponent(UiRadioGroup, {
      modelValue: 'a',
      name: 'choice',
      options: [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B', disabled: true },
        { value: 'c', label: 'C' },
      ],
      'onUpdate:modelValue': (value: string) => values.push(value),
    })
    const radios = [...mounted.host.querySelectorAll<HTMLInputElement>('input[type="radio"]')]
    expect(radios.map(input => input.tabIndex)).toEqual([0, -1, -1])
    radios[0]!.focus()
    radios[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    await nextTick()
    expect(document.activeElement).toBe(radios[2])
    expect(values).toEqual(['c'])
    expect(radios[2]!.name).toBe('choice')
    mounted.unmount()
  })

  it('InputOtp має один input, нормалізує paste та повідомляє complete', async () => {
    const values: string[] = []
    const completed: string[] = []
    const mounted = await mountComponent(UiInputOtp, {
      modelValue: '',
      length: 6,
      name: 'otp',
      label: 'Код',
      'onUpdate:modelValue': (value: string) => values.push(value),
      onComplete: (value: string) => completed.push(value),
    })
    const input = mounted.host.querySelector<HTMLInputElement>('input')!
    input.value = '12 3a456'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    expect(mounted.host.querySelectorAll('input')).toHaveLength(1)
    expect(input.value).toBe('123456')
    expect(values).toEqual(['123456'])
    expect(completed).toEqual(['123456'])
    expect(input.autocomplete).toBe('one-time-code')
    mounted.unmount()
  })
})

describe('roadmap overlays and navigation', () => {
  it('Popover має SSR-safe initial tree й повертає focus по Escape', async () => {
    const server = await renderToString(createSSRApp({
      render: () => h(UiPopover, { modelValue: false }, {
        trigger: ({ triggerAttrs }: any) => h('button', triggerAttrs, 'Відкрити'),
        default: () => h('p', 'Панель'),
      }),
    }))
    expect(server).toContain('Відкрити')
    expect(server).not.toContain('Панель')

    let mounted: Awaited<ReturnType<typeof mountComponent>>
    mounted = await mountComponent(UiPopover, {
      modelValue: true,
      'onUpdate:modelValue': (value: boolean) => { mounted.props.modelValue = value },
    }, {
      trigger: ({ triggerAttrs }: any) => h('button', { ...triggerAttrs, type: 'button' }, 'Відкрити'),
      default: () => h('button', { type: 'button' }, 'Дія'),
    })
    await nextTick()
    const trigger = mounted.host.querySelector<HTMLButtonElement>('button')!
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()
    expect(mounted.props.modelValue).toBe(false)
    expect(document.activeElement).toBe(trigger)
    mounted.unmount()
  })

  it('ContextMenu відкривається з Shift+F10 та фокусує перший menuitem', async () => {
    let mounted: Awaited<ReturnType<typeof mountComponent>>
    mounted = await mountComponent(UiContextMenu, {
      modelValue: false,
      'onUpdate:modelValue': (value: boolean) => { mounted.props.modelValue = value },
    }, {
      default: ({ targetAttrs }: any) => h('button', { ...targetAttrs, type: 'button' }, 'Target'),
      content: () => [
        h('button', { role: 'menuitem', type: 'button' }, 'Перша'),
        h('button', { role: 'menuitem', type: 'button', disabled: true }, 'Disabled'),
      ],
    })
    const target = mounted.host.querySelector<HTMLButtonElement>('button')!
    target.focus()
    target.dispatchEvent(new KeyboardEvent('keydown', { key: 'F10', shiftKey: true, bubbles: true }))
    await nextTick()
    await nextTick()
    const menu = document.body.querySelector<HTMLElement>('[role="menu"]')!
    expect(menu).toBeTruthy()
    expect(document.activeElement?.textContent).toBe('Перша')
    document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()
    expect(document.activeElement).toBe(target)
    mounted.unmount()
  })

  it('NavigationMenu переміщує root focus і відкриває enabled children', async () => {
    let mounted: Awaited<ReturnType<typeof mountComponent>>
    mounted = await mountComponent(UiNavigationMenu, {
      modelValue: null,
      items: [
        { id: 'home', label: 'Головна', href: '#home' },
        { id: 'disabled', label: 'Disabled', disabled: true, href: '#disabled' },
        { id: 'products', label: 'Продукти', children: [
          { id: 'one', label: 'Перший', href: '#one' },
          { id: 'two', label: 'Disabled child', disabled: true },
        ] },
      ],
      'onUpdate:modelValue': (value: string | null) => { mounted.props.modelValue = value },
    })
    const roots = [...mounted.host.querySelectorAll<HTMLElement>('nav > ul > li > *')]
    roots[0]!.focus()
    roots[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    expect(document.activeElement).toBe(roots[2])
    roots[2]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    await nextTick()
    await nextTick()
    expect(mounted.props.modelValue).toBe('products')
    expect(document.activeElement?.textContent).toContain('Перший')
    mounted.unmount()
  })

  it('NavigationMenu — disclosure: кожен пункт у Tab-обході, стрілки лише прискорюють', async () => {
    /*
     * Раніше меню оголошувало menubar/menuitem з roving tabindex [0, -1, -1],
     * але не виконувало контракту меню (підменю з усіма пунктами в Tab,
     * стрілки між групами), а посилання втрачали семантику посилань.
     * Тепер це disclosure-навігація: Tab проходить кожен доступний пункт,
     * ←/→/Home/End лишаються прискорювачем фокуса.
     */
    const mounted = await mountComponent(UiNavigationMenu, {
      modelValue: null,
      items: [
        { id: 'home', label: 'Головна', href: '#home' },
        { id: 'docs', label: 'Документація', href: '#docs' },
        { id: 'about', label: 'Про нас', href: '#about' },
        { id: 'off', label: 'Вимкнено', href: '#off', disabled: true },
      ],
    })
    expect(mounted.host.querySelector('[role="menubar"], [role="menuitem"]')).toBeNull()
    const roots = [...mounted.host.querySelectorAll<HTMLElement>('nav > ul > li > *')]
    expect(roots.map((el) => el.tabIndex)).toEqual([0, 0, 0, -1])

    roots[0]!.focus()
    roots[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    await nextTick()
    expect(document.activeElement).toBe(roots[1])

    roots[1]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }))
    await nextTick()
    expect(document.activeElement).toBe(roots[2])
    mounted.unmount()
  })

  it('HoverCard використовує один delay timer для hover/focus і очищає його', async () => {
    vi.useFakeTimers()
    let mounted: Awaited<ReturnType<typeof mountComponent>>
    mounted = await mountComponent(UiHoverCard, {
      modelValue: false,
      openDelay: 100,
      closeDelay: 50,
      'onUpdate:modelValue': (value: boolean) => { mounted.props.modelValue = value },
    }, {
      trigger: ({ triggerAttrs }: any) => h('a', { ...triggerAttrs, href: '#profile' }, 'Профіль'),
      default: () => h('p', 'Preview'),
    })
    const trigger = mounted.host.querySelector<HTMLAnchorElement>('a')!
    trigger.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }))
    trigger.dispatchEvent(new FocusEvent('focus', { bubbles: true }))
    expect(vi.getTimerCount()).toBe(1)
    await vi.advanceTimersByTimeAsync(100)
    await nextTick()
    expect(document.body.querySelector('[role="dialog"]')?.textContent).toContain('Preview')
    mounted.unmount()
    vi.runAllTimers()
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('roadmap layout controls', () => {
  it('Sidebar перемикає mobile dialog і desktop collapsed state', async () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as MediaQueryList)
    const openValues: boolean[] = []
    const collapsedValues: boolean[] = []
    const mounted = await mountComponent(UiSidebar, {
      modelValue: true,
      collapsed: false,
      'onUpdate:modelValue': (value: boolean) => openValues.push(value),
      'onUpdate:collapsed': (value: boolean) => collapsedValues.push(value),
    }, { header: () => 'Навігація', default: () => h('a', { href: '#one' }, 'Розділ') })
    const aside = mounted.host.querySelector<HTMLElement>('aside')!
    expect(aside.getAttribute('role')).toBe('dialog')
    expect(aside.getAttribute('aria-modal')).toBe('true')
    expect(document.body.dataset.overlayScrollLocked).toBe('true')
    mounted.host.querySelector<HTMLButtonElement>('[aria-label="Згорнути бічну панель"]')!.click()
    expect(collapsedValues).toEqual([true])
    /*
     * Шар — зі спільного стеку, а не з літерала z-[1000]. Поки він був
     * літералом, UiModal, відкритий із сайдбару, отримував рівно той самий
     * z-index, і що опиниться зверху, вирішував порядок вузлів у DOM.
     */
    expect(aside.className).not.toMatch(/z-\[/)
    expect(Number(aside.style.zIndex)).toBeGreaterThanOrEqual(1000)
    const backdrop = mounted.host.querySelector<HTMLElement>('button[aria-label="Закрити бічну панель"]')!
    expect(backdrop.className).not.toMatch(/z-\[/)
    expect(Number(backdrop.style.zIndex)).toBeLessThan(Number(aside.style.zIndex))

    aside.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(openValues).toEqual([false])
    mounted.unmount()
  })

  it('ScrollArea лишає нативний region та програмний API', async () => {
    const mounted = await mountComponent(UiScrollArea, { height: '10rem', ariaLabel: 'Події' }, { default: () => h('div', 'Вміст') })
    const region = mounted.host.querySelector<HTMLElement>('[role="region"]')!
    expect(region.getAttribute('aria-label')).toBe('Події')
    expect(region.tabIndex).toBe(0)
    expect(region.style.height).toBe('10rem')
    expect(typeof region.scrollTo).toBe('function')
    mounted.unmount()
  })

  it('ScrollArea віддає стан країв у слот', async () => {
    const seen: Array<{ atStart: boolean; atEnd: boolean }> = []
    const mounted = await mountComponent(UiScrollArea, { height: '10rem' }, {
      default: (props: any) => {
        seen.push({ atStart: props.atStart, atEnd: props.atEnd })
        return h('div', 'Вміст')
      },
    })
    expect(seen.at(-1)).toEqual({ atStart: true, atEnd: true })
    mounted.unmount()
  })

  it('ResizablePanels має separator ARIA і keyboard resize з bounds', async () => {
    const values: number[] = []
    const mounted = await mountComponent(UiResizablePanels, {
      modelValue: 50,
      min: 30,
      max: 60,
      step: 10,
      'onUpdate:modelValue': (value: number) => values.push(value),
    }, { start: () => 'A', end: () => 'B' })
    const separator = mounted.host.querySelector<HTMLElement>('[role="separator"]')!
    expect(separator.getAttribute('aria-orientation')).toBe('vertical')
    expect(separator.getAttribute('aria-valuenow')).toBe('50')
    separator.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }))
    separator.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    expect(values).toEqual([60, 60])
    mounted.unmount()
  })

  it('ResizablePanels працює без v-model: клавіатура змінює розмір і емітує change', async () => {
    const changes: number[] = []
    const mounted = await mountComponent(UiResizablePanels, {
      min: 10,
      max: 90,
      step: 10,
      onChange: (value: number) => changes.push(value),
    }, { start: () => 'A', end: () => 'B' })
    const separator = mounted.host.querySelector<HTMLElement>('[role="separator"]')!
    expect(separator.getAttribute('aria-valuenow')).toBe('50')
    separator.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    await nextTick()
    expect(separator.getAttribute('aria-valuenow')).toBe('60')
    expect(changes).toEqual([60])
    mounted.unmount()
  })

  it('ResizablePanels зберігає розмір у localStorage і відновлює його на клієнті', async () => {
    localStorage.setItem('rp-test-key', '70')
    const changes: number[] = []
    // Некерований вживання — так компонент живе в реальних shell-ах.
    // Відновлення відбувається в onMounted, тож перший рендер (SSR) дає дефолт,
    // а клієнтський mount застосовує збережені 70.
    const mounted = await mountComponent(UiResizablePanels, {
      min: 20,
      max: 80,
      storageKey: 'rp-test-key',
      onChange: (value: number) => changes.push(value),
    }, { start: () => 'A', end: () => 'B' })
    const separator = mounted.host.querySelector<HTMLElement>('[role="separator"]')!
    expect(separator.getAttribute('aria-valuenow')).toBe('70')
    // Keyboard-дія перезаписує збережене значення.
    separator.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }))
    await nextTick()
    expect(separator.getAttribute('aria-valuenow')).toBe('20')
    expect(localStorage.getItem('rp-test-key')).toBe('20')
    expect(changes).toEqual([20])
    mounted.unmount()
    localStorage.removeItem('rp-test-key')
  })

  it('Carousel нормалізує index, керується клавіатурою і маркує слайд', async () => {
    const values: number[] = []
    const mounted = await mountComponent(UiCarousel, {
      items: ['A', 'B', 'C'],
      modelValue: 99,
      'onUpdate:modelValue': (value: number) => values.push(value),
    }, { slide: ({ item }: any) => h('p', item) })
    await nextTick()
    expect(values).toContain(2)
    const carousel = mounted.host.querySelector<HTMLElement>('[aria-roledescription="carousel"]')!
    expect(mounted.host.querySelector<HTMLElement>('[aria-roledescription="slide"]:not([aria-hidden])')?.getAttribute('aria-label')).toBe('3 з 3')
    carousel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }))
    expect(values.at(-1)).toBe(0)
    mounted.unmount()
  })

  it('Carousel не запускає autoplay при reduced motion', async () => {
    vi.useFakeTimers()
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as MediaQueryList)
    const mounted = await mountComponent(UiCarousel, {
      items: ['A', 'B'],
      autoplay: true,
      interval: 1000,
    }, { slide: ({ item }: any) => h('p', item) })
    expect(vi.getTimerCount()).toBe(0)
    mounted.unmount()
  })
})
