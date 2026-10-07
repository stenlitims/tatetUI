import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { createSSRApp, h, nextTick } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { createMemoryHistory, createRouter } from 'vue-router'
import UiAccordion from '~/components/ui/UiAccordion.vue'
import UiBreadcrumb from '~/components/ui/UiBreadcrumb.vue'
import UiCarousel from '~/components/ui/UiCarousel.vue'
import UiNavigationMenu from '~/components/ui/UiNavigationMenu.vue'
import UiProse from '~/components/ui/UiProse.vue'
import UiResizablePanels from '~/components/ui/UiResizablePanels.vue'
import UiSidebar from '~/components/ui/UiSidebar.vue'
import UiStepper from '~/components/ui/UiStepper.vue'
import UiTabs from '~/components/ui/UiTabs.vue'
import UiToggleGroup from '~/components/ui/UiToggleGroup.vue'
import { mountComponent } from './helpers/mountComponent'

type Mounted = Awaited<ReturnType<typeof mountComponent>>

beforeAll(() => {
  HTMLElement.prototype.scrollIntoView ??= () => undefined
})

afterEach(() => {
  document.body.innerHTML = ''
  localStorage.clear()
  vi.unstubAllGlobals()
})

// Навігація vue-router завершується промісами — даємо їм відпрацювати.
const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: { render: () => null } }],
  })
}

const threeTabs = [
  { id: 'a', label: 'A' },
  { id: 'b', label: 'B' },
  { id: 'c', label: 'C' },
]

const selectedTab = (host: HTMLElement) =>
  host.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.trim()

describe('UiToggleGroup — зона дотику', () => {
  it('кожен сегмент — якір для своєї невидимої зони (relative)', async () => {
    /*
     * Регрес: без relative ::after позиціювався від найближчого
     * позиціонованого предка, і зони всіх сегментів злипались у його
     * центрі — тап по чужій кнопці там обирав останній варіант.
     */
    const mounted = await mountComponent(UiToggleGroup, {
      modelValue: 'a',
      options: [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B' },
      ],
    })
    const radios = [...mounted.host.querySelectorAll<HTMLElement>('[role="radio"]')]
    expect(radios).toHaveLength(2)
    for (const radio of radios) {
      expect(radio.className).toContain('pointer-coarse:after:absolute')
      expect(radio.classList.contains('relative')).toBe(true)
    }
    mounted.unmount()
  })
})

