import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { effectScope, h, nextTick, reactive } from 'vue'
import UiCommandPalette from '~/components/ui/UiCommandPalette.vue'
import UiConfirmDialog from '~/components/ui/UiConfirmDialog.vue'
import UiContextMenu from '~/components/ui/UiContextMenu.vue'
import UiDrawer from '~/components/ui/UiDrawer.vue'
import UiHoverCard from '~/components/ui/UiHoverCard.vue'
import UiMenu from '~/components/ui/UiMenu.vue'
import UiModal from '~/components/ui/UiModal.vue'
import UiPopover from '~/components/ui/UiPopover.vue'
import UiSelect from '~/components/ui/UiSelect.vue'
import UiSplitButton from '~/components/ui/UiSplitButton.vue'
import UiToaster from '~/components/ui/UiToaster.vue'
import UiTooltip from '~/components/ui/UiTooltip.vue'
import { useConfirm } from '~/composables/useConfirm'
import { useFloatingLayer, useOverlayLayer } from '~/composables/useOverlayStack'
import { useToast } from '~/composables/useToast'
import { mountComponent } from './helpers/mountComponent'

/*
 * Регресії з аудиту оверлеїв. Кожен блок відтворює сценарій, у якому
 * компонент ламався в реальному використанні, а не лише «рендериться».
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

const escape = (target: EventTarget = document.activeElement ?? document) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
const tab = (target: EventTarget, shiftKey = false) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true }))
const pointerDown = (target: EventTarget, init: PointerEventInit = {}) =>
  target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, ...init }))

beforeAll(() => {
  HTMLElement.prototype.scrollIntoView ??= () => undefined
})

afterEach(() => {
  for (const instance of mounted) instance.unmount()
  mounted = []
  const toast = useToast()
  toast.dismissAll()
  document.body.replaceChildren()
  document.body.removeAttribute('style')
  delete document.body.dataset.overlayScrollLocked
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

/* ------------------------------------------------------------------ */

describe('useFocusTrap — закриття не в порядку LIFO', () => {
  it('drawer і modal, закриті одним тактом, не лишають сторінку inert', async () => {
    const state = reactive({ drawer: false, modal: false })
    const app = await mount(() => [
      h('button', { id: 'opener' }, 'Відкрити'),
      h(UiDrawer, { modelValue: state.drawer, title: 'Drawer', 'onUpdate:modelValue': (v: boolean) => (state.drawer = v) }, {
        default: () => h('button', 'У drawer'),
      }),
      h(UiModal, { modelValue: state.modal, title: 'Modal', 'onUpdate:modelValue': (v: boolean) => (state.modal = v) }, {
        default: () => h('button', 'У modal'),
      }),
    ])
    const opener = document.getElementById('opener')!
    opener.focus()
    state.drawer = true
    await flush()
    state.modal = true
    await flush()
    expect(app.host.hasAttribute('inert')).toBe(true)

    // «Зберегти й закрити» закриває весь потік — drawer оголошено першим,
    // тож його watcher спрацьовує ПЕРШИМ.
    state.modal = false
    state.drawer = false
    await flush()
    expect(app.host.hasAttribute('inert')).toBe(false)
    expect(app.host.hasAttribute('aria-hidden')).toBe(false)
    expect(document.activeElement).toBe(opener)
  })

  it('modal у слоті drawer: закриття drawer повертає фокус на першу кнопку ланцюжка', async () => {
    const state = reactive({ drawer: false, modal: false })
    const app = await mount(() => [
      h('button', { id: 'opener' }, 'Відкрити'),
      h(UiDrawer, { modelValue: state.drawer, title: 'Drawer', 'onUpdate:modelValue': (v: boolean) => (state.drawer = v) }, {
        default: () => [
          h('button', { id: 'inner-opener' }, 'Видалити…'),
          h(UiModal, { modelValue: state.modal, title: 'Точно?', 'onUpdate:modelValue': (v: boolean) => (state.modal = v) }, {
            default: () => h('button', 'Так'),
          }),
        ],
      }),
    ])
    document.getElementById('opener')!.focus()
    state.drawer = true
    await flush()
    document.getElementById('inner-opener')!.focus()
    state.modal = true
    await flush()

    state.drawer = false
    await flush()
    expect(app.host.hasAttribute('inert')).toBe(false)
    expect(app.host.getAttribute('aria-hidden')).toBeNull()
    expect(document.activeElement?.id).toBe('opener')
  })
})

