import { computed, onBeforeUnmount, onMounted, ref, watch, type CSSProperties, type Ref } from 'vue'
import { bindSwipe, swipeBackCommits } from '~/utils/swipe'
import { readDurationToken, useReducedMotion } from './useReducedMotion'

/** На скільки (% ширини) нижній екран відступає під верхній — як у iOS. */
export const SWIPE_STACK_PARALLAX = 28
const SETTLE_MS = 220

export interface SwipeStackOptions {
  /** Верхній екран відкрито. */
  open: Ref<boolean>
  /** Елемент верхнього екрана (на ньому жест). */
  pageEl: Ref<HTMLElement | null>
  /** Чи можна зараз почати свайп «назад». */
  canStart?: () => boolean
  /** Повернутися: викликається, коли верхній екран уже за краєм. */
  back: () => unknown
  /** Зсув нижнього екрана під верхнім, % ширини. */
  parallax?: number
}

/**
 * Стек двох екранів на телефоні — логіка `UiSwipeStack` для власної
 * розмітки: нижній екран (список) і верхній, що в'їжджає справа (деталі).
 *
 * Верхній тягнеться за пальцем праворуч; відпустили далі ~40% чи кидком —
 * доїжджає за край і викликається `back`, інакше повертається на місце.
 * Глобального CSS не потрібно: композабл повертає стилі обох екранів і
 * тіні, а для `<Transition>` — готові хуки (`v-bind="stack.transition"`).
 * Області прокрутки всередині верхнього екрана мають отримати
 * `touch-action: pan-y pinch-zoom`, інакше браузер забирає горизонтальний
 * рух собі (див. `utils/swipe.ts`).
 */