describe('UiTabs — один шлях зміни вкладки', () => {
  it('вкладка з URL доходить до v-model; «Назад/Вперед» дає change', async () => {
    const router = makeRouter()
    await router.push('/?tab=b')
    await router.isReady()
    const updates: string[] = []
    const changes: string[] = []
    const mounted = await mountComponent(
      UiTabs,
      {
        modelValue: 'a',
        queryParam: 'tab',
        tabs: threeTabs,
        'onUpdate:modelValue': (value: string) => updates.push(value),
        onChange: (value: string) => changes.push(value),
      },
      {},
      { plugins: [router] },
    )
    // Відновлення з URL — не дія користувача: лише v-model, без change.
    expect(selectedTab(mounted.host)).toBe('B')
    expect(updates).toEqual(['b'])
    expect(changes).toEqual([])
    await mounted.update({ modelValue: 'b' })

    await router.push('/?tab=c')
    await nextTick()
    expect(selectedTab(mounted.host)).toBe('C')
    expect(updates.at(-1)).toBe('c')
    expect(changes).toEqual(['c'])
    mounted.unmount()
  })

  it('зміна v-model згори пише URL, перша вкладка його очищає', async () => {
    const router = makeRouter()
    await router.push('/')
    await router.isReady()
    const updates: string[] = []
    const mounted = await mountComponent(
      UiTabs,
      { modelValue: 'a', queryParam: 'tab', tabs: threeTabs, 'onUpdate:modelValue': (value: string) => updates.push(value) },
      {},
      { plugins: [router] },
    )
    await mounted.update({ modelValue: 'c' })
    await settle()
    expect(selectedTab(mounted.host)).toBe('C')
    expect(router.currentRoute.value.query.tab).toBe('c')
    // Батько значення вже знає — повертати його подією нема чого.
    expect(updates).toEqual([])

    await mounted.update({ modelValue: 'a' })
    await settle()
    expect(router.currentRoute.value.query.tab).toBeUndefined()
    mounted.unmount()
  })

  it('невалідний v-model виправляється подією, а не лишається розсинхроном', async () => {
    const updates: string[] = []
    const mounted = await mountComponent(UiTabs, {
      modelValue: 'missing',
      tabs: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B', disabled: true },
      ],
      'onUpdate:modelValue': (value: string) => updates.push(value),
    })
    expect(updates).toEqual(['a'])
    await mounted.update({ modelValue: 'a' })
    await mounted.update({ modelValue: 'b' })
    expect(selectedTab(mounted.host)).toBe('A')
    expect(updates).toEqual(['a', 'a'])
    mounted.unmount()
  })

  it('без встановленого роутера не сипле попереджень про injection', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const mounted = await mountComponent(UiTabs, { queryParam: 'tab', tabs: threeTabs })
    mounted.host.querySelectorAll<HTMLButtonElement>('[role="tab"]')[1]!.click()
    await nextTick()
    expect(selectedTab(mounted.host)).toBe('B')
    expect(warn.mock.calls.some((call) => String(call[0]).includes('injection'))).toBe(false)
    mounted.unmount()
  })

  it('прередерена сторінка з ?tab= гідратується без розбіжностей', async () => {
    /*
     * Регрес: URL читався ще в setup. Прередер рендерив сторінку без
     * параметра, клієнт — з ним, і після гідрації перша вкладка лишалась
     * з активними класами поруч із новою.
     */
    const slots = { 'panel-a': () => 'Панель A', 'panel-b': () => 'Панель B' }
    const render = () => h(UiTabs, { queryParam: 'tab', tabs: threeTabs }, slots)

    const serverRouter = makeRouter()
    await serverRouter.push('/')
    await serverRouter.isReady()
    const server = createSSRApp({ render })
    server.use(serverRouter)
    const html = await renderToString(server)

    const host = document.createElement('div')
    host.innerHTML = html
    document.body.append(host)
    const clientRouter = makeRouter()
    await clientRouter.push('/?tab=b')
    await clientRouter.isReady()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const client = createSSRApp({ render })
    client.use(clientRouter)
    client.mount(host)
    await nextTick()
    await nextTick()

    const messages = [...warn.mock.calls, ...error.mock.calls].map((call) => String(call[0]))
    expect(messages.filter((message) => /hydration/i.test(message))).toEqual([])
    expect(selectedTab(host)).toBe('B')
    const first = host.querySelector<HTMLElement>('[role="tab"]')!
    expect(first.className).not.toContain('text-accent')
    expect(host.querySelector('[role="tabpanel"]')?.textContent).toContain('Панель B')
    client.unmount()
  })

  it('вертикальні вкладки перемикаються ↑/↓ і оголошують орієнтацію', async () => {
    const mounted = await mountComponent(UiTabs, { orientation: 'vertical', tabs: threeTabs })
    const tablist = mounted.host.querySelector<HTMLElement>('[role="tablist"]')!
    expect(tablist.getAttribute('aria-orientation')).toBe('vertical')
    const tabs = [...mounted.host.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
    tabs[0]!.focus()
    tabs[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    await nextTick()
    expect(selectedTab(mounted.host)).toBe('A')
    tabs[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))
    await nextTick()
    await nextTick()
    expect(selectedTab(mounted.host)).toBe('B')
    expect(document.activeElement).toBe(tabs[1])
    mounted.unmount()
  })

  it('панель досяжна з клавіатури навіть без фокусованого вмісту', async () => {
    const mounted = await mountComponent(UiTabs, { tabs: threeTabs }, { 'panel-a': () => 'Лише текст' })
    expect(mounted.host.querySelector<HTMLElement>('[role="tabpanel"]')!.tabIndex).toBe(0)
    mounted.unmount()
  })

  it('індикатор стежить за кожною кнопкою, а не лише за списком', async () => {
    /*
     * Регрес: в underline список — блочний flex на всю ширину, тож коли
     * вкладка ширшала (веб-шрифт, лічильник у слоті), observer списку
     * мовчав і індикатор лишався під старою шириною.
     */
    const observed: Element[] = []
    let notify: () => void = () => undefined
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          notify = callback
        }
        observe(element: Element) {
          observed.push(element)
        }
        unobserve() {}
        disconnect() {
          observed.length = 0
        }
      },
    )
    const mounted = await mountComponent(UiTabs, { tabs: threeTabs })
    const tabs = [...mounted.host.querySelectorAll<HTMLElement>('[role="tab"]')]
    for (const tab of tabs) expect(observed).toContain(tab)

    Object.defineProperty(tabs[0]!, 'offsetWidth', { configurable: true, value: 120 })
    notify()
    await nextTick()
    const indicator = mounted.host.querySelector<HTMLElement>('[role="tablist"] > span[aria-hidden="true"]')!
    expect(indicator.style.width).toBe('120px')
    mounted.unmount()
  })
})