/* ------------------------------------------------------------------ */

describe('спільний стек: Escape і клік «повз»', () => {
  const selectProps = (state: { value: string | null }) => ({
    modelValue: state.value,
    'onUpdate:modelValue': (v: string | null) => (state.value = v),
    label: 'Статус',
    options: [
      { value: 'active', label: 'Активні' },
      { value: 'blocked', label: 'Заблоковані' },
    ],
  })

  it('вибір у UiSelect усередині UiPopover не закриває поповер і не губиться', async () => {
    const state = reactive({ open: true, value: null as string | null })
    await mount(() =>
      h(UiPopover, { modelValue: state.open, 'onUpdate:modelValue': (v: boolean) => (state.open = v) }, {
        trigger: ({ triggerAttrs }: any) => h('button', triggerAttrs, 'Фільтри'),
        default: () => h(UiSelect, selectProps(state)),
      }),
    )
    await flush()
    const combobox = document.querySelector<HTMLElement>('[role="combobox"]')!
    combobox.focus()
    combobox.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    await flush()
    const option = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find((node) =>
      node.textContent?.includes('Заблоковані'),
    )!
    pointerDown(option)
    option.click()
    await flush()
    expect(state.open).toBe(true)
    expect(state.value).toBe('blocked')
  })

  it('Escape у відкритому UiSelect згортає лише список, наступний — поповер', async () => {
    const state = reactive({ open: true, value: null as string | null })
    await mount(() =>
      h(UiPopover, { modelValue: state.open, 'onUpdate:modelValue': (v: boolean) => (state.open = v) }, {
        trigger: ({ triggerAttrs }: any) => h('button', triggerAttrs, 'Фільтри'),
        default: () => h(UiSelect, selectProps(state)),
      }),
    )
    await flush()
    const combobox = document.querySelector<HTMLElement>('[role="combobox"]')!
    combobox.focus()
    combobox.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    await flush()
    expect(combobox.getAttribute('aria-expanded')).toBe('true')

    escape(combobox)
    await flush()
    expect(combobox.getAttribute('aria-expanded')).toBe('false')
    expect(state.open).toBe(true)

    escape(combobox)
    await flush()
    expect(state.open).toBe(false)
  })

  it('UiMenu у UiModal закривається від кліку деінде в модалці', async () => {
    await mount(() =>
      h(UiModal, { modelValue: true, title: 'Редагування' }, {
        default: () => [
          h('p', { id: 'elsewhere' }, 'Текст у модалці'),
          h(UiMenu, null, {
            trigger: ({ toggle, triggerAttrs }: any) =>
              h('button', { ...triggerAttrs, id: 'menu-trigger', onClick: toggle }, 'Дії'),
            content: () => h('button', { role: 'menuitem', id: 'menu-item' }, 'Перейменувати'),
          }),
        ],
      }),
    )
    await flush()
    const trigger = document.getElementById('menu-trigger')!
    trigger.click()
    await flush()
    pointerDown(document.getElementById('menu-item')!)
    await flush()
    expect(trigger.getAttribute('aria-expanded')).toBe('true')

    pointerDown(document.getElementById('elsewhere')!)
    await flush()
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })

  it('діалог, відкритий із відкритого меню, отримує Escape першим', async () => {
    const state = reactive({ dialog: false })
    await mount(() => [
      h(UiMenu, null, {
        trigger: ({ toggle, triggerAttrs }: any) =>
          h('button', { ...triggerAttrs, id: 'menu-trigger', onClick: toggle }, 'Дії'),
        // Пункт відкриває діалог і закриє меню лише після відповіді —
        // типовий патерн `await confirm()`.
        content: () => h('button', { role: 'menuitem', id: 'remove', onClick: () => (state.dialog = true) }, 'Видалити…'),
      }),
      h(UiModal, { modelValue: state.dialog, title: 'Точно?', 'onUpdate:modelValue': (v: boolean) => (state.dialog = v) }, {
        default: () => h('button', 'Так'),
      }),
    ])
    const trigger = document.getElementById('menu-trigger')!
    trigger.click()
    await flush()
    document.getElementById('remove')!.click()
    await flush()

    escape()
    await flush()
    expect(state.dialog).toBe(false)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')

    escape()
    await flush()
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })

  it('Escape для підказки в модалці не закриває модалку', async () => {
    const state = reactive({ open: true })
    await mount(() =>
      h(UiModal, { modelValue: state.open, title: 'Форма', 'onUpdate:modelValue': (v: boolean) => (state.open = v) }, {
        default: () =>
          h(UiTooltip, { content: 'Пояснення' }, {
            default: ({ describedBy }: any) => h('button', { id: 'hint', 'aria-describedby': describedBy }, '?'),
          }),
      }),
    )
    await flush()
    document.getElementById('hint')!.focus()
    await flush()
    expect(document.querySelector('[role="tooltip"]')).not.toBeNull()

    escape()
    await flush()
    expect(state.open).toBe(true)
    expect(document.getElementById('hint')!.getAttribute('aria-describedby')).toBeNull()

    escape()
    await flush()
    expect(state.open).toBe(false)
  })

  it('пасивна підказка не забирає isTopmost, а меню забирає', () => {
    const scope = effectScope()
    scope.run(() => {
      const modal = useOverlayLayer()
      const tooltip = useFloatingLayer({ elements: () => [], passive: true })
      const menu = useFloatingLayer({ elements: () => [] })
      modal.activate()
      tooltip.activate()
      expect(modal.isTopmost.value).toBe(true)
      expect(tooltip.isTopmost.value).toBe(true)
      menu.activate()
      expect(modal.isTopmost.value).toBe(false)
      // z-index модалки не зсувається від плаваючих шарів над нею.
      expect(modal.zIndex.value).toBe(1000)
      menu.deactivate()
      expect(modal.isTopmost.value).toBe(true)
    })
    scope.stop()
  })
})

