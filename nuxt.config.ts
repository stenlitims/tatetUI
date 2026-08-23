import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  modules: ['@nuxt/content'],

  // ssr: true (за замовчуванням) — НЕ вимикати.
  // Сайт прередериться статикою; у SPA-режимі @nuxt/content змушений
  // тягнути в браузер WASM-SQLite і дамп бази замість готового payload.
  ssr: true,

  css: ['~/assets/css/main.css'],

  vite: {
    plugins: [tailwindcss()],
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
      routes: ['/'],
      failOnError: true,
    },
  },

  app: {
    head: {
      htmlAttrs: { lang: 'uk' },
      meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
    },
  },
})
