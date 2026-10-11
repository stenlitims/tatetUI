/**
 * Колір рядка стану телефона й панелі браузера (`<meta name="theme-color">`)
 * за темою ЗАСТОСУНКУ, а не ОС.
 *
 * Статичні `<meta name="theme-color" media="(prefers-color-scheme: …)">`
 * знають лише тему системи. Тему ж перемикають і вручну (`useTheme`), тож у
 * темному застосунку на світлому Android рядок стану лишався білим. Тут
 * колір береться з токена (типово `--bg-card` — колір шапки) і оновлюється,
 * щойно на `<html>` змінюється клас теми.
 *
 * Поверхня на весь екран (відеодзвінок, перегляд фото) може покласти свій
 * токен поверх — стеком, бо одна така поверхня відкривається над іншою.
 */

const surfaces: string[] = []
let baseToken = '--bg-card'

function apply(): void {
  if (typeof document === 'undefined') return
  const token = surfaces[surfaces.length - 1] ?? baseToken
  const color = getComputedStyle(document.documentElement).getPropertyValue(token).trim()
  if (!color) return
  // Варіанти з media лишаються лише до першого запуску: далі колір веде застосунок.
  document.querySelectorAll('meta[name="theme-color"][media]').forEach((m) => m.remove())
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (!meta) {
    meta = document.createElement('meta')
    meta.name = 'theme-color'
    document.head.appendChild(meta)
  }
  if (meta.content !== color) meta.content = color
}

/**
 * Стежить за класом теми на `<html>` і тримає `theme-color` у кольорі
 * токена. Повертає функцію зупинки.
 */
export function startThemeColor(options: { token?: `--${string}` } = {}): () => void {
  if (typeof MutationObserver === 'undefined' || typeof document === 'undefined') return () => {}
  baseToken = options.token ?? '--bg-card'
  apply()
  const observer = new MutationObserver(apply)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  return () => observer.disconnect()
}

/**
 * Поверхня на весь екран фарбує рядок стану своїм токеном (наприклад,
 * `--stage` темної сцени), доки не викличуть повернену функцію.
 */
export function pushThemeColorSurface(token: `--${string}`): () => void {
  surfaces.push(token)
  apply()
  let popped = false
  return () => {
    if (popped) return
    popped = true
    const index = surfaces.lastIndexOf(token)
    if (index >= 0) surfaces.splice(index, 1)
    apply()
  }
}
