import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import UiNumberInput from '~/components/ui/UiNumberInput.vue'
import UiTagInput from '~/components/ui/UiTagInput.vue'
import UiTimeline from '~/components/ui/UiTimeline.vue'
import { mountComponent } from './helpers/mountComponent'

let mounted: Awaited<ReturnType<typeof mountComponent>> | null = null
afterEach(() => {
  mounted?.unmount()
  mounted = null
  vi.useRealTimers()
})

describe('UiTimeline', () => {
  const events = [
    { id: 1, title: 'Виграно', datetime: '2026-08-17T16:40:00+03:00', tone: 'success' as const },
    { id: 2, title: 'Пропозицію надіслано', datetime: '2026-08-14T11:05:00+03:00' },
    { id: 3, title: 'Ліда створено', time: '8 серпня' },
  ]

  it('рендерить ol зі справжнім <time datetime>', async () => {
    mounted = await mountComponent(UiTimeline, { items: events })
    const list = mounted.host.querySelector('ol')!
    expect(list).not.toBeNull()
    expect(list.querySelectorAll('li')).toHaveLength(3)
    const time = list.querySelector('time')!
    expect(time.getAttribute('datetime')).toBe('2026-08-17T16:40:00+03:00')
  })

  it('форматує час у фіксованому поясі, тож сервер і клієнт збігаються', async () => {
    mounted = await mountComponent(UiTimeline, { items: events, timeZone: 'Europe/Kyiv' })
    const first = mounted.host.querySelector('time')!.textContent!.trim()
    // Той самий вхід у Києві завжди 16:40 — незалежно від поясу процесу.
    expect(first).toContain('16:40')

    await mounted.update({ timeZone: 'UTC' })
    expect(mounted.host.querySelector('time')!.textContent).toContain('13:40')
  })

  it('готовий item.time перекриває форматування', async () => {
    mounted = await mountComponent(UiTimeline, { items: events })
    const times = [...mounted.host.querySelectorAll('time')].map((el) => el.textContent!.trim())
    expect(times.at(-1)).toBe('8 серпня')
  })

  it('конектор не звисає під останньою подією', async () => {
    mounted = await mountComponent(UiTimeline, { items: events })
    const rows = [...mounted.host.querySelectorAll('li')]
    const connectors = rows.map((row) => !!row.querySelector('[aria-hidden="true"].absolute'))
    expect(connectors).toEqual([true, true, false])
  })

  it('порожній список показує emptyText замість списку', async () => {
    mounted = await mountComponent(UiTimeline, { items: [], emptyText: 'Подій немає' })
    expect(mounted.host.querySelector('ol')).toBeNull()
    expect(mounted.host.textContent).toContain('Подій немає')
  })
})

describe('UiNumberInput', () => {
  const field = () => mounted!.host.querySelector('input')!

  it('має spinbutton-семантику замість type=number', async () => {
    mounted = await mountComponent(UiNumberInput, { modelValue: 5, min: 0, max: 10 })
    expect(field().type).toBe('text')
    expect(field().getAttribute('inputmode')).toBe('decimal')
    expect(field().getAttribute('role')).toBe('spinbutton')
    expect(field().getAttribute('aria-valuenow')).toBe('5')
    expect(field().getAttribute('aria-valuemin')).toBe('0')
    expect(field().getAttribute('aria-valuemax')).toBe('10')
  })

  it('стрілки й PageUp/PageDown рухають значення й тримають межі', async () => {
    const seen: Array<number | null> = []
    mounted = await mountComponent(UiNumberInput, {
      modelValue: 5, min: 0, max: 20, step: 1,
      'onUpdate:modelValue': (value: number | null) => { seen.push(value); mounted!.props.modelValue = value },
    })
    field().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }))
    await nextTick()
    expect(seen.at(-1)).toBe(6)

    field().dispatchEvent(new KeyboardEvent('keydown', { key: 'PageUp', bubbles: true }))
    await nextTick()
    expect(seen.at(-1)).toBe(16)

    // Затискання по max, а не вихід за нього.
    field().dispatchEvent(new KeyboardEvent('keydown', { key: 'PageUp', bubbles: true }))
    await nextTick()
    expect(seen.at(-1)).toBe(20)

    field().dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }))
    await nextTick()
    expect(seen.at(-1)).toBe(0)
  })

  it('розуміє український запис із комою й нерозривним пробілом', async () => {
    const seen: Array<number | null> = []
    mounted = await mountComponent(UiNumberInput, {
      modelValue: null, precision: 2,
      'onUpdate:modelValue': (value: number | null) => seen.push(value),
    })
    const input = field()
    input.value = '1 234,5'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()
    expect(seen.at(-1)).toBe(1234.5)
  })

  it('порожнє поле дає null, а не NaN', async () => {
    const seen: Array<number | null> = []
    mounted = await mountComponent(UiNumberInput, {
      modelValue: 7,
      'onUpdate:modelValue': (value: number | null) => seen.push(value),
    })
    const input = field()
    input.value = ''
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()
    expect(seen.at(-1)).toBeNull()
  })

  it('групує тисячі поза фокусом і показує сире число у фокусі', async () => {
    mounted = await mountComponent(UiNumberInput, { modelValue: 14762.5, precision: 2 })
    const input = field()
    // Поза фокусом — згруповане.
    expect(input.value).toMatch(/14\s?762,50/)
    input.dispatchEvent(new FocusEvent('focus'))
    await nextTick()
    expect(input.value).toBe('14762.5')
  })

  it('aria-valuetext несе одиницю', async () => {
    mounted = await mountComponent(UiNumberInput, { modelValue: 15, unit: '%' })
    expect(field().getAttribute('aria-valuetext')).toContain('%')
  })

  it('aria-describedby вказує рівно на один опис', async () => {
    mounted = await mountComponent(UiNumberInput, { modelValue: 1, hint: 'Підказка', error: 'Помилка' })
    const described = field().getAttribute('aria-describedby')!
    expect(described.split(' ')).toHaveLength(1)
    expect(mounted.host.querySelector(`#${described}`)?.textContent).toBe('Помилка')
  })
})

