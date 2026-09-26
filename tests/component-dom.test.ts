import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { createSSRApp, h, nextTick } from 'vue'
import { renderToString } from '@vue/server-renderer'
import UiAccordion from '~/components/ui/UiAccordion.vue'
import UiButton from '~/components/ui/UiButton.vue'
import UiCombobox from '~/components/ui/UiCombobox.vue'
import UiCopyButton from '~/components/ui/UiCopyButton.vue'
import UiDrawer from '~/components/ui/UiDrawer.vue'
import UiFileUpload from '~/components/ui/UiFileUpload.vue'
import UiMenu from '~/components/ui/UiMenu.vue'
import UiModal from '~/components/ui/UiModal.vue'
import UiMultiSelect from '~/components/ui/UiMultiSelect.vue'
import UiPagination from '~/components/ui/UiPagination.vue'
import UiProgress from '~/components/ui/UiProgress.vue'
import UiSelect from '~/components/ui/UiSelect.vue'
import UiToaster from '~/components/ui/UiToaster.vue'
import UiTooltip from '~/components/ui/UiTooltip.vue'
import { useToast } from '~/composables/useToast'
import { mountComponent } from './helpers/mountComponent'

beforeAll(() => {
  HTMLElement.prototype.scrollIntoView ??= () => undefined
})

afterEach(() => {
  const toast = useToast()
  for (const item of [...toast.toasts.value]) toast.dismiss(item.id)
  document.body.innerHTML = ''
  vi.useRealTimers()
})