/* ------------------------------------------------------------------ */

describe('UiHoverCard', () => {
  const card = (state: { open: boolean }) =>
    h(UiHoverCard, { modelValue: state.open, 'onUpdate:modelValue': (v: boolean) => (state.open = v) }, {
      trigger: ({ triggerAttrs }: any) => h('a', { ...triggerAttrs, href: '#profile', id: 'profile' }, 'Ігор'),
      default: () => h('a', { href: '#follow', id: 'follow' }, 'Підписатися'),
    })

  it('курсор пройшов повз до кінця затримки — картка не відкривається', async () => {
    vi.useFakeTimers()
    const state = reactive({ open: false })
    await mount(() => card(state))
    const trigger = document.getElementById('profile')!
    trigger.dispatchEvent(new MouseEvent('mouseenter'))
    vi.advanceTimersByTime(300)
    trigger.dispatchEvent(new MouseEvent('mouseleave'))
    vi.advanceTimersByTime(5000)
    await flush()
    expect(state.open).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('закрита картка не рахує розкладку на скрол', async () => {
    const state = reactive({ open: false })
    await mount(() => card(state))
    const trigger = document.getElementById('profile')!
    trigger.dispatchEvent(new FocusEvent('focus'))
    trigger.dispatchEvent(new FocusEvent('blur'))
    const measure = vi.spyOn(trigger, 'getBoundingClientRect')
    window.dispatchEvent(new Event('scroll'))
    window.dispatchEvent(new Event('resize'))
    expect(measure).not.toHaveBeenCalled()
  })

  it('Tab із тригера веде в картку, Tab з її останнього посилання — далі сторінкою', async () => {
    vi.useFakeTimers()
    const state = reactive({ open: false })
    await mount(() => [card(state), h('button', { id: 'after' }, 'Далі')])
    const trigger = document.getElementById('profile')!
    trigger.focus()
    await vi.advanceTimersByTimeAsync(400)
    await flush()
    expect(state.open).toBe(true)

    tab(trigger)
    expect(document.activeElement?.id).toBe('follow')

    tab(document.activeElement!)
    await flush()
    expect(document.activeElement?.id).toBe('after')
    expect(state.open).toBe(false)
  })
})

/* ------------------------------------------------------------------ */

describe('UiDrawer', () => {
  it('свайп, на який батько відповів «ні», повертає панель на місце', async () => {
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(400)
    let asked = 0
    await mount(() =>
      h(UiDrawer, {
        modelValue: true,
        position: 'bottom',
        title: 'Форма',
        // Керований v-model: батько питає «Відкинути зміни?» і не закриває.
        'onUpdate:modelValue': (v: boolean) => { if (!v) asked += 1 },
      }, { default: () => h('input') }),
    )
    await flush()
    const handle = document.querySelector<HTMLElement>('.cursor-grab')!
    handle.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, clientY: 100, button: 0, pointerType: 'touch' }))
    window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientY: 300 }))
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, clientY: 300 }))
    await flush()
    expect(asked).toBe(1)
    expect(document.querySelector<HTMLElement>('[role="dialog"]')!.style.transform).toBe('')
  })

  it('ім’я панелі — з ariaLabel або за краєм, а не «Бічна панель» для нижньої', async () => {
    await mount(() => h(UiDrawer, { modelValue: true, position: 'bottom', closable: false }, { default: () => 'Вміст' }))
    await flush()
    expect(document.querySelector('[role="dialog"]')!.getAttribute('aria-label')).toBe('Нижня панель')
    for (const instance of mounted) instance.unmount()
    mounted = []

    await mount(() =>
      h(UiDrawer, { modelValue: true, ariaLabel: 'Фільтри' }, {
        header: () => h('input', { value: 'запит' }),
        default: () => 'Вміст',
      }),
    )
    await flush()
    const dialog = document.querySelector('[role="dialog"]')!
    expect(dialog.getAttribute('aria-label')).toBe('Фільтри')
    expect(dialog.hasAttribute('aria-labelledby')).toBe(false)
  })
})

