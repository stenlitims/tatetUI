import type { Component } from 'vue'

/**
 * Реєстр демо-прикладів.
 *
 * Один .vue-файл на диску — три погляди на нього:
 *   components — сам компонент, щоб показати живий приклад
 *   sources    — сирий текст, щоб покласти в буфер обміну
 *   highlights — підсвічений HTML, щоб показати лістинг
 *
 * Дублювати код руками неможливо за побудовою: усі три похідні від
 * одного файлу.
 *
 * НЕ eager — це головне рішення тут.
 *
 * Кожен запис стає окремим чанком. Виміряно на зібраній сторінці Button:
 * три чанки підсвіченого коду (2.7 / 5.5 / 7.2 КБ) підключаються як
 * <link rel="prefetch">, тобто на idle-пріоритеті й поза критичним
 * шляхом — у modulepreload їх немає. Виконуються вони лише після кліку на
 * вкладку «Код».
 *
 * З eager: true той самий код опинився б у entry-чанку і їхав би
 * блокуючим modulepreload на КОЖНУ сторінку сайту, включно з тими, де
 * жодного демо немає.
 */
const componentLoaders = import.meta.glob('../demos/**/*.vue')
const sourceLoaders = import.meta.glob('../demos/**/*.vue', {
  query: '?raw',
  import: 'default',
})
const highlightLoaders = import.meta.glob('../demos/**/*.vue', {
  query: '?raw&shiki',
  import: 'default',
})

/**
 * ButtonBasic.vue → "button-basic".
 *
 * Ключем є лише basename, тож підкаталоги в app/demos — суто організація.
 * Ціна цього — basename мусить бути глобально унікальним; це перевіряє
 * `bun run check:docs`, інакше два демо тихо перекрили б одне одного.
 */
function keyOf(path: string): string {
  return path
    .split('/')
    .pop()!
    .replace(/\.vue$/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
}

function rekey<T>(map: Record<string, T>): Record<string, T> {
  return Object.fromEntries(Object.entries(map).map(([path, value]) => [keyOf(path), value]))
}

const components = rekey(componentLoaders) as Record<string, () => Promise<{ default: Component }>>
const sources = rekey(sourceLoaders) as Record<string, () => Promise<string>>
const highlights = rekey(highlightLoaders) as Record<string, () => Promise<string>>

export function useDemoRegistry() {
  return {
    components,
    sources,
    highlights,
    names: Object.keys(components).sort(),
  }
}