describe('UiTabs — смуга, що гортається', () => {
  const nearest = { block: 'nearest', inline: 'nearest' }

  it('фокус з клавіатури докручує смугу до вкладки цілою, фокус від кліку — ні', async () => {
    const scrolled: unknown[] = []
    vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(function (this: HTMLElement, options) {
      scrolled.push([this.textContent?.trim(), options])
    })
    const mounted = await mountComponent(UiTabs, { tabs: threeTabs })
    const tabs = [...mounted.host.querySelectorAll<HTMLButtonElement>('[role="tab"]')]

    // Клік чи тап: вкладка без :focus-visible. Прокрутка зараз зсунула б
    // її з-під пальця.
    tabs[1]!.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    expect(scrolled).toEqual([])

    // Tab у список, далі стрілка: roving focus переводить фокус кодом, і
    // Chromium частково видиму вкладку сам не докручує.
    tabs[0]!.focus()
    tabs[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    await nextTick()
    await nextTick()
    expect(document.activeElement).toBe(tabs[1])
    expect(scrolled).toEqual([['A', nearest], ['B', nearest]])
    mounted.unmount()
  })

  it('поля смуги вміщують фокус-кільце крайньої вкладки', async () => {
    const mounted = await mountComponent(UiTabs, { tabs: threeTabs })
    const scroller = mounted.host.querySelector('[role="tablist"]')!.parentElement!
    // Без полів overflow різав кільце крайньої вкладки збоку, а в underline
    // на десктопі — ще й згори й знизу, навіть коли гортати нічого.
    expect(scroller.className.split(/\s+/)).toEqual(expect.arrayContaining(['-m-1', 'p-1', 'scroll-px-1']))
    mounted.unmount()
  })
})

describe('UiCarousel — клавіатура', () => {
  it('стрілки з поля вводу всередині слайда не гортають карусель', async () => {
    const updates: number[] = []
    const mounted = await mountComponent(
      UiCarousel,
      { items: [1, 2, 3], modelValue: 1, 'onUpdate:modelValue': (value: number) => updates.push(value) },
      { slide: ({ item }: { item: number }) => h('input', { 'aria-label': `Поле ${item}` }) },
    )
    const input = mounted.host.querySelector<HTMLInputElement>('input[aria-label="Поле 2"]')!
    const fromInput = new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true })
    input.dispatchEvent(fromInput)
    expect(fromInput.defaultPrevented).toBe(false)
    expect(updates).toEqual([])

    const carousel = mounted.host.querySelector<HTMLElement>('[aria-roledescription="carousel"]')!
    carousel.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }))
    expect(updates).toEqual([0])

    // Власні контроли каруселі клавіші обробляють і далі.
    const dot = mounted.host.querySelector<HTMLElement>('[aria-label="Перейти до слайда 1"]')!
    dot.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }))
    expect(updates.at(-1)).toBe(2)
    mounted.unmount()
  })

  it('стрілки ховаються за типом вказівника, а не за шириною', async () => {
    const mounted = await mountComponent(UiCarousel, { items: [1, 2] }, { slide: () => h('p', 'Слайд') })
    const arrow = mounted.host.querySelector<HTMLElement>('[aria-label="Наступний слайд"]')!
    expect(arrow.className).toContain('pointer-coarse:hidden')
    expect(arrow.classList.contains('hidden')).toBe(false)
    mounted.unmount()
  })
})

