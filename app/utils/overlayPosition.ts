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

/**
 * Видима частина вікна в координатах `getBoundingClientRect()`.
 * `top`/`left` — зсув видимої області всередині layout viewport.
 */
export interface ViewportBox extends Size {
  top?: number
  left?: number
}

/**
 * Видима область — `visualViewport`, а не `innerWidth`/`innerHeight`.
 *
 * Екранна клавіатура на iOS (і на Android починаючи з Chrome 108) НЕ
 * зменшує layout viewport: `innerHeight` лишається повним, і випадайка під
 * полем, яка за цим числом «влазить донизу», фізично лежить під
 * клавіатурою — видно хіба перший пункт. `visualViewport` зменшується разом
 * із клавіатурою, а `offsetTop` каже, наскільки браузер її прокрутив.
 * Те саме з pinch-zoom: панель лишається в тій частині, яку людина бачить.
 */
export function getVisibleViewport(): ViewportBox {
  const visual = typeof window !== 'undefined' ? window.visualViewport : null
  if (!visual) return { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight }
  return { top: visual.offsetTop, left: visual.offsetLeft, width: visual.width, height: visual.height }
}

/**
 * Одна підписка на все, що зсуває якір або видиму область: прокрутку
 * будь-якого контейнера (capture — подія scroll не спливає), resize вікна
 * і `visualViewport` — поява й зникнення екранної клавіатури, pinch-zoom.
 * Без останнього панель лишалася під клавіатурою, що виїхала вже ПІСЛЯ
 * відкриття (фокус у пошук усередині панелі). Повертає відписку.
 */
export function listenViewportChanges(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const visual = window.visualViewport
  window.addEventListener('scroll', callback, { passive: true, capture: true })
  window.addEventListener('resize', callback, { passive: true })
  visual?.addEventListener('resize', callback)
  visual?.addEventListener('scroll', callback)
  return () => {
    window.removeEventListener('scroll', callback, true)
    window.removeEventListener('resize', callback)
    visual?.removeEventListener('resize', callback)
    visual?.removeEventListener('scroll', callback)
  }
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
  viewport: ViewportBox,
  placement: AnchoredPlacement = 'bottom-start',
  gap = 6,
  edge = 8,
): AnchoredPanelPosition {
  const viewTop = viewport.top ?? 0
  const viewLeft = viewport.left ?? 0
  const viewBottom = viewTop + viewport.height
  const viewRight = viewLeft + viewport.width
  const spaceBelow = viewBottom - anchor.bottom - gap - edge
  const spaceAbove = anchor.top - viewTop - gap - edge
  const side = placement.split('-')[0]

  let resolved = placement
  if (side === 'bottom' && panel.height > spaceBelow && spaceAbove > spaceBelow) {
    resolved = FLIP[placement]
  } else if (side === 'top' && panel.height > spaceAbove && spaceBelow > spaceAbove) {
    resolved = FLIP[placement]
  } else if (side === 'right' && anchor.right + gap + panel.width > viewRight - edge) {
    resolved = FLIP[placement]
  } else if (side === 'left' && anchor.left - gap - panel.width < viewLeft + edge) {
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
    top: Math.max(viewTop + edge, Math.min(top, viewBottom - panel.height - edge)),
    left: Math.max(viewLeft + edge, Math.min(left, viewRight - panel.width - edge)),
    placement: resolved,
    maxHeight: Math.max(0, maxHeight),
  }
}

/**
 * Позиція панелі з обмеженням висоти — два проходи.
 *
 * Перший прохід із ПРИРОДНОЮ висотою (scrollHeight + рамки: коли панель
 * уже обмежена max-height, offsetHeight бреше про те, скільки їй треба)
 * обирає бік. Якщо на обраному боці місця менше, другий прохід рахує
 * позицію для висоти, що вміщається: інакше притискання до краю
 * піднімало високу панель просто поверх тригера. На телефоні з відкритою
 * клавіатурою це штатний випадок, а не крайній.
 */
