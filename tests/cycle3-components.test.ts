import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { createSSRApp, h, nextTick } from 'vue'
import { renderToString } from '@vue/server-renderer'
import UiActionBar from '~/components/ui/UiActionBar.vue'
import UiFormField from '~/components/ui/UiFormField.vue'
import UiIndicator from '~/components/ui/UiIndicator.vue'
import UiLightbox from '~/components/ui/UiLightbox.vue'
import UiPageHeader from '~/components/ui/UiPageHeader.vue'
import UiProgressRing from '~/components/ui/UiProgressRing.vue'
import UiRating from '~/components/ui/UiRating.vue'
import UiSparkline from '~/components/ui/UiSparkline.vue'
import UiSpinner from '~/components/ui/UiSpinner.vue'
import { lightboxIndex, zoomAround } from '~/utils/lightbox'
import { mountComponent } from './helpers/mountComponent'

beforeAll(() => {
  HTMLElement.prototype.scrollIntoView ??= () => undefined
  HTMLElement.prototype.scrollBy ??= () => undefined
})

afterEach(() => {
  document.body.innerHTML = ''
  document.body.removeAttribute('style')
  delete document.body.dataset.overlayScrollLocked
  vi.useRealTimers()
})

const keydown = (target: EventTarget, key: string) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))

describe('Spinner', () => {
  it('без назви — декоративний, з назвою — статус із текстом', async () => {
    const silent = await mountComponent(UiSpinner)
    const root = silent.host.firstElementChild!
    expect(root.getAttribute('aria-hidden')).toBe('true')
    expect(root.getAttribute('role')).toBeNull()
    silent.unmount()

    const announced = await mountComponent(UiSpinner, { label: 'Завантаження замовлень' })
    const status = announced.host.querySelector('[role="status"]')!
    expect(status.getAttribute('aria-hidden')).toBeNull()
    expect(status.querySelector('.sr-only')?.textContent).toBe('Завантаження замовлень')
    await announced.update({ showLabel: true })
    expect(status.querySelector('.sr-only')).toBeNull()
    expect(status.textContent).toContain('Завантаження замовлень')
    announced.unmount()
  })
})

describe('ProgressRing', () => {
  it('обрізає значення до шкали, а невизначений стан не має aria-valuenow', async () => {
    const mounted = await mountComponent(UiProgressRing, { modelValue: 140, max: 120, label: 'Квота' })
    const bar = mounted.host.querySelector('[role="progressbar"]')!
    expect(bar.getAttribute('aria-valuenow')).toBe('120')
    expect(bar.getAttribute('aria-valuemax')).toBe('120')
    expect(bar.getAttribute('aria-label')).toBe('Квота')

    await mounted.update({ modelValue: null })
    expect(bar.hasAttribute('aria-valuenow')).toBe(false)
    mounted.unmount()
  })

  it('відсоток у центрі — лише від 40px', async () => {
    const small = await mountComponent(UiProgressRing, { modelValue: 50, size: 32, showValue: true })
    expect(small.host.textContent).not.toContain('50%')
    await small.update({ size: 64 })
    expect(small.host.textContent).toContain('50%')
    small.unmount()
  })
})

describe('Indicator', () => {
  it('ховається на нулі, скорочує великі числа й за замовчуванням aria-hidden', async () => {
    const mounted = await mountComponent(UiIndicator, { count: 0 }, { default: () => h('button', 'Сповіщення') })
    expect(mounted.host.querySelectorAll('span.absolute')).toHaveLength(0)

    await mounted.update({ showZero: true })
    expect(mounted.host.textContent).toContain('0')

    await mounted.update({ count: 250, max: 99 })
    const badge = mounted.host.querySelector('span.absolute')!
    expect(badge.textContent).toContain('99+')
    expect(badge.getAttribute('aria-hidden')).toBe('true')

    await mounted.update({ label: '250 непрочитаних' })
    expect(badge.getAttribute('aria-hidden')).toBeNull()
    expect(badge.querySelector('.sr-only')?.textContent).toBe('250 непрочитаних')
    mounted.unmount()
  })

  it('крапка показується без числа', async () => {
    const mounted = await mountComponent(UiIndicator, { dot: true, tone: 'success' })
    const badge = mounted.host.querySelector('span.absolute')!
    expect(badge.className).toContain('bg-success')
    expect(badge.textContent?.trim()).toBe('')
    mounted.unmount()
  })
})

