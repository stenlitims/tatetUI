import { defineCollection, defineContentConfig, z } from '@nuxt/content'

export default defineContentConfig({
  collections: {
    docs: defineCollection({
      type: 'page',
      source: 'docs/**/*.md',
      schema: z.object({
        description: z.string(),

        /**
         * Ім'я РЕАЛЬНОГО SFC у app/components/ui — з нього будується
         * таблиця API. Якщо тут написати неіснуючу назву, впаде
         * `bun run check:docs`, а не тихо зрендериться порожня таблиця.
         */
        component: z.string().optional(),

        /**
         * Файли, які треба скопіювати РАЗОМ із компонентом.
         * Існує через реальний витік переносності: UiSelect імпортує
         * ~/utils/uiFieldStyles, і скопійований сам по собі не працює.
         * Сторінка рендерить цей список із власними кнопками копіювання.
         */
        dependsOn: z.array(z.string()).default([]),

        /**
         * Описи подій компонента, ключ — ім'я події.
         *
         * Єдине місце, де опис пишеться руками: nuxt-component-meta не
         * витягує JSDoc для events (для props і слотів — витягує).
         * Щоб це не роз'їхалося, check-docs звіряє набір ключів тут із
         * реальним списком подій із меты — зайвий або забутий ключ валить
         * збірку.
         */
        emitDescriptions: z.record(z.string(), z.string()).default({}),

        status: z.enum(['stable', 'beta', 'wip']).default('stable'),

        /** Порядок усередині групи сайдбару (менше — вище). */
        order: z.number().default(100),
      }),
    }),
  },
})