/* ------------------------------------------------------------------ */

describe('UiMenu', () => {
  const items = ['Перейменувати', 'Дублювати', 'Експортувати', 'Видалити']
  const menu = (props: Record<string, unknown> = {}) =>
    h(UiMenu, props, {
      trigger: ({ toggle, triggerAttrs }: any) =>
        h('button', { ...triggerAttrs, id: 'menu-trigger', onClick: toggle }, 'Дії'),
      content: () => items.map((label) => h('button', { role: 'menuitem', key: label }, label)),
    })

  function stubRects(trigger: { top: number; bottom: number; left: number; right: number }, panel: { width: number; height: number; content?: number }) {
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(panel.width)
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(panel.height)
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(panel.height)
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(panel.content ?? panel.height)
    const rect = { ...trigger, width: trigger.right - trigger.left, height: trigger.bottom - trigger.top, x: trigger.left, y: trigger.top, toJSON() {} }
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(rect as DOMRect)
  }

  async function openAt(placement: string) {
    await mount(() => menu({ placement }))
    document.getElementById('menu-trigger')!.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }))
    await flush()
    return document.querySelector<HTMLElement>('[role="menu"]')!
  }

  it('top біля верхнього краю перевертається вниз, а не лягає на тригер', async () => {
    stubRects({ top: 20, bottom: 52, left: 100, right: 180 }, { width: 200, height: 200 })
    const panel = await openAt('top')
    expect(panel.style.top).toBe('58px')
  })

  it('right біля правого краю перевертається ліворуч і лишає верхні краї рівними', async () => {
    stubRects({ top: 300, bottom: 332, left: 900, right: 1000 }, { width: 200, height: 200 })
    const panel = await openAt('right')
    expect(panel.style.left).toBe('694px')
    expect(panel.style.top).toBe('300px')
  })

  it('меню вище за вікно отримує max-height і прокрутку', async () => {
    stubRects({ top: 300, bottom: 332, left: 900, right: 1000 }, { width: 200, height: 200, content: 1000 })
    const panel = await openAt('bottom-end')
    expect(panel.style.maxHeight).toBe('422px')
    expect(panel.style.overflowY).toBe('auto')
    expect(panel.style.top).toBe('338px')
  })

  it('Enter на тригері ставить фокус на перший пункт, клік мишею — ні', async () => {
    await mount(() => menu())
    const trigger = document.getElementById('menu-trigger')!
    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }))
    await flush()
    expect(document.activeElement?.getAttribute('role')).not.toBe('menuitem')

    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }))
    await flush()
    // click із detail 0 — саме те, що браузер шле на Enter і Space.
    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }))
    await flush()
    expect(document.activeElement?.textContent).toBe('Перейменувати')
  })

  it('typeahead переводить фокус на пункт за першою літерою', async () => {
    vi.useFakeTimers()
    await mount(() => menu())
    document.getElementById('menu-trigger')!.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }))
    await flush()
    const press = (key: string) =>
      document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
    press('е')
    expect(document.activeElement?.textContent).toBe('Експортувати')
    vi.advanceTimersByTime(600)
    press('в')
    expect(document.activeElement?.textContent).toBe('Видалити')
  })

  it('Tab у меню закриває його й веде до елемента після тригера', async () => {
    await mount(() => [menu(), h('button', { id: 'after' }, 'Далі')])
    const trigger = document.getElementById('menu-trigger')!
    trigger.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }))
    await flush()
    tab(document.activeElement!)
    await flush()
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement?.id).toBe('after')
  })

  it('у складеній панелі (dialog) Tab ходить контролами, а не закриває її', async () => {
    await mount(() =>
      h(UiMenu, { panelRole: 'dialog', ariaLabel: 'Налаштування' }, {
        trigger: ({ toggle, triggerAttrs }: any) =>
          h('button', { ...triggerAttrs, id: 'menu-trigger', onClick: toggle }, 'Колонки'),
        content: () => [h('button', { id: 'first' }, 'Щільно'), h('button', { id: 'second' }, 'Звичайно')],
      }),
    )
    const trigger = document.getElementById('menu-trigger')!
    trigger.click()
    await flush()
    document.getElementById('first')!.focus()
    tab(document.getElementById('first')!)
    await flush()
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
  })
})