export function useSwipeStack(opts: SwipeStackOptions) {
  const reduced = useReducedMotion()
  const parallax = opts.parallax ?? SWIPE_STACK_PARALLAX
  /** Верхній екран повністю закрив нижній: нижній можна не малювати. */
  const covered = ref(opts.open.value)
  /** Зсув верхнього екрана за пальцем, px; null — жесту немає. */
  const drag = ref<number | null>(null)
  /** Палець відпущено: екран доїжджає за край або назад на місце. */
  const settling = ref<'back' | 'stay' | null>(null)
  /** Наступна зміна екрана без анімації: її вже показав жест (свій чи браузера). */
  const instant = ref(false)
  const width = ref(typeof window === 'undefined' ? 390 : window.innerWidth)

  const progress = computed(() => (drag.value === null ? 0 : Math.min(1, Math.max(0, drag.value / width.value))))
  const settleCurve = `${SETTLE_MS}ms var(--ease-out)`
  const slowCurve = 'var(--duration-slow) var(--ease-emphasized)'
  const still = computed(() => instant.value || reduced.value)
  const shift = (p: number) => (reduced.value ? 'none' : `translateX(-${parallax * (1 - p)}%)`)

  const underStyle = computed<CSSProperties>(() => {
    if (settling.value) return { transform: settling.value === 'back' ? 'none' : shift(0), transition: `transform ${settleCurve}` }
    if (drag.value !== null) return { transform: shift(progress.value), transition: 'none' }
    return { transform: opts.open.value ? shift(0) : 'none', transition: still.value ? 'none' : `transform ${slowCurve}` }
  })

  const DIM: CSSProperties = {
    pointerEvents: 'none',
    backgroundColor: 'color-mix(in oklab, var(--backdrop) 14%, transparent)',
  }
  const dimStyle = computed<CSSProperties>(() => {
    if (settling.value) return { ...DIM, opacity: settling.value === 'back' ? 0 : 1, transition: `opacity ${settleCurve}` }
    if (drag.value !== null) return { ...DIM, opacity: 1 - progress.value, transition: 'none' }
    return { ...DIM, opacity: opts.open.value ? 1 : 0, transition: still.value ? 'none' : `opacity ${slowCurve}` }
  })

  // Тінь лівого краю видно, лише коли екран не на місці: у спокої вона за
  // межами екрана. pan-y — горизонтальний рух лишається жесту.
  const PAGE: CSSProperties = {
    boxShadow: '-1px 0 0 var(--line), -0.75rem 0 2rem color-mix(in oklab, var(--backdrop) 16%, transparent)',
    touchAction: 'pan-y pinch-zoom',
  }
  const pageStyle = computed<CSSProperties>(() => {
    if (settling.value) return { ...PAGE, transform: settling.value === 'back' ? 'translateX(100%)' : 'none', transition: `transform ${settleCurve}` }
    if (drag.value !== null) return { ...PAGE, transform: `translateX(${drag.value}px)`, transition: 'none' }
    return PAGE
  })

  /** Нижній екран сховано (visibility), поки верхній стоїть на ньому. */
  const underHidden = computed(() => covered.value && opts.open.value && drag.value === null && !settling.value)

  /*
   * Вхід і вихід верхнього екрана — Web Animations, а не CSS-класи: так
   * композабл не тягне глобальних стилів. Тривалість і крива — ті самі
   * токени, що й transition нижнього екрана, тож обидва рухаються разом.
   * Таймер — на випадок фонової вкладки, де finished може не настати.
   */
  function slide(el: Element, from: string, to: string, done: () => void) {
    const node = el as HTMLElement
    if (still.value || typeof node.animate !== 'function') return done()
    const duration = readDurationToken('--duration-slow', 260)
    const easing =
      getComputedStyle(document.documentElement).getPropertyValue('--ease-emphasized').trim() || 'cubic-bezier(0.32, 0.72, 0, 1)'
    const animation = node.animate([{ transform: from }, { transform: to }], { duration, easing })
    let finished = false
    const finish = () => {
      if (finished) return
      finished = true
      done()
    }
    animation.finished.then(finish, finish)
    setTimeout(finish, duration + 80)
  }

  const transition = {
    css: false,
    onEnter: (el: Element, done: () => void) => slide(el, 'translateX(100%)', 'none', done),
    onAfterEnter: () => {
      covered.value = true
    },
    onBeforeLeave: () => {
      covered.value = false
    },
    // Після свайпу екран уже за краєм — анімувати нічого.
    onLeave: (el: Element, done: () => void) => (settling.value === 'back' ? done() : slide(el, 'none', 'translateX(100%)', done)),
  }

  let settleTimer: ReturnType<typeof setTimeout> | null = null
  let settleCleanup: (() => void) | null = null
  function afterSettle(done: () => void) {
    settleCleanup?.()
    const el = opts.pageEl.value
    let finished = false
    const onEnd = (e: TransitionEvent) => {
      if (e.target === el && e.propertyName === 'transform') finish()
    }
    const finish = () => {
      if (finished) return
      finished = true
      settleCleanup?.()
      done()
    }
    settleCleanup = () => {
      el?.removeEventListener('transitionend', onEnd)
      if (settleTimer) clearTimeout(settleTimer)
      settleTimer = null
      settleCleanup = null
    }
    el?.addEventListener('transitionend', onEnd)
    settleTimer = setTimeout(finish, SETTLE_MS + 80)
  }

  function resetGesture() {
    settleCleanup?.()
    drag.value = null
    settling.value = null
  }

  function stay() {
    settling.value = 'stay'
    afterSettle(() => {
      resetGesture()
      covered.value = true
    })
  }

  let instantTimer: ReturnType<typeof setTimeout> | null = null
  function goInstant() {
    instant.value = true
    // Навігацію скасували — наступна зміна екрана знову з анімацією.
    if (instantTimer) clearTimeout(instantTimer)
    instantTimer = setTimeout(() => (instant.value = false), 1000)
  }

  let unbind: (() => void) | null = null
  watch(
    opts.pageEl,
    (el) => {
      unbind?.()
      unbind = el
        ? bindSwipe(el, {
            direction: 'right',
            canStart: () => opts.open.value && !settling.value && (opts.canStart?.() ?? true),
            onStart: () => {
              width.value = el.clientWidth || window.innerWidth
              covered.value = false
              drag.value = 0
            },
            onMove: (dx) => (drag.value = dx),
            onEnd: ({ dx, velocity, cancelled }) => {
              if (cancelled || !swipeBackCommits(dx, velocity, width.value)) return stay()
              settling.value = 'back'
              afterSettle(() => {
                goInstant()
                void opts.back()
                // Навігацію могли скасувати — екран не має лишитися за краєм.
                setTimeout(() => {
                  if (opts.open.value && settling.value === 'back') stay()
                }, 600)
              })
            },
          })
        : null
    },
    { immediate: true },
  )

  // Екран змінився — жест відпрацював, «миттєво» — лише для однієї зміни.
  watch(
    opts.open,
    (open) => {
      if (!open) resetGesture()
      instant.value = false
    },
    { flush: 'post' },
  )

  /*
   * Свайп «назад» самого браузера (Safari на iPhone, жест Android) уже
   * показав свою анімацію — наша не має програватися вдруге поверх неї.
   */
  function onPopState(e: PopStateEvent) {
    if ((e as PopStateEvent & { hasUAVisualTransition?: boolean }).hasUAVisualTransition) goInstant()
  }
  onMounted(() => window.addEventListener('popstate', onPopState))
  onBeforeUnmount(() => {
    window.removeEventListener('popstate', onPopState)
    unbind?.()
    settleCleanup?.()
    if (instantTimer) clearTimeout(instantTimer)
  })

  return {
    drag,
    settling,
    instant,
    pageStyle,
    underStyle,
    dimStyle,
    underHidden,
    /** Для `<Transition v-bind="…">` верхнього екрана. */
    transition,
    /** Скинути стан (зміна розкладки, ручне закриття поза жестом). */
    reset: () => {
      resetGesture()
      covered.value = opts.open.value
    },
  }
}
