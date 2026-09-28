import { getCurrentInstance, getCurrentScope, onMounted, onScopeDispose, shallowRef } from 'vue'

/**
 * Повноекранний режим через Fullscreen API.
 *
 * Навіщо обгортка, а не прямий `requestFullscreen()`:
 *
 * 1. Safari на iPad до 16.4 знає лише префіксовані `webkit*`-методи, а на
 *    iPhone елементи, крім `<video>`, на весь екран не розгортаються взагалі.
 *    Тому `supported` — чесна перевірка, і кнопку, яка нічого не зробить,
 *    компонент просто не показує.
 *
 * 2. Режим можна покинути повз нас: Escape, жест, системна кнопка. Стан
 *    синхронізується з подією `fullscreenchange`, а не з тим, що ми
 *    востаннє викликали, — інакше кнопка показувала б «Вийти», коли виходити
 *    вже нема звідки.
 *
 * 3. `exitIfEntered()` виходить лише з режиму, який увімкнули саме ми:
 *    закриття галереї не має викидати з повного екрана відео, яке людина
 *    розгорнула сама.
 *
 * `supported` виставляється в onMounted, а не при створенні: на сервері й
 * у першому клієнтському рендері значення мусить бути однаковим, інакше
 * гідрація розійдеться на кнопці в панелі інструментів.
 */

interface WebkitDocument {
  webkitFullscreenEnabled?: boolean
  webkitFullscreenElement?: Element | null
  webkitExitFullscreen?: () => Promise<void> | void
}

interface WebkitElement {
  webkitRequestFullscreen?: () => Promise<void> | void
}

const isClient = typeof document !== 'undefined'

function fullscreenElement(): Element | null {
  if (!isClient) return null
  return document.fullscreenElement ?? (document as Document & WebkitDocument).webkitFullscreenElement ?? null
}

function fullscreenEnabled(): boolean {
  if (!isClient) return false
  const legacy = document as Document & WebkitDocument
  return !!(document.fullscreenEnabled || legacy.webkitFullscreenEnabled)
}

export function useFullscreen() {
  const supported = shallowRef(false)
  const active = shallowRef(false)
  let entered = false

  function sync() {
    const now = !!fullscreenElement()
    // Скидаємо «увімкнули ми» лише на справжньому виході. Префіксований
    // webkitRequestFullscreen нічого не повертає, і одразу після виклику
    // режим ще не ввімкнувся — перевірка «зараз не на весь екран» тут
    // забула б, що вмикали саме ми.
    if (active.value && !now) entered = false
    active.value = now
  }

  async function enter(target: Element = document.documentElement): Promise<void> {
    if (!isClient || !supported.value || fullscreenElement()) return
    const legacy = target as Element & WebkitElement
    entered = true
    try {
      if (target.requestFullscreen) await target.requestFullscreen()
      else await legacy.webkitRequestFullscreen?.()
    } catch {
      entered = false
      // Браузер відмовив (немає жесту користувача, політика iframe) —
      // лишаємось у звичайному режимі, стан підтягне fullscreenchange.
    }
    sync()
  }

  async function exit(): Promise<void> {
    if (!isClient || !fullscreenElement()) return
    const legacy = document as Document & WebkitDocument
    try {
      if (document.exitFullscreen) await document.exitFullscreen()
      else await legacy.webkitExitFullscreen?.()
    } catch {
      // Режим уже покинули іншим шляхом — нічого робити.
    }
    entered = false
    sync()
  }

  function toggle(target?: Element): Promise<void> {
    return fullscreenElement() ? exit() : enter(target)
  }

  /** Вийти, лише якщо повний екран увімкнули через цей екземпляр. */
  function exitIfEntered(): Promise<void> {
    return entered ? exit() : Promise.resolve()
  }

  function listen() {
    supported.value = fullscreenEnabled()
    sync()
    document.addEventListener('fullscreenchange', sync)
    document.addEventListener('webkitfullscreenchange', sync)
  }

  // У компоненті — після монтування (див. про гідрацію вище); поза ним
  // (тест, окремий effectScope) — одразу.
  if (getCurrentInstance()) onMounted(listen)
  else if (isClient) listen()

  if (getCurrentScope()) {
    onScopeDispose(() => {
      if (!isClient) return
      document.removeEventListener('fullscreenchange', sync)
      document.removeEventListener('webkitfullscreenchange', sync)
    })
  }

  return { supported, active, enter, exit, toggle, exitIfEntered }
}