/* ------------------------------------------------------------------ */

describe('UiSplitButton — клавіатура через UiButton і UiMenu', () => {
  const items = [
    { id: 'draft', label: 'Зберегти як чернетку' },
    { id: 'template', label: 'Зберегти як шаблон' },
  ]

  it('Enter на каретці й ArrowDown на головній кнопці ставлять фокус на перший пункт', async () => {
    await mount(() => h(UiSplitButton, { label: 'Зберегти', items }))
    const caret = document.querySelector<HTMLElement>('[aria-label="Інші дії"]')!
    caret.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }))
    await flush()
    expect(document.activeElement?.getAttribute('role')).toBe('menuitem')
    expect(document.activeElement?.textContent).toContain('Зберегти як чернетку')

    escape()
    await flush()
    const primary = [...document.querySelectorAll<HTMLElement>('button')].find((node) =>
      node.textContent?.trim() === 'Зберегти',
    )!
    primary.focus()
    primary.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }))
    await flush()
    expect(document.activeElement?.getAttribute('role')).toBe('menuitem')
    expect(document.activeElement?.textContent).toContain('Зберегти як чернетку')
  })
})

/* ------------------------------------------------------------------ */

describe('UiPopover — клавіатура', () => {
  it('відкриття з клавіатури веде фокус у панель, Tab з останнього — далі сторінкою', async () => {
    const state = reactive({ open: false })
    await mount(() => [
      h(UiPopover, { modelValue: state.open, 'onUpdate:modelValue': (v: boolean) => (state.open = v) }, {
        trigger: ({ triggerAttrs }: any) => h('button', { ...triggerAttrs, id: 'popover-trigger' }, 'Налаштування'),
        default: () => [h('button', { id: 'first' }, 'Перший'), h('button', { id: 'last' }, 'Готово')],
      }),
      h('button', { id: 'after' }, 'Далі'),
    ])
    document.getElementById('popover-trigger')!.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }))
    await flush()
    expect(document.activeElement?.id).toBe('first')

    document.getElementById('last')!.focus()
    tab(document.getElementById('last')!)
    await flush()
    expect(state.open).toBe(false)
    expect(document.activeElement?.id).toBe('after')
  })
})

/* ------------------------------------------------------------------ */