describe('PageHeader', () => {
  it('рівень заголовка окремо від кегля, «Назад» — посилання', async () => {
    const mounted = await mountComponent(
      UiPageHeader,
      { title: 'Замовлення №1042', as: 'h2', size: 'lg', backTo: '/orders', backLabel: 'До замовлень' },
      { actions: () => h('button', 'Друк') },
    )
    expect(mounted.host.querySelector('h2')?.textContent).toBe('Замовлення №1042')
    expect(mounted.host.querySelector('h1')).toBeNull()
    const back = mounted.host.querySelector('a')!
    expect(back.getAttribute('href')).toBe('/orders')
    expect(back.textContent).toContain('До замовлень')
    expect(mounted.host.textContent).toContain('Друк')
    mounted.unmount()
  })
})

describe('Sparkline', () => {
  it('має назву-підсумок і рве лінію на пропуску', async () => {
    const mounted = await mountComponent(UiSparkline, { data: [10, 12, Number.NaN, 9, 15] })
    const img = mounted.host.querySelector('[role="img"]')!
    expect(img.getAttribute('aria-label')).toBe('зростання: від 10 до 15, мінімум 9, максимум 15')
    expect(mounted.host.querySelectorAll('path')).toHaveLength(2)
    mounted.unmount()
  })

  it('area додає градієнт з унікальним id, bar малює прямокутники', async () => {
    const area = await mountComponent(UiSparkline, { data: [1, 3, 2], variant: 'area' })
    const gradient = area.host.querySelector('linearGradient')!
    const fill = area.host.querySelector('path[fill^="url("]')!.getAttribute('fill')
    expect(fill).toBe(`url(#${gradient.id})`)
    area.unmount()

    const bars = await mountComponent(UiSparkline, { data: [1, 0, 3], variant: 'bar', label: 'Замовлення за тиждень' })
    expect(bars.host.querySelectorAll('rect')).toHaveLength(3)
    expect(bars.host.querySelector('[role="img"]')!.getAttribute('aria-label')).toBe('Замовлення за тиждень')
    bars.unmount()
  })
})

describe('Rating', () => {
  it('readonly — одне зображення з повною назвою і дробовим заповненням', async () => {
    const mounted = await mountComponent(UiRating, { modelValue: 4.3, readonly: true, count: 128, showValue: true })
    const img = mounted.host.querySelector('[role="img"]')!
    expect(img.getAttribute('aria-label')).toBe('Оцінка 4,3 з 5, 128 відгуків')
    expect(mounted.host.querySelectorAll('input')).toHaveLength(0)
    const widths = [...mounted.host.querySelectorAll<HTMLElement>('.overflow-hidden')].map((el) => el.style.width)
    expect(widths.map((width) => Math.round(Number.parseFloat(width)))).toEqual([100, 100, 100, 100, 30])
    mounted.unmount()
  })

  it('клік ставить оцінку, повторний клік по обраній — знімає', async () => {
    const values: (number | null)[] = []
    const mounted = await mountComponent(UiRating, {
      modelValue: null,
      'onUpdate:modelValue': (value: number | null) => values.push(value),
    })
    const radios = [...mounted.host.querySelectorAll<HTMLInputElement>('input[type="radio"]')]
    expect(radios).toHaveLength(5)
    expect(radios.map((radio) => radio.tabIndex)).toEqual([0, -1, -1, -1, -1])
    expect(radios[3]!.getAttribute('aria-label')).toBe('4 з 5')
    expect(new Set(radios.map((radio) => radio.name)).size).toBe(1)

    radios[3]!.checked = true
    radios[3]!.dispatchEvent(new Event('change', { bubbles: true }))
    expect(values).toEqual([4])

    await mounted.update({ modelValue: 4 })
    expect(radios.map((radio) => radio.tabIndex)).toEqual([-1, -1, -1, 0, -1])
    const star = radios[3]!.nextElementSibling as HTMLElement
    star.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    expect(values).toEqual([4, null])
    mounted.unmount()
  })

  it('стрілки не зациклюються, ← на першій знімає оцінку лише з clearable', async () => {
    const values: (number | null)[] = []
    const mounted = await mountComponent(UiRating, {
      modelValue: 5,
      labels: ['Жахливо', 'Погано', 'Нормально', 'Добре', 'Чудово'],
      'onUpdate:modelValue': (value: number | null) => values.push(value),
    })
    const radios = [...mounted.host.querySelectorAll<HTMLInputElement>('input[type="radio"]')]
    expect(radios[4]!.getAttribute('aria-label')).toBe('5 з 5: Чудово')
    expect(mounted.host.textContent).toContain('Чудово')

    keydown(radios[4]!, 'ArrowRight')
    expect(values).toEqual([])
    keydown(radios[4]!, 'Home')
    expect(values).toEqual([1])

    await mounted.update({ modelValue: 1 })
    keydown(radios[0]!, 'ArrowLeft')
    expect(values).toEqual([1, null])

    await mounted.update({ modelValue: 1, clearable: false })
    keydown(radios[0]!, 'ArrowLeft')
    keydown(radios[0]!, 'Delete')
    expect(values).toEqual([1, null])
    mounted.unmount()
  })
})

