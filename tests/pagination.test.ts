import { describe, expect, it } from 'vitest'
import { computeVisiblePages } from '../app/utils/pagination'

describe('computeVisiblePages', () => {
  it('малі списки показують усі сторінки (totalPages <= span*2+5)', () => {
    expect(computeVisiblePages(7, 4, 1)).toEqual([1, 2, 3, 4, 5, 6, 7])
    // Межа: рівно span*2+5 — ще без розривів.
    expect(computeVisiblePages(7, 1, 1)).toEqual([1, 2, 3, 4, 5, 6, 7])
    // На один більше — уже компактний режим з розривами.
    expect(computeVisiblePages(8, 4, 1)).toEqual([1, 'gap', 3, 4, 5, 'gap', 8])
  })

  it('перша й остання сторінки завжди в списку', () => {
    for (const current of [1, 2, 10, 19, 20]) {
      const pages = computeVisiblePages(20, current, 1)
      expect(pages[0]).toBe(1)
      expect(pages[pages.length - 1]).toBe(20)
    }
  })

  it('gap з\'являється тільки коли start > 2 або end < total - 1', () => {
    // Блок сусідів впирається в першу сторінку — розриву зліва немає.
    expect(computeVisiblePages(20, 2, 1)).toEqual([1, 2, 3, 'gap', 20])
    expect(computeVisiblePages(20, 3, 1)).toEqual([1, 2, 3, 4, 'gap', 20])
    // Блок впирається в останню — розриву справа немає.
    expect(computeVisiblePages(20, 19, 1)).toEqual([1, 'gap', 18, 19, 20])
    // Посередині — розриви з обох боків.
    expect(computeVisiblePages(20, 10, 1)).toEqual([1, 'gap', 9, 10, 11, 'gap', 20])
  })

  it('поточна сторінка завжди в списку', () => {
    for (let current = 1; current <= 20; current++) {
      expect(computeVisiblePages(20, current, 1)).toContain(current)
      expect(computeVisiblePages(50, current, 2)).toContain(current)
    }
  })

  it('totalPages = 0 дає порожній список', () => {
    expect(computeVisiblePages(0, 1, 1)).toEqual([])
  })

  it('siblingCount менший за 1 піднімається до 1', () => {
    expect(computeVisiblePages(8, 4, 0)).toEqual([1, 'gap', 3, 4, 5, 'gap', 8])
  })
})