import { readFile } from 'node:fs/promises'
import type { Highlighter } from 'shiki'
import type { Plugin } from 'vite'

/**
 * Суфікс `?raw&shiki` віддає ВЖЕ ПІДСВІЧЕНИЙ HTML файлу.
 *
 * Навіщо окремий плагін замість підсвітки в браузері: граматика Vue тягне
 * за собою html + css + js + ts, і навіть у fine-grained складанні це
 * ~500 КБ у клієнтському бандлі. Тут же підсвітка виконується в Node на
 * етапі збірки, а в клієнт їде готовий рядок HTML.
 *
 * Чому саме `?raw&shiki`, а не власний суфікс: @vitejs/plugin-vue сам
 * виходить, щойно бачить `raw` у query, тож за id ніхто не сперечається.
 * З довільним суфіксом plugin-vue спробував би скомпілювати SFC.
 */
const RE = /\?raw&shiki$/

export function shikiRaw(options?: { langs?: string[] }): Plugin {
  const langs = options?.langs ?? ['vue', 'ts', 'js', 'css', 'json']
  let highlighter: Highlighter | undefined

  return {
    name: 'tatet:shiki-raw',

    // 'pre' — щоб випередити вбудований у Vite обробник ?raw, який інакше
    // поверне сирий текст і до нас черга не дійде.
    enforce: 'pre',

    async load(id) {
      if (!RE.test(id)) return
      const file = id.replace(RE, '')

      // id з суфіксом не пов'язаний із .vue у графі модулів, тож без
      // явного addWatchFile правка демо не піднімала б HMR цієї гілки.
      this.addWatchFile(file)

      // trimEnd лише для ЛІСТИНГА: без нього кінцевий \n файлу малює
      // порожній рядок під останнім рядком коду.
      //
      // Кнопка «Копіювати» бере окремий імпорт ?raw, який Vite віддає
      // дослівно — і кінцевий \n там ЗБЕРІГАЄТЬСЯ, як і має бути у файлі.
      // Тобто скопійований текст на один символ довший за показаний.
      // Це навмисно, не розбіжність: не «виправляйте» в бік однаковості.
      const code = (await readFile(file, 'utf8')).trimEnd()

      const { createHighlighter } = await import('shiki')
      highlighter ??= await createHighlighter({
        themes: ['github-light', 'github-dark'],
        langs,
      })

      const html = highlighter.codeToHtml(code, {
        lang: 'vue',
        themes: { light: 'github-light', dark: 'github-dark' },
        // false → кольори їдуть CSS-змінними --shiki-light / --shiki-dark
        // замість жорсткого color. Тему перемикає клас .dark, без
        // повторного рендеру і без другої копії HTML.
        defaultColor: false,
      })

      /*
       * Прибираємо переноси МІЖ рядковими span.
       *
       * Shiki віддає `<span class="line">…</span>\n<span class="line">…`,
       * тобто окремим текстовим вузлом. Сам по собі він нешкідливий, але
       * @nuxt/content додає глобальне `pre code .line { display: block }`
       * для своїх блоків — і воно чіпляється й до нашої розмітки. Тоді
       * блок уже переносить рядок сам, а вцілілий \n за white-space: pre
       * утворює ЩЕ один порожній рядок: крок стає 41px замість 20.4px,
       * тобто рівно подвійний інтервал.
       *
       * Content цієї проблеми не має, бо тримає перенос ВСЕРЕДИНІ span.
       * Ми йдемо простішим шляхом — прибираємо його зовсім і оголошуємо
       * display: block самі (див. ComponentPreview), щоб не залежати від
       * чужої таблиці стилів.
       */
      const compact = html.replace(/<\/span>\n(?=<span class="line")/g, '</span>')

      return `export default ${JSON.stringify(compact)}`
    },

    handleHotUpdate({ file, server, modules }) {
      if (!file.endsWith('.vue') || !file.includes('/demos/')) return
      const extra = ['?raw', '?raw&shiki']
        .map((q) => server.moduleGraph.getModuleById(file + q))
        .filter((m): m is NonNullable<typeof m> => Boolean(m))
      return [...modules, ...extra]
    },
  }
}