export function placeAnchoredPanel(
  anchor: Pick<DOMRect, 'top' | 'right' | 'bottom' | 'left' | 'width' | 'height'>,
  panel: HTMLElement | null,
  viewport: ViewportBox,
  placement: AnchoredPlacement = 'bottom-start',
  options: { fallback?: Size; cap?: number; gap?: number; edge?: number } = {},
): AnchoredPanelPosition & { fits: boolean; height: number } {
  const fallback = options.fallback ?? { width: 200, height: 160 }
  const width = panel?.offsetWidth || fallback.width
  let natural = panel ? panel.scrollHeight + (panel.offsetHeight - panel.clientHeight) : fallback.height
  if (options.cap) natural = Math.min(natural, options.cap)

  let point = computeAnchoredPanelPosition(anchor, { width, height: natural }, viewport, placement, options.gap, options.edge)
  const fits = natural <= point.maxHeight
  if (!fits) {
    point = computeAnchoredPanelPosition(anchor, { width, height: point.maxHeight }, viewport, point.placement, options.gap, options.edge)
  }
  return { ...point, fits, height: fits ? natural : point.maxHeight }
}

/** Відступ панелі від країв вікна — той самий `edge`, що в геометрії вище. */
const VIEWPORT_EDGE = 8

/**
 * Найширша панель, що ще вміщається у вікно з відступом по краях.
 * Ставиться і панелям із власною шириною (`width: 20rem`): на 320px
 * екрані 20rem = 300px, і праве поле зникало під краєм.
 */
export function viewportMaxWidth(viewport: ViewportBox): string {
  return `${Math.floor(viewport.width - VIEWPORT_EDGE * 2)}px`
}

/**
 * Стиль телепортованої випадайки поля (UiSelect, UiCombobox,
 * UiMultiSelect, UiTagInput).
 *
 * - Ширина — не менша за поле і не більша за вікно. Клас `min-w-max`
 *   тут не годиться: min-width перемагає max-width, і довгий пункт
 *   розпирав панель за край телефона.
 * - Висота — не більша за 20rem і за місце до краю ВИДИМОЇ області: з
 *   відкритою клавіатурою нижні пункти інакше лежали б під нею.
 * - Праворуч притискається до краю: вузьке поле біля правого краю з
 *   широкою панеллю інакше виштовхувало її за екран.
 */
export function dropdownPanelStyle(anchor: Element, panel: HTMLElement | null): Record<string, string> {
  const rect = anchor.getBoundingClientRect()
  const viewport = getVisibleViewport()
  const cap = (Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16) * 20
  const point = placeAnchoredPanel(rect, panel, viewport, 'bottom-start', {
    fallback: { width: rect.width, height: 240 },
    cap,
    gap: 4,
  })
  return {
    top: `${Math.round(point.top)}px`,
    left: `${Math.round(point.left)}px`,
    width: 'max-content',
    minWidth: `${Math.round(Math.min(rect.width, viewport.width - VIEWPORT_EDGE * 2))}px`,
    maxWidth: viewportMaxWidth(viewport),
    // Уся висота, доступна на обраному боці, а не поточна висота панелі:
    // список, що доріс після підвантаження, інакше різався б на рівні
    // «Завантаження…».
    maxHeight: `${Math.floor(Math.min(point.maxHeight, cap))}px`,
    zIndex: String(getOverlayChildZIndex(anchor)),
  }
}

/**
 * Стежить за розміром панелі, поки вона відкрита: відфільтрований чи
 * підвантажений список міняє висоту, і панель, перевернута догори,
 * відклеювалася від поля — між ними лишалася діра на кілька пунктів.
 */
export function observePanelSize(panel: HTMLElement | null, callback: () => void): () => void {
  if (!panel || typeof ResizeObserver === 'undefined') return () => {}
  const observer = new ResizeObserver(() => callback())
  observer.observe(panel)
  return () => observer.disconnect()
}