describe('UiTooltip', () => {
  const tooltip = () =>
    h(UiTooltip, { content: 'Видалити назавжди', delay: 200, closeDelay: 100 }, {
      default: ({ describedBy }: any) => h('button', { id: 'hint', 'aria-describedby': describedBy }, 'Видалити'),
    })

  it('фокус із клавіатури показує одразу, з aria-describedby', async () => {
    vi.useFakeTimers()
    await mount(tooltip)
    const button = document.getElementById('hint')!
    button.focus()
    // Жодного просування таймерів: затримка наведення до фокуса не застосовується.
    await nextTick()
    const panel = document.querySelector<HTMLElement>('[role="tooltip"]')!
    expect(panel).not.toBeNull()
    expect(button.getAttribute('aria-describedby')).toBe(panel.id)
  })

  it('курсор можна перевести на саму підказку', async () => {
    vi.useFakeTimers()
    await mount(tooltip)
    const wrapper = document.getElementById('hint')!.parentElement!
    wrapper.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }))
    await vi.advanceTimersByTimeAsync(200)
    const panel = document.querySelector<HTMLElement>('[role="tooltip"]')!
    wrapper.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }))
    vi.advanceTimersByTime(50)
    panel.dispatchEvent(new MouseEvent('mouseenter'))
    vi.advanceTimersByTime(500)
    await flush()
    expect(document.getElementById('hint')!.getAttribute('aria-describedby')).toBe(panel.id)

    panel.dispatchEvent(new MouseEvent('mouseleave'))
    vi.advanceTimersByTime(100)
    await flush()
    expect(document.getElementById('hint')!.getAttribute('aria-describedby')).toBeNull()
  })

  it('натискання на тригер ховає підказку', async () => {
    await mount(tooltip)
    const button = document.getElementById('hint')!
    button.focus()
    await nextTick()
    expect(button.getAttribute('aria-describedby')).not.toBeNull()
    pointerDown(button)
    await nextTick()
    expect(button.getAttribute('aria-describedby')).toBeNull()
  })
})

/* ------------------------------------------------------------------ */

describe('UiCommandPalette', () => {
  const groups = [
    {
      id: 'actions',
      label: 'Дії',
      items: Array.from({ length: 20 }, (_, index) => ({ id: `item-${index}`, label: `Команда ${index}` })),
    },
  ]

  it('стрілки прокручують підсвічений рядок у видиму область', async () => {
    const scrolled: string[] = []
    vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(function (this: HTMLElement) {
      scrolled.push(this.id)
    })
    await mount(() => h(UiCommandPalette, { modelValue: true, hotkey: false, groups }))
    await flush()
    const input = document.querySelector<HTMLInputElement>('[role="combobox"]')!
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }))
    await flush()
    expect(scrolled.at(-1)).toBe(input.getAttribute('aria-activedescendant'))
    expect(input.getAttribute('aria-activedescendant')).toMatch(/option-19$/)
  })

  it('Ctrl+K працює на кирилиці та Dvorak, а не лише на QWERTY', async () => {
    const opened: boolean[] = []
    const state = reactive({ open: false })
    await mount(() =>
      h(UiCommandPalette, {
        modelValue: state.open,
        groups,
        'onUpdate:modelValue': (v: boolean) => { opened.push(v); state.open = v },
      }),
    )
    const press = (init: KeyboardEventInit) => {
      state.open = false
      document.body.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }))
    }
    press({ key: 'л', code: 'KeyK', ctrlKey: true })
    press({ key: 'k', code: 'KeyV', metaKey: true })
    press({ key: 'v', code: 'KeyK', ctrlKey: true })
    expect(opened).toEqual([true, true])
  })

  it('скидання запиту при повторному відкритті повідомляє search', async () => {
    const searches: string[] = []
    const state = reactive({ open: true })
    await mount(() =>
      h(UiCommandPalette, {
        modelValue: state.open,
        hotkey: false,
        groups,
        'onUpdate:modelValue': (v: boolean) => (state.open = v),
        onSearch: (query: string) => searches.push(query),
      }),
    )
    await flush()
    const input = document.querySelector<HTMLInputElement>('[role="combobox"]')!
    input.value = 'команда 1'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    state.open = false
    await flush()
    state.open = true
    await flush()
    expect(searches).toEqual(['команда 1', ''])
  })
})

/* ------------------------------------------------------------------ */

describe('SSR-захист singleton-станів', () => {
  it('на сервері toast нічого не додає, а confirm/prompt одразу відповідають «скасовано»', async () => {
    const toast = useToast()
    const { confirm, prompt, _state } = useConfirm()
    vi.stubGlobal('document', undefined)
    const id = toast.show({ message: 'Не вдалося завантажити рахунок' })
    const confirmed = confirm('Видалити?')
    const entered = prompt({ title: 'Назва', input: {} })
    vi.unstubAllGlobals()
    expect(id).toBe(-1)
    expect(toast.toasts.value).toEqual([])
    expect(_state.isOpen.value).toBe(false)
    await expect(confirmed).resolves.toBe(false)
    await expect(entered).resolves.toBeNull()
  })
})

