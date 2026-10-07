/**
 * Регресії з аудиту компонентів дій, даних і зворотного зв'язку.
 *
 * Кожен блок тримає конкретний баг, знайдений вимірюванням: клавіатура,
 * з'їдена клікабельним рядком таблиці; фокус, що падав на <body> після
 * пагінації; дерево, недосяжне з Tab; хронологія, відсортована за назвою
 * дня тижня. Класи перевіряються лише там, де сам клас і є поведінкою
 * (зона дотику, обрізання тексту): CSS у happy-dom не рахується.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { h, nextTick, ref } from 'vue'
import UiAlert from '~/components/ui/UiAlert.vue'
import UiAvatar from '~/components/ui/UiAvatar.vue'
import UiAvatarGroup from '~/components/ui/UiAvatarGroup.vue'
import UiButton from '~/components/ui/UiButton.vue'
import UiCard from '~/components/ui/UiCard.vue'
import UiChip from '~/components/ui/UiChip.vue'
import UiCopyButton from '~/components/ui/UiCopyButton.vue'
import UiDescriptionList from '~/components/ui/UiDescriptionList.vue'
import UiLoadingDots from '~/components/ui/UiLoadingDots.vue'
import UiPagination from '~/components/ui/UiPagination.vue'
import UiProgress from '~/components/ui/UiProgress.vue'
import UiSeparator from '~/components/ui/UiSeparator.vue'
import UiStatCard from '~/components/ui/UiStatCard.vue'
import UiTable from '~/components/ui/UiTable.vue'
import UiTree from '~/components/ui/UiTree.vue'
import UiVirtualList from '~/components/ui/UiVirtualList.vue'
import { compareValues } from '~/utils/tableColumns'
import { mountComponent } from './helpers/mountComponent'

let mounted: Awaited<ReturnType<typeof mountComponent>> | null = null

afterEach(() => {
  mounted?.unmount()
  mounted = null
  document.body.innerHTML = ''
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const TOUCH_ZONE = "pointer-coarse:after:content-['']"

/* ------------------------------------------------------------------ */
/*  UiTable                                                            */
/* ------------------------------------------------------------------ */

describe('UiTable — клікабельні рядки', () => {
  const headers = [
    { value: 'name', text: 'Назва' },
    { value: 'actions', text: 'Дії' },
  ]
  const items = [{ id: 1, name: 'Альфа' }]

  async function mountClickable(extra: Record<string, unknown> = {}) {
    const rowClick = vi.fn()
    const inner = vi.fn()
    mounted = await mountComponent(
      UiTable,
      { headers, items, rowClickable: true, onRowClick: rowClick, ...extra },
      { 'cell-actions': () => h('button', { type: 'button', class: 'inner', onClick: inner }, 'Видалити') },
    )
    const row = mounted.host.querySelector<HTMLTableRowElement>('tbody tr')!
    const button = mounted.host.querySelector<HTMLButtonElement>('button.inner')!
    return { rowClick, inner, row, button }
  }

  it('рядок лишається рядком: без role="button", але у Tab-обході', async () => {
    const { row } = await mountClickable()
    expect(row.getAttribute('role')).toBeNull()
    expect(row.tabIndex).toBe(0)
  })

  it('Enter на кнопці в комірці належить кнопці, а не рядку', async () => {
    const { row, button, rowClick } = await mountClickable()
    const onButton = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    button.dispatchEvent(onButton)
    // Раніше рядок робив preventDefault — і кнопка так і не активувалась.
    expect(onButton.defaultPrevented).toBe(false)
    expect(rowClick).not.toHaveBeenCalled()

    const onRow = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true })
    row.dispatchEvent(onRow)
    expect(onRow.defaultPrevented).toBe(true)
    expect(rowClick).toHaveBeenCalledTimes(1)
  })

  it('клік по кнопці в комірці не відкриває рядок, клік по тексту — відкриває', async () => {
    const { row, button, rowClick, inner } = await mountClickable()
    button.click()
    expect(inner).toHaveBeenCalledTimes(1)
    expect(rowClick).not.toHaveBeenCalled()

    row.querySelector('td')!.click()
    expect(rowClick).toHaveBeenCalledTimes(1)
  })

  it('фокус малюється на комірках, а не кільцем на <tr>', async () => {
    const { row } = await mountClickable()
    // ring на <tr> перекривали позиційовані комірки — його не було видно.
    expect(row.className).not.toContain('focus-visible:ring-2')
    expect(row.className).toContain('[&:focus-visible>td]:shadow-')
    expect(row.className).toContain('[&:focus-visible>td:first-child]:shadow-')
    expect(row.className).toContain('[&:focus-visible>td:last-child]:shadow-')
  })
})

