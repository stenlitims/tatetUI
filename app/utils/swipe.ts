/**
 * Горизонтальний свайп пальцем — спільне ядро жестів бібліотеки:
 * `UiSwipeStack` (праворуч — назад), `UiSwipeActions` (ліворуч — дії під
 * рядком) і власні жести проєкту (наприклад, «свайп — відповісти»).
 *
 * Жест бере собі лише явно горизонтальний рух — вертикальний лишається
 * прокрутці. Щоб браузер не забирав горизонтальний рух собі (і не слав
 * pointercancel), область жесту й області прокрутки в ній мають
 * `touch-action: pan-y pinch-zoom` (класи `touch-pan-y touch-pinch-zoom`):
 * область прокрутки знову вмикає панорамування для своїх дітей, тож
 * значення на предку до них не доходить.
 *
 * Лише дотик і перо: миша свайпом не користується — для неї є контекстне
 * меню й кнопки.
 */

export type SwipeDirection = 'left' | 'right'

/** Рух до цієї межі (px) — ще не жест: тап, тремтіння пальця. */
export const SWIPE_SLOP = 10
/** Горизонталь має переважати вертикаль з таким запасом. */
const DOMINANCE = 1.2

/**
 * Що робити з рухом після «люфту»: узяти жест, віддати прокрутці чи ще
 * почекати. Напрямок не той — віддаємо: свайп «назад» не заважає свайпу
 * дій на тому самому пальці.
 */
export function swipeLock(dx: number, dy: number, direction: SwipeDirection): 'pending' | 'take' | 'skip' {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_SLOP) return 'pending'
  if (Math.abs(dx) <= Math.abs(dy) * DOMINANCE) return 'skip'
  return (direction === 'right' ? dx > 0 : dx < 0) ? 'take' : 'skip'
}

/**
 * Довести «назад» до кінця чи повернути екран: пройдено частку ширини
 * (`share`, типово ~40%) або різкий кидок у той самий бік (px/мс). Кидок
 * назад скасовує навіть далекий рух — як у iOS. dx і швидкість — додатні в
 * напрямку жесту.
 */
export function swipeBackCommits(dx: number, velocity: number, width: number, share = 0.4): boolean {
  if (velocity < -0.3) return false
  if (velocity > 0.45 && dx > 24) return true
  return dx > width * share
}

/** Опір після межі: що далі тягнеш, то повільніше рухається. */
export function rubberBand(offset: number, limit: number): number {
  const sign = Math.sign(offset)
  const abs = Math.abs(offset)
  if (abs <= limit) return offset
  return sign * (limit + (abs - limit) * 0.25)
}

export interface SwipeEnd {
  /** Зсув уздовж жесту, px (праворуч додатний). */
  dx: number
  /** Швидкість наприкінці, px/мс (праворуч додатна). */
  velocity: number
  /** Браузер забрав дотик (прокрутка, другий палець, системний жест). */
  cancelled: boolean
}

export interface SwipeOptions {
  direction: SwipeDirection
  /** Чи можна почати жест з цієї точки (ціль, межі, стан екрана). */
  canStart?: (event: PointerEvent) => boolean
  /** Жест узято: рух уже явно горизонтальний. */
  onStart?: (event: PointerEvent) => void
  /** dx лише в напрямку жесту (за протилежного руху — 0). */
  onMove: (dx: number, event: PointerEvent) => void
  onEnd: (end: SwipeEnd) => void
}

/** Елементи, з яких жест не починається: там палець працює сам. */
const OWN_GESTURES =
  'input, textarea, select, [contenteditable="true"], [role="slider"], canvas, video, .touch-none, [data-no-swipe]'

/**
 * Жест не починається з полів, повзунків, полотна й будь-чого з
 * `touch-action: none` — навіть заданим інлайн-стилем (шар малювання):
 * такий елемент сам обробляє кожен рух пальця, і горизонтальний штрих
 * пером не має тягнути екран. `[data-no-swipe]` — явна відмова для решти.
 */
export function swipeIgnored(target: EventTarget | null, root?: Element): boolean {
  if (!(target instanceof Element)) return false
  if (target.closest(OWN_GESTURES)) return true
  for (let el: Element | null = target; el && el !== root; el = el.parentElement) {
    if (getComputedStyle(el).touchAction === 'none') return true
  }
  return false
}