describe('базові DOM та ARIA контракти', () => {
  it('Pagination нормалізує межі та показує номери від sm', async () => {
    const mounted = await mountComponent(UiPagination, {
      page: 99,
      totalPages: 5.8,
      totalItems: 42,
      pageSize: 10,
    })

    expect(mounted.host.textContent).toContain('41–42 з 42')
    const current = mounted.host.querySelector('[aria-current="page"]')
    expect(current?.textContent?.trim()).toBe('5')
    expect(current?.className).toContain('sm:flex')
    expect(mounted.host.querySelector<HTMLButtonElement>('[aria-label="Наступна сторінка"]')?.disabled).toBe(true)
    mounted.unmount()
  })

  it('Accordion пропускає disabled заголовки й ховає collapsed panel', async () => {
    const mounted = await mountComponent(UiAccordion, {
      items: [
        { id: 'a', label: 'Перший' },
        { id: 'b', label: 'Disabled', disabled: true },
        { id: 'c', label: 'Останній' },
      ],
    })
    const buttons = [...mounted.host.querySelectorAll<HTMLButtonElement>('h3 button')]
    buttons[0]!.focus()
    buttons[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }))
    await nextTick()
    expect(document.activeElement).toBe(buttons[2])

    const collapsed = mounted.host.querySelector<HTMLElement>('[role="region"]')!
    expect(collapsed.getAttribute('aria-hidden')).toBe('true')
    expect(collapsed.hasAttribute('inert')).toBe(true)
    mounted.unmount()
  })

  it('Progress зберігає фактичне aria-valuenow і захищає invalid max', async () => {
    const mounted = await mountComponent(UiProgress, { modelValue: 50, max: 200 })
    const bar = mounted.host.querySelector<HTMLElement>('[role="progressbar"]')!
    expect(bar.getAttribute('aria-valuenow')).toBe('50')
    expect(bar.getAttribute('aria-valuemax')).toBe('200')
    expect(bar.firstElementChild?.getAttribute('style')).toContain('25%')

    await mounted.update({ modelValue: 500, max: 0 })
    expect(bar.getAttribute('aria-valuenow')).toBe('100')
    expect(bar.getAttribute('aria-valuemax')).toBe('100')
    expect(bar.firstElementChild?.getAttribute('style')).toContain('100%')
    mounted.unmount()
  })

  it('FileUpload прибирає disabled з tab order і озвучує progress', async () => {
    const mounted = await mountComponent(UiFileUpload, { disabled: true, progress: 140 })
    const zone = mounted.host.querySelector<HTMLElement>('[role="button"]')!
    const progress = mounted.host.querySelector<HTMLElement>('[role="progressbar"]')!
    expect(zone.tabIndex).toBe(-1)
    expect(progress.getAttribute('aria-valuenow')).toBe('100')
    mounted.unmount()
  })

  it('Select починає з першої enabled option і серіалізує modelValue', async () => {
    const selections: unknown[] = []
    const mounted = await mountComponent(UiSelect, {
      modelValue: null,
      name: 'city',
      filterable: false,
      options: [
        { value: 'blocked', label: 'Недоступне', disabled: true },
        { value: 'kyiv', label: 'Київ' },
      ],
      'onUpdate:modelValue': (value: unknown) => selections.push(value),
    })
    const input = mounted.host.querySelector<HTMLInputElement>('[role="combobox"]')!
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    await nextTick()
    await nextTick()
    expect(input.getAttribute('aria-activedescendant')).toMatch(/option-1$/)
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    expect(selections).toEqual(['kyiv'])
    expect(mounted.host.querySelector<HTMLInputElement>('input[type="hidden"]')?.name).toBe('city')
    mounted.unmount()
  })

  it('Combobox синхронізує async options та пропускає disabled option', async () => {
    const selections: unknown[] = []
    const mounted = await mountComponent(UiCombobox, {
      modelValue: null,
      name: 'assignee',
      options: [{ value: 'blocked', label: 'Недоступне', disabled: true }],
      'onUpdate:modelValue': (value: unknown) => selections.push(value),
    })
    const input = mounted.host.querySelector<HTMLInputElement>('[role="combobox"]')!
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    await nextTick()
    await mounted.update({
      options: [
        { value: 'blocked', label: 'Недоступне', disabled: true },
        { value: 'available', label: 'Доступне' },
      ],
    })
    expect(input.getAttribute('aria-activedescendant')).toMatch(/option-1$/)
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    expect(selections).toEqual(['available'])
    expect(mounted.host.querySelector<HTMLInputElement>('input[type="hidden"]')?.name).toBe('assignee')
    mounted.unmount()
  })

  it('MultiSelect серіалізує повторювані inputs, а toolbar не входить у listbox', async () => {
    const mounted = await mountComponent(UiMultiSelect, {
      modelValue: ['a', 'b'],
      name: 'tags',
      options: [
        { value: 'a', label: 'Alpha' },
        { value: 'b', label: 'Beta' },
      ],
    })
    const fields = [...mounted.host.querySelectorAll<HTMLInputElement>('input[type="hidden"]')]
    expect(fields.map(({ name, value }) => [name, value])).toEqual([
      ['tags', 'a'],
      ['tags', 'b'],
    ])

    mounted.host.querySelector<HTMLButtonElement>('[role="combobox"]')!.click()
    await nextTick()
    await nextTick()
    const listbox = document.body.querySelector('[role="listbox"]')!
    expect(listbox.querySelectorAll('[role="option"]')).toHaveLength(2)
    expect(listbox.textContent).not.toContain('Очистити')
    mounted.unmount()
  })

  it('MultiSelect працює з клавіатури без search поля', async () => {
    const selections: unknown[] = []
    const mounted = await mountComponent(UiMultiSelect, {
      modelValue: [],
      searchable: false,
      options: [
        { value: 'blocked', label: 'Недоступне', disabled: true },
        { value: 'enabled', label: 'Доступне' },
      ],
      'onUpdate:modelValue': (value: unknown) => selections.push(value),
    })
    const trigger = mounted.host.querySelector<HTMLButtonElement>('[role="combobox"]')!
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    await nextTick()
    await nextTick()
    expect(trigger.getAttribute('aria-activedescendant')).toMatch(/option-1$/)
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    expect(selections).toEqual([['enabled']])
    mounted.unmount()
  })

  it('disabled/loading NuxtLink не навігує і виходить із tab order', async () => {
    const clicks: MouseEvent[] = []
    const mounted = await mountComponent(
      UiButton,
      { to: '/roadmap', disabled: true, onClick: (event: MouseEvent) => clicks.push(event) },
      { default: () => 'Roadmap' },
    )
    const link = mounted.host.querySelector<HTMLAnchorElement>('a')!
    const event = new MouseEvent('click', { bubbles: true, cancelable: true })
    link.dispatchEvent(event)
    expect(link.tabIndex).toBe(-1)
    expect(link.getAttribute('aria-disabled')).toBe('true')
    expect(event.defaultPrevented).toBe(true)
    expect(clicks).toHaveLength(0)
    mounted.unmount()
  })

  it('Modal і Drawer отримують accessible name із custom header', async () => {
    for (const component of [UiModal, UiDrawer]) {
      const mounted = await mountComponent(
        component,
        { modelValue: true },
        { header: () => h('strong', 'Користувацький заголовок'), default: () => 'Вміст' },
      )
      await nextTick()
      const dialog = document.body.querySelector<HTMLElement>('[role="dialog"]')!
      const labelId = dialog.getAttribute('aria-labelledby')!
      expect(labelId).toBeTruthy()
      expect(document.getElementById(labelId)?.textContent?.trim()).toBe('Користувацький заголовок')
      mounted.unmount()
    }
  })

  it('Tooltip не залишає подвійний timer і передає describedBy trigger', async () => {
    vi.useFakeTimers()
    const mounted = await mountComponent(
      UiTooltip,
      { content: 'Пояснення', delay: 100 },
      {
        default: ({ describedBy }: any) =>
          h('button', { type: 'button', 'aria-describedby': describedBy }, 'Тригер'),
      },
    )
    const wrapper = mounted.host.querySelector<HTMLElement>('span')!
    wrapper.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }))
    wrapper.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    expect(vi.getTimerCount()).toBe(1)
    wrapper.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }))
    vi.advanceTimersByTime(100)
    expect(document.body.querySelector('[role="tooltip"]')).toBeNull()

    wrapper.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }))
    await vi.advanceTimersByTimeAsync(100)
    await nextTick()
    const tooltip = document.body.querySelector<HTMLElement>('[role="tooltip"]')!
    expect(mounted.host.querySelector('button')?.getAttribute('aria-describedby')).toBe(tooltip.id)
    wrapper.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' }))
    await nextTick()
    vi.runAllTimers()
    mounted.unmount()
    vi.runAllTimers()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('CopyButton дає live feedback та очищає timer при unmount', async () => {
    vi.useFakeTimers()
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
    const mounted = await mountComponent(UiCopyButton, { text: 'tatet', label: 'Копіювати' })
    mounted.host.querySelector<HTMLButtonElement>('button')!.click()
    await Promise.resolve()
    await nextTick()
    expect(mounted.host.querySelector('[role="status"]')?.textContent).toContain('Скопійовано')
    expect(vi.getTimerCount()).toBe(1)
    mounted.unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('Menu передає ARIA реальному trigger і фокусує перший menuitem', async () => {
    const mounted = await mountComponent(
      UiMenu,
      {},
      {
        trigger: ({ toggle, triggerAttrs }: any) =>
          h('button', { ...triggerAttrs, type: 'button', onClick: toggle }, 'Меню'),
        content: () => [
          h('button', { type: 'button', role: 'menuitem' }, 'Перший'),
          h('button', { type: 'button', role: 'menuitem' }, 'Другий'),
        ],
      },
    )
    const trigger = mounted.host.querySelector<HTMLButtonElement>('button')!
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu')
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    await nextTick()
    await nextTick()
    const items = [...document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')]
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    await vi.waitFor(() => expect(document.activeElement).toBe(items[0]))
    items[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }))
    expect(document.activeElement).toBe(items[1])
    mounted.unmount()
  })
})