describe('ActionBar', () => {
  it('live-регіон існує завжди, а панель — лише відкрита', async () => {
    const dismissed: number[] = []
    const mounted = await mountComponent(
      UiActionBar,
      { open: false, count: 3, onDismiss: () => dismissed.push(1) },
      { default: () => h('button', 'Архівувати') },
    )
    const status = mounted.host.querySelector('[role="status"]')!
    expect(status.textContent).toBe('')
    expect(mounted.host.querySelector('[role="region"]')).toBeNull()

    await mounted.update({ open: true })
    expect(status.textContent).toBe('3 обрано')
    const region = mounted.host.querySelector('[role="region"]')!
    expect(region.getAttribute('aria-label')).toBe('Дії з обраними')

    keydown(region.querySelector('button')!, 'Escape')
    mounted.host.querySelector<HTMLButtonElement>('[aria-label="Закрити панель"]')!.click()
    expect(dismissed).toHaveLength(2)
    mounted.unmount()
  })

  const actions = () => [h('button', 'Архівувати'), h('button', 'Експорт'), h('button', 'Видалити')]
  const classes = (el: Element) => el.className.split(/\s+/)

  it('розкладку обирає ширина контейнера, а не екрана', async () => {
    const mounted = await mountComponent(UiActionBar, { open: true, count: 5 }, { default: actions })
    const region = mounted.host.querySelector('[role="region"]')!
    const [summary, group, dismiss] = [...region.children]

    // Липка панель живе в дравері, вужчому за вікно: sm:flex-nowrap ставив
    // її в один ряд там, де лічильник стискався до «запи…».
    expect(classes(region.parentElement!)).toContain('@container')
    expect(classes(region)).toContain('@xl:flex-nowrap')
    expect(classes(region).filter((name) => /^(sm|md|lg):flex-(no)?wrap$/.test(name))).toEqual([])
    expect(classes(summary!)).toEqual(expect.arrayContaining(['@xl:shrink-0', '@xl:basis-auto']))
    // Контейнер ширину з вмісту не бере: без w-full у flex-col items-center панель схлопувалась.
    expect(classes(mounted.host.firstElementChild!)).toContain('w-full')

    // Вузька панель: дії окремим рядком ПІД лічильником і хрестиком, але в
    // DOM (а отже й у порядку Tab) — перед хрестиком.
    expect(classes(group!)).toEqual(expect.arrayContaining(['order-last', 'basis-full', '@xl:order-none']))
    expect(dismiss!.getAttribute('aria-label')).toBe('Закрити панель')

    // Смуга, що гортається на телефоні: з justify-end те, що вилізло за
    // початковий край, прокруткою вже не дістати.
    const strip = group!.firstElementChild!
    expect(classes(strip)).toEqual(expect.arrayContaining(['max-md:flex-nowrap', 'max-md:overflow-x-auto']))
    expect(strip.className).not.toMatch(/justify-end/)
    expect(strip.querySelectorAll('button')).toHaveLength(3)
    mounted.unmount()
  })

  it('без дій немає порожнього рядка під лічильником', async () => {
    const mounted = await mountComponent(UiActionBar, { open: true, label: 'Незбережені зміни' })
    const region = mounted.host.querySelector('[role="region"]')!
    expect(region.children).toHaveLength(2)
    expect(region.lastElementChild!.getAttribute('aria-label')).toBe('Закрити панель')
    mounted.unmount()
  })

  it('фокус з клавіатури докручує смугу до кнопки цілою, фокус від кліку — ні', async () => {
    const scrolled: unknown[] = []
    vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(function (this: HTMLElement, options) {
      scrolled.push([this.textContent, options])
    })
    const mounted = await mountComponent(UiActionBar, { open: true, count: 5 }, { default: actions })
    const [first, second] = mounted.host.querySelectorAll<HTMLButtonElement>('[role="region"] button')

    // Клік чи тап: кнопка без :focus-visible. Прокрутка зараз зсунула б її
    // з-під пальця.
    second!.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    expect(scrolled).toEqual([])

    first!.focus()
    expect(scrolled).toEqual([['Архівувати', { block: 'nearest', inline: 'nearest' }]])
    mounted.unmount()
  })
})

