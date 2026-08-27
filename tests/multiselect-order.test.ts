import { describe, expect, it } from 'vitest'
import { clearFiltered, orderSelection, type MultiSelectOption } from '../app/utils/multiSelect'

const options: MultiSelectOption[] = [
  { value: 1, label: 'Alpha' },
  { value: 2, label: 'Beta' },
  { value: 3, label: 'Gamma' },
]

describe('orderSelection', () => {
  it('порядок віддачі слідує options, а не порядку кліків', () => {
    // Клікнули Gamma, потім Alpha — внутрішній Set зберігає порядок кліків.
    const clicked = new Set([3, 1])
    expect(orderSelection(options, clicked)).toEqual([1, 3])
  })

  it('один клік по останньому пункту дає значення в позиції options', () => {
    expect(orderSelection(options, new Set([3]))).toEqual([3])
  })

  it('невідомі значення в наборі ігноруються', () => {
    expect(orderSelection(options, new Set([1, 99]))).toEqual([1])
  })
})

describe('clearFiltered', () => {
  it('clearAll з активним фільтром не чіпає поза-фільтр-вибране', () => {
    const filtered = options.filter((option) => option.value === 2)
    expect(clearFiltered([1, 2, 3], filtered)).toEqual([1, 3])
  })

  it('без фільтра (відфільтроване = усе) знімає все', () => {
    expect(clearFiltered([1, 2, 3], options)).toEqual([])
  })

  it('порожній результат фільтра не знімає нічого', () => {
    expect(clearFiltered([1, 3], [])).toEqual([1, 3])
  })
})