describe('UiTable — виділення тексту', () => {
  const headers = [{ value: 'name', text: 'Назва' }]
  const items = [
    { id: 1, name: 'Альфа' },
    { id: 2, name: 'Бета' },
  ]

  it('selectable більше не забороняє копіювати текст таблиці', async () => {
    mounted = await mountComponent(UiTable, { headers, items, selectable: true, mobileCards: true })
    const root = mounted.host.firstElementChild as HTMLElement
    expect(root.className).not.toContain('select-none')
  })

  it('Shift+mousedown на прапорці гасить виділення тексту, звичайний — ні', async () => {
    mounted = await mountComponent(UiTable, { headers, items, selectable: true })
    const cell = mounted.host.querySelector<HTMLTableCellElement>('tbody td')!
    const shift = new MouseEvent('mousedown', { bubbles: true, cancelable: true, shiftKey: true })
    cell.dispatchEvent(shift)
    expect(shift.defaultPrevented).toBe(true)

    const plain = new MouseEvent('mousedown', { bubbles: true, cancelable: true })
    cell.dispatchEvent(plain)
    expect(plain.defaultPrevented).toBe(false)
  })
})

describe('UiTable — сортування', () => {
  const texts = () =>
    [...mounted!.host.querySelectorAll('tbody tr')].map((row) => row.querySelector('td')!.textContent!.trim())

  it('compareValues сортує Date хронологічно, а невалідні дати й NaN — у кінець', () => {
    const dates = [
      new Date('2026-01-02T10:00:00Z'), // пʼятниця
      new Date('2026-01-05T10:00:00Z'), // понеділок
      new Date('invalid'),
      new Date('2026-01-01T10:00:00Z'), // четвер
      new Date('2025-12-31T10:00:00Z'), // середа
    ]
    const iso = (list: Date[]) => list.map((date) => (Number.isNaN(date.getTime()) ? 'invalid' : date.toISOString().slice(0, 10)))
    expect(iso([...dates].sort((a, b) => compareValues(a, b, 1)))).toEqual([
      '2025-12-31', '2026-01-01', '2026-01-02', '2026-01-05', 'invalid',
    ])
    expect(iso([...dates].sort((a, b) => compareValues(a, b, -1)))).toEqual([
      '2026-01-05', '2026-01-02', '2026-01-01', '2025-12-31', 'invalid',
    ])
    expect([3, Number.NaN, 1].sort((a, b) => compareValues(a, b, 1))).toEqual([1, 3, Number.NaN])
  })

  it('таблиця сортує колонку з Date за часом, а не за toString()', async () => {
    mounted = await mountComponent(
      UiTable,
      {
        headers: [{ value: 'label', text: 'Подія' }, { value: 'at', text: 'Коли', sortable: true }],
        items: [
          { id: 1, label: 'пʼятниця', at: new Date('2026-01-02T10:00:00Z') },
          { id: 2, label: 'понеділок', at: new Date('2026-01-05T10:00:00Z') },
          { id: 3, label: 'четвер', at: new Date('2026-01-01T10:00:00Z') },
        ],
        sort: { by: 'at', dir: 'asc' },
      },
    )
    expect(texts()).toEqual(['четвер', 'пʼятниця', 'понеділок'])
  })

  it('sortValue колонки перекриває item[value], serverSort його не викликає', async () => {
    const sortValue = vi.fn((item: Record<string, any>) => item.author.name)
    const props = {
      headers: [
        { value: 'title', text: 'Назва' },
        { value: 'author', text: 'Автор', sortable: true, sortValue },
      ],
      items: [
        { id: 1, title: 'Третя', author: { name: 'Ярема' } },
        { id: 2, title: 'Перша', author: { name: 'Андрій' } },
        { id: 3, title: 'Друга', author: { name: 'Марта' } },
      ],
      sort: { by: 'author', dir: 'asc' },
    }
    mounted = await mountComponent(UiTable, props)
    expect(texts()).toEqual(['Перша', 'Друга', 'Третя'])
    mounted.unmount()

    sortValue.mockClear()
    mounted = await mountComponent(UiTable, { ...props, serverSort: true })
    expect(texts()).toEqual(['Третя', 'Перша', 'Друга'])
    expect(sortValue).not.toHaveBeenCalled()
  })
})