describe('FormField', () => {
  it('лейбл вказує на контрол, describedBy — рівно один із пари помилка/підказка', async () => {
    let captured: Record<string, unknown> = {}
    const mounted = await mountComponent(
      UiFormField,
      { label: 'Щільність', hint: 'Застосується одразу', description: 'Для всіх таблиць', id: 'density' },
      {
        default: (props: Record<string, unknown>) => {
          captured = props
          return h('input', { id: props.id, 'aria-describedby': props.describedBy })
        },
      },
    )
    expect(mounted.host.querySelector('label')!.getAttribute('for')).toBe('density')
    const [descriptionId, hintId] = String(captured.describedBy).split(' ')
    expect(document.getElementById(descriptionId!)?.textContent).toBe('Для всіх таблиць')
    expect(document.getElementById(hintId!)?.textContent).toBe('Застосується одразу')

    await mounted.update({ error: 'Оберіть щільність' })
    const ids = String(captured.describedBy).split(' ')
    expect(ids).toHaveLength(2)
    expect(document.getElementById(ids[1]!)?.textContent).toBe('Оберіть щільність')
    expect(captured.invalid).toBe(true)
    mounted.unmount()
  })

  it('fieldset: legend — перша дитина, інакше група лишається без назви', async () => {
    const mounted = await mountComponent(UiFormField, { label: 'Канали', as: 'fieldset', required: true })
    const fieldset = mounted.host.querySelector('fieldset')!
    expect(fieldset.firstElementChild?.tagName).toBe('LEGEND')
    expect(fieldset.firstElementChild?.textContent?.trim()).toBe("Канали (обов'язково)")
    mounted.unmount()
  })
})

