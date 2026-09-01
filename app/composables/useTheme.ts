import { computed, onMounted, ref } from 'vue'

export type Theme = 'light' | 'dark'
/** Що обрав користувач: конкретну тему або «як у системі». */
export type ThemePreference = Theme | 'system'

export const THEME_STORAGE_KEY = 'tatetui-theme'

const theme = ref<Theme>('light')
const preference = ref<ThemePreference>('system')

const SYSTEM_QUERY = '(prefers-color-scheme: dark)'
let systemListenerAttached = false

function systemTheme(): Theme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'light'
  return window.matchMedia(SYSTEM_QUERY).matches ? 'dark' : 'light'
}

function readStoredPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    return stored === 'dark' || stored === 'light' ? stored : 'system'
  } catch {
    return 'system'
  }
}

function applyTheme(next: Theme) {
  theme.value = next
  document.documentElement.classList.toggle('dark', next === 'dark')
}

/**
 * Перемикач світлої та темної теми.
 *
 * Початкове значення читається з DOM, а НЕ з localStorage. Клас на <html>
 * ставить блокуючий скрипт у <head> ще до першого малювання (див.
 * nuxt.config.ts), і саме він — джерело правди. Якби composable читав
 * localStorage сам, на прередереному HTML сервер і клієнт розійшлися б у
 * першому рендері й Vue лаявся б на невідповідність гідрації.
 *
 * Режим «як у системі» — це ВІДСУТНІСТЬ ключа в localStorage, а не рядок
 * 'system': блокуючий скрипт у <head> уже трактує відсутність саме так
 * (падає на matchMedia), тож третій стан не потребує змін у скрипті.
 */
export function useTheme() {
  onMounted(() => {
    theme.value = document.documentElement.classList.contains('dark') ? 'dark' : 'light'
    preference.value = readStoredPreference()

    // Поки обрано «як у системі», тема слідує за ОС наживо — без
    // перезавантаження. Слухач один на застосунок.
    if (!systemListenerAttached && typeof window.matchMedia === 'function') {
      systemListenerAttached = true
      window.matchMedia(SYSTEM_QUERY).addEventListener('change', (event) => {
        if (preference.value === 'system') applyTheme(event.matches ? 'dark' : 'light')
      })
    }
  })

  /**
   * Застосувати вибір користувача.
   *
   * `origin` — координати кліку у вікні. Якщо браузер має View Transitions
   * API і користувач не просив прибрати рух, нова тема розкривається колом
   * з цієї точки (CSS у main.css). Без API — звичайне перемикання класу.
   */
  function setPreference(next: ThemePreference, origin?: { x: number; y: number }) {
    preference.value = next
    const resolved: Theme = next === 'system' ? systemTheme() : next

    try {
      if (next === 'system') localStorage.removeItem(THEME_STORAGE_KEY)
      else localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      // Приватний режим Safari кидає на setItem. Тема все одно застосована
      // до DOM — просто не переживе перезавантаження.
    }

    if (resolved === theme.value) return

    const root = document.documentElement
    const reduceMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const startViewTransition = (
      document as Document & { startViewTransition?: (cb: () => void) => unknown }
    ).startViewTransition

    if (!startViewTransition || reduceMotion) {
      applyTheme(resolved)
      return
    }

    const x = origin?.x ?? window.innerWidth / 2
    const y = origin?.y ?? window.innerHeight / 2
    // Радіус — до найдальшого кута вікна, щоб коло накрило все.
    const radius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    )
    root.style.setProperty('--theme-x', `${x}px`)
    root.style.setProperty('--theme-y', `${y}px`)
    root.style.setProperty('--theme-r', `${radius}px`)

    startViewTransition.call(document, () => applyTheme(resolved))
  }

  /** Явно обрати світлу або темну тему (скидає режим «як у системі»). */
  function setTheme(next: Theme, origin?: { x: number; y: number }) {
    setPreference(next, origin)
  }

  /** Перемкнути між світлою і темною. Режим «як у системі» при цьому скидається. */
  function toggle(origin?: { x: number; y: number }) {
    setTheme(theme.value === 'dark' ? 'light' : 'dark', origin)
  }

  return {
    theme: computed(() => theme.value),
    preference: computed(() => preference.value),
    isDark: computed(() => theme.value === 'dark'),
    setTheme,
    setPreference,
    toggle,
  }
}
