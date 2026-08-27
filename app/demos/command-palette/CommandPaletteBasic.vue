<script setup lang="ts">
import { ref } from 'vue'
import UiButton from '~/components/ui/UiButton.vue'
import UiCommandPalette from '~/components/ui/UiCommandPalette.vue'

const open = ref(false)
const lastAction = ref('—')

/*
 * Палітра лишається чистим компонентом: тут немає ані роутів, ані NuxtLink.
 * «Навігація» — звичайні команди, що лише емітять select; рішення, що
 * робити з вибором (перехід, дія, лог), — справа споживача.
 */
const groups = [
  {
    id: 'actions',
    label: 'Дії',
    items: [
      { id: 'create-page', label: 'Створити сторінку', hint: '⌘N' },
      { id: 'import', label: 'Імпорт', hint: '⌘I' },
    ],
  },
  {
    id: 'navigation',
    label: 'Навігація',
    items: [
      { id: 'home-docs', label: 'Головна docs' },
      { id: 'tokens', label: 'Токени' },
    ],
  },
]

function onSelect(payload: { groupId: string; item: string }) {
  const label =
    groups
      .find((group) => group.id === payload.groupId)
      ?.items.find((item) => item.id === payload.item)?.label ?? payload.item
  lastAction.value = `${label} (${payload.groupId}/${payload.item})`
}
</script>

<template>
  <div class="flex flex-col items-center gap-3">
    <UiButton @click="open = true">Відкрити палітру</UiButton>

    <!-- Ctrl+K / Cmd+K працює глобально — це повноцінний хоткей демо, не
         декорація. Спробуйте і з клавіатури. -->
    <p class="text-sm text-muted">
      Або натисніть <kbd class="rounded border border-line bg-subtle px-1.5 py-0.5 text-xs text-ink">Ctrl</kbd>
      <span class="text-muted">+</span>
      <kbd class="rounded border border-line bg-subtle px-1.5 py-0.5 text-xs text-ink">K</kbd>
    </p>

    <p class="text-sm text-muted">Остання дія: {{ lastAction }}</p>

    <UiCommandPalette
      v-model="open"
      :groups="groups"
      @select="onSelect"
    />
  </div>
</template>