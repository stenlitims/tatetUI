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