describe('UiAccordion', () => {
  const items = [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
  ]

  it('керований режим: відхилена зміна не відкриває секцію', async () => {
    const updates: string[][] = []
    const mounted = await mountComponent(UiAccordion, {
      modelValue: ['a'],
      items,
      'onUpdate:modelValue': (ids: string[]) => updates.push(ids),
    })
    const buttons = [...mounted.host.querySelectorAll<HTMLButtonElement>('h3 button')]
    buttons[1]!.click()
    await nextTick()
    expect(updates).toEqual([['a', 'b']])
    expect(buttons[1]!.getAttribute('aria-expanded')).toBe('false')
    mounted.unmount()
  })

  it('закриття згори повертає фокус із панелі на її заголовок', async () => {
    const mounted = await mountComponent(
      UiAccordion,
      { modelValue: ['a'], items },
      { 'content-a': () => h('a', { href: '#details' }, 'Детальніше') },
    )
    const link = mounted.host.querySelector<HTMLAnchorElement>('a')!
    link.focus()
    expect(document.activeElement).toBe(link)
    await mounted.update({ modelValue: [] })
    expect(document.activeElement).toBe(mounted.host.querySelector('h3 button'))
    mounted.unmount()
  })

  it('headingLevel задає рівень заголовків секцій', async () => {
    const mounted = await mountComponent(UiAccordion, { items, headingLevel: 4 })
    expect(mounted.host.querySelectorAll('h4 > button')).toHaveLength(2)
    expect(mounted.host.querySelector('h3')).toBeNull()
    mounted.unmount()
  })

  it('заголовок на дотику має щонайменше 44px', async () => {
    const mounted = await mountComponent(UiAccordion, { items })
    expect(mounted.host.querySelector('h3 button')!.className).toContain('pointer-coarse:min-h-[44px]')
    mounted.unmount()
  })
})

describe('UiStepper', () => {
  const steps = [
    { id: 'a', label: 'Сайт' },
    { id: 'b', label: 'Контент' },
    { id: 'c', label: 'Дизайн' },
    { id: 'd', label: 'Публікація' },
  ]

  it('кроки — список, пройдені озвучуються як завершені', async () => {
    const mounted = await mountComponent(UiStepper, { modelValue: 2, steps })
    const items = [...mounted.host.querySelectorAll('nav > ol > li')]
    expect(items).toHaveLength(4)
    expect(items[0]!.textContent).toContain('завершено')
    expect(items[1]!.textContent).toContain('завершено')
    expect(items[2]!.textContent).not.toContain('завершено')
    expect(items[2]!.querySelector('[aria-current="step"]')).not.toBeNull()
    mounted.unmount()
  })

  it('visited: повернення назад не стирає прогрес і не блокує пройдені кроки', async () => {
    let mounted: Mounted
    mounted = await mountComponent(UiStepper, {
      modelValue: 2,
      steps,
      clickMode: 'visited',
      'onUpdate:modelValue': (value: number) => {
        mounted.props.modelValue = value
      },
    })
    mounted.host.querySelectorAll<HTMLButtonElement>('button')[0]!.click()
    await nextTick()
    const buttons = [...mounted.host.querySelectorAll<HTMLButtonElement>('button')]
    expect(buttons.map((button) => button.disabled)).toEqual([false, false, false, true])
    // Другий крок пройдено до повернення — галочка лишається.
    expect(buttons[1]!.textContent).toContain('завершено')
    mounted.unmount()
  })

  it("clickMode='none' рендерить текст, а не вимкнені напівпрозорі кнопки", async () => {
    const mounted = await mountComponent(UiStepper, { modelValue: 1, steps, clickMode: 'none' })
    expect(mounted.host.querySelectorAll('button')).toHaveLength(0)
    expect(mounted.host.querySelector('.opacity-50')).toBeNull()
    expect(mounted.host.querySelector('[aria-current="step"]')?.textContent).toContain('Контент')
    mounted.unmount()
  })

  it('status: error позначає крок і озвучує помилку', async () => {
    const mounted = await mountComponent(UiStepper, {
      modelValue: 0,
      steps: [steps[0], { ...steps[1], status: 'error' }, steps[2]],
      clickMode: 'any',
    })
    const failing = mounted.host.querySelectorAll('nav > ol > li')[1]!
    expect(failing.textContent).toContain('помилка')
    expect(failing.querySelector('.text-danger')).not.toBeNull()
    mounted.unmount()
  })

  it('compact лишає назву кроку для скрінрідера', async () => {
    const mounted = await mountComponent(UiStepper, { modelValue: 0, steps, compact: true })
    expect(mounted.host.querySelector('button .sr-only')?.textContent).toContain('Сайт')
    mounted.unmount()
  })

  it('вертикальний степпер з’єднує кроки лініями між ними', async () => {
    const mounted = await mountComponent(UiStepper, { modelValue: 1, steps, orientation: 'vertical' })
    expect(mounted.host.querySelector('ol')!.className).toContain('flex-col')
    expect(mounted.host.querySelectorAll('li > span[aria-hidden="true"]')).toHaveLength(steps.length - 1)
    mounted.unmount()
  })
})

