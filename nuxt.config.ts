import tailwindcss from '@tailwindcss/vite'
import { shikiRaw } from './build/vite-shiki-raw'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  modules: ['@nuxt/content', 'nuxt-component-meta'],

  // ssr: true (за замовчуванням) — НЕ вимикати.
  // Сайт прередериться статикою; у SPA-режимі @nuxt/content змушений
  // тягнути в браузер WASM-SQLite і дамп бази замість готового payload.
  ssr: true,

  css: ['~/assets/css/main.css'],

  vite: {
    plugins: [shikiRaw(), tailwindcss()],
  },

  componentMeta: {
    // Сканувати всі компоненти, не лише глобальні: бібліотека живе в
    // app/components/ui і глобально не реєструється.
    globalsOnly: false,
    // `type` вимкнено свідомо: це повний тип компонента, у таблиці API він
    // не потрібен, а в JSON виходить на порядок більшим за все інше разом.
    metaFields: { type: false, props: true, slots: true, events: true, exposed: true },
  },

  content: {
    experimental: {
      // Нативний SQLite з Node (потрібен ≥ 22.5; у нас 22.22).
      // Без цього Content вимагає better-sqlite3, який bun НЕ ставить
      // автоматично, бо це optional peer — і перший же запит падає.
      sqliteConnector: 'native',
    },
    build: {
      markdown: {
        highlight: {
          // Дві теми одночасно. Shiki виконується на етапі збірки в Node,
          // у клієнтський бандл не потрапляє. Перемикання — класом .dark
          // через CSS-змінні, а не другим рендером.
          theme: {
            default: 'github-light',
            dark: 'github-dark',
          },
          langs: ['vue', 'ts', 'js', 'bash', 'json', 'css', 'html', 'diff'],
        },
      },
    },
  },

  nitro: {
    prerender: {
      crawlLinks: true,
      routes: ['/', '/api/search.json'],
      failOnError: true,
    },
  },

  hooks: {
    /**
     * Кожен .md із content/docs стає маршрутом явно.
     *
     * Самого crawlLinks недостатньо: поки сторінка не потрапила в
     * сайдбар, на неї немає жодного посилання — краулер її не бачить, і
     * вона мовчки випадає зі статичної збірки. Помітили б це лише в проді.
     */
    async 'prerender:routes'(ctx) {
      const { readdir } = await import('node:fs/promises')
      const dir = new URL('./content/docs/', import.meta.url)

      const walk = async (rel: string): Promise<string[]> => {
        const entries = await readdir(new URL(rel, dir), { withFileTypes: true })
        const out: string[] = []
        for (const e of entries) {
          if (e.isDirectory()) out.push(...(await walk(`${rel}${e.name}/`)))
          // Файли на _ — службові (шаблон сторінки), маршрутами не є.
          else if (e.name.endsWith('.md') && !e.name.startsWith('_')) out.push(rel + e.name)
        }
        return out
      }

      for (const file of await walk('')) {
        const slug = file.replace(/\.md$/, '').replace(/(^|\/)index$/, '')
        ctx.routes.add(`/docs/${slug}`.replace(/\/$/, ''))
      }

      /**
       * Мета кожного компонента бібліотеки — теж маршрут.
       *
       * ComponentApi ходить у /api/component-meta/:name через
       * useAsyncData. Без прередеру цих маршрутів статична збірка
       * лишилася б без даних, і таблиці API були б порожні — а помітили б
       * це лише в проді, бо в dev Nitro відповідає наживо.
       */
      const uiDir = new URL('./app/components/ui/', import.meta.url)
      for (const entry of await readdir(uiDir)) {
        if (entry.endsWith('.vue')) {
          ctx.routes.add(`/api/component-meta/${entry.replace(/\.vue$/, '')}`)
        }
      }
    },
  },

  app: {
    head: {
      htmlAttrs: { lang: 'uk' },
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'color-scheme', content: 'light dark' },
      ],
      script: [
        {
          /*
           * Блокуючий скрипт, що виконується ДО першого малювання.
           *
           * Сторінки прередерені, і в їхньому HTML класу .dark немає — його
           * ставить тільки клієнт. Без цього рядка користувач із темною
           * темою бачив би білий спалах на КОЖНОМУ завантаженні, поки не
           * відпрацює гідрація.
           *
           * try/catch обов'язковий: у приватному режимі Safari звернення до
           * localStorage кидає виняток, і без нього сторінка не намалювалася б
           * узагалі.
           */
          innerHTML:
            "(()=>{try{const s=localStorage.getItem('tatetui-theme');" +
            "const d=s?s==='dark':matchMedia('(prefers-color-scheme:dark)').matches;" +
            "if(d)document.documentElement.classList.add('dark')}catch(e){}})()",
          tagPriority: 'critical',
        },
      ],
    },
  },
})
