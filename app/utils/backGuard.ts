/**
 * Ядро «системного назад»: кнопка чи жест «назад» Android, «назад»
 * браузера на телефоні закривають верхній шар — шторку, меню, вікно, — а
 * не йдуть з екрана під ним. Без фреймворку: історію, підписку на popstate
 * і самі шари передають залежностями. Зв'язку зі стеком оверлеїв і
 * роутером дає `useSystemBack`.
 *
 * Поки відкрито N таких шарів, поверх справжнього запису історії лежить N
 * записів-«охоронців» з тією самою адресою. «Назад» знімає один: подію
 * popstate перехоплюємо раніше за роутер (`utils/popstateFirst`) і
 * закриваємо верхній шар. Закрили шар самі (хрестик, Escape) — зайві
 * охоронці прибираються кроком назад, і цей popstate теж не доходить до
 * роутера. Для роутера охоронців не існує: його запис і стан не
 * змінюються, тож перехід, що стартував, поки шар відкрито, спершу знімає
 * охоронців (`release`) і лягає на справжній запис.
 */

export const GUARD_KEY = 'uiBackGuard'

export interface BackGuardDeps {
  history: { readonly state: unknown; pushState(data: unknown, unused: string): void; go(delta: number): void }
  /**
   * Підписка на popstate, що спрацьовує РАНІШЕ за роутер
   * (`utils/popstateFirst`): лише тоді stopImmediatePropagation ховає подію
   * від нього.
   */
  listen: (handler: (event: Event) => void) => () => void
  /** Скільки відкритих шарів закриває «назад»; 0 — не втручаємося. */
  depth: () => number
  /** Закрити верхній шар. Може відмовити (зайнятий шар) — охоронець повернеться. */
  dismiss: () => void
  /** Відкласти перерахунок (типово — наступна макрозадача). */
  defer?: (fn: () => void) => void
}

export interface BackGuard {
  /** Перерахувати охоронців після зміни шарів (з дебаунсом). */
  schedule: () => void
  /**
   * Перед програмною навігацією: зняти охоронців і не ставити нових до
   * `resume`. Проміс — коли браузер справді повернувся на справжній запис.
   */
  release: () => Promise<void>
  /** Навігація завершилась: охоронці знову за кількістю шарів. */
  resume: () => void
  stop: () => void
}

function asObject(state: unknown): Record<string, unknown> {
  return state && typeof state === 'object' ? (state as Record<string, unknown>) : {}
}

export function isGuardState(state: unknown): boolean {
  return GUARD_KEY in asObject(state)
}

export function createBackGuard(d: BackGuardDeps): BackGuard {
  let guards = 0
  /** Наші кроки назад, чий popstate ще не прийшов. */
  let pending = 0
  let suspended = false
  let scheduled = false
  let waiters: (() => void)[] = []
  const defer = d.defer ?? ((fn: () => void) => void setTimeout(fn, 0))

  let lostTimer: ReturnType<typeof setTimeout> | null = null
  function flushWaiters() {
    const ready = waiters
    waiters = []
    ready.forEach((resolve) => resolve())
  }

  function stepBack(count: number) {
    pending += 1
    d.history.go(-count)
    // popstate загубився (сторінку вивантажують, браузер відмовив) — не
    // тримаємо навігацію й охоронців у очікуванні вічно.
    if (lostTimer) clearTimeout(lostTimer)
    lostTimer = setTimeout(() => {
      lostTimer = null
      if (pending === 0) return
      pending = 0
      flushWaiters()
      schedule()
    }, 1000)
  }

  function reconcile() {
    scheduled = false
    if (pending > 0 || suspended) return
    const n = Math.max(0, d.depth())
    if (n > guards) {
      for (; guards < n; guards += 1) d.history.pushState({ ...asObject(d.history.state), [GUARD_KEY]: guards + 1 }, '')
    } else if (n < guards) {
      const extra = guards - n
      guards = n
      stepBack(extra)
    }
  }

  function schedule() {
    if (scheduled) return
    scheduled = true
    defer(reconcile)
  }

  function onPopState(event: Event) {
    if (pending > 0) {
      // Наш власний крок назад: роутер про нього знати не має.
      pending -= 1
      event.stopImmediatePropagation()
      flushWaiters()
      schedule()
      return
    }
    if (guards > 0) {
      // «Назад» над відкритим шаром: браузер уже зняв одного охоронця.
      guards -= 1
      event.stopImmediatePropagation()
      if (d.depth() > 0) d.dismiss()
      // Шар відмовився закритися (зайнятий) — охоронець повернеться.
      schedule()
    }
  }

  function waitPop(): Promise<void> {
    return new Promise((resolve) => waiters.push(resolve))
  }

  async function release() {
    suspended = true
    while (pending > 0) await waitPop()
    if (guards > 0) {
      const count = guards
      guards = 0
      stepBack(count)
      await waitPop()
    }
  }

  function resume() {
    suspended = false
    schedule()
  }

  const unlisten = d.listen(onPopState)
  return {
    schedule,
    release,
    resume,
    stop: () => {
      if (lostTimer) clearTimeout(lostTimer)
      unlisten()
    },
  }
}
