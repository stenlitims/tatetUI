import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { h, nextTick, reactive } from 'vue'
import UiContextMenu from '~/components/ui/UiContextMenu.vue'
import UiMenu from '~/components/ui/UiMenu.vue'
import UiPopover from '~/components/ui/UiPopover.vue'
import UiSelect from '~/components/ui/UiSelect.vue'
import UiTooltip from '~/components/ui/UiTooltip.vue'
import UiVirtualList from '~/components/ui/UiVirtualList.vue'
import { mountComponent } from './helpers/mountComponent'

/*
 * Оверлеї в довгих списках: меню, підказка чи селект у кожному рядку.
 * Закритий екземпляр не має рендеритися вдруге одразу після монтування й
 * тримати слухачів вікна чи документа; контекстне меню списку — одне на
 * весь список (targetSelector), а не в кожному рядку.
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

beforeAll(() => {
  HTMLElement.prototype.scrollIntoView ??= () => undefined
})

afterEach(() => {
  for (const instance of mounted) instance.unmount()
  mounted = []
  document.body.replaceChildren()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('закритий оверлей не рендериться вдруге після монтування', () => {
  it('UiContextMenu, UiMenu, UiPopover, UiTooltip — тригер рендериться один раз', async () => {
    const renders = { context: 0, menu: 0, popover: 0, tooltip: 0 }
    await mount(() => [
      h(UiContextMenu, { modelValue: false }, {
        default: ({ targetAttrs }: { targetAttrs: Record<string, unknown> }) => (renders.context++, h('div', targetAttrs, 'Рядок')),
        content: () => h('button', { role: 'menuitem' }, 'Дія'),
      }),
      h(UiMenu, null, {
        trigger: ({ triggerAttrs }: { triggerAttrs: Record<string, unknown> }) => (renders.menu++, h('button', triggerAttrs, 'Ще')),
        content: () => h('button', { role: 'menuitem' }, 'Дія'),
      }),
      h(UiPopover, { modelValue: false }, {
        trigger: ({ triggerAttrs }: { triggerAttrs: Record<string, unknown> }) => (renders.popover++, h('button', triggerAttrs, 'Фільтри')),
        default: () => h('p', 'Панель'),
      }),
      h(UiTooltip, { content: 'Пояснення' }, {
        default: () => (renders.tooltip++, h('button', 'Кнопка')),
      }),
    ])
    await flush()
    expect(renders).toEqual({ context: 1, menu: 1, popover: 1, tooltip: 1 })
  })

  it('відкрите з першого рендеру меню однаково опиняється в <body>', async () => {
    await mount(() =>
      h('div', { style: 'transform: translateX(0)', id: 'list' }, [
        h(UiContextMenu, { modelValue: true }, {
          default: ({ targetAttrs }: { targetAttrs: Record<string, unknown> }) => h('div', targetAttrs, 'Рядок'),
          content: () => h('button', { role: 'menuitem', id: 'item' }, 'Дія'),
        }),
      ]),
    )
    await flush()
    const menu = document.querySelector('[data-ui-context-menu]')!
    expect(menu.parentElement).toBe(document.body)
    expect(document.getElementById('list')!.contains(menu)).toBe(false)
  })
})

describe('слухачі вікна й документа — лише поки панель відкрита', () => {
  it('UiMenu: прокрутка й resize вікна — лише у відкритого меню', async () => {
    const add = vi.spyOn(window, 'addEventListener')
    const remove = vi.spyOn(window, 'removeEventListener')
    const instance = await mount(() =>
      h(UiMenu, null, {
        trigger: ({ toggle, triggerAttrs }: { toggle: () => void; triggerAttrs: Record<string, unknown> }) =>
          h('button', { ...triggerAttrs, id: 'trigger', onClick: toggle }, 'Ще'),
        content: () => h('button', { role: 'menuitem' }, 'Дія'),
      }),
    )
    await flush()
    expect(add.mock.calls.filter(([type]) => type === 'scroll')).toHaveLength(0)
    document.getElementById('trigger')!.click()
    await flush()
    expect(add.mock.calls.filter(([type]) => type === 'scroll')).toHaveLength(1)
    document.getElementById('trigger')!.click()
    await flush()
    expect(remove.mock.calls.filter(([type]) => type === 'scroll')).toHaveLength(1)
    instance.unmount()
  })

  it('UiTooltip: закрита підказка не слухає прокрутку сторінки', async () => {
    const add = vi.spyOn(window, 'addEventListener')
    await mount(() => h(UiTooltip, { content: 'Пояснення' }, { default: () => h('button', 'Кнопка') }))
    await flush()
    expect(add.mock.calls.filter(([type]) => type === 'scroll' || type === 'resize')).toHaveLength(0)
  })

  it('UiSelect: закритий список не перехоплює кожен дотик до сторінки', async () => {
    const add = vi.spyOn(document, 'addEventListener')
    const state = reactive({ value: null as string | null })
    await mount(() =>
      h(UiSelect, {
        modelValue: state.value,
        'onUpdate:modelValue': (v: string | null) => (state.value = v),
        label: 'Статус',
        options: [{ value: 'a', label: 'Активні' }, { value: 'b', label: 'Архів' }],
      }),
    )
    await flush()
    expect(add.mock.calls.filter(([type]) => type === 'pointerdown')).toHaveLength(0)
    const combobox = document.querySelector<HTMLElement>('[role="combobox"]')!
    combobox.focus()
    combobox.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    await flush()
    expect(add.mock.calls.filter(([type]) => type === 'pointerdown')).toHaveLength(1)
  })
})

describe('UiContextMenu: одне меню на список (targetSelector)', () => {
  async function list() {
    const state = reactive({ open: false, opened: [] as string[] })
    await mount(() =>
      h(UiContextMenu, {
        modelValue: state.open,
        'onUpdate:modelValue': (v: boolean) => (state.open = v),
        onOpen: (target: HTMLElement | null) => state.opened.push(target?.id ?? ''),
        targetSelector: '[data-row]',
      }, {
        default: ({ targetAttrs }: { targetAttrs: Record<string, unknown> }) =>
          h('div', { ...targetAttrs, id: 'list' }, [
            ...[1, 2, 3].map((n) => h('div', { 'data-row': '', id: `row-${n}`, tabindex: 0 }, [h('span', { id: `text-${n}` }, `Рядок ${n}`)])),
            h('p', { id: 'outside' }, 'Порожньо'),
          ]),
        content: ({ target }: { target: HTMLElement | null }) => h('button', { role: 'menuitem', id: 'item' }, `Дії: ${target?.id}`),
      }),
    )
    await flush()
    return state
  }

  const contextmenu = (el: Element) => {
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 })
    el.dispatchEvent(event)
    return event
  }

  it('відкривається для рядка під подією й передає його в слот і подію', async () => {
    const state = await list()
    const event = contextmenu(document.getElementById('text-2')!)
    await flush()
    expect(event.defaultPrevented).toBe(true)
    expect(state.open).toBe(true)
    expect(state.opened).toEqual(['row-2'])
    expect(document.getElementById('item')!.textContent).toBe('Дії: row-2')
  })

  it('подія повз рядки меню не відкриває й не гасить системне', async () => {
    const state = await list()
    const event = contextmenu(document.getElementById('outside')!)
    await flush()
    expect(event.defaultPrevented).toBe(false)
    expect(state.open).toBe(false)
  })

  it('довге натискання пальцем — меню рядка', async () => {
    vi.useFakeTimers()
    const state = await list()
    document.getElementById('text-3')!.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, pointerId: 7, isPrimary: true, pointerType: 'touch', clientX: 5, clientY: 5 }),
    )
    vi.advanceTimersByTime(700)
    await flush()
    expect(state.open).toBe(true)
    expect(state.opened).toEqual(['row-3'])
  })

  it('контейнер не отримує aria-атрибутів меню; Escape повертає фокус на рядок', async () => {
    await list()
    const container = document.getElementById('list')!
    expect(container.hasAttribute('aria-haspopup')).toBe(false)
    expect(container.hasAttribute('aria-expanded')).toBe(false)
    const row = document.getElementById('row-1')!
    row.focus()
    row.dispatchEvent(new KeyboardEvent('keydown', { key: 'F10', shiftKey: true, bubbles: true, cancelable: true }))
    await flush()
    expect(document.getElementById('item')!.textContent).toBe('Дії: row-1')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flush()
    expect(document.activeElement).toBe(row)
  })
})

describe('UiVirtualList: прокрутка в межах вікна не рендерить рядків наново', () => {
  it('слот рядка не викликається, поки в зону не входить новий рядок', async () => {
    const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight')
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      get() {
        return (this as HTMLElement).getAttribute('role') === 'list' ? 300 : 0
      },
    })
    try {
      const items = Array.from({ length: 200 }, (_, index) => ({ id: index, label: `Рядок ${index}` }))
      let renders = 0
      const instance = await mountComponent(
        UiVirtualList,
        { items, itemHeight: 30, height: '300px', overscan: 0 },
        { item: ({ item }: { item: { label: string } }) => (renders++, h('span', item.label)) },
      )
      mounted.push(instance)
      const list = instance.host.querySelector<HTMLElement>('[role="list"]')!
      const scrollTo = async (top: number) => {
        list.scrollTop = top
        list.dispatchEvent(new Event('scroll'))
        await flush()
      }
      await scrollTo(31)
      const afterFirst = renders
      // 31…59 px — той самий діапазон рядків 1–12.
      await scrollTo(45)
      await scrollTo(59)
      expect(renders).toBe(afterFirst)
      await scrollTo(95)
      expect(renders).toBeGreaterThan(afterFirst)
    } finally {
      if (original) Object.defineProperty(HTMLElement.prototype, 'clientHeight', original)
    }
  })
})
