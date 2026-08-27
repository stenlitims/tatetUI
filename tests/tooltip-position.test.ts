import { describe, expect, it } from 'vitest'
import { computeTooltipPosition } from '../app/utils/tooltip'

const VIEWPORT = { innerWidth: 800, innerHeight: 600 }
const SIZE = { width: 120, height: 30 }

function rect(overrides: Partial<{
  top: number
  left: number
  width: number
  height: number
  right: number
  bottom: number
}> = {}) {
  return {
    top: 200,
    left: 100,
    width: 80,
    height: 32,
    right: 180,
    bottom: 232,
    ...overrides,
  }
}

describe('computeTooltipPosition', () => {
  it('top біля верхнього краю фліпається вниз: top = rect.bottom + gap', () => {
    // Зверху місця менше за висоту підказки: 200 - 30 - 6 < 8.
    const position = computeTooltipPosition(rect({ top: 4, bottom: 36 }), SIZE, VIEWPORT, 'top')
    expect(position.top).toBe(36 + 6)
  })

  it('bottom, що не влазить знизу, фліпається вгору: top = rect.top - h - gap', () => {
    // Знизу: 552 + 32 + 6 + 30 > 600 - 8.
    const position = computeTooltipPosition(rect({ top: 552, bottom: 584 }), SIZE, VIEWPORT, 'bottom')
    expect(position.top).toBe(552 - 30 - 6)
  })

  it('left, що не влазить зліва, фліпається праворуч: left = rect.right + gap', () => {
    // Зліва: 100 - 120 - 6 < 8.
    const position = computeTooltipPosition(rect(), SIZE, VIEWPORT, 'left')
    expect(position.left).toBe(180 + 6)
  })

  it('right, що не влазить справа, фліпається ліворуч: left = rect.left - w - gap', () => {
    // Справа: 760 + 6 + 120 > 800 - 8.
    const position = computeTooltipPosition(rect({ left: 680, right: 760 }), SIZE, VIEWPORT, 'right')
    expect(position.left).toBe(680 - 120 - 6)
  })

  it('left біля самого краю перевертається праворуч, а не притискається до краю', () => {
    // Тригер впритул до лівого краю: без фліпу було б left = 8 (edge) —
    // підказка перекрила б тригер; фліп дає 4 + 80 + 6 = 90 і влазить.
    const position = computeTooltipPosition(rect({ left: 4, right: 84 }), SIZE, VIEWPORT, 'left')
    expect(position.left).toBe(84 + 6)
  })

  it('кліп по X: підказка центрована над тригером', () => {
    const position = computeTooltipPosition(rect(), SIZE, VIEWPORT, 'top')
    const triggerCenter = 100 + 80 / 2
    expect(position.left + SIZE.width / 2).toBe(triggerCenter)
  })

  it('числа округлені до цілих', () => {
    const position = computeTooltipPosition(
      rect({ top: 10.4, left: 99.6, width: 80.5, height: 32.7, right: 180.1, bottom: 43.1 }),
      SIZE,
      VIEWPORT,
      'top',
    )
    expect(Number.isInteger(position.top)).toBe(true)
    expect(Number.isInteger(position.left)).toBe(true)
    // 43.1 + 6 = 49.1 → 49; 99.6 + 40.25 - 60 = 79.85 → 80.
    expect(position).toEqual({ top: 49, left: 80 })
  })

  it('притискається до лівого краю у вузькому вікні', () => {
    const position = computeTooltipPosition(rect(), SIZE, { innerWidth: 100, innerHeight: 600 }, 'left')
    expect(position.left).toBe(8)
  })
})