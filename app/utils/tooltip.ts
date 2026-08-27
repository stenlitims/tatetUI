/**
 * Чиста логіка позиціонування панелі UiTooltip.
 *
 * Винесено з updatePosition в UiTooltip.vue, щоб перевіряти поведінку
 * (фліпи, центрування, притискання) тестом, а не рендером: компонент
 * передає сюди виміряний rect і розміри панелі, а застосовує результат.
 */

export interface TooltipRect {
  top: number
  left: number
  width: number
  height: number
  right: number
  bottom: number
}

export interface TooltipSize {
  width: number
  height: number
}

export interface TooltipViewport {
  innerWidth: number
  innerHeight: number
}

export type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right'

export interface TooltipPosition {
  top: number
  left: number
}

export function computeTooltipPosition(
  rect: TooltipRect,
  tooltipSize: TooltipSize,
  viewport: TooltipViewport,
  placement: TooltipPlacement,
): TooltipPosition {
  const w = tooltipSize.width
  const h = tooltipSize.height
  const gap = 6
  const edge = 8

  let top: number
  let left: number

  switch (placement) {
    case 'bottom':
      top = rect.bottom + gap
      left = rect.left + rect.width / 2 - w / 2
      break
    case 'left':
      top = rect.top + rect.height / 2 - h / 2
      left = rect.left - w - gap
      break
    case 'right':
      top = rect.top + rect.height / 2 - h / 2
      left = rect.right + gap
      break
    default:
      top = rect.top - h - gap
      left = rect.left + rect.width / 2 - w / 2
  }

  /*
   * Фліп на протилежний бік, коли свій не влазить. Умова перевіряє САМЕ
   * той бік, куди дивиться placement: «top» фліпається вниз, коли зверху
   * менше місця, ніж висота підказки (top < edge), а не коли підказка
   * вилазить за нижній край — інакше біля верхнього краю підказка
   * перекривала б тригер замість перевороту вниз. По горизонталі —
   * симетрично: «left» перевертається праворуч, коли зліва менше місця,
   * ніж ширина підказки, «right» — ліворуч, коли справа не влазить.
   * Фліп стоїть ПЕРЕД притисканням до країв: спершу пробуємо протилежний
   * бік і лише коли не влазить і він (вузьке вікно), притискаємо —
   * інакше «left» біля лівого краю ніколи не перевернувся б, а одразу
   * липнув би до краю.
   */
  if (placement === 'top' && top < edge) {
    top = rect.bottom + gap
  } else if (placement === 'bottom' && top + h > viewport.innerHeight - edge) {
    top = rect.top - h - gap
  } else if (placement === 'left' && left < edge) {
    left = rect.right + gap
  } else if (placement === 'right' && left + w > viewport.innerWidth - edge) {
    left = rect.left - w - gap
  }

  // Притискання до країв — останній шанс для вузьких вікон.
  if (top + h > viewport.innerHeight - edge) top = viewport.innerHeight - h - edge
  if (top < edge) top = edge
  if (left + w > viewport.innerWidth - edge) left = viewport.innerWidth - w - edge
  if (left < edge) left = edge

  return { top: Math.round(top), left: Math.round(left) }
}