describe('UiNavigationMenu — disclosure', () => {
  const items = [
    { id: 'home', label: 'Головна', to: '/home' },
    {
      id: 'products',
      label: 'Продукти',
      children: [
        { id: 'one', label: 'Перший', href: '#one' },
        { id: 'two', label: 'Другий', to: '/two', current: true },
      ],
    },
    { id: 'about', label: 'Про нас', href: '#about' },
  ]

  const trigger = (host: HTMLElement) => host.querySelector<HTMLButtonElement>('button[aria-expanded]')!

  it('без v-model відкривається сама; ролей menubar немає; to — через NuxtLink', async () => {
    const mounted = await mountComponent(UiNavigationMenu, { items })
    expect(mounted.host.querySelector('[role="menubar"], [role="menuitem"]')).toBeNull()
    expect(mounted.host.querySelector('a[href="/home"]')?.textContent).toContain('Головна')
    trigger(mounted.host).click()
    await nextTick()
    expect(trigger(mounted.host).getAttribute('aria-expanded')).toBe('true')
    const panel = document.getElementById(trigger(mounted.host).getAttribute('aria-controls')!)!
    expect(panel.querySelector('[role="menu"]')).toBeNull()
    expect(panel.querySelector('a[href="/two"]')?.getAttribute('aria-current')).toBe('page')
    // Група з поточною сторінкою всередині теж позначена.
    expect(trigger(mounted.host).getAttribute('aria-current')).toBe('true')
    mounted.unmount()
  })

  it('фокус, що пішов за межі меню, закриває панель', async () => {
    const outside = document.createElement('button')
    document.body.append(outside)
    const mounted = await mountComponent(UiNavigationMenu, { items })
    const button = trigger(mounted.host)
    button.focus()
    button.click()
    await nextTick()
    expect(button.getAttribute('aria-expanded')).toBe('true')
    outside.focus()
    await nextTick()
    expect(button.getAttribute('aria-expanded')).toBe('false')
    mounted.unmount()
  })

  it('Tab веде з тригера в панель, а з останнього пункту — назад і далі', async () => {
    const mounted = await mountComponent(UiNavigationMenu, { items })
    const button = trigger(mounted.host)
    button.focus()
    button.click()
    await nextTick()

    const intoPanel = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    button.dispatchEvent(intoPanel)
    expect(intoPanel.defaultPrevented).toBe(true)
    const links = [...document.body.querySelectorAll<HTMLElement>('[data-nav-link]')]
    expect(document.activeElement).toBe(links[0])

    const back = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true })
    links[0]!.dispatchEvent(back)
    expect(back.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(button)
    expect(button.getAttribute('aria-expanded')).toBe('true')

    links[1]!.focus()
    const out = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    links[1]!.dispatchEvent(out)
    await nextTick()
    // Браузер продовжить Tab від тригера — до наступного пункту меню.
    expect(out.defaultPrevented).toBe(false)
    expect(document.activeElement).toBe(button)
    expect(button.getAttribute('aria-expanded')).toBe('false')
    mounted.unmount()
  })
})

describe('UiBreadcrumb', () => {
  it('посилання — справжні <a> через #components, а не мертвий <nuxtlink>', async () => {
    const mounted = await mountComponent(UiBreadcrumb, {
      items: [{ label: 'Головна', to: '/' }, { label: 'Сторінка' }],
    })
    expect(mounted.host.querySelector('a[href="/"]')?.textContent).toContain('Головна')
    expect(mounted.host.innerHTML.toLowerCase()).not.toContain('<nuxtlink')
    mounted.unmount()
  })

  it('довгий ланцюжок прокручено до поточної сторінки', async () => {
    const scrollWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollWidth')
    const clientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth')
    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
      configurable: true,
      get() {
        return this.tagName === 'NAV' ? 900 : 0
      },
    })
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get() {
        return this.tagName === 'NAV' ? 320 : 0
      },
    })
    try {
      const mounted = await mountComponent(UiBreadcrumb, {
        items: [{ label: 'Каталог', to: '/' }, { label: 'Електроніка', to: '/' }, { label: 'Смартфон' }],
      })
      expect(mounted.host.querySelector('nav')!.scrollLeft).toBeGreaterThan(0)
      mounted.unmount()
    } finally {
      if (scrollWidth) Object.defineProperty(HTMLElement.prototype, 'scrollWidth', scrollWidth)
      if (clientWidth) Object.defineProperty(HTMLElement.prototype, 'clientWidth', clientWidth)
    }
  })

  it('Tab докручує ланцюжок до посилання цілим, клік — ні', async () => {
    const scrolled: unknown[] = []
    vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(function (this: HTMLElement, options) {
      scrolled.push([this.textContent?.trim(), options])
    })
    const mounted = await mountComponent(UiBreadcrumb, {
      items: [{ label: 'Каталог', to: '/' }, { label: 'Електроніка', to: '/' }, { label: 'Смартфон' }],
    })
    const [catalog, electronics] = mounted.host.querySelectorAll<HTMLAnchorElement>('a')

    // Клік чи тап: посилання без :focus-visible.
    electronics!.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    expect(scrolled).toEqual([])

    // Ланцюжок прокручено до кінця, тож Tab починає з посилання ліворуч,
    // яке Chromium, частково видиме, лишив би обрізаним.
    catalog!.focus()
    expect(scrolled).toEqual([['Каталог', { block: 'nearest', inline: 'nearest' }]])

    // Поля під кільце крайнього посилання й той самий відступ для прокрутки.
    const nav = mounted.host.querySelector('nav')!
    expect(nav.className.split(/\s+/)).toEqual(expect.arrayContaining(['-mx-1', 'px-1', 'scroll-px-1']))
    mounted.unmount()
  })
})

