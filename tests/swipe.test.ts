import { afterEach, describe, expect, it, vi } from 'vitest'
import { bindSwipe, inHorizontalScroll, rubberBand, swipeBackCommits, swipeIgnored, swipeLock, type SwipeEnd } from '~/utils/swipe'

describe('swipeLock', () => {
  it('до люфту — ще не жест (тап, тремтіння пальця)', () => {
    expect(swipeLock(6, 3, 'right')).toBe('pending')
  })

  it('явно горизонтальний рух у свій бік — жест', () => {
    expect(swipeLock(24, 6, 'right')).toBe('take')
    expect(swipeLock(-24, 6, 'left')).toBe('take')
  })

  it('протилежний бік віддаємо: «назад» не заважає «відповісти»', () => {
    expect(swipeLock(-24, 2, 'right')).toBe('skip')
    expect(swipeLock(24, 2, 'left')).toBe('skip')
  })

  it('вертикальний і діагональний рух лишається прокрутці', () => {
    expect(swipeLock(4, 30, 'right')).toBe('skip')
    expect(swipeLock(20, 18, 'right')).toBe('skip')
  })
})

describe('swipeBackCommits', () => {
  it('пройдено ~40% ширини — назад', () => {
    expect(swipeBackCommits(170, 0, 390)).toBe(true)
    expect(swipeBackCommits(120, 0, 390)).toBe(false)
  })

  it('кидок праворуч — назад навіть із короткого руху', () => {
    expect(swipeBackCommits(40, 0.8, 390)).toBe(true)
  })

  it('кидок назад скасовує навіть далекий рух, як у iOS', () => {
    expect(swipeBackCommits(300, -0.6, 390)).toBe(false)
  })

  it('дрібний смик не рахується кидком', () => {
    expect(swipeBackCommits(12, 1.2, 390)).toBe(false)
  })
  it('частка ширини задається: бічна шторка закривається з третини', () => {
    expect(swipeBackCommits(110, 0, 300, 1 / 3)).toBe(true)
    expect(swipeBackCommits(90, 0, 300, 1 / 3)).toBe(false)
  })
})

describe('rubberBand', () => {
  it('до межі — як є, далі — з опором', () => {
    expect(rubberBand(-40, 80)).toBe(-40)
    expect(rubberBand(-120, 80)).toBe(-90)
    expect(rubberBand(120, 80)).toBe(90)
  })
})

describe('swipeIgnored', () => {
  it('поля, редактор і елементи з власними жестами не починають свайп', () => {
    document.body.innerHTML = `
      <div id="plain"><span id="text">текст</span></div>
      <div contenteditable="true"><span id="editor">ред</span></div>
      <button class="touch-none"><span id="mic">mic</span></button>
      <div data-no-swipe><span id="opt">opt</span></div>
      <div style="touch-action: none"><span id="draw">полотно</span></div>`
    expect(swipeIgnored(document.getElementById('text'))).toBe(false)
    expect(swipeIgnored(document.getElementById('editor'))).toBe(true)
    expect(swipeIgnored(document.getElementById('mic'))).toBe(true)
    expect(swipeIgnored(document.getElementById('opt'))).toBe(true)
    // Шар малювання дошки: touch-action: none інлайн-стилем, без класу.
    expect(swipeIgnored(document.getElementById('draw'))).toBe(true)
  })
})

describe('inHorizontalScroll', () => {
  it('лише область overflow-x, якій справді є куди прокручуватися', () => {
    document.body.innerHTML = `
      <div id="root">
        <div id="strip" style="overflow-x: auto"><span id="chip">чип</span></div>
        <div id="fits" style="overflow-x: auto"><span id="short">коротко</span></div>
        <div id="clip" style="overflow-x: hidden"><span id="hidden">обрізано</span></div>
      </div>`
    Object.defineProperty(document.getElementById('strip')!, 'scrollWidth', { value: 600 })
    Object.defineProperty(document.getElementById('clip')!, 'scrollWidth', { value: 600 })
    const root = document.getElementById('root')!
    expect(inHorizontalScroll(document.getElementById('chip'), root)).toBe(true)
    expect(inHorizontalScroll(document.getElementById('short'), root)).toBe(false)
    expect(inHorizontalScroll(document.getElementById('hidden'), root)).toBe(false)
  })
})

describe('bindSwipe', () => {
  let unbind: (() => void) | undefined
  afterEach(() => {
    unbind?.()
    unbind = undefined
    document.body.innerHTML = ''
  })

  function setup(direction: 'left' | 'right', canStart?: () => boolean) {
    document.body.innerHTML = '<div id="area"><button id="btn">Кнопка</button></div>'
    const el = document.getElementById('area')!
    const moves: number[] = []
    const ends: SwipeEnd[] = []
    const onStart = vi.fn()
    unbind = bindSwipe(el, { direction, canStart, onStart, onMove: (dx) => moves.push(dx), onEnd: (e) => ends.push(e) })
    const step = (type: string, x: number, y = 100, init: PointerEventInit = {}) =>
      document.getElementById('btn')!.dispatchEvent(
        new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, isPrimary: true, pointerType: 'touch', clientX: x, clientY: y, ...init }),
      )
    return { el, moves, ends, onStart, step }
  }

  it('горизонтальний рух у свій бік веде жест і завершує його', () => {
    const { moves, ends, onStart, step } = setup('right')
    step('pointerdown', 10)
    step('pointermove', 16)
    expect(onStart).not.toHaveBeenCalled()
    step('pointermove', 40)
    step('pointermove', 90)
    step('pointerup', 90)
    expect(onStart).toHaveBeenCalledTimes(1)
    expect(moves.at(-1)).toBe(80)
    expect(ends).toHaveLength(1)
    expect(ends[0]!.cancelled).toBe(false)
    expect(ends[0]!.dx).toBe(80)
  })

  it('вертикальний рух не стає жестом', () => {
    const { ends, onStart, step } = setup('right')
    step('pointerdown', 10, 100)
    step('pointermove', 14, 140)
    step('pointermove', 20, 200)
    step('pointerup', 20, 200)
    expect(onStart).not.toHaveBeenCalled()
    expect(ends).toHaveLength(0)
  })

  it('pointercancel (браузер забрав дотик) — скасування', () => {
    const { ends, step } = setup('left')
    step('pointerdown', 200)
    step('pointermove', 170)
    step('pointercancel', 170)
    expect(ends).toEqual([{ dx: -30, velocity: 0, cancelled: true }])
  })

  it('миша свайпом не користується', () => {
    const { onStart, step } = setup('right')
    step('pointerdown', 10, 100, { pointerType: 'mouse' })
    step('pointermove', 80, 100, { pointerType: 'mouse' })
    expect(onStart).not.toHaveBeenCalled()
  })

  it('canStart=false — жест не починається', () => {
    const { onStart, step } = setup('right', () => false)
    step('pointerdown', 10)
    step('pointermove', 80)
    expect(onStart).not.toHaveBeenCalled()
  })

  it('клік після свайпу не натискає кнопку під пальцем', () => {
    const { el, step } = setup('right')
    const clicked = vi.fn()
    document.getElementById('btn')!.addEventListener('click', clicked)
    step('pointerdown', 10)
    step('pointermove', 60)
    step('pointerup', 60)
    document.getElementById('btn')!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    expect(clicked).not.toHaveBeenCalled()
    expect(el).toBeTruthy()
  })
})