describe('UiTable — мобільні картки мають ті самі стани', () => {
  const headers = [{ value: 'name', text: 'Назва' }, { value: 'sum', text: 'Сума' }]
  const mobile = () => mounted!.host.querySelector<HTMLElement>('[class~="md:hidden"]')!

  it('перше завантаження — скелетон-картки замість порожнечі', async () => {
    mounted = await mountComponent(UiTable, { headers, items: [], loading: true, mobileCards: true, skeletonRows: 3 })
    expect(mobile().getAttribute('aria-busy')).toBe('true')
    const cards = mobile().querySelectorAll('[aria-hidden="true"].rounded-card')
    expect(cards).toHaveLength(3)
    // Скелетон повторює геометрію пар — по рядку на кожну колонку.
    expect(cards[0]!.children).toHaveLength(headers.length)
  })

  it('повторне завантаження — оверлей «Оновлення…» над картками', async () => {
    mounted = await mountComponent(UiTable, {
      headers, items: [{ id: 1, name: 'Альфа', sum: 1 }], loading: true, mobileCards: true,
    })
    expect(mobile().textContent).toContain('Оновлення…')
    expect(mobile().getAttribute('aria-busy')).toBe('true')
    await mounted.update({ loading: false })
    expect(mobile().textContent).not.toContain('Оновлення…')
    expect(mobile().hasAttribute('aria-busy')).toBe(false)
  })

  it('слот #empty рендериться і в картках, а не лише в таблиці', async () => {
    mounted = await mountComponent(
      UiTable,
      { headers, items: [], mobileCards: true },
      { empty: () => h('p', { class: 'rich-empty' }, 'Додайте перший товар') },
    )
    expect(mobile().querySelector('.rich-empty')).not.toBeNull()
    expect(mobile().textContent).not.toContain('Даних немає')
  })
})

/* ------------------------------------------------------------------ */
/*  UiPagination                                                       */
/* ------------------------------------------------------------------ */

describe('UiPagination', () => {
  async function mountPager(page: number) {
    mounted = await mountComponent(UiPagination, {
      page,
      totalPages: 10,
      'onUpdate:page': (value: number) => {
        mounted!.props.page = value
      },
    })
  }
  const pageButton = (label: string) =>
    [...mounted!.host.querySelectorAll<HTMLButtonElement>('nav button')].find(
      (button) => button.textContent?.trim() === label,
    )!

  it('натиснута сторінка лишається тим самим вузлом — фокус не падає на body', async () => {
    await mountPager(4)
    const five = pageButton('5')
    five.focus()
    five.click()
    await nextTick()
    // Ряд змінився з [1 … 3 4 5 … 10] на [1 … 4 5 6 … 10]: з індексом у
    // ключі кнопку «5» перестворювало.
    expect(five.isConnected).toBe(true)
    expect(five.getAttribute('aria-current')).toBe('page')
    expect(document.activeElement).toBe(five)

    // І назад, зі зміною довжини ряду.
    const two = pageButton('4')
    two.focus()
    two.click()
    await nextTick()
    expect(two.isConnected).toBe(true)
  })

  it('вимкнена пагінація має вимкнений вигляд і на номерах, без hover', async () => {
    await mountPager(4)
    const number = pageButton('3')
    expect(number.className).toContain('disabled:opacity-40')
    expect(number.className).toContain('not-disabled:hover:bg-hover')
    expect(number.className).not.toMatch(/(^|\s)hover:bg-hover/)
    expect(number.className).toContain(TOUCH_ZONE)
  })

  it('діапазон друкує всі три числа в одному форматі', async () => {
    mounted = await mountComponent(UiPagination, { page: 60, totalPages: 72, totalItems: 1437, pageSize: 20 })
    const text = mounted.host.textContent!.replace(/\s/g, ' ')
    expect(text).toContain('1 181–1 200 з 1 437')
  })

  it('select розміру сторінки має 16px на мобільному — iOS не зумує', async () => {
    mounted = await mountComponent(UiPagination, { page: 1, totalPages: 3, pageSize: 20, pageSizeOptions: [20, 50] })
    const select = mounted.host.querySelector('select')!
    expect(select.className).toContain('text-[16px]')
    expect(select.className).not.toMatch(/(^|\s)text-base(\s|$)/)
  })
})

