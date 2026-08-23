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
  /*
   * Шлях у повідомленні — не косметика.
   *
   * Голе «Сторінку не знайдено» однаково виглядає і для справді відсутньої
   * сторінки, і для запиту, що потрапив у вікно перезбірки: `nuxt build`
   * стирає й переписує .output, а `nuxt preview` віддає саме звідти. Без
   * шляху ці два випадки не розрізнити, і час іде на пошук неіснуючої
   * поламки.
   */
  throw createError({
    statusCode: 404,
    statusMessage: `Сторінку не знайдено: ${route.path}`,
    fatal: true,
  })
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

      <!--
        Клас стоїть на самому ContentRenderer, а не на обгортці навколо
        нього. ContentRenderer рендерить власний кореневий <div>, тож зайвий
        рівень вкладеності робив `.docs-prose > * + *` селектором, який не
        збігається ні з чим: усі <p> і <pre> лишалися з margin-top: 0, і
        сторінка втрачала весь вертикальний ритм між блоками. Помітно було
        лише там, де підряд ідуть абзаци й блоки коду — заголовки мають
        власні марджини й тримали вигляд решти сторінок.
      -->
      <ContentRenderer :value="page" class="docs-prose mt-8" />

      <DocsPager />
    </article>

    <aside
      class="scrollbar-thin sticky top-[calc(var(--header-height)+2.5rem)] hidden h-fit max-h-[calc(100dvh-var(--header-height)-5rem)] w-52 shrink-0 overflow-y-auto xl:block"
    >
      <DocsToc :links="page.body?.toc?.links ?? []" />
    </aside>
  </div>
</template>
