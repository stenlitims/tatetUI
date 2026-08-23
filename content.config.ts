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

        status: z.enum(['stable', 'beta', 'wip']).default('stable'),

        /** Порядок усередині групи сайдбару (менше — вище). */
        order: z.number().default(100),
      }),
    }),
  },
})
