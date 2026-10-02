/**
 * Режим `fill` — висоту таблиці задає батьківська flex-колонка.
 *
 * Перевіряємо саме КЛАСИ й інлайновий стиль, бо jsdom не рахує розкладку:
 * зламати `fill` можна лише двома способами — не поставити `min-h-0` на
 * якійсь ланці (тоді ніщо не стискається) або лишити липку шапку під
 * старою умовою `stickyHeader && maxHeight` (тоді перехід із `maxHeight`
 * на `fill` мовчки віддирає шапку). Обидва — тихі, без помилки в консолі.
 */
import { afterEach, describe, expect, it } from 'vitest'
import UiTable from '~/components/ui/UiTable.vue'
import { mountComponent } from './helpers/mountComponent'

const headers = [
  { value: 'name', text: 'Назва', width: 200, sortable: true },
  { value: 'sum', text: 'Сума', width: 100, align: 'right' as const },
]

const items = [
  { id: 1, name: 'Альфа', sum: 10 },
  { id: 2, name: 'Бета', sum: 20 },
]

let mounted: Awaited<ReturnType<typeof mountComponent>> | null = null

afterEach(() => {
  mounted?.unmount()
  mounted = null
  document.body.innerHTML = ''
})

function boxes(host: HTMLElement) {
  const root = host.firstElementChild as HTMLElement
  const wrapper = root.querySelector(':scope > .relative') as HTMLElement
  const scroller = host.querySelector('.overflow-auto') as HTMLElement
  return { root, wrapper, scroller }
}

describe('UiTable fill', () => {
  it('ставить min-h-0 на кожну ланку ланцюжка стискання', async () => {
    mounted = await mountComponent(UiTable, { headers, items, fill: true })
    const { root, wrapper, scroller } = boxes(mounted.host)

    for (const el of [root, wrapper]) {
      expect(el.className).toContain('flex')
      expect(el.className).toContain('flex-col')
      expect(el.className).toContain('min-h-0')
      // flex-1 розтягнув би таблицю на три рядки на весь екран порожнім тлом.
      expect(el.className).not.toContain('flex-1')
    }
    expect(scroller.className).toContain('min-h-0')
    expect(scroller.style.maxHeight).toBe('')
  })

  it('без fill каркас лишається звичайним блоком', async () => {
    mounted = await mountComponent(UiTable, { headers, items, maxHeight: '24rem' })
    const { root, wrapper, scroller } = boxes(mounted.host)

    expect(root.className).not.toContain('flex-col')
    // Ні flex-колонки, ні min-h-0. Решта класів каркаса (isolate,
    // group/table) від fill не залежить і тут не перевіряється.
    expect(wrapper.className).not.toMatch(/\bflex\b|min-h-0/)
    expect(scroller.className).not.toContain('min-h-0')
    expect(scroller.style.maxHeight).toBe('24rem')
  })

  it('fill перекриває maxHeight, а не додається до нього', async () => {
    mounted = await mountComponent(UiTable, { headers, items, fill: true, maxHeight: '24rem' })
    expect(boxes(mounted.host).scroller.style.maxHeight).toBe('')
  })

  it('липка шапка тримається і на fill, і на maxHeight, і зникає без обох', async () => {
    mounted = await mountComponent(UiTable, { headers, items, stickyHeader: true, fill: true })
    const th = () => mounted!.host.querySelector('thead th') as HTMLElement
    expect(th().className).toContain('sticky top-0')

    await mounted.update({ fill: false, maxHeight: '24rem' })
    expect(th().className).toContain('sticky top-0')

    // Без контейнера з власною прокруткою кріпитися немає до чого.
    await mounted.update({ fill: false, maxHeight: undefined })
    expect(th().className).not.toContain('sticky top-0')
  })
})
