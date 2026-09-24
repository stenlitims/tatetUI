import { getCurrentScope, onScopeDispose, ref } from 'vue'

/**
 * Чи просив користувач прибрати анімації (prefers-reduced-motion: reduce).
 *
 * Потрібно не лише для CSS: у <Transition> тривалість задана явно через
 * :duration, тож без цієї перевірки елемент чекав би повні 300 мс у DOM
 * навіть із вимкненою анімацією — оверлей візуально зник, а клікам ще
 * третину секунди заважає невидима панель.
 */
export function useReducedMotion() {
  const prefersReducedMotion = ref(false)

  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    prefersReducedMotion.value = query.matches

    const onChange = (event: MediaQueryListEvent) => {
      prefersReducedMotion.value = event.matches
    }

    query.addEventListener('change', onChange)
    if (getCurrentScope()) {
      onScopeDispose(() => query.removeEventListener('change', onChange))
    }
  }

  return prefersReducedMotion
}

/**
 * Тривалість токена руху (`--duration-slow`, …) у мілісекундах.
 *
 * `<Transition :duration>` потребує ЧИСЛА, а CSS анімує за токеном. Поки
 * число стояло літералом (260, 350…), проєкт, що перевизначив
 * `--duration-slow`, отримував обрізану анімацію: Vue прибирав вузол
 * раніше, ніж CSS її докручував. `fallback` — значення з tokens.css, для
 * SSR і середовищ без стилів.
 */
export function readDurationToken(name: `--${string}`, fallback: number): number {
  if (typeof window === 'undefined' || typeof document === 'undefined') return fallback
  const raw = window.getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  const value = Number.parseFloat(raw)
  if (!Number.isFinite(value)) return fallback
  return raw.endsWith('ms') ? value : raw.endsWith('s') ? value * 1000 : value
}