/* ------------------------------------------------------------------ */
/*  UiTree                                                             */
/* ------------------------------------------------------------------ */

describe('UiTree — точка входу з клавіатури', () => {
  const items = [
    { id: 'docs', label: 'Документи', children: [{ id: 'report', label: 'Звіт' }] },
    { id: 'photos', label: 'Фото' },
  ]
  const tabbable = () =>
    [...mounted!.host.querySelectorAll<HTMLElement>('[role="treeitem"][tabindex="0"]')].map((row) => row.textContent?.trim())

  it('вибраний вузол у згорнутій гілці — Tab веде на його видимого предка', async () => {
    mounted = await mountComponent(UiTree, { items, modelValue: 'report' })
    // Раніше жоден рядок не мав tabindex=0 — дерево було недосяжне з Tab.
    expect(tabbable()).toEqual(['Документи'])
  })

  it('зовнішня зміна v-model переносить точку входу на новий вибір', async () => {
    mounted = await mountComponent(UiTree, { items, modelValue: 'photos', expanded: ['docs'] })
    expect(tabbable()).toEqual(['Фото'])
    await mounted.update({ modelValue: 'report' })
    expect(tabbable()).toEqual(['Звіт'])
    // Гілку згорнули згори — вхід переїжджає на предка, а не зникає.
    await mounted.update({ expanded: [] })
    expect(tabbable()).toEqual(['Документи'])
  })

  it('шеврон має зону дотику на всю висоту рядка і лишається не-кнопкою', async () => {
    mounted = await mountComponent(UiTree, { items })
    const row = mounted.host.querySelector('[role="treeitem"]')!
    const toggle = row.querySelector<HTMLElement>('[aria-hidden="true"]')!
    expect(toggle.className).toContain('self-stretch')
    expect(toggle.className).toContain('pointer-coarse:after:w-12')
    expect(row.querySelector('[role="button"]')).toBeNull()
  })
})

/* ------------------------------------------------------------------ */
/*  UiButton, UiCopyButton, UiLoadingDots                               */
/* ------------------------------------------------------------------ */

describe('UiButton variant="link"', () => {
  it('не отримує полів і висоти розміру та не стискається при натисканні', async () => {
    mounted = await mountComponent(UiButton, { variant: 'link', size: 'md' }, { default: () => 'Показати ще' })
    const cls = mounted.host.querySelector('button')!.className
    // px-0 програвав px-4 у згенерованому CSS — перекриття не працювало.
    expect(cls).not.toMatch(/(^|\s)(md:)?(px-[1-9]|h-(9|10))/)
    expect(cls).not.toContain('active:scale-[0.98]')
    expect(cls).toContain('md:text-sm')
  })

  it('решта варіантів розміри й натискання зберігають', async () => {
    mounted = await mountComponent(UiButton, { variant: 'solid', size: 'md' }, { default: () => 'Зберегти' })
    const cls = mounted.host.querySelector('button')!.className
    expect(cls).toContain('px-4')
    expect(cls).toContain('active:scale-[0.98]')
  })
})

