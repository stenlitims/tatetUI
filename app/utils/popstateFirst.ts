/**
 * Слухач popstate, що спрацьовує раніше за роутер.
 *
 * Слухачі popstate на window викликаються в порядку реєстрації — фаза
 * захоплення тут нічого не дає (перевірено в Chromium), — а vue-router
 * реєструє свій під час створення роутера. Щоб обробник тут міг зупинити
 * подію (stopImmediatePropagation) і роутер її не побачив, слухач має
 * стати на window ПЕРШИМ:
 *
 * - Vite: `import '~/utils/popstateFirst'` першим рядком `main.ts`, до
 *   імпорту роутера;
 * - Nuxt: роутер створює плагін фреймворку, тож слухача ставить інлайн-
 *   скрипт у `<head>` — `POPSTATE_FIRST_SCRIPT` в `app.head.script`.
 *
 * Обидва шляхи ділять один реєстр на window: модуль, імпортований пізніше
 * за інлайн-скрипт, не ставить другого слухача, а підписується на той самий.
 */

type Handler = (event: PopStateEvent) => void
interface Registry {
  handlers: Set<Handler>
}

const KEY = '__uiPopstateFirst'

function registry(): Registry | null {
  if (typeof window === 'undefined') return null
  const host = window as unknown as Record<string, Registry | undefined>
  let reg = host[KEY]
  if (!reg) {
    const created: Registry = { handlers: new Set() }
    reg = created
    host[KEY] = created
    window.addEventListener('popstate', (event) => {
      for (const handler of [...created.handlers]) {
        handler(event)
        if (event.cancelBubble) return
      }
    })
  }
  return reg
}

// Імпорт модуля сам ставить слухача — саме тому його імпортують першим.
registry()

/** Підписатися на popstate раніше за роутер. Повертає відписку. */
export function onFirstPopState(handler: Handler): () => void {
  const reg = registry()
  reg?.handlers.add(handler)
  return () => {
    reg?.handlers.delete(handler)
  }
}

/**
 * Той самий слухач інлайн-скриптом — для Nuxt, де роутер створюється раніше
 * за будь-який імпорт застосунку:
 *
 * ```ts
 * // nuxt.config.ts
 * import { POPSTATE_FIRST_SCRIPT } from './app/utils/popstateFirst'
 * export default defineNuxtConfig({ app: { head: { script: [{ innerHTML: POPSTATE_FIRST_SCRIPT }] } } })
 * ```
 */
export const POPSTATE_FIRST_SCRIPT =
  "(function(){var k='__uiPopstateFirst';if(window[k])return;var r={handlers:new Set()};window[k]=r;" +
  "addEventListener('popstate',function(e){var l=Array.from(r.handlers);for(var i=0;i<l.length;i++){l[i](e);if(e.cancelBubble)return}})})()"
