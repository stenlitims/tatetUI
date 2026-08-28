<script setup lang="ts">
import { shallowRef } from 'vue'

const open = shallowRef(false)
const action = shallowRef('Ще не обрано')

function select(label: string, close: () => void) {
  action.value = label
  close()
}
</script>

<template>
  <UiContextMenu v-model="open" aria-label="Дії з файлом">
    <template #default="{ targetAttrs }">
      <button
        v-bind="targetAttrs"
        type="button"
        class="flex min-h-40 w-full items-center justify-center rounded-overlay border border-dashed border-line bg-surface-muted px-6 text-center text-sm text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Натисніть правою кнопкою або Shift+F10
      </button>
    </template>
    <template #content="{ close }">
      <button role="menuitem" class="block w-full rounded-control px-3 py-2 text-left text-sm hover:bg-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-ring" @click="select('Перейменувати', close)">Перейменувати</button>
      <button role="menuitem" class="block w-full rounded-control px-3 py-2 text-left text-sm hover:bg-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-ring" @click="select('Дублювати', close)">Дублювати</button>
      <button role="menuitem" class="block w-full rounded-control px-3 py-2 text-left text-sm text-danger hover:bg-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-ring" @click="select('Видалити', close)">Видалити</button>
    </template>
  </UiContextMenu>
  <p class="mt-3 text-sm text-muted">Остання дія: {{ action }}</p>
</template>
