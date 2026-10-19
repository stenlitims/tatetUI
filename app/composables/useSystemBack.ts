import { getCurrentScope, onScopeDispose, watch } from 'vue'
import { createBackGuard, type BackGuard } from '~/utils/backGuard'
import { onFirstPopState } from '~/utils/popstateFirst'
import { useOverlayStack } from './useOverlayStack'

/** Шар застосунку поза стеком оверлеїв: зустріч на весь екран, власна панель. */
export interface SystemBackLayer {
  /** Шар відкрито. Читайте реактивний стан — від нього залежить кількість охоронців. */
  open: () => boolean
  /** Закрити або згорнути шар. */
  close: () => void
}

/** Те, що потрібно від роутера (vue-router сумісний). */
export interface SystemBackRouter {
  beforeEach(guard: () => Promise<void>): () => void
  afterEach(hook: () => void): () => void
}

export interface SystemBackOptions {
  /**
   * Роутер: перехід, що стартував над відкритим шаром (кнопка у вікні веде
   * на інший екран), спершу знімає охоронців і лягає на справжній запис.
   */
  router?: SystemBackRouter
  /**
   * Шари застосунку, що лежать НИЖЧЕ за оверлеї бібліотеки (зустріч на весь
   * екран). Закриваються після оверлеїв; останній у списку — верхній.
   */
  layers?: SystemBackLayer[]
  /**
   * Лише на дотиковому пристрої (типово так): з мишею «назад» браузера
   * лишається навігацією, а шари закривають Escape і клік повз.
   */
  touchOnly?: boolean
}

let active: BackGuard | null = null

/**
 * Системне «назад» закриває верхній шар: модалку, drawer, меню, поповер —
 * так само, як Escape (або власним `onBack` шару, див. useOverlayLayer), —
 * далі шари застосунку (`layers`), і лише тоді повертає на попередній екран. Кнопка «назад» Android, жест, «назад»
 * браузера на телефоні.
 *
 * Потребує слухача popstate раніше за роутер — див. `utils/popstateFirst`.
 * Викликати один раз на застосунок (у `main.ts` чи в setup кореня); поза
 * компонентом повертає `stop`, у компоненті зупиняється сам.
 */
export function useSystemBack(options: SystemBackOptions = {}): { stop: () => void } {
  const noop = { stop: () => {} }
  if (typeof window === 'undefined') return noop
  if ((options.touchOnly ?? true) && !window.matchMedia?.('(pointer: coarse)').matches) return noop

  const { blockingCount, topmostBack } = useOverlayStack()
  const layers = options.layers ?? []
  const depth = () => blockingCount.value + layers.filter((layer) => layer.open()).length

  const guard = createBackGuard({
    history: window.history,
    listen: onFirstPopState,
    depth,
    dismiss: () => {
      if (blockingCount.value > 0) {
        // Шар зі своїм «назад» (useOverlayLayer({ onBack })) вирішує сам.
        const back = topmostBack()
        if (back) {
          back()
          return
        }
        // Той самий шлях, що й клавіша: поле чи список у шарі отримують
        // Escape першими, далі спільний стек закриває верхній шар.
        const target = document.activeElement instanceof HTMLElement ? document.activeElement : document.body
        target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
        return
      }
      for (let index = layers.length - 1; index >= 0; index -= 1) {
        const layer = layers[index]!
        if (layer.open()) {
          layer.close()
          return
        }
      }
    },
  })
  active = guard

  const stopWatch = watch(depth, () => guard.schedule())
  const offBefore = options.router?.beforeEach(async () => {
    await guard.release()
  })
  const offAfter = options.router?.afterEach(() => guard.resume())

  const stop = () => {
    stopWatch()
    offBefore?.()
    offAfter?.()
    guard.stop()
    if (active === guard) active = null
  }
  if (getCurrentScope()) onScopeDispose(stop)
  return { stop }
}

/**
 * Перед програмним кроком назад (`router.back()` з кнопки «Назад»): над
 * екраном могли лишитися охоронці щойно закритого вікна, і крок зняв би
 * охоронця, а не екран.
 */
export async function releaseSystemBack(): Promise<void> {
  await active?.release()
}
