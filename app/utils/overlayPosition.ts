/**
 * Z-index телепортованої дочірньої панелі відносно оверлея з тригером.
 * На звичайній сторінці зберігає базовий шар dropdown; усередині глибоко
 * вкладених modal/drawer піднімає панель рівно над поточним оверлеєм.
 */
export function getOverlayChildZIndex(anchor: Element | null, fallback = 1100): number {
  const overlay = anchor?.closest<HTMLElement>('[data-ui-overlay]')
  if (!overlay || typeof window === 'undefined') return fallback
  const value = Number.parseInt(window.getComputedStyle(overlay).zIndex, 10)
  return Number.isFinite(value) ? Math.max(fallback, value + 1) : fallback
}

/**
 * `left`/`right` центрують панель по висоті тригера (поповер), а
 * `left-start`/`right-start` вирівнюють верхні краї (меню, підменю).
 */
export type AnchoredPlacement =
  | 'bottom-start'
  | 'bottom'
  | 'bottom-end'
  | 'top-start'
  | 'top'
  | 'top-end'
  | 'left'
  | 'right'
  | 'left-start'
  | 'right-start'

interface Size {
  width: number
  height: number
}

export interface AnchoredPanelPosition {
  top: number
  left: number
  /** Бік, на якому панель опинилася після фліпу. */
  placement: AnchoredPlacement
  /**
   * Скільки висоти є на цьому боці до краю вікна. Панель, вища за це
   * число, або обрізається, або її треба прокручувати.
   */
  maxHeight: number
}

const FLIP: Record<AnchoredPlacement, AnchoredPlacement> = {
  'bottom-start': 'top-start',
  bottom: 'top',
  'bottom-end': 'top-end',
  'top-start': 'bottom-start',
  top: 'bottom',
  'top-end': 'bottom-end',
  left: 'right',
  right: 'left',
  'left-start': 'right-start',
  'right-start': 'left-start',
}

/** Чиста геометрія anchored-панелей із фліпом і притисканням до viewport. */
export function computeAnchoredPanelPosition(
  anchor: Pick<DOMRect, 'top' | 'right' | 'bottom' | 'left' | 'width' | 'height'>,
  panel: Size,
  viewport: Size,
  placement: AnchoredPlacement = 'bottom-start',
  gap = 6,
  edge = 8,
): AnchoredPanelPosition {
  const spaceBelow = viewport.height - anchor.bottom - gap - edge
  const spaceAbove = anchor.top - gap - edge
  const side = placement.split('-')[0]

  let resolved = placement
  if (side === 'bottom' && panel.height > spaceBelow && spaceAbove > spaceBelow) {
    resolved = FLIP[placement]
  } else if (side === 'top' && panel.height > spaceAbove && spaceBelow > spaceAbove) {
    resolved = FLIP[placement]
  } else if (side === 'right' && anchor.right + gap + panel.width > viewport.width - edge) {
    resolved = FLIP[placement]
  } else if (side === 'left' && anchor.left - gap - panel.width < edge) {
    resolved = FLIP[placement]
  }

  let top = anchor.bottom + gap
  let left = anchor.left
  if (resolved.startsWith('top')) top = anchor.top - panel.height - gap
  if (resolved === 'bottom-end' || resolved === 'top-end') left = anchor.right - panel.width
  else if (resolved === 'bottom' || resolved === 'top') left = anchor.left + (anchor.width - panel.width) / 2
  else if (resolved.startsWith('right') || resolved.startsWith('left')) {
    top = resolved.endsWith('-start') ? anchor.top : anchor.top + (anchor.height - panel.height) / 2
    left = resolved.startsWith('right') ? anchor.right + gap : anchor.left - panel.width - gap
  }

  const resolvedSide = resolved.split('-')[0]
  const maxHeight =
    resolvedSide === 'top'
      ? spaceAbove
      : resolvedSide === 'bottom'
        ? spaceBelow
        : viewport.height - edge * 2

  return {
    top: Math.max(edge, Math.min(top, viewport.height - panel.height - edge)),
    left: Math.max(edge, Math.min(left, viewport.width - panel.width - edge)),
    placement: resolved,
    maxHeight: Math.max(0, maxHeight),
  }
}