describe('SSR-safe Toaster і таймери', () => {
  it('гідратується без warning та залишає одну область сповіщень', async () => {
    const server = createSSRApp(UiToaster)
    const html = await renderToString(server)
    const host = document.createElement('div')
    host.innerHTML = html
    document.body.append(host)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const client = createSSRApp(UiToaster)
    client.mount(host)
    await nextTick()
    await nextTick()

    expect(document.body.querySelectorAll('[aria-label="Сповіщення"]')).toHaveLength(1)
    expect(warn).not.toHaveBeenCalled()
    expect(error).not.toHaveBeenCalled()
    client.unmount()
    host.remove()
  })

  it('dismiss одразу чистить toast і його таймер', () => {
    vi.useFakeTimers()
    const toast = useToast()
    const id = toast.show({ message: 'Тест', duration: 5000 })
    expect(vi.getTimerCount()).toBe(1)
    toast.dismiss(id)
    expect(toast.toasts.value).toHaveLength(0)
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each([
    ['Modal', UiModal],
    ['Drawer', UiDrawer],
  ])('%s має однаковий server/initial-client render', async (_name, component) => {
    const root = {
      render: () => h(component, { modelValue: true, closable: false }, { default: () => 'SSR content' }),
    }
    const html = await renderToString(createSSRApp(root))
    const host = document.createElement('div')
    host.innerHTML = html
    document.body.append(host)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const client = createSSRApp(root)
    client.mount(host)
    await nextTick()
    await nextTick()
    expect(document.body.querySelectorAll('[role="dialog"]')).toHaveLength(1)
    expect(warn).not.toHaveBeenCalled()
    expect(error).not.toHaveBeenCalled()
    client.unmount()
    host.remove()
  })
})