/**
 * Палець лежить на області, що сама прокручується вбік (`overflow-x-auto`
 * зі вмістом, ширшим за неї): горизонтальний рух — її прокрутка, а не жест.
 * Інакше жест встигав би зсунути екран на кілька пікселів, перш ніж браузер
 * забере дотик собі й надішле pointercancel.
 */
export function inHorizontalScroll(target: EventTarget | null, root?: Element): boolean {
  for (let el = target instanceof Element ? target : null; el && el !== root; el = el.parentElement) {
    if (el.scrollWidth <= el.clientWidth) continue
    const overflow = getComputedStyle(el).overflowX
    if (overflow === 'auto' || overflow === 'scroll') return true
  }
  return false
}

/**
 * Вішає свайп на елемент. Повертає функцію зняття. Клік, що прийшов слідом
 * за свайпом (палець відпустили на кнопці), гаситься.
 */
export function bindSwipe(el: HTMLElement, opts: SwipeOptions): () => void {
  let pointerId: number | null = null
  let state: 'pending' | 'active' = 'pending'
  let x0 = 0
  let y0 = 0
  let lastDx = 0
  let samples: { t: number; x: number }[] = []
  let suppressClickUntil = 0

  const reset = () => {
    pointerId = null
    state = 'pending'
    samples = []
  }

  const velocity = () => {
    const last = samples[samples.length - 1]
    // Швидкість — за останні ~80 мс: зупинка перед відпусканням гасить кидок.
    const first = samples.find((s) => last && last.t - s.t <= 80)
    if (!last || !first || last.t === first.t) return 0
    return (last.x - first.x) / (last.t - first.t)
  }

  const onDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') return
    // Другий палець — щипок, а не свайп.
    if (pointerId !== null) {
      if (state === 'active') opts.onEnd({ dx: lastDx, velocity: 0, cancelled: true })
      reset()
      return
    }
    if (!e.isPrimary || swipeIgnored(e.target, el) || (opts.canStart && !opts.canStart(e))) return
    pointerId = e.pointerId
    state = 'pending'
    x0 = e.clientX
    y0 = e.clientY
    lastDx = 0
    samples = [{ t: e.timeStamp, x: e.clientX }]
  }

  const onMove = (e: PointerEvent) => {
    if (e.pointerId !== pointerId) return
    const dx = e.clientX - x0
    const dy = e.clientY - y0
    if (state === 'pending') {
      const lock = swipeLock(dx, dy, opts.direction)
      if (lock === 'pending') return
      if (lock === 'skip') return reset()
      state = 'active'
      opts.onStart?.(e)
    }
    samples.push({ t: e.timeStamp, x: e.clientX })
    if (samples.length > 12) samples.shift()
    lastDx = opts.direction === 'right' ? Math.max(0, dx) : Math.min(0, dx)
    opts.onMove(lastDx, e)
  }

  const onUp = (e: PointerEvent) => {
    if (e.pointerId !== pointerId) return
    if (state === 'active') {
      // Палець, що відпустили на кнопці після свайпу, не має її натиснути.
      // Такий клік приходить слідом за pointerup за мілісекунди; довше
      // вікно з'їдало б уже справжній дотик по дії, що з'явилася.
      suppressClickUntil = e.timeStamp + 100
      opts.onEnd({ dx: lastDx, velocity: velocity(), cancelled: false })
    }
    reset()
  }

  const onCancel = (e: PointerEvent) => {
    if (e.pointerId !== pointerId) return
    if (state === 'active') opts.onEnd({ dx: lastDx, velocity: 0, cancelled: true })
    reset()
  }

  const onClick = (e: MouseEvent) => {
    if (e.timeStamp > suppressClickUntil) return
    e.preventDefault()
    e.stopPropagation()
    suppressClickUntil = 0
  }

  el.addEventListener('pointerdown', onDown, { passive: true })
  el.addEventListener('pointermove', onMove, { passive: true })
  el.addEventListener('pointerup', onUp, { passive: true })
  el.addEventListener('pointercancel', onCancel, { passive: true })
  el.addEventListener('click', onClick, true)
  return () => {
    if (state === 'active') opts.onEnd({ dx: lastDx, velocity: 0, cancelled: true })
    reset()
    el.removeEventListener('pointerdown', onDown)
    el.removeEventListener('pointermove', onMove)
    el.removeEventListener('pointerup', onUp)
    el.removeEventListener('pointercancel', onCancel)
    el.removeEventListener('click', onClick, true)
  }
}
