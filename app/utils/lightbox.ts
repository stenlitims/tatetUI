/**
 * Чиста логіка UiLightbox — поза компонентом, щоб покривати тестами без
 * рендеру (правило дому: поведінка → utils → тести). Жести свайпу беруться
 * з utils/carousel: поріг і флік мають відчуватися однаково в каруселі й у
 * галереї.
 */

/**
 * Індекс у межах галереї.
 *
 * Без `loop` — обрізається до країв; з `loop` — загортається по колу, у
 * тому числі від'ємний (−1 → останній). Дріб і NaN не можуть потрапити в
 * `images[i]`: undefined там — це порожня сцена замість фото.
 */
export function lightboxIndex(value: number, count: number, loop = false): number {
  if (count <= 0) return 0
  const whole = Number.isFinite(value) ? Math.trunc(value) : 0
  if (loop) return ((whole % count) + count) % count
  return Math.min(Math.max(whole, 0), count - 1)
}

export interface ZoomScrollInput {
  /** Де по ширині зображення був клік: 0 — лівий край, 1 — правий. */
  fractionX: number
  /** Де по висоті зображення був клік. */
  fractionY: number
  /** Розміри зображення після збільшення, px. */
  zoomedWidth: number
  zoomedHeight: number
  /** Зсув збільшеного зображення всередині прокрутки (центрування m-auto). */
  offsetLeft: number
  offsetTop: number
  /** Де вказівник відносно видимої області сцени, px. */
  pointerX: number
  pointerY: number
}

/**
 * Прокрутка сцени після збільшення, за якої під вказівником лишається та
 * сама деталь, що була до нього.
 *
 * Точка кліку в координатах збільшеного зображення — `offset + fraction ×
 * розмір`; щоб вона опинилась під вказівником, прокрутку треба зсунути
 * рівно на різницю. Від'ємна прокрутка неможлива — браузер її обріже, але
 * тоді тест і реальність розійшлися б, тож обрізаємо тут.
 */
export function zoomScroll(input: ZoomScrollInput): { left: number; top: number } {
  return {
    left: Math.max(0, input.offsetLeft + input.fractionX * input.zoomedWidth - input.pointerX),
    top: Math.max(0, input.offsetTop + input.fractionY * input.zoomedHeight - input.pointerY),
  }
}
