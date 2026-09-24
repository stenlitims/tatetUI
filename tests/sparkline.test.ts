import { describe, expect, it } from 'vitest'
import {
  SPARK_WIDTH,
  areaPath,
  monotonePath,
  sparkBars,
  sparkDomain,
  sparkSegments,
  sparkSummary,
} from '../app/utils/sparkline'

/** Усі числа з рядка SVG-шляху — для перевірки меж без розбору команд. */
function numbersOf(path: string): number[] {
  return (path.match(/-?\d+(\.\d+)?/g) ?? []).map(Number)
}

describe('sparkDomain', () => {
  it('береться з даних і пропускає NaN', () => {
    expect(sparkDomain([3, Number.NaN, 7, 5])).toEqual([3, 7])
  })

  it('однакові значення розширюються на ±1 — інакше ділення на нуль', () => {
    expect(sparkDomain([5, 5, 5])).toEqual([4, 6])
  })

  it('для стовпчиків шкала завжди містить нуль', () => {
    expect(sparkDomain([98, 100], { includeZero: true })).toEqual([0, 100])
    expect(sparkDomain([-4, -2], { includeZero: true })).toEqual([-4, 0])
  })

  it('явні min/max мають пріоритет', () => {
    expect(sparkDomain([3, 7], { min: 0, max: 10 })).toEqual([0, 10])
  })
})

describe('sparkSegments', () => {
  it('пропуск рве лінію, а не малює нуль', () => {
    const segments = sparkSegments([1, 2, Number.NaN, 4, 5], { height: 30, padding: 2, domain: [1, 5] })
    expect(segments).toHaveLength(2)
    expect(segments[0]!.map((point) => point.index)).toEqual([0, 1])
    expect(segments[1]!.map((point) => point.index)).toEqual([3, 4])
  })

  it('максимум — на верхньому відступі, мінімум — на нижньому', () => {
    const [segment] = sparkSegments([0, 10], { height: 40, padding: 3, domain: [0, 10] })
    expect(segment![0]!.y).toBe(37)
    expect(segment![1]!.y).toBe(3)
    expect(segment![1]!.x).toBe(SPARK_WIDTH)
  })

  it('одна точка стоїть посередині', () => {
    const [segment] = sparkSegments([4], { height: 20, padding: 2, domain: [3, 5] })
    expect(segment![0]!.x).toBe(SPARK_WIDTH / 2)
  })
})

describe('monotonePath', () => {
  it('не перелітає екстремуми: крива лишається між мінімумом і максимумом', () => {
    const points = sparkSegments([10, 10, 50, 10, 10], { height: 100, padding: 0, domain: [10, 50] })[0]!
    const ys = numbersOf(monotonePath(points)).filter((_, i) => i % 2 === 1)
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...ys)).toBeLessThanOrEqual(100)
  })

  it('менше трьох точок — ламана', () => {
    const points = sparkSegments([1, 2], { height: 10, padding: 0, domain: [1, 2] })[0]!
    expect(monotonePath(points)).toBe('M0,10L100,0')
  })
})

describe('areaPath', () => {
  it('замикається на базовій лінії', () => {
    const points = sparkSegments([1, 2, 3], { height: 10, padding: 0, domain: [1, 3] })[0]!
    expect(areaPath(points, 'linear', 10)).toBe('M0,10L50,5L100,0L100,10L0,10Z')
  })
})

describe('sparkBars', () => {
  it('стовпчики ростуть від нуля, від’ємні — вниз', () => {
    const bars = sparkBars([2, -2], { height: 42, padding: 1, domain: [-2, 2] })
    expect(bars[0]!.y + bars[0]!.height).toBeCloseTo(21)
    expect(bars[1]!.y).toBeCloseTo(21)
    expect(bars[1]!.negative).toBe(true)
  })

  it('нуль — видимий стовпчик у волосину, пропуск — відсутній', () => {
    const bars = sparkBars([0, Number.NaN, 3], { height: 20, padding: 0, domain: [0, 3] })
    expect(bars.map((bar) => bar.index)).toEqual([0, 2])
    expect(bars[0]!.height).toBe(1)
  })
})

describe('sparkSummary', () => {
  const format = (value: number) => String(value)

  it('описує напрям, межі й екстремуми', () => {
    expect(sparkSummary([120, 96, 210, 180], format)).toBe('зростання: від 120 до 180, мінімум 96, максимум 210')
  })

  it('порожній ряд і одне значення', () => {
    expect(sparkSummary([], format)).toBe('Немає даних')
    expect(sparkSummary([Number.NaN, 7], format)).toBe('Одне значення: 7')
  })
})
