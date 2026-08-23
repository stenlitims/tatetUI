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
