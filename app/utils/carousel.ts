/**
 * Чиста логіка перетягування слайдів UiCarousel — поза компонентом, щоб
 * покривати тестами без рендеру (правило дому: поведінка → utils → тести).
 *
 * Два уроки з реальних мобільних пристроїв, які цей модуль кодифікує:
 *
 * 1. Поріг перетягування не може бути фіксованим у пікселях: 40px — це
 *    11% ширини екрана 360px, і «недотягнуті» змахи виглядають як поломка.
 *    Тому поріг масштабується від ширини треку, а швидкий змах (flick)
 *    листає слайд навіть коротшим рухом.
 *
 * 2. Жест треба класифікувати за домінантною віссю ДО того, як щось рухати:
 *    палець майже ніколи не рухається строго горизонтально, і без осьового
 *    блокування діагональний змах одночасно гортав би слайд і сторінку.
 */

/** Наскільки далеко має пройти жест, щоб фіксувати вісь (пікселі). */
export const DRAG_AXIS_SLOP_PX = 8

/** Мінімальна дистанція швидкого змаху (пікселі). */
export const FLICK_MIN_DISTANCE_PX = 24

/** Максимальна тривалість швидкого змаху (мілісекунди). */
export const FLICK_MAX_DURATION_MS = 200

/** Мінімальний поріг у пікселях — нижче нього жести виглядають випадковими. */
export const DRAG_MIN_THRESHOLD_PX = 40

/** Частка ширини треку, яку має пройти повільний жест для перемикання. */
export const DRAG_VIEWPORT_RATIO = 0.15

/**
 * Поріг перемикання слайда: максимум із фіксованого мінімуму і частки
 * ширини. На телефоні 360px це 54px, на планшеті 800px — 120px, тобто
 * відчуття «дотягнути слайд» однакове на будь-якому екрані.
 */
export function dragThreshold(width: number): number {
  if (!Number.isFinite(width) || width <= 0) return DRAG_MIN_THRESHOLD_PX
  return Math.max(DRAG_MIN_THRESHOLD_PX, Math.round(width * DRAG_VIEWPORT_RATIO))
}

/**
 * Вісь жесту після накопичення переміщення.
 *
 * null — ще рано судити (рух менший за поріг), 'x' — горизонтальний,
 * 'y' — вертикальний. Домінанта з невеликим запасом: рівні рухи по
 * діагоналі (|dx| ≈ |dy|) трактуються як вертикаль, бо горизонтальний
 * слайд-жест природно роблять упевнено, а скрол — навіть трохи по дузі.
 */
export function dragAxis(dx: number, dy: number, slop = DRAG_AXIS_SLOP_PX): 'x' | 'y' | null {
  const adx = Math.abs(dx)
  const ady = Math.abs(dy)
  if (Math.max(adx, ady) < slop) return null
  return adx > ady ? 'x' : 'y'
}

/**
 * Чи перемкнути слайд після завершення жесту.
 *
 * Або жест пройшов поріг відстані, або це швидкий змах — короткий, але
 * рвучкий. Тривалість бере компонент: performance.now() при pointerdown.
 */
export function shouldAdvance(options: { dx: number; elapsedMs: number; width: number }): boolean {
  const { dx, elapsedMs, width } = options
  if (Math.abs(dx) >= dragThreshold(width)) return true
  return Math.abs(dx) >= FLICK_MIN_DISTANCE_PX && elapsedMs <= FLICK_MAX_DURATION_MS
}

/**
 * Гумові краї: без `loop` жест за межами першого/останнього слайда
 * гаситься до чверті відстані — слайд пружинить, а не тягне порожнину.
 */
export function rubberBandDelta(delta: number, edges: { atStart: boolean; atEnd: boolean }): number {
  if ((edges.atStart && delta > 0) || (edges.atEnd && delta < 0)) return delta * 0.25
  return delta
}

/**
 * Напрямок перемикання за знаком зсуву.
 *
 * Палець вправо (позитивний dx) тягне слайди назад — «previous».
 */
export function swipeDirection(dx: number): 'previous' | 'next' {
  return dx > 0 ? 'previous' : 'next'
}