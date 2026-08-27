<script setup lang="ts">
import { ref } from 'vue'
import UiKbd from '~/components/ui/UiKbd.vue'
import UiCopyButton from '~/components/ui/UiCopyButton.vue'
import UiToggleGroup from '~/components/ui/UiToggleGroup.vue'

const view = ref<string | number>('list')
const lastCopied = ref('')
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex flex-wrap items-center gap-2">
      <UiKbd combo="K" />
      <UiKbd :combo="['Ctrl', 'K']" />
      <UiKbd combo="Escape" />
      <UiKbd :combo="['Meta', 'Shift', 'P']" />
      <UiKbd combo="q" :uppercase="false" />
      <UiKbd>⏎</UiKbd>
    </div>

    <div class="flex flex-wrap items-center gap-3">
      <UiCopyButton text="npx nuxi init my-app" label="Копіювати команду" @copied="lastCopied = $event" />
      <UiCopyButton text="tatetUI" variant="outline" aria-label="Копіювати назву" />
      <p class="text-xs text-muted">В буфері: {{ lastCopied || '—' }}</p>
    </div>

    <div class="max-w-sm">
      <UiToggleGroup
        v-model="view"
        aria-label="Вигляд списку"
        :options="[
          { value: 'list', label: 'Список' },
          { value: 'grid', label: 'Плитка' },
          { value: 'table', label: 'Таблиця' },
        ]"
        block
      />
      <p class="mt-2 text-xs text-muted">Вигляд: {{ view }}</p>
    </div>
  </div>
</template>