<script setup lang="ts">
import { shallowRef } from 'vue'
import { menuItemClass } from '~/utils/uiFieldStyles'

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
        class="flex min-h-40 w-full items-center justify-center rounded-overlay border border-dashed border-line bg-subtle px-6 text-center text-sm text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Натисніть правою кнопкою, утримайте пальцем або Shift+F10
      </button>
    </template>
    <template #content="{ close }">
      <button role="menuitem" :class="[menuItemClass, 'rounded-control text-ink']" @click="select('Перейменувати', close)">Перейменувати</button>
      <button role="menuitem" :class="[menuItemClass, 'rounded-control text-ink']" @click="select('Дублювати', close)">Дублювати</button>
      <button role="menuitem" :class="[menuItemClass, 'rounded-control text-danger']" @click="select('Видалити', close)">Видалити</button>
    </template>
  </UiContextMenu>
  <p class="mt-3 text-sm text-muted">Остання дія: {{ action }}</p>
</template>
