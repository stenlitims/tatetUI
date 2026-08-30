import { describe, expect, it } from 'vitest'
import {
  DRAG_MIN_THRESHOLD_PX,
  dragAxis,
  dragThreshold,
  rubberBandDelta,
  shouldAdvance,
  swipeDirection,
} from '~/utils/carousel'

describe('dragThreshold — поріг від ширини екрана', () => {
  it('масштабується від ширини: 360px → 54px, 800px → 120px', () => {
    expect(dragThreshold(360)).toBe(54)
    expect(dragThreshold(800)).toBe(120)
  })

  it('ніколи не падає нижче мінімуму 40px', () => {
    expect(dragThreshold(100)).toBe(DRAG_MIN_THRESHOLD_PX)
    expect(dragThreshold(100)).toBe(DRAG_MIN_THRESHOLD_PX)
  })

  it('деградує до мінімуму на смішних ширинах', () => {
    expect(dragThreshold(0)).toBe(DRAG_MIN_THRESHOLD_PX)
    expect(dragThreshold(-10)).toBe(DRAG_MIN_THRESHOLD_PX)
    expect(dragThreshold(Number.NaN)).toBe(DRAG_MIN_THRESHOLD_PX)
  })
})

describe('dragAxis — осьове блокування жесту', () => {
  it('null, поки рух менший за поріг класифікації', () => {
    expect(dragAxis(3, 3)).toBeNull()
    expect(dragAxis(0, 0)).toBeNull()
  })

  it('горизонтальна домінанта → x, вертикальна → y', () => {
    expect(dragAxis(30, 5)).toBe('x')
    expect(dragAxis(-30, -5)).toBe('x')
    expect(dragAxis(5, 30)).toBe('y')
    expect(dragAxis(5, -30)).toBe('y')
  })

  it('рівна діагональ — вертикаль (скрол виграє нічию)', () => {
    expect(dragAxis(20, 20)).toBe('y')
    expect(dragAxis(-20, 20)).toBe('y')
  })

  it('власний slop звужує зону невизначеності', () => {
    expect(dragAxis(6, 0, 8)).toBeNull()
    expect(dragAxis(6, 0, 4)).toBe('x')
  })
})

describe('shouldAdvance — поріг відстані або швидкий змах', () => {
  it('повільний жест перемикає лише після порогу ширини', () => {
    expect(shouldAdvance({ dx: 54, elapsedMs: 5000, width: 360 })).toBe(true)
    expect(shouldAdvance({ dx: 53, elapsedMs: 5000, width: 360 })).toBe(false)
  })

  it('швидкий короткий змах перемикає незалежно від порогу', () => {
    // 30px < 54px порогу, але за 120мс — флік.
    expect(shouldAdvance({ dx: 30, elapsedMs: 120, width: 360 })).toBe(true)
    expect(shouldAdvance({ dx: -30, elapsedMs: 120, width: 360 })).toBe(true)
  })

  it('короткий і повільний рух не перемикає', () => {
    expect(shouldAdvance({ dx: 30, elapsedMs: 400, width: 360 })).toBe(false)
  })

  it('довгий, але млявий рух — не флік', () => {
    expect(shouldAdvance({ dx: 35, elapsedMs: 350, width: 100 })).toBe(false)
  })
})

describe('rubberBandDelta — гумові краї без loop', () => {
  it('на першому слайді жест вправо гаситься до чверті', () => {
    expect(rubberBandDelta(100, { atStart: true, atEnd: false })).toBe(25)
  })

  it('на останньому — жест вліво гаситься так само', () => {
    expect(rubberBandDelta(-100, { atStart: false, atEnd: true })).toBe(-25)
  })

  it('всередині діапазону жест проходить один-в-один', () => {
    expect(rubberBandDelta(100, { atStart: false, atEnd: false })).toBe(100)
    expect(rubberBandDelta(-100, { atStart: false, atEnd: false })).toBe(-100)
  })

  it('край гасить лише напрямок «за межу»: старт — праворуч, кінець — ліворуч', () => {
    expect(rubberBandDelta(-100, { atStart: true, atEnd: false })).toBe(-100)
    expect(rubberBandDelta(100, { atStart: false, atEnd: true })).toBe(100)
  })
})

describe('swipeDirection — знак зсуву визначає напрям', () => {
  it('палець вправо — previous, вліво — next', () => {
    expect(swipeDirection(50)).toBe('previous')
    expect(swipeDirection(-50)).toBe('next')
  })
})