describe('UiCopyButton', () => {
  function stubClipboard() {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
  }

  it('жива область існує ДО копіювання й отримує текст, а не вставляється з ним', async () => {
    stubClipboard()
    mounted = await mountComponent(UiCopyButton, { text: 'tatet', ariaLabel: 'Копіювати назву' })
    const region = mounted.host.querySelector('[role="status"]')!
    expect(region).not.toBeNull()
    expect(region.textContent).toBe('')

    mounted.host.querySelector('button')!.click()
    await Promise.resolve()
    await nextTick()
    expect(mounted.host.querySelector('[role="status"]')).toBe(region)
    expect(region.textContent).toBe('Скопійовано')
  })

  it('іконкова кнопка не пхає «Скопійовано» у квадрат — лише галочку', async () => {
    stubClipboard()
    mounted = await mountComponent(UiCopyButton, { text: 'tatet', ariaLabel: 'Копіювати назву' })
    mounted.host.querySelector('button')!.click()
    await Promise.resolve()
    await nextTick()
    const overlay = mounted.host.querySelector('span[aria-hidden="true"].absolute')!
    expect(overlay.querySelector('svg')).not.toBeNull()
    expect(overlay.textContent?.trim()).toBe('')
  })

  it('розміри, натискання й ring-offset — як у UiButton', async () => {
    mounted = await mountComponent(UiCopyButton, { text: 'tatet', label: 'Копіювати' })
    const cls = mounted.host.querySelector('button')!.className
    expect(cls).toContain('h-9')
    expect(cls).toContain('md:h-8')
    expect(cls).toContain('active:scale-[0.98]')
    expect(cls).toContain('focus-visible:ring-offset-2')
  })
})

describe('UiLoadingDots', () => {
  it('жива область має ТЕКСТ, а крапки сховані', async () => {
    mounted = await mountComponent(UiLoadingDots)
    const status = mounted.host.querySelector('[role="status"]')!
    expect(status.getAttribute('aria-label')).toBeNull()
    expect(status.textContent?.trim()).toBe('Завантаження')
    expect(status.querySelectorAll('.ui-loading-dot[aria-hidden="true"]')).toHaveLength(3)

    await mounted.update({ label: 'Зберігаємо' })
    expect(status.textContent?.trim()).toBe('Зберігаємо')
  })
})

/* ------------------------------------------------------------------ */
/*  UiChip                                                             */
/* ------------------------------------------------------------------ */

describe('UiChip', () => {
  it('довгий текст обрізається всередині чипа, не вилазячи за батька', async () => {
    mounted = await mountComponent(UiChip, {}, { default: () => 'Дуже довгий тег, що не вміщається' })
    const chip = mounted.host.firstElementChild as HTMLElement
    expect(chip.className).toContain('max-w-full')
    const text = chip.querySelector<HTMLElement>('.text-ellipsis')!
    expect(text.textContent).toBe('Дуже довгий тег, що не вміщається')
    // clip лише по горизонталі: truncate зрізав би виносні елементи літер.
    expect(text.className).toContain('overflow-x-clip')
    expect(text.className).toContain('min-w-0')
  })

  it('label не-клікабельного чипа — прихований текст, а не aria-label на span', async () => {
    mounted = await mountComponent(UiChip, { dot: true, label: 'Опубліковано', tone: 'success' }, { default: () => 'live' })
    const chip = mounted.host.firstElementChild as HTMLElement
    expect(chip.getAttribute('aria-label')).toBeNull()
    expect(chip.querySelector('.sr-only')?.textContent).toBe('Опубліковано')
    // Видимий текст не звучить удруге.
    expect(chip.querySelector('.text-ellipsis')?.getAttribute('aria-hidden')).toBe('true')
  })

  it('клікабельний чип лишає aria-label на кнопці', async () => {
    mounted = await mountComponent(UiChip, { clickable: true, label: 'Фільтр: Київ' }, { default: () => 'Київ' })
    const button = mounted.host.querySelector('button')!
    expect(button.getAttribute('aria-label')).toBe('Фільтр: Київ')
    expect(button.querySelector('.sr-only')).toBeNull()
  })

  it('назва хрестика стежить за текстом чипа', async () => {
    const text = ref('Київ')
    mounted = await mountComponent(UiChip, { removable: true }, { default: () => text.value })
    const remove = () => mounted!.host.querySelector('button')!
    expect(remove().getAttribute('aria-label')).toBe('Видалити Київ')
    text.value = 'Львів'
    await nextTick()
    expect(remove().getAttribute('aria-label')).toBe('Видалити Львів')
  })

  it('хрестик і клікабельний чип мають зону дотику', async () => {
    mounted = await mountComponent(UiChip, { removable: true }, { default: () => 'Київ' })
    const remove = mounted.host.querySelector('button')!
    expect(remove.className).toContain('relative')
    expect(remove.className).toContain(TOUCH_ZONE)
    mounted.unmount()

    mounted = await mountComponent(UiChip, { clickable: true, removable: true }, { default: () => 'Київ' })
    const chip = mounted.host.querySelector('button')!
    expect(chip.className).toContain(TOUCH_ZONE)
    // Хрестик — над зоною самого чипа, інакше його не дістати пальцем.
    expect(chip.querySelector('span[aria-hidden="true"]:last-child')!.className).toContain('z-10')
  })
})

