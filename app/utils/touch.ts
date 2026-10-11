/**
 * Дрібниці дотику, без яких вебзастосунок на телефоні відчувається сайтом.
 * Кожна безпечна поза браузером (SSR) і на пристрої з мишею.
 */

function matches(query: string): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches
}

/**
 * Короткий тактильний відгук: довге натискання відкрило меню, свайп дійшов
 * до межі дії. Лише на дотику (з мишею вібрація лише дивує) і лише там, де
 * є Vibration API — Android; iOS Safari його не має.
 */
export function haptic(ms = 8): void {
  try {
    if (typeof navigator !== 'undefined' && matches('(pointer: coarse)')) navigator.vibrate?.(ms)
  } catch {
    /* вібрацію заборонено політикою чи браузером — без відгуку */
  }
}

/**
 * iOS Safari вмикає `:active` на дотику лише тоді, коли на сторінці є
 * обробник `touchstart` — без цього натиснутий рядок чи кнопка не
 * підсвічуються. Порожній пасивний слухач прокрутки не гальмує. Викликати
 * один раз на застосунок; повертає функцію зняття.
 */
export function enableTouchActiveStates(): () => void {
  if (typeof document === 'undefined') return () => {}
  const noop = () => {}
  document.addEventListener('touchstart', noop, { passive: true })
  return () => document.removeEventListener('touchstart', noop)
}

/**
 * Екранна клавіатура: дотик без миші й тачпада. Поле повідомлення тоді, як
 * у мобільних месенджерах, ставить на Enter новий рядок, а надсилає кнопка —
 * на телефоні Shift+Enter не натиснеш, і повідомлення відлітали б
 * недописаними.
 */
export function softKeyboard(): boolean {
  return matches('(hover: none) and (pointer: coarse)')
}
