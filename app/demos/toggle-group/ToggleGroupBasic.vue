<script setup lang="ts">
import { ref } from 'vue'
import UiToggleGroup from '~/components/ui/UiToggleGroup.vue'

const view = ref<string | number>('list')
</script>

<template>
  <div class="flex max-w-sm flex-col gap-2">
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
    <p class="text-xs text-muted">Вигляд: {{ view }}</p>
  </div>
</template>