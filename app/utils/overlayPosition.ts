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

export type AnchoredPlacement =
  | 'bottom-start'
  | 'bottom'
  | 'bottom-end'
  | 'top-start'
  | 'top'
  | 'top-end'
  | 'left'
  | 'right'

interface Size {
  width: number
  height: number
}

/** Чиста геометрія anchored-панелей із фліпом і притисканням до viewport. */
export function computeAnchoredPanelPosition(
  anchor: Pick<DOMRect, 'top' | 'right' | 'bottom' | 'left' | 'width' | 'height'>,
  panel: Size,
  viewport: Size,
  placement: AnchoredPlacement = 'bottom-start',
  gap = 6,
  edge = 8,
): { top: number; left: number } {
  let resolved = placement
  const opensDown = placement.startsWith('bottom')
  const opensUp = placement.startsWith('top')
  if (opensDown && anchor.bottom + gap + panel.height > viewport.height - edge && anchor.top > viewport.height - anchor.bottom) {
    resolved = placement.replace('bottom', 'top') as AnchoredPlacement
  } else if (opensUp && anchor.top - gap - panel.height < edge && viewport.height - anchor.bottom > anchor.top) {
    resolved = placement.replace('top', 'bottom') as AnchoredPlacement
  } else if (placement === 'right' && anchor.right + gap + panel.width > viewport.width - edge) {
    resolved = 'left'
  } else if (placement === 'left' && anchor.left - gap - panel.width < edge) {
    resolved = 'right'
  }

  let top = anchor.bottom + gap
  let left = anchor.left
  if (resolved.startsWith('top')) top = anchor.top - panel.height - gap
  if (resolved.endsWith('-end')) left = anchor.right - panel.width
  else if (resolved === 'bottom' || resolved === 'top') left = anchor.left + (anchor.width - panel.width) / 2
  else if (resolved === 'right') {
    top = anchor.top + (anchor.height - panel.height) / 2
    left = anchor.right + gap
  } else if (resolved === 'left') {
    top = anchor.top + (anchor.height - panel.height) / 2
    left = anchor.left - panel.width - gap
  }

  return {
    top: Math.max(edge, Math.min(top, viewport.height - panel.height - edge)),
    left: Math.max(edge, Math.min(left, viewport.width - panel.width - edge)),
  }
}
