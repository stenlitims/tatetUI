<script setup lang="ts">
import DocsPager from '~/components/docs/DocsPager.vue'
import DocsToc from '~/components/docs/DocsToc.vue'

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
  <div v-if="page" class="flex gap-8">
    <article class="min-w-0 flex-1">
      <h1 class="text-3xl font-semibold tracking-tight text-ink">{{ page.title }}</h1>
      <p class="mt-2 text-lg text-muted">{{ page.description }}</p>

      <div class="docs-prose mt-8">
        <ContentRenderer :value="page" />
      </div>

      <DocsPager />
    </article>

    <aside
      class="scrollbar-thin sticky top-[calc(var(--header-height)+2.5rem)] hidden h-fit max-h-[calc(100dvh-var(--header-height)-5rem)] w-52 shrink-0 overflow-y-auto xl:block"
    >
      <DocsToc :links="page.body?.toc?.links ?? []" />
    </aside>
  </div>
</template>