describe('Lightbox', () => {
  const images = [
    { src: '/a.jpg', alt: 'Фасад' },
    { src: '/b.jpg', alt: 'Хол', caption: 'Хол на першому поверсі' },
    { src: '/c.jpg', alt: 'Тераса' },
  ]

  it('гортає стрілками, Escape закриває, мініатюри позначають поточне', async () => {
    const indexes: number[] = []
    const opened: boolean[] = []
    const mounted = await mountComponent(UiLightbox, {
      modelValue: true,
      images,
      'onUpdate:index': (value: number) => indexes.push(value),
      'onUpdate:modelValue': (value: boolean) => opened.push(value),
    })
    await nextTick()
    const dialog = document.body.querySelector<HTMLElement>('[role="dialog"]')!
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(dialog.textContent).toContain('1 / 3')

    keydown(document, 'ArrowRight')
    await nextTick()
    expect(indexes).toEqual([1])
    expect(dialog.textContent).toContain('Хол на першому поверсі')
    const current = dialog.querySelector('[aria-current="true"]')!
    expect(current.getAttribute('aria-label')).toBe('Зображення 2: Хол')

    keydown(document, 'End')
    keydown(document, 'ArrowRight')
    expect(indexes).toEqual([1, 2])

    keydown(document, 'Escape')
    expect(opened).toEqual([false])
    mounted.unmount()
  })

  it('без v-model:index гортає сам, з loop — по колу', async () => {
    const mounted = await mountComponent(UiLightbox, { modelValue: true, images, loop: true })
    await nextTick()
    keydown(document, 'ArrowLeft')
    await nextTick()
    expect(document.body.querySelector('[role="dialog"]')!.textContent).toContain('3 / 3')
    mounted.unmount()
  })

  it('однаковий server/initial-client render', async () => {
    const root = { render: () => h(UiLightbox, { modelValue: true, images }) }
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

describe('utils/lightbox', () => {
  it('lightboxIndex обрізає без loop і загортає з loop', () => {
    expect(lightboxIndex(5, 3)).toBe(2)
    expect(lightboxIndex(-1, 3)).toBe(0)
    expect(lightboxIndex(-1, 3, true)).toBe(2)
    expect(lightboxIndex(3, 3, true)).toBe(0)
    expect(lightboxIndex(Number.NaN, 3)).toBe(0)
    expect(lightboxIndex(1.7, 3)).toBe(1)
    expect(lightboxIndex(2, 0)).toBe(0)
  })

  it('zoomAround лишає деталь під вказівником на місці', () => {
    // Центр зображення зсунутий на (40, −20), вказівник — у точці (100, 50)
    // відносно центру сцени. Деталь під ним у координатах зображення:
    // (100 − 40, 50 + 20) / 1 = (60, 70). Після збільшення вдвічі вона має
    // лишитися під тим самим вказівником.
    const offset = zoomAround({ point: { x: 100, y: 50 }, offset: { x: 40, y: -20 }, scale: 1, nextScale: 2 })
    expect(offset).toEqual({ x: -20, y: -90 })
    expect(offset.x + 60 * 2).toBe(100)
    expect(offset.y + 70 * 2).toBe(50)
  })
})

describe('ButtonGroup', () => {
  it('група з назвою, без toolbar-ролі, шви — класами на прямих дітях', async () => {
    const UiButtonGroup = (await import('~/components/ui/UiButtonGroup.vue')).default
    const mounted = await mountComponent(
      UiButtonGroup,
      { label: 'Форматування тексту' },
      { default: () => [h('button', 'Ж'), h('button', 'К')] },
    )
    const group = mounted.host.querySelector('[role="group"]')!
    expect(group.getAttribute('aria-label')).toBe('Форматування тексту')
    expect(group.className).toContain('inline-flex')
    expect(group.className).toContain('[&>*:not(:first-child)]:rounded-l-none')
    expect(group.querySelectorAll('button')).toHaveLength(2)

    await mounted.update({ block: true, orientation: 'vertical' })
    expect(group.className).toContain('flex w-full')
    expect(group.className).not.toContain('inline-flex')
    expect(group.className).toContain('[&>*:not(:first-child)]:rounded-t-none')
    mounted.unmount()
  })
})

describe('SSR → гідрація нових компонентів', () => {
  const cases: Array<[string, () => ReturnType<typeof h>]> = [
    ['Rating (ввід)', () => h(UiRating, { modelValue: 3, label: 'Оцінка', labels: ['1', '2', '3', '4', '5'] })],
    ['Rating (readonly)', () => h(UiRating, { modelValue: 4.3, readonly: true, count: 12 })],
    ['Sparkline (area)', () => h(UiSparkline, { data: [1, 4, 2, 5], variant: 'area', showLastPoint: true })],
    ['FormField', () => h(UiFormField, { label: 'Поле', hint: 'Підказка' }, { default: (p: { id: string }) => h('input', { id: p.id }) })],
    ['ActionBar (sticky, відкрита)', () => h(UiActionBar, { open: true, count: 2 }, { default: () => h('button', 'Дія') })],
    ['ActionBar (fixed, відкрита)', () => h(UiActionBar, { open: true, placement: 'fixed', label: 'Незбережені зміни' })],
    ['Indicator', () => h(UiIndicator, { count: 5 }, { default: () => h('button', 'Вхідні') })],
    ['ProgressRing', () => h(UiProgressRing, { modelValue: 40, showValue: true, size: 56 })],
    ['PageHeader', () => h(UiPageHeader, { title: 'Заголовок', backTo: '/x' })],
  ]

  it.each(cases)('%s — без попереджень гідрації', async (_name, render) => {
    const root = { render }
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
    expect(warn).not.toHaveBeenCalled()
    expect(error).not.toHaveBeenCalled()
    client.unmount()
    host.remove()
  })
})
