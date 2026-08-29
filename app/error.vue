<script setup lang="ts">
import type { NuxtError } from '#app'
import { computed } from 'vue'
import DocsFooter from '~/components/docs/DocsFooter.vue'
import DocsLogo from '~/components/docs/DocsLogo.vue'
import UiButton from '~/components/ui/UiButton.vue'
import UiEmptyState from '~/components/ui/UiEmptyState.vue'

/**
 * Власна сторінка помилки.
 *
 * Без неї Nuxt показує службову: без стилів, англійською, без шапки й без
 * жодного способу повернутися. Для публічного сайту це найчастіший спосіб
 * втратити відвідувача, який просто помилився в адресі.
 */
const props = defineProps<{ error: NuxtError }>()

const isNotFound = computed(() => props.error?.statusCode === 404)

const title = computed(() => (isNotFound.value ? 'Сторінку не знайдено' : 'Щось пішло не так'))

const description = computed(() =>
  isNotFound.value
    ? 'Такої адреси немає. Можливо, сторінку перейменували — пошук у документації знайде її за назвою компонента.'
    : 'Сталася несподівана помилка. Спробуйте оновити сторінку або поверніться до документації.',
)

useHead({ title: `${title.value} — tatetUI` })
// Сторінки помилок індексувати не можна: інакше 404 з друкарською
// помилкою в адресі потрапляє у видачу як звичайна сторінка.
useSeoMeta({ robots: 'noindex' })
</script>

<template>
  <div class="flex min-h-dvh flex-col bg-main text-ink">
    <header class="flex h-[var(--header-height)] items-center border-b border-line bg-card/85 px-4 backdrop-blur">
      <NuxtLink
        to="/"
        class="rounded-control focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="tatetUI — на головну"
      >
        <DocsLogo />
      </NuxtLink>
    </header>

    <main id="content" class="flex flex-1 items-center justify-center px-4 py-20">
      <div class="w-full max-w-lg text-center">
        <p class="text-6xl font-semibold tabular-nums tracking-tight text-accent">
          {{ error?.statusCode ?? 500 }}
        </p>

        <UiEmptyState :title="title" :description="description" class="mt-4">
          <div class="flex flex-wrap justify-center gap-2">
            <UiButton to="/docs">До документації</UiButton>
            <UiButton to="/" variant="outline">На головну</UiButton>
          </div>
        </UiEmptyState>
      </div>
    </main>

    <DocsFooter />
  </div>
</template>