describe('UiSidebar — збереження згортання', () => {
  it('зміна collapsed з коду застосунку теж потрапляє у сховище', async () => {
    const mounted = await mountComponent(UiSidebar, { storageKey: 'sb-test', collapsed: false })
    await mounted.update({ collapsed: true })
    expect(localStorage.getItem('sb-test')).toBe('1')
    await mounted.update({ collapsed: false })
    expect(localStorage.getItem('sb-test')).toBe('0')
    mounted.unmount()
  })

  it('відновлений стан застосовується без анімації ширини', async () => {
    localStorage.setItem('sb-test', '1')
    const values: boolean[] = []
    let mounted: Mounted
    mounted = await mountComponent(UiSidebar, {
      storageKey: 'sb-test',
      collapsed: false,
      'onUpdate:collapsed': (value: boolean) => {
        values.push(value)
        if (mounted) mounted.props.collapsed = value
      },
    })
    expect(values).toEqual([true])
    const aside = mounted.host.querySelector('aside')!
    expect(aside.className).not.toContain('transition-[width,transform]')
    await new Promise((resolve) => setTimeout(resolve, 80))
    expect(aside.className).toContain('transition-[width,transform]')
    mounted.unmount()
  })
})

describe('UiProse', () => {
  it('HTML вставляється прямо в корінь .ui-prose, без обгортки', async () => {
    const mounted = await mountComponent(UiProse, { html: '<p>Перший</p><p>Останній</p>' })
    const root = mounted.host.querySelector('.ui-prose')!
    expect([...root.children].map((child) => child.tagName)).toEqual(['P', 'P'])
    mounted.unmount()
  })
})

describe('UiResizablePanels', () => {
  it('роздільник має невидиму зону дотику 45px уздовж себе', async () => {
    const mounted = await mountComponent(UiResizablePanels, {}, { start: () => 'A', end: () => 'B' })
    const separator = mounted.host.querySelector<HTMLElement>('[role="separator"]')!
    expect(separator.className).toContain('pointer-coarse:after:w-12')
    expect(separator.classList.contains('relative')).toBe(true)
    await mounted.update({ direction: 'vertical' })
    expect(separator.className).toContain('pointer-coarse:after:h-12')
    mounted.unmount()
  })

  it('separatorStyle="line": лише лінія 1px, зона захоплення — невидимий after', async () => {
    const mounted = await mountComponent(UiResizablePanels, { separatorStyle: 'line' }, { start: () => 'A', end: () => 'B' })
    const separator = mounted.host.querySelector<HTMLElement>('[role="separator"]')!
    const tokens = () => new Set(separator.className.split(/\s+/))
    // Типовий вигляд (смуга 11px із лінією у ::before) для line не діє.
    expect(tokens().has('w-px')).toBe(true)
    expect(tokens().has('bg-line')).toBe(true)
    expect(tokens().has('after:w-3')).toBe(true)
    expect(tokens().has('w-3')).toBe(false)
    expect(tokens().has('bg-subtle')).toBe(false)
    await mounted.update({ separatorStyle: 'band' })
    expect(tokens().has('bg-subtle')).toBe(true)
    expect(tokens().has('w-px')).toBe(false)
    mounted.unmount()
  })
})
