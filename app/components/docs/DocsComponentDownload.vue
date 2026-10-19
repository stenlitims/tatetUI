<script setup lang="ts">
import { computed } from 'vue'
import UiCopyButton from '~/components/ui/UiCopyButton.vue'
import type { RegistryDownload } from '~~/shared/types/registry'
import downloads from '~~/public/registry/downloads.json'

const props = defineProps<{ name: string }>()
defineSlots<Record<string, never>>()

// Static imports also work during prerender, where public files cannot be fetched internally.
const catalog: Record<string, RegistryDownload> = downloads
const entry = computed(() => catalog[props.name])
if (!entry.value) throw createError({ statusCode: 500, statusMessage: `Missing component download: ${props.name}` })
const config = useRuntimeConfig()
const registryUrl = computed(() => new URL(`/registry/components/${props.name}.json`, config.public.siteUrl).href)
const linkClass = 'inline-flex min-h-10 items-center justify-center rounded-control border border-line px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-ring'
</script>

<template>
  <section v-if="entry" aria-label="Завантаження компонента" class="mt-6 rounded-card border border-line bg-card p-4 sm:p-5">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h2 class="font-semibold text-ink">Використати у своєму проєкті</h2>
        <p class="mt-1 text-sm text-muted">Вихідний код, залежності та стилі. Без клонування Git.</p>
      </div>
      <a :href="entry.download" :download="`${entry.name}.zip`" :class="linkClass">Завантажити ZIP</a>
    </div>
    <div class="mt-4 flex flex-wrap items-center gap-2">
      <a :href="entry.registry" :class="linkClass">JSON для агента</a>
      <a :href="entry.markdown" :class="linkClass">Документація Markdown</a>
      <UiCopyButton :text="registryUrl" label="Копіювати URL для агента" variant="outline" size="md" />
    </div>
    <details class="mt-4 border-t border-line pt-3 text-sm">
      <summary class="cursor-pointer text-muted">Файли для перенесення · {{ entry.files.length }}</summary>
      <ul class="mt-3 space-y-2">
        <li v-for="file in entry.files" :key="file.path" class="flex min-w-0 items-start justify-between gap-3">
          <a :href="file.url" class="min-w-0 break-all rounded-control font-mono text-xs text-accent underline-offset-4 hover:underline">{{ file.path }}</a>
        </li>
      </ul>
      <p v-if="Object.keys(entry.dependencies).length" class="mt-3 text-muted">
        Зовнішні пакети та версії вказані в <a :href="entry.registry" class="text-accent underline">JSON</a>.
      </p>
    </details>
    <p class="mt-3 text-xs text-muted">
      Підключення CSS та налаштування імпортів — в
      <NuxtLink to="/docs/agents" class="rounded-control text-accent underline underline-offset-2">інструкції для агентів</NuxtLink>.
    </p>
  </section>
</template>
