<script setup lang="ts">
import { computed, ref } from 'vue'

interface Item {
  id: number
  title: string
  note: string
  pinned: boolean
  archived: boolean
}

const items = ref<Item[]>([
  { id: 1, title: 'Звіт за квартал', note: 'Оновлено сьогодні', pinned: false, archived: false },
  { id: 2, title: 'План запуску', note: 'Учора', pinned: true, archived: false },
  { id: 3, title: 'Нотатки зустрічі', note: 'Понеділок', pinned: false, archived: false },
])
const visible = computed(() => items.value.filter((item) => !item.archived))
const last = ref('Ще нічого')

function actionsFor(item: Item) {
  return [
    { key: 'pin', label: item.pinned ? 'Відкріпити' : 'Закріпити', tone: 'accent' as const },
    { key: 'archive', label: 'В архів', tone: 'neutral' as const },
    { key: 'delete', label: 'Видалити', tone: 'danger' as const },
  ]
}

function onAction(item: Item, key: string) {
  // Підпис — до зміни: після неї «Відкріпити» вже стало б «Закріпити».
  const label = actionsFor(item).find((action) => action.key === key)?.label
  if (key === 'pin') item.pinned = !item.pinned
  if (key === 'archive') item.archived = true
  if (key === 'delete') items.value = items.value.filter((other) => other.id !== item.id)
  last.value = `${label}: «${item.title}»`
}
</script>

<template>
  <div class="w-full max-w-sm">
    <p class="mb-3 text-sm text-muted">На дотиковому екрані проведіть рядок ліворуч.</p>
    <ul class="overflow-clip rounded-card border border-line">
      <li v-for="item in visible" :key="item.id" class="border-b border-line last:border-b-0">
        <UiSwipeActions :actions="actionsFor(item)" group="demo" @action="(key) => onAction(item, key)">
          <template #icon="{ action }">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path v-if="action.key === 'pin'" d="M12 17v5M9 10.76V6h6v4.76l2 3.24H7l2-3.24zM8 2h8" />
              <path v-else-if="action.key === 'archive'" d="M3 5h18v4H3zM5 9v10h14V9M10 13h4" />
              <path v-else d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
            </svg>
          </template>
          <div class="flex h-16 items-center gap-3 px-4">
            <span class="min-w-0 flex-1">
              <span class="block truncate font-medium text-ink">{{ item.title }}</span>
              <span class="block truncate text-sm text-muted">{{ item.note }}</span>
            </span>
            <span v-if="item.pinned" class="text-xs text-accent">закріплено</span>
          </div>
        </UiSwipeActions>
      </li>
    </ul>
    <p class="mt-3 text-sm text-muted" aria-live="polite">Остання дія: {{ last }}</p>
  </div>
</template>