describe('UiTagInput', () => {
  const field = () => mounted!.host.querySelector('input')!

  it('Enter додає мітку, кома ділить ввід', async () => {
    const seen: string[][] = []
    mounted = await mountComponent(UiTagInput, {
      modelValue: [],
      'onUpdate:modelValue': (value: string[]) => { seen.push(value); mounted!.props.modelValue = value },
    })
    const input = field()
    input.value = 'vip'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await nextTick()
    expect(seen.at(-1)).toEqual(['vip'])

    input.value = 'a,b,'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()
    expect(seen.at(-1)).toEqual(['vip', 'a', 'b'])
  })

  it('вставка пакета дає ОДНЕ оновлення моделі й одну відмову по межі', async () => {
    const updates: string[][] = []
    const rejects: Array<[string, string]> = []
    mounted = await mountComponent(UiTagInput, {
      modelValue: ['a'],
      max: 3,
      'onUpdate:modelValue': (value: string[]) => { updates.push(value); mounted!.props.modelValue = value },
      onReject: (tag: string, reason: string) => rejects.push([tag, reason]),
    })
    const input = field()
    const event = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent
    Object.defineProperty(event, 'clipboardData', { value: { getData: () => 'a, b, a, c, d' } })
    input.dispatchEvent(event)
    await nextTick()

    // Рівно одне оновлення, зупинка на межі.
    expect(updates).toHaveLength(1)
    expect(updates[0]).toEqual(['a', 'b', 'c'])
    expect(rejects.filter(([, reason]) => reason === 'max')).toHaveLength(1)
    expect(rejects.filter(([, reason]) => reason === 'duplicate').length).toBeGreaterThan(0)
  })

  it('Backspace спершу зводить мітку, і лише другий раз видаляє', async () => {
    const updates: string[][] = []
    mounted = await mountComponent(UiTagInput, {
      modelValue: ['vip', 'терміново'],
      'onUpdate:modelValue': (value: string[]) => { updates.push(value); mounted!.props.modelValue = value },
    })
    const input = field()
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }))
    await nextTick()
    // Перший — лише попередження, модель ціла.
    expect(updates).toHaveLength(0)
    expect(mounted.host.querySelector('.bg-danger-bg')).not.toBeNull()

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }))
    await nextTick()
    expect(updates.at(-1)).toEqual(['vip'])
  })

  it('дублікати відхиляються, а не додаються мовчки', async () => {
    const rejects: string[] = []
    mounted = await mountComponent(UiTagInput, {
      modelValue: ['vip'],
      onReject: (_tag: string, reason: string) => rejects.push(reason),
    })
    const input = field()
    input.value = 'vip'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await nextTick()
    expect(rejects).toContain('duplicate')
  })

  it('мітки — список із іменованими кнопками видалення, не listbox', async () => {
    mounted = await mountComponent(UiTagInput, { modelValue: ['vip'] })
    expect(mounted.host.querySelector('[role="listbox"]')).toBeNull()
    expect(mounted.host.querySelector('ul')).not.toBeNull()
    expect(mounted.host.querySelector('button[aria-label="Видалити vip"]')).not.toBeNull()
    // Поле лишається комбобоксом заради панелі підказок.
    expect(field().getAttribute('role')).toBe('combobox')
    expect(mounted.host.querySelector('[role="status"][aria-live="polite"]')).not.toBeNull()
  })
})