/* ------------------------------------------------------------------ */
/*  UiSeparator, UiDescriptionList, UiAlert, UiCard, UiProgress         */
/* ------------------------------------------------------------------ */

describe('UiSeparator — позиція підпису', () => {
  const lines = () => {
    const root = mounted!.host.querySelector('[role="separator"]')!
    return [root.children[0] as HTMLElement, root.children[2] as HTMLElement]
  }

  it('start і end вкорочують лінію зі свого боку, center — жодну', async () => {
    mounted = await mountComponent(UiSeparator, { label: 'Архів', labelPosition: 'start' })
    let [leading, trailing] = lines()
    expect(leading!.className).toContain('w-4')
    expect(leading!.className).not.toContain('flex-1')
    expect(trailing!.className).toContain('flex-1')

    await mounted.update({ labelPosition: 'end' })
    ;[leading, trailing] = lines()
    expect(leading!.className).toContain('flex-1')
    expect(trailing!.className).toContain('w-4')

    await mounted.update({ labelPosition: 'center' })
    ;[leading, trailing] = lines()
    expect(leading!.className).toContain('flex-1')
    expect(trailing!.className).toContain('flex-1')
  })

  it('вертикальний підписаний роздільник — колонка з вертикальними лініями', async () => {
    mounted = await mountComponent(UiSeparator, { label: 'або', orientation: 'vertical' })
    const root = mounted.host.querySelector('[role="separator"]')!
    expect(root.getAttribute('aria-orientation')).toBe('vertical')
    expect(root.className).toContain('flex-col')
    const [leading, trailing] = lines()
    expect(leading!.className).toContain('w-px')
    expect(trailing!.className).toContain('w-px')
    expect(leading!.className).not.toContain('h-px')
  })
})

describe('UiDescriptionList — довгі значення', () => {
  it('значення може стиснутись і переносить неподільне слово', async () => {
    mounted = await mountComponent(UiDescriptionList, {
      layout: 'inline',
      items: [{ key: 'iban', term: 'IBAN', value: 'UA213223130000026007233566001' }],
    })
    const dd = mounted.host.querySelector('dd')!
    expect(dd.className).toContain('min-w-0')
    expect(dd.className).toContain('break-words')
    expect(mounted.host.querySelector('dl > div')!.className).toContain('min-w-0')
  })
})

describe('UiAlert', () => {
  it('хрестик має невидиму зону дотику 45×45', async () => {
    mounted = await mountComponent(UiAlert, { dismissible: true }, { default: () => 'Збережено' })
    const close = mounted.host.querySelector<HTMLButtonElement>('[aria-label="Закрити"]')!
    expect(close.className).toContain('relative')
    expect(close.className).toContain(TOUCH_ZONE)
    expect(close.className).toContain('pointer-coarse:after:h-12')
  })
})

describe('UiCard — поля шапки', () => {
  it('padding="sm" рівняє шапку й підвал по тілу', async () => {
    mounted = await mountComponent(
      UiCard,
      { padding: 'sm' },
      { header: () => 'Шапка', default: () => 'Тіло', footer: () => 'Підвал' },
    )
    const [header, body, footer] = [...(mounted.host.firstElementChild as HTMLElement).children] as HTMLElement[]
    expect(body!.className).toContain('p-3')
    expect(header!.className).toContain('px-3')
    expect(header!.className).not.toContain('px-4')
    expect(footer!.className).toContain('px-3')
  })

  it('md і none лишають звичайні px-4/sm:px-5', async () => {
    mounted = await mountComponent(UiCard, { padding: 'none' }, { header: () => 'Шапка', default: () => 'Тіло' })
    const header = (mounted.host.firstElementChild as HTMLElement).children[0] as HTMLElement
    expect(header.className).toContain('px-4')
    expect(header.className).toContain('sm:px-5')
  })
})

