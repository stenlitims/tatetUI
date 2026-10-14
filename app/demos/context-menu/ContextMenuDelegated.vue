<script setup lang="ts">
import { shallowRef } from 'vue'
import { menuItemClass } from '~/utils/uiFieldStyles'

const open = shallowRef(false)
const action = shallowRef('Ще не обрано')
const files = ['Звіт за квартал.pdf', 'Макети v3.fig', 'Нотатки зустрічі.md', 'Бюджет 2026.xlsx', 'Логотип.svg']

function select(label: string, target: HTMLElement | null, close: () => void) {
  action.value = `${label}: ${target?.dataset.file ?? '—'}`
  close()
}
</script>

<template>
  <UiContextMenu v-model="open" aria-label="Дії з файлом" target-selector="[data-file]">
    <template #default="{ targetAttrs }">
      <ul v-bind="targetAttrs" class="w-full divide-y divide-line rounded-overlay border border-line bg-card">
        <li
          v-for="file in files"
          :key="file"
          :data-file="file"
          aria-haspopup="menu"
          tabindex="0"
          class="px-4 py-3 text-sm text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          {{ file }}
        </li>
      </ul>
    </template>
    <template #content="{ close, target }">
      <button role="menuitem" :class="[menuItemClass, 'rounded-control text-ink']" @click="select('Перейменувати', target, close)">Перейменувати</button>
      <button role="menuitem" :class="[menuItemClass, 'rounded-control text-ink']" @click="select('Завантажити', target, close)">Завантажити</button>
      <button role="menuitem" :class="[menuItemClass, 'rounded-control text-danger']" @click="select('Видалити', target, close)">Видалити</button>
    </template>
  </UiContextMenu>
  <p class="mt-3 text-sm text-muted">Остання дія: {{ action }}</p>
</template>
