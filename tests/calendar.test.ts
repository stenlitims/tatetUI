import { describe, expect, it } from 'vitest'
import {
  addDays,
  addMonths,
  buildMonthGrid,
  clampDate,
  compareDay,
  defaultDateRangePresets,
  endOfMonth,
  isSameDay,
  isWithin,
  isoWeekNumber,
  startOfDay,
  startOfMonth,
  startOfQuarter,
} from '~/utils/calendar'

const d = (y: number, m: number, day: number) => new Date(y, m - 1, day)

describe('calendar: арифметика дат', () => {
  it('addDays переживає перехід на літній час', () => {
    /*
     * В Україні годинник переводять в останню неділю березня. Доба тоді
     * триває 23 години, і дата + 86_400_000 мс перестрибнула б день.
     * Конструктор Date такої проблеми не має — це і перевіряємо.
     */
    const beforeDst = d(2026, 3, 28)
    const afterDst = addDays(beforeDst, 1)
    expect(afterDst.getDate()).toBe(29)
    expect(addDays(afterDst, 1).getDate()).toBe(30)

    // І назад, через осінній перехід (остання неділя жовтня).
    const october = d(2026, 10, 26)
    expect(addDays(october, -1).getDate()).toBe(25)
  })

  it('addMonths затискає день до останнього в місяці', () => {
    // 31 січня + 1 місяць у setMonth дало б 3 березня.
    expect(addMonths(d(2026, 1, 31), 1)).toEqual(d(2026, 2, 28))
    // Високосний рік.
    expect(addMonths(d(2024, 1, 31), 1)).toEqual(d(2024, 2, 29))
    expect(addMonths(d(2026, 3, 31), -1)).toEqual(d(2026, 2, 28))
    // Через межу року.
    expect(addMonths(d(2026, 12, 15), 1)).toEqual(d(2027, 1, 15))
    expect(addMonths(d(2026, 1, 15), -1)).toEqual(d(2025, 12, 15))
  })

  it('startOfMonth та endOfMonth', () => {
    expect(startOfMonth(d(2026, 8, 17))).toEqual(d(2026, 8, 1))
    expect(endOfMonth(d(2026, 8, 17))).toEqual(d(2026, 8, 31))
    expect(endOfMonth(d(2026, 2, 5))).toEqual(d(2026, 2, 28))
    expect(endOfMonth(d(2024, 2, 5))).toEqual(d(2024, 2, 29))
  })

  it('startOfQuarter', () => {
    expect(startOfQuarter(d(2026, 1, 9))).toEqual(d(2026, 1, 1))
    expect(startOfQuarter(d(2026, 5, 9))).toEqual(d(2026, 4, 1))
    expect(startOfQuarter(d(2026, 12, 31))).toEqual(d(2026, 10, 1))
  })

  it('compareDay ігнорує час', () => {
    const morning = new Date(2026, 7, 17, 3, 0, 0)
    const evening = new Date(2026, 7, 17, 23, 59, 59)
    expect(compareDay(morning, evening)).toBe(0)
    expect(isSameDay(morning, evening)).toBe(true)
    expect(compareDay(morning, d(2026, 8, 18))).toBe(-1)
    expect(compareDay(d(2026, 8, 18), morning)).toBe(1)
  })

  it('startOfDay зрізає час', () => {
    expect(startOfDay(new Date(2026, 7, 17, 18, 42, 7))).toEqual(d(2026, 8, 17))
  })
})

describe('calendar: сітка місяця', () => {
  it('завжди 42 комірки, у якому б місяці й з якого б дня тижня', () => {
    for (let month = 0; month < 12; month += 1) {
      for (const weekStart of [0, 1] as const) {
        expect(buildMonthGrid(new Date(2026, month, 1), weekStart)).toHaveLength(42)
      }
    }
    // Найгірший випадок: 31 день, що починається в неділю.
    expect(buildMonthGrid(d(2026, 3, 1), 1)).toHaveLength(42)
  })

  it('починається з потрібного дня тижня і містить весь місяць', () => {
    const grid = buildMonthGrid(d(2026, 8, 1), 1)
    expect(grid[0]!.getDay()).toBe(1) // понеділок
    const inMonth = grid.filter((date) => date.getMonth() === 7)
    expect(inMonth).toHaveLength(31)
    expect(inMonth[0]!.getDate()).toBe(1)
    expect(inMonth.at(-1)!.getDate()).toBe(31)

    const sundayFirst = buildMonthGrid(d(2026, 8, 1), 0)
    expect(sundayFirst[0]!.getDay()).toBe(0)
  })

  it('дні йдуть підряд без пропусків і дублів', () => {
    const grid = buildMonthGrid(d(2026, 3, 1), 1)
    for (let index = 1; index < grid.length; index += 1) {
      expect(isSameDay(grid[index]!, addDays(grid[index - 1]!, 1))).toBe(true)
    }
  })
})

describe('calendar: межі й діапазони', () => {
  it('isoWeekNumber рахує за ISO 8601', () => {
    // 4 січня завжди в першому тижні.
    expect(isoWeekNumber(d(2026, 1, 4))).toBe(1)
    // 1 січня 2027 — п'ятниця, тобто ще 53-й тиждень 2026-го.
    expect(isoWeekNumber(d(2027, 1, 1))).toBe(53)
    expect(isoWeekNumber(d(2026, 8, 17))).toBe(34)
  })

  it('clampDate тримає межі', () => {
    const min = d(2026, 8, 10)
    const max = d(2026, 8, 20)
    expect(clampDate(d(2026, 8, 1), min, max)).toEqual(min)
    expect(clampDate(d(2026, 8, 25), min, max)).toEqual(max)
    expect(clampDate(d(2026, 8, 15), min, max)).toEqual(d(2026, 8, 15))
    expect(clampDate(d(2026, 8, 15))).toEqual(d(2026, 8, 15))
  })

  it('isWithin працює і з переверненим відрізком', () => {
    const from = d(2026, 8, 10)
    const to = d(2026, 8, 20)
    expect(isWithin(d(2026, 8, 15), from, to)).toBe(true)
    expect(isWithin(from, from, to)).toBe(true)
    expect(isWithin(to, from, to)).toBe(true)
    expect(isWithin(d(2026, 8, 9), from, to)).toBe(false)
    expect(isWithin(d(2026, 8, 15), to, from)).toBe(true)
  })

  it('пресети рахуються від переданого «сьогодні», а не від дати збірки', () => {
    const today = d(2026, 8, 17)
    const byLabel = Object.fromEntries(
      defaultDateRangePresets.map((preset) => [preset.label, preset.range(today)]),
    )
    expect(byLabel['Сьогодні']).toEqual([d(2026, 8, 17), d(2026, 8, 17)])
    expect(byLabel['Останні 7 днів']).toEqual([d(2026, 8, 11), d(2026, 8, 17)])
    expect(byLabel['Останні 30 днів']).toEqual([d(2026, 7, 19), d(2026, 8, 17)])
    expect(byLabel['Цей місяць']).toEqual([d(2026, 8, 1), d(2026, 8, 31)])
    expect(byLabel['Минулий місяць']).toEqual([d(2026, 7, 1), d(2026, 7, 31)])
    expect(byLabel['Цей квартал']).toEqual([d(2026, 7, 1), d(2026, 9, 30)])

    // Інший день — інший результат: пресет не застигає.
    expect(defaultDateRangePresets[1]!.range(d(2026, 1, 3))).toEqual([
      d(2025, 12, 28),
      d(2026, 1, 3),
    ])
  })
})