describe('UiProgress — контраст заливки', () => {
  it('accent-смуга — bg-accent, а не accent-solid', async () => {
    mounted = await mountComponent(UiProgress, { modelValue: 40 })
    const fill = mounted.host.querySelector('[role="progressbar"]')!.firstElementChild!
    expect(fill.className).toContain('bg-accent')
    expect(fill.className).not.toContain('bg-accent-solid')

    await mounted.update({ modelValue: null })
    const indeterminate = mounted.host.querySelector('[role="progressbar"]')!.firstElementChild!
    expect(indeterminate.className).not.toContain('bg-accent-solid')
  })
})

/* ------------------------------------------------------------------ */
/*  UiAvatar, UiAvatarGroup                                            */
/* ------------------------------------------------------------------ */

describe('UiAvatar', () => {
  const initials = () => mounted!.host.querySelector('[role="img"] span span[aria-hidden="true"]')?.textContent

  it('ініціали — перша БУКВА слова, а не лапка чи тире', async () => {
    mounted = await mountComponent(UiAvatar, { name: 'ТОВ «Сігма Трейд»' })
    expect(initials()).toBe('ТС')
    await mounted.update({ name: '— Марія (Ковалишин)' })
    expect(initials()).toBe('МК')
    await mounted.update({ name: '«Сігма»' })
    expect(initials()).toBe('С')
  })

  it('градієнт 600→700 — білі ініціали мають ≥4.5:1', async () => {
    mounted = await mountComponent(UiAvatar, { name: 'Ігор Шевченко' })
    const circle = mounted.host.querySelector('[role="img"] > span')!
    expect(circle.className).toContain('from-primary-600')
    expect(circle.className).toContain('to-primary-700')
    expect(circle.className).not.toContain('from-primary-400')
  })

  it('кегль ініціалів росте з розміром, а не впирається в text-sm', async () => {
    mounted = await mountComponent(UiAvatar, { name: 'Ігор Шевченко', size: 64 })
    const span = mounted.host.querySelector<HTMLElement>('[role="img"] span span[aria-hidden="true"]')!
    // Пара літер — 36% діаметра (64 → 23px), щоб «МШ» не впиралося в краї кола.
    expect(span.style.fontSize).toBe('23px')
    await mounted.update({ size: 20 })
    expect(span.style.fontSize).toBe('10px')
  })

  it('одна літера — 40% діаметра', async () => {
    mounted = await mountComponent(UiAvatar, { name: 'Дизайн', size: 50 })
    const span = mounted.host.querySelector<HTMLElement>('[role="img"] span span[aria-hidden="true"]')!
    expect(span.style.fontSize).toBe('20px')
  })

  it('shape="square" — картка замість кола', async () => {
    mounted = await mountComponent(UiAvatar, { name: 'Сігма', shape: 'square' })
    const circle = mounted.host.querySelector('[role="img"] > span')!
    expect(circle.className).toContain('rounded-card')
    expect(circle.className).not.toContain('rounded-full')
  })

  it('плитка «+N» у групі має той самий кегль, що й ініціали, і ту саму форму', async () => {
    const team = Array.from({ length: 4 }, (_, index) => ({ id: index, name: `Людина ${index + 1}` }))
    mounted = await mountComponent(UiAvatarGroup, { items: team, max: 2, size: 64, label: 'Команда', shape: 'square' })
    const tile = mounted.host.querySelector<HTMLElement>('[aria-label^="Ще"]')!
    const avatarInitials = mounted.host.querySelector<HTMLElement>('li [role="img"] span span[aria-hidden="true"]')!
    expect(tile.style.fontSize).toBe(avatarInitials.style.fontSize)
    expect(tile.className).toContain('rounded-card')
    expect(mounted.host.querySelector('li [role="img"] > span')!.className).toContain('rounded-card')
  })
})

