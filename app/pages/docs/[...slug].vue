<script setup lang="ts">
definePageMeta({ layout: 'docs' })

const route = useRoute()

/**
 * Ключ прив'язаний до шляху, а не сталий рядок: інакше друга сторінка
 * дістала б закешовану відповідь першої. Прередер серіалізує результат
 * у _payload.json, тож у браузері запит не повторюється — саме це
 * тримає WASM-SQLite поза клієнтським бандлом.
 */
const { data: page } = await useAsyncData(`docs:${route.path}`, () =>
  queryCollection('docs').path(route.path).first(),
)

if (!page.value) {
  throw createError({ statusCode: 404, statusMessage: 'Сторінку не знайдено', fatal: true })
}

useHead({ title: `${page.value.title} — tatetUI` })
useSeoMeta({ description: page.value.description })

/**
 * Ім'я компонента і описи подій віддаємо вниз через provide, щоб у
 * markdown не доводилось писати `::component-api{name="UiButton"}` —
 * назва вже стоїть у frontmatter, і дублювати її означало б дати їй шанс
 * розійтися.
 */
provide('docsPageComponent', page.value.component)
provide('docsPageEmitDescriptions', page.value.emitDescriptions ?? {})
</script>

<template>
  <article v-if="page">
    <h1 class="text-3xl font-semibold tracking-tight text-ink">{{ page.title }}</h1>
    <p class="mt-2 text-lg text-muted">{{ page.description }}</p>

    <div class="docs-prose mt-8">
      <ContentRenderer :value="page" />
    </div>
  </article>
</template>
