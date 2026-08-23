import { computed, onMounted, ref } from 'vue'

export type Theme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'tatetui-theme'

const theme = ref<Theme>('light')

/**
 * Перемикач світлої та темної теми.
 *
 * Початкове значення читається з DOM, а НЕ з localStorage. Клас на <html>
 * ставить блокуючий скрипт у <head> ще до першого малювання (див.
 * nuxt.config.ts), і саме він — джерело правди. Якби composable читав
 * localStorage сам, на прередереному HTML сервер і клієнт розійшлися б у
 * першому рендері й Vue лаявся б на невідповідність гідрації.
 */
export function useTheme() {
  onMounted(() => {
    theme.value = document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  })

  function setTheme(next: Theme) {
    theme.value = next
    document.documentElement.classList.toggle('dark', next === 'dark')
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      // Приватний режим Safari кидає на setItem. Тема все одно застосована
      // до DOM — просто не переживе перезавантаження.
    }
  }

  function toggle() {
    setTheme(theme.value === 'dark' ? 'light' : 'dark')
  }

  return {
    theme: computed(() => theme.value),
    isDark: computed(() => theme.value === 'dark'),
    setTheme,
    toggle,
  }
}
