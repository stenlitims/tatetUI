/**
 * Чиста логіка того, які сторінки бачить UiPagination.
 *
 * Винесено з computed visiblePages в UiPagination.vue, щоб перевіряти
 * поведінку тестом, а не рендером: компонент просто викликає функцію.
 */

export type VisiblePage = number | 'gap'

/**
 * Завжди видно першу й останню сторінку, навколо активної —
 * `siblingCount` сусідів, між блоками — розрив «…».
 */
export function computeVisiblePages(totalPages: number, current: number, siblingCount: number): VisiblePage[] {
  const total = Math.max(0, totalPages)
  const span = Math.max(1, siblingCount)

  if (total <= span * 2 + 5) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }

  const start = Math.max(2, current - span)
  const end = Math.min(total - 1, current + span)
  const pages: VisiblePage[] = [1]
  if (start > 2) pages.push('gap')
  for (let i = start; i <= end; i++) pages.push(i)
  if (end < total - 1) pages.push('gap')
  pages.push(total)
  return pages
}