/* ------------------------------------------------------------------ */

describe('UiToaster і useToast', () => {
  const regionOf = () => document.querySelector<HTMLElement>('[aria-label="Сповіщення"]')!

  it('live-регіони існують до першого тосту й отримують текст', async () => {
    await mount(() => h(UiToaster))
    await flush()
    const polite = regionOf().querySelector('[aria-live="polite"]')!
    const assertive = regionOf().querySelector('[aria-live="assertive"]')!
    expect(polite.textContent).toBe('')
    const toast = useToast()
    toast.info('Збережено', { title: 'Готово', duration: 0 })
    toast.error('Мережа недоступна', { duration: 0 })
    await flush()
    expect(polite.textContent).toContain('Готово. Збережено')
    expect(assertive.textContent).toContain('Мережа недоступна')
    expect(document.querySelector('.ui-toast-card')!.hasAttribute('aria-live')).toBe(false)
  })

  it('тост із дією живе щонайменше 10 с, явна тривалість — як задано', () => {
    const toast = useToast()
    const action = [{ label: 'Скасувати', onClick: () => undefined }]
    toast.info('Видалено', { actions: action })
    toast.error('Не вдалося', { actions: action })
    toast.info('Видалено', { actions: action, duration: 4000 })
    toast.info('Без дій')
    expect(toast.toasts.value.map((item) => item.duration)).toEqual([10_000, 10_000, 4000, 3000])
  })

  it('F8 веде в область сповіщень навіть під модалкою, Escape повертає без закриття модалки', async () => {
    const state = reactive({ open: true })
    await mount(() => [
      h(UiToaster),
      h(UiModal, { modelValue: state.open, title: 'Форма', 'onUpdate:modelValue': (v: boolean) => (state.open = v) }, {
        default: () => h('button', { id: 'in-modal' }, 'Поле'),
      }),
    ])
    await flush()
    const inModal = document.getElementById('in-modal')!
    inModal.focus()
    useToast().info('Скопійовано', { duration: 0, actions: [{ label: 'Скасувати', onClick: () => undefined }] })
    await flush()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'F8', bubbles: true, cancelable: true }))
    expect(document.activeElement).toBe(regionOf())

    escape(regionOf())
    await flush()
    expect(document.activeElement).toBe(inModal)
    expect(state.open).toBe(true)
  })

  it('update міняє тост на місці й перезапускає відлік', () => {
    vi.useFakeTimers()
    const toast = useToast()
    const id = toast.loading('Завантаження…')
    vi.advanceTimersByTime(60_000)
    expect(toast.toasts.value).toHaveLength(1)
    toast.update(id, { type: 'success', message: 'Завантажено' })
    expect(toast.toasts.value[0]).toMatchObject({ id, type: 'success', message: 'Завантажено', duration: 3000 })
    vi.advanceTimersByTime(3000)
    expect(toast.toasts.value).toHaveLength(0)
    // Закритий тост не воскресає.
    toast.update(id, { message: 'Пізно' })
    expect(toast.toasts.value).toHaveLength(0)
  })

  it('promise показує loading і переходить у success чи error тієї ж картки', async () => {
    const toast = useToast()
    const ok = Promise.resolve(42)
    expect(toast.promise(ok, { loading: 'Зберігаю…', success: (value) => `Збережено ${value}`, error: 'Збій' })).toBe(ok)
    const [pending] = toast.toasts.value
    expect(pending).toMatchObject({ type: 'loading', message: 'Зберігаю…', duration: 0 })
    await ok
    await Promise.resolve()
    expect(toast.toasts.value[0]).toMatchObject({ id: pending!.id, type: 'success', message: 'Збережено 42' })

    const failed = Promise.reject(new Error('timeout'))
    toast.promise(failed, { loading: 'Надсилаю…', success: 'Надіслано', error: (reason) => `Збій: ${(reason as Error).message}` })
    await failed.catch(() => undefined)
    await Promise.resolve()
    expect(toast.toasts.value.at(-1)).toMatchObject({ type: 'error', message: 'Збій: timeout' })
  })
})