/* ------------------------------------------------------------------ */
/*  UiStatCard                                                         */
/* ------------------------------------------------------------------ */

describe('UiStatCard — число зміни', () => {
  const spoken = () => [...mounted!.host.querySelectorAll('.sr-only')].map((el) => el.textContent).join(' | ')

  it('десятковий знак — кома, і скрінрідер чує те саме число', async () => {
    mounted = await mountComponent(UiStatCard, { label: 'Виторг', value: '100', delta: 12.4 })
    const deltaText = [...mounted.host.querySelectorAll('span[aria-hidden="true"]')]
      .map((el) => el.textContent)
      .find((text) => text?.includes('%'))
    // Раніше — «+12.4 %» з крапкою: сирий JS-рядок числа.
    expect(deltaText).toBe('+12,4 %')
    expect(spoken()).toContain('зростання на 12,4 відсотка')
  })

  it('слово «відсоток» узгоджене з числом', async () => {
    mounted = await mountComponent(UiStatCard, { label: 'Відмови', value: '3', delta: -1 })
    expect(spoken()).toContain('падіння на 1 відсоток')
    await mounted.update({ delta: 3 })
    expect(spoken()).toContain('зростання на 3 відсотки')
    await mounted.update({ delta: 25 })
    expect(spoken()).toContain('зростання на 25 відсотків')
    await mounted.update({ delta: 7.456, deltaFormat: 'absolute' })
    expect(spoken()).toContain('зростання на 7,46')
  })

  it('поки вантажиться — aria-busy на плитці', async () => {
    mounted = await mountComponent(UiStatCard, { label: 'Виторг', loading: true })
    expect((mounted.host.firstElementChild as HTMLElement).getAttribute('aria-busy')).toBe('true')
    await mounted.update({ loading: false, value: '100' })
    expect((mounted.host.firstElementChild as HTMLElement).hasAttribute('aria-busy')).toBe(false)
  })
})

/* ------------------------------------------------------------------ */
/*  UiVirtualList                                                      */
/* ------------------------------------------------------------------ */

describe('UiVirtualList — перевимірювання контейнера', () => {
  const items = Array.from({ length: 200 }, (_, index) => ({ id: index, label: `Рядок ${index}` }))
  let viewport = 300
  const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight')

  function patchClientHeight() {
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      get() {
        return (this as HTMLElement).getAttribute('role') === 'list' ? viewport : 0
      },
    })
  }

  afterEach(() => {
    if (original) Object.defineProperty(HTMLElement.prototype, 'clientHeight', original)
    viewport = 300
  })

  const rows = () => mounted!.host.querySelectorAll('[role="listitem"]').length

  it('новий height перераховує вікно без resize вікна', async () => {
    patchClientHeight()
    mounted = await mountComponent(
      UiVirtualList,
      { items, itemHeight: 30, height: '300px', overscan: 0 },
      { item: ({ item }: { item: { label: string } }) => h('span', item.label) },
    )
    expect(rows()).toBe(11)
    viewport = 900
    await mounted.update({ height: '900px' })
    await nextTick()
    // Раніше лишалося 11 рядків на 900px — низ списку порожній до скролу.
    expect(rows()).toBe(31)
  })

  it('ResizeObserver на контейнері перечитує висоту й від’єднується при unmount', async () => {
    patchClientHeight()
    const callbacks: Array<() => void> = []
    const disconnect = vi.fn()
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          callbacks.push(callback)
        }
        observe() {}
        unobserve() {}
        disconnect = disconnect
      },
    )
    mounted = await mountComponent(
      UiVirtualList,
      { items, itemHeight: 30, height: '100%', overscan: 0 },
      { item: ({ item }: { item: { label: string } }) => h('span', item.label) },
    )
    expect(rows()).toBe(11)
    // Батько (UiResizablePanels, сайдбар) змінив висоту — події вікна немає.
    viewport = 600
    callbacks.forEach((callback) => callback())
    await nextTick()
    expect(rows()).toBe(21)

    mounted.unmount()
    mounted = null
    expect(disconnect).toHaveBeenCalled()
  })
})