/* ------------------------------------------------------------------ */

describe('UiConfirmDialog — ARIA', () => {
  it('confirm — alertdialog з описом, prompt — звичайний dialog', async () => {
    await mount(() => h(UiConfirmDialog))
    const api = useConfirm()
    void api.confirm({ title: 'Видалити проєкт?', message: 'Дію не можна скасувати.', danger: true })
    await flush()
    const panel = document.querySelector<HTMLElement>('[role="alertdialog"]')!
    expect(panel.getAttribute('aria-modal')).toBe('true')
    const description = document.getElementById(panel.getAttribute('aria-describedby')!)
    expect(description?.textContent).toBe('Дію не можна скасувати.')
    api._cancel()
    await flush()

    void api.prompt({ title: 'Нова назва', input: { label: 'Назва' } })
    await flush()
    expect(document.querySelector('[role="alertdialog"]')).toBeNull()
    expect(document.querySelector('[role="dialog"]')).not.toBeNull()
    api._cancel()
    await flush()
  })
})

/* ------------------------------------------------------------------ */

describe('UiContextMenu — довге натискання', () => {
  const contextMenu = (state: { open: boolean }, onItem = () => undefined) =>
    h(UiContextMenu, { modelValue: state.open, 'onUpdate:modelValue': (v: boolean) => (state.open = v) }, {
      default: ({ targetAttrs }: any) => h('div', { ...targetAttrs, id: 'area', tabindex: 0 }, 'Файл'),
      content: () => h('button', { role: 'menuitem', id: 'rename', onClick: onItem }, 'Перейменувати'),
    })

  it('палець, утриманий 600 мс, відкриває меню в точці дотику', async () => {
    vi.useFakeTimers()
    const state = reactive({ open: false })
    const onItem = vi.fn()
    await mount(() => contextMenu(state, onItem))
    const area = document.getElementById('area')!
    pointerDown(area, { pointerType: 'touch', pointerId: 7, clientX: 100, clientY: 120 })
    vi.advanceTimersByTime(600)
    await flush()
    expect(state.open).toBe(true)
    const menu = document.querySelector<HTMLElement>('[role="menu"]')!
    expect(menu.style.left).toBe('100px')
    expect(menu.style.top).toBe('120px')

    // Відпускання пальця може догнатися click'ом по першому пункту під ним.
    area.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'touch', pointerId: 7 }))
    document.getElementById('rename')!.click()
    expect(onItem).not.toHaveBeenCalled()
    vi.advanceTimersByTime(400)
    document.getElementById('rename')!.click()
    expect(onItem).toHaveBeenCalledTimes(1)
  })

  it('рух пальця (прокрутка) і миша довге натискання не запускають', async () => {
    vi.useFakeTimers()
    const state = reactive({ open: false })
    await mount(() => contextMenu(state))
    const area = document.getElementById('area')!
    pointerDown(area, { pointerType: 'touch', pointerId: 3, clientX: 100, clientY: 100 })
    area.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerType: 'touch', pointerId: 3, clientX: 100, clientY: 130 }))
    pointerDown(area, { pointerType: 'mouse', pointerId: 4, clientX: 100, clientY: 100 })
    vi.advanceTimersByTime(2000)
    await flush()
    expect(state.open).toBe(false)
  })
})

/* ------------------------------------------------------------------ */

describe('токени руху', () => {
  const files = [
    'UiPopover',
    'UiTooltip',
    'UiHoverCard',
    'UiMenu',
    'UiContextMenu',
    'UiModal',
    'UiDrawer',
    'UiCommandPalette',
    'UiToaster',
  ]

  it.each(files)('%s не має сирих тривалостей переходів', (name) => {
    const source = readFileSync(join(__dirname, '../app/components/ui', `${name}.vue`), 'utf8')
    // Класи Tailwind на кшталт duration-150 і CSS-літерали 200ms — усе, крім
    // службового 1ms у блоці reduced-motion.
    expect(source).not.toMatch(/\bduration-\d/)
    expect(source.replace(/transition-duration:\s*1ms/g, '')).not.toMatch(/\b\d+ms\b/)
  